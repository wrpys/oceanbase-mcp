import mysql, { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { BaseAdapter } from './base.js';
import type { QueryResult } from '../types/index.js';
import { truncateRows } from '../formatter/markdown.js';

/**
 * MySQL 适配器配置
 */
export interface MySQLConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database?: string;
}

/**
 * MySQL 适配器实现
 */
export class MySQLAdapter extends BaseAdapter {
  private pool: Pool | null = null;
  private config: MySQLConfig;

  constructor(config: MySQLConfig) {
    super();
    this.config = config;
  }

  /**
   * 创建数据库连接池
   */
  async connect(): Promise<void> {
    this.pool = mysql.createPool({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      connectionLimit: 10,
      waitForConnections: true,
      queueLimit: 0
    });

    // 测试连接
    const conn = await this.pool.getConnection();
    await conn.ping();
    conn.release();
  }

  /**
   * 关闭连接池
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
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

    try {
      const [rows, fields] = await this.pool.execute<RowDataPacket[] | ResultSetHeader>(sql);

      // 如果是结果集（SELECT 等）
      if (Array.isArray(rows)) {
        const columns = fields?.map((f: { name: string }) => f.name) || [];
        const { data, truncated, totalRows } = truncateRows(rows, maxRows);

        return {
          success: true,
          data,
          columns,
          rowCount: data.length,
          truncated,
          totalRows
        };
      }

      // 如果是执行结果（INSERT/UPDATE/DELETE 等）
      const result = rows as ResultSetHeader;

      // 对于 DML 操作，显式提交事务以确保 OceanBase Oracle 模式下更改持久化
      if (result.affectedRows !== undefined) {
        await this.pool.execute('COMMIT');
      }

      return {
        success: true,
        data: [{
          affectedRows: result.affectedRows,
          insertId: result.insertId
        }],
        columns: ['affectedRows', 'insertId'],
        rowCount: 1
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * 列出所有数据库
   */
  async listDatabases(): Promise<QueryResult> {
    return this.query('SHOW DATABASES');
  }

  /**
   * 列出所有表
   */
  async listTables(database?: string): Promise<QueryResult> {
    if (database) {
      // Escape database name with backticks to prevent SQL injection
      const escapedDb = database.replace(/`/g, '``');
      return this.query(
        `SELECT TABLE_NAME, TABLE_TYPE, TABLE_COMMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA = '${escapedDb}'`
      );
    }
    return this.query('SHOW TABLES');
  }

  /**
   * 描述表结构
   */
  async describeTable(table: string, database?: string): Promise<QueryResult> {
    // Escape identifiers with backticks to prevent SQL injection
    const escapedTable = table.replace(/`/g, '``');
    const tableName = database
      ? `\`${database.replace(/`/g, '``')}\`.\`${escapedTable}\``
      : `\`${escapedTable}\``;
    return this.query(`DESCRIBE ${tableName}`);
  }
}