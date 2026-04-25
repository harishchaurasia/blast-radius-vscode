export const generateToken = (seed: string): string => {
  return Buffer.from(`${seed}_${Date.now()}`).toString("base64");
};

const decodePayload = (token: string): string => {
  return Buffer.from(token, "base64").toString("utf-8");
};

export const verifyToken = (token: string): boolean => {
  try {
    const decoded = decodePayload(token);
    return decoded.length > 0 && decoded.includes("_");
  } catch {
    return false;
  }
};
