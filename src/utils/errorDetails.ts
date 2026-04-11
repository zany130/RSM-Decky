const FINAL_FALLBACK =
  "Plugin operation failed, but no detailed error message was returned.";

/** True when the message is empty or only generic / duplicate labels (no real detail). */
function isUselessErrorText(errorName: string, message: string): boolean {
  const msg = message.trim();
  if (!msg) {
    return true;
  }
  const nm = (errorName || "Error").trim() || "Error";
  if (msg.toLowerCase() === nm.toLowerCase()) {
    return true;
  }
  const gl = msg.toLowerCase();
  if (gl === "error" || gl === "python exception") {
    return true;
  }
  const paired = /^([^:]+):\s*(.+)$/s.exec(msg);
  if (paired) {
    const left = paired[1].trim().toLowerCase();
    const right = paired[2].trim().toLowerCase();
    if (left === right) {
      return true;
    }
  }
  return false;
}

function firstMeaningfulStackLine(stack: string | undefined): string | null {
  if (!stack) {
    return null;
  }
  for (const raw of stack.split("\n")) {
    const line = raw.trim();
    if (!line) {
      continue;
    }
    if (isUselessErrorText("Error", line)) {
      continue;
    }
    if (/^at\s/i.test(line)) {
      return line;
    }
    if (!isUselessErrorText("Python Exception", line)) {
      return line;
    }
  }
  return null;
}

type ErrorExtras = Error & {
  cause?: unknown;
  detail?: unknown;
  data?: unknown;
  response?: unknown;
  body?: unknown;
};

function appendExtraField(segments: string[], label: string, value: unknown): void {
  if (value == null) {
    return;
  }
  const s = typeof value === "string" ? value.trim() : JSON.stringify(value);
  if (!s || s === "{}") {
    return;
  }
  segments.push(`${label}: ${s}`);
}

export function toErrorDetails(e: unknown): string {
  if (e instanceof Error) {
    const name = e.name || "Error";
    const trimmed = (e.message || "").trim();
    const ext = e as ErrorExtras;

    const hasGoodPrimary = Boolean(trimmed) && !isUselessErrorText(name, trimmed);
    const segments: string[] = [];

    if (hasGoodPrimary) {
      segments.push(`${name}: ${trimmed}`);
    } else {
      appendExtraField(segments, "cause", ext.cause);
      if (segments.length === 0) {
        for (const key of ["detail", "data", "response", "body"] as const) {
          appendExtraField(segments, key, ext[key]);
          if (segments.length > 0) {
            break;
          }
        }
      }
      if (segments.length === 0) {
        const sl = firstMeaningfulStackLine(e.stack);
        if (sl) {
          segments.push(sl);
        }
      }
      if (segments.length === 0) {
        segments.push(FINAL_FALLBACK);
      }
    }

    if (hasGoodPrimary && ext.cause !== undefined) {
      appendExtraField(segments, "cause", ext.cause);
    }

    return segments.join("\n");
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
