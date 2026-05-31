# OceanBase MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub](https://img.shields.io/badge/GitHub-wrpys%2Foceanbase--mcp-blue)](https://github.com/wrpys/oceanbase-mcp)

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

### From Git Repository (Recommended)

Clone and build locally:

```bash
git clone https://github.com/wrpys/oceanbase-mcp.git
cd oceanbase-mcp
npm install              # Automatically builds via postinstall script
```

Or use directly with npx from Git:

```bash
npx github:wrpys/oceanbase-mcp --config /path/to/config.yaml
```

### From npm (when published)

```bash
npm install oceanbase-mcp
```

## Configuration

Create a YAML configuration file:

### Understanding `connection.mode`

**Important:** The `mode` parameter specifies the **connection protocol**, not the internal database compatibility mode.

| Mode | Protocol | Driver | Port | Description |
|------|----------|--------|------|-------------|
| `mysql` | MySQL Protocol | mysql2 | 2881 or 2883 | Recommended. Works with both MySQL and Oracle compatibility modes |
| `oracle` | Native Oracle Protocol | oracledb | 2881 | Only for Oracle compatibility mode. Requires Oracle Instant Client |

**OceanBase Oracle Compatibility Mode** can be accessed in two ways:
1. **MySQL Protocol Port (2883)**: Set `mode: mysql`, use mysql2 driver, write Oracle-compatible SQL
2. **Native Oracle Protocol (2881)**: Set `mode: oracle`, use oracledb driver, requires `service` parameter

### Configuration Examples

#### MySQL Compatibility Mode (or Oracle mode via MySQL protocol)

```yaml
connection:
  mode: mysql              # Use MySQL protocol (mysql2 driver)
  host: localhost
  port: 2881               # 2881 (native) or 2883 (proxy)
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

#### Oracle Compatibility Mode via MySQL Protocol Port (Recommended)

```yaml
connection:
  mode: mysql              # Use MySQL protocol even for Oracle compatibility
  host: localhost
  port: 2883               # MySQL protocol proxy port
  user: your_user@tenant#cluster  # Username format: user@tenant#cluster
  password: your_password
  database: your_schema
```

When using Oracle compatibility mode via MySQL protocol, write Oracle-compatible SQL:
- Use `WHERE ROWNUM <= 10` instead of `LIMIT 10`
- Use `SYSDATE` instead of `NOW()`
- Use `USER_TABLES` instead of `SHOW TABLES`

#### Native Oracle Protocol Mode

```yaml
connection:
  mode: oracle             # Use native Oracle protocol (oracledb driver)
  host: localhost
  port: 2881               # Native Oracle protocol port
  user: your_user
  password: your_password
  service: ORCL            # Oracle service name (required for oracle mode)
```

Note: Native Oracle mode requires installing Oracle Instant Client.

## Usage

### Configuration Sources (Priority: CLI > Env > File > Default)

The server supports three configuration sources with the following priority:

1. **Command Line Arguments** (highest priority)
2. **Environment Variables**
3. **Configuration File**
4. **Default Values** (lowest priority)

### Configuration Parameters

| Config File | Environment Variable | CLI Argument |
|-------------|---------------------|--------------|
| `connection.mode` | `CONNECTION_MODE` | `--connection-mode` |
| `connection.host` | `CONNECTION_HOST` | `--connection-host` |
| `connection.port` | `CONNECTION_PORT` | `--connection-port` |
| `connection.user` | `CONNECTION_USER` | `--connection-user` |
| `connection.password` | `CONNECTION_PASSWORD` | `--connection-password` |
| `connection.database` | `CONNECTION_DATABASE` | `--connection-database` |
| `connection.service` | `CONNECTION_SERVICE` | `--connection-service` |
| `safety.confirm_dangerous` | `SAFETY_CONFIRM_DANGEROUS` | `--safety-confirm-dangerous` |
| `safety.dangerous_keywords` | `SAFETY_DANGEROUS_KEYWORDS` | `--safety-dangerous-keywords` |
| `output.max_rows` | `OUTPUT_MAX_ROWS` | `--output-max-rows` |

### Start the Server

```bash
# Method 1: All parameters via CLI (simplest)
npx github:wrpys/oceanbase-mcp \
  --connection-host localhost \
  --connection-port 2883 \
  --connection-user root \
  --connection-password secret \
  --connection-database test

