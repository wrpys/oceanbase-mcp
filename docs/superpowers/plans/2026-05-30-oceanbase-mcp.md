# OceanBase MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript MCP server that connects to OceanBase database, supporting both MySQL and Oracle modes, with safety guards for dangerous operations.

**Architecture:** Single MCP server process with driver adapters. Uses `mysql2` for MySQL mode and `oracledb` for Oracle mode. Safety Guard intercepts dangerous SQL before execution. Results formatted as Markdown tables.

**Tech Stack:** TypeScript, Node.js, @modelcontextprotocol/sdk, mysql2, oracledb, js-yaml

---

## File Structure

```
oceanbase-mcp/
├── src/
│   ├── index.ts              # MCP 服务器入口，启动和配置加载
│   ├── types/
│   │   └── index.ts          # 类型定义
│   ├── config/
│   │   ├── loader.ts         # YAML 配置加载和验证
│   │   └── schema.ts         # 配置 Schema 定义
│   ├── adapters/
│   │   ├── base.ts           # 数据库适配器接口
│   │   ├── mysql.ts          # MySQL 适配器实现
│   │   └── oracle.ts         # Oracle 适配器实现
│   ├── safety/
│   │   ├── keywords.ts       # 危险关键词定义
│   │   └── guard.ts          # SQL 安全检查器
│   ├── formatter/
│   │   └── markdown.ts       # Markdown 表格格式化
│   └── tools/
│       ├── index.ts          # 工具注册和导出
│       ├── query.ts          # query 工具实现
│       ├── listDatabases.ts  # list_databases 工具实现
│       ├── listTables.ts     # list_tables 工具实现
│       └── describeTable.ts  # describe_table 工具实现
├── tests/
│   ├── config.test.ts
│   ├── safety.test.ts
│   ├── formatter.test.ts
│   └── adapters.test.ts
├── example/
│   └── config.yaml
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE
```

---

## Task 1: 项目初始化

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `LICENSE`
- Create: `README.md`

- [ ] **Step 1: 初始化 npm 项目**

```bash
npm init -y
```

- [ ] **Step 2: 安装依赖**

```bash
npm install @modelcontextprotocol/sdk mysql2 oracledb js-yaml zod
npm install -D typescript tsx @types/node @types/js-yaml vitest
```

- [ ] **Step 3: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: 创建 .gitignore**

```
node_modules/
dist/
*.log
.env
config.yaml
```

- [ ] **Step 5: 创建 LICENSE (MIT)**

```
MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 6: 创建 README.md**

```markdown
# OceanBase MCP Server

MCP (Model Context Protocol) server for OceanBase database. Supports both MySQL and Oracle compatibility modes.

## Features

- Execute SQL queries with safety guards
- List databases and tables
- Describe table structure
- Support MySQL and Oracle modes
- Dangerous operation confirmation

## Installation

```bash
npm install oceanbase-mcp
```

## Usage

```bash
npx oceanbase-mcp --config /path/to/config.yaml
```

## Configuration

See `example/config.yaml` for configuration reference.

## License

MIT
```

- [ ] **Step 7: 更新 package.json 添加 scripts 和 bin**

```json
{
  "name": "oceanbase-mcp",
  "version": "1.0.0",
  "description": "MCP server for OceanBase database - supports MySQL and Oracle modes",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "oceanbase-mcp": "dist/index.js"
  },
  "files": ["dist", "README.md", "LICENSE"],
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "keywords": ["mcp", "oceanbase", "database", "mysql", "oracle"],
  "license": "MIT",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "js-yaml": "^4.1.0",
    "mysql2": "^3.0.0",
    "oracledb": "^6.0.0",
    "zod": "^3.0.0"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.0",
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

- [ ] **Step 8: 提交初始化代码**

```bash
git add package.json tsconfig.json .gitignore LICENSE README.md
git commit -m "chore: initialize project structure"
```

---

## Task 2: 类型定义

**Files:**
- Create: `src/types/index.ts`
- Create: `tests/types.test.ts`

- [ ] **Step 1: 编写类型测试**

创建文件 `tests/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { Config, ConnectionConfig, SafetyConfig, OutputConfig, QueryResult, ConfirmationRequired } from '../src/types';

describe('Types', () => {
  it('should accept valid MySQL connection config', () => {
    const conn: ConnectionConfig = {
      mode: 'mysql',
      host: 'localhost',
      port: 2881,
      user: 'root',
      password: 'password',
      database: 'test'
    };
    expect(conn.mode).toBe('mysql');
  });

  it('should accept valid Oracle connection config', () => {
    const conn: ConnectionConfig = {
      mode: 'oracle',
      host: 'localhost',
      port: 2883,
      user: 'system',
      password: 'password',
      service: 'ORCL'
    };
    expect(conn.mode).toBe('oracle');
  });

  it('should accept valid full config', () => {
    const config: Config = {
      connection: {
        mode: 'mysql',
        host: 'localhost',
        port: 2881,
        user: 'root',
        password: 'password'
      },
      safety: {
        confirm_dangerous: true,
        dangerous_keywords: ['DROP', 'TRUNCATE']
      },
      output: {
        max_rows: 100
      }
    };
    expect(config.connection.mode).toBe('mysql');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm run test
```

Expected: Test fails with "Cannot find module '../src/types'"

- [ ] **Step 3: 创建类型定义文件**

创建文件 `src/types/index.ts`:

