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
