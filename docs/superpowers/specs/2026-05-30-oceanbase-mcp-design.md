# OceanBase MCP Server 设计文档

## 概述

开发一个 MCP (Model Context Protocol) 服务器，用于连接 OceanBase 数据库，使 AI 编程助手（如 Claude Code、Cursor）能够查询数据库的表结构和数据。

**核心特性：**
- 同时支持 OceanBase 的 MySQL 和 Oracle 兼容协议
- 完整 DDL/DML 权限，危险操作需用户确认
- 基础功能：执行 SQL、查看表结构、列出数据库/表
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
  mode: mysql              # mysql | oracle
  host: localhost
  port: 2881               # MySQL 模式默认 2881，Oracle 模式默认 2883
  user: root
  password: your_password
  database: test           # 可选，默认连接的数据库
  # Oracle 模式特有配置（仅 mode: oracle 时生效）
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
- `connection.mode` — 必填，决定使用哪个驱动适配器
- `connection.port` — 根据模式有不同默认值，用户也可自定义
- `safety.confirm_dangerous` — 开启后，危险 SQL 不会直接执行，而是返回确认提示
- `output.max_rows` — 防止查询结果过大，可通过工具参数临时覆盖

---

## MCP Tools 定义

提供 **4 个核心工具**：

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