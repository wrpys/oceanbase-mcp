import oracledb, { Pool, Connection } from 'oracledb';
import { BaseAdapter } from './base.js';
import type { QueryResult } from '../types/index.js';
import { truncateRows } from '../formatter/markdown.js';

/**
 * Oracle 适配器配置
 */
export interface OracleConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  service: string;
}

/**
 * Oracle 适配器实现
 */
export class OracleAdapter extends BaseAdapter {
  private pool: Pool | null = null;
  private config: OracleConfig;

  constructor(config: OracleConfig) {
    super();
    this.config = config;
  }

  /**
   * 创建数据库连接池
   */
  async connect(): Promise<void> {
    const connectString = `${this.config.host}:${this.config.port}/${this.config.service}`;

    this.pool = await oracledb.createPool({
      user: this.config.user,
      password: this.config.password,
      connectString,
      poolMin: 2,
      poolMax: 10,
      poolIncrement: 1
    });

    // 测试连接
    const conn = await this.pool.getConnection();
    await conn.close();
  }

  /**
   * 关闭连接池
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
    }
  }

  /**
   * 执行 SQL 查询
   */
  async query(sql: string, maxRows: number = 100): Promise<QueryResult> {
    if (!this.pool) {
      return { success: false, error: 'Not connected to database' };
    }

    let conn: Connection | null = null;
    try {
      conn = await this.pool.getConnection();
      const result = await conn.execute(sql, [], {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        maxRows: maxRows === 0 ? undefined : maxRows
      });

      const rows = result.rows || [];

      // 获取列名
      let columns: string[] = [];
      if (result.metaData) {
        columns = result.metaData.map(m => m.name);
      } else if (rows.length > 0) {
        columns = Object.keys(rows[0] as Record<string, unknown>);
      }

      const { data, truncated, totalRows } = truncateRows(rows, maxRows);

      return {
        success: true,
        data,
        columns,
        rowCount: data.length,
        truncated,
        totalRows
      };
    } catch (error) {
      return this.handleError(error);
    } finally {
      if (conn) {
        await conn.close();
      }
    }
  }

  /**
   * 列出所有数据库 (Schema)
   */
  async listDatabases(): Promise<QueryResult> {
    return this.query('SELECT USERNAME FROM ALL_USERS ORDER BY USERNAME');
  }

  /**
   * 列出所有表
   */
  async listTables(database?: string): Promise<QueryResult> {
    if (database) {
      return this.query(
        `SELECT TABLE_NAME, 'TABLE' AS TABLE_TYPE, COMMENTS FROM ALL_TABLES LEFT JOIN ALL_TAB_COMMENTS ON ALL_TABLES.TABLE_NAME = ALL_TAB_COMMENTS.TABLE_NAME WHERE OWNER = '${database.toUpperCase()}'`
      );
    }
    return this.query(
      `SELECT TABLE_NAME, 'TABLE' AS TABLE_TYPE FROM USER_TABLES`
    );
  }

  /**
   * 描述表结构
   */
  async describeTable(table: string, database?: string): Promise<QueryResult> {
    const owner = database ? database.toUpperCase() : 'USER';
    return this.query(
      `SELECT COLUMN_NAME, DATA_TYPE, NULLABLE, DATA_DEFAULT FROM ALL_TAB_COLUMNS WHERE TABLE_NAME = '${table.toUpperCase()}' AND OWNER = '${owner}' ORDER BY COLUMN_ID`
    );
  }
}