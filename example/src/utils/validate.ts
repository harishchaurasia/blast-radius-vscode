export const isEmail = (value: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

export const sanitizeInput = (value: string): string => {
  return value.replace(/[<>&"']/g, "").trim();
};
