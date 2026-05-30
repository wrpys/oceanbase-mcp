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