```typescript
/**
 * 数据库连接模式
 */
export type DatabaseMode = 'mysql' | 'oracle';

/**
 * 数据库连接配置
 */
export interface ConnectionConfig {
  mode: DatabaseMode;
  host: string;
  port: number;
  user: string;
  password: string;
  database?: string;
  /** Oracle 模式专用：service name */
  service?: string;
}

/**
 * 安全配置
 */
export interface SafetyConfig {
  /** 是否启用危险操作确认 */
  confirm_dangerous: boolean;
  /** 危险关键词列表 */
  dangerous_keywords: string[];
}

/**
 * 输出配置
 */
export interface OutputConfig {
  /** 最大返回行数，0 表示不限制 */
  max_rows: number;
}

/**
 * 完整配置
 */
export interface Config {
  connection: ConnectionConfig;
  safety?: SafetyConfig;
  output?: OutputConfig;
}

/**
 * 默认安全配置
 */
export const DEFAULT_SAFETY_CONFIG: SafetyConfig = {
  confirm_dangerous: true,
  dangerous_keywords: ['DROP', 'TRUNCATE', 'ALTER', 'DELETE']
};

/**
 * 默认输出配置
 */
export const DEFAULT_OUTPUT_CONFIG: OutputConfig = {
  max_rows: 100
};

/**
 * 查询结果
 */
export interface QueryResult {
  success: boolean;
  data?: unknown[];
  columns?: string[];
  rowCount?: number;
  truncated?: boolean;
  totalRows?: number;
  error?: string;
}

/**
 * 危险操作确认提示
 */
export interface ConfirmationRequired {
  type: 'confirmation_required';
  sql: string;
  risk_level: 'critical' | 'high' | 'medium';
  risk_description: string;
  suggestion: string;
}

/**
 * 工具执行结果
 */
export type ToolResult = QueryResult | ConfirmationRequired;

/**
 * 数据库适配器接口
 */
export interface DatabaseAdapter {
  /** 连接数据库 */
  connect(): Promise<void>;
  /** 断开连接 */
  disconnect(): Promise<void>;
  /** 执行 SQL 查询 */
  query(sql: string, maxRows?: number): Promise<QueryResult>;
  /** 列出所有数据库 */
  listDatabases(): Promise<QueryResult>;
  /** 列出所有表 */
  listTables(database?: string): Promise<QueryResult>;
  /** 描述表结构 */
  describeTable(table: string, database?: string): Promise<QueryResult>;
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm run test
```

Expected: All tests pass

- [ ] **Step 5: 提交类型定义**

```bash
git add src/types/index.ts tests/types.test.ts
git commit -m "feat: add type definitions"
```

---

## Task 3: 配置加载器

**Files:**
- Create: `src/config/schema.ts`
- Create: `src/config/loader.ts`
- Create: `tests/config.test.ts`

- [ ] **Step 1: 编写配置加载测试**

创建文件 `tests/config.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigSchema, validateConfig, loadConfig, getDefaultConfig } from '../src/config/loader';
import type { Config } from '../src/types';

describe('Config Loader', () => {
  describe('validateConfig', () => {
    it('should validate minimal MySQL config', () => {
      const config = {
        connection: {
          mode: 'mysql',
          host: 'localhost',
          port: 2881,
          user: 'root',
          password: 'password'
        }
      };
      const result = validateConfig(config);
      expect(result.connection.mode).toBe('mysql');
      expect(result.safety?.confirm_dangerous).toBe(true);
    });

    it('should validate Oracle config with service', () => {
      const config = {
        connection: {
          mode: 'oracle',
          host: 'localhost',
          port: 2883,
          user: 'system',
          password: 'password',
          service: 'ORCL'
        }
      };
      const result = validateConfig(config);
      expect(result.connection.mode).toBe('oracle');
      expect(result.connection.service).toBe('ORCL');
    });

    it('should reject invalid mode', () => {
      const config = {
        connection: {
          mode: 'invalid',
          host: 'localhost',
          port: 2881,
          user: 'root',
          password: 'password'
        }
      };
      expect(() => validateConfig(config)).toThrow();
    });

    it('should reject missing required fields', () => {
      const config = {
        connection: {
          mode: 'mysql'
        }
      };
      expect(() => validateConfig(config)).toThrow();
    });
  });

  describe('getDefaultConfig', () => {
    it('should return config with defaults', () => {
      const config = getDefaultConfig();
      expect(config.safety?.confirm_dangerous).toBe(true);
      expect(config.safety?.dangerous_keywords).toContain('DROP');
      expect(config.output?.max_rows).toBe(100);
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm run test
```

Expected: Test fails with "Cannot find module '../src/config/loader'"

- [ ] **Step 3: 创建配置 Schema**

创建文件 `src/config/schema.ts`:

```typescript
import { z } from 'zod';

/**
 * 数据库模式 Schema
 */
export const DatabaseModeSchema = z.enum(['mysql', 'oracle']);

/**
 * 数据库连接配置 Schema
 */
export const ConnectionConfigSchema = z.object({
  mode: DatabaseModeSchema,
  host: z.string().min(1, 'host is required'),
  port: z.number().int().positive('port must be a positive integer'),
  user: z.string().min(1, 'user is required'),
  password: z.string(),
  database: z.string().optional(),
  service: z.string().optional()
});

/**
 * 安全配置 Schema
 */
export const SafetyConfigSchema = z.object({
  confirm_dangerous: z.boolean().default(true),
  dangerous_keywords: z.array(z.string()).default(['DROP', 'TRUNCATE', 'ALTER', 'DELETE'])
});

/**
 * 输出配置 Schema
 */
export const OutputConfigSchema = z.object({
  max_rows: z.number().int().min(0).default(100)
});

/**
 * 完整配置 Schema
 */
export const ConfigSchema = z.object({
  connection: ConnectionConfigSchema,
  safety: SafetyConfigSchema.optional(),
  output: OutputConfigSchema.optional()
});

export type ConfigSchemaType = z.infer<typeof ConfigSchema>;
```

- [ ] **Step 4: 创建配置加载器**

创建文件 `src/config/loader.ts`:

