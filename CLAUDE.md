# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `bun run dev` — start the Vite dev server with HMR
- `bun run build` — type-check (`tsc -b`) then production build (`vite build`)
- `bun run lint` — run ESLint over the repo
- `bun run preview` — serve the production build locally

There is no test framework installed; there are no tests to run.

## What this is

A fully client-side React 19 + TypeScript + Vite single-page app (the package is named `jslint`, the app is "lint-o-mania"). It's a browser tool for working with JSON and JS object literals. No backend, no router, no state library — everything runs in the browser.

## Architecture

The split that matters is **presentation vs. pure logic**:

- `src/App.tsx` is the only stateful component. It holds all state (`input`, `output`, `indent`, `darkMode`, status fields) and `handleAction` dispatches the four toolbar actions to the `src/lib` functions. Dark mode is persisted to `localStorage` under key `jslint-dark` (defaults to dark).
- `src/components/` are presentational only: `Toolbar` (action buttons + indent select + theme toggle), `Editor` (a textarea wrapper used for both input and read-only output), `StatusBar` (valid/error display with line/col).
- `src/lib/` holds all the real logic as **pure functions with no React dependency**. Every function takes a string and returns a result object (`{ output, error }` or `{ valid, error }`) — they never throw to the UI.

### Two deliberately different processing strategies

This is the key thing to understand before editing `src/lib`:

- **JSON actions go through `JSON.parse` (strict).** `linter.ts` (`lintJSON`, `beautifyJSON`, `minifyJSON`) relies on the native parser. `lintJSON` additionally parses the thrown `SyntaxError` message to recover line/column across Chrome/Firefox/Node formats.
- **JS-object actions deliberately avoid `JSON.parse`** so they can accept non-strict input (unquoted keys, single quotes, backticks, trailing commas, `//` and `/* */` comments, `undefined`/`NaN`/`Infinity`):
  - `jsToJson.ts` (`convertJSToJSON`) runs a fixed multi-pass string pipeline — `stripComments` → `convertQuotes` → `quoteKeys` → `replaceSpecialValues` → `removeTrailingCommas` — then calls `JSON.parse` only at the end to validate and pretty-print.
  - `jsBeautifier.ts` (`beautifyJS`, `minifyJS`) hand-rolls a tokenizer and re-emits formatted output, preserving comments and original quote styles. It never parses to JSON, so it tolerates input that isn't valid JSON.

Every hand-written scanner in `jsToJson.ts` and `jsBeautifier.ts` shares the same guard: when it hits a string literal it copies the contents verbatim until the closing quote, so that characters inside strings are never mistaken for syntax. Preserve that pattern when adding passes.

The **Minify** toolbar action is overloaded in `App.tsx`: it tries strict JSON minification first and only falls back to `minifyJS` when the input isn't valid JSON.
