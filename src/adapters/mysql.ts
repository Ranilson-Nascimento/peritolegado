import mysql, { Connection, FieldPacket, RowDataPacket } from 'mysql2/promise';
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
 * Adaptador MySQL com suporte completo a migração de dados
 */
export class MySQLAdapter implements DatabaseAdapter<Connection> {
  public readonly type = 'mysql';
  private connection: Connection | null = null;
  private config: ConnectionConfig | null = null;

  async connect(config: ConnectionConfig): Promise<Connection> {
    this.config = config;
    this.connection = await mysql.createConnection({
      host: config['host'],
      user: config['user'],
      password: config['password'],
      database: config['database'],
      port: config['port'] || 3306,
      charset: config['charset'] || 'utf8mb4',
      timezone: config['timezone'] || 'Z'
    });
    return this.connection;
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.config) {
      throw new Error('Configuration not set. Call connect() first.');
    }
    
    try {
      const connection = await mysql.createConnection({
        host: this.config['host'],
        user: this.config['user'],
        password: this.config['password'],
        database: this.config['database'],
        port: this.config['port'] || 3306,
        charset: this.config['charset'] || 'utf8mb4',
        timezone: this.config['timezone'] || 'Z'
      });
      await connection.end();
      return true;
    } catch (error) {
      console.error('Erro no teste de conexão MySQL:', error);
      return false;
    }
  }

  async getSchema(): Promise<DatabaseSchema> {
    if (!this.connection) {
      throw new Error('Not connected to MySQL database');
    }

    const [dbInfo] = await this.connection.query(
      'SELECT DATABASE() as db_name, @@character_set_database as charset, @@version as version'
    ) as [RowDataPacket[], FieldPacket[]];

    const dbName = (dbInfo[0] as any).db_name;
    const charset = (dbInfo[0] as any).charset;
    const version = (dbInfo[0] as any).version;

    const tables = await this.listTables();
    const tableInfos: TableInfo[] = [];

    for (const tableName of tables) {
      const tableInfo = await this.getTableInfo(tableName);
      tableInfos.push(tableInfo);
    }

    return {
      name: dbName,
      tables: tableInfos,
      version,
      charset
    };
  }

  async getTableInfo(tableName: string): Promise<TableInfo> {
    if (!this.connection) {
      throw new Error('Not connected to MySQL database');
    }

    // Obter informações das colunas
    const [columns] = await this.connection.query(
      `SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        COLUMN_TYPE,
        IS_NULLABLE,
        COLUMN_DEFAULT,
        CHARACTER_MAXIMUM_LENGTH,
        NUMERIC_PRECISION,
        NUMERIC_SCALE,
        EXTRA
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION`,
      [tableName]
    ) as [RowDataPacket[], FieldPacket[]];

    // Obter chaves primárias
    const [primaryKeys] = await this.connection.query(
      `SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'`,
      [tableName]
    ) as [RowDataPacket[], FieldPacket[]];

    const columnInfos: ColumnInfo[] = (columns as any[]).map((col: any) => ({
      name: col.COLUMN_NAME,
      type: this.mapDataType(col.DATA_TYPE),
      originalType: col.COLUMN_TYPE,
      nullable: col.IS_NULLABLE === 'YES',
      defaultValue: col.COLUMN_DEFAULT,
      maxLength: col.CHARACTER_MAXIMUM_LENGTH,
      precision: col.NUMERIC_PRECISION,
      scale: col.NUMERIC_SCALE,
      autoIncrement: col.EXTRA === 'auto_increment'
    }));

    return {
      name: tableName,
      type: 'table',
      columns: columnInfos,
      primaryKeys: (primaryKeys as any[]).map((pk: any) => pk.COLUMN_NAME)
    };
  }

  async listTables(): Promise<string[]> {
    if (!this.connection) {
      throw new Error('Not connected to MySQL database');
    }

    const [tables] = await this.connection.query(
      'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = "BASE TABLE"'
    ) as [RowDataPacket[], FieldPacket[]];

    return (tables as any[]).map((table: any) => table.TABLE_NAME);
  }

  async streamRows(options: StreamOptions): Promise<Readable> {
    if (!this.connection) {
      throw new Error('Not connected to MySQL database');
    }

    const { tableName, batchSize = 1000, where, orderBy, offset = 0, limit } = options;
    
    let sql = `SELECT * FROM \`${tableName}\``;
    const params: any[] = [];

    if (where) {
      sql += ` WHERE ${where}`;
    }

    if (orderBy) {
      sql += ` ORDER BY ${orderBy}`;
    }

    if (limit) {
      sql += ` LIMIT ${limit}`;
    }

    if (offset > 0) {
      sql += ` OFFSET ${offset}`;
    }

    const stream = new Readable({
      objectMode: true,
      read() {}
    });

    try {
      let currentOffset = offset;
      let hasMore = true;

      while (hasMore) {
        const batchSql = `${sql} LIMIT ${batchSize} OFFSET ${currentOffset}`;
        const [rows] = await this.connection!.query(batchSql, params) as [RowDataPacket[], FieldPacket[]];

        if (rows.length === 0) {
          hasMore = false;
          stream.push(null); // End stream
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
      throw new Error('Not connected to MySQL database');
    }

    if (rows.length === 0) {
      return { insertedCount: 0 };
    }

    try {
      const columns = Object.keys(rows[0]);
      const placeholders = columns.map(() => '?').join(', ');
      const columnNames = columns.map(col => `\`${col}\``).join(', ');
      
      const sql = `INSERT INTO \`${tableName}\` (${columnNames}) VALUES (${placeholders})`;
      
      let insertedCount = 0;
      const errors: any[] = [];

      for (const row of rows) {
        try {
          const values = columns.map(col => row[col]);
          await this.connection.execute(sql, values);
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
      throw new Error('Not connected to MySQL database');
    }

    const columnDefinitions = tableInfo.columns.map(col => {
      let def = `\`${col.name}\` ${col.originalType || col.type}`;
      
      if (!col.nullable) {
        def += ' NOT NULL';
      }
      
      if (col.defaultValue !== undefined && col.defaultValue !== null) {
        def += ` DEFAULT ${typeof col.defaultValue === 'string' ? `'${col.defaultValue}'` : col.defaultValue}`;
      }
      
      if (col.autoIncrement) {
        def += ' AUTO_INCREMENT';
      }
      
      return def;
    }).join(', ');

    let sql = `CREATE TABLE \`${tableInfo.name}\` (${columnDefinitions}`;

    if (tableInfo.primaryKeys && tableInfo.primaryKeys.length > 0) {
      const pkColumns = tableInfo.primaryKeys.map(pk => `\`${pk}\``).join(', ');
      sql += `, PRIMARY KEY (${pkColumns})`;
    }

    sql += ')';

    await this.connection.execute(sql);
  }

  async dropTable(tableName: string): Promise<void> {
    if (!this.connection) {
      throw new Error('Not connected to MySQL database');
    }

    await this.connection.execute(`DROP TABLE IF EXISTS \`${tableName}\``);
  }

  async countRows(tableName: string, where?: string): Promise<number> {
    if (!this.connection) {
      throw new Error('Not connected to MySQL database');
    }

    let sql = `SELECT COUNT(*) as count FROM \`${tableName}\``;
    
    if (where) {
      sql += ` WHERE ${where}`;
    }

    const [rows] = await this.connection.query(sql) as [RowDataPacket[], FieldPacket[]];
    return (rows[0] as any).count;
  }

  async executeQuery(sql: string, params?: any[]): Promise<any> {
    if (!this.connection) {
      throw new Error('Not connected to MySQL database');
    }

    const [rows] = await this.connection.query(sql, params);
    return rows;
  }

  mapDataType(originalType: string): string {
    const typeMap: Record<string, string> = {
      'varchar': 'VARCHAR',
      'char': 'CHAR',
      'text': 'TEXT',
      'longtext': 'LONGTEXT',
      'mediumtext': 'MEDIUMTEXT',
      'tinytext': 'TINYTEXT',
      'int': 'INTEGER',
      'tinyint': 'TINYINT',
      'smallint': 'SMALLINT',
      'mediumint': 'MEDIUMINT',
      'bigint': 'BIGINT',
      'decimal': 'DECIMAL',
      'numeric': 'NUMERIC',
      'float': 'FLOAT',
      'double': 'DOUBLE',
      'bit': 'BIT',
      'boolean': 'BOOLEAN',
      'bool': 'BOOLEAN',
      'date': 'DATE',
      'time': 'TIME',
      'datetime': 'DATETIME',
      'timestamp': 'TIMESTAMP',
      'year': 'YEAR',
      'binary': 'BINARY',
      'varbinary': 'VARBINARY',
      'blob': 'BLOB',
      'longblob': 'LONGBLOB',
      'mediumblob': 'MEDIUMBLOB',
      'tinyblob': 'TINYBLOB',
      'json': 'JSON',
      'enum': 'ENUM',
      'set': 'SET'
    };

    const baseType = originalType.toLowerCase().split('(')[0]?.trim() || originalType.toLowerCase();
    return typeMap[baseType] || originalType.toUpperCase();
  }

  validateValue(value: any, column: ColumnInfo): boolean {
    if (value === null || value === undefined) {
      return column.nullable;
    }

    // Validações básicas por tipo
    switch (column.type.toUpperCase()) {
      case 'INTEGER':
      case 'TINYINT':
      case 'SMALLINT':
      case 'MEDIUMINT':
      case 'BIGINT':
        return Number.isInteger(Number(value));
      
      case 'DECIMAL':
      case 'NUMERIC':
      case 'FLOAT':
      case 'DOUBLE':
        return !isNaN(Number(value));
      
      case 'VARCHAR':
      case 'CHAR':
      case 'TEXT':
        return typeof value === 'string';
      
      case 'DATE':
      case 'DATETIME':
      case 'TIMESTAMP':
        return value instanceof Date || !isNaN(Date.parse(value));
      
      case 'BOOLEAN':
        return typeof value === 'boolean' || value === 0 || value === 1;
      
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
      case 'TINYINT':
      case 'SMALLINT':
      case 'MEDIUMINT':
      case 'BIGINT':
        return parseInt(value);
      
      case 'DECIMAL':
      case 'NUMERIC':
      case 'FLOAT':
      case 'DOUBLE':
        return parseFloat(value);
      
      case 'VARCHAR':
      case 'CHAR':
      case 'TEXT':
        return String(value);
      
      case 'DATE':
      case 'DATETIME':
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