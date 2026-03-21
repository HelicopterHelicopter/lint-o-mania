/**
 * JS Object Beautifier
 *
 * Accepts JS objects with:
 *   - Unquoted keys
 *   - Single-quoted strings
 *   - Trailing commas
 *   - // line comments
 *   - /* block comments
 *
 * Strategy:
 *   1. Tokenize the input, extracting tokens (punctuation, strings, comments, identifiers, numbers, etc.)
 *   2. Reformat the token stream with proper indentation
 *   3. Comments are kept in-place relative to the surrounding tokens
 */

export interface BeautifyResult {
  output: string;
  error?: string;
}

type TokenType =
  | 'lbrace'
  | 'rbrace'
  | 'lbracket'
  | 'rbracket'
  | 'colon'
  | 'comma'
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'undefined'
  | 'identifier'
  | 'line_comment'
  | 'block_comment'
  | 'whitespace'
  | 'newline'
  | 'unknown';

interface Token {
  type: TokenType;
  value: string;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    // Line comment
    if (input[i] === '/' && input[i + 1] === '/') {
      let j = i + 2;
      while (j < input.length && input[j] !== '\n') j++;
      tokens.push({ type: 'line_comment', value: input.slice(i, j) });
      i = j;
      continue;
    }

    // Block comment
    if (input[i] === '/' && input[i + 1] === '*') {
      let j = i + 2;
      while (j < input.length && !(input[j] === '*' && input[j + 1] === '/')) j++;
      j += 2; // consume */
      tokens.push({ type: 'block_comment', value: input.slice(i, j) });
      i = j;
      continue;
    }

    // Newline
    if (input[i] === '\n') {
      tokens.push({ type: 'newline', value: '\n' });
      i++;
      continue;
    }

    // Whitespace (non-newline)
    if (input[i] === ' ' || input[i] === '\t' || input[i] === '\r') {
      let j = i + 1;
      while (j < input.length && (input[j] === ' ' || input[j] === '\t' || input[j] === '\r')) j++;
      tokens.push({ type: 'whitespace', value: input.slice(i, j) });
      i = j;
      continue;
    }

    // String: double-quoted
    if (input[i] === '"') {
      let j = i + 1;
      while (j < input.length) {
        if (input[j] === '\\') { j += 2; continue; }
        if (input[j] === '"') { j++; break; }
        j++;
      }
      tokens.push({ type: 'string', value: input.slice(i, j) });
      i = j;
      continue;
    }

    // String: single-quoted
    if (input[i] === "'") {
      let j = i + 1;
      while (j < input.length) {
        if (input[j] === '\\') { j += 2; continue; }
        if (input[j] === "'") { j++; break; }
        j++;
      }
      // Store as single-quoted but mark as string
      tokens.push({ type: 'string', value: input.slice(i, j) });
      i = j;
      continue;
    }

    // Template literal (backtick) — treat as string
    if (input[i] === '`') {
      let j = i + 1;
      while (j < input.length) {
        if (input[j] === '\\') { j += 2; continue; }
        if (input[j] === '`') { j++; break; }
        j++;
      }
      tokens.push({ type: 'string', value: input.slice(i, j) });
      i = j;
      continue;
    }

    // Punctuation
    if (input[i] === '{') { tokens.push({ type: 'lbrace', value: '{' }); i++; continue; }
    if (input[i] === '}') { tokens.push({ type: 'rbrace', value: '}' }); i++; continue; }
    if (input[i] === '[') { tokens.push({ type: 'lbracket', value: '[' }); i++; continue; }
    if (input[i] === ']') { tokens.push({ type: 'rbracket', value: ']' }); i++; continue; }
    if (input[i] === ':') { tokens.push({ type: 'colon', value: ':' }); i++; continue; }
    if (input[i] === ',') { tokens.push({ type: 'comma', value: ',' }); i++; continue; }

