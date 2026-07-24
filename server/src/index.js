import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import multer from "multer";
import sharp from "sharp";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile, unlink } from "node:fs/promises";

import { db } from "./db.js";
import { analyzeAndStylize } from "./gemini.js";
import {
  SESSION_COOKIE_NAME,
  cookieOptions,
  verifyGoogleIdToken,
  upsertUser,
  createSession,
  deleteSession,
} from "./auth.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { computeDailyStreak } from "./stats.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || path.join(__dirname, "..");
const uploadsDir = path.join(dataDir, "uploads");
await mkdir(uploadsDir, { recursive: true });

const PORT = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === "production";

const EXT_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (Object.prototype.hasOwnProperty.call(EXT_BY_MIME, file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("unsupported_file_type"));
    }
  },
});

const sightingCreateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip),
  message: { error: "rate_limited" },
});

const app = express();
app.set("trust proxy", 1);
app.use(
  cors({
    origin: (process.env.CORS_ORIGIN || "http://localhost:5173").split(","),
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());
app.use(
  "/uploads",
  express.static(uploadsDir, {
    immutable: true,
    maxAge: "1y",
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  }),
);

const THUMBNAIL_SIZE = 320;

function toSightingResponse(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    originalUrl: `/uploads/${row.original_filename}`,
    lofiUrl: `/uploads/${row.lofi_filename}`,
    thumbUrl: `/uploads/${row.thumb_filename || row.lofi_filename}`,
  };
}

app.post("/api/auth/google", async (req, res) => {
  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({ error: "missing_credential" });
  }

  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(500).json({ error: "server_missing_client_id" });
  }

  try {
    const payload = await verifyGoogleIdToken(credential);
    const user = upsertUser(payload);
    const token = createSession(user.id);

    res.cookie(SESSION_COOKIE_NAME, token, cookieOptions(IS_PROD));
    res.json(user);
  } catch (err) {
    console.error("Google sign-in failed:", err);
    res.status(401).json({ error: "invalid_credential" });
  }
});

app.post("/api/auth/logout", (req, res) => {
  const token = req.cookies[SESSION_COOKIE_NAME];
  if (token) {
    deleteSession(token);
  }
  res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
  res.status(204).end();
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json(req.user);
});

function paginateSightings(userId, { limit, cursor }) {
  const pageSize = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 60);

  let rows;
  if (cursor && String(cursor).includes("|")) {
    const [cursorCreatedAt, cursorId] = String(cursor).split("|");
    rows = db
      .prepare(
        `SELECT * FROM sightings
         WHERE user_id = ? AND (created_at < ? OR (created_at = ? AND id < ?))
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
      )
      .all(userId, cursorCreatedAt, cursorCreatedAt, cursorId, pageSize + 1);
  } else {
    rows = db
      .prepare(
        `SELECT * FROM sightings WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?`,
      )
      .all(userId, pageSize + 1);
  }

  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
  const last = pageRows[pageRows.length - 1];
  const nextCursor = hasMore && last ? `${last.created_at}|${last.id}` : null;
  const totalCount = db
    .prepare("SELECT COUNT(*) AS count FROM sightings WHERE user_id = ?")
    .get(userId).count;

  return { items: pageRows.map(toSightingResponse), nextCursor, totalCount };
}

app.use("/api/sightings", requireAuth);

app.get("/api/sightings", (req, res) => {
  const { limit, cursor } = req.query;

  if (!limit) {
    const rows = db
      .prepare("SELECT * FROM sightings WHERE user_id = ? ORDER BY created_at DESC, id DESC")
      .all(req.user.id);
    return res.json(rows.map(toSightingResponse));
  }

  res.json(paginateSightings(req.user.id, { limit, cursor }));
});

app.post("/api/sightings", sightingCreateLimiter, upload.single("photo"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "missing_photo" });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "server_missing_api_key" });
  }

  try {
    const result = await analyzeAndStylize(req.file.buffer, req.file.mimetype);

    if (!result.catFound) {
      return res.status(422).json({ error: "no_cat_found" });
    }

    const id = randomUUID();
    const originalExt = EXT_BY_MIME[req.file.mimetype] || "jpg";
    const lofiExt = EXT_BY_MIME[result.imageMimeType] || "png";
    const originalFilename = `${id}-original.${originalExt}`;
    const lofiFilename = `${id}-lofi.${lofiExt}`;
    const thumbFilename = `${id}-thumb.webp`;

    const thumbBuffer = await sharp(result.imageBuffer)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: "cover" })
      .webp({ quality: 78 })
      .toBuffer();

    await writeFile(
      path.join(uploadsDir, originalFilename),
      req.file.buffer,
    );
    await writeFile(
      path.join(uploadsDir, lofiFilename),
      result.imageBuffer,
    );
    await writeFile(
      path.join(uploadsDir, thumbFilename),
      thumbBuffer,
    );

    const createdAt = new Date().toISOString();
    db.prepare(
      `INSERT INTO sightings (id, created_at, original_filename, lofi_filename, thumb_filename, user_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(id, createdAt, originalFilename, lofiFilename, thumbFilename, req.user.id);

    res.status(201).json(
      toSightingResponse({
        id,
        created_at: createdAt,
        original_filename: originalFilename,
        lofi_filename: lofiFilename,
        thumb_filename: thumbFilename,
      }),
    );
  } catch (err) {
    console.error("Failed to process sighting:", err);
    res.status(502).json({ error: "generation_failed" });
  }
});

