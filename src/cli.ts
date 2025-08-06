#!/usr/bin/env node

import { Command } from 'commander';
import { MySQLAdapter, ParadoxAdapter } from './adapters';
import { MigrationEngine, MigrationConfig } from './core/migration-engine';
import { config } from './config';
import * as fs from 'fs';

const program = new Command();

/**
 * Map of adapter names to their classes. New adapters should be added here.
 */
const adapterFactories = {
  mysql: () => new MySQLAdapter(),
  paradox: () => new ParadoxAdapter(),
  // postgres: () => new PostgresAdapter(),
  // oracle: () => new OracleAdapter(),
  // sqlserver: () => new SQLServerAdapter(),
  // mongodb: () => new MongoDBAdapter(),
  // firebird: () => new FirebirdAdapter(),
};

/**
 * Configurações de conexão por tipo de banco
 */
const connectionConfigs: Record<string, any> = {
  mysql: config.mysql,
  postgres: config.postgres,
  oracle: config.oracle,
  sqlserver: config.sqlserver,
  mongodb: config.mongodb,
  firebird: config.firebird,
};

program
  .name('perito-cli')
  .description('CLI do Perito em Legado para migração e teste de bancos de dados')
  .version('1.0.0');

// Comando para testar conexão (mantido para compatibilidade)
program
  .command('test-connection')
  .description('Testa a conexão com um banco de dados específico')
  .requiredOption('-d, --db <database>', 'Nome do banco (mysql, postgres, oracle, sqlserver, mongodb, firebird)')
  .action(async (options) => {
    const dbName = (options.db as string).toLowerCase();
    
    if (!adapterFactories[dbName]) {
      console.error(`❌ Banco de dados "${dbName}" não suportado.`);
      console.log('Bancos suportados:', Object.keys(adapterFactories).join(', '));
      process.exit(1);
    }

    try {
      console.log(`🔗 Testando conexão com ${dbName.toUpperCase()}...`);
      
      const adapter = adapterFactories[dbName]();
      await adapter.connect(connectionConfigs[dbName]);
      await adapter.testConnection();
      await adapter.disconnect();
      
      console.log(`✅ Conexão com ${dbName.toUpperCase()} estabelecida com sucesso!`);
    } catch (error: any) {
      console.error(`❌ Erro ao conectar com ${dbName.toUpperCase()}:`, error.message);
      process.exit(1);
    }
  });

// Comando para listar esquemas
program
  .command('list-schema')
  .description('Lista o esquema de um banco de dados')
  .requiredOption('-d, --db <database>', 'Nome do banco de dados')
  .option('-t, --tables', 'Listar apenas nomes das tabelas')
  .option('-o, --output <file>', 'Salvar resultado em arquivo JSON')
  .action(async (options) => {
    const dbName = (options.db as string).toLowerCase();
    
    if (!adapterFactories[dbName]) {
      console.error(`❌ Banco de dados "${dbName}" não suportado.`);
      process.exit(1);
    }

    try {
      console.log(`📋 Obtendo esquema do ${dbName.toUpperCase()}...`);
      
      const adapter = adapterFactories[dbName]();
      await adapter.connect(connectionConfigs[dbName]);
      
      if (options.tables) {
        const tables = await adapter.listTables();
        console.log('📊 Tabelas encontradas:');
        tables.forEach((table: string) => console.log(`  - ${table}`));
      } else {
        const schema = await adapter.getSchema();
        
        if (options.output) {
          fs.writeFileSync(options.output, JSON.stringify(schema, null, 2));
          console.log(`💾 Esquema salvo em: ${options.output}`);
        } else {
          console.log('📊 Esquema do banco:');
          console.log(JSON.stringify(schema, null, 2));
        }
      }
      
      await adapter.disconnect();
    } catch (error: any) {
      console.error(`❌ Erro ao obter esquema:`, error.message);
      process.exit(1);
    }
  });