```typescript
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { ConfigSchema, type ConfigSchemaType } from './schema.js';
import type { Config, SafetyConfig, OutputConfig } from '../types/index.js';
import { DEFAULT_SAFETY_CONFIG, DEFAULT_OUTPUT_CONFIG } from '../types/index.js';

export { ConfigSchema } from './schema.js';

/**
 * 验证配置对象
 */
export function validateConfig(config: unknown): Config {
  const parsed = ConfigSchema.parse(config);
  return {
    connection: {
      mode: parsed.connection.mode,
      host: parsed.connection.host,
      port: parsed.connection.port,
      user: parsed.connection.user,
      password: parsed.connection.password,
      database: parsed.connection.database,
      service: parsed.connection.service
    },
    safety: parsed.safety ?? DEFAULT_SAFETY_CONFIG,
    output: parsed.output ?? DEFAULT_OUTPUT_CONFIG
  };
}

/**
 * 获取默认配置
 */
export function getDefaultConfig(): Config {
  return {
    connection: {
      mode: 'mysql',
      host: 'localhost',
      port: 2881,
      user: 'root',
      password: ''
    },
    safety: DEFAULT_SAFETY_CONFIG,
    output: DEFAULT_OUTPUT_CONFIG
  };
}

/**
 * 从文件加载配置
 */
export function loadConfig(configPath: string): Config {
  const absolutePath = path.resolve(configPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Config file not found: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const rawConfig = yaml.load(content);

  return validateConfig(rawConfig);
}
```

- [ ] **Step 5: 运行测试确认通过**

```bash
npm run test
```

Expected: All tests pass

- [ ] **Step 6: 提交配置加载器**

```bash
git add src/config/ tests/config.test.ts
git commit -m "feat: add config loader with validation"
```

---

## Task 4: Markdown 格式化器

**Files:**
- Create: `src/formatter/markdown.ts`
- Create: `tests/formatter.test.ts`

- [ ] **Step 1: 编写 Markdown 格式化测试**

创建文件 `tests/formatter.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { formatAsMarkdownTable, truncateRows } from '../src/formatter/markdown';

describe('Markdown Formatter', () => {
  describe('formatAsMarkdownTable', () => {
    it('should format simple data as markdown table', () => {
      const columns = ['id', 'name'];
      const data = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ];
      const result = formatAsMarkdownTable(columns, data);
      expect(result).toContain('| id | name |');
      expect(result).toContain('| --- | --- |');
      expect(result).toContain('| 1 | Alice |');
      expect(result).toContain('| 2 | Bob |');
    });

    it('should handle empty data', () => {
      const columns = ['id', 'name'];
      const data: unknown[] = [];
      const result = formatAsMarkdownTable(columns, data);
      expect(result).toContain('| id | name |');
      expect(result).toContain('| --- | --- |');
    });

    it('should handle null and undefined values', () => {
      const columns = ['id', 'value'];
      const data = [
        { id: 1, value: null },
        { id: 2, value: undefined }
      ];
      const result = formatAsMarkdownTable(columns, data);
      expect(result).toContain('| 1 | NULL |');
      expect(result).toContain('| 2 | NULL |');
    });

    it('should handle special characters', () => {
      const columns = ['text'];
      const data = [
        { text: 'Hello | World' }
      ];
      const result = formatAsMarkdownTable(columns, data);
      expect(result).toContain('Hello \\| World');
    });
  });

  describe('truncateRows', () => {
    it('should truncate rows when exceeding limit', () => {
      const data = [
        { id: 1 },
        { id: 2 },
        { id: 3 }
      ];
      const result = truncateRows(data, 2);
      expect(result.data.length).toBe(2);
      expect(result.truncated).toBe(true);
      expect(result.totalRows).toBe(3);
    });

    it('should not truncate when within limit', () => {
      const data = [
        { id: 1 },
        { id: 2 }
      ];
      const result = truncateRows(data, 5);
      expect(result.data.length).toBe(2);
      expect(result.truncated).toBe(false);
      expect(result.totalRows).toBe(2);
    });

    it('should handle zero limit (no truncation)', () => {
      const data = [
        { id: 1 },
        { id: 2 },
        { id: 3 }
      ];
      const result = truncateRows(data, 0);
      expect(result.data.length).toBe(3);
      expect(result.truncated).toBe(false);
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm run test
```

Expected: Test fails with "Cannot find module '../src/formatter/markdown'"

- [ ] **Step 3: 创建 Markdown 格式化器**

创建文件 `src/formatter/markdown.ts`:

```typescript
/**
 * 将数据格式化为 Markdown 表格
 */
export function formatAsMarkdownTable(columns: string[], data: unknown[]): string {
  if (!columns || columns.length === 0) {
    return 'No data';
  }

  const header = '| ' + columns.join(' | ') + ' |';
  const separator = '| ' + columns.map(() => '---').join(' | ') + ' |';

  const rows = data.map(row => {
    const values = columns.map(col => {
      const value = (row as Record<string, unknown>)[col];
      return formatValue(value);
    });
    return '| ' + values.join(' | ') + ' |';
  });

  return [header, separator, ...rows].join('\n');
}

/**
 * 格式化单个值
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  if (typeof value === 'string') {
    // 转义 Markdown 表格中的管道符
    return value.replace(/\|/g, '\\|');
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * 截断数据行
 */
export function truncateRows(
  data: unknown[],
  maxRows: number
): { data: unknown[]; truncated: boolean; totalRows: number } {
  const totalRows = data.length;

  // maxRows 为 0 表示不限制
  if (maxRows === 0 || totalRows <= maxRows) {
    return {
      data,
      truncated: false,
      totalRows
    };
  }

  return {
    data: data.slice(0, maxRows),
    truncated: true,
    totalRows
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm run test
```

Expected: All tests pass

- [ ] **Step 5: 提交格式化器**

```bash
git add src/formatter/ tests/formatter.test.ts
git commit -m "feat: add markdown table formatter"
```

---

## Task 5: 安全检查器

**Files:**
- Create: `src/safety/keywords.ts`
- Create: `src/safety/guard.ts`
- Create: `tests/safety.test.ts`

- [ ] **Step 1: 编写安全检查测试**

