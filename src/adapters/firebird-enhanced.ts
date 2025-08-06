import { DatabaseAdapter, TableInfo, ColumnInfo } from './types';

export interface FirebirdConfig {
  host?: string;
  port?: number;
  database: string; // Caminho completo do arquivo .fdb
  user: string;
  password: string;
  charset?: string;
  pageSize?: number;
  role?: string;
}

export class FirebirdEnhancedAdapter {
  public readonly type = 'firebird';
  private connection: any = null;

  constructor(private config: FirebirdConfig) {}

  async connect(): Promise<any> {
    try {
      // Usar node-firebird ao invés do driver nativo para melhor compatibilidade
      const Firebird = require('node-firebird');
      
      const options = {
        host: this.config.host || 'localhost',
        port: this.config.port || 3050,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
        lowercase_keys: false,
        role: this.config.role,
        pageSize: this.config.pageSize || 4096,
        charset: this.config.charset || 'UTF8'
      };

      return new Promise((resolve, reject) => {
        Firebird.attach(options, (err: any, db: any) => {
          if (err) {
            reject(new Error(`Erro ao conectar no Firebird: ${err.message}`));
            return;
          }
          this.connection = db;
          resolve(db);
        });
      });
    } catch (error: any) {
      throw new Error(`Falha na conexão Firebird: ${error.message}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      return new Promise((resolve) => {
        this.connection.detach((err: any) => {
          if (err) console.warn('Aviso ao desconectar Firebird:', err.message);
          this.connection = null;
          resolve();
        });
      });
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const db = await this.connect();
      const result = await this.query('SELECT 1 FROM RDB$DATABASE');
      return result.length > 0;
    } catch (error) {
      console.error('Erro no teste de conexão Firebird:', error);
      return false;
    }
  }

  async query(sql: string, params: any[] = []): Promise<any[]> {
    if (!this.connection) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      this.connection.query(sql, params, (err: any, result: any) => {
        if (err) {
          reject(new Error(`Erro na query Firebird: ${err.message}`));
          return;
        }
        resolve(result || []);
      });
    });
  }

  async listTables(): Promise<string[]> {
    const sql = `
      SELECT TRIM(RDB$RELATION_NAME) as TABLE_NAME
      FROM RDB$RELATIONS
      WHERE RDB$SYSTEM_FLAG = 0
        AND RDB$RELATION_TYPE = 0
        AND RDB$RELATION_NAME NOT STARTING WITH 'RDB$'
        AND RDB$RELATION_NAME NOT STARTING WITH 'MON$'
      ORDER BY RDB$RELATION_NAME
    `;
    
    const result = await this.query(sql);
    return result.map(row => row.TABLE_NAME.trim());
  }

  async getTableInfo(tableName: string): Promise<TableInfo> {
    const sql = `
      SELECT 
        TRIM(rf.RDB$FIELD_NAME) as COLUMN_NAME,
        TRIM(f.RDB$FIELD_TYPE) as FIELD_TYPE,
        f.RDB$FIELD_LENGTH as FIELD_LENGTH,
        f.RDB$FIELD_SCALE as FIELD_SCALE,
        f.RDB$FIELD_PRECISION as FIELD_PRECISION,
        rf.RDB$NULL_FLAG as NULL_FLAG,
        rf.RDB$DEFAULT_SOURCE as DEFAULT_VALUE,
        TRIM(f.RDB$FIELD_SUB_TYPE) as FIELD_SUB_TYPE
      FROM RDB$RELATION_FIELDS rf
      JOIN RDB$FIELDS f ON rf.RDB$FIELD_SOURCE = f.RDB$FIELD_NAME
      WHERE TRIM(rf.RDB$RELATION_NAME) = ?
      ORDER BY rf.RDB$FIELD_POSITION
    `;

    const result = await this.query(sql, [tableName.toUpperCase()]);
    
    const columns: ColumnInfo[] = result.map(row => ({
      name: row.COLUMN_NAME,
      type: this.mapFirebirdType(row.FIELD_TYPE, row.FIELD_SUB_TYPE, row.FIELD_LENGTH, row.FIELD_SCALE, row.FIELD_PRECISION),
      originalType: `FB_TYPE_${row.FIELD_TYPE}`,
      nullable: !row.NULL_FLAG,
      defaultValue: row.DEFAULT_VALUE && typeof row.DEFAULT_VALUE === 'string' 
        ? row.DEFAULT_VALUE.replace('DEFAULT ', '') 
        : null,
      precision: row.FIELD_PRECISION,
      scale: row.FIELD_SCALE
    }));

    return {
      name: tableName,
      type: 'table' as const,
      columns,
      primaryKeys: await this.getPrimaryKey(tableName),
      indexes: []
    };
  }

  private mapFirebirdType(fieldType: number, subType: number, length: number, scale: number, precision: number): string {
    console.log(`Mapeando tipo Firebird: fieldType=${fieldType}, subType=${subType}, scale=${scale}, precision=${precision}, length=${length}`);
    
    switch (fieldType) {
      case 7: // SMALLINT with possible NUMERIC
        if (scale && scale < 0) {
          return `NUMERIC(${precision || 15},${Math.abs(scale)})`;
        }
        return 'SMALLINT';
        
      case 8: // INTEGER with possible NUMERIC/DECIMAL
        if (scale && scale < 0) {
          return `NUMERIC(${precision || 18},${Math.abs(scale)})`;
        }
        return 'INTEGER';
        
      case 9: return 'QUAD';
      case 10: return 'FLOAT';
      case 11: return 'DOUBLE PRECISION'; // Legacy double precision
      case 12: return 'DATE';
      case 13: return 'TIME';
      
      case 14: // CHAR
        return `CHAR(${length || 1})`;
        
      case 16: // BIGINT with possible NUMERIC
        if (scale && scale < 0) {
          return `NUMERIC(${precision || 18},${Math.abs(scale)})`;
        }
        return 'BIGINT';
        
      case 17: return 'BOOLEAN';
      case 18: return 'DECFLOAT(16)';
      case 19: return 'DECFLOAT(34)';
      case 20: return 'INT128';
      case 21: return 'TIME WITH TIME ZONE';
      case 22: return 'TIMESTAMP WITH TIME ZONE';
      case 23: return 'BOOLEAN';
      case 24: return 'DECFLOAT(16)';
      case 25: return 'DECFLOAT(34)';
      case 26: return 'INT128';
      case 27: return 'DOUBLE PRECISION';
      case 28: return 'TIME WITH TIME ZONE';
      case 29: return 'TIMESTAMP WITH TIME ZONE';
      case 30: return 'INT128';
      case 35: return 'TIMESTAMP';
      
      case 37: // VARCHAR
        return `VARCHAR(${length || 1})`;
        
      case 40: // CSTRING (null-terminated string)
        return `CSTRING(${length || 1})`;
        
      case 45: return 'BLOB_ID';
      case 261: // BLOB
        switch (subType) {
          case 0: return 'BLOB BINARY';
          case 1: return 'BLOB TEXT';
          case 2: return 'BLOB BLR';
          case 3: return 'BLOB ACL';
          case 4: return 'BLOB RANGES';
          case 5: return 'BLOB SUMMARY';
          case 6: return 'BLOB FORMAT';
          case 7: return 'BLOB TRANSACTION_DESCRIPTION';
          case 8: return 'BLOB EXTERNAL_FILE_DESCRIPTION';
          default: return `BLOB(${subType})`;
        }
        
      case 262: return 'ARRAY';
      case 263: return 'QUAD';
      case 264: return 'EXTENDED';
      case 265: return 'TIMESTAMP WITH TIME ZONE';
      case 266: return 'EXTENDED';
      case 267: return 'INT128';
      
      default:
        console.warn(`Tipo Firebird desconhecido: ${fieldType}, subType: ${subType}, precision: ${precision}, scale: ${scale}, length: ${length}`);
        // Tentar mapear tipos comuns baseados no fieldType
        if (fieldType >= 7 && fieldType <= 9) return 'INTEGER';
        if (fieldType >= 10 && fieldType <= 11) return 'DOUBLE PRECISION';
        if (fieldType === 12) return 'DATE';
        if (fieldType === 13) return 'TIME';
        if (fieldType >= 14 && fieldType <= 15) return `CHAR(${length || 1})`;
        if (fieldType >= 16 && fieldType <= 20) return 'BIGINT';
        if (fieldType >= 35 && fieldType <= 36) return 'TIMESTAMP';
        if (fieldType >= 37 && fieldType <= 40) return `VARCHAR(${length || 1})`;
        
        // Fallback com informação mais útil
        return `UNKNOWN_TYPE_${fieldType}${subType ? `_SUB${subType}` : ''}`;
    }
  }


  private async getPrimaryKey(tableName: string): Promise<string[]> {
    const sql = `
      SELECT TRIM(sg.RDB$FIELD_NAME) as COLUMN_NAME
      FROM RDB$RELATION_CONSTRAINTS rc
      JOIN RDB$INDEX_SEGMENTS sg ON rc.RDB$INDEX_NAME = sg.RDB$INDEX_NAME
      WHERE TRIM(rc.RDB$RELATION_NAME) = ?
        AND rc.RDB$CONSTRAINT_TYPE = 'PRIMARY KEY'
      ORDER BY sg.RDB$FIELD_POSITION
    `;
    
    const result = await this.query(sql, [tableName.toUpperCase()]);
    return result.map(row => row.COLUMN_NAME);
  }

  private async getIndexes(tableName: string): Promise<string[]> {
    const sql = `
      SELECT DISTINCT TRIM(RDB$INDEX_NAME) as INDEX_NAME
      FROM RDB$INDICES
      WHERE TRIM(RDB$RELATION_NAME) = ?
        AND RDB$SYSTEM_FLAG = 0
        AND RDB$UNIQUE_FLAG IS NULL
    `;
    
    const result = await this.query(sql, [tableName.toUpperCase()]);
    return result.map(row => row.INDEX_NAME);
  }

  async getSchema(): Promise<{ name: string; tables: TableInfo[] }> {
    const tables = await this.listTables();
    const schema: TableInfo[] = [];
    
    for (const table of tables) {
      try {
        const tableInfo = await this.getTableInfo(table);
        schema.push(tableInfo);
      } catch (error) {
        console.warn(`Erro ao obter schema da tabela ${table}:`, error);
      }
    }
    
    return {
      name: 'Firebird Database',
      tables: schema
    };
  }

  async createTable(tableInfo: TableInfo): Promise<void> {
    const columns = tableInfo.columns.map(col => {
      let definition = `${col.name} ${col.type}`;
      if (!col.nullable) definition += ' NOT NULL';
      if (col.defaultValue) definition += ` DEFAULT ${col.defaultValue}`;
      return definition;
    }).join(', ');

    let sql = `CREATE TABLE ${tableInfo.name} (${columns}`;
    
    if (tableInfo.primaryKeys && tableInfo.primaryKeys.length > 0) {
      sql += `, PRIMARY KEY (${tableInfo.primaryKeys.join(', ')})`;
    }
    
    sql += ')';
    
    await this.query(sql);
  }

  async insertData(tableName: string, data: any[]): Promise<void> {
    if (data.length === 0) return;

    const columns = Object.keys(data[0]);
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

    // Inserção em lotes para performance
    const batchSize = 100;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      for (const row of batch) {
        const values = columns.map(col => row[col]);
        await this.query(sql, values);
      }
    }
  }

  async streamData(tableName: string, batchSize: number = 1000): Promise<AsyncIterable<any[]>> {
    const sql = `SELECT * FROM ${tableName}`;
    let offset = 0;
    
    return {
      async *[Symbol.asyncIterator]() {
        while (true) {
          const batch = await this.query(`${sql} ROWS ${offset + 1} TO ${offset + batchSize}`);
          if (batch.length === 0) break;
          
          yield batch;
          offset += batchSize;
          
          if (batch.length < batchSize) break;
        }
      }
    };
  }

  async getRecordCount(tableName: string): Promise<number> {
    const result = await this.query(`SELECT COUNT(*) as COUNT FROM ${tableName}`);
    return result[0]?.COUNT || 0;
  }

  async executeTransaction(operations: (() => Promise<void>)[]): Promise<void> {
    if (!this.connection) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      this.connection.transaction((err: any, transaction: any) => {
        if (err) {
          reject(err);
          return;
        }

        Promise.all(operations.map(op => op()))
          .then(() => {
            transaction.commit((err: any) => {
              if (err) reject(err);
              else resolve();
            });
          })
          .catch((error) => {
            transaction.rollback(() => {
              reject(error);
            });
          });
      });
    });
  }
}
