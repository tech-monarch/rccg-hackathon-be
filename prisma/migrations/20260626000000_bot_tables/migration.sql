-- Migration: bot_tables
-- Adds the artisans local search index and bot_sessions persistence tables
-- which exist in prisma/schema.prisma but were never included in any migration.
--
-- These tables are managed by the bot's postgres.js ensureSchema() as well,
-- but having them in a Prisma migration means `prisma migrate deploy` creates
-- them correctly on a fresh database without requiring the bot to run first.

-- ── Artisan search index ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "artisans" (
    "id"                    SERIAL          PRIMARY KEY,
    "name"                  VARCHAR(255)    NOT NULL,
    "phone"                 VARCHAR(50)     NOT NULL,
    "category"              VARCHAR(100)    NOT NULL,
    "description"           TEXT,
    "rating"                DECIMAL(2,1)    DEFAULT 0,
    "completed_jobs"        INTEGER         DEFAULT 0,
    "location"              VARCHAR(255)    NOT NULL,
    "latitude"              DOUBLE PRECISION,
    "longitude"             DOUBLE PRECISION,
    "available"             BOOLEAN         DEFAULT true,
    "average_response_time" INTEGER,
    "price_range"           VARCHAR(100),
    "created_at"            TIMESTAMP(6)    DEFAULT NOW(),
    "updated_at"            TIMESTAMP(6)    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_artisans_available" ON "artisans" ("available");
CREATE INDEX IF NOT EXISTS "idx_artisans_category"  ON "artisans" ("category");
CREATE INDEX IF NOT EXISTS "idx_artisans_location"  ON "artisans" ("location");

-- ── Bot session persistence ───────────────────────────────────────────────────
-- Stores per-conversation message history and registration preferences.
-- The bot's postgres.js ensureSchema() also creates this, but having it here
-- ensures it exists even before the bot's first run.
CREATE TABLE IF NOT EXISTS "bot_sessions" (
    "phone_number" VARCHAR(30)  PRIMARY KEY,
    "messages"     JSONB        NOT NULL DEFAULT '[]',
    "preferences"  JSONB        NOT NULL DEFAULT '{}',
    "created_at"   TIMESTAMP    NOT NULL DEFAULT NOW(),
    "updated_at"   TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_bot_sessions_updated" ON "bot_sessions" ("updated_at");