创建文件 `tests/safety.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { SafetyGuard, RISK_LEVELS } from '../src/safety/guard';
import type { SafetyConfig } from '../src/types';

describe('Safety Guard', () => {
  const defaultConfig: SafetyConfig = {
    confirm_dangerous: true,
    dangerous_keywords: ['DROP', 'TRUNCATE', 'ALTER', 'DELETE']
  };

  describe('RISK_LEVELS', () => {
    it('should have correct risk levels', () => {
      expect(RISK_LEVELS['DROP']).toBe('critical');
      expect(RISK_LEVELS['TRUNCATE']).toBe('critical');
      expect(RISK_LEVELS['ALTER']).toBe('high');
      expect(RISK_LEVELS['DELETE']).toBe('high');
      expect(RISK_LEVELS['UPDATE']).toBe('medium');
      expect(RISK_LEVELS['INSERT']).toBe('medium');
    });
  });

  describe('SafetyGuard', () => {
    it('should detect DROP as dangerous', () => {
      const guard = new SafetyGuard(defaultConfig);
      const result = guard.check('DROP TABLE users;');
      expect(result.safe).toBe(false);
      expect(result.confirmation?.risk_level).toBe('critical');
    });

    it('should detect TRUNCATE as dangerous', () => {
      const guard = new SafetyGuard(defaultConfig);
      const result = guard.check('TRUNCATE TABLE users;');
      expect(result.safe).toBe(false);
      expect(result.confirmation?.risk_level).toBe('critical');
    });

    it('should detect DELETE as dangerous', () => {
      const guard = new SafetyGuard(defaultConfig);
      const result = guard.check('DELETE FROM users WHERE id = 1;');
      expect(result.safe).toBe(false);
      expect(result.confirmation?.risk_level).toBe('high');
    });

    it('should allow SELECT queries', () => {
      const guard = new SafetyGuard(defaultConfig);
      const result = guard.check('SELECT * FROM users;');
      expect(result.safe).toBe(true);
      expect(result.confirmation).toBeUndefined();
    });

    it('should allow INSERT when not in dangerous_keywords', () => {
      const config: SafetyConfig = {
        confirm_dangerous: true,
        dangerous_keywords: ['DROP', 'TRUNCATE', 'ALTER', 'DELETE']
      };
      const guard = new SafetyGuard(config);
      const result = guard.check('INSERT INTO users VALUES (1, "test");');
      expect(result.safe).toBe(true);
    });

    it('should allow all when confirm_dangerous is false', () => {
      const config: SafetyConfig = {
        confirm_dangerous: false,
        dangerous_keywords: ['DROP']
      };
      const guard = new SafetyGuard(config);
      const result = guard.check('DROP TABLE users;');
      expect(result.safe).toBe(true);
    });

    it('should detect case-insensitive keywords', () => {
      const guard = new SafetyGuard(defaultConfig);
      const result = guard.check('drop table users;');
      expect(result.safe).toBe(false);
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm run test
```

Expected: Test fails with "Cannot find module '../src/safety/guard'"

- [ ] **Step 3: 创建危险关键词定义**

创建文件 `src/safety/keywords.ts`:

```typescript
/**
 * 危险关键词及其风险级别
 */
export const DANGEROUS_KEYWORDS: Record<string, { level: 'critical' | 'high' | 'medium'; description: string }> = {
  DROP: {
    level: 'critical',
    description: '删除数据库/表，数据永久丢失'
  },
  TRUNCATE: {
    level: 'critical',
    description: '清空表数据，无法恢复'
  },
  ALTER: {
    level: 'high',
    description: '修改表结构，可能影响应用'
  },
  DELETE: {
    level: 'high',
    description: '删除数据，可能影响业务'
  },
  UPDATE: {
    level: 'medium',
    description: '更新数据，建议先备份'
  },
  INSERT: {
    level: 'medium',
    description: '插入数据，相对安全'
  }
};

/**
 * 获取关键词的风险级别
 */
export function getRiskLevel(keyword: string): 'critical' | 'high' | 'medium' | undefined {
  const upperKeyword = keyword.toUpperCase();
  return DANGEROUS_KEYWORDS[upperKeyword]?.level;
}

/**
 * 获取关键词的风险描述
 */
export function getRiskDescription(keyword: string): string | undefined {
  const upperKeyword = keyword.toUpperCase();
  return DANGEROUS_KEYWORDS[upperKeyword]?.description;
}
```

- [ ] **Step 4: 创建安全检查器**

创建文件 `src/safety/guard.ts`:

```typescript
import type { SafetyConfig, ConfirmationRequired } from '../types/index.js';
import { DANGEROUS_KEYWORDS, getRiskLevel, getRiskDescription } from './keywords.js';

export { DANGEROUS_KEYWORDS } from './keywords.js';

/**
 * SQL 关键词风险级别映射
 */
export const RISK_LEVELS: Record<string, 'critical' | 'high' | 'medium'> = {
  DROP: 'critical',
  TRUNCATE: 'critical',
  ALTER: 'high',
  DELETE: 'high',
  UPDATE: 'medium',
  INSERT: 'medium'
};

/**
 * 安全检查结果
 */
export interface SafetyCheckResult {
  safe: boolean;
  confirmation?: ConfirmationRequired;
}

/**
 * 安全检查器
 */
export class SafetyGuard {
  private config: SafetyConfig;
  private keywordPattern: RegExp;

  constructor(config: SafetyConfig) {
    this.config = config;
    // 构建关键词正则表达式
    const keywords = config.dangerous_keywords.map(k => k.toUpperCase());
    this.keywordPattern = new RegExp(
      `\\b(${keywords.join('|')})\\b`,
      'i' // 不区分大小写
    );
  }

  /**
   * 检查 SQL 是否安全
   */
  check(sql: string): SafetyCheckResult {
    // 如果未启用危险操作确认，直接返回安全
    if (!this.config.confirm_dangerous) {
      return { safe: true };
    }

    // 查找匹配的危险关键词
    const match = sql.match(this.keywordPattern);

    if (!match) {
      return { safe: true };
    }

    const keyword = match[1].toUpperCase();
    const riskLevel = getRiskLevel(keyword) || 'medium';
    const riskDescription = getRiskDescription(keyword) || '可能存在风险的操作';

    return {
      safe: false,
      confirmation: {
        type: 'confirmation_required',
        sql,
        risk_level: riskLevel,
        risk_description: `此操作包含 ${keyword} 命令：${riskDescription}，请谨慎操作。`,
        suggestion: '请确认是否要执行此操作。如确认，请重新调用 query 工具并传入 confirm: true 参数。'
      }
    };
  }
}
```

