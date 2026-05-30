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
