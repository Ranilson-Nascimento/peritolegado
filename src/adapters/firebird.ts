import * as firebird from 'node-firebird';
import { Readable } from 'stream';
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
 * Configuração específica para Firebird
 */
interface FirebirdConfig extends ConnectionConfig {
  host: string;
  port?: number;
  database: string;
  user: string;
  password: string;
  lowercase_keys?: boolean;
  role?: string;
  pageSize?: number;
}

/**
 * Adaptador profissional para Firebird com recursos avançados
 */
export class FirebirdAdapter implements DatabaseAdapter<any> {
  public readonly type = 'firebird';
  private connection: any = null;
  private config: FirebirdConfig | null = null;

  async connect(config: ConnectionConfig): Promise<any> {
    this.config = config as FirebirdConfig;
    
    const options = {
      host: this.config.host || 'localhost',
      port: this.config.port || 3050,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      lowercase_keys: this.config.lowercase_keys || false,
      role: this.config.role,
      pageSize: this.config.pageSize || 4096
    };

    return new Promise((resolve, reject) => {
      firebird.attach(options, (err: any, db: any) => {
        if (err) {
          reject(new Error(`Erro ao conectar Firebird: ${err.message}`));
          return;
        }
        
        this.connection = db;
        resolve(db);
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      return new Promise((resolve) => {
        this.connection.detach((err: any) => {
          if (err) console.warn('Aviso ao desconectar Firebird:', err);
          this.connection = null;
          resolve();
        });
      });
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.config) {
      return false;
    }
    
    try {
      const options = {
        host: this.config.host || 'localhost',
        port: this.config.port || 3050,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password
      };

      return new Promise((resolve) => {
        firebird.attach(options, (err: any, db: any) => {
          if (err) {
            resolve(false);
            return;
          }
          
          db.detach(() => {
            resolve(true);
          });
        });
      });
    } catch (error) {
      console.error('Erro no teste de conexão Firebird:', error);
      return false;
    }
  }

  async getSchema(): Promise<DatabaseSchema> {
    if (!this.connection) {
      throw new Error('Não conectado ao banco Firebird');
    }

    // Obter informações do banco
    const dbInfo = await this.executeQuery(`
      SELECT 
        MON$DATABASE_NAME as DATABASE_NAME,
        MON$PAGE_SIZE as PAGE_SIZE,
        MON$ODS_MAJOR || '.' || MON$ODS_MINOR as VERSION
      FROM MON$DATABASE
    `);

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
      name: dbInfo[0]?.DATABASE_NAME || 'Firebird Database',
      tables: tableInfos,
      version: dbInfo[0]?.VERSION || 'Firebird 3.x',
      charset: 'UTF8'
    };
  }

  async getTableInfo(tableName: string): Promise<TableInfo> {
    if (!this.connection) {
      throw new Error('Não conectado ao banco Firebird');
    }

    // Obter informações das colunas
    const columns = await this.executeQuery(`
      SELECT 
        rf.RDB$FIELD_NAME as COLUMN_NAME,
        rf.RDB$FIELD_SOURCE as FIELD_SOURCE,
        f.RDB$FIELD_TYPE as FIELD_TYPE,
        f.RDB$FIELD_SUB_TYPE as FIELD_SUB_TYPE,
        f.RDB$FIELD_LENGTH as FIELD_LENGTH,
        f.RDB$FIELD_PRECISION as FIELD_PRECISION,
        f.RDB$FIELD_SCALE as FIELD_SCALE,
        rf.RDB$NULL_FLAG as NULL_FLAG,
        rf.RDB$DEFAULT_SOURCE as DEFAULT_SOURCE,
        f.RDB$CHARACTER_LENGTH as CHARACTER_LENGTH
      FROM RDB$RELATION_FIELDS rf
      JOIN RDB$FIELDS f ON rf.RDB$FIELD_SOURCE = f.RDB$FIELD_NAME
      WHERE rf.RDB$RELATION_NAME = ?
      ORDER BY rf.RDB$FIELD_POSITION
    `, [tableName.toUpperCase()]);

    // Obter chaves primárias
    const primaryKeys = await this.executeQuery(`
      SELECT 
        rc.RDB$FIELD_NAME as COLUMN_NAME
      FROM RDB$RELATION_CONSTRAINTS rel
      JOIN RDB$INDEX_SEGMENTS rc ON rel.RDB$INDEX_NAME = rc.RDB$INDEX_NAME
      WHERE rel.RDB$RELATION_NAME = ? 
        AND rel.RDB$CONSTRAINT_TYPE = 'PRIMARY KEY'
      ORDER BY rc.RDB$FIELD_POSITION
    `, [tableName.toUpperCase()]);

    const columnInfos: ColumnInfo[] = columns.map((col: any) => ({
      name: col.COLUMN_NAME.trim(),
      type: this.mapFirebirdType(col.FIELD_TYPE, col.FIELD_SUB_TYPE, col.FIELD_PRECISION, col.FIELD_SCALE),
      originalType: this.getFirebirdTypeString(col.FIELD_TYPE, col.FIELD_SUB_TYPE, col.FIELD_LENGTH, col.FIELD_PRECISION, col.FIELD_SCALE),
      nullable: col.NULL_FLAG !== 1,
      defaultValue: col.DEFAULT_SOURCE ? col.DEFAULT_SOURCE.trim() : null,
      maxLength: col.CHARACTER_LENGTH || col.FIELD_LENGTH,
      precision: col.FIELD_PRECISION,
      scale: Math.abs(col.FIELD_SCALE || 0),
      autoIncrement: false // Firebird usa generators/sequences
    }));

    return {
      name: tableName,
      type: 'table',
      columns: columnInfos,
      primaryKeys: primaryKeys.map((pk: any) => pk.COLUMN_NAME.trim())
    };
  }

  async listTables(): Promise<string[]> {
    if (!this.connection) {
      throw new Error('Não conectado ao banco Firebird');
    }

    const tables = await this.executeQuery(`
      SELECT RDB$RELATION_NAME as TABLE_NAME
      FROM RDB$RELATIONS
      WHERE RDB$SYSTEM_FLAG = 0 
        AND RDB$VIEW_BLR IS NULL
      ORDER BY RDB$RELATION_NAME
    `);

    return tables.map((table: any) => table.TABLE_NAME.trim());
  }

  async streamRows(options: StreamOptions): Promise<Readable> {
    if (!this.connection) {
      throw new Error('Não conectado ao banco Firebird');
    }

    const { tableName, batchSize = 1000, where, orderBy, offset = 0, limit } = options;
    
    let sql = `SELECT * FROM "${tableName}"`;
    const params: any[] = [];

    if (where) {
      sql += ` WHERE ${where}`;
    }

    if (orderBy) {
      sql += ` ORDER BY ${orderBy}`;
    }

    // Firebird usa FIRST/SKIP para paginação
    if (limit || offset > 0) {
      if (limit) {
        sql = sql.replace('SELECT', `SELECT FIRST ${limit}`);
      }
      if (offset > 0) {
        sql = sql.replace('SELECT', `SELECT SKIP ${offset}`);
      }
    }

    const stream = new Readable({
      objectMode: true,
      read() {}
    });

    try {
      let currentOffset = offset;
      let hasMore = true;

      while (hasMore) {
        let batchSql = `SELECT FIRST ${batchSize} SKIP ${currentOffset} * FROM "${tableName}"`;
        
        if (where) {
          batchSql += ` WHERE ${where}`;
        }
        
        if (orderBy) {
          batchSql += ` ORDER BY ${orderBy}`;
        }

        const rows = await this.executeQuery(batchSql, params);

        if (rows.length === 0) {
          hasMore = false;
          stream.push(null);
          break;
        }

        for (const row of rows) {
          stream.push(row);
        }

        currentOffset += batchSize;
        hasMore = rows.length === batchSize;

        if (limit && currentOffset >= (offset + limit)) {
          hasMore = false;
          stream.push(null);
        }
      }
    } catch (error) {
      stream.emit('error', error);
    }

    return stream;
  }

  async insertRows(tableName: string, rows: any[]): Promise<InsertResult> {
    if (!this.connection) {
      throw new Error('Não conectado ao banco Firebird');
    }

    if (rows.length === 0) {
      return { insertedCount: 0 };
    }

    try {
      const columns = Object.keys(rows[0]);
      const placeholders = columns.map(() => '?').join(', ');
      const columnNames = columns.map(col => `"${col}"`).join(', ');
      
      const sql = `INSERT INTO "${tableName}" (${columnNames}) VALUES (${placeholders})`;
      
      let insertedCount = 0;
      const errors: any[] = [];

      for (const row of rows) {
        try {
          const values = columns.map(col => row[col]);
          await this.executeQuery(sql, values);
          insertedCount++;
        } catch (error: any) {
          errors.push({ row, error: error.message });
        }
      }

      const result: InsertResult = {
        insertedCount
      };

      if (errors.length > 0) {
        result.errors = errors;
      }

      return result;

    } catch (error) {
      throw new Error(`Failed to insert rows into ${tableName}: ${error}`);
    }
  }

  async createTable(tableInfo: TableInfo): Promise<void> {
    if (!this.connection) {
      throw new Error('Não conectado ao banco Firebird');
    }

    const columnDefinitions = tableInfo.columns.map(col => {
      let def = `"${col.name}" ${col.originalType || col.type}`;
      
      if (!col.nullable) {
        def += ' NOT NULL';
      }
      
      if (col.defaultValue !== undefined && col.defaultValue !== null) {
        def += ` DEFAULT ${typeof col.defaultValue === 'string' ? `'${col.defaultValue}'` : col.defaultValue}`;
      }
      
      return def;
    }).join(', ');

    let sql = `CREATE TABLE "${tableInfo.name}" (${columnDefinitions}`;

    if (tableInfo.primaryKeys && tableInfo.primaryKeys.length > 0) {
      const pkColumns = tableInfo.primaryKeys.map(pk => `"${pk}"`).join(', ');
      sql += `, PRIMARY KEY (${pkColumns})`;
    }

    sql += ')';

    await this.executeQuery(sql);
  }

  async dropTable(tableName: string): Promise<void> {
    if (!this.connection) {
      throw new Error('Não conectado ao banco Firebird');
    }

    await this.executeQuery(`DROP TABLE "${tableName}"`);
  }

  async countRows(tableName: string, where?: string): Promise<number> {
    if (!this.connection) {
      throw new Error('Não conectado ao banco Firebird');
    }

    let sql = `SELECT COUNT(*) as ROW_COUNT FROM "${tableName}"`;
    
    if (where) {
      sql += ` WHERE ${where}`;
    }

    const result = await this.executeQuery(sql);
    return result[0]?.ROW_COUNT || 0;
  }

  async executeQuery(sql: string, params?: any[]): Promise<any[]> {
    if (!this.connection) {
      throw new Error('Não conectado ao banco Firebird');
    }

    return new Promise((resolve, reject) => {
      this.connection.query(sql, params || [], (err: any, result: any[]) => {
        if (err) {
          reject(new Error(`Erro na query Firebird: ${err.message}`));
          return;
        }
        resolve(result || []);
      });
    });
  }

  mapDataType(originalType: string): string {
    return this.mapFirebirdTypeString(originalType);
  }

  private mapFirebirdType(fieldType: number, subType: number, precision: number, scale: number): string {
    console.log(`Mapeando tipo Firebird: ${fieldType}, subType: ${subType}, precision: ${precision}, scale: ${scale}`);
    
    switch (fieldType) {
      case 7: // SMALLINT
        if (subType === 1) return 'NUMERIC';
        if (subType === 2) return 'DECIMAL';
        return 'SMALLINT';
        
      case 8: // INTEGER / NUMERIC / DECIMAL
        if (subType === 1) return 'NUMERIC';
        if (subType === 2) return 'DECIMAL';
        return 'INTEGER';
        
      case 10: // FLOAT
        return 'FLOAT';
        
      case 11: // D_FLOAT
        return 'DOUBLE PRECISION';
        
      case 12: // DATE
        return 'DATE';
        
      case 13: // TIME
        return 'TIME';
        
      case 14: // CHAR
        return 'CHAR';
        
      case 16: // BIGINT / NUMERIC / DECIMAL  
        if (subType === 1) return 'NUMERIC';
        if (subType === 2) return 'DECIMAL';
        return 'BIGINT';
        
      case 23: // BOOLEAN (Firebird 3.0+)
        return 'BOOLEAN';
        
      case 24: // DECFLOAT(16)
        return 'DECFLOAT';
        
      case 25: // DECFLOAT(34)
        return 'DECFLOAT';
        
      case 26: // INT64 / NUMERIC / DECIMAL
        if (precision && scale >= 0) {
          return `NUMERIC(${precision},${scale})`;
        }
        if (subType === 1) return 'NUMERIC';
        if (subType === 2) return 'DECIMAL';
        return 'BIGINT';
        
      case 27: // DOUBLE PRECISION
        return 'DOUBLE PRECISION';
        
      case 35: // TIMESTAMP
        return 'TIMESTAMP';
        
      case 37: // VARCHAR
        return 'VARCHAR';
        
      case 40: // CSTRING
        return 'CHAR';
        
      case 45: // BLOB_ID
        return 'BLOB';
        
      case 261: // BLOB
        if (subType === 0) return 'BLOB'; // Binary blob
        if (subType === 1) return 'BLOB SUB_TYPE TEXT'; // Text blob
        return 'BLOB';
        
      case 262: // ARRAY
        return 'ARRAY';
        
      case 263: // QUAD
        return 'QUAD';
        
      case 264: // EXTENDED
        return 'EXTENDED';
        
      case 265: // TIMESTAMP WITH TIME ZONE
        return 'TIMESTAMP WITH TIME ZONE';
        
      case 266: // TIME WITH TIME ZONE  
        return 'TIME WITH TIME ZONE';
        
      case 267: // INT128 / NUMERIC / DECIMAL
        if (subType === 1) return 'NUMERIC';
        if (subType === 2) return 'DECIMAL';
        return 'INT128';
        
      // Tipos adicionais encontrados nos logs
      case 9: // QUAD
        return 'QUAD';
        
      case 15: // VARYING
        return 'VARCHAR';
        
      case 17: // CSTRING
        return 'CHAR';
        
      case 18: // D_FLOAT
        return 'DOUBLE PRECISION';
        
      case 19: // ARRAY
        return 'ARRAY';
        
      case 20: // QUAD
        return 'QUAD';
        
      default:
        console.warn(`Tipo Firebird desconhecido: ${fieldType}, subType: ${subType}, precision: ${precision}, scale: ${scale}`);
        return 'VARCHAR'; // Fallback seguro
    }
  }

  private getFirebirdTypeString(fieldType: number, subType: number, length: number, precision: number, scale: number): string {
    switch (fieldType) {
      case 14: // CHAR
        return `CHAR(${length || 1})`;
        
      case 37: // VARCHAR
        return `VARCHAR(${length || 1})`;
        
      case 7: // SMALLINT
        if (subType === 1 && precision && scale !== undefined) {
          return `NUMERIC(${precision},${Math.abs(scale)})`;
        }
        if (subType === 2 && precision && scale !== undefined) {
          return `DECIMAL(${precision},${Math.abs(scale)})`;
        }
        return 'SMALLINT';
        
      case 8: // INTEGER
        if (subType === 1 && precision && scale !== undefined) {
          return `NUMERIC(${precision},${Math.abs(scale)})`;
        }
        if (subType === 2 && precision && scale !== undefined) {
          return `DECIMAL(${precision},${Math.abs(scale)})`;
        }
        return 'INTEGER';
        
      case 16: // BIGINT
        if (subType === 1 && precision && scale !== undefined) {
          return `NUMERIC(${precision},${Math.abs(scale)})`;
        }
        if (subType === 2 && precision && scale !== undefined) {
          return `DECIMAL(${precision},${Math.abs(scale)})`;
        }
        return 'BIGINT';
        
      case 26: // NUMERIC/DECIMAL
        if (precision && scale !== undefined) {
          return `NUMERIC(${precision},${Math.abs(scale)})`;
        }
        return 'NUMERIC';
        
      case 261: // BLOB
        if (subType === 0) return 'BLOB';
        if (subType === 1) return 'BLOB SUB_TYPE TEXT';
        return `BLOB SUB_TYPE ${subType}`;
        
      case 10: // FLOAT
        return 'FLOAT';
        
      case 11: // D_FLOAT  
      case 27: // DOUBLE PRECISION
        return 'DOUBLE PRECISION';
        
      case 12: // DATE
        return 'DATE';
        
      case 13: // TIME
        return 'TIME';
        
      case 35: // TIMESTAMP
        return 'TIMESTAMP';
        
      case 23: // BOOLEAN
        return 'BOOLEAN';
        
      case 24: // DECFLOAT(16)
        return 'DECFLOAT(16)';
        
      case 25: // DECFLOAT(34)
        return 'DECFLOAT(34)';
        
      case 265: // TIMESTAMP WITH TIME ZONE
        return 'TIMESTAMP WITH TIME ZONE';
        
      case 266: // TIME WITH TIME ZONE
        return 'TIME WITH TIME ZONE';
        
      case 267: // INT128
        if (subType === 1 && precision && scale !== undefined) {
          return `NUMERIC(${precision},${Math.abs(scale)})`;
        }
        if (subType === 2 && precision && scale !== undefined) {
          return `DECIMAL(${precision},${Math.abs(scale)})`;
        }
        return 'INT128';
        
      default:
        const mappedType = this.mapFirebirdType(fieldType, subType, precision, scale);
        if (length && (mappedType === 'VARCHAR' || mappedType === 'CHAR')) {
          return `${mappedType}(${length})`;
        }
        return mappedType;
    }
  }

  private mapFirebirdTypeString(originalType: string): string {
    const typeMap: Record<string, string> = {
      'CHAR': 'CHAR',
      'VARCHAR': 'VARCHAR',
      'TEXT': 'BLOB SUB_TYPE TEXT',
      'SMALLINT': 'SMALLINT',
      'INTEGER': 'INTEGER',
      'BIGINT': 'BIGINT',
      'NUMERIC': 'NUMERIC',
      'DECIMAL': 'DECIMAL',
      'FLOAT': 'FLOAT',
      'DOUBLE': 'DOUBLE PRECISION',
      'DATE': 'DATE',
      'TIME': 'TIME',
      'TIMESTAMP': 'TIMESTAMP',
      'BOOLEAN': 'BOOLEAN',
      'BLOB': 'BLOB'
    };

    const baseType = originalType.toUpperCase().split('(')[0]?.trim() || originalType.toUpperCase();
    return typeMap[baseType] || originalType.toUpperCase();
  }

  validateValue(value: any, column: ColumnInfo): boolean {
    if (value === null || value === undefined) {
      return column.nullable;
    }

    switch (column.type.toUpperCase()) {
      case 'SMALLINT':
        return Number.isInteger(Number(value)) && Number(value) >= -32768 && Number(value) <= 32767;
      
      case 'INTEGER':
        return Number.isInteger(Number(value)) && Number(value) >= -2147483648 && Number(value) <= 2147483647;
      
      case 'BIGINT':
        return Number.isInteger(Number(value));
      
      case 'NUMERIC':
      case 'DECIMAL':
      case 'FLOAT':
      case 'DOUBLE PRECISION':
        return !isNaN(Number(value));
      
      case 'CHAR':
      case 'VARCHAR':
        return typeof value === 'string' && (!column.maxLength || value.length <= column.maxLength);
      
      case 'DATE':
      case 'TIME':
      case 'TIMESTAMP':
        return value instanceof Date || !isNaN(Date.parse(value));
      
      case 'BOOLEAN':
        return typeof value === 'boolean' || value === 0 || value === 1 || value === 'T' || value === 'F';
      
      default:
        return true;
    }
  }

  transformValue(value: any, column: ColumnInfo): any {
    if (value === null || value === undefined) {
      return value;
    }

    switch (column.type.toUpperCase()) {
      case 'SMALLINT':
      case 'INTEGER':
      case 'BIGINT':
        return parseInt(value);
      
      case 'NUMERIC':
      case 'DECIMAL':
      case 'FLOAT':
      case 'DOUBLE PRECISION':
        return parseFloat(value);
      
      case 'CHAR':
      case 'VARCHAR':
        let str = String(value);
        if (column.maxLength && str.length > column.maxLength) {
          str = str.substring(0, column.maxLength);
        }
        return str;
      
      case 'DATE':
      case 'TIME':
      case 'TIMESTAMP':
        if (value instanceof Date) return value;
        return new Date(value);
      
      case 'BOOLEAN':
        if (typeof value === 'boolean') return value;
        if (value === 'T' || value === 1) return true;
        if (value === 'F' || value === 0) return false;
        return Boolean(value);
      
      default:
        return value;
    }
  }
}
