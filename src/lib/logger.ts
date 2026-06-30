// Dev logging — ported from web src/lib/logger.js.
// Development-mode checks use the React Native __DEV__ global.
export const log = (...args: unknown[]): void => {
  if (__DEV__) console.log(...args);
};

export const logError = (...args: unknown[]): void => {
  if (__DEV__) console.error(...args);
};

export const warn = (...args: unknown[]): void => {
  if (__DEV__) console.warn(...args);
};
