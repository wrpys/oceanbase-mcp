# OceanBase MCP Server 设计文档

## 概述

开发一个 MCP (Model Context Protocol) 服务器，用于连接 OceanBase 数据库，使 AI 编程助手（如 Claude Code、Cursor）能够查询数据库的表结构和数据。

**核心特性：**
- 同时支持 OceanBase 的 MySQL 和 Oracle 兼容协议
- 完整 DDL/DML 权限，危险操作需用户确认
- 查询功能：执行 SQL、查看表结构、列出数据库/表
- 数据操作：INSERT、DELETE、UPDATE（均需用户确认）
- YAML 配置文件，单实例连接
- Markdown 表格格式返回结果
- 可配置分页限制
- 支持本地开发运行 + npx 发布使用

---

## 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                     AI 编程助手                          │
│              (Claude Code / Cursor 等)                  │
└─────────────────────┬───────────────────────────────────┘
                      │ MCP Protocol
                      ▼
┌─────────────────────────────────────────────────────────┐
│               oceanbase-mcp (MCP Server)                │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ Config      │  │ Tool        │  │ Safety          │  │
│  │ Loader      │  │ Registry    │  │ Guard           │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐    │
│  │           Connection Manager                     │    │
│  │  ┌───────────────┐    ┌───────────────┐         │    │
│  │  │ MySQL Adapter │    │ Oracle Adapter│         │    │
│  │  │   (mysql2)    │    │  (oracledb)   │         │    │
│  │  └───────────────┘    └───────────────┘         │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   OceanBase 数据库     │
              │  (MySQL/Oracle 模式)   │
              └───────────────────────┘
```

**核心模块职责：**

| 模块 | 职责 |
|------|------|
| Config Loader | 读取并验证 YAML 配置文件 |
| Tool Registry | 注册 MCP Tools，处理工具调用 |
| Safety Guard | 拦截危险 SQL，返回确认提示 |
| Connection Manager | 管理数据库连接，根据 mode 选择适配器 |
| MySQL Adapter | 封装 mysql2 驱动操作 |
| Oracle Adapter | 封装 oracledb 驱动操作 |

---

## YAML 配置文件

```yaml
# oceanbase-mcp 配置文件
connection:
  # 连接协议模式（注意：这是协议模式，不是数据库内部兼容模式）
  # - mysql: 使用 MySQL 协议连接（mysql2 驱动），支持端口 2881 或 2883
  #   - 适用于 OceanBase MySQL 兼容模式
  #   - 也适用于 OceanBase Oracle 兼容模式通过 MySQL 协议端口（2883）访问
  #   - 推荐方式，无需安装额外依赖
  # - oracle: 使用原生 Oracle 协议连接（oracledb 驱动），仅支持端口 2881
  #   - 仅适用于 OceanBase Oracle 兼容模式
  #   - 需要安装 Oracle Instant Client
  #   - 需要配置 service 参数
  #
  # 重要说明：
  # OceanBase Oracle 兼容模式可以通过两种方式访问：
  # 1. MySQL 协议端口（2883）：配置 mode: mysql，使用 mysql2 驱动，SQL 需兼容 Oracle 语法
  # 2. 原生 Oracle 协议（2881）：配置 mode: oracle，使用 oracledb 驱动
  #
  # 如何识别数据库内部模式：
  # 检查用户名格式：用户名@租户名#集群名
  # - 租户名包含 "oracle"（如 oracle_utf8）→ Oracle 兼容模式
  # - 租户名包含 "mysql" 或其他 → MySQL 兼容模式
  mode: mysql              # mysql | oracle

  host: localhost
  port: 2881               # MySQL 协议端口：2881（原生）或 2883（代理）
                           # Oracle 协议端口：2881（原生）
  user: root
  password: your_password
  database: test           # 可选，默认连接的数据库
  # Oracle 模式特有配置（仅 mode: oracle 时生效，使用原生 Oracle 协议时必填）
  # service: ORCL          # Oracle service name

safety:
  confirm_dangerous: true  # 危险操作需要确认
  dangerous_keywords:      # 危险关键字列表
    - DROP
    - TRUNCATE
    - ALTER
    - DELETE

output:
  max_rows: 100            # 默认最大返回行数，0 表示不限制
  format: markdown         # markdown (固定)
