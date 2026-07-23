import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || path.join(__dirname, "..");
const dbPath = path.join(dataDir, "data.db");

export const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS sightings (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    lofi_filename TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT,
    picture_url TEXT,
    created_at TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )
`);

const sightingsColumns = db.prepare("PRAGMA table_info(sightings)").all();
const hasUserId = sightingsColumns.some((col) => col.name === "user_id");
if (!hasUserId) {
  db.exec("ALTER TABLE sightings ADD COLUMN user_id TEXT");
}