- [ ] **Step 5: 运行测试确认通过**

```bash
npm run test
```

Expected: All tests pass

- [ ] **Step 6: 提交安全检查器**

```bash
git add src/safety/ tests/safety.test.ts
git commit -m "feat: add SQL safety guard"
```

---

## Task 6: 数据库适配器接口和 MySQL 适配器

**Files:**
- Create: `src/adapters/base.ts`
- Create: `src/adapters/mysql.ts`
- Create: `tests/adapters.test.ts`

- [ ] **Step 1: 创建适配器接口**

创建文件 `src/adapters/base.ts`:

```typescript
import type { DatabaseAdapter, QueryResult } from '../types/index.js';

/**
 * 数据库适配器基类
 * 提供通用功能，子类实现具体数据库操作
 */
export abstract class BaseAdapter implements DatabaseAdapter {
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract query(sql: string, maxRows?: number): Promise<QueryResult>;
  abstract listDatabases(): Promise<QueryResult>;
  abstract listTables(database?: string): Promise<QueryResult>;
  abstract describeTable(table: string, database?: string): Promise<QueryResult>;

  /**
   * 处理查询错误
   */
  protected handleError(error: unknown): QueryResult {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: message
    };
  }
}

/**
 * 适配器工厂函数类型
 */
export type AdapterFactory = (config: Record<string, unknown>) => DatabaseAdapter;
```

- [ ] **Step 2: 创建 MySQL 适配器**

创建文件 `src/adapters/mysql.ts`:

```typescript
import mysql, { Pool, PoolConnection, RowDataPacket, FieldPacket } from 'mysql2/promise';
import { BaseAdapter } from './base.js';
import type { QueryResult, ConnectionConfig } from '../types/index.js';
import { truncateRows } from '../formatter/markdown.js';

/**
 * MySQL 适配器配置
 */
export interface MySQLConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database?: string;
}

/**
 * MySQL 适配器实现
 */
export class MySQLAdapter extends BaseAdapter {
  private pool: Pool | null = null;
  private config: MySQLConfig;

  constructor(config: MySQLConfig) {
    super();
    this.config = config;
  }

  /**
   * 创建数据库连接池
   */
  async connect(): Promise<void> {
    this.pool = mysql.createPool({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      connectionLimit: 10,
      waitForConnections: true,
      queueLimit: 0
    });

    // 测试连接
    const conn = await this.pool.getConnection();
    await conn.ping();
    conn.release();
  }

  /**
   * 关闭连接池
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  /**
   * 执行 SQL 查询
   */
  async query(sql: string, maxRows: number = 100): Promise<QueryResult> {
    if (!this.pool) {
      return { success: false, error: 'Not connected to database' };
    }

    try {
      const [rows, fields] = await this.pool.execute<RowDataPacket[]>(sql);

      // 如果是结果集（SELECT 等）
      if (Array.isArray(rows)) {
        const columns = fields?.map(f => f.name) || [];
        const { data, truncated, totalRows } = truncateRows(rows, maxRows);

        return {
          success: true,
          data,
          columns,
          rowCount: data.length,
          truncated,
          totalRows
        };
      }

      // 如果是执行结果（INSERT/UPDATE/DELETE 等）
      const result = rows as unknown as { affectedRows?: number; insertId?: number };
      return {
        success: true,
        data: [{
          affectedRows: result.affectedRows || 0,
          insertId: result.insertId || 0
        }],
        columns: ['affectedRows', 'insertId'],
        rowCount: 1
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * 列出所有数据库
   */
  async listDatabases(): Promise<QueryResult> {
    return this.query('SHOW DATABASES');
  }

  /**
   * 列出所有表
   */
  async listTables(database?: string): Promise<QueryResult> {
    if (database) {
      return this.query(`SELECT TABLE_NAME, TABLE_TYPE, TABLE_COMMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA = '${database}'`);
    }
    return this.query('SHOW TABLES');
  }

  /**
   * 描述表结构
   */
  async describeTable(table: string, database?: string): Promise<QueryResult> {
    const tableName = database ? `${database}.${table}` : table;
    return this.query(`DESCRIBE ${tableName}`);
  }
}
```

- [ ] **Step 3: 创建适配器测试**

创建文件 `tests/adapters.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { MySQLAdapter } from '../src/adapters/mysql';
import { BaseAdapter } from '../src/adapters/base';

describe('Adapters', () => {
  describe('MySQLAdapter', () => {
    it('should create adapter instance', () => {
      const adapter = new MySQLAdapter({
        host: 'localhost',
        port: 2881,
        user: 'root',
        password: 'password'
      });
      expect(adapter).toBeInstanceOf(BaseAdapter);
    });

    it('should return error when not connected', async () => {
      const adapter = new MySQLAdapter({
        host: 'localhost',
        port: 2881,
        user: 'root',
        password: 'password'
      });
      const result = await adapter.query('SELECT 1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not connected to database');
    });
  });
});
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm run test
```

Expected: All tests pass

- [ ] **Step 5: 提交 MySQL 适配器**

```bash
git add src/adapters/ tests/adapters.test.ts
git commit -m "feat: add database adapter base and MySQL adapter"
```