app.delete("/api/sightings/:id", async (req, res) => {
  const row = db
    .prepare("SELECT * FROM sightings WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.user.id);

  if (!row) {
    return res.status(404).json({ error: "not_found" });
  }

  db.prepare("DELETE FROM sightings WHERE id = ?").run(req.params.id);

  await Promise.all(
    [row.original_filename, row.lofi_filename, row.thumb_filename]
      .filter(Boolean)
      .map((filename) => unlink(path.join(uploadsDir, filename)).catch(() => {})),
  );

  res.status(204).end();
});

function toFriendUserResponse(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    pictureUrl: row.picture_url,
  };
}

function toFriendRequestResponse(row) {
  return {
    id: String(row.request_id),
    createdAt: row.request_created_at,
    user: {
      id: row.user_id,
      email: row.email,
      name: row.name,
      pictureUrl: row.picture_url,
    },
  };
}

app.use("/api/friends", requireAuth);

app.post("/api/friends/requests", (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "missing_email" });
  }

  const target = db.prepare("SELECT * FROM users WHERE email = ?").get(email.trim().toLowerCase());
  if (!target) {
    return res.status(404).json({ error: "user_not_found" });
  }
  if (target.id === req.user.id) {
    return res.status(400).json({ error: "cannot_friend_self" });
  }

  const existing = db
    .prepare(
      `SELECT * FROM friend_requests
       WHERE (requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?)`,
    )
    .get(req.user.id, target.id, target.id, req.user.id);

  if (existing) {
    if (existing.status === "accepted") {
      return res.status(409).json({ error: "already_friends" });
    }
    if (existing.requester_id === req.user.id) {
      return res.status(409).json({ error: "already_requested" });
    }

    db.prepare("UPDATE friend_requests SET status = 'accepted', responded_at = ? WHERE id = ?").run(
      new Date().toISOString(),
      existing.id,
    );
    return res.json(toFriendUserResponse(target));
  }

  db.prepare(
    `INSERT INTO friend_requests (requester_id, recipient_id, status, created_at)
     VALUES (?, ?, 'pending', ?)`,
  ).run(req.user.id, target.id, new Date().toISOString());

  res.status(201).json({ status: "pending" });
});

app.get("/api/friends/requests/incoming", (req, res) => {
  const rows = db
    .prepare(
      `SELECT friend_requests.id AS request_id, friend_requests.created_at AS request_created_at,
              users.id AS user_id, users.email, users.name, users.picture_url
       FROM friend_requests
       JOIN users ON users.id = friend_requests.requester_id
       WHERE friend_requests.recipient_id = ? AND friend_requests.status = 'pending'
       ORDER BY friend_requests.created_at DESC`,
    )
    .all(req.user.id);
  res.json(rows.map(toFriendRequestResponse));
});

app.get("/api/friends/requests/outgoing", (req, res) => {
  const rows = db
    .prepare(
      `SELECT friend_requests.id AS request_id, friend_requests.created_at AS request_created_at,
              users.id AS user_id, users.email, users.name, users.picture_url
       FROM friend_requests
       JOIN users ON users.id = friend_requests.recipient_id
       WHERE friend_requests.requester_id = ? AND friend_requests.status = 'pending'
       ORDER BY friend_requests.created_at DESC`,
    )
    .all(req.user.id);
  res.json(rows.map(toFriendRequestResponse));
});

