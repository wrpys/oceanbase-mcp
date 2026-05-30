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