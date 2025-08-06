import { DatabaseAdapter, TableInfo, ColumnInfo } from './types';

export interface FirebirdConnection {
  client: any;
  attachment: any;
}

export class FirebirdAdapter {
  async connect(): Promise<FirebirdConnection> {
    throw new Error('Firebird adapter not implemented yet');
  }

  async disconnect(): Promise<void> {
    // Not implemented
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.connect();
      return true;
    } catch {
      return false;
    }
  }
}
