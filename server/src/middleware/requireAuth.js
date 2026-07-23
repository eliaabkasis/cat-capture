import { SESSION_COOKIE_NAME, getSessionUser } from "../auth.js";

export function requireAuth(req, res, next) {
  const user = getSessionUser(req.cookies[SESSION_COOKIE_NAME]);

  if (!user) {
    return res.status(401).json({ error: "unauthorized" });
  }

  req.user = user;
  next();
}
