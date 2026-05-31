#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { loadConfig } from './config/loader.js';
import { MySQLAdapter } from './adapters/mysql.js';
import { OracleAdapter } from './adapters/oracle.js';
import type { DatabaseAdapter, SafetyConfig, OutputConfig } from './types/index.js';
import { DEFAULT_SAFETY_CONFIG, DEFAULT_OUTPUT_CONFIG } from './types/index.js';
import { SafetyGuard } from './safety/guard.js';
import { formatAsMarkdownTable } from './formatter/markdown.js';
import type { QueryResult } from './types/index.js';

/**
 * 主键缓存
 */
const primaryKeyCache: Map<string, string> = new Map();

/**
 * 获取表的主键列名
 */
async function getPrimaryKey(adapter: DatabaseAdapter, table: string, database?: string): Promise<string | null> {
  const cacheKey = database ? `${database}.${table}` : table;

  if (primaryKeyCache.has(cacheKey)) {
    return primaryKeyCache.get(cacheKey)!;
  }

  // Oracle 模式查询主键
  const oracleSql = `SELECT cols.column_name FROM user_constraints cons, user_cons_columns cols WHERE cons.constraint_type = 'P' AND cons.table_name = '${table.toUpperCase()}' AND cons.constraint_name = cols.constraint_name`;

  // MySQL 模式查询主键
  const mysqlSql = `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_NAME = '${table}' AND CONSTRAINT_NAME = 'PRIMARY'`;

  // 尝试 Oracle 语法
  let result = await adapter.query(oracleSql, 1);

  // 如果 Oracle 查询失败，尝试 MySQL 语法
  if (!result.success || !result.data || result.data.length === 0) {
    result = await adapter.query(mysqlSql, 1);
  }

  if (result.success && result.data && result.data.length > 0) {
    const row = result.data[0] as Record<string, unknown>;
    const primaryKey = (row.COLUMN_NAME || row.column_name) as string;
    primaryKeyCache.set(cacheKey, primaryKey);
    return primaryKey;
  }

  return null;
}

/**
 * 转义 SQL 值
 */
function escapeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  if (typeof value === 'string') {
    // 转义单引号
    const escaped = value.replace(/'/g, "''");
    return `'${escaped}'`;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }

  if (value instanceof Date) {
    return `'${value.toISOString()}'`;
  }

  // 对象转 JSON
  if (typeof value === 'object') {
    const escaped = JSON.stringify(value).replace(/'/g, "''");
    return `'${escaped}'`;
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * 构建 INSERT SQL
 */
function buildInsertSQL(table: string, data: Record<string, unknown> | Record<string, unknown>[]): string {
  const dataArray = Array.isArray(data) ? data : [data];

  if (dataArray.length === 0) {
    throw new Error('No data provided for insert');
  }

  // 获取所有列名（使用第一条数据的列）
  const columns = Object.keys(dataArray[0]);

  // 构建值部分
  const valuesList = dataArray.map(row => {
    const values = columns.map(col => escapeValue(row[col]));
    return `(${values.join(', ')})`;
  });

  // 转义表名
  const escapedTable = table.replace(/`/g, '``');

  return `INSERT INTO \`${escapedTable}\` (${columns.map(c => `\`${c.replace(/`/g, '``')}\``).join(', ')}) VALUES ${valuesList.join(', ')}`;
}

/**
 * 构建 DELETE SQL
 */
function buildDeleteSQL(table: string, where?: string, id?: string | number, ids?: (string | number)[], primaryKey?: string): string {
  const escapedTable = table.replace(/`/g, '``');

  let whereClause = '';

  if (id !== undefined && primaryKey) {
    whereClause = `\`${primaryKey}\` = ${escapeValue(id)}`;
  } else if (ids && ids.length > 0 && primaryKey) {
    const values = ids.map(v => escapeValue(v)).join(', ');
    whereClause = `\`${primaryKey}\` IN (${values})`;
  } else if (where) {
    whereClause = where;
  } else {
    throw new Error('DELETE requires either where condition or id/ids with primary key');
  }

  return `DELETE FROM \`${escapedTable}\` WHERE ${whereClause}`;
}

