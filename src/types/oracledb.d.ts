declare module 'oracledb' {
  interface Pool {
    getConnection(): Promise<Connection>;
    close(): Promise<void>;
  }

  interface Connection {
    execute<T = unknown>(sql: string, binds?: unknown[], options?: ExecuteOptions): Promise<ExecuteResult<T>>;
    close(): Promise<void>;
  }

  interface ExecuteOptions {
    outFormat?: number;
    maxRows?: number;
  }

  interface MetaData {
    name: string;
  }

  interface ExecuteResult<T = unknown> {
    rows?: T[];
    metaData?: MetaData[];
  }

  interface PoolAttributes {
    user: string;
    password: string;
    connectString: string;
    poolMin?: number;
    poolMax?: number;
    poolIncrement?: number;
  }

  const OUT_FORMAT_OBJECT: number;

  function createPool(attributes: PoolAttributes): Promise<Pool>;

  export { Pool, Connection, ExecuteResult, PoolAttributes, OUT_FORMAT_OBJECT, createPool };
  export default { createPool, OUT_FORMAT_OBJECT };
}