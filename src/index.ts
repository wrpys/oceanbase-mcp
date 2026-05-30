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