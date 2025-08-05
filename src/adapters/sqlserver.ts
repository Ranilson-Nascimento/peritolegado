import sql, { ConnectionPool } from 'mssql';
import { config } from '../config';
import { DatabaseAdapter } from './types';

/**
 * SQL Server adapter using the mssql library. It handles both local and cloud
 * connections. Encryption can be configured via environment variables if needed.
 */
export class SQLServerAdapter implements DatabaseAdapter<ConnectionPool> {
  private pool: ConnectionPool | null = null;

  async connect(): Promise<ConnectionPool> {
    this.pool = await sql.connect({
      user: config.sqlserver.user,
      password: config.sqlserver.password,
      server: config.sqlserver.server,
      database: config.sqlserver.database,
      options: {
        encrypt: true, // default encryption; may be disabled locally
        trustServerCertificate: true, // allow self‑signed certificates
      },
    });
    return this.pool;
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
    }
  }

  async testConnection(): Promise<void> {
    const pool = this.pool ?? (await this.connect());
    const result = await pool.request().query('SELECT 1 AS result');
    console.log('SQL Server test result:', result.recordset);
    if (!this.pool) {
      await pool.close();
    }
  }
}