---

## Task 7: Oracle 适配器

**Files:**
- Modify: `src/adapters/oracle.ts`
- Modify: `tests/adapters.test.ts`

- [ ] **Step 1: 创建 Oracle 适配器**

创建文件 `src/adapters/oracle.ts`:

```typescript
import oracledb, { Pool, Connection } from 'oracledb';
import { BaseAdapter } from './base.js';
import type { QueryResult } from '../types/index.js';
import { truncateRows } from '../formatter/markdown.js';

/**
 * Oracle 适配器配置
 */
export interface OracleConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  service: string;
}

/**
 * Oracle 适配器实现
 */
export class OracleAdapter extends BaseAdapter {
  private pool: Pool | null = null;
  private config: OracleConfig;

  constructor(config: OracleConfig) {
    super();
    this.config = config;
  }

  /**
   * 创建数据库连接池
   */
  async connect(): Promise<void> {
    const connectString = `${this.config.host}:${this.config.port}/${this.config.service}`;

    this.pool = await oracledb.createPool({
      user: this.config.user,
      password: this.config.password,
      connectString,
      poolMin: 2,
      poolMax: 10,
      poolIncrement: 1
    });

    // 测试连接
    const conn = await this.pool.getConnection();
    await conn.close();
  }

  /**
   * 关闭连接池
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
    }
  }

  /**
   * 执行 SQL 查询
   */
  async query(sql: string, maxRows: number = 100): Promise<QueryResult> {
    if (!this.pool) {
      return { success: false, error: 'Not connected to database' };
    }

    let conn: Connection | null = null;
    try {
      conn = await this.pool.getConnection();
      const result = await conn.execute(sql, [], {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        maxRows: maxRows === 0 ? undefined : maxRows
      });

      const rows = result.rows || [];

      // 获取列名
      let columns: string[] = [];
      if (result.metaData) {
        columns = result.metaData.map(m => m.name);
      } else if (rows.length > 0) {
        columns = Object.keys(rows[0] as Record<string, unknown>);
      }

      const { data, truncated, totalRows } = truncateRows(rows, maxRows);

      return {
        success: true,
        data,
        columns,
        rowCount: data.length,
        truncated,
        totalRows
      };
    } catch (error) {
      return this.handleError(error);
    } finally {
      if (conn) {
        await conn.close();
      }
    }
  }

  /**
   * 列出所有数据库 (Schema)
   */
  async listDatabases(): Promise<QueryResult> {
    return this.query('SELECT USERNAME FROM ALL_USERS ORDER BY USERNAME');
  }

  /**
   * 列出所有表
   */
  async listTables(database?: string): Promise<QueryResult> {
    if (database) {
      return this.query(
        `SELECT TABLE_NAME, 'TABLE' AS TABLE_TYPE, COMMENTS FROM ALL_TABLES LEFT JOIN ALL_TAB_COMMENTS ON ALL_TABLES.TABLE_NAME = ALL_TAB_COMMENTS.TABLE_NAME WHERE OWNER = '${database.toUpperCase()}'`
      );
    }
    return this.query(
      `SELECT TABLE_NAME, 'TABLE' AS TABLE_TYPE FROM USER_TABLES`
    );
  }

  /**
   * 描述表结构
   */
  async describeTable(table: string, database?: string): Promise<QueryResult> {
    const owner = database ? database.toUpperCase() : 'USER';
    return this.query(
      `SELECT COLUMN_NAME, DATA_TYPE, NULLABLE, DATA_DEFAULT FROM ALL_TAB_COLUMNS WHERE TABLE_NAME = '${table.toUpperCase()}' AND OWNER = '${owner}' ORDER BY COLUMN_ID`
    );
  }
}
```

- [ ] **Step 2: 更新适配器测试**

更新文件 `tests/adapters.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { MySQLAdapter } from '../src/adapters/mysql';
import { OracleAdapter } from '../src/adapters/oracle';
import { BaseAdapter } from '../src/adapters/base';

describe('Adapters', () => {
  describe('MySQLAdapter', () => {
    it('should create adapter instance', () => {
      const adapter = new MySQLAdapter({
        host: 'localhost',
        port: 2881,
        user: 'root',
        password: 'password'
      });
      expect(adapter).toBeInstanceOf(BaseAdapter);
    });

    it('should return error when not connected', async () => {
      const adapter = new MySQLAdapter({
        host: 'localhost',
        port: 2881,
        user: 'root',
        password: 'password'
      });
      const result = await adapter.query('SELECT 1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not connected to database');
    });
  });

  describe('OracleAdapter', () => {
    it('should create adapter instance', () => {
      const adapter = new OracleAdapter({
        host: 'localhost',
        port: 2883,
        user: 'system',
        password: 'password',
        service: 'ORCL'
      });
      expect(adapter).toBeInstanceOf(BaseAdapter);
    });

    it('should return error when not connected', async () => {
      const adapter = new OracleAdapter({
        host: 'localhost',
        port: 2883,
        user: 'system',
        password: 'password',
        service: 'ORCL'
      });
      const result = await adapter.query('SELECT 1 FROM DUAL');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not connected to database');
    });
  });
});
```

- [ ] **Step 3: 运行测试确认通过**

```bash
npm run test
```

Expected: All tests pass

- [ ] **Step 4: 提交 Oracle 适配器**

```bash
git add src/adapters/oracle.ts tests/adapters.test.ts
git commit -m "feat: add Oracle adapter"
```

---

## Task 8: MCP Tools 实现

**Files:**
- Create: `src/tools/query.ts`
- Create: `src/tools/listDatabases.ts`
- Create: `src/tools/listTables.ts`
- Create: `src/tools/describeTable.ts`
- Create: `src/tools/index.ts`

- [ ] **Step 1: 创建 query 工具**

创建文件 `src/tools/query.ts`:

