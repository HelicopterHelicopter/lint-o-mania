/**
 * JS Object → JSON Converter
 *
 * Handles:
 *   - Unquoted keys → "quoted"
 *   - Single-quoted strings → double-quoted
 *   - Trailing commas → removed
 *   - // and /* comments → stripped
 *   - undefined / NaN / Infinity → null
 *   - Outputs pretty-printed valid JSON
 */

export interface ConvertResult {
  output: string;
  error?: string;
}

function stripComments(input: string): string {
  let result = '';
  let i = 0;
  while (i < input.length) {
    // Line comment
    if (input[i] === '/' && input[i + 1] === '/') {
      while (i < input.length && input[i] !== '\n') i++;
      continue;
    }
    // Block comment
    if (input[i] === '/' && input[i + 1] === '*') {
      i += 2;
      while (i < input.length && !(input[i] === '*' && input[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    // String: skip contents to avoid mangling strings that look like comments
    if (input[i] === '"' || input[i] === "'" || input[i] === '`') {
      const quote = input[i];
      result += input[i++];
      while (i < input.length) {
        if (input[i] === '\\') { result += input[i] + input[i + 1]; i += 2; continue; }
        if (input[i] === quote) { result += input[i++]; break; }
        result += input[i++];
      }
      continue;
    }
    result += input[i++];
  }
  return result;
}

function convertQuotes(input: string): string {
  // Convert single-quoted strings to double-quoted, and escape inner double quotes
  let result = '';
  let i = 0;
  while (i < input.length) {
    if (input[i] === '"') {
      // Already double-quoted: pass through verbatim
      result += input[i++];
      while (i < input.length) {
        if (input[i] === '\\') { result += input[i] + input[i + 1]; i += 2; continue; }
        if (input[i] === '"') { result += input[i++]; break; }
        result += input[i++];
      }
      continue;
    }
    if (input[i] === "'" || input[i] === '`') {
      // Convert to double-quoted
      result += '"';
      i++;
      while (i < input.length) {
        if (input[i] === '\\') {
          const next = input[i + 1];
          // Convert \' → ' (unescape) and re-escape " if needed
          if (next === "'") { result += "'"; i += 2; continue; }
          result += input[i] + next; i += 2; continue;
        }
        if (input[i] === "'" || input[i] === '`') { result += '"'; i++; break; }
        // Escape any unescaped double quotes inside
        if (input[i] === '"') { result += '\\"'; i++; continue; }
        result += input[i++];
      }
      continue;
    }
    result += input[i++];
  }
  return result;
}

function quoteKeys(input: string): string {
  // Match unquoted object keys: word characters before a colon
  // Be careful not to match inside strings
  let result = '';
  let i = 0;
  while (i < input.length) {
    // Skip strings
    if (input[i] === '"') {
      result += input[i++];
      while (i < input.length) {
        if (input[i] === '\\') { result += input[i] + input[i + 1]; i += 2; continue; }
        if (input[i] === '"') { result += input[i++]; break; }
        result += input[i++];
      }
      continue;
    }
    // Check for unquoted key: identifier chars followed (with optional whitespace) by colon
    if (/[a-zA-Z_$]/.test(input[i])) {
      let j = i;
      while (j < input.length && /[a-zA-Z0-9_$]/.test(input[j])) j++;
      // Look ahead for colon (skip whitespace)
      let k = j;
      while (k < input.length && (input[k] === ' ' || input[k] === '\t' || input[k] === '\r' || input[k] === '\n')) k++;
      if (input[k] === ':') {
        // It's an unquoted key — quote it
        result += '"' + input.slice(i, j) + '"';
        i = j;
        continue;
      }
    }
    result += input[i++];
  }
  return result;
}

function removeTrailingCommas(input: string): string {
  // Remove commas that appear before } or ] (with optional whitespace between)
  let result = '';
  let i = 0;
  while (i < input.length) {
    // Skip strings
    if (input[i] === '"') {
      result += input[i++];
      while (i < input.length) {
        if (input[i] === '\\') { result += input[i] + input[i + 1]; i += 2; continue; }
        if (input[i] === '"') { result += input[i++]; break; }
        result += input[i++];
      }
      continue;
    }
    if (input[i] === ',') {
      // Look ahead: skip whitespace, check for } or ]
      let j = i + 1;
      while (j < input.length && /\s/.test(input[j])) j++;
      if (input[j] === '}' || input[j] === ']') {
        // Skip the comma, keep whitespace
        i++;
        continue;
      }
    }
    result += input[i++];
  }
  return result;
}

function replaceSpecialValues(input: string): string {
  // Replace standalone undefined, NaN, Infinity with null
  // Must not be inside strings
  let result = '';
  let i = 0;
  while (i < input.length) {
    if (input[i] === '"') {
      result += input[i++];
      while (i < input.length) {
        if (input[i] === '\\') { result += input[i] + input[i + 1]; i += 2; continue; }
        if (input[i] === '"') { result += input[i++]; break; }
        result += input[i++];
      }
      continue;
    }
    const remaining = input.slice(i);
    const special = ['undefined', 'NaN', 'Infinity', '-Infinity'];
    let matched = false;
    for (const kw of special) {
      if (remaining.startsWith(kw)) {
        const after = input[i + kw.length];
        const before = i > 0 ? input[i - 1] : ' ';
        // Make sure it's a standalone token
        if (!/[a-zA-Z0-9_$]/.test(after || '') && !/[a-zA-Z0-9_$]/.test(before)) {
          result += 'null';
          i += kw.length;
          matched = true;
          break;
        }
      }
    }
    if (!matched) result += input[i++];
  }
  return result;
}

export function convertJSToJSON(input: string, indent: number = 4): ConvertResult {
  const trimmed = input.trim();
  if (!trimmed) return { output: '' };

  try {
    let processed = trimmed;
    processed = stripComments(processed);
    processed = convertQuotes(processed);
    processed = quoteKeys(processed);
    processed = replaceSpecialValues(processed);
    processed = removeTrailingCommas(processed);

    // Now try to parse as JSON to validate and re-pretty-print
    const parsed = JSON.parse(processed);
    return { output: JSON.stringify(parsed, null, indent) };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: `Conversion failed: ${msg}`, output: input };
  }
}
