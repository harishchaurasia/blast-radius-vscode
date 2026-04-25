export const log = (event: string, data?: Record<string, unknown>): void => {
  console.log(`[${new Date().toISOString()}] ${event}`, data ?? "");
};

export const logError = (event: string, error: unknown): void => {
  console.error(`[${new Date().toISOString()}] ERROR ${event}`, error);
};