```typescript
import type { DatabaseAdapter, QueryResult, ConfirmationRequired } from '../types/index.js';
import { SafetyGuard } from '../safety/guard.js';
import { formatAsMarkdownTable } from '../formatter/markdown.js';
import type { SafetyConfig, OutputConfig } from '../types/index.js';

/**
 * Query 工具参数
 */
export interface QueryParams {
  sql: string;
  max_rows?: number;
  confirm?: boolean;
}

/**
 * Query 工具返回类型
 */
export type QueryToolResult = { content: { type: string; text: string }[] };

/**
 * 创建 query 工具处理器
 */
export function createQueryTool(
  adapter: DatabaseAdapter,
  safetyConfig: SafetyConfig,
  outputConfig: OutputConfig
) {
  const guard = new SafetyGuard(safetyConfig);

  return {
    name: 'query',
    description: 'Execute SQL query on OceanBase database. Returns results as Markdown table. Dangerous operations (DROP, TRUNCATE, ALTER, DELETE) require confirmation.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        sql: {
          type: 'string',
          description: 'SQL query to execute'
        },
        max_rows: {
          type: 'number',
          description: 'Maximum number of rows to return (overrides config default)'
        },
        confirm: {
          type: 'boolean',
          description: 'Set to true to confirm execution of dangerous SQL'
        }
      },
      required: ['sql']
    },
    async handler(params: QueryParams): Promise<QueryToolResult> {
      const { sql, max_rows, confirm } = params;
      const actualMaxRows = max_rows ?? outputConfig.max_rows;

      // 安全检查
      const checkResult = guard.check(sql);

      if (!checkResult.safe && !confirm) {
        const confirmation = checkResult.confirmation!;
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(confirmation, null, 2)
          }]
        };
      }

      // 执行查询
      const result = await adapter.query(sql, actualMaxRows);
      const text = formatResult(result);

      return {
        content: [{
          type: 'text',
          text
        }]
      };
    }
  };
}

/**
 * 格式化查询结果
 */
function formatResult(result: QueryResult): string {
  if (!result.success) {
    return `Error: ${result.error}`;
  }

  if (!result.data || result.data.length === 0) {
    return 'Query executed successfully. No rows returned.';
  }

  let text = formatAsMarkdownTable(result.columns || [], result.data);

  if (result.truncated) {
    text += `\n\n*Result truncated. Showing ${result.rowCount} of ${result.totalRows} rows.*`;
  }

  return text;
}
```

- [ ] **Step 2: 创建 list_databases 工具**

创建文件 `src/tools/listDatabases.ts`:

```typescript
import type { DatabaseAdapter } from '../types/index.js';
import { formatAsMarkdownTable } from '../formatter/markdown.js';

/**
 * 创建 list_databases 工具处理器
 */
export function createListDatabasesTool(adapter: DatabaseAdapter) {
  return {
    name: 'list_databases',
    description: 'List all databases (MySQL mode) or schemas (Oracle mode) in the connected OceanBase instance.',
    inputSchema: {
      type: 'object' as const,
      properties: {}
    },
    async handler(): Promise<{ content: { type: string; text: string }[] }> {
      const result = await adapter.listDatabases();

      if (!result.success) {
        return {
          content: [{
            type: 'text',
            text: `Error: ${result.error}`
          }]
        };
      }

      const text = formatAsMarkdownTable(result.columns || [], result.data || []);
      return {
        content: [{
          type: 'text',
          text
        }]
      };
    }
  };
}
```

- [ ] **Step 3: 创建 list_tables 工具**

创建文件 `src/tools/listTables.ts`:

```typescript
import type { DatabaseAdapter } from '../types/index.js';
import { formatAsMarkdownTable } from '../formatter/markdown.js';

/**
 * List tables 工具参数
 */
export interface ListTablesParams {
  database?: string;
}

/**
 * 创建 list_tables 工具处理器
 */
export function createListTablesTool(adapter: DatabaseAdapter) {
  return {
    name: 'list_tables',
    description: 'List all tables in the current or specified database.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        database: {
          type: 'string',
          description: 'Database name (optional, uses current database if not specified)'
        }
      }
    },
    async handler(params: ListTablesParams): Promise<{ content: { type: string; text: string }[] }> {
      const result = await adapter.listTables(params.database);

      if (!result.success) {
        return {
          content: [{
            type: 'text',
            text: `Error: ${result.error}`
          }]
        };
      }

      const text = formatAsMarkdownTable(result.columns || [], result.data || []);
      return {
        content: [{
          type: 'text',
          text
        }]
      };
    }
  };
}
```

- [ ] **Step 4: 创建 describe_table 工具**

创建文件 `src/tools/describeTable.ts`:

```typescript
import type { DatabaseAdapter } from '../types/index.js';
import { formatAsMarkdownTable } from '../formatter/markdown.js';

/**
 * Describe table 工具参数
 */
export interface DescribeTableParams {
  table: string;
  database?: string;
}

/**
 * 创建 describe_table 工具处理器
 */
export function createDescribeTableTool(adapter: DatabaseAdapter) {
  return {
    name: 'describe_table',
    description: 'Describe the structure of a specified table, including column names, types, and constraints.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        table: {
          type: 'string',
          description: 'Table name to describe'
        },
        database: {
          type: 'string',
          description: 'Database name (optional, uses current database if not specified)'
        }
      },
      required: ['table']
    },
    async handler(params: DescribeTableParams): Promise<{ content: { type: string; text: string }[] }> {
      const result = await adapter.describeTable(params.table, params.database);

      if (!result.success) {
        return {
          content: [{
            type: 'text',
            text: `Error: ${result.error}`
          }]
        };
      }

      const text = formatAsMarkdownTable(result.columns || [], result.data || []);
      return {
        content: [{
          type: 'text',
          text
        }]
      };
    }
  };
}
```

- [ ] **Step 5: 创建工具索引**

创建文件 `src/tools/index.ts`:

