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
