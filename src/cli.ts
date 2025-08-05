#!/usr/bin/env node

import { Command } from 'commander';
import { MySQLAdapter, PostgresAdapter, OracleAdapter, SQLServerAdapter, MongoDBAdapter, FirebirdAdapter } from './adapters';

const program = new Command();

/**
 * Map of adapter names to their classes. New adapters should be added here.
 */
const adapterFactories: Record<string, () => any> = {
  mysql: () => new MySQLAdapter(),
  postgres: () => new PostgresAdapter(),
  oracle: () => new OracleAdapter(),
  sqlserver: () => new SQLServerAdapter(),
  mongodb: () => new MongoDBAdapter(),
  firebird: () => new FirebirdAdapter(),
};

program
  .name('perito-cli')
  .description('CLI do Perito em Legado para testar conexões de bancos de dados')
  .version('0.1.0');

program
  .command('test-connection')
  .description('Testa a conexão com um banco de dados específico')
  .requiredOption('-d, --db <database>', 'Nome do banco (mysql, postgres, oracle, sqlserver, mongodb, firebird)')
  .action(async (options) => {
    const dbName = (options.db as string).toLowerCase();
    const factory = adapterFactories[dbName];
    if (!factory) {
      console.error(`Banco desconhecido: ${dbName}`);
      process.exit(1);
    }
    const adapter = factory();
    try {
      console.log(`Testando conexão com ${dbName}...`);
      await adapter.testConnection();
      console.log(`Conexão com ${dbName} bem-sucedida.`);
    } catch (err) {
      console.error(`Erro ao conectar com ${dbName}:`, err);
    } finally {
      if (adapter.disconnect) {
        await adapter.disconnect();
      }
    }
  });

program.parse(process.argv);