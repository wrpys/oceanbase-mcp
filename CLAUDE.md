# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run build          # TypeScript compile → dist/
npm run dev            # Run via tsx (dev mode): tsx src/index.ts --config <path>
npm run test           # Run all tests once (vitest)
npm run test:watch     # Run tests in watch mode
npx vitest run tests/safety.test.ts   # Run a single test file
```

Running the server requires a YAML config file:
```bash
node dist/index.js --config example/config.yaml
# or dev mode:
tsx src/index.ts --config example/config.yaml
```

## Architecture

MCP server for OceanBase database (MySQL and Oracle modes). Communicates over stdio transport using `@modelcontextprotocol/sdk`.

**Startup flow:** `src/index.ts` → load YAML config → create adapter (MySQL or Oracle) → connect with retry (3×, 2s) → register 4 tools → serve over stdio.

**Module dependencies:**

```
index.ts ──→ config/loader.ts ──→ config/schema.ts (Zod)
         ──→ adapters/mysql.ts or adapters/oracle.ts
         │       extends adapters/base.ts
         │       uses formatter/markdown.ts (truncateRows)
         ──→ safety/guard.ts ──→ safety/keywords.ts
         ──→ formatter/markdown.ts (formatAsMarkdownTable)
         ──→ types/index.ts (all interfaces)
```

**Key architectural note:** `src/index.ts` has an inline `registerTools()` function that directly registers tools on the McpServer. The `src/tools/` directory contains equivalent factory functions (`createQueryTool`, etc.) but they are **not wired into the entry point** — they are effectively an alternative path.

## Key Patterns

- **MCP SDK:** Tools registered via `server.tool(name, description, zodSchema, handler)` from `@modelcontextprotocol/sdk/server/mcp.js`. All handlers return `{ content: [{ type: "text", text: string }] }`.
- **Adapter pattern:** `DatabaseAdapter` interface → `BaseAdapter` abstract class → `MySQLAdapter` (mysql2/promise pool) and `OracleAdapter` (oracledb pool). Factory in `index.ts` selects by `config.connection.mode`.
- **Safety guard:** `SafetyGuard.check(sql)` returns `{ safe, confirmation? }`. Dangerous keywords trigger a confirmation prompt; caller re-invokes with `confirm: true`.
- **SQL injection prevention:** MySQL adapter escapes identifiers with backtick quoting. Oracle adapter validates against `^[a-zA-Z_][a-zA-Z0-9_]*$` regex.
- **Config validation:** Zod schemas in `src/config/schema.ts`. Defaults applied for `safety` and `output` sections.
- **Import style:** All imports use `.js` extensions (NodeNext module resolution). Source comments are in Chinese.

## OceanBase Compatibility

OceanBase may use MySQL protocol port (2883) even when internally running Oracle compatibility mode. In this case, use `mode: mysql` in config but write Oracle-compatible SQL (e.g., `WHERE ROWNUM <= 10` instead of `LIMIT 10`, `USER_TABLES` instead of `SHOW TABLES`).

## Tests

5 test files in `tests/` — all unit tests with no live database dependency:
- `types.test.ts` — type assignments
- `config.test.ts` — config validation and defaults
- `formatter.test.ts` — markdown table formatting and row truncation
- `safety.test.ts` — SQL safety guard
- `adapters.test.ts` — adapter instantiation and not-connected error paths