/**
 * 构建 UPDATE SQL
 */
function buildUpdateSQL(table: string, data: Record<string, unknown>, where?: string, id?: string | number, primaryKey?: string): string {
  const escapedTable = table.replace(/`/g, '``');

  // 构建 SET 部分
  const setParts = Object.entries(data).map(([col, val]) => {
    const escapedCol = col.replace(/`/g, '``');
    return `\`${escapedCol}\` = ${escapeValue(val)}`;
  });

  let whereClause = '';

  if (id !== undefined && primaryKey) {
    whereClause = `\`${primaryKey}\` = ${escapeValue(id)}`;
  } else if (where) {
    whereClause = where;
  } else {
    throw new Error('UPDATE requires either where condition or id with primary key');
  }

  return `UPDATE \`${escapedTable}\` SET ${setParts.join(', ')} WHERE ${whereClause}`;
}

/**
 * 格式化确认提示
 */
function formatDMLConfirmation(
  operation: 'INSERT' | 'DELETE' | 'UPDATE',
  sql: string,
  table: string,
  rowCount: number,
  extra?: {
    dataPreview?: Record<string, unknown>[];
    whereClause?: string;
    changes?: Record<string, { old: unknown; new: unknown }>;
    riskLevel?: string;
    riskDescription?: string;
  }
): string {
  const confirmation: Record<string, unknown> = {
    type: 'confirmation_required',
    sql,
    operation,
    table,
    row_count: rowCount,
    suggestion: `请确认是否要执行此操作。如确认，请重新调用 ${operation.toLowerCase()} 工具并传入 confirm: true 参数。`
  };

  if (extra?.dataPreview) {
    confirmation.data_preview = extra.dataPreview;
  }

  if (extra?.whereClause) {
    confirmation.where_clause = extra.whereClause;
  }

  if (extra?.changes) {
    confirmation.changes = extra.changes;
  }

  if (extra?.riskLevel) {
    confirmation.risk_level = extra.riskLevel;
    confirmation.risk_description = extra.riskDescription;
  }

  return JSON.stringify(confirmation, null, 2);
}

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

/**
 * 注册工具
 */