```

**配置说明：**
- `connection.mode` — 必填，**连接协议模式**（不是数据库内部兼容模式）
  - `mysql`：使用 MySQL 协议（mysql2 驱动），推荐方式
  - `oracle`：使用原生 Oracle 协议（oracledb 驱动），需安装 Oracle Instant Client
- `connection.port` — MySQL 协议可用 2881（原生）或 2883（代理）；原生 Oracle 协议仅 2881
- `safety.confirm_dangerous` — 开启后，危险 SQL 不会直接执行，而是返回确认提示
- `output.max_rows` — 防止查询结果过大，可通过工具参数临时覆盖

---

## MCP Tools 定义

提供 **7 个工具**：

### 1. `query` 工具

执行 SQL 语句。

**参数：**
- `sql: string` (必填) — 要执行的 SQL 语句
- `max_rows: number` (可选) — 限制返回行数，覆盖配置默认值
- `confirm: boolean` (可选) — 确认执行危险 SQL

**返回：**
- 正常执行：Markdown 表格格式的查询结果
- 危险 SQL (且 confirm_dangerous=true)：返回确认提示，包含 SQL 内容和风险说明
- 执行失败：错误信息

### 2. `list_databases` 工具

列出所有数据库。

**参数：** 无

**返回：** Markdown 表格，列出所有数据库/Schema 名称

**实现方式：**
- MySQL 模式：执行 `SHOW DATABASES`
- Oracle 模式：查询 `ALL_USERS` 或 `ALL_SCHEMAS`

### 3. `list_tables` 工具

列出数据库的所有表。

**参数：**
- `database: string` (可选) — 指定数据库，默认使用当前连接的数据库

**返回：** Markdown 表格，列出表名、类型（TABLE/VIEW）、注释等

**实现方式：**
- MySQL 模式：执行 `SHOW TABLES` 或查询 `information_schema`
- Oracle 模式：查询 `ALL_TABLES` / `ALL_VIEWS`

### 4. `describe_table` 工具

查看表结构详情。

**参数：**
- `table: string` (必填) — 表名
- `database: string` (可选) — 指定数据库

**返回：** Markdown 表格，显示字段名、类型、是否为空、键、注释等

**实现方式：**
- MySQL 模式：执行 `DESCRIBE table` 或查询 `information_schema`
- Oracle 模式：查询 `ALL_TAB_COLUMNS`

### 5. `insert` 工具

插入数据到指定表。

**参数：**
- `table: string` (必填) — 表名
- `data: object | array` (必填) — 单条为 `{ column: value }`，批量为 `[{ column: value }, ...]`
- `database: string` (可选) — 指定数据库
- `confirm: boolean` (可选) — 确认执行

**返回：**
- 未确认：返回预览（SQL + 影响行数 + 数据预览）
- 已确认：返回执行结果（affectedRows）
- 执行失败：错误信息

**SQL 构建逻辑：**
- 单条：`INSERT INTO table (col1, col2) VALUES (val1, val2)`
- 批量：`INSERT INTO table (col1, col2) VALUES (val1, val2), (val3, val4)`
- 值自动处理：字符串加引号，数字直接拼接，NULL 转 NULL
- 表名使用反引号转义（MySQL 模式）或验证（Oracle 模式）

**预览返回格式：**
```json
{
  "type": "confirmation_required",
  "sql": "INSERT INTO SYS_USER (USER_ID, USER_NAME) VALUES (1, 'test')",
  "operation": "INSERT",
  "table": "SYS_USER",
  "row_count": 1,
  "data_preview": [{ "USER_ID": 1, "USER_NAME": "test" }],
  "suggestion": "请确认是否要插入以上数据。如确认，请重新调用 insert 工具并传入 confirm: true 参数。"
}
```

### 6. `delete` 工具

删除数据。

**参数：**
- `table: string` (必填) — 表名
- `where: string` (可选) — WHERE 条件（与 id/ids 二选一）
- `id: string | number` (可选) — 主键值（单条删除）
- `ids: array` (可选) — 主键值数组（批量删除）
- `database: string` (可选) — 指定数据库
- `confirm: boolean` (可选) — 确认执行

**返回：**
- 未确认：返回预览（SQL + 影响行数预估 + 风险说明）
- 已确认：返回执行结果（affectedRows）
- 执行失败：错误信息

**SQL 构建逻辑：**
- 主键删除（id）：`DELETE FROM table WHERE 主键 = id`
- 主键批量删除（ids）：`DELETE FROM table WHERE 主键 IN (id1, id2, ...)`
- 条件删除（where）：`DELETE FROM table WHERE {where}`
- 主键自动获取：查询表结构获取主键列名（带缓存）

**预览返回格式：**
```json
{
  "type": "confirmation_required",
  "sql": "DELETE FROM SYS_USER WHERE USER_ID = 1",
  "operation": "DELETE",
  "table": "SYS_USER",
  "row_count": 1,
  "where_clause": "USER_ID = 1",
  "risk_level": "high",
  "risk_description": "删除数据，可能影响业务",
  "suggestion": "请确认是否要删除以上数据。如确认，请重新调用 delete 工具并传入 confirm: true 参数。"
}
```

### 7. `update` 工具

更新数据。

**参数：**
- `table: string` (必填) — 表名
- `data: object` (必填) — 要更新的列值 `{ column: value, ... }`
- `where: string` (可选) — WHERE 条件（与 id 二选一）
- `id: string | number` (可选) — 主键值（主键更新）
- `database: string` (可选) — 指定数据库
- `confirm: boolean` (可选) — 确认执行

**返回：**
- 未确认：返回预览（SQL + 变更对比）
- 已确认：返回执行结果（affectedRows）
- 执行失败：错误信息

**SQL 构建逻辑：**
- 主键更新（id）：`UPDATE table SET col1=val1, col2=val2 WHERE 主键 = id`
- 条件更新（where）：`UPDATE table SET col1=val1, col2=val2 WHERE {where}`

**变更对比功能：**
- 更新前先查询当前数据
- 预览时展示 old → new 的变更对比
- 帮助用户确认变更内容是否正确

**预览返回格式：**
```json
{
  "type": "confirmation_required",
  "sql": "UPDATE SYS_USER SET NICK_NAME = '新昵称' WHERE USER_ID = 1",
  "operation": "UPDATE",
  "table": "SYS_USER",
  "row_count": 1,
  "changes": {
    "NICK_NAME": { "old": "旧昵称", "new": "新昵称" }
  },
  "where_clause": "USER_ID = 1",
  "suggestion": "请确认是否要更新以上数据。如确认，请重新调用 update 工具并传入 confirm: true 参数。"
}

