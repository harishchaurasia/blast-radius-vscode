import { createSession } from "./session";
import { log } from "../utils/logger";
import { isEmail } from "../utils/validate";

function validateCredentials(email: string, password: string): boolean {
  if (!isEmail(email) || password.length < 8) {
    return false;
  }
  return true;
}

export function handleLogin(email: string, password: string): { success: boolean; sessionId?: string } {
  log("login-attempt", { email });
  const valid = validateCredentials(email, password);
  if (!valid) {
    log("login-failed", { email });
    return { success: false };
  }
  const sessionId = createSession(email);
  log("login-success", { email, sessionId });
  return { success: true, sessionId };
}
