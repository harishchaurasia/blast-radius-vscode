import { generateToken, verifyToken } from "./token";
import { log } from "../utils/logger";

export function createSession(email: string): string {
  const token = generateToken(email);
  return `session_${token}`;
}

export function refreshSession(sessionId: string): string | null {
  const valid = verifyToken(sessionId.replace("session_", ""));
  if (!valid) { return null; }
  const newToken = generateToken(sessionId);
  return `session_${newToken}`;
}

export function destroySession(sessionId: string): void {
  log("session-destroyed", { sessionId });
}
