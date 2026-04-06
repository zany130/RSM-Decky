export function toErrorDetails(e: unknown): string {
  if (e instanceof Error) {
    const parts = [`${e.name || "Error"}: ${e.message || "(empty message)"}`];
    const maybeCause = (e as Error & { cause?: unknown }).cause;
    if (maybeCause !== undefined) {
      parts.push(`cause: ${String(maybeCause)}`);
    }
    return parts.join("\n");
  }
  try {
    const json = JSON.stringify(e);
    if (json && json !== "{}") {
      return `Non-Error rejection: ${json}`;
    }
  } catch {
    // ignore and fall through
  }
  return `Non-Error rejection: ${String(e)}`;
}