    // Number (including negative, decimal, hex)
    if (
      (input[i] >= '0' && input[i] <= '9') ||
      (input[i] === '-' && input[i + 1] >= '0' && input[i + 1] <= '9')
    ) {
      let j = i;
      if (input[j] === '-') j++;
      // Hex
      if (input[j] === '0' && (input[j + 1] === 'x' || input[j + 1] === 'X')) {
        j += 2;
        while (j < input.length && /[0-9a-fA-F]/.test(input[j])) j++;
      } else {
        while (j < input.length && ((input[j] >= '0' && input[j] <= '9') || input[j] === '.' || input[j] === 'e' || input[j] === 'E' || input[j] === '+' || input[j] === '-')) {
          // Only allow +/- after e/E
          if ((input[j] === '+' || input[j] === '-') && j > i && input[j - 1] !== 'e' && input[j - 1] !== 'E') break;
          j++;
        }
      }
      tokens.push({ type: 'number', value: input.slice(i, j) });
      i = j;
      continue;
    }

    // Identifiers / keywords
    if (/[a-zA-Z_$]/.test(input[i])) {
      let j = i + 1;
      while (j < input.length && /[a-zA-Z0-9_$]/.test(input[j])) j++;
      const word = input.slice(i, j);
      if (word === 'true' || word === 'false') {
        tokens.push({ type: 'boolean', value: word });
      } else if (word === 'null') {
        tokens.push({ type: 'null', value: word });
      } else if (word === 'undefined' || word === 'NaN' || word === 'Infinity') {
        tokens.push({ type: 'undefined', value: word });
      } else {
        tokens.push({ type: 'identifier', value: word });
      }
      i = j;
      continue;
    }

    tokens.push({ type: 'unknown', value: input[i] });
    i++;
  }

  return tokens;
}

/**
 * Given a raw string token value (possibly single-quoted), return the inner string content
 * preserving escape sequences but keeping it as-is for beautification (we don't convert quotes here).
 */
function formatStringToken(value: string): string {
  // Keep as-is for JS beautification (we want to preserve single quotes)
  return value;
}

