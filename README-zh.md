# OceanBase MCP Server

[![npm version](https://badge.fury.io/js/oceanbase-mcp.svg)](https://badge.fury.io/js/oceanbase-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

OceanBase 数据库的 MCP (Model Context Protocol) 服务器。支持 MySQL 和 Oracle 兼容模式，提供完善的安全防护和 DML 操作功能。

## 功能特性

- **双模式支持**：同时支持 OceanBase 的 MySQL 和 Oracle 兼容模式
- **SQL 查询执行**：执行任意 SQL 查询，结果以 Markdown 表格格式输出
- **数据库探索**：列出数据库、表，查看表结构
- **DML 操作**：插入、更新、删除数据，带确认流程
- **安全防护**：危险操作（DROP、TRUNCATE、ALTER、DELETE）需要显式确认
- **SQL 注入防护**：标识符转义和参数验证
- **连接重试**：连接失败自动重试（3 次，间隔 2 秒）
- **行数限制**：可配置最大返回行数，防止输出过多

## 安装

```bash
npm install oceanbase-mcp
```

或克隆并本地构建：

```bash
git clone https://github.com/your-org/oceanbase-mcp.git
cd oceanbase-mcp
npm install
npm run build
```

## 配置

创建 YAML 配置文件：

```yaml
# MySQL 模式配置
connection:
  mode: mysql              # mysql | oracle
  host: localhost
  port: 2881               # MySQL 模式默认：2881，Oracle 模式：2883
  user: root
  password: your_password
  database: test           # 可选，默认连接的数据库

safety:
  confirm_dangerous: true  # 危险操作需要确认
  dangerous_keywords:      # 触发确认的关键词列表
    - DROP
    - TRUNCATE
    - ALTER
    - DELETE

output:
  max_rows: 100            # 最大返回行数（0 = 不限制）
```

Oracle 兼容模式使用 MySQL 协议端口（2883）：

```yaml
connection:
  mode: mysql              # Oracle 兼容模式也使用 mysql 模式
  host: localhost
  port: 2883               # Oracle 模式 MySQL 协议端口
  user: your_user@tenant#cluster
  password: your_password
  database: your_schema
```

原生 Oracle 模式：

```yaml
connection:
  mode: oracle
  host: localhost
  port: 2883
  user: your_user
  password: your_password
  service: ORCL            # Oracle service name（oracle 模式必填）
```

## 使用方法

### 启动服务器

```bash
# 使用 npx
npx oceanbase-mcp --config /path/to/config.yaml

# 或构建后运行
node dist/index.js --config /path/to/config.yaml
```

### MCP 客户端配置

添加到 MCP 客户端设置（如 Claude Desktop、VS Code 扩展）：

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

## 可用工具

### 1. `query`

在 OceanBase 数据库上执行 SQL 查询。

**参数：**
- `sql`（字符串，必填）：要执行的 SQL 查询
- `max_rows`（数字，可选）：覆盖默认最大行数
- `confirm`（布尔，可选）：设置为 `true` 确认执行危险 SQL

**示例：**
```json
{
  "tool": "query",
  "arguments": {
    "sql": "SELECT * FROM users WHERE age > 18",
    "max_rows": 50
  }
}
```

危险操作：
```json
// 第一次调用 - 返回确认提示
{
  "tool": "query",
  "arguments": { "sql": "DROP TABLE temp_data" }
}

// 第二次调用 - 确认后执行
{
  "tool": "query",
  "arguments": { "sql": "DROP TABLE temp_data", "confirm": true }
}
```

### 2. `list_databases`

列出所有数据库（MySQL 模式）或模式（Oracle 模式）。

**示例：**
```json
{
  "tool": "list_databases",
  "arguments": {}
}
```

### 3. `list_tables`

列出当前或指定数据库中的所有表。

**参数：**
- `database`（字符串，可选）：数据库名

**示例：**
```json
{
  "tool": "list_tables",
  "arguments": { "database": "my_database" }
}
```

### 4. `describe_table`

查看表结构，包括列名、类型和约束。

**参数：**
- `table`（字符串，必填）：表名
- `database`（字符串，可选）：数据库名

**示例：**
```json
{
  "tool": "describe_table",
  "arguments": { "table": "users" }
}
```

### 5. `insert`

向表中插入数据。执行前需要确认。

**参数：**
- `table`（字符串，必填）：表名
- `data`（对象或数组，必填）：要插入的数据
- `confirm`（布尔，可选）：设置为 `true` 执行

**示例：**
```json
// 第一次调用 - 返回预览
{
  "tool": "insert",
  "arguments": {
    "table": "users",
    "data": { "name": "Alice", "age": 30, "email": "alice@example.com" }
  }
}

// 第二次调用 - 执行
{
  "tool": "insert",
  "arguments": {
    "table": "users",
    "data": { "name": "Alice", "age": 30, "email": "alice@example.com" },
    "confirm": true
  }
}
```

批量插入：
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

更新表中的数据。确认前显示变更对比。

**参数：**
- `table`（字符串，必填）：表名
- `data`（对象，必填）：要更新的列值
- `where`（字符串，可选）：WHERE 条件
- `id`（字符串/数字，可选）：主键值，用于单行更新
- `confirm`（布尔，可选）：设置为 `true` 执行

**示例：**
```json
// 按主键更新
{
  "tool": "update",
  "arguments": {
    "table": "users",
    "id": 1,
    "data": { "age": 31 },
    "confirm": true
  }
}

// 按条件更新
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

从表中删除数据。需要确认。

**参数：**
- `table`（字符串，必填）：表名
- `where`（字符串，可选）：WHERE 条件
- `id`（字符串/数字，可选）：主键值，用于单行删除
- `ids`（数组，可选）：主键值列表，用于批量删除
- `confirm`（布尔，可选）：设置为 `true` 执行

**示例：**
```json
// 按主键删除
{
  "tool": "delete",
  "arguments": {
    "table": "users",
    "id": 1,
    "confirm": true
  }
}

// 按条件删除
{
  "tool": "delete",
  "arguments": {
    "table": "users",
    "where": "status = 'inactive'",
    "confirm": true
  }
}
```

## 安全机制

### 危险操作确认

包含以下关键词的操作需要显式确认：

| 关键词 | 风险级别 | 描述 |
|--------|----------|------|
| DROP | critical（严重） | 删除数据库/表，数据永久丢失 |
| TRUNCATE | critical（严重） | 清空表数据，无法恢复 |
| ALTER | high（高） | 修改表结构，可能影响应用 |
| DELETE | high（高） | 删除数据，可能影响业务 |

### SQL 注入防护

- **标识符转义**：表名/列名使用反引号转义（MySQL）或正则验证（Oracle）
- **值绑定**：DML 操作使用正确的值转义
- **主键验证**：表名在插值前进行验证

### DML 自动提交

针对 OceanBase Oracle 模式，DML 操作（INSERT/UPDATE/DELETE）自动执行 `COMMIT`，确保更改持久化。

## 项目架构

```
src/
├── index.ts              # 入口，工具注册
├── config/
│   ├── loader.ts         # YAML 配置加载器
│   └── schema.ts         # Zod 验证规则
├── adapters/
│   ├── base.ts           # 抽象基类适配器
│   ├── mysql.ts          # MySQL 适配器（mysql2）
│   └── oracle.ts         # Oracle 适配器（oracledb）
├── safety/
│   ├── guard.ts          # SQL 安全检查器
│   └── keywords.ts       # 危险关键词定义
├── formatter/
│   └── markdown.ts       # Markdown 表格格式化
└── types/
    └── index.ts          # TypeScript 接口定义
```

**启动流程：**
1. 加载 YAML 配置
2. 创建适配器（MySQL 或 Oracle）
3. 连接数据库（带重试，3 次，间隔 2 秒）
4. 在 McpServer 上注册 7 个工具
5. 通过 stdio 传输协议提供服务

## 开发

```bash
# 构建
npm run build

# 开发模式
npm run dev -- --config example/config.yaml

# 运行测试
npm run test

# 测试监听模式
npm run test:watch

# 运行单个测试文件
npx vitest run tests/safety.test.ts
```

## 测试

项目包含完善的单元测试：

| 测试文件 | 覆盖内容 |
|----------|----------|
| `types.test.ts` | 类型赋值 |
| `config.test.ts` | 配置验证和默认值 |
| `formatter.test.ts` | Markdown 表格格式化、行截断 |
| `safety.test.ts` | SQL 安全检查 |
| `adapters.test.ts` | 适配器实例化、错误处理 |
| `dml.test.ts` | 插入/删除/更新工作流 |

## OceanBase 兼容性说明

- OceanBase 内部运行 Oracle 兼容模式时，可能仍使用 MySQL 协议端口（2883）
- 此情况下，配置使用 `mode: mysql`，但 SQL 需兼容 Oracle 语法：
  - 使用 `WHERE ROWNUM <= 10` 替代 `LIMIT 10`
  - 使用 `USER_TABLES` 替代 `SHOW TABLES`
  - 使用 `SYSDATE` 替代 `NOW()`

## 许可证

MIT 许可证 - 详情见 [LICENSE](LICENSE) 文件。

## 贡献

欢迎贡献代码！提交 PR 前请阅读贡献指南。

## 支持

问题和疑问：
- GitHub Issues: [https://github.com/your-org/oceanbase-mcp/issues](https://github.com/your-org/oceanbase-mcp/issues)
- OceanBase 文档: [https://oceanbase.com/docs](https://oceanbase.com/docs)