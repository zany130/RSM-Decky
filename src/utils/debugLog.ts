// TEMP troubleshooting gate: keep false for normal usage/release builds.
export const RSM_DEBUG_CEF = false;

export function debugLog(...args: unknown[]): void {
  if (!RSM_DEBUG_CEF) {
    return;
  }
  console.error("[RSM DEBUG]", ...args);
}
