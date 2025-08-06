import { Readable } from 'stream';
import * as odbc from 'odbc';
import { 
  DatabaseAdapter, 
  ConnectionConfig, 
  DatabaseSchema, 
  TableInfo, 
  ColumnInfo, 
  StreamOptions, 
  InsertResult 
} from './types';

/**
 * Configuração específica para Paradox
 */
interface ParadoxConfig extends ConnectionConfig {
  path: string; // Caminho para os arquivos .db do Paradox
  driver?: string; // Driver ODBC (padrão: Microsoft Paradox Driver)
}

/**
 * Adaptador para bancos de dados Paradox via ODBC
 */
export class ParadoxAdapter implements DatabaseAdapter<odbc.Connection> {
  public readonly type = 'paradox';
  private connection: odbc.Connection | null = null;
  private config: ParadoxConfig | null = null;

  async connect(config: ConnectionConfig): Promise<odbc.Connection> {
    this.config = config as ParadoxConfig;
    
    const driver = this.config.driver || 'Microsoft Paradox Driver (*.db )';
    const connectionString = `Driver={${driver}};DriverID=538;Fil=Paradox 7.X;DefaultDir=${this.config.path};Dbq=${this.config.path};CollatingSequence=ASCII;`;

    try {
      this.connection = await odbc.connect(connectionString);
      return this.connection;
    } catch (error: any) {
      throw new Error(`Erro ao conectar com Paradox: ${error.message}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.config) {
      return false;
    }
    
    try {
      // Try to connect temporarily for testing
      const driver = this.config.driver || 'Microsoft Paradox Driver (*.db )';
      const connectionString = `Driver={${driver}};DriverID=538;Fil=Paradox 7.X;DefaultDir=${this.config.path};Dbq=${this.config.path};CollatingSequence=ASCII;`;
      
      const testConnection = await odbc.connect(connectionString);
      await testConnection.close();
      return true;
    } catch (error: any) {
      console.error('Erro no teste de conexão Paradox:', error);
      return false;
    }
  }

  async getSchema(): Promise<DatabaseSchema> {
    if (!this.connection) {
      throw new Error('Não conectado ao banco Paradox');
    }

    const tables = await this.listTables();
    const tableInfos: TableInfo[] = [];

    for (const tableName of tables) {
      try {
        const tableInfo = await this.getTableInfo(tableName);
        tableInfos.push(tableInfo);
      } catch (error) {
        console.warn(`Erro ao obter informações da tabela ${tableName}:`, error);
      }
    }

    return {
      name: 'Paradox Database',
      tables: tableInfos,
      version: 'Paradox 7.x',
      charset: 'ASCII'
    };
  }

  async getTableInfo(tableName: string): Promise<TableInfo> {
    if (!this.connection) {
      throw new Error('Não conectado ao banco Paradox');
    }

    try {
      // Obter estrutura da tabela via INFORMATION_SCHEMA ou query direta
      const result = await this.connection.query(`SELECT * FROM "${tableName}" WHERE 1=0`);
      const columns: ColumnInfo[] = [];

      // Analisar metadados das colunas
      if (result.columns) {
        for (const col of result.columns) {
          const columnInfo: ColumnInfo = {
            name: col.name,
            type: this.mapParadoxType(String(col.dataType || 'VARCHAR')),
            originalType: String(col.dataType || 'VARCHAR'),
            nullable: col.nullable !== false,
            maxLength: col.columnSize,
            precision: col.decimalDigits,
            scale: 0,
            autoIncrement: false
          };
          columns.push(columnInfo);
        }
      }

      return {
        name: tableName,
        type: 'table',
        columns,
        primaryKeys: [] // Paradox não tem conceito explícito de chave primária via ODBC
      };
    } catch (error: any) {
      throw new Error(`Erro ao obter informações da tabela ${tableName}: ${error.message}`);
    }
  }

  async listTables(): Promise<string[]> {
    if (!this.connection) {
      throw new Error('Não conectado ao banco Paradox');
    }

    try {
      // Tentar usar system tables do ODBC
      const result = await this.connection.query(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_TYPE = 'TABLE'
      `);
      
      return result.map((row: any) => row.TABLE_NAME);
    } catch (error) {
      // Fallback: buscar arquivos .db no diretório
      const fs = require('fs');
      const path = require('path');
      
      if (!this.config?.path) {
        throw new Error('Caminho do banco Paradox não configurado');
      }

      try {
        const files = fs.readdirSync(this.config.path);
        return files
          .filter((file: string) => file.toLowerCase().endsWith('.db'))
          .map((file: string) => path.basename(file, '.db'));
      } catch (fsError: any) {
        throw new Error(`Erro ao listar tabelas Paradox: ${fsError.message}`);
      }
    }
  }

  async streamRows(options: StreamOptions): Promise<Readable> {
    if (!this.connection) {
      throw new Error('Não conectado ao banco Paradox');
    }

    const { tableName, batchSize = 1000, where, orderBy, offset = 0, limit } = options;
    
    let sql = `SELECT * FROM "${tableName}"`;
    
    if (where) {
      sql += ` WHERE ${where}`;
    }
    
    if (orderBy) {
      sql += ` ORDER BY ${orderBy}`;
    }

    const stream = new Readable({
      objectMode: true,
      read() {}
    });

    try {
      let currentOffset = offset;
      let hasMore = true;

      while (hasMore) {
        let batchSql = sql;
        
        // Paradox não suporta LIMIT/OFFSET nativamente via ODBC
        // Vamos buscar todos e filtrar em memória (não ideal para grandes volumes)
        const result = await this.connection.query(batchSql);
        
        const startIndex = currentOffset;
        const endIndex = limit ? Math.min(startIndex + batchSize, startIndex + limit) : startIndex + batchSize;
        const batch = result.slice(startIndex, endIndex);

        if (batch.length === 0) {
          hasMore = false;
          stream.push(null);
          break;
        }

        for (const row of batch) {
          stream.push(row);
        }

        currentOffset += batchSize;
        hasMore = batch.length === batchSize && (!limit || currentOffset < offset + limit);

        if (currentOffset >= result.length) {
          hasMore = false;
          stream.push(null);
        }
      }
    } catch (error) {
      stream.emit('error', error);
    }

    return stream;
  }

