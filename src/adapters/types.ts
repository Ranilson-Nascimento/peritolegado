import { Readable } from 'stream';

/**
 * Representa uma tabela/coleção do banco de dados
 */
export interface TableInfo {
  name: string;
  schema?: string;
  type: 'table' | 'view' | 'collection';
  columns: ColumnInfo[];
  primaryKeys?: string[];
  indexes?: IndexInfo[];
}

/**
 * Representa uma coluna/campo
 */
export interface ColumnInfo {
  name: string;
  type: string;
  originalType: string;
  nullable: boolean;
  defaultValue?: any;
  maxLength?: number;
  precision?: number;
  scale?: number;
  autoIncrement?: boolean;
}

/**
 * Representa um índice
 */
export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
  type: 'btree' | 'hash' | 'fulltext' | 'spatial' | 'other';
}

/**
 * Esquema do banco de dados
 */
export interface DatabaseSchema {
  name: string;
  tables: TableInfo[];
  version?: string;
  charset?: string;
}

/**
 * Opções para streaming de dados
 */
export interface StreamOptions {
  tableName: string;
  batchSize?: number;
  where?: string;
  orderBy?: string;
  offset?: number;
  limit?: number;
}

/**
 * Resultado de inserção em lote
 */
export interface InsertResult {
  insertedCount: number;
  errors?: any[];
  lastInsertId?: any;
}

/**
 * Configuração de conexão genérica
 */
export interface ConnectionConfig {
  [key: string]: any;
}

/**
 * Estatísticas de migração
 */
export interface MigrationStats {
  startTime: Date;
  endTime?: Date;
  totalRows: number;
  processedRows: number;
  errorCount: number;
  currentTable?: string;
  speed?: number; // rows per second
}

/**
 * Interface principal para adaptadores de banco de dados
 * Suporta operações de conexão, schema, streaming e migração
 */
export interface DatabaseAdapter<ConnectionType = any> {
  /**
   * Identificador único do tipo de banco
   */
  readonly type: string;

  /**
   * Estabelece conexão com o banco de dados
   */
  connect(config: ConnectionConfig): Promise<ConnectionType>;

  /**
   * Fecha a conexão com o banco de dados
   */
  disconnect(): Promise<void>;

  /**
   * Testa se a conexão está funcionando
   */
  testConnection(): Promise<boolean>;

  /**
   * Obtém o esquema completo do banco de dados
   */
  getSchema(): Promise<DatabaseSchema>;

  /**
   * Obtém informações de uma tabela específica
   */
  getTableInfo(tableName: string): Promise<TableInfo>;

  /**
   * Lista todas as tabelas/coleções do banco
   */
  listTables(): Promise<string[]>;

  /**
   * Cria um stream de dados de uma tabela
   * Permite ler grandes volumes sem consumir muita memória
   */
  streamRows(options: StreamOptions): Promise<Readable>;

  /**
   * Insere múltiplas linhas de forma eficiente
   */
  insertRows(tableName: string, rows: any[]): Promise<InsertResult>;

  /**
   * Cria uma tabela baseada em estrutura fornecida
   */
  createTable(tableInfo: TableInfo): Promise<void>;

  /**
   * Remove uma tabela
   */
  dropTable(tableName: string): Promise<void>;

  /**
   * Conta total de registros em uma tabela
   */
  countRows(tableName: string, where?: string): Promise<number>;

  /**
   * Executa uma query customizada
   */
  executeQuery(sql: string, params?: any[]): Promise<any>;

  /**
   * Mapeia tipos de dados do banco para tipos padrão
   */
  mapDataType(originalType: string): string;

  /**
   * Valida se um valor é compatível com o tipo de coluna
   */
  validateValue(value: any, column: ColumnInfo): boolean;

  /**
   * Transforma um valor para o formato adequado do banco
   */
  transformValue(value: any, column: ColumnInfo): any;
}