/**
 * 数据库连接模式
 *
 * 注意：这是连接协议模式，不是数据库内部兼容模式
 * - mysql: 使用 MySQL 协议连接（mysql2 驱动），支持端口 2881 或 2883
 *   - 适用于 OceanBase MySQL 兼容模式
 *   - 也适用于 OceanBase Oracle 兼容模式通过 MySQL 协议端口（2883）访问
 *   - 推荐方式，无需安装额外依赖
 * - oracle: 使用原生 Oracle 协议连接（oracledb 驱动），仅支持端口 2881
 *   - 仅适用于 OceanBase Oracle 兼容模式
 *   - 需要安装 Oracle Instant Client
 *   - 需要配置 service 参数
 *
 * OceanBase Oracle 兼容模式可通过两种方式访问：
 * 1. MySQL 协议端口（2883）：设置 mode='mysql'，SQL 需兼容 Oracle 语法
 * 2. 原生 Oracle 协议（2881）：设置 mode='oracle'
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
