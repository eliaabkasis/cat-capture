import { OAuth2Client } from "google-auth-library";
import { randomBytes } from "node:crypto";
import { db } from "./db.js";

export const SESSION_COOKIE_NAME = "cc_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

const oauthClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export function cookieOptions(isProd) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: SESSION_DURATION_MS,
  };
}

export async function verifyGoogleIdToken(idToken) {
  const ticket = await oauthClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name ?? null,
    picture: payload.picture ?? null,
  };
}

export function upsertUser({ sub, email, name, picture }) {
  db.prepare(
    `INSERT INTO users (id, email, name, picture_url, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       email = excluded.email,
       name = excluded.name,
       picture_url = excluded.picture_url`,
  ).run(sub, email, name, picture, new Date().toISOString());

  return toUserResponse(
    db.prepare("SELECT * FROM users WHERE id = ?").get(sub),
  );
}

export function createSession(userId) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

  db.prepare(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)",
  ).run(token, userId, expiresAt);

  return token;
}

export function deleteSession(token) {
  db.prepare("DELETE FROM sessions WHERE id = ?").run(token);
}

export function getSessionUser(token) {
  if (!token) return null;

  const row = db
    .prepare(
      `SELECT users.* FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.id = ? AND sessions.expires_at > ?`,
    )
    .get(token, new Date().toISOString());

  return row ? toUserResponse(row) : null;
}

function toUserResponse(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    pictureUrl: row.picture_url,
  };
}
