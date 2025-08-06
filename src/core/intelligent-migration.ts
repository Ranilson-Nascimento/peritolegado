import { EventEmitter } from 'events';
import { DatabaseAdapter, TableInfo, ColumnInfo } from '../adapters/types';
import { ParadoxEnhancedAdapter } from '../adapters/paradox-enhanced';
import { FirebirdEnhancedAdapter } from '../adapters/firebird-enhanced';
import { IntelligentMappingEngine } from './intelligent-mapping';

export interface IntelligentMigrationOptions {
  // Configurações de performance
  batchSize: number;
  parallelTables: number;
  maxRetries: number;
  retryDelay: number;
  
  // Configurações de dados
  preserveStructure: boolean;
  createIndexes: boolean;
  validateData: boolean;
  skipErrors: boolean;
  
  // Configurações específicas
  tableFilter?: string[];
  excludeTables?: string[];
  transformRules?: TransformRule[];
  
  // Configurações de monitoramento
  enableProgress: boolean;
  logLevel: 'silent' | 'error' | 'warn' | 'info' | 'debug';
}

export interface TransformRule {
  table: string;
  column?: string;
  transform: 'uppercase' | 'lowercase' | 'trim' | 'date_format' | 'custom';
  customFunction?: (value: any) => any;
}

export interface MigrationProgress {
  phase: 'connecting' | 'analyzing' | 'creating' | 'migrating' | 'indexing' | 'validating' | 'complete' | 'error';
  currentTable?: string;
  tablesCompleted: number;
  totalTables: number;
  recordsProcessed: number;
  totalRecords: number;
  errors: string[];
  warnings: string[];
  startTime: Date;
  estimatedCompletion?: Date;
  throughput?: number; // registros por segundo
}

export interface MigrationStatistics {
  totalTables: number;
  tablesProcessed: number;
  totalRecords: number;
  recordsProcessed: number;
  errors: number;
  warnings: number;
  duration: number;
  averageThroughput: number;
  largestTable: { name: string; records: number };
  problematicTables: string[];
}

export class IntelligentMigrationEngine extends EventEmitter {
  private sourceAdapter: ParadoxEnhancedAdapter;
  private targetAdapter: FirebirdEnhancedAdapter;
  private mappingEngine: IntelligentMappingEngine;
  private options: IntelligentMigrationOptions;
  private progress: MigrationProgress;
  private statistics: MigrationStatistics;
  private isRunning: boolean = false;
  private shouldStop: boolean = false;

  constructor(
    sourceConfig: any,
    targetConfig: any,
    options: Partial<IntelligentMigrationOptions> = {}
  ) {
    super();
    
    this.sourceAdapter = new ParadoxEnhancedAdapter(sourceConfig);
    this.targetAdapter = new FirebirdEnhancedAdapter(targetConfig);
    
    // Initialize mapping engine
    this.mappingEngine = new IntelligentMappingEngine();
    
    this.options = {
      batchSize: 1000,
      parallelTables: 1,
      maxRetries: 3,
      retryDelay: 1000,
      preserveStructure: true,
      createIndexes: true,
      validateData: true,
      skipErrors: false,
      enableProgress: true,
      logLevel: 'info',
      ...options
    };

    this.initializeProgress();
    this.initializeStatistics();
  }

  private initializeProgress(): void {
    this.progress = {
      phase: 'connecting',
      tablesCompleted: 0,
      totalTables: 0,
      recordsProcessed: 0,
      totalRecords: 0,
      errors: [],
      warnings: [],
      startTime: new Date()
    };
  }

  private initializeStatistics(): void {
    this.statistics = {
      totalTables: 0,
      tablesProcessed: 0,
      totalRecords: 0,
      recordsProcessed: 0,
      errors: 0,
      warnings: 0,
      duration: 0,
      averageThroughput: 0,
      largestTable: { name: '', records: 0 },
      problematicTables: []
    };
  }