---

## 危险操作确认机制

当 `confirm_dangerous: true` 时，Safety Guard 会拦截包含危险关键词的 SQL。

**工作流程：**

```
AI 调用 query 工具
       │
       ▼
Safety Guard 检测 SQL
       │
       ├─ 安全 SQL ──────────────► Connection Manager ──► 执行并返回结果
       │
       └─ 危险 SQL ──► 返回确认提示
                           │
                           ▼
                    AI 将提示展示给用户
                           │
                           ▼
                    用户确认后，AI 再次调用 query
                    (传入 confirm: true 参数)
                           │
                           ▼
                    Safety Guard 放行 ──► 执行 SQL
```

**确认提示返回格式：**

```json
{
  "type": "confirmation_required",
  "sql": "DROP TABLE users;",
  "risk_level": "high",
  "risk_description": "此操作将永久删除表 users 及其所有数据，无法恢复。",
  "suggestion": "请确认是否要执行此操作。如确认，请重新调用 query 工具并传入 confirm: true 参数。"
}
```

**危险关键词分级：**

| 级别 | 关键词 | 风险描述 |
|------|--------|----------|
| critical | DROP (DATABASE/TABLE) | 删除数据库/表，数据永久丢失 |
| critical | TRUNCATE | 清空表数据，无法恢复 |
| high | ALTER | 修改表结构，可能影响应用 |
| high | DELETE | 删除数据，可能影响业务 |
| medium | UPDATE | 更新数据，建议先备份 |
| medium | INSERT | 插入数据，相对安全 |

---

## 错误处理与连接管理

### 连接管理

- **连接池** — 使用驱动自带的连接池功能
  - MySQL: `mysql2` 内置连接池，通过 `connectionLimit` 配置
  - Oracle: `oracledb` 的 `poolMax/poolMin` 配置
- **连接复用** — MCP 服务器启动时建立连接池，所有查询共享
- **优雅关闭** — MCP 服务器关闭时，自动释放所有连接

### 错误处理

| 错误类型 | 处理方式 | 返回内容 |
|----------|----------|----------|
| 连接失败 | 启动时检测，失败则退出 | 错误信息 + 配置检查建议 |
| SQL 语法错误 | 返回数据库原生错误信息 | 错误码 + 错误描述 |
| 权限不足 | 返回权限错误信息 | 缺少的权限 + 建议操作 |
| 超时 | 可配置查询超时时间 | 超时提示 + 建议优化 SQL |
| 结果过大 | 超过 max_rows 限制时截断 | 返回部分数据 + 总行数提示 |

### 连接重试策略

- 启动时连接失败：最多重试 3 次，间隔 2 秒，失败后输出详细错误并提示用户检查配置
- 运行时连接断开：自动尝试重新连接（连接池自动处理）

---

