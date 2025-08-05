import oracledb, { Connection } from 'oracledb';
import { config } from '../config';
import { DatabaseAdapter } from './types';

/**
 * Oracle adapter using the oracledb module. Supports thin and thick modes.
 */
export class OracleAdapter implements DatabaseAdapter<Connection> {
  private connection: Connection | null = null;

  async connect(): Promise<Connection> {
    this.connection = await oracledb.getConnection({
      user: config.oracle.user,
      password: config.oracle.password,
      connectString: config.oracle.connectString,
    });
    return this.connection;
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }

  async testConnection(): Promise<void> {
    const conn = this.connection ?? (await this.connect());
    // Execute a simple select. "dual" exists in all Oracle databases.
    const result = await conn.execute<{ RESULT: number }>('SELECT 1 AS RESULT FROM dual');
    console.log('Oracle test result:', result.rows);
    if (!this.connection) {
      await conn.close();
    }
  }
}