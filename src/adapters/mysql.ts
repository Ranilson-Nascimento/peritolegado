import mysql, { Connection } from 'mysql2/promise';
import { config } from '../config';
import { DatabaseAdapter } from './types';

/**
 * MySQL adapter using the mysql2/promise library. It connects to a
 * MySQL or MariaDB database and provides a simple test query.
 */
export class MySQLAdapter implements DatabaseAdapter<Connection> {
  private connection: Connection | null = null;

  async connect(): Promise<Connection> {
    this.connection = await mysql.createConnection({
      host: config.mysql.host,
      user: config.mysql.user,
      password: config.mysql.password,
      database: config.mysql.database,
    });
    return this.connection;
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
  }

  async testConnection(): Promise<void> {
    const conn = this.connection ?? (await this.connect());
    const [rows] = await conn.query('SELECT 1 + 1 AS result');
    console.log('MySQL test query result:', rows);
    if (!this.connection) {
      await conn.end();
    }
  }
}