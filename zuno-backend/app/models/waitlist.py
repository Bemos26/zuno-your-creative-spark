"""
Waitlist data access
======================
Every function here does exactly ONE job: run one SQL operation against
the `waitlist_entries` table, and return plain Python data (dicts).

Routes (in routes/waitlist_routes.py) never write SQL themselves — they
call these functions instead. This keeps all your SQL in a single file,
which makes bugs far easier to find later ("something's wrong with how
we save entries" -> you know to look here, and only here).

*** SECURITY: READ THIS ***
Every query below builds SQL using ? placeholders, with the actual
values passed as a separate tuple to `cursor.execute(sql, values)`.
This is what prevents SQL injection: PyMySQL escapes each value safely
before it ever reaches MySQL, so even if someone submits an email like
`x' OR '1'='1` as an attack attempt, it's treated as a harmless literal
string value — never as part of the SQL command itself.

NEVER build SQL with an f-string or `.format()` using raw user input,
e.g. NEVER do: f"SELECT * FROM waitlist_entries WHERE email = '{email}'"
That pattern is exactly how SQL injection vulnerabilities happen.
"""

import uuid
import random
import string
from app.db import get_db_connection


def find_by_email(email: str):
    """Returns the matching row as a dict, or None if no match."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM waitlist_entries WHERE email = ?",
            (email,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()  # always release the connection, even if something errors above


def create_waitlist_entry(
    full_name: str,
    email: str,
    referral_source: str,
    ip_address: str,
    user_agent: str,
    verification_token: str,
    referred_by_code: str = None,  # NEW: the code of whoever referred them, if any
) -> dict:
    """
    Inserts a new waitlist row, assigns its `position`, generates this
    person's own shareable `referral_code`, records who referred them
    (if anyone), and returns the fully saved row.
    """
    public_id = str(uuid.uuid4())
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        # NEW: generate this person's own code, which they'll share
        referral_code = _generate_unique_referral_code(cursor)

        cursor.execute(
            """
            INSERT INTO waitlist_entries
                (public_id, full_name, email, referral_source,
                 ip_address, user_agent, verification_token,
                 referral_code, referred_by_code)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                public_id,
                full_name,
                email,
                referral_source,
                ip_address,
                user_agent,
                verification_token,
                referral_code,        # NEW
                referred_by_code,     # NEW
            ),
        )

        new_id = cursor.lastrowid

        cursor.execute(
            "UPDATE waitlist_entries SET position = ? WHERE id = ?",
            (new_id, new_id),
        )

        conn.commit()

        cursor.execute("SELECT * FROM waitlist_entries WHERE id = ?", (new_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()



def verify_by_token(token: str):
    """
    Finds the row with this verification token and marks it verified.

    Returns the updated row as a dict, or None if the token doesn't
    match anything — meaning either it was already used once before
    (we clear it after use, see below), or it's simply invalid.
    """
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        # Step 1: find the matching row
        cursor.execute(
            "SELECT * FROM waitlist_entries WHERE verification_token = ?",
            (token,),
        )
        row = cursor.fetchone()
        if not row:
            return None

        # Step 2: mark it verified, and clear the token so this same
        # link can never be used again (a link should only work once).
        cursor.execute(
            """
            UPDATE waitlist_entries
            SET is_verified = TRUE, verification_token = NULL
            WHERE id = ?
            """,
            (row["id"],),
        )
        conn.commit()

        # Step 3: read back the fresh row to return to the caller.
        cursor.execute(
            "SELECT * FROM waitlist_entries WHERE id = ?", (row["id"],)
        )
        row = cursor.fetchone()
        return dict(row) if row else None
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _generate_code(length: int = 8) -> str:
    """Generates a random uppercase alphanumeric code, e.g. 'ZK4P9RXT'."""
    alphabet = string.ascii_uppercase + string.digits
    return "".join(random.choices(alphabet, k=length))


def _generate_unique_referral_code(cursor) -> str:
    """
    Keeps generating random codes until it finds one that isn't already
    taken. Collisions are extremely rare with 8 random characters, but
    checking costs almost nothing and guarantees correctness.
    """
    while True:
        code = _generate_code()
        cursor.execute(
            "SELECT id FROM waitlist_entries WHERE referral_code = ?", (code,)
        )
        if not cursor.fetchone():
            return code


def find_by_referral_code(code: str):
    """Returns the matching row as a dict, or None if no match."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM waitlist_entries WHERE referral_code = ?",
            (code,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def award_referral_points(referral_code: str, points: int) -> None:
    """
    Adds `points` to whoever owns this referral_code. Called only when
    the person they referred successfully verifies their email.
    """
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE waitlist_entries SET points = points + ? WHERE referral_code = ?",
            (points, referral_code),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def count_referrals_by_code(code: str) -> int:
    """Counts how many verified signups used this referral code."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT COUNT(*) AS total FROM waitlist_entries
            WHERE referred_by_code = ? AND is_verified = TRUE
            """,
            (code,),
        )
        row = cursor.fetchone()
        return row["total"] if row else 0
    finally:
        conn.close()

 

def count_active_entries() -> int:
    """Counts everyone on the waitlist except those who unsubscribed."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT COUNT(*) AS total FROM waitlist_entries WHERE status != 'unsubscribed'"
        )
        row = cursor.fetchone()
        return row["total"]
    finally:
        conn.close()


def list_all_entries(search: str = None) -> list:
    """
    Returns every waitlist entry, each annotated with its own
    `referral_count` (how many verified people used its referral_code),
    newest signups first. Optionally filtered by a search term matching
    name, email, or referral_code.
    """
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        sql = """
            SELECT
                w.*,
                (
                    SELECT COUNT(*) FROM waitlist_entries r
                    WHERE r.referred_by_code = w.referral_code
                      AND r.is_verified = TRUE
                ) AS referral_count
            FROM waitlist_entries w
        """
        params = ()
        if search:
            sql += """
                WHERE w.full_name LIKE ?
                   OR w.email LIKE ?
                   OR w.referral_code LIKE ?
            """
            term = f"%{search}%"
            params = (term, term, term)
        sql += " ORDER BY w.points DESC, w.created_at DESC"
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def find_by_public_id(public_id: str):
    """Returns the matching row as a dict, or None if no match."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM waitlist_entries WHERE public_id = ?",
            (public_id,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def set_points(public_id: str, points: int) -> dict:
    """Sets (not adds to) an entry's points to an exact value. Admin-only."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE waitlist_entries SET points = ? WHERE public_id = ?",
            (points, public_id),
        )
        conn.commit()
        cursor.execute(
            "SELECT * FROM waitlist_entries WHERE public_id = ?", (public_id,)
        )
        row = cursor.fetchone()
        return dict(row) if row else None
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def set_verified(public_id: str, is_verified: bool) -> dict:
    """Manually marks an entry verified/unverified. Admin-only override."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE waitlist_entries SET is_verified = ? WHERE public_id = ?",
            (is_verified, public_id),
        )
        conn.commit()
        cursor.execute(
            "SELECT * FROM waitlist_entries WHERE public_id = ?", (public_id,)
        )
        row = cursor.fetchone()
        return dict(row) if row else None
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def set_flagged(public_id: str, flagged: bool) -> dict:
    """Flags/unflags an entry for admin review (e.g. suspected referral abuse)."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE waitlist_entries SET flagged = ? WHERE public_id = ?",
            (flagged, public_id),
        )
        conn.commit()
        cursor.execute(
            "SELECT * FROM waitlist_entries WHERE public_id = ?", (public_id,)
        )
        row = cursor.fetchone()
        return dict(row) if row else None
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def serialize_admin_entry(row: dict) -> dict:
    """
    Admin-only serialization: includes everything the waitlist admin
    dashboard needs (flagged status, referred_by_code, raw referral_count
    from list_all_entries) that the public serialize_entry() deliberately
    omits.
    """
    data = serialize_entry(row, include_internal=True)
    data.update(
        {
            "flagged": bool(row["flagged"]),
            "referred_by_code": row["referred_by_code"],
            # If we joined with a count, include it, otherwise default to 0
            "referral_count": row.get("referral_count", 0),
        }
    )
    # The updated_at should have been handled by serialize_entry, but let's make sure
    if "updated_at" in data and hasattr(row.get("updated_at"), "isoformat"):
        data["updated_at"] = row["updated_at"].isoformat()
    if "created_at" in data and hasattr(row.get("created_at"), "isoformat"):
        data["created_at"] = row["created_at"].isoformat()
    return data


def serialize_entry(row: dict, include_internal: bool = False) -> dict:
    """
    Converts a raw database row (dict, straight from PyMySQL) into the
    clean JSON shape we want the API to return. This is where we decide
    what's safe to show the outside world — e.g. we never return the
    internal auto-increment `id`, only the `public_id` (UUID).
    """
    data = {
        "id": row["public_id"],
        "full_name": row["full_name"],
        "email": row["email"],
        "position": row["position"],
        "status": row["status"],
        "is_verified": bool(row["is_verified"]),
        "referral_code": row["referral_code"],   # NEW — theirs to share
        "points": row["points"],                 # NEW
        "created_at": row["created_at"].isoformat() if hasattr(row["created_at"], 'isoformat') else str(row["created_at"]).replace(' ', 'T'),
    }
    if include_internal:
        data.update(
            {
                "ip_address": row["ip_address"],
                "user_agent": row["user_agent"],
                "referral_source": row["referral_source"],
                "updated_at": row["updated_at"].isoformat() if hasattr(row["updated_at"], 'isoformat') else str(row["updated_at"]).replace(' ', 'T'),
            }
        )
    return data
