# Zuno Waitlist API

Backend + API for the Zuno waitlist landing page (full name + email capture).
Built with Flask + raw MySQL (PyMySQL) — no ORM.

## Folder Structure

```
zuno_waitlist_backend/
├── app/
│   ├── __init__.py            # Application factory
│   ├── config.py              # Env-based configuration
│   ├── extensions.py          # cors, limiter instances
│   ├── db.py                  # Opens raw MySQL connections
│   ├── models/
│   │   └── waitlist.py        # Raw SQL functions (insert, find, count)
│   ├── schemas/
│   │   └── waitlist_schema.py # Marshmallow input validation
│   ├── routes/
│   │   └── waitlist_routes.py # /api/v1/waitlist/* endpoints
│   └── utils/
│       ├── responses.py       # Standard JSON success/error envelopes
│       └── error_handlers.py  # Centralized error handling
├── schema.sql                 # Run once to create the waitlist_entries table
├── run.py                     # Local dev entrypoint
├── requirements.txt
├── .env.example
└── .gitignore
```

## 1. Setup (Windows / Git Bash)

```bash
cd /e/desktop/zuno_waitlist_backend
python -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt
```

## 2. Configure environment variables

```bash
cp .env.example .env
```

Generate a real secret key and paste it into `.env` as `SECRET_KEY`:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Update `DB_USER` / `DB_PASSWORD` to match your XAMPP MySQL setup.

## 3. Create the database table

```bash
mysql -u root -p zuno_waitlist < schema.sql
```

Or, in phpMyAdmin: select the `zuno_waitlist` database → "SQL" tab →
paste the contents of `schema.sql` → Go.

This creates one table, `waitlist_entries` — see the comments inside
`schema.sql` for what each column is for.

## 4. Run the API

```bash
python run.py
```

The API is now live at `http://localhost:5000`.

## 5. Test it

```bash
curl -X POST http://localhost:5000/api/v1/waitlist/join \
  -H "Content-Type: application/json" \
  -d '{"full_name": "Jeremy Otieno", "email": "jeremy@example.com"}'
```

```bash
curl http://localhost:5000/api/v1/waitlist/count
```

## API Reference

### `POST /api/v1/waitlist/join`
Rate limited: 5 requests/minute per IP.

Request:
```json
{ "full_name": "Jeremy Otieno", "email": "jeremy@example.com" }
```

Success (201):
```json
{
  "success": true,
  "message": "You've successfully joined the Zuno waitlist!",
  "data": {
    "id": "3f2b6c9e-...",
    "full_name": "Jeremy Otieno",
    "email": "jeremy@example.com",
    "position": 1,
    "status": "pending",
    "is_verified": false,
    "created_at": "2026-07-04T12:00:00"
  }
}
```

Errors:
| Status | error_code | Cause |
|---|---|---|
| 422 | VALIDATION_ERROR | Bad name/email format |
| 409 | EMAIL_ALREADY_EXISTS | Duplicate signup |
| 429 | RATE_LIMIT_EXCEEDED | Too many requests from this IP |
| 500 | DATABASE_ERROR | Unexpected server-side failure |

### `GET /api/v1/waitlist/count`
Returns `{ "total_signups": 1204 }` — safe to show publicly on the landing page.

### `GET /api/v1/waitlist/health`
Returns 200 if the API is up. Point uptime monitoring here.

## Why raw SQL instead of an ORM

This project intentionally uses plain SQL via PyMySQL instead of an ORM
like SQLAlchemy, to match the style of your main Zuno backend and avoid
introducing a second data-access pattern to learn. All SQL lives in
`app/models/waitlist.py`, and every query uses `%s` placeholders — never
string formatting — which is what protects against SQL injection.

## A note on connections and scaling

`app/db.py` opens one new MySQL connection per request and closes it
immediately after. This is simple and correct, and completely fine for
an MVP/waitlist workload. If Zuno's traffic grows large enough that
opening a fresh connection per request becomes a bottleneck, the
standard next step is connection pooling (e.g. the `DBUtils` package's
`PooledDB`) — worth learning once you're comfortable with the basics
above, not before.

## Deploying to Production

- Never run `python run.py` in production. Use gunicorn:
  ```bash
  gunicorn -w 4 -b 0.0.0.0:8000 run:app
  ```
- Set `FLASK_ENV=production` in your production `.env`.
- Put the app behind Nginx or a platform (Railway/Render) that terminates
  HTTPS.
- Move `RATELIMIT_STORAGE_URI` to Redis once you run more than one
  server instance.