  async insertRows(_tableName: string, _rows: any[]): Promise<InsertResult> {
    // Paradox é somente leitura via ODBC na maioria dos casos
    throw new Error('Operação de inserção não suportada para bancos Paradox (somente leitura)');
  }

  async createTable(_tableInfo: TableInfo): Promise<void> {
    // Paradox é somente leitura via ODBC na maioria dos casos
    throw new Error('Operação de criação de tabela não suportada para bancos Paradox (somente leitura)');
  }

  async dropTable(_tableName: string): Promise<void> {
    // Paradox é somente leitura via ODBC na maioria dos casos
    throw new Error('Operação de remoção de tabela não suportada para bancos Paradox (somente leitura)');
  }

  async countRows(tableName: string, where?: string): Promise<number> {
    if (!this.connection) {
      throw new Error('Não conectado ao banco Paradox');
    }

    let sql = `SELECT COUNT(*) as count FROM "${tableName}"`;
    
    if (where) {
      sql += ` WHERE ${where}`;
    }

    const result = await this.connection.query(sql);
    return (result[0] as any)?.count || 0;
  }

  async executeQuery(sql: string, params?: any[]): Promise<any> {
    if (!this.connection) {
      throw new Error('Não conectado ao banco Paradox');
    }

    if (params && params.length > 0) {
      return await this.connection.query(sql, params as (string | number)[]);
    } else {
      return await this.connection.query(sql);
    }
  }

  mapDataType(originalType: string): string {
    return this.mapParadoxType(originalType);
  }

  private mapParadoxType(paradoxType: string): string {
    const type = paradoxType.toUpperCase();
    
    const typeMap: Record<string, string> = {
      'A': 'VARCHAR',     // Alpha (String)
      'N': 'DECIMAL',     // Number
      'S': 'SMALLINT',    // Short
      'I': 'INTEGER',     // Long Integer
      'C': 'DECIMAL',     // Currency
      'D': 'DATE',        // Date
      'T': 'TIME',        // Time
      '@': 'TIMESTAMP',   // TimeStamp
      'L': 'BOOLEAN',     // Logical
      'M': 'TEXT',        // Memo
      'B': 'BLOB',        // Binary
      'F': 'BLOB',        // Formatted Memo
      'O': 'BLOB',        // OLE
      'G': 'BLOB',        // Graphic
      '#': 'INTEGER',     // Autoincrement
      '+': 'INTEGER',     // Autoincrement (32-bit)
      'Y': 'DECIMAL',     // BCD
      'CHAR': 'CHAR',
      'VARCHAR': 'VARCHAR',
      'LONGVARCHAR': 'TEXT',
      'DECIMAL': 'DECIMAL',
      'NUMERIC': 'NUMERIC',
      'SMALLINT': 'SMALLINT',
      'INTEGER': 'INTEGER',
      'REAL': 'REAL',
      'FLOAT': 'FLOAT',
      'DOUBLE': 'DOUBLE',
      'DATE': 'DATE',
      'TIME': 'TIME',
      'TIMESTAMP': 'TIMESTAMP'
    };

    return typeMap[type] || 'VARCHAR';
  }

  validateValue(value: any, column: ColumnInfo): boolean {
    if (value === null || value === undefined) {
      return column.nullable;
    }

    switch (column.type.toUpperCase()) {
      case 'INTEGER':
      case 'SMALLINT':
        return Number.isInteger(Number(value));
      
      case 'DECIMAL':
      case 'NUMERIC':
      case 'REAL':
      case 'FLOAT':
      case 'DOUBLE':
        return !isNaN(Number(value));
      
      case 'VARCHAR':
      case 'CHAR':
      case 'TEXT':
        return typeof value === 'string';
      
      case 'DATE':
      case 'TIME':
      case 'TIMESTAMP':
        return value instanceof Date || !isNaN(Date.parse(value));
      
      case 'BOOLEAN':
        return typeof value === 'boolean';
      
      default:
        return true;
    }
  }

  transformValue(value: any, column: ColumnInfo): any {
    if (value === null || value === undefined) {
      return value;
    }

    switch (column.type.toUpperCase()) {
      case 'INTEGER':
      case 'SMALLINT':
        return parseInt(value);
      
      case 'DECIMAL':
      case 'NUMERIC':
      case 'REAL':
      case 'FLOAT':
      case 'DOUBLE':
        return parseFloat(value);
      
      case 'VARCHAR':
      case 'CHAR':
      case 'TEXT':
        return String(value).trim(); // Remove espaços do Paradox
      
      case 'DATE':
      case 'TIME':
      case 'TIMESTAMP':
        if (value instanceof Date) return value;
        return new Date(value);
      
      case 'BOOLEAN':
        if (typeof value === 'boolean') return value;
        return Boolean(value);
      
      default:
        return value;
    }
  }
}
