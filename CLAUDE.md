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

**Startup flow:** `src/index.ts` → load YAML config → create adapter (MySQL or Oracle) → connect with retry (3×, 2s) → register 7 tools → serve over stdio.

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

**Key architectural note:** `src/index.ts` has an inline `registerTools()` function that directly registers 7 tools on the McpServer: `query`, `list_databases`, `list_tables`, `describe_table`, `insert`, `delete`, `update`. The `src/tools/` directory contains alternative factory functions that are **not wired into the entry point**. DML helper functions (`buildInsertSQL`, `buildDeleteSQL`, `buildUpdateSQL`, `getPrimaryKey`, `escapeValue`, `formatDMLConfirmation`) are defined in `index.ts` before `registerTools()`.

## Key Patterns

- **MCP SDK:** Tools registered via `server.tool(name, description, zodSchema, handler)` from `@modelcontextprotocol/sdk/server/mcp.js`. All handlers return `{ content: [{ type: "text", text: string }] }`.
- **Adapter pattern:** `DatabaseAdapter` interface → `BaseAdapter` abstract class → `MySQLAdapter` (mysql2/promise pool) and `OracleAdapter` (oracledb pool). Factory in `index.ts` selects by `config.connection.mode`.
- **Safety guard:** `SafetyGuard.check(sql)` returns `{ safe, confirmation? }`. Dangerous keywords trigger a confirmation prompt; caller re-invokes with `confirm: true`.
- **SQL injection prevention:** MySQL adapter escapes identifiers with backtick quoting. Oracle adapter validates against `^[a-zA-Z_][a-zA-Z0-9_]*$` regex. DML helpers (`buildInsertSQL`, `buildDeleteSQL`, `buildUpdateSQL`) use backtick escaping and `escapeValue()` for value binding. `getPrimaryKey()` validates table names against same regex before interpolation.
- **DML tools:** `insert`, `delete`, `update` are registered inline in `registerTools()` alongside the query/list tools. All require `confirm: true` to execute. Helper functions (`buildInsertSQL`, `buildDeleteSQL`, `buildUpdateSQL`, `getPrimaryKey`, `escapeValue`, `formatDMLConfirmation`) are defined at module level in `index.ts`. Primary key cache (`primaryKeyCache: Map`) avoids repeated queries.
- **Config validation:** Zod schemas in `src/config/schema.ts`. Defaults applied for `safety` and `output` sections.
- **Import style:** All imports use `.js` extensions (NodeNext module resolution). Source comments are in Chinese.

## OceanBase Compatibility

### Understanding `connection.mode`

**Important:** The `mode` parameter specifies the **connection protocol**, not the internal database compatibility mode.

| Mode | Protocol | Driver | Port | Description |
|------|----------|--------|------|-------------|
| `mysql` | MySQL Protocol | mysql2 | 2881 or 2883 | Recommended. Works with both MySQL and Oracle compatibility modes |
| `oracle` | Native Oracle Protocol | oracledb | 2881 | Only for Oracle compatibility mode. Requires Oracle Instant Client |

**OceanBase Oracle Compatibility Mode** can be accessed in two ways:
1. **MySQL Protocol Port (2883)**: Set `mode: mysql`, use mysql2 driver, write Oracle-compatible SQL
2. **Native Oracle Protocol (2881)**: Set `mode: oracle`, use oracledb driver, requires `service` parameter

### How to Identify Database Mode

Check the username format: `用户名@租户名#集群名`
- Tenant name containing `oracle` (e.g., `oracle_utf8`) → Oracle compatibility mode
- Tenant name containing `mysql` or others → MySQL compatibility mode

### SQL Syntax Differences

When using Oracle compatibility mode via MySQL protocol (2883), write Oracle-compatible SQL:
- Use `WHERE ROWNUM <= 10` instead of `LIMIT 10`
- Use `USER_TABLES` instead of `SHOW TABLES`
- Use `SYSDATE` instead of `NOW()`
- Use `TO_NUMBER(column)` for numeric comparisons on VARCHAR columns

## Tests

6 test files in `tests/` — all unit tests with no live database dependency:
- `types.test.ts` — type assignments
- `config.test.ts` — config validation and defaults
- `formatter.test.ts` — markdown table formatting and row truncation
- `safety.test.ts` — SQL safety guard
- `adapters.test.ts` — adapter instantiation and not-connected error paths
- `dml.test.ts` — insert/delete/update tool behavior and confirmation workflow
