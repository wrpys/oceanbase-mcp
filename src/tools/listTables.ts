import { z } from 'zod';
import type { DatabaseAdapter } from '../types/index.js';
import { formatAsMarkdownTable } from '../formatter/markdown.js';

/**
 * List tables 工具参数 Schema
 */
export const ListTablesParamsSchema = z.object({
  database: z.string().optional().describe('Database name (optional, uses current database if not specified)')
});

/**
 * 创建 list_tables 工具处理器
 */
export function createListTablesTool(adapter: DatabaseAdapter) {
  return {
    name: 'list_tables',
    description: 'List all tables in the current or specified database.',
    inputSchema: ListTablesParamsSchema,
    async handler(params: z.infer<typeof ListTablesParamsSchema>): Promise<{ content: { type: string; text: string }[] }> {
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