app.post("/api/friends/requests/:id/accept", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(404).json({ error: "not_found" });
  }

  const row = db
    .prepare("SELECT * FROM friend_requests WHERE id = ? AND recipient_id = ? AND status = 'pending'")
    .get(id, req.user.id);
  if (!row) {
    return res.status(404).json({ error: "not_found" });
  }

  db.prepare("UPDATE friend_requests SET status = 'accepted', responded_at = ? WHERE id = ?").run(
    new Date().toISOString(),
    row.id,
  );
  res.status(204).end();
});

app.post("/api/friends/requests/:id/decline", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(404).json({ error: "not_found" });
  }

  const row = db
    .prepare("SELECT * FROM friend_requests WHERE id = ? AND recipient_id = ? AND status = 'pending'")
    .get(id, req.user.id);
  if (!row) {
    return res.status(404).json({ error: "not_found" });
  }

  db.prepare("DELETE FROM friend_requests WHERE id = ?").run(row.id);
  res.status(204).end();
});

app.delete("/api/friends/requests/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(404).json({ error: "not_found" });
  }

  const row = db
    .prepare("SELECT * FROM friend_requests WHERE id = ? AND requester_id = ? AND status = 'pending'")
    .get(id, req.user.id);
  if (!row) {
    return res.status(404).json({ error: "not_found" });
  }

  db.prepare("DELETE FROM friend_requests WHERE id = ?").run(row.id);
  res.status(204).end();
});

app.get("/api/friends", (req, res) => {
  const rows = db
    .prepare(
      `SELECT users.id, users.email, users.name, users.picture_url
       FROM friend_requests
       JOIN users ON users.id = CASE
         WHEN friend_requests.requester_id = ? THEN friend_requests.recipient_id
         ELSE friend_requests.requester_id
       END
       WHERE friend_requests.status = 'accepted'
         AND (friend_requests.requester_id = ? OR friend_requests.recipient_id = ?)`,
    )
    .all(req.user.id, req.user.id, req.user.id);
  res.json(rows.map(toFriendUserResponse));
});

app.get("/api/friends/streaks", (req, res) => {
  const rows = db
    .prepare(
      `SELECT sightings.user_id AS friend_id, sightings.created_at AS created_at
       FROM friend_requests
       JOIN sightings ON sightings.user_id = CASE
         WHEN friend_requests.requester_id = ? THEN friend_requests.recipient_id
         ELSE friend_requests.requester_id
       END
       WHERE friend_requests.status = 'accepted'
         AND (friend_requests.requester_id = ? OR friend_requests.recipient_id = ?)`,
    )
    .all(req.user.id, req.user.id, req.user.id);

  const createdAtByFriend = new Map();
  for (const row of rows) {
    if (!createdAtByFriend.has(row.friend_id)) {
      createdAtByFriend.set(row.friend_id, []);
    }
    createdAtByFriend.get(row.friend_id).push(row.created_at);
  }

  const streaks = {};
  for (const [friendId, createdAtList] of createdAtByFriend) {
    streaks[friendId] = computeDailyStreak(createdAtList);
  }

  res.json(streaks);
});

app.delete("/api/friends/:userId", (req, res) => {
  const row = db
    .prepare(
      `SELECT * FROM friend_requests
       WHERE status = 'accepted'
         AND ((requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?))`,
    )
    .get(req.user.id, req.params.userId, req.params.userId, req.user.id);
  if (!row) {
    return res.status(404).json({ error: "not_found" });
  }

  db.prepare("DELETE FROM friend_requests WHERE id = ?").run(row.id);
  res.status(204).end();
});

app.get("/api/friends/:userId/sightings", (req, res) => {
  const friendship = db
    .prepare(
      `SELECT * FROM friend_requests
       WHERE status = 'accepted'
         AND ((requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?))`,
    )
    .get(req.user.id, req.params.userId, req.params.userId, req.user.id);
  if (!friendship) {
    return res.status(404).json({ error: "not_friends" });
  }

  const { limit, cursor } = req.query;
  res.json(paginateSightings(req.params.userId, { limit: limit || "30", cursor }));
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message === "unsupported_file_type") {
    return res.status(400).json({ error: "invalid_photo" });
  }
  next(err);
});

if (IS_PROD) {
  const webDist = path.join(__dirname, "..", "..", "web", "dist");
  app.use(express.static(webDist));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
      return next();
    }
    res.sendFile(path.join(webDist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`cat-capture server listening on http://localhost:${PORT}`);
});
