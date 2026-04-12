import { debugLog } from "./debugLog";

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
  const lines = stack
    .split("\n")
    .map((raw) => raw.trim())
    .filter(Boolean);

  const isTracebackBoilerplate = (line: string): boolean =>
    /^python traceback \(most recent call last\):$/i.test(line) ||
    /^traceback \(most recent call last\):$/i.test(line) ||
    /^file ".*", line \d+, in .+$/i.test(line);

  // Prefer the final meaningful Python exception line in traceback text.
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (isTracebackBoilerplate(line)) {
      continue;
    }
    const pyException = /^([A-Za-z_][\w.]*)\s*:\s*(.+)$/.exec(line);
    if (!pyException) {
      continue;
    }
    const exName = pyException[1].trim();
    const exMsg = pyException[2].trim();
    if (isUselessErrorText(exName, exMsg)) {
      continue;
    }
    return `${exName}: ${exMsg}`;
  }

  // Only if no useful Python exception line exists, fall back to JS frames.
  for (const line of lines) {
    if (/^at\s/i.test(line)) {
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
  debugLog("toErrorDetails raw input", e);
  if (e instanceof Error) {
    const name = e.name || "Error";
    const trimmed = (e.message || "").trim();
    const ext = e as ErrorExtras;

    const hasGoodPrimary = Boolean(trimmed) && !isUselessErrorText(name, trimmed);
    const segments: string[] = [];
    let fallbackBranch = "primary_message";

    if (hasGoodPrimary) {
      segments.push(`${name}: ${trimmed}`);
    } else {
      appendExtraField(segments, "cause", ext.cause);
      if (segments.length > 0) {
        fallbackBranch = "fallback_cause";
      }
      if (segments.length === 0) {
        for (const key of ["detail", "data", "response", "body"] as const) {
          appendExtraField(segments, key, ext[key]);
          if (segments.length > 0) {
            fallbackBranch = `fallback_${key}`;
            break;
          }
        }
      }
      if (segments.length === 0) {
        const sl = firstMeaningfulStackLine(e.stack);
        if (sl) {
          segments.push(sl);
          fallbackBranch = "fallback_stack_line";
        }
      }
      if (segments.length === 0) {
        segments.push(FINAL_FALLBACK);
        fallbackBranch = "fallback_final_default";
      }
    }

    if (hasGoodPrimary && ext.cause !== undefined) {
      appendExtraField(segments, "cause", ext.cause);
    }

    const formatted = segments.join("\n");
    debugLog("toErrorDetails fallback branch", fallbackBranch);
    debugLog("toErrorDetails final formatted output", formatted);
    return formatted;
  }
  try {
    const json = JSON.stringify(e);
    if (json && json !== "{}") {
      const formatted = `Non-Error rejection: ${json}`;
      debugLog("toErrorDetails fallback branch", "non_error_json");
      debugLog("toErrorDetails final formatted output", formatted);
      return formatted;
    }
  } catch {
    // ignore and fall through
  }
  const formatted = `Non-Error rejection: ${String(e)}`;
  debugLog("toErrorDetails fallback branch", "non_error_string");
  debugLog("toErrorDetails final formatted output", formatted);
  return formatted;
}
