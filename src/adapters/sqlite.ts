import { DatabaseAdapter, TableInfo, ColumnInfo, DatabaseSchema, StreamOptions, InsertResult, ConnectionConfig, IndexInfo } from './types';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';

export interface SQLiteConfig extends ConnectionConfig {
  database: string; // Caminho para o arquivo .db/.sqlite/.sqlite3
  mode?: 'readonly' | 'readwrite' | 'create';
}

export class SQLiteAdapter implements DatabaseAdapter<any> {
  readonly type = 'sqlite';
  private config: SQLiteConfig;
  private connection: any = null;

  constructor(config: SQLiteConfig) {
    this.config = config;
  }

  async connect(config?: ConnectionConfig): Promise<any> {
    if (config) {
      this.config = { ...this.config, ...config } as SQLiteConfig;
    }
    
    // Verificar se arquivo existe
    if (!fs.existsSync(this.config.database)) {
      throw new Error(`Arquivo SQLite não encontrado: ${this.config.database}`);
    }

    try {
      const sqlite3 = require('sqlite3').verbose();
      
      return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(this.config.database, sqlite3.OPEN_READONLY, (err: any) => {
          if (err) {
            console.error('❌ Erro ao conectar SQLite:', err.message);
            reject(err);
          } else {
            console.log('✅ SQLite conectado:', this.config.database);
            this.connection = db;
            resolve(db);
          }
        });
      });
    } catch (error) {
      console.error('❌ sqlite3 não instalado, usando modo fallback');
      // Fallback: usar conexão simulada
      this.connection = { database: this.config.database };
      return this.connection;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection && this.connection.close) {
      return new Promise((resolve) => {
        this.connection.close((err: any) => {
          if (err) {
            console.error('❌ Erro ao fechar SQLite:', err.message);
          }
          this.connection = null;
          resolve();
        });
      });
    } else {
      this.connection = null;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!fs.existsSync(this.config.database)) {
        return false;
      }
      
      // Tentar conectar e desconectar rapidamente
      await this.connect();
      await this.disconnect();
      return true;
    } catch {
      return false;
    }
  }

  async getSchema(): Promise<DatabaseSchema> {
    if (!this.connection) {
      await this.connect();
    }

    if (!this.connection || !this.connection.all) {
      // Fallback para modo simulado
      console.warn('⚠️ SQLite em modo fallback - retornando esquema de exemplo');
      const tables: TableInfo[] = [
        {
          name: 'exemplo_tabela',
          type: 'table',
          columns: [
            {
              name: 'id',
              type: 'INTEGER',
              originalType: 'INTEGER PRIMARY KEY',
              nullable: false,
              autoIncrement: true
            },
            {
              name: 'nome',
              type: 'TEXT',
              originalType: 'TEXT',
              nullable: true,
              maxLength: 255
            }
          ],
          primaryKeys: ['id'],
          indexes: []
        }
      ];

      return {
        name: path.basename(this.config.database),
        tables
      };
    }

    try {
      // Obter lista de tabelas reais do SQLite
      const tableNames = await this.getTableNames();
      const tables: TableInfo[] = [];

      for (const tableName of tableNames) {
        const tableInfo = await this.getTableInfoReal(tableName);
        if (tableInfo) {
          tables.push(tableInfo);
        }
      }

      console.log(`✅ Schema SQLite obtido: ${tables.length} tabelas`);
      return {
        name: path.basename(this.config.database),
        tables
      };
    } catch (error) {
      console.error('❌ Erro ao obter schema SQLite:', error);
      throw error;
    }
  }

  private async getTableNames(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `;
      
      this.connection.all(query, [], (err: any, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const tableNames = rows.map(row => row.name);
          console.log(`📋 Tabelas encontradas no SQLite: ${tableNames.join(', ')}`);
          resolve(tableNames);
        }
      });
    });
  }

  private async getTableInfoReal(tableName: string): Promise<TableInfo | null> {
    try {
      const columns = await this.getTableColumns(tableName);
      const primaryKeys = await this.getPrimaryKeys(tableName);
      const indexes = await this.getTableIndexes(tableName);

      return {
        name: tableName,
        type: 'table',
        columns,
        primaryKeys,
        indexes
      };
    } catch (error) {
      console.error(`❌ Erro ao obter info da tabela ${tableName}:`, error);
      return null;
    }
  }

  private async getTableColumns(tableName: string): Promise<ColumnInfo[]> {
    return new Promise((resolve, reject) => {
      const query = `PRAGMA table_info(${tableName})`;
      
      this.connection.all(query, [], (err: any, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const columns: ColumnInfo[] = rows.map(row => ({
            name: row.name,
            type: this.mapSQLiteType(row.type),
            originalType: row.type,
            nullable: row.notnull === 0,
            autoIncrement: row.pk === 1 && row.type.toLowerCase().includes('integer'),
            defaultValue: row.dflt_value,
            primaryKey: row.pk === 1
          }));
          resolve(columns);
        }
      });
    });
  }

  private async getPrimaryKeys(tableName: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const query = `PRAGMA table_info(${tableName})`;
      
      this.connection.all(query, [], (err: any, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const primaryKeys = rows
            .filter(row => row.pk > 0)
            .sort((a, b) => a.pk - b.pk)
            .map(row => row.name);
          resolve(primaryKeys);
        }
      });
    });
  }

  private async getTableIndexes(tableName: string): Promise<IndexInfo[]> {
    return new Promise((resolve, reject) => {
      const query = `PRAGMA index_list(${tableName})`;
      
      this.connection.all(query, [], (err: any, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const indexes: IndexInfo[] = rows.map(row => ({
            name: row.name,
            type: 'btree' as const, // SQLite usa btree por padrão
            unique: row.unique === 1,
            columns: [] // Seria necessária uma query adicional para obter as colunas
          }));
          resolve(indexes);
        }
      });
    });
  }

  private mapSQLiteType(sqliteType: string): string {
    const type = sqliteType.toUpperCase();
    
    if (type.includes('INT')) return 'INTEGER';
    if (type.includes('TEXT') || type.includes('CHAR') || type.includes('VARCHAR')) return 'TEXT';
    if (type.includes('REAL') || type.includes('FLOAT') || type.includes('DOUBLE')) return 'REAL';
    if (type.includes('BLOB')) return 'BLOB';
    if (type.includes('NUMERIC') || type.includes('DECIMAL')) return 'NUMERIC';
    
    return type;
  }

  async getTableInfo(tableName: string): Promise<TableInfo> {
    const schema = await this.getSchema();
    const table = schema.tables.find(t => t.name === tableName);
    if (!table) {
      throw new Error(`Tabela não encontrada: ${tableName}`);
    }
    return table;
  }

  async listTables(): Promise<string[]> {
    const schema = await this.getSchema();
    return schema.tables.map(t => t.name);
  }

  async streamRows(options: StreamOptions): Promise<Readable> {
    // Implementação mock do stream
    const readable = new Readable({
      objectMode: true,
      read() {
        // Mock data
        this.push({ id: 1, nome: 'Exemplo' });
        this.push(null); // End stream
      }
    });
    return readable;
  }

  async insertRows(tableName: string, rows: any[]): Promise<InsertResult> {
    // Mock implementation
    return {
      insertedCount: rows.length,
      errors: []
    };
  }

  async createTable(tableInfo: TableInfo): Promise<void> {
    // Mock implementation
    console.log(`Criando tabela SQLite: ${tableInfo.name}`);
  }

  async dropTable(tableName: string): Promise<void> {
    // Mock implementation
    console.log(`Removendo tabela SQLite: ${tableName}`);
  }

  async countRows(tableName: string, where?: string): Promise<number> {
    // Mock implementation
    return 0;
  }

  async executeQuery(sql: string, params?: any[]): Promise<any> {
    // Mock implementation
    return { rows: [], fields: [] };
  }

  mapDataType(originalType: string): string {
    const type = originalType.toUpperCase();

    // Mapeamento de tipos SQLite
    if (type.includes('INT')) return 'INTEGER';
    if (type.includes('CHAR') || type.includes('TEXT')) return 'TEXT';
    if (type.includes('REAL') || type.includes('FLOA') || type.includes('DOUB')) return 'REAL';
    if (type.includes('BLOB')) return 'BLOB';
    if (type.includes('NUMERIC') || type.includes('DECIMAL')) return 'NUMERIC';
    if (type.includes('DATE')) return 'DATE';
    if (type.includes('TIME')) return 'DATETIME';
    if (type.includes('BOOL')) return 'BOOLEAN';

    return 'TEXT';
  }

  validateValue(value: any, column: ColumnInfo): boolean {
    if (value === null || value === undefined) {
      return column.nullable;
    }

    const type = column.type.toUpperCase();
    
    if (type === 'INTEGER') {
      return Number.isInteger(Number(value));
    }
    
    if (type === 'REAL') {
      return !isNaN(Number(value));
    }
    
    if (type === 'TEXT') {
      return typeof value === 'string';
    }
    
    return true;
  }

  transformValue(value: any, column: ColumnInfo): any {
    if (value === null || value === undefined) {
      return null;
    }

    const type = column.type.toUpperCase();
    
    if (type === 'INTEGER') {
      return parseInt(value, 10);
    }
    
    if (type === 'REAL') {
      return parseFloat(value);
    }
    
    if (type === 'TEXT') {
      return String(value);
    }
    
    return value;
  }

  /**
   * Gera transformação SQLite → Firebird
   */
  createSQLiteToFirebirdTransformation(
    sourceColumn: ColumnInfo,
    targetColumn: ColumnInfo
  ): any {
    const sourceType = sourceColumn.type.toUpperCase();
    const targetType = targetColumn.type.toUpperCase();

    // Transformações específicas SQLite → Firebird
    if (sourceType === 'TEXT' && targetType.includes('VARCHAR')) {
      return {
        type: 'convert',
        expression: `CAST(${sourceColumn.name} AS VARCHAR(${targetColumn.maxLength || 255}))`,
        validation: {
          type: 'length',
          max: targetColumn.maxLength || 255,
          errorMessage: 'Texto muito longo para o campo de destino'
        },
        sqliteType: 'TEXT',
        firebirdType: 'VARCHAR'
      };
    }

    if (sourceType === 'INTEGER' && targetType === 'INTEGER') {
      return {
        type: 'direct',
        sqliteType: 'INTEGER',
        firebirdType: 'INTEGER'
      };
    }

    if (sourceType === 'REAL' && targetType.includes('NUMERIC')) {
      return {
        type: 'convert',
        expression: `CAST(${sourceColumn.name} AS NUMERIC(${targetColumn.precision || 15},${targetColumn.scale || 2}))`,
        precision: targetColumn.precision || 15,
        scale: targetColumn.scale || 2,
        sqliteType: 'REAL',
        firebirdType: 'NUMERIC'
      };
    }

    if (sourceType === 'DATETIME' && targetType === 'TIMESTAMP') {
      return {
        type: 'format',
        format: 'YYYY-MM-DD HH:mm:ss',
        expression: `CAST(${sourceColumn.name} AS TIMESTAMP)`,
        sqliteType: 'DATETIME',
        firebirdType: 'TIMESTAMP'
      };
    }

    if (sourceType === 'BLOB' && targetType.includes('BLOB')) {
      return {
        type: 'convert',
        expression: `CAST(${sourceColumn.name} AS BLOB SUB_TYPE BINARY)`,
        sqliteType: 'BLOB',
        firebirdType: 'BLOB SUB_TYPE BINARY'
      };
    }

    // Conversão padrão
    return {
      type: 'convert',
      expression: `CAST(${sourceColumn.name} AS ${targetType})`
    };
  }
}
