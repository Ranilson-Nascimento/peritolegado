import { EventEmitter } from 'events';
import { DatabaseAdapter, StreamOptions, MigrationStats, TableInfo } from '../adapters/types';
import { createLogger, Logger } from 'winston';
import { format, transports } from 'winston';

/**
 * Configuração de uma migração
 */
export interface MigrationConfig {
  source: {
    adapter: DatabaseAdapter;
    config: any;
  };
  target: {
    adapter: DatabaseAdapter;
    config: any;
  };
  tables: string[] | 'all';
  batchSize?: number;
  parallelTables?: number;
  mapping?: MappingConfig;
  filters?: FilterConfig;
  transforms?: TransformConfig[];
  validation?: ValidationConfig;
  checkpoints?: boolean;
  dryRun?: boolean;
}

/**
 * Configuração de mapeamento de tabelas e colunas
 */
export interface MappingConfig {
  tables?: Record<string, string>; // sourceTable -> targetTable
  columns?: Record<string, Record<string, string>>; // table -> { sourceCol -> targetCol }
  types?: Record<string, string>; // sourceType -> targetType
}

/**
 * Configuração de filtros
 */
export interface FilterConfig {
  [tableName: string]: {
    where?: string;
    limit?: number;
    orderBy?: string;
  };
}

/**
 * Configuração de transformações
 */
export interface TransformConfig {
  table: string;
  column: string;
  function: string;
  params?: any;
}

/**
 * Configuração de validação
 */
export interface ValidationConfig {
  checkConstraints?: boolean;
  validateData?: boolean;
  stopOnError?: boolean;
}

/**
 * Status de migração
 */
export interface MigrationStatus {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  progress: MigrationStats;
  config: MigrationConfig;
  errors: string[];
  checkpoints: Record<string, any>;
}

/**
 * Núcleo do sistema de migração
 */
export class MigrationEngine extends EventEmitter {
  private logger: Logger;
  private activeJobs = new Map<string, MigrationStatus>();