function registerTools(
  server: McpServer,
  adapter: DatabaseAdapter,
  safetyConfig: SafetyConfig,
  outputConfig: OutputConfig
) {
  const guard = new SafetyGuard(safetyConfig);

  // Query tool
  server.tool(
    'query',
    'Execute SQL query on OceanBase database. Returns results as Markdown table. Dangerous operations (DROP, TRUNCATE, ALTER, DELETE) require confirmation.',
    {
      sql: z.string().describe('SQL query to execute'),
      max_rows: z.number().optional().describe('Maximum number of rows to return (overrides config default)'),
      confirm: z.boolean().optional().describe('Set to true to confirm execution of dangerous SQL')
    },
    async (params: { sql: string; max_rows?: number; confirm?: boolean }) => {
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
  );

  // List databases tool
  server.tool(
    'list_databases',
    'List all databases (MySQL mode) or schemas (Oracle mode) in the connected OceanBase instance.',
    {},
    async () => {
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
  );

  // List tables tool
  server.tool(
    'list_tables',
    'List all tables in the current or specified database.',
    {
      database: z.string().optional().describe('Database name (optional, uses current database if not specified)')
    },
    async (params: { database?: string }) => {
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
  );

  // Describe table tool
  server.tool(
    'describe_table',
    'Describe the structure of a specified table, including column names, types, and constraints.',
    {
      table: z.string().describe('Table name to describe'),
      database: z.string().optional().describe('Database name (optional, uses current database if not specified)')
    },
    async (params: { table: string; database?: string }) => {
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
  );

  // Insert tool
  server.tool(
    'insert',
    'Insert data into a table. Supports single row or batch insert. Requires confirmation before execution.',
    {
      table: z.string().describe('Table name to insert into'),
      data: z.union([
        z.record(z.string(), z.unknown()).describe('Single row: { column: value }'),
        z.array(z.record(z.string(), z.unknown())).describe('Multiple rows: [{ column: value }, ...]')
      ]).describe('Data to insert'),
      database: z.string().optional().describe('Database name (optional)'),
      confirm: z.boolean().optional().describe('Set to true to confirm and execute')
    },
    async (params: { table: string; data: Record<string, unknown> | Record<string, unknown>[]; database?: string; confirm?: boolean }) => {
      const { table, data, confirm } = params;

      try {
        const dataArray = Array.isArray(data) ? data : [data];
        const sql = buildInsertSQL(table, data);

        // 未确认时返回预览
        if (!confirm) {
          const preview = dataArray.slice(0, 5);
          const text = formatDMLConfirmation('INSERT', sql, table, dataArray.length, {
            dataPreview: preview
          });
          return {
            content: [{
              type: 'text',
              text
            }]
          };
        }

        // 执行插入
        const result = await adapter.query(sql);

        if (!result.success) {
          return {
            content: [{
              type: 'text',
              text: `Error: ${result.error}`
            }]
          };
        }

        return {
          content: [{
            type: 'text',
            text: `Insert successful. Rows affected: ${result.rowCount || dataArray.length}`
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );

  // Delete tool
  server.tool(
    'delete',
    'Delete data from a table. Supports primary key deletion (id/ids) or condition deletion (where). Requires confirmation before execution.',
    {
      table: z.string().describe('Table name to delete from'),
      where: z.string().optional().describe('WHERE condition (mutually exclusive with id/ids)'),
      id: z.union([z.string(), z.number()]).optional().describe('Primary key value for single row deletion'),
      ids: z.array(z.union([z.string(), z.number()])).optional().describe('Primary key values for batch deletion'),
      database: z.string().optional().describe('Database name (optional)'),
      confirm: z.boolean().optional().describe('Set to true to confirm and execute')
    },
    async (params: { table: string; where?: string; id?: string | number; ids?: (string | number)[]; database?: string; confirm?: boolean }) => {
      const { table, where, id, ids, confirm } = params;

      try {
        // 参数冲突检查
        if ((where && (id || ids)) || (id && ids)) {
          return {
            content: [{
              type: 'text',
              text: 'Error: Cannot use both \'where\' and \'id\'/\'ids\' parameters, or both \'id\' and \'ids\''
            }]
          };
        }

        // 获取主键（如果使用 id/ids）
        let primaryKey: string | null = null;
        if (id !== undefined || (ids && ids.length > 0)) {
          primaryKey = await getPrimaryKey(adapter, table);
          if (!primaryKey) {
            return {
              content: [{
                type: 'text',
                text: `Error: No primary key found for table '${table}'. Use 'where' parameter instead.`
              }]
            };
          }
        }

        const sql = buildDeleteSQL(table, where, id, ids, primaryKey!);

        // 计算预估行数
        let estimatedRows = 1;
        if (ids && ids.length > 0) {
          estimatedRows = ids.length;
        } else if (where) {
          // 查询预估行数
          const countSql = `SELECT COUNT(*) AS cnt FROM \`${table.replace(/`/g, '``')}\` WHERE ${where}`;
          const countResult = await adapter.query(countSql);
          if (countResult.success && countResult.data && countResult.data.length > 0) {
            const row = countResult.data[0] as Record<string, unknown>;
            estimatedRows = (row.cnt || row.CNT) as number;
          }
        }

        // 未确认时返回预览
        if (!confirm) {
          const whereClause = id !== undefined ? `${primaryKey} = ${escapeValue(id)}`
            : ids && ids.length > 0 ? `${primaryKey} IN (${ids.map(v => escapeValue(v)).join(', ')})`
            : where || '';

          const text = formatDMLConfirmation('DELETE', sql, table, estimatedRows, {
            whereClause,
            riskLevel: 'high',
            riskDescription: '删除数据，可能影响业务'
          });
          return {
            content: [{
              type: 'text',
              text
            }]
          };
        }

        // 执行删除
        const result = await adapter.query(sql);

        if (!result.success) {
          return {
            content: [{
              type: 'text',
              text: `Error: ${result.error}`
            }]
          };
        }

        return {
          content: [{
            type: 'text',
            text: `Delete successful. Rows affected: ${result.rowCount || 0}`
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );

  // Update tool
  server.tool(
    'update',
    'Update data in a table. Supports primary key update (id) or condition update (where). Shows change comparison before confirmation.',
    {
      table: z.string().describe('Table name to update'),
      data: z.record(z.string(), z.unknown()).describe('Column values to update: { column: new_value }'),
      where: z.string().optional().describe('WHERE condition (mutually exclusive with id)'),
      id: z.union([z.string(), z.number()]).optional().describe('Primary key value for single row update'),
      database: z.string().optional().describe('Database name (optional)'),
      confirm: z.boolean().optional().describe('Set to true to confirm and execute')
    },
    async (params: { table: string; data: Record<string, unknown>; where?: string; id?: string | number; database?: string; confirm?: boolean }) => {
      const { table, data, where, id, confirm } = params;

      try {
        // 参数冲突检查
        if (where && id !== undefined) {
          return {
            content: [{
              type: 'text',
              text: 'Error: Cannot use both \'where\' and \'id\' parameters'
            }]
          };
        }

        // 获取主键（如果使用 id）
        let primaryKey: string | null = null;
        let whereClause = '';

        if (id !== undefined) {
          primaryKey = await getPrimaryKey(adapter, table);
          if (!primaryKey) {
            return {
              content: [{
                type: 'text',
                text: `Error: No primary key found for table '${table}'. Use 'where' parameter instead.`
              }]
            };
          }
          whereClause = `${primaryKey} = ${escapeValue(id)}`;
        } else if (where) {
          whereClause = where;
        } else {
          return {
            content: [{
              type: 'text',
              text: 'Error: Either \'where\' or \'id\' parameter is required'
            }]
          };
        }

        const sql = buildUpdateSQL(table, data, where, id, primaryKey!);

        // 查询当前数据用于变更对比
        const escapedTable = table.replace(/`/g, '``');
        const currentDataSql = `SELECT * FROM \`${escapedTable}\` WHERE ${whereClause}`;
        const currentResult = await adapter.query(currentDataSql, 1);

        // 未确认时返回预览（包含变更对比）
        if (!confirm) {
          let changes: Record<string, { old: unknown; new: unknown }> = {};
          let rowCount = 1;

          if (currentResult.success && currentResult.data && currentResult.data.length > 0) {
            const currentRow = currentResult.data[0] as Record<string, unknown>;

            // 构建变更对比
            for (const [col, newVal] of Object.entries(data)) {
              const oldVal = currentRow[col];
              changes[col] = { old: oldVal ?? 'NULL', new: newVal };
            }

            rowCount = currentResult.data.length;
          } else {
            // 无法获取当前数据时，只显示新值
            for (const [col, newVal] of Object.entries(data)) {
              changes[col] = { old: '(unknown)', new: newVal };
            }

            // 查询预估行数
            const countSql = `SELECT COUNT(*) AS cnt FROM \`${escapedTable}\` WHERE ${whereClause}`;
            const countResult = await adapter.query(countSql);
            if (countResult.success && countResult.data && countResult.data.length > 0) {
              const row = countResult.data[0] as Record<string, unknown>;
              rowCount = (row.cnt || row.CNT) as number;
            }
          }

          const text = formatDMLConfirmation('UPDATE', sql, table, rowCount, {
            whereClause,
            changes
          });
          return {
            content: [{
              type: 'text',
              text
            }]
          };
        }

        // 执行更新
        const result = await adapter.query(sql);

        if (!result.success) {
          return {
            content: [{
              type: 'text',
              text: `Error: ${result.error}`
            }]
          };
        }

        return {
          content: [{
            type: 'text',
            text: `Update successful. Rows affected: ${result.rowCount || 0}`
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );
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
    registerTools(server, adapter, safetyConfig, outputConfig);

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