// Comando principal de migração
program
  .command('migrate')
  .description('Executa migração entre bancos de dados')
  .requiredOption('-s, --source <database>', 'Banco de origem (mysql, postgres, oracle, sqlserver, mongodb, firebird)')
  .requiredOption('-t, --target <database>', 'Banco de destino (mysql, postgres, oracle, sqlserver, mongodb, firebird)')
  .option('-c, --config <file>', 'Arquivo de configuração da migração')
  .option('--tables <tables>', 'Tabelas específicas (separadas por vírgula) ou "all"', 'all')
  .option('--batch-size <size>', 'Tamanho do lote para inserção', '1000')
  .option('--parallel <count>', 'Número de tabelas a migrar em paralelo', '1')
  .option('--dry-run', 'Executar em modo de simulação (não insere dados)')
  .action(async (options) => {
    const sourceName = options.source.toLowerCase();
    const targetName = options.target.toLowerCase();
    
    if (!adapterFactories[sourceName] || !adapterFactories[targetName]) {
      console.error('❌ Banco de dados não suportado.');
      process.exit(1);
    }

    try {
      console.log(`🚀 Iniciando migração: ${sourceName.toUpperCase()} → ${targetName.toUpperCase()}`);
      
      // Configurar migração
      const migrationConfig: MigrationConfig = {
        source: {
          adapter: adapterFactories[sourceName](),
          config: connectionConfigs[sourceName]
        },
        target: {
          adapter: adapterFactories[targetName](),
          config: connectionConfigs[targetName]
        },
        tables: options.tables === 'all' ? 'all' : options.tables.split(','),
        batchSize: parseInt(options.batchSize),
        parallelTables: parseInt(options.parallel),
        dryRun: options.dryRun || false
      };

      // Carregar configuração customizada se fornecida
      if (options.config && fs.existsSync(options.config)) {
        const customConfig = JSON.parse(fs.readFileSync(options.config, 'utf8'));
        Object.assign(migrationConfig, customConfig);
      }

      // Executar migração
      const engine = new MigrationEngine();
      
      // Configurar listeners para progresso
      engine.on('migration:started', (jobId) => {
        console.log(`✅ Migração iniciada (Job: ${jobId})`);
      });

      engine.on('migration:progress', (_jobId, progress) => {
        const percentage = progress.totalRows > 0 ? 
          ((progress.processedRows / progress.totalRows) * 100).toFixed(1) : 0;
        console.log(`📊 Progresso: ${progress.processedRows}/${progress.totalRows} (${percentage}%) - Tabela: ${progress.currentTable || 'N/A'}`);
      });

      engine.on('table:started', (_jobId, tableName) => {
        console.log(`📋 Iniciando migração da tabela: ${tableName}`);
      });

      engine.on('table:completed', (_jobId, tableName, rowCount) => {
        console.log(`✅ Tabela ${tableName} concluída: ${rowCount} registros`);
      });

      engine.on('migration:completed', (jobId) => {
        console.log(`🎉 Migração concluída com sucesso! (Job: ${jobId})`);
      });

      engine.on('migration:failed', (jobId, error) => {
        console.error(`❌ Migração falhou (Job: ${jobId}):`, error.message);
      });

      await engine.startMigration(migrationConfig);

    } catch (error: any) {
      console.error('❌ Erro durante migração:', error.message);
      process.exit(1);
    }
  });

// Comando para gerar arquivo de configuração
program
  .command('generate-config')
  .description('Gera arquivo de configuração de migração')
  .option('-o, --output <file>', 'Arquivo de saída', 'migration-config.json')
  .action((options) => {
    const configTemplate = {
      tables: "all",
      batchSize: 1000,
      parallelTables: 1,
      dryRun: false,
      mapping: {
        tables: {
          // "source_table": "target_table"
        },
        columns: {
          // "table_name": {
          //   "source_column": "target_column"
          // }
        },
        types: {
          // "source_type": "target_type"
        }
      },
      filters: {
        // "table_name": {
        //   "where": "condition",
        //   "limit": 1000,
        //   "orderBy": "column_name"
        // }
      },
      transforms: [
        // {
        //   "table": "table_name",
        //   "column": "column_name",
        //   "function": "toUpperCase",
        //   "params": {}
        // }
      ]
    };

    fs.writeFileSync(options.output, JSON.stringify(configTemplate, null, 2));
    console.log(`✅ Arquivo de configuração criado: ${options.output}`);
    console.log('📝 Edite o arquivo para personalizar sua migração.');
  });

program.parse();