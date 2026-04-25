import { handleLogin } from "../login";

describe("handleLogin", () => {
  test("returns success with valid credentials", () => {
    const result = handleLogin("user@example.com", "password123");
    expect(result.success).toBe(true);
    expect(result.sessionId).toBeDefined();
  });

  test("returns failure with invalid email", () => {
    const result = handleLogin("not-an-email", "password123");
    expect(result.success).toBe(false);
  });

  test("returns failure with short password", () => {
    const result = handleLogin("user@example.com", "short");
    expect(result.success).toBe(false);
  });
});
