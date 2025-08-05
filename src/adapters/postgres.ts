import { Pool, PoolClient } from 'pg';
import { config } from '../config';
import { DatabaseAdapter } from './types';

/**
 * PostgreSQL adapter using node-postgres. Supports connection pooling.
 */
export class PostgresAdapter implements DatabaseAdapter<Pool> {
  private pool: Pool | null = null;

  async connect(): Promise<Pool> {
    this.pool = new Pool({
      host: config.postgres.host,
      port: config.postgres.port,
      user: config.postgres.user,
      password: config.postgres.password,
      database: config.postgres.database,
    });
    return this.pool;
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async testConnection(): Promise<void> {
    const pool = this.pool ?? (await this.connect());
    const result = await pool.query('SELECT NOW() AS now');
    console.log('PostgreSQL current time:', result.rows);
    if (!this.pool) {
      await pool.end();
    }
  }
}