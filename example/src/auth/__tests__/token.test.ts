import { generateToken, verifyToken } from "../token";

describe("token utilities", () => {
  test("generateToken returns a base64 string", () => {
    const token = generateToken("seed");
    expect(token.length).toBeGreaterThan(0);
  });

  test("verifyToken accepts a valid token", () => {
    const token = generateToken("test");
    expect(verifyToken(token)).toBe(true);
  });

  test("verifyToken rejects garbage", () => {
    expect(verifyToken("!!!")).toBe(false);
  });
});