## 数据操作工具辅助函数

为支持 insert、delete、update 工具，新增以下辅助函数：

| 函数 | 作用 |
|------|------|
| `buildInsertSQL(table, data)` | 构建 INSERT SQL，支持单条和批量 |
| `buildDeleteSQL(table, where, id, ids, primaryKey)` | 构建 DELETE SQL |
| `buildUpdateSQL(table, data, where, id, primaryKey)` | 构建 UPDATE SQL |
| `getPrimaryKey(table)` | 获取表的主键列名（带缓存） |
| `escapeValue(value)` | 转义 SQL 值（字符串加引号、NULL 处理） |
| `formatConfirmation(operation, sql, ...)` | 格式化确认提示返回 |

**主键缓存：**

为避免重复查询主键，使用简单的内存缓存：

```typescript
const primaryKeyCache: Map<string, string> = new Map();
```

缓存键格式：`database.table` 或仅 `table`。

**主键获取 SQL：**

```sql
-- Oracle 模式
SELECT cols.column_name 
FROM user_constraints cons, user_cons_columns cols 
WHERE cons.constraint_type = 'P' 
  AND cons.table_name = 'TABLE_NAME' 
  AND cons.constraint_name = cols.constraint_name

-- MySQL 模式
SELECT COLUMN_NAME 
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
WHERE TABLE_NAME = 'table_name' 
  AND CONSTRAINT_NAME = 'PRIMARY'
```

**错误处理：**

| 错误类型 | 处理方式 |
|----------|----------|
| 表不存在 | 返回错误：`Table 'xxx' not found` |
| 主键未找到 | 返回错误：`No primary key found for table 'xxx'` |
| 参数冲突 | 返回错误：`Cannot use both 'where' and 'id' parameters` |
| 执行失败 | 返回数据库原生错误信息 |

---

## 项目结构

```
oceanbase-mcp/
├── src/
│   ├── index.ts              # MCP 服务器入口
│   ├── config/
│   │   ├── loader.ts         # YAML 配置加载
│   │   └── schema.ts         # 配置验证 schema
│   ├── tools/
│   │   ├── registry.ts       # 工具注册中心
│   │   ├── query.ts          # query 工具实现
│   │   ├── listDatabases.ts  # list_databases 工具
│   │   ├── listTables.ts     # list_tables 工具
│   │   └── describeTable.ts  # describe_table 工具
│   ├── adapters/
│   │   ├── base.ts           # 适配器基类/接口
│   │   ├── mysql.ts          # MySQL 适配器 (mysql2)
│   │   └── oracle.ts         # Oracle 适配器 (oracledb)
│   ├── safety/
│   │   ├── guard.ts          # SQL 安全检查
│   │   └ keywords.ts         # 危险关键词定义
│   ├── formatter/
│   │   └── markdown.ts       # Markdown 表格格式化
│   └── types/
│       └── index.ts          # 类型定义
├── package.json
├── tsconfig.json
├── README.md
├── LICENSE
└── example/
    └── config.yaml           # 配置文件示例
```

---

## 发布与使用方式

### 开发阶段

```bash
# 本地运行
tsx src/index.ts --config path/to/config.yaml
```

### 发布后

```bash
# npx 直接运行
npx oceanbase-mcp --config path/to/config.yaml

# 或全局安装后运行
npm install -g oceanbase-mcp
oceanbase-mcp --config path/to/config.yaml
```

### Claude Code 配置示例

```json
{
  "mcpServers": {
    "oceanbase": {
      "command": "npx",
      "args": ["oceanbase-mcp", "--config", "path/to/config.yaml"]
    }
  }
}
```

### npm 包信息

```json
{
  "name": "oceanbase-mcp",
  "version": "1.0.0",
  "description": "MCP server for OceanBase database - supports MySQL and Oracle modes",
  "main": "dist/index.js",
  "bin": {
    "oceanbase-mcp": "dist/index.js"
  },
  "files": ["dist", "README.md", "LICENSE"],
  "keywords": ["mcp", "oceanbase", "database", "mysql", "oracle"],
  "license": "MIT"
}
```

---

## 技术栈

- **语言**：TypeScript
- **运行时**：Node.js
- **MCP SDK**：`@modelcontextprotocol/sdk`
- **MySQL 驱动**：`mysql2` (支持 OceanBase MySQL 模式)
- **Oracle 驱动**：`oracledb` (支持 OceanBase Oracle 模式，需安装 Oracle Instant Client)
- **配置解析**：`js-yaml`
- **开发工具**：`tsx` (TypeScript 执行)、`typescript` (编译)