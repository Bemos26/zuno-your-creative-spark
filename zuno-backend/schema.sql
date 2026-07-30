CREATE TABLE IF NOT EXISTS waitlist_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    position INTEGER NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'invited', 'registered', 'unsubscribed')),
    is_verified INTEGER NOT NULL DEFAULT 0,
    verification_token TEXT NULL UNIQUE,
    referral_source TEXT NULL,
    referral_code TEXT NOT NULL UNIQUE,
    referred_by_code TEXT NULL,
    points INTEGER NOT NULL DEFAULT 0,
    flagged INTEGER NOT NULL DEFAULT 0,
    ip_address TEXT NULL,
    user_agent TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email ON waitlist_entries(email);
CREATE INDEX IF NOT EXISTS idx_public_id ON waitlist_entries(public_id);
CREATE INDEX IF NOT EXISTS idx_status ON waitlist_entries(status);
CREATE INDEX IF NOT EXISTS idx_referral_code ON waitlist_entries(referral_code);
CREATE INDEX IF NOT EXISTS idx_referred_by_code ON waitlist_entries(referred_by_code);
