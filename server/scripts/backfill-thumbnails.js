import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

import { db } from "../src/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || path.join(__dirname, "..");
const uploadsDir = path.join(dataDir, "uploads");

const THUMBNAIL_SIZE = 320;

const rows = db
  .prepare("SELECT id, lofi_filename FROM sightings WHERE thumb_filename IS NULL")
  .all();

console.log(`Backfilling thumbnails for ${rows.length} sighting(s)...`);

for (const row of rows) {
  const thumbFilename = `${row.id}-thumb.webp`;
  try {
    const lofiBuffer = await readFile(path.join(uploadsDir, row.lofi_filename));
    const thumbBuffer = await sharp(lofiBuffer)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: "cover" })
      .webp({ quality: 78 })
      .toBuffer();

    await writeFile(path.join(uploadsDir, thumbFilename), thumbBuffer);
    db.prepare("UPDATE sightings SET thumb_filename = ? WHERE id = ?").run(thumbFilename, row.id);
    console.log(`  ✓ ${row.id}`);
  } catch (err) {
    console.error(`  ✗ ${row.id}: ${err.message}`);
  }
}

console.log("Done.");
