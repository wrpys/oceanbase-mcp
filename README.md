# OceanBase MCP Server

[![npm version](https://badge.fury.io/js/oceanbase-mcp.svg)](https://badge.fury.io/js/oceanbase-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

MCP (Model Context Protocol) server for OceanBase database. Supports both MySQL and Oracle compatibility modes with comprehensive safety guards and DML operations.

## Features

- **Dual Mode Support**: Works with both MySQL and Oracle compatibility modes of OceanBase
- **SQL Query Execution**: Execute arbitrary SQL queries with Markdown table output
- **Database Exploration**: List databases, tables, and describe table structures
- **DML Operations**: Insert, update, and delete data with confirmation workflow
- **Safety Guards**: Dangerous operations (DROP, TRUNCATE, ALTER, DELETE) require explicit confirmation
- **SQL Injection Prevention**: Identifier escaping and parameter validation
- **Connection Retry**: Automatic retry on connection failures (3 attempts, 2s interval)
- **Row Limiting**: Configurable max rows to prevent overwhelming output

## Installation

```bash
npm install oceanbase-mcp
```

Or clone and build locally:

```bash
git clone https://github.com/your-org/oceanbase-mcp.git
cd oceanbase-mcp
npm install
npm run build
```

## Configuration

Create a YAML configuration file:

```yaml
# MySQL mode configuration
connection:
  mode: mysql              # mysql | oracle
  host: localhost
  port: 2881               # MySQL mode default: 2881, Oracle mode: 2883
  user: root
  password: your_password
  database: test           # Optional, default database

safety:
  confirm_dangerous: true  # Require confirmation for dangerous operations
  dangerous_keywords:      # Keywords that trigger confirmation
    - DROP
    - TRUNCATE
    - ALTER
    - DELETE

output:
  max_rows: 100            # Maximum rows to return (0 = unlimited)
```

For Oracle mode with MySQL protocol port (2883):

```yaml
connection:
  mode: mysql              # Use mysql mode even for Oracle compatibility
  host: localhost
  port: 2883               # Oracle mode MySQL protocol port
  user: your_user@tenant#cluster
  password: your_password
  database: your_schema
```

For native Oracle mode:

```yaml
connection:
  mode: oracle
  host: localhost
  port: 2883
  user: your_user
  password: your_password
  service: ORCL            # Oracle service name (required for oracle mode)
```

## Usage

### Start the Server

```bash
# Using npx
npx oceanbase-mcp --config /path/to/config.yaml

# Or after build
node dist/index.js --config /path/to/config.yaml
```

### MCP Client Configuration

Add to your MCP client settings (e.g., Claude Desktop, VS Code extension):

```json
{
  "mcpServers": {
    "oceanbase": {
      "command": "node",
      "args": ["path/to/oceanbase-mcp/dist/index.js", "--config", "path/to/config.yaml"]
    }
  }
}
```

## Available Tools

### 1. `query`

Execute SQL queries on OceanBase database.

**Parameters:**
- `sql` (string, required): SQL query to execute
- `max_rows` (number, optional): Override default max rows
- `confirm` (boolean, optional): Set to `true` to confirm dangerous SQL

**Example:**
```json
{
  "tool": "query",
  "arguments": {
    "sql": "SELECT * FROM users WHERE age > 18",
    "max_rows": 50
  }
}
```

For dangerous operations:
```json
// First call - returns confirmation prompt
{
  "tool": "query",
  "arguments": { "sql": "DROP TABLE temp_data" }
}

// Second call - executes after confirmation
{
  "tool": "query",
  "arguments": { "sql": "DROP TABLE temp_data", "confirm": true }
}
```

### 2. `list_databases`

List all databases (MySQL mode) or schemas (Oracle mode).

**Example:**
```json
{
  "tool": "list_databases",
  "arguments": {}
}
```

### 3. `list_tables`

List all tables in current or specified database.

**Parameters:**
- `database` (string, optional): Database name

**Example:**
```json
{
  "tool": "list_tables",
  "arguments": { "database": "my_database" }
}
```

### 4. `describe_table`

Describe table structure including columns, types, and constraints.

**Parameters:**
- `table` (string, required): Table name
- `database` (string, optional): Database name

**Example:**
```json
{
  "tool": "describe_table",
  "arguments": { "table": "users" }
}
```

### 5. `insert`

Insert data into a table. Requires confirmation before execution.

**Parameters:**
- `table` (string, required): Table name
- `data` (object or array, required): Data to insert
- `confirm` (boolean, optional): Set to `true` to execute

**Example:**
```json
// First call - returns preview
{
  "tool": "insert",
  "arguments": {
    "table": "users",
    "data": { "name": "Alice", "age": 30, "email": "alice@example.com" }
  }
}

// Second call - executes
{
  "tool": "insert",
  "arguments": {
    "table": "users",
    "data": { "name": "Alice", "age": 30, "email": "alice@example.com" },
    "confirm": true
  }
}
```

Batch insert:
```json
{
  "tool": "insert",
  "arguments": {
    "table": "users",
    "data": [
      { "name": "Alice", "age": 30 },
      { "name": "Bob", "age": 25 }
    ],
    "confirm": true
  }
}
```

### 6. `update`

Update data in a table. Shows change comparison before confirmation.

**Parameters:**
- `table` (string, required): Table name
- `data` (object, required): Column values to update
- `where` (string, optional): WHERE condition
- `id` (string/number, optional): Primary key value for single row
- `confirm` (boolean, optional): Set to `true` to execute

**Example:**
```json
// Update by primary key
{
  "tool": "update",
  "arguments": {
    "table": "users",
    "id": 1,
    "data": { "age": 31 },
    "confirm": true
  }
}

// Update by condition
{
  "tool": "update",
  "arguments": {
    "table": "users",
    "where": "age < 20",
    "data": { "status": "minor" },
    "confirm": true
  }
}
```

### 7. `delete`

Delete data from a table. Requires confirmation.

**Parameters:**
- `table` (string, required): Table name
- `where` (string, optional): WHERE condition
- `id` (string/number, optional): Primary key for single row
- `ids` (array, optional): Primary key values for batch delete
- `confirm` (boolean, optional): Set to `true` to execute

**Example:**
```json
// Delete by primary key
{
  "tool": "delete",
  "arguments": {
    "table": "users",
    "id": 1,
    "confirm": true
  }
}

// Delete by condition
{
  "tool": "delete",
  "arguments": {
    "table": "users",
    "where": "status = 'inactive'",
    "confirm": true
  }
}
```

## Safety Mechanisms

### Dangerous Operation Confirmation

Operations containing these keywords require explicit confirmation:

| Keyword | Risk Level | Description |
|---------|------------|-------------|
| DROP | critical | Delete database/table, permanent data loss |
| TRUNCATE | critical | Clear table data, unrecoverable |
| ALTER | high | Modify table structure, may affect applications |
| DELETE | high | Delete data, may affect business |

### SQL Injection Prevention

- **Identifier escaping**: Table/column names are escaped with backticks (MySQL) or validated against regex pattern (Oracle)
- **Value binding**: DML operations use proper value escaping
- **Primary key validation**: Table names validated before interpolation

### Auto-commit for DML

For OceanBase Oracle mode, DML operations (INSERT/UPDATE/DELETE) automatically execute `COMMIT` to ensure changes are persisted.

## Architecture

```
src/
├── index.ts              # Entry point, tool registration
├── config/
│   ├── loader.ts         # YAML config loader
│   └── schema.ts         # Zod validation schemas
├── adapters/
│   ├── base.ts           # Abstract base adapter
│   ├── mysql.ts          # MySQL adapter (mysql2)
│   └── oracle.ts         # Oracle adapter (oracledb)
├── safety/
│   ├── guard.ts          # SQL safety checker
│   └── keywords.ts       # Dangerous keywords definitions
├── formatter/
│   └── markdown.ts       # Markdown table formatter
└── types/
    └── index.ts          # TypeScript interfaces
```

**Startup Flow:**
1. Load YAML configuration
2. Create adapter (MySQL or Oracle)
3. Connect with retry (3 attempts, 2s delay)
4. Register 7 tools on McpServer
5. Serve over stdio transport

## Development

```bash
# Build
npm run build

# Development mode
npm run dev -- --config example/config.yaml

# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run single test file
npx vitest run tests/safety.test.ts
```

## Testing

The project includes comprehensive unit tests:

| Test File | Coverage |
|-----------|----------|
| `types.test.ts` | Type assignments |
| `config.test.ts` | Config validation and defaults |
| `formatter.test.ts` | Markdown table formatting, row truncation |
| `safety.test.ts` | SQL safety guard |
| `adapters.test.ts` | Adapter instantiation, error handling |
| `dml.test.ts` | Insert/delete/update workflow |

## OceanBase Compatibility Notes

- OceanBase may use MySQL protocol port (2883) even when running Oracle compatibility mode internally
- In this case, use `mode: mysql` in config but write Oracle-compatible SQL:
  - Use `WHERE ROWNUM <= 10` instead of `LIMIT 10`
  - Use `USER_TABLES` instead of `SHOW TABLES`
  - Use `SYSDATE` instead of `NOW()`

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please read the contributing guidelines before submitting PRs.

## Support

For issues and questions:
- GitHub Issues: [https://github.com/your-org/oceanbase-mcp/issues](https://github.com/your-org/oceanbase-mcp/issues)
- OceanBase Documentation: [https://oceanbase.com/docs](https://oceanbase.com/docs)