  constructor() {
    super();
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json()
      ),
      transports: [
        new transports.File({ filename: 'migration-error.log', level: 'error' }),
        new transports.File({ filename: 'migration.log' }),
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.simple()
          )
        })
      ]
    });
  }

  /**
   * Inicia uma migração
   */
  async startMigration(config: MigrationConfig): Promise<string> {
    const jobId = this.generateJobId();
    const status: MigrationStatus = {
      id: jobId,
      status: 'pending',
      progress: {
        startTime: new Date(),
        totalRows: 0,
        processedRows: 0,
        errorCount: 0
      },
      config,
      errors: [],
      checkpoints: {}
    };

    this.activeJobs.set(jobId, status);
    this.emit('migration:started', jobId);

    try {
      await this.executeMigration(jobId);
    } catch (error: any) {
      this.logger.error('Migration failed', { jobId, error });
      status.status = 'failed';
      status.errors.push(error?.message || 'Unknown error');
      this.emit('migration:failed', jobId, error);
    }

    return jobId;
  }

  /**
   * Executa a migração
   */
  private async executeMigration(jobId: string): Promise<void> {
    const status = this.activeJobs.get(jobId)!;
    const { config } = status;

    status.status = 'running';
    this.emit('migration:progress', jobId, status.progress);

    try {
      // 1. Conectar aos bancos
      await config.source.adapter.connect(config.source.config);
      await config.target.adapter.connect(config.target.config);

      this.logger.info('Connected to source and target databases', { jobId });

      // 2. Validar conexões
      await config.source.adapter.testConnection();
      await config.target.adapter.testConnection();

      // 3. Obter esquemas
      const sourceSchema = await config.source.adapter.getSchema();
      const targetSchema = await config.target.adapter.getSchema();

      this.logger.info('Retrieved schemas', { 
        jobId, 
        sourceTables: sourceSchema.tables.length,
        targetTables: targetSchema.tables.length 
      });

      // 4. Determinar tabelas a migrar
      const tablesToMigrate = this.determineTablesToMigrate(config, sourceSchema.tables);

      // 5. Calcular total de registros
      status.progress.totalRows = await this.calculateTotalRows(
        config.source.adapter, 
        tablesToMigrate, 
        config.filters
      );

      this.logger.info('Migration plan ready', { 
        jobId, 
        tables: tablesToMigrate.length,
        totalRows: status.progress.totalRows 
      });

      // 6. Migrar tabelas
      if (config.parallelTables && config.parallelTables > 1) {
        await this.migrateTablesParallel(jobId, tablesToMigrate);
      } else {
        await this.migrateTablesSequential(jobId, tablesToMigrate);
      }

      status.status = 'completed';
      status.progress.endTime = new Date();
      
      this.logger.info('Migration completed successfully', { 
        jobId,
        duration: status.progress.endTime.getTime() - status.progress.startTime.getTime(),
        processedRows: status.progress.processedRows
      });

      this.emit('migration:completed', jobId);

    } finally {
      // Desconectar dos bancos
      try {
        await config.source.adapter.disconnect();
        await config.target.adapter.disconnect();
      } catch (error) {
        this.logger.warn('Error disconnecting from databases', { jobId, error });
      }
    }
  }

  /**
   * Determina quais tabelas devem ser migradas
   */
  private determineTablesToMigrate(config: MigrationConfig, sourceTables: TableInfo[]): string[] {
    if (config.tables === 'all') {
      return sourceTables.map(t => t.name);
    }
    
    return config.tables.filter(tableName => 
      sourceTables.some(t => t.name === tableName)
    );
  }

  /**
   * Calcula o total de registros a serem migrados
   */
  private async calculateTotalRows(
    adapter: DatabaseAdapter, 
    tables: string[], 
    filters?: FilterConfig
  ): Promise<number> {
    let total = 0;
    
    for (const tableName of tables) {
      const where = filters?.[tableName]?.where;
      const count = await adapter.countRows(tableName, where);
      total += count;
    }
    
    return total;
  }

  /**
   * Migra tabelas sequencialmente
   */
  private async migrateTablesSequential(jobId: string, tables: string[]): Promise<void> {
    for (const tableName of tables) {
      await this.migrateTable(jobId, tableName);
    }
  }

  /**
   * Migra tabelas em paralelo
   */
  private async migrateTablesParallel(jobId: string, tables: string[]): Promise<void> {
    const status = this.activeJobs.get(jobId)!;
    const concurrency = status.config.parallelTables || 3;
    
    const chunks = this.chunkArray(tables, concurrency);
    
    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(tableName => this.migrateTable(jobId, tableName))
      );
    }
  }

  /**
   * Migra uma tabela específica
   */
  private async migrateTable(jobId: string, tableName: string): Promise<void> {
    const status = this.activeJobs.get(jobId)!;
    const { config } = status;

    status.progress.currentTable = tableName;
    this.emit('table:started', jobId, tableName);

    try {
      // Obter informações da tabela
      const sourceTableInfo = await config.source.adapter.getTableInfo(tableName);
      
      // Aplicar mapeamento de nome da tabela
      const targetTableName = config.mapping?.tables?.[tableName] || tableName;

      // Verificar se tabela existe no destino, senão criar
      const targetTables = await config.target.adapter.listTables();
      if (!targetTables.includes(targetTableName)) {
        if (!config.dryRun) {
          const mappedTableInfo = this.mapTableStructure(sourceTableInfo, targetTableName, config);
          await config.target.adapter.createTable(mappedTableInfo);
          this.logger.info('Created target table', { jobId, tableName: targetTableName });
        }
      }

      // Configurar opções de streaming
      const streamOptions: StreamOptions = {
        tableName,
        batchSize: config.batchSize || 1000,
        ...config.filters?.[tableName]
      };

      // Criar stream de dados
      const dataStream = await config.source.adapter.streamRows(streamOptions);
      
      let batch: any[] = [];
      let processedInTable = 0;

      dataStream.on('data', async (row) => {
        try {
          // Aplicar transformações
          const transformedRow = this.applyTransformations(row, tableName, config);
          
          // Aplicar mapeamento de colunas
          const mappedRow = this.applyColumnMapping(transformedRow, tableName, config);
          
          batch.push(mappedRow);

          if (batch.length >= (config.batchSize || 1000)) {
            if (!config.dryRun) {
              await config.target.adapter.insertRows(targetTableName, batch);
            }
            
            status.progress.processedRows += batch.length;
            processedInTable += batch.length;
            
            this.emit('progress', jobId, {
              table: tableName,
              processed: processedInTable,
              total: status.progress.totalRows
            });

            batch = [];
          }
        } catch (error: any) {
          status.errors.push(`Error processing row in ${tableName}: ${error?.message || 'Unknown error'}`);
          status.progress.errorCount++;
          this.logger.error('Row processing error', { jobId, tableName, error });
        }
      });

      // Processar último batch
      if (batch.length > 0) {
        if (!config.dryRun) {
          await config.target.adapter.insertRows(targetTableName, batch);
        }
        status.progress.processedRows += batch.length;
      }

      this.emit('table:completed', jobId, tableName, processedInTable);
      this.logger.info('Table migration completed', { jobId, tableName, rows: processedInTable });

    } catch (error) {
      this.emit('table:failed', jobId, tableName, error);
      this.logger.error('Table migration failed', { jobId, tableName, error });
      throw error;
    }
  }

  /**
   * Mapeia estrutura da tabela para o destino
   */
  private mapTableStructure(sourceTable: TableInfo, targetName: string, config: MigrationConfig): TableInfo {
    const mappedColumns = sourceTable.columns.map(col => {
      const mappedName = config.mapping?.columns?.[sourceTable.name]?.[col.name] || col.name;
      const mappedType = config.mapping?.types?.[col.originalType] || 
                        config.target.adapter.mapDataType(col.originalType);
      
      return {
        ...col,
        name: mappedName,
        type: mappedType
      };
    });

    return {
      ...sourceTable,
      name: targetName,
      columns: mappedColumns
    };
  }

  /**
   * Aplica transformações nos dados
   */
  private applyTransformations(row: any, tableName: string, config: MigrationConfig): any {
    if (!config.transforms) return row;

    const tableTransforms = config.transforms.filter(t => t.table === tableName);
    let transformedRow = { ...row };

    for (const transform of tableTransforms) {
      if (transformedRow[transform.column] !== undefined) {
        transformedRow[transform.column] = this.executeTransform(
          transformedRow[transform.column],
          transform.function,
          transform.params
        );
      }
    }

    return transformedRow;
  }

  /**
   * Aplica mapeamento de colunas
   */
  private applyColumnMapping(row: any, tableName: string, config: MigrationConfig): any {
    const columnMapping = config.mapping?.columns?.[tableName];
    if (!columnMapping) return row;

    const mappedRow: any = {};
    
    for (const [sourceCol, targetCol] of Object.entries(columnMapping)) {
      if (row[sourceCol] !== undefined) {
        mappedRow[targetCol] = row[sourceCol];
      }
    }

    // Adicionar colunas não mapeadas
    for (const [key, value] of Object.entries(row)) {
      if (!columnMapping[key] && !mappedRow[key]) {
        mappedRow[key] = value;
      }
    }

    return mappedRow;
  }

  /**
   * Executa uma função de transformação
   */
  private executeTransform(value: any, functionName: string, _params?: any): any {
    // Implementar transformações básicas
    switch (functionName) {
      case 'toUpperCase':
        return typeof value === 'string' ? value.toUpperCase() : value;
      case 'toLowerCase':
        return typeof value === 'string' ? value.toLowerCase() : value;
      case 'trim':
        return typeof value === 'string' ? value.trim() : value;
      case 'dateToISO':
        return value instanceof Date ? value.toISOString() : value;
      case 'nullToEmpty':
        return value === null ? '' : value;
      default:
        return value;
    }
  }

  /**
   * Divide array em chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Gera ID único para job
   */
  private generateJobId(): string {
    return `migration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Obtém status de uma migração
   */
  getMigrationStatus(jobId: string): MigrationStatus | undefined {
    return this.activeJobs.get(jobId);
  }

  /**
   * Lista todas as migrações ativas
   */
  getActiveMigrations(): MigrationStatus[] {
    return Array.from(this.activeJobs.values());
  }

  /**
   * Para uma migração
   */
  async stopMigration(jobId: string): Promise<void> {
    const status = this.activeJobs.get(jobId);
    if (status && status.status === 'running') {
      status.status = 'paused';
      this.emit('migration:stopped', jobId);
    }
  }
}
