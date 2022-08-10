export const violation = (...args: any[]) => {
  console.warn('[Sandbox Violation]', ...args);
};
