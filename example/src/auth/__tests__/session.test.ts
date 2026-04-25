import { createSession, refreshSession, destroySession } from "../session";

describe("session management", () => {
  test("createSession returns a session ID", () => {
    const id = createSession("user@example.com");
    expect(id).toMatch(/^session_/);
  });

  test("refreshSession returns new session for valid token", () => {
    const id = createSession("user@example.com");
    const refreshed = refreshSession(id);
    expect(refreshed).not.toBeNull();
  });

  test("destroySession does not throw", () => {
    expect(() => destroySession("session_abc")).not.toThrow();
  });
});
