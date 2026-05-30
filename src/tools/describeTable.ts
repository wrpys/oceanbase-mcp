import { z } from 'zod';
import type { DatabaseAdapter } from '../types/index.js';
import { formatAsMarkdownTable } from '../formatter/markdown.js';

/**
 * Describe table 工具参数 Schema
 */
export const DescribeTableParamsSchema = z.object({
  table: z.string().describe('Table name to describe'),
  database: z.string().optional().describe('Database name (optional, uses current database if not specified)')
});

/**
 * 创建 describe_table 工具处理器
 */
export function createDescribeTableTool(adapter: DatabaseAdapter) {
  return {
    name: 'describe_table',
    description: 'Describe the structure of a specified table, including column names, types, and constraints.',
    inputSchema: DescribeTableParamsSchema,
    async handler(params: z.infer<typeof DescribeTableParamsSchema>): Promise<{ content: { type: string; text: string }[] }> {
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