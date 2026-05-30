import type { DatabaseAdapter, QueryResult } from '../types/index.js';

/**
 * 数据库适配器基类
 * 提供通用功能，子类实现具体数据库操作
 */
export abstract class BaseAdapter implements DatabaseAdapter {
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract query(sql: string, maxRows?: number): Promise<QueryResult>;
  abstract listDatabases(): Promise<QueryResult>;
  abstract listTables(database?: string): Promise<QueryResult>;
  abstract describeTable(table: string, database?: string): Promise<QueryResult>;

  /**
   * 处理查询错误
   */
  protected handleError(error: unknown): QueryResult {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: message
    };
  }
}

/**
 * 适配器工厂函数类型
 */
export type AdapterFactory = (config: Record<string, unknown>) => DatabaseAdapter;