export function beautifyJS(input: string, indent: number = 4): BeautifyResult {
  const trimmed = input.trim();
  if (!trimmed) return { output: '' };

  let tokens: Token[];
  try {
    tokens = tokenize(trimmed);
  } catch (e) {
    return { error: `Tokenization error: ${e}`, output: input };
  }

  // Filter out whitespace and newline tokens — we'll re-generate them
  // but keep comments exactly where they are relative to value tokens
  const meaningful = tokens.filter(t => t.type !== 'whitespace' && t.type !== 'newline');

  if (meaningful.length === 0) return { output: '' };

  let output = '';
  let depth = 0;
  const indentStr = ' '.repeat(indent);

  const pad = (d: number) => indentStr.repeat(d);

  // We need to handle trailing commas: skip commas before } or ]
  // Pre-pass: mark which commas are trailing
  const isTrailingComma = (idx: number): boolean => {
    if (meaningful[idx].type !== 'comma') return false;
    // Look ahead skipping comments
    for (let k = idx + 1; k < meaningful.length; k++) {
      const t = meaningful[k].type;
      if (t === 'line_comment' || t === 'block_comment') continue;
      if (t === 'rbrace' || t === 'rbracket') return true;
      break;
    }
    return false;
  };

  // Track whether we just opened a brace/bracket to handle empty objects/arrays
  // and whether the previous non-comment token was a comma or opener
  let prevSignificant: Token | null = null;

  for (let i = 0; i < meaningful.length; i++) {
    const tok = meaningful[i];

    if (tok.type === 'line_comment') {
      // Inline or standalone line comment
      if (prevSignificant && prevSignificant.type !== 'lbrace' && prevSignificant.type !== 'lbracket') {
        output += ' ' + tok.value;
      } else {
        output += '\n' + pad(depth) + tok.value;
      }
      // After line comment, next token should be on new line
      // peek ahead
      if (i + 1 < meaningful.length) {
        const next = meaningful[i + 1];
        if (next.type !== 'rbrace' && next.type !== 'rbracket') {
          output += '\n' + pad(depth);
        }
      }
      continue;
    }

    if (tok.type === 'block_comment') {
      if (prevSignificant && prevSignificant.type !== 'lbrace' && prevSignificant.type !== 'lbracket') {
        output += ' ' + tok.value;
      } else {
        output += '\n' + pad(depth) + tok.value;
      }
      // Peek: if next is a value token, add newline+indent
      if (i + 1 < meaningful.length) {
        const next = meaningful[i + 1];
        if (next.type !== 'rbrace' && next.type !== 'rbracket' && next.type !== 'comma' && next.type !== 'colon') {
          output += '\n' + pad(depth);
        }
      }
      continue;
    }

    // Skip trailing commas
    if (isTrailingComma(i)) {
      continue;
    }

    switch (tok.type) {
      case 'lbrace':
      case 'lbracket': {
        output += tok.value;
        depth++;
        // Peek: if immediately closed, keep on same line
        let nextMeaningful: Token | null = null;
        for (let k = i + 1; k < meaningful.length; k++) {
          if (meaningful[k].type !== 'line_comment' && meaningful[k].type !== 'block_comment') {
            nextMeaningful = meaningful[k];
            break;
          }
        }
        if (
          nextMeaningful &&
          nextMeaningful.type !== 'rbrace' &&
          nextMeaningful.type !== 'rbracket'
        ) {
          output += '\n' + pad(depth);
        }
        break;
      }

      case 'rbrace':
      case 'rbracket': {
        depth--;
        // Check if the output currently ends with the indent of the current (now decremented) depth
        // We want to put the closing brace on its own line
        const lastNewline = output.lastIndexOf('\n');
        const sinceNewline = lastNewline === -1 ? output : output.slice(lastNewline + 1);
        if (sinceNewline.trim() === '') {
          // Replace trailing whitespace with proper indent
          output = output.slice(0, lastNewline + 1) + pad(depth) + tok.value;
        } else {
          output += '\n' + pad(depth) + tok.value;
        }
        break;
      }

      case 'colon': {
        output += ': ';
        break;
      }

      case 'comma': {
        output += ',\n' + pad(depth);
        break;
      }

      case 'string': {
        output += formatStringToken(tok.value);
        break;
      }

      case 'number':
      case 'boolean':
      case 'null':
      case 'undefined':
      case 'identifier': {
        output += tok.value;
        break;
      }

      default: {
        output += tok.value;
      }
    }

    const tokType = tok.type as string;
    if (tokType !== 'line_comment' && tokType !== 'block_comment') {
      prevSignificant = tok;
    }
  }

  return { output: output.trim() };
}

export function minifyJS(input: string): BeautifyResult {
  const trimmed = input.trim();
  if (!trimmed) return { output: '' };

  let tokens: Token[];
  try {
    tokens = tokenize(trimmed);
  } catch (e) {
    return { error: `Tokenization error: ${e}`, output: input };
  }

  const meaningful = tokens.filter(
    t => t.type !== 'whitespace' && t.type !== 'newline' && t.type !== 'line_comment' && t.type !== 'block_comment'
  );

  let output = '';
  for (let i = 0; i < meaningful.length; i++) {
    const tok = meaningful[i];

    // Skip trailing commas
    if (tok.type === 'comma') {
      // Look ahead
      let trailing = false;
      for (let k = i + 1; k < meaningful.length; k++) {
        if (meaningful[k].type === 'rbrace' || meaningful[k].type === 'rbracket') { trailing = true; break; }
        break;
      }
      if (trailing) continue;
    }

    if (tok.type === 'colon') { output += ':'; continue; }
    if (tok.type === 'comma') { output += ','; continue; }
    output += tok.value;
  }

  return { output };
}
