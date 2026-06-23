import type { NextFunction, Request, Response } from "express";
import { adminAuth } from "./firebaseAdmin.js";

export type AuthedRequest = Request & { uid?: string };

export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (header == null || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing Authorization bearer token." });
    return;
  }

  const idToken = header.slice("Bearer ".length);
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    req.uid = decoded.uid;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token." });
  }
}