# Method 2: Config file + env vars (sensitive info via env)
npx github:wrpys/oceanbase-mcp --config config.yaml
# Set env: CONNECTION_PASSWORD=secret

# Method 3: Config file only (traditional)
npx github:wrpys/oceanbase-mcp --config config.yaml
```

### MCP Client Configuration

#### Claude Code (Recommended: use `claude mcp add`)

由于本 MCP Server 通过 stdio 通信且使用命令行参数配置，推荐使用 `claude mcp add` 命令直接注册，无需手动编辑 `mcp.json` 文件：

```bash
# MySQL 兼容模式
claude mcp add oceanbase-mysql -- \
  node "/path/to/oceanbase-mcp/dist/index.js" \
  --connection-host localhost \
  --connection-port 2881 \
  --connection-user root \
  --connection-password your_password \
  --connection-database test

# Oracle 兼容模式（通过 MySQL 协议端口）
claude mcp add oceanbase-oracle -- \
  node "/path/to/oceanbase-mcp/dist/index.js" \
  --connection-host 10.1.12.110 \
  --connection-port 2883 \
  --connection-user "PSOT1@oracle_utf8#dev_cj" \
  --connection-password your_password \
  --connection-database PSOT1
```

> **提示：** 将 `/path/to/oceanbase-mcp` 替换为实际的安装路径，例如 `E:/job/popo/mcp/oceanbase-mcp`。也可以用 `npx github:wrpys/oceanbase-mcp` 替代 `node .../dist/index.js`，但本地构建方式启动更快。

#### 其他 MCP 客户端（mcp.json 配置）

如果使用其他支持 MCP 协议的客户端，可以在 `mcp.json` 中配置：

**Option 1: All parameters via CLI (recommended for simplicity)**

```json
{
  "mcpServers": {
    "oceanbase": {
      "command": "node",
      "args": [
        "/path/to/oceanbase-mcp/dist/index.js",
        "--connection-host", "10.1.12.96",
        "--connection-port", "2883",
        "--connection-user", "PSOT1@oracle_utf8#dev_cj",
        "--connection-password", "your_password",
        "--connection-database", "slf"
      ]
    }
  }
}
```

**Option 2: Config file + env vars (sensitive info via env)**

```json
{
  "mcpServers": {
    "oceanbase": {
      "command": "node",
      "args": ["/path/to/oceanbase-mcp/dist/index.js", "--config", "config.yaml"],
      "env": {
        "CONNECTION_PASSWORD": "your_password"
      }
    }
  }
}
```

**Option 3: Config file only**

```json
{
  "mcpServers": {
    "oceanbase": {
      "command": "node",
      "args": ["/path/to/oceanbase-mcp/dist/index.js", "--config", "config.yaml"]
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

### Understanding `connection.mode`

**Important:** The `mode` parameter specifies the **connection protocol**, not the internal database compatibility mode.

| Mode | Protocol | Driver | Port | Description |
|------|----------|--------|------|-------------|
| `mysql` | MySQL Protocol | mysql2 | 2881 or 2883 | Recommended. Works with both MySQL and Oracle compatibility modes |
| `oracle` | Native Oracle Protocol | oracledb | 2881 | Only for Oracle compatibility mode. Requires Oracle Instant Client |

### How to Identify Database Mode

Check the username format: `username@tenant#cluster`
- Tenant name containing `oracle` (e.g., `oracle_utf8`) → Oracle compatibility mode
- Tenant name containing `mysql` or others → MySQL compatibility mode

### SQL Syntax Differences

When using Oracle compatibility mode via MySQL protocol (2883), write Oracle-compatible SQL:
- Use `WHERE ROWNUM <= 10` instead of `LIMIT 10`
- Use `USER_TABLES` instead of `SHOW TABLES`
- Use `SYSDATE` instead of `NOW()`
- Use `TO_NUMBER(column)` for numeric comparisons on VARCHAR columns

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please read the contributing guidelines before submitting PRs.

## Support

For issues and questions:
- GitHub Issues: [https://github.com/wrpys/oceanbase-mcp/issues](https://github.com/wrpys/oceanbase-mcp/issues)
- OceanBase Documentation: [https://oceanbase.com/docs](https://oceanbase.com/docs)