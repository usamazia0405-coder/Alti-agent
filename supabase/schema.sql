-- Alti Finans – Supabase tabellstruktur
-- Kjør dette i Supabase SQL Editor for å sette opp databasen

-- Brukere
CREATE TABLE IF NOT EXISTS af_users (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  password    TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'advisor' CHECK (role IN ('advisor', 'admin')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Banker
CREATE TABLE IF NOT EXISTS af_banks (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  guidelines  TEXT NOT NULL,
  created_by  TEXT REFERENCES af_users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Kunnskapsbase
CREATE TABLE IF NOT EXISTS af_knowledge (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_by  TEXT REFERENCES af_users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Saker
CREATE TABLE IF NOT EXISTS af_cases (
  id            TEXT PRIMARY KEY,
  advisor_id    TEXT REFERENCES af_users(id) ON DELETE SET NULL,
  advisor_name  TEXT,
  summary       TEXT,
  solution      TEXT,
  bank          TEXT,
  outcome       TEXT,
  crm_note      TEXT,
  loan_app      TEXT,
  is_example    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SIKKERHET: Slå på Row Level Security og blokker all direktetilgang.
-- All tilgang går via server-side API-ruter med service role key.
ALTER TABLE af_users    ENABLE ROW LEVEL SECURITY;
ALTER TABLE af_banks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE af_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE af_cases    ENABLE ROW LEVEL SECURITY;

-- Ingen tilgang via anon-nøkkel (service role bypass RLS uansett)
CREATE POLICY "deny_all_users"    ON af_users    USING (false);
CREATE POLICY "deny_all_banks"    ON af_banks    USING (false);
CREATE POLICY "deny_all_knowledge" ON af_knowledge USING (false);
CREATE POLICY "deny_all_cases"    ON af_cases    USING (false);
