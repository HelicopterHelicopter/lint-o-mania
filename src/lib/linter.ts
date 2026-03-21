/**
 * JSON Linter / Validator
 *
 * Strict JSON.parse-based validation.
 * Extracts line/column info from the error message (best-effort, cross-browser).
 */

export interface LintResult {
  valid: boolean;
  error?: {
    message: string;
    line?: number;
    col?: number;
  };
}

export function lintJSON(input: string): LintResult {
  const trimmed = input.trim();
  if (!trimmed) return { valid: true };

  try {
    JSON.parse(trimmed);
    return { valid: true };
  } catch (e: unknown) {
    if (!(e instanceof SyntaxError)) {
      return { valid: false, error: { message: String(e) } };
    }

    const raw = e.message;

    // Try to extract position info from various browser error formats:
    // Chrome:  "Unexpected token o in JSON at position 5"
    // Firefox: "JSON.parse: unexpected character at line 2 column 3 of the JSON data"
    // Node:    "Expected ',' or '}' after property value in JSON at position 42"
    // Newer Chrome/Node: "Expected ',' or '}' ... (line 3, column 5)"

    let line: number | undefined;
    let col: number | undefined;
    let cleanMessage = raw;

    // Pattern: "at line X column Y"
    const lineColMatch = raw.match(/line\s+(\d+)\s+column\s+(\d+)/i);
    if (lineColMatch) {
      line = parseInt(lineColMatch[1], 10);
      col = parseInt(lineColMatch[2], 10);
    }

    // Pattern: "(line X, column Y)"
    const parenMatch = raw.match(/\(line\s+(\d+),\s*column\s+(\d+)\)/i);
    if (parenMatch) {
      line = parseInt(parenMatch[1], 10);
      col = parseInt(parenMatch[2], 10);
    }

    // Pattern: "at position N" — compute line/col from position
    if (line === undefined) {
      const posMatch = raw.match(/at position\s+(\d+)/i);
      if (posMatch) {
        const pos = parseInt(posMatch[1], 10);
        const before = trimmed.slice(0, pos);
        const lines = before.split('\n');
        line = lines.length;
        col = lines[lines.length - 1].length + 1;
      }
    }

    // Strip browser-specific suffixes for a cleaner message
    cleanMessage = raw
      .replace(/\s*at position\s+\d+/i, '')
      .replace(/\s*\(line\s+\d+,\s*column\s+\d+\)/i, '')
      .trim();

    return {
      valid: false,
      error: { message: cleanMessage, line, col },
    };
  }
}

export function beautifyJSON(input: string, indent: number = 4): { output: string; error?: string } {
  const trimmed = input.trim();
  if (!trimmed) return { output: '' };
  try {
    const parsed = JSON.parse(trimmed);
    return { output: JSON.stringify(parsed, null, indent) };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg, output: input };
  }
}

export function minifyJSON(input: string): { output: string; error?: string } {
  const trimmed = input.trim();
  if (!trimmed) return { output: '' };
  try {
    const parsed = JSON.parse(trimmed);
    return { output: JSON.stringify(parsed) };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg, output: input };
  }
}
