CREATE TABLE IF NOT EXISTS waitlist_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    public_id VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    position INT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    is_verified BOOLEAN NOT NULL DEFAULT 0,
    verification_token VARCHAR(255) NULL UNIQUE,
    referral_source VARCHAR(255) NULL,
    referral_code VARCHAR(50) NOT NULL UNIQUE,
    referred_by_code VARCHAR(50) NULL,
    points INT NOT NULL DEFAULT 0,
    flagged BOOLEAN NOT NULL DEFAULT 0,
    ip_address VARCHAR(255) NULL,
    user_agent VARCHAR(255) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_email ON waitlist_entries(email);
CREATE INDEX idx_public_id ON waitlist_entries(public_id);
CREATE INDEX idx_status ON waitlist_entries(status);
CREATE INDEX idx_referral_code ON waitlist_entries(referral_code);
CREATE INDEX idx_referred_by_code ON waitlist_entries(referred_by_code);
