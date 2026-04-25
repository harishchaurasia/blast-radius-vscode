import { withAuth, rateLimiter, buildHeaders } from "../middleware";

describe("API middleware", () => {
  test("withAuth returns a boolean", () => {
    expect(typeof withAuth()).toBe("boolean");
  });

  test("rateLimiter allows requests", () => {
    expect(rateLimiter()).toBe(true);
  });

  test("buildHeaders includes Authorization", () => {
    const headers = buildHeaders();
    expect(headers.Authorization).toBeDefined();
  });
});