  async startMigration(): Promise<MigrationStatistics> {
    if (this.isRunning) {
      throw new Error('🚫 Migração já está em execução');
    }

    try {
      this.isRunning = true;
      this.shouldStop = false;
      this.log('info', '🚀 Iniciando migração inteligente Paradox → Firebird');

      // Fase 1: Conectar aos bancos
      await this.connectDatabases();

      // Fase 2: Analisar estrutura do banco origem
      const sourceSchema = await this.analyzeSourceDatabase();

      // Fase 3: Criar estrutura no banco destino
      await this.createTargetStructure(sourceSchema);

      // Fase 4: Migrar dados
      await this.migrateData(sourceSchema.tables);

      // Fase 5: Criar índices
      if (this.options.createIndexes) {
        await this.createIndexes(sourceSchema.tables);
      }

      // Fase 6: Validar migração
      if (this.options.validateData) {
        await this.validateMigration(sourceSchema.tables);
      }

      this.completeMigration();
      return this.statistics;

    } catch (error: any) {
      this.handleMigrationError(error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  private async connectDatabases(): Promise<void> {
    this.updateProgress('connecting');
    this.log('info', '🔗 Conectando aos bancos de dados...');

    try {
      // Conectar fonte
      this.log('info', '📂 Conectando ao Paradox...');
      await this.sourceAdapter.connect();
      this.log('info', '✅ Paradox conectado com sucesso');

      // Conectar destino
      this.log('info', '🔥 Conectando ao Firebird...');
      await this.targetAdapter.connect();
      this.log('info', '✅ Firebird conectado com sucesso');

    } catch (error: any) {
      throw new Error(`❌ Falha na conexão: ${error.message}`);
    }
  }

  private async analyzeSourceDatabase(): Promise<{ name: string; tables: TableInfo[] }> {
    this.updateProgress('analyzing');
    this.log('info', '🔍 Analisando estrutura do banco Paradox...');

    const schema = await this.sourceAdapter.getSchema();
    
    // Filtrar tabelas se necessário
    let filteredTables = schema.tables;
    
    if (this.options.tableFilter && this.options.tableFilter.length > 0) {
      filteredTables = filteredTables.filter(table => 
        this.options.tableFilter!.includes(table.name)
      );
    }
    
    if (this.options.excludeTables && this.options.excludeTables.length > 0) {
      filteredTables = filteredTables.filter(table => 
        !this.options.excludeTables!.includes(table.name)
      );
    }

    this.progress.totalTables = filteredTables.length;
    this.statistics.totalTables = filteredTables.length;

    // Calcular total de registros
    for (const table of filteredTables) {
      try {
        const count = await this.sourceAdapter.getRecordCount(table.name);
        this.progress.totalRecords += count;
        this.statistics.totalRecords += count;

        if (count > this.statistics.largestTable.records) {
          this.statistics.largestTable = { name: table.name, records: count };
        }
      } catch (error) {
        this.log('warn', `⚠️ Não foi possível contar registros da tabela ${table.name}`);
      }
    }

    this.log('info', `📊 Análise concluída: ${filteredTables.length} tabelas, ~${this.progress.totalRecords} registros`);
    
    return { ...schema, tables: filteredTables };
  }

  private async createTargetStructure(schema: { name: string; tables: TableInfo[] }): Promise<void> {
    this.updateProgress('creating');
    this.log('info', '🏗️ Criando estrutura no Firebird...');

    for (const table of schema.tables) {
      if (this.shouldStop) break;

      try {
        this.log('info', `📋 Criando tabela ${table.name}...`);
        
        // Adaptar tipos Paradox para Firebird
        const adaptedTable = this.adaptTableForFirebird(table);
        
        await this.targetAdapter.createTable(adaptedTable);
        this.log('info', `✅ Tabela ${table.name} criada com sucesso`);

      } catch (error: any) {
        const errorMsg = `❌ Erro ao criar tabela ${table.name}: ${error.message}`;
        this.log('error', errorMsg);
        this.progress.errors.push(errorMsg);
        this.statistics.errors++;

        if (!this.options.skipErrors) {
          throw new Error(errorMsg);
        }
      }
    }
  }

  private adaptTableForFirebird(table: TableInfo): TableInfo {
    const adaptedColumns = table.columns.map(col => ({
      ...col,
      // Ajustar tipos específicos se necessário
      type: this.optimizeTypeForFirebird(col.type, col.originalType)
    }));

    return {
      ...table,
      columns: adaptedColumns
    };
  }

  private optimizeTypeForFirebird(firebirdType: string, originalType: string): string {
    // Otimizações específicas baseadas no tipo original do Paradox
    if (originalType === 'ALPHA' && firebirdType.includes('VARCHAR')) {
      // Otimizar tamanho para VARCHAR
      const match = firebirdType.match(/VARCHAR\((\d+)\)/);
      if (match) {
        const size = parseInt(match[1]);
        if (size > 8191) {
          return 'BLOB SUB_TYPE 1'; // Usar BLOB para textos muito grandes
        }
      }
    }

    return firebirdType;
  }

  private async migrateData(tables: TableInfo[]): Promise<void> {
    this.updateProgress('migrating');
    this.log('info', '📦 Iniciando migração de dados...');

    const startTime = Date.now();

    for (const table of tables) {
      if (this.shouldStop) break;

      this.progress.currentTable = table.name;
      await this.migrateTable(table);
      this.progress.tablesCompleted++;
      this.statistics.tablesProcessed++;

      this.emit('tableComplete', {
        table: table.name,
        records: await this.sourceAdapter.getRecordCount(table.name)
      });
    }

    this.statistics.duration = Date.now() - startTime;
    this.statistics.averageThroughput = 
      this.statistics.recordsProcessed / (this.statistics.duration / 1000);
  }

  private async migrateTable(table: TableInfo): Promise<void> {
    this.log('info', `🚚 Migrando tabela ${table.name}...`);

    try {
      const dataStream = await this.sourceAdapter.streamData(table.name, this.options.batchSize);
      let batchCount = 0;

      for await (const batch of dataStream) {
        if (this.shouldStop) break;

        // Aplicar transformações se configuradas
        const transformedBatch = this.applyTransformations(table.name, batch);

        // Inserir lote com retry
        await this.insertBatchWithRetry(table.name, transformedBatch);

        this.progress.recordsProcessed += batch.length;
        this.statistics.recordsProcessed += batch.length;
        batchCount++;

        // Calcular throughput e ETA
        this.updateThroughputAndETA();

        this.emit('progress', this.progress);

        this.log('debug', `📦 Lote ${batchCount} da tabela ${table.name}: ${batch.length} registros`);
      }

      this.log('info', `✅ Tabela ${table.name} migrada com sucesso`);

    } catch (error: any) {
      const errorMsg = `❌ Erro na migração da tabela ${table.name}: ${error.message}`;
      this.log('error', errorMsg);
      this.progress.errors.push(errorMsg);
      this.statistics.errors++;
      this.statistics.problematicTables.push(table.name);

      if (!this.options.skipErrors) {
        throw new Error(errorMsg);
      }
    }
  }

  private applyTransformations(tableName: string, batch: any[]): any[] {
    if (!this.options.transformRules) return batch;

    const tableRules = this.options.transformRules.filter(rule => rule.table === tableName);
    if (tableRules.length === 0) return batch;

    return batch.map(row => {
      const transformedRow = { ...row };

      for (const rule of tableRules) {
        if (rule.column && transformedRow[rule.column] !== undefined) {
          transformedRow[rule.column] = this.applyTransformation(
            transformedRow[rule.column], 
            rule
          );
        }
      }

      return transformedRow;
    });
  }

  private applyTransformation(value: any, rule: TransformRule): any {
    if (value === null || value === undefined) return value;

    switch (rule.transform) {
      case 'uppercase':
        return String(value).toUpperCase();
      case 'lowercase':
        return String(value).toLowerCase();
      case 'trim':
        return String(value).trim();
      case 'date_format':
        // Converter formato de data se necessário
        return value;
      case 'custom':
        return rule.customFunction ? rule.customFunction(value) : value;
      default:
        return value;
    }
  }

  private async insertBatchWithRetry(tableName: string, batch: any[]): Promise<void> {
    let attempt = 0;
    
    while (attempt < this.options.maxRetries) {
      try {
        await this.targetAdapter.insertData(tableName, batch);
        return;
      } catch (error: any) {
        attempt++;
        
        if (attempt >= this.options.maxRetries) {
          throw error;
        }

        this.log('warn', `⚠️ Tentativa ${attempt} falhou para ${tableName}, tentando novamente em ${this.options.retryDelay}ms...`);
        await this.sleep(this.options.retryDelay);
      }
    }
  }

  private updateThroughputAndETA(): void {
    const elapsed = Date.now() - this.progress.startTime.getTime();
    this.progress.throughput = this.progress.recordsProcessed / (elapsed / 1000);

    if (this.progress.throughput > 0) {
      const remainingRecords = this.progress.totalRecords - this.progress.recordsProcessed;
      const etaSeconds = remainingRecords / this.progress.throughput;
      this.progress.estimatedCompletion = new Date(Date.now() + etaSeconds * 1000);
    }
  }

  private async createIndexes(tables: TableInfo[]): Promise<void> {
    this.updateProgress('indexing');
    this.log('info', '🔗 Criando índices...');

    for (const table of tables) {
      if (this.shouldStop) break;

      try {
        // Criar índices baseados nas chaves primárias
        if (table.primaryKeys && table.primaryKeys.length > 0) {
          const indexSql = `CREATE INDEX IDX_${table.name}_PK ON ${table.name} (${table.primaryKeys.join(', ')})`;
          await this.targetAdapter.query(indexSql);
          this.log('info', `🔗 Índice criado para ${table.name}`);
        }
      } catch (error: any) {
        this.log('warn', `⚠️ Falha ao criar índice para ${table.name}: ${error.message}`);
      }
    }
  }

  private async validateMigration(tables: TableInfo[]): Promise<void> {
    this.updateProgress('validating');
    this.log('info', '✅ Validando migração...');

    for (const table of tables) {
      if (this.shouldStop) break;

      try {
        const sourceCount = await this.sourceAdapter.getRecordCount(table.name);
        const targetCount = await this.targetAdapter.getRecordCount(table.name);

        if (sourceCount !== targetCount) {
          const warningMsg = `⚠️ Diferença de registros em ${table.name}: origem=${sourceCount}, destino=${targetCount}`;
          this.log('warn', warningMsg);
          this.progress.warnings.push(warningMsg);
          this.statistics.warnings++;
        } else {
          this.log('info', `✅ Tabela ${table.name} validada: ${sourceCount} registros`);
        }
      } catch (error: any) {
        this.log('warn', `⚠️ Não foi possível validar ${table.name}: ${error.message}`);
      }
    }
  }

  private completeMigration(): void {
    this.updateProgress('complete');
    this.statistics.duration = Date.now() - this.progress.startTime.getTime();
    
    this.log('info', '🎉 Migração concluída com sucesso!');
    this.log('info', `📊 Estatísticas: ${this.statistics.tablesProcessed}/${this.statistics.totalTables} tabelas, ${this.statistics.recordsProcessed} registros`);
    this.log('info', `⏱️ Tempo total: ${Math.round(this.statistics.duration / 1000)}s, throughput médio: ${Math.round(this.statistics.averageThroughput)} reg/s`);
    
    this.emit('complete', this.statistics);
  }

  private handleMigrationError(error: Error): void {
    this.updateProgress('error');
    this.log('error', `💥 Falha na migração: ${error.message}`);
    this.emit('error', { error: error.message, statistics: this.statistics });
  }

  private async cleanup(): Promise<void> {
    this.isRunning = false;
    
    try {
      await this.sourceAdapter.disconnect();
      await this.targetAdapter.disconnect();
      this.log('info', '🧹 Conexões fechadas');
    } catch (error) {
      this.log('warn', '⚠️ Aviso durante limpeza:', error);
    }
  }

  private updateProgress(phase: MigrationProgress['phase']): void {
    this.progress.phase = phase;
    if (this.options.enableProgress) {
      this.emit('progress', this.progress);
    }
  }

  private log(level: string, message: string, ...args: any[]): void {
    if (this.shouldLog(level)) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, ...args);
    }
  }

  private shouldLog(level: string): boolean {
    const levels = ['silent', 'error', 'warn', 'info', 'debug'];
    const currentLevel = levels.indexOf(this.options.logLevel);
    const messageLevel = levels.indexOf(level);
    return messageLevel <= currentLevel;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public stop(): void {
    this.log('info', '🛑 Parando migração...');
    this.shouldStop = true;
  }

  public getProgress(): MigrationProgress {
    return { ...this.progress };
  }

  public getStatistics(): MigrationStatistics {
    return { ...this.statistics };
  }

  public getMappingEngine(): IntelligentMappingEngine {
    return this.mappingEngine;
  }
}