```typescript
import type { DatabaseAdapter, SafetyConfig, OutputConfig } from '../types/index.js';
import { createQueryTool } from './query.js';
import { createListDatabasesTool } from './listDatabases.js';
import { createListTablesTool } from './listTables.js';
import { createDescribeTableTool } from './describeTable.js';

/**
 * 创建所有工具
 */
export function createTools(
  adapter: DatabaseAdapter,
  safetyConfig: SafetyConfig,
  outputConfig: OutputConfig
) {
  return [
    createQueryTool(adapter, safetyConfig, outputConfig),
    createListDatabasesTool(adapter),
    createListTablesTool(adapter),
    createDescribeTableTool(adapter)
  ];
}

export { createQueryTool } from './query.js';
export { createListDatabasesTool } from './listDatabases.js';
export { createListTablesTool } from './listTables.js';
export { createDescribeTableTool } from './describeTable.js';
```

- [ ] **Step 6: 提交工具实现**

```bash
git add src/tools/
git commit -m "feat: implement MCP tools"
```

---

## Task 9: MCP 服务器入口

**Files:**
- Create: `src/index.ts`
- Create: `example/config.yaml`

- [ ] **Step 1: 创建 MCP 服务器入口**

创建文件 `src/index.ts`:

```typescript
#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config/loader.js';
import { MySQLAdapter } from './adapters/mysql.js';
import { OracleAdapter } from './adapters/oracle.js';
import type { DatabaseAdapter } from './types/index.js';
import { createTools } from './tools/index.js';
import { DEFAULT_SAFETY_CONFIG, DEFAULT_OUTPUT_CONFIG } from './types/index.js';

/**
 * 解析命令行参数
 */
function parseArgs(): { configPath: string } {
  const args = process.argv.slice(2);
  let configPath = './config.yaml';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config' || args[i] === '-c') {
      configPath = args[i + 1];
      i++;
    }
  }

  return { configPath };
}

/**
 * 创建数据库适配器
 */
async function createAdapter(config: ReturnType<typeof loadConfig>): Promise<DatabaseAdapter> {
  const { connection } = config;

  if (connection.mode === 'mysql') {
    const adapter = new MySQLAdapter({
      host: connection.host,
      port: connection.port,
      user: connection.user,
      password: connection.password,
      database: connection.database
    });
    return adapter;
  } else {
    if (!connection.service) {
      throw new Error('Oracle mode requires "service" to be specified in connection config');
    }
    const adapter = new OracleAdapter({
      host: connection.host,
      port: connection.port,
      user: connection.user,
      password: connection.password,
      service: connection.service
    });
    return adapter;
  }
}

/**
 * 重试连接
 */
async function connectWithRetry(adapter: DatabaseAdapter, maxRetries = 3, delayMs = 2000): Promise<void> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      await adapter.connect();
      console.error(`Connected to database successfully`);
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Connection attempt ${i + 1}/${maxRetries} failed: ${lastError.message}`);

      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw new Error(`Failed to connect after ${maxRetries} attempts. Last error: ${lastError?.message}`);
}

/**
 * 主函数
 */
async function main() {
  try {
    // 解析命令行参数
    const { configPath } = parseArgs();
    console.error(`Loading config from: ${configPath}`);

    // 加载配置
    const config = loadConfig(configPath);
    console.error(`Database mode: ${config.connection.mode}`);

    // 创建适配器
    const adapter = await createAdapter(config);

    // 连接数据库（带重试）
    await connectWithRetry(adapter);

    // 获取安全配置
    const safetyConfig = config.safety ?? DEFAULT_SAFETY_CONFIG;
    const outputConfig = config.output ?? DEFAULT_OUTPUT_CONFIG;

    // 创建 MCP 服务器
    const server = new McpServer({
      name: 'oceanbase-mcp',
      version: '1.0.0'
    });

    // 注册工具
    const tools = createTools(adapter, safetyConfig, outputConfig);

    for (const tool of tools) {
      server.tool(
        tool.name,
        tool.description,
        tool.inputSchema,
        async (params: Record<string, unknown>) => {
          return tool.handler(params);
        }
      );
    }

    // 启动服务器
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error('OceanBase MCP server started');

    // 优雅关闭
    process.on('SIGINT', async () => {
      console.error('Shutting down...');
      await adapter.disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.error('Shutting down...');
      await adapter.disconnect();
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
```

- [ ] **Step 2: 创建配置示例文件**

创建文件 `example/config.yaml`:

```yaml
# OceanBase MCP Server Configuration Example

connection:
  mode: mysql              # mysql | oracle（连接协议模式，不是数据库内部兼容模式）
  host: localhost
  port: 2881               # MySQL 协议端口：2881（原生）或 2883（代理）
                           # Oracle 协议端口：2881（原生）
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
```

- [ ] **Step 3: 提交入口文件**

```bash
git add src/index.ts example/config.yaml
git commit -m "feat: add MCP server entry point"
```

---

## Task 10: 构建和最终测试

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: 创建 vitest 配置**

创建文件 `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node'
  }
});
```

- [ ] **Step 2: 运行所有测试**

```bash
npm run test
```

Expected: All tests pass

- [ ] **Step 3: 构建项目**

```bash
npm run build
```

Expected: Build succeeds, `dist/` directory created

- [ ] **Step 4: 验证构建产物**

```bash
ls -la dist/
```

Expected: `index.js` and type definitions present

- [ ] **Step 5: 提交最终代码**

```bash
git add .
git commit -m "chore: finalize build configuration"
```

- [ ] **Step 6: 创建 git tag**

```bash
git tag v1.0.0
```

---

## Checklist

完成后确认：

- [ ] 所有测试通过 (`npm run test`)
- [ ] 构建成功 (`npm run build`)
- [ ] 可以通过 `tsx src/index.ts --config example/config.yaml` 运行
- [ ] README.md 包含使用说明
- [ ] 示例配置文件 `example/config.yaml` 存在
