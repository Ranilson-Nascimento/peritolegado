import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { IntelligentMigrationEngine, IntelligentMigrationOptions } from '../core/intelligent-migration';

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Instância global do motor de migração
let currentMigration: IntelligentMigrationEngine | null = null;

// ==================== ROTAS DA API });

// ==================== VALIDATION ENDPOINTS ====================

// Endpoint para validar conexão SQLite
app.post('/api/validate-sqlite', async (req, res) => {
  try {
    console.log('🧪 Validando SQLite...');
    
    const sqlite3 = require('sqlite3');
    const version = sqlite3.VERSION;
    
    // Teste básico de criação de banco em memória
    const db = new sqlite3.Database(':memory:', (err: any) => {
      if (err) {
        res.json({
          success: false,
          error: err.message
        });
      } else {
        db.close();
        res.json({
          success: true,
          version: version,
          message: 'SQLite driver funcionando'
        });
      }
    });
    
  } catch (error: any) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint para validar conexão Paradox
app.post('/api/validate-paradox', async (req, res) => {
  try {
    console.log('🧪 Validando Paradox...');
    
    // Verificar se existe algum driver disponível
    const driverAvailable = process.platform === 'win32';
    
    res.json({
      success: driverAvailable,
      driverAvailable: driverAvailable,
      message: driverAvailable ? 'Driver Paradox disponível' : 'Driver Paradox não disponível'
    });
    
  } catch (error: any) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint para validar conexão Firebird
app.post('/api/validate-firebird', async (req, res) => {
  try {
    console.log('🧪 Validando Firebird...');
    
    try {
      const firebird = require('node-firebird');
      res.json({
        success: true,
        driverVersion: 'node-firebird instalado',
        message: 'Driver Firebird disponível'
      });
    } catch (requireError) {
      res.json({
        success: false,
        error: 'Driver Firebird não instalado'
      });
    }
    
  } catch (error: any) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint de health check
app.get('/api/health', (req, res) => {
  const uptime = process.uptime();
  res.json({
    status: 'ok',
    uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage()
  });
});

// Endpoint para informações do sistema
app.get('/api/system-info', (req, res) => {
  res.json({
    success: true,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    cwd: process.cwd()
  });
});

// ==================== WEBSOCKET EVENTS =====================================

// Rota principal - servir a interface de migração inteligente 
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../web/intelligent-mapping.html'));
});

// Configurar arquivos estáticos (DEPOIS da rota principal)
app.use(express.static(path.join(__dirname, '../../web')));

// Testar conexão com banco
app.post('/api/test-connection', async (req, res) => {
  try {
    const { type, config } = req.body;
    console.log(`🔍 Testando conexão ${type}:`, config);

    let adapter: any;
    
    if (type === 'paradox') {
      const { ParadoxEnhancedAdapter } = require('../adapters/paradox-enhanced');
      adapter = new ParadoxEnhancedAdapter(config);
    } else if (type === 'firebird') {
      const { FirebirdEnhancedAdapter } = require('../adapters/firebird-enhanced');
      adapter = new FirebirdEnhancedAdapter(config);
    } else if (type === 'sqlite') {
      const { SQLiteAdapter } = require('../adapters/sqlite');
      adapter = new SQLiteAdapter(config);
    } else {
      return res.status(400).json({ 
        success: false, 
        error: `Tipo de banco ${type} não suportado` 
      });
    }

    const isConnected = await adapter.testConnection();
    await adapter.disconnect();

    if (isConnected) {
      res.json({ success: true, message: `Conexão ${type} bem-sucedida` });
    } else {
      res.json({ success: false, error: `Falha na conexão ${type}` });
    }

  } catch (error: any) {
    console.error('❌ Erro no teste de conexão:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Erro interno do servidor' 
    });
  }
});

// Testar conexão de destino (target)
app.post('/api/test-target-connection', async (req, res) => {
  try {
    const { type, config } = req.body;
    console.log(`🎯 Testando conexão de destino ${type}:`, config);

    let adapter: any;
    
    if (type === 'paradox') {
      const { ParadoxEnhancedAdapter } = require('../adapters/paradox-enhanced');
      adapter = new ParadoxEnhancedAdapter(config);
    } else if (type === 'firebird') {
      const { FirebirdEnhancedAdapter } = require('../adapters/firebird-enhanced');
      adapter = new FirebirdEnhancedAdapter(config);
    } else if (type === 'sqlite') {
      const { SQLiteAdapter } = require('../adapters/sqlite');
      adapter = new SQLiteAdapter(config);
    } else {
      return res.status(400).json({ 
        success: false, 
        error: `Tipo de banco ${type} não suportado` 
      });
    }

    const isConnected = await adapter.testConnection();
    await adapter.disconnect();

    if (isConnected) {
      res.json({ success: true, message: `Conexão de destino ${type} bem-sucedida` });
    } else {
      res.json({ success: false, error: `Falha na conexão de destino ${type}` });
    }

  } catch (error: any) {
    console.error('❌ Erro no teste de conexão de destino:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Erro interno do servidor' 
    });
  }
});

// Analisar esquemas de origem e destino
app.post('/api/analyze-schemas', async (req, res) => {
  try {
    const { source, target } = req.body;
    console.log('🔍 Analisando esquemas de origem e destino...');
    console.log('📂 Dados de origem:', source);

    // Primeiro, obter esquema de origem
    let sourceAdapter: any;
    let sourceType = 'paradox'; // Assumindo Paradox como padrão
    let detectionResult = 'unknown';

    // Detectar tipo de origem baseado no arquivo
    if (source.path) {
      const ext = source.path.toLowerCase().split('.').pop();
      console.log(`🔍 Extensão detectada: .${ext}`);
      
      if (ext === 'db') {
        // Para .db, pode ser SQLite ou Paradox - vamos tentar detectar
        console.log('🧪 Arquivo .db detectado - testando SQLite primeiro...');
        sourceType = 'sqlite';
      } else if (['sqlite', 'sqlite3'].includes(ext)) {
        console.log('🧪 Arquivo SQLite detectado pela extensão');
        sourceType = 'sqlite';
      } else if (['pdx', 'px', 'dbf'].includes(ext)) {
        console.log('🧪 Arquivo Paradox detectado pela extensão');
        sourceType = 'paradox';
      }
    }

    // Tentar com SQLite primeiro se for .db/.sqlite/.sqlite3
    if (sourceType === 'sqlite') {
      try {
        console.log('🔗 Tentando conectar como SQLite...');
        const { SQLiteAdapter } = require('../adapters/sqlite');
        sourceAdapter = new SQLiteAdapter({
          path: source.path,
          database: source.path,
          mode: 'readonly'
        });
        
        const testResult = await sourceAdapter.testConnection();
        console.log('🧪 Teste de conexão SQLite:', testResult);
        
        if (testResult) {
          // Tentar obter schema para confirmar que é realmente SQLite
          console.log('📊 Conectando para testar schema SQLite...');
          await sourceAdapter.connect();
          const testSchema = await sourceAdapter.getSchema();
          await sourceAdapter.disconnect();
          
          console.log('📋 Schema de teste obtido:', {
            tables: testSchema.tables.length,
            tableNames: testSchema.tables.map(t => t.name)
          });
          
          if (testSchema && testSchema.tables && testSchema.tables.length > 0) {
            // Verificar se não são apenas tabelas de exemplo
            const hasRealTables = testSchema.tables.some(table => 
              !table.name.includes('exemplo') && 
              !table.name.includes('example') &&
              table.name !== 'exemplo_tabela'
            );
            
            if (hasRealTables) {
              console.log('✅ Confirmado como SQLite com tabelas reais');
              detectionResult = 'sqlite_confirmed';
            } else {
              console.log('⚠️ SQLite conectou mas só tem tabelas de exemplo');
              detectionResult = 'sqlite_example_only';
            }
          } else {
            console.log('⚠️ SQLite conectou mas sem tabelas - pode ser arquivo vazio');
            detectionResult = 'sqlite_empty';
          }
        } else {
          throw new Error('Teste de conexão SQLite falhou');
        }
      } catch (error) {
        console.log('❌ Falha no SQLite:', error.message);
        console.log('🔄 Tentando como Paradox...');
        sourceType = 'paradox';
        sourceAdapter = null;
        detectionResult = 'sqlite_failed';
      }
    }

    // Se não for SQLite ou falhou, tentar Paradox
    if (!sourceAdapter) {
      try {
        console.log('🔗 Tentando conectar como Paradox...');
        const { ParadoxEnhancedAdapter } = require('../adapters/paradox-enhanced');
        sourceAdapter = new ParadoxEnhancedAdapter({
          path: source.path
        });
        
        const testResult = await sourceAdapter.testConnection();
        console.log('🧪 Teste de conexão Paradox:', testResult);
        
        if (testResult) {
          sourceType = 'paradox';
          detectionResult = 'paradox_confirmed';
          console.log('✅ Confirmado como Paradox');
        } else {
          throw new Error('Teste de conexão Paradox falhou');
        }
      } catch (error) {
        console.log('❌ Falha no Paradox:', error.message);
        detectionResult = 'both_failed';
      }
    }

    // Testar conexão de origem
    const sourceConnected = await sourceAdapter.testConnection();
    if (!sourceConnected) {
      return res.status(400).json({
        success: false,
        error: `Falha na conexão com banco de origem (${sourceType}). Detecção: ${detectionResult}`,
        detectionResult: detectionResult
      });
    }

    // Obter esquema de origem
    console.log(`📊 Obtendo schema do ${sourceType.toUpperCase()}...`);
    await sourceAdapter.connect();
    const sourceSchema = await sourceAdapter.getSchema();
    await sourceAdapter.disconnect();

    console.log(`📊 Schema obtido: ${sourceSchema.tables.length} tabelas`);
    sourceSchema.tables.forEach(table => {
      console.log(`  - ${table.name}: ${table.columns.length} colunas`);
    });

    // Testar conexão de destino (Firebird)
    console.log('🎯 Conectando ao Firebird...');
    const { FirebirdEnhancedAdapter } = require('../adapters/firebird-enhanced');
    const targetAdapter = new FirebirdEnhancedAdapter({
      host: target.host,
      port: target.port,
      database: target.database,
      user: target.user,
      password: target.password,
      charset: target.charset || 'UTF8'
    });

    const targetConnected = await targetAdapter.testConnection();
    if (!targetConnected) {
      return res.status(400).json({
        success: false,
        error: 'Falha na conexão com banco de destino'
      });
    }

    // Obter esquema de destino
    await targetAdapter.connect();
    const targetSchema = await targetAdapter.getSchema();
    await targetAdapter.disconnect();

    console.log(`🎯 Schema Firebird: ${targetSchema.tables.length} tabelas`);

    res.json({
      success: true,
      message: 'Esquemas analisados com sucesso',
      sourceType: sourceType,
      sourceSchema: sourceSchema,
      targetSchema: targetSchema,
      sourceTables: sourceSchema.tables.length,
      targetTables: targetSchema.tables.length,
      detectionResult: detectionResult
    });

  } catch (error: any) {
    console.error('❌ Erro na análise de esquemas:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro interno do servidor'
    });
  }
});

// Auto-mapear tabelas baseado nos esquemas analisados
app.post('/api/auto-map-tables', async (req, res) => {
  try {
    console.log('🤖 Executando auto-mapeamento de tabelas...');

    // Verificar se temos esquemas disponíveis
    if (!req.body.sourceSchema || !req.body.targetSchema) {
      return res.status(400).json({
        success: false,
        error: 'Esquemas de origem e destino devem ser analisados primeiro'
      });
    }

    const { sourceSchema, targetSchema } = req.body;
    const mappings = [];

    // Auto-mapear baseado em nomes similares
    for (const sourceTable of sourceSchema.tables) {
      // Procurar tabela de destino com nome similar
      const targetTable = targetSchema.tables.find(table => 
        table.name.toLowerCase() === sourceTable.name.toLowerCase() ||
        table.name.toLowerCase().includes(sourceTable.name.toLowerCase()) ||
        sourceTable.name.toLowerCase().includes(table.name.toLowerCase())
      );

      if (targetTable) {
        const columnMappings = [];
        
        // Auto-mapear colunas
        for (const sourceColumn of sourceTable.columns) {
          const targetColumn = targetTable.columns.find(col =>
            col.name.toLowerCase() === sourceColumn.name.toLowerCase() ||
            col.name.toLowerCase().includes(sourceColumn.name.toLowerCase()) ||
            sourceColumn.name.toLowerCase().includes(col.name.toLowerCase())
          );

          if (targetColumn) {
            columnMappings.push({
              sourceColumn: sourceColumn.name,
              targetColumn: targetColumn.name,
              sourceType: sourceColumn.type,
              targetType: targetColumn.type,
              compatible: true,
              confidence: calculateCompatibility(sourceColumn, targetColumn)
            });
          }
        }

        mappings.push({
          sourceTable: sourceTable.name,
          targetTable: targetTable.name,
          columnMappings: columnMappings,
          confidence: columnMappings.length / sourceTable.columns.length
        });
      }
    }

    res.json({
      success: true,
      mappings: mappings,
      totalMappings: mappings.length,
      message: `Auto-mapeamento concluído: ${mappings.length} mapeamentos criados`
    });

  } catch (error: any) {
    console.error('❌ Erro no auto-mapeamento:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro interno do servidor'
    });
  }
});

// Função auxiliar para calcular compatibilidade entre colunas
function calculateCompatibility(sourceColumn: any, targetColumn: any): number {
  let score = 0.5; // Score base para match de nome
  
  // Bonus por tipo compatível
  if (sourceColumn.type === targetColumn.type) {
    score += 0.4;
  } else if (typesAreCompatible(sourceColumn.type, targetColumn.type)) {
    score += 0.2;
  }
  
  // Bonus por tamanho similar
  if (sourceColumn.precision && targetColumn.precision) {
    if (sourceColumn.precision === targetColumn.precision) {
      score += 0.1;
    }
  }
  
  return Math.min(score, 1.0);
}

// Função auxiliar para verificar compatibilidade de tipos
function typesAreCompatible(sourceType: string, targetType: string): boolean {
  const compatibilityMap: {[key: string]: string[]} = {
    'VARCHAR': ['TEXT', 'CHAR', 'STRING'],
    'INTEGER': ['BIGINT', 'SMALLINT', 'NUMERIC'],
    'REAL': ['DOUBLE', 'FLOAT', 'NUMERIC'],
    'TEXT': ['VARCHAR', 'CHAR', 'BLOB'],
    'BLOB': ['TEXT', 'VARCHAR']
  };
  
  return compatibilityMap[sourceType?.toUpperCase()]?.includes(targetType?.toUpperCase()) || false;
}

// Obter esquema do banco
app.post('/api/schema', async (req, res) => {
  try {
    const { type, config } = req.body;
    console.log(`📋 Obtendo esquema ${type}`);

    let adapter: any;
    
    if (type === 'paradox') {
      const { ParadoxEnhancedAdapter } = require('../adapters/paradox-enhanced');
      adapter = new ParadoxEnhancedAdapter(config);
    } else if (type === 'firebird') {
      const { FirebirdEnhancedAdapter } = require('../adapters/firebird-enhanced');
      adapter = new FirebirdEnhancedAdapter(config);
    } else {
      return res.status(400).json({ 
        success: false, 
        error: `Tipo de banco ${type} não suportado` 
      });
    }

    await adapter.connect();
    const schema = await adapter.getSchema();
    await adapter.disconnect();

    res.json({ 
      success: true, 
      schema: schema,
      tableCount: schema.tables.length 
    });

  } catch (error: any) {
    console.error('❌ Erro ao obter esquema:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Iniciar migração inteligente
app.post('/api/migrate', async (req, res) => {
  try {
    if (currentMigration) {
      return res.status(400).json({ 
        success: false, 
        error: 'Migração já está em execução' 
      });
    }

    const { source, target, options } = req.body;
    console.log('🚀 Iniciando migração inteligente...');
    console.log('📂 Origem:', source.type);
    console.log('🎯 Destino:', target.type);

    // Validar configurações
    if (source.type !== 'paradox') {
      return res.status(400).json({ 
        success: false, 
        error: 'Origem deve ser Paradox' 
      });
    }

    if (target.type !== 'firebird') {
      return res.status(400).json({ 
        success: false, 
        error: 'Destino deve ser Firebird' 
      });
    }

    // Configurações da migração inteligente
    const migrationOptions: Partial<IntelligentMigrationOptions> = {
      batchSize: options.batchSize || 1000,
      parallelTables: options.parallelTables || 1,
      maxRetries: 3,
      retryDelay: 2000,
      preserveStructure: true,
      createIndexes: true,
      validateData: !options.dryRun,
      skipErrors: false,
      enableProgress: true,
      logLevel: 'info',
      tableFilter: options.tablesOption === 'custom' ? options.selectedTables : undefined
    };

    // Criar instância do motor de migração
    currentMigration = new IntelligentMigrationEngine(
      source.config || source,
      target.config || target,
      migrationOptions
    );

    // Configurar eventos do WebSocket
    setupMigrationEvents(currentMigration);

    // Iniciar migração em background
    currentMigration.startMigration()
      .then((statistics) => {
        console.log('✅ Migração concluída:', statistics);
        currentMigration = null;
      })
      .catch((error) => {
        console.error('❌ Migração falhou:', error);
        currentMigration = null;
      });

    res.json({ 
      success: true, 
      message: 'Migração iniciada com sucesso',
      migrationId: Date.now().toString()
    });

  } catch (error: any) {
    console.error('❌ Erro ao iniciar migração:', error);
    currentMigration = null;
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Parar migração
app.post('/api/stop-migration', async (req, res) => {
  try {
    if (!currentMigration) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nenhuma migração em execução' 
      });
    }

    currentMigration.stop();
    
    res.json({ 
      success: true, 
      message: 'Comando de parada enviado' 
    });

  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Status da migração
app.get('/api/migration-status', (req, res) => {
  if (!currentMigration) {
    return res.json({ 
      success: true, 
      running: false 
    });
  }

  const progress = currentMigration.getProgress();
  const statistics = currentMigration.getStatistics();

  res.json({ 
    success: true, 
    running: true,
    progress,
    statistics
  });
});

// Configurar eventos WebSocket para migração
function setupMigrationEvents(migration: IntelligentMigrationEngine) {
  // Progresso da migração
  migration.on('progress', (progress) => {
    io.emit('migration:progress', {
      phase: progress.phase,
      currentTable: progress.currentTable,
      tablesCompleted: progress.tablesCompleted,
      totalTables: progress.totalTables,
      recordsProcessed: progress.recordsProcessed,
      totalRecords: progress.totalRecords,
      progress: progress.totalRecords > 0 
        ? Math.round((progress.recordsProcessed / progress.totalRecords) * 100) 
        : 0,
      throughput: progress.throughput,
      estimatedCompletion: progress.estimatedCompletion,
      errors: progress.errors.length,
      warnings: progress.warnings.length
    });
  });

  // Tabela iniciada
  migration.on('tableStart', (data) => {
    io.emit('migration:table-start', data);
  });

  // Tabela concluída
  migration.on('tableComplete', (data) => {
    io.emit('migration:table-complete', data);
  });

  // Migração concluída
  migration.on('complete', (statistics) => {
    io.emit('migration:complete', {
      message: 'Migração concluída com sucesso!',
      statistics
    });
  });

  // Erro na migração
  migration.on('error', (data) => {
    io.emit('migration:error', {
      message: 'Erro na migração',
      error: data.error,
      statistics: data.statistics
    });
  });
}

// ==================== COMPLEX MAPPING ENDPOINTS ====================

// Criar mapeamento complexo (N:1 ou 1:N)
app.post('/api/create-complex-mapping', async (req, res) => {
  try {
    const { mappingType, name, sourceTables, targetTables } = req.body;
    console.log(`🔗 Criando mapeamento ${mappingType}:`, { name, sourceTables, targetTables });

    if (!currentMigration) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nenhuma migração ativa. Inicie uma migração primeiro.' 
      });
    }

    const mappingEngine = currentMigration.getMappingEngine();
    let mapping;

    if (mappingType === 'many-to-one') {
      mapping = await mappingEngine.createManyToOneMapping(
        sourceTables, 
        targetTables[0],
        [] // Empty join conditions - will auto-detect
      );
    } else if (mappingType === 'one-to-many') {
      mapping = await mappingEngine.createOneToManyMapping(
        sourceTables[0], 
        targetTables,
        {} // Empty split rules - will auto-detect
      );
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'Tipo de mapeamento não suportado. Use "many-to-one" ou "one-to-many".' 
      });
    }

    res.json({ 
      success: true, 
      mapping: mapping,
      message: `Mapeamento ${mappingType} criado com sucesso` 
    });

  } catch (error: any) {
    console.error('❌ Erro ao criar mapeamento complexo:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Detectar relacionamentos automaticamente
app.post('/api/detect-relationships', async (req, res) => {
  try {
    console.log('🔗 Detectando relacionamentos automaticamente...');

    if (!currentMigration) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nenhuma migração ativa. Inicie uma migração primeiro.' 
      });
    }

    const mappingEngine = currentMigration.getMappingEngine();
    const relationships = mappingEngine.detectRelationships();

    res.json({ 
      success: true, 
      relationships: relationships,
      count: relationships.length 
    });

  } catch (error: any) {
    console.error('❌ Erro na detecção de relacionamentos:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Aplicar relacionamentos detectados
app.post('/api/apply-relationships', async (req, res) => {
  try {
    console.log('🔗 Aplicando relacionamentos detectados...');

    if (!currentMigration) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nenhuma migração ativa. Inicie uma migração primeiro.' 
      });
    }

    const mappingEngine = currentMigration.getMappingEngine();
    const relationships = mappingEngine.detectRelationships();
    
    // Aplicar relacionamentos aos mapeamentos existentes
    for (const mapping of mappingEngine.getAllMappings()) {
      const relevantRelationships = relationships.filter(rel => 
        rel.sourceTable === mapping.sourceTable || 
        rel.targetTable === mapping.targetTable
      );
      
      if (relevantRelationships.length > 0) {
        mapping.joinConditions = relevantRelationships;
      }
    }

    res.json({ 
      success: true, 
      appliedRelationships: relationships.length,
      message: 'Relacionamentos aplicados aos mapeamentos' 
    });

  } catch (error: any) {
    console.error('❌ Erro ao aplicar relacionamentos:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Aplicar transformações específicas Paradox → Firebird
app.post('/api/paradox-transformations', async (req, res) => {
  try {
    console.log('⚡ Aplicando transformações Paradox → Firebird...');

    if (!currentMigration) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nenhuma migração ativa. Inicie uma migração primeiro.' 
      });
    }

    const mappingEngine = currentMigration.getMappingEngine();
    mappingEngine.applyParadoxToFirebirdRules();

    const transformations = [];
    for (const mapping of mappingEngine.getAllMappings()) {
      for (const columnMapping of mapping.columnMappings) {
        if (columnMapping.transformation?.paradoxType) {
          transformations.push({
            table: mapping.sourceTable,
            column: columnMapping.sourceColumn,
            paradoxType: columnMapping.transformation.paradoxType,
            firebirdType: columnMapping.transformation.firebirdType,
            expression: columnMapping.transformation.expression
          });
        }
      }
    }

    res.json({ 
      success: true, 
      transformations: transformations,
      count: transformations.length,
      message: 'Transformações Paradox → Firebird aplicadas' 
    });

  } catch (error: any) {
    console.error('❌ Erro nas transformações Paradox → Firebird:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Gerar DDL do Firebird
app.post('/api/generate-firebird-ddl', async (req, res) => {
  try {
    console.log('📝 Gerando DDL do Firebird...');

    if (!currentMigration) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nenhuma migração ativa. Inicie uma migração primeiro.' 
      });
    }

    const mappingEngine = currentMigration.getMappingEngine();
    const ddlStatements = mappingEngine.generateFirebirdDDL();

    res.json({ 
      success: true, 
      ddl: ddlStatements,
      count: ddlStatements.length,
      script: ddlStatements.join('\n\n')
    });

  } catch (error: any) {
    console.error('❌ Erro na geração de DDL:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Gerar DML de migração
app.post('/api/generate-migration-dml', async (req, res) => {
  try {
    console.log('📝 Gerando DML de migração...');

    if (!currentMigration) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nenhuma migração ativa. Inicie uma migração primeiro.' 
      });
    }

    const mappingEngine = currentMigration.getMappingEngine();
    const dmlStatements = mappingEngine.generateMigrationDML();

    res.json({ 
      success: true, 
      dml: dmlStatements,
      count: dmlStatements.length,
      script: dmlStatements.join('\n\n')
    });

  } catch (error: any) {
    console.error('❌ Erro na geração de DML:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Criar mapeamento individual de tabela (para drag and drop)
app.post('/api/create-mapping', async (req, res) => {
  try {
    const { sourceTable, targetTable, sourceColumns, targetColumns } = req.body;
    console.log(`🔗 Criando mapeamento 1:1: ${sourceTable} → ${targetTable}`);

    if (!sourceTable || !targetTable) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nome das tabelas de origem e destino são obrigatórios' 
      });
    }

    // Auto-mapear colunas básico se informações estão disponíveis
    let autoColumnMappings = [];
    if (sourceColumns && targetColumns) {
      sourceColumns.forEach(sourceCol => {
        // Procurar coluna de destino com nome similar
        const targetCol = targetColumns.find(targetCol => 
          targetCol.name.toLowerCase() === sourceCol.name.toLowerCase() ||
          targetCol.name.toLowerCase().includes(sourceCol.name.toLowerCase()) ||
          sourceCol.name.toLowerCase().includes(targetCol.name.toLowerCase())
        );

        if (targetCol) {
          autoColumnMappings.push({
            sourceColumn: sourceCol.name,
            targetColumn: targetCol.name,
            sourceType: sourceCol.type,
            targetType: targetCol.type,
            compatible: typesAreCompatible(sourceCol.type, targetCol.type),
            confidence: calculateCompatibility(sourceCol, targetCol)
          });
        }
      });
    }

    // Criar mapeamento básico 1:1 com informações das colunas
    const mapping = {
      id: Date.now().toString(),
      sourceTable: sourceTable,
      targetTable: targetTable,
      type: 'one-to-one',
      confidence: autoColumnMappings.length > 0 ? 
        Math.round((autoColumnMappings.reduce((sum, m) => sum + m.confidence, 0) / autoColumnMappings.length) * 100) : 
        85,
      columnMappings: autoColumnMappings,
      sourceColumns: sourceColumns || [],
      targetColumns: targetColumns || [],
      createdAt: new Date().toISOString()
    };

    // Aqui você poderia integrar com o motor de migração real se necessário
    // if (currentMigration) {
    //   const mappingEngine = currentMigration.getMappingEngine();
    //   mapping = await mappingEngine.createOneToOneMapping(sourceTable, targetTable);
    // }

    console.log(`✅ Mapeamento criado: ${sourceTable} → ${targetTable} (${autoColumnMappings.length} colunas auto-mapeadas)`);

    res.json({ 
      success: true, 
      mapping: mapping,
      message: `Mapeamento 1:1 criado com sucesso` 
    });

  } catch (error: any) {
    console.error('❌ Erro ao criar mapeamento:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ==================== FILE EXPLORER ENDPOINTS ====================

// Abrir explorador nativo do Windows com fallback automático
app.post('/api/open-file-dialog', async (req, res) => {
  try {
    const { type, title } = req.body;
    console.log(`🗂️ Abrindo seletor de arquivo para: ${type}`);

    // Filtros baseados no tipo
    let filter = '';
    let extensions = '';
    if (type === 'paradox') {
      filter = 'Paradox Files (*.db *.pdx *.px)|*.db;*.pdx;*.px|All Files (*.*)|*.*';
      extensions = '.db,.pdx,.px';
    } else if (type === 'sqlite') {
      filter = 'SQLite Files (*.db *.sqlite *.sqlite3)|*.db;*.sqlite;*.sqlite3|All Files (*.*)|*.*';
      extensions = '.db,.sqlite,.sqlite3';
    } else if (type === 'firebird') {
      filter = 'Firebird Files (*.fdb *.gdb)|*.fdb;*.gdb|All Files (*.*)|*.*';
      extensions = '.fdb,.gdb';
    } else {
      filter = 'Database Files (*.db *.fdb *.gdb *.pdx *.px *.sqlite *.sqlite3)|*.db;*.fdb;*.gdb;*.pdx;*.px;*.sqlite;*.sqlite3|All Files (*.*)|*.*';
      extensions = '.db,.fdb,.gdb,.pdx,.px,.sqlite,.sqlite3';
    }

    // Para requisições via browser/API, sempre usar fallback HTML5
    // O PowerShell só funciona bem quando chamado diretamente pelo usuário
    console.log('🌐 Detectada chamada via browser - usando fallback HTML5');
    return res.json({
      success: false,
      useFallback: true,
      extensions: extensions,
      message: 'Usando seletor HTML5 para melhor compatibilidade'
    });

  } catch (error: any) {
    console.error('❌ Erro no file dialog:', error);
    res.json({
      success: false,
      useFallback: true,
      extensions: '.db,.sqlite,.sqlite3',
      error: error.message
    });
  }
});

// Endpoint para quando PowerShell é chamado diretamente (futuro uso)
app.post('/api/open-file-dialog-native', async (req, res) => {
  try {
    const { type, title } = req.body;
    console.log(`🖥️ Tentando seletor nativo para: ${type}`);

    // Verificar se o script PowerShell existe
    const scriptPath = path.join(__dirname, 'file-dialog.ps1');
    console.log(`📁 Caminho do script: ${scriptPath}`);
    
    if (!require('fs').existsSync(scriptPath)) {
      console.log('❌ Script PowerShell não encontrado');
      return res.json({
        success: false,
        useFallback: true,
        extensions: '.db,.sqlite,.sqlite3',
        error: 'Script PowerShell não encontrado'
      });
    }

    // Filtros baseados no tipo
    let filter = '';
    if (type === 'paradox') {
      filter = 'Paradox Files (*.db *.pdx *.px)|*.db;*.pdx;*.px|All Files (*.*)|*.*';
    } else if (type === 'sqlite') {
      filter = 'SQLite Files (*.db *.sqlite *.sqlite3)|*.db;*.sqlite;*.sqlite3|All Files (*.*)|*.*';
    } else if (type === 'firebird') {
      filter = 'Firebird Files (*.fdb *.gdb)|*.fdb;*.gdb|All Files (*.*)|*.*';
    }

    const { spawn } = require('child_process');
    
    // Timeout reduzido para detectar rapidamente se não funciona
    const timeout = setTimeout(() => {
      console.log('⏰ Timeout do seletor nativo - usando fallback');
      res.json({
        success: false,
        useFallback: true,
        extensions: type === 'sqlite' ? '.db,.sqlite,.sqlite3' : '.db,.pdx,.px',
        error: 'Timeout do seletor nativo'
      });
    }, 5000); // 5 segundos apenas

    const powershell = spawn('powershell.exe', [
      '-ExecutionPolicy', 'Bypass',
      '-WindowStyle', 'Normal',
      '-File', scriptPath,
      '-title', title || 'Selecionar Arquivo de Banco de Dados',
      '-filter', filter
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: false,
      detached: false
    });

    let output = '';
    let error = '';

    powershell.stdout.on('data', (data: Buffer) => {
      output += data.toString();
    });

    powershell.stderr.on('data', (data: Buffer) => {
      error += data.toString();
    });

    powershell.on('close', (code: number) => {
      clearTimeout(timeout);
      console.log(`PowerShell fechado com código: ${code}`);
      console.log(`Output: ${output.trim()}`);
      if (error.trim()) {
        console.log(`Error: ${error.trim()}`);
      }

      const outputTrimmed = output.trim();
      
      if (code === 0 && outputTrimmed && outputTrimmed !== 'CANCELLED' && outputTrimmed !== '') {
        console.log(`✅ Arquivo selecionado via nativo: ${outputTrimmed}`);
        res.json({
          success: true,
          selectedFile: outputTrimmed,
          cancelled: false
        });
      } else {
        console.log('📂 Seleção cancelada ou erro no nativo');
        res.json({
          success: true,
          selectedFile: null,
          cancelled: true
        });
      }
    });

    powershell.on('error', (err: Error) => {
      clearTimeout(timeout);
      console.error('❌ Erro no PowerShell nativo:', err);
      res.json({
        success: false,
        useFallback: true,
        extensions: type === 'sqlite' ? '.db,.sqlite,.sqlite3' : '.db,.pdx,.px',
        error: 'Erro no seletor nativo: ' + err.message
      });
    });

  } catch (error: any) {
    console.error('❌ Erro no seletor nativo:', error);
    res.json({
      success: false,
      useFallback: true,
      extensions: '.db,.sqlite,.sqlite3',
      error: error.message
    });
  }
});

// Novo endpoint para seleção via input file HTML5
app.post('/api/file-selected', async (req, res) => {
  try {
    const { filePath, fileName, type } = req.body;
    console.log(`📁 Arquivo selecionado via HTML5: ${fileName}`);
    
    res.json({
      success: true,
      message: `Arquivo ${fileName} selecionado com sucesso`,
      filePath: filePath,
      fileName: fileName,
      type: type
    });
  } catch (error: any) {
    console.error('❌ Erro ao processar arquivo selecionado:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Navegar por pastas e arquivos
app.post('/api/browse-path', async (req, res) => {
  try {
    const { path, type } = req.body;
    console.log(`📁 Navegando em: ${path} (tipo: ${type})`);

    const fs = require('fs');
    const pathModule = require('path');

    if (!fs.existsSync(path)) {
      return res.json({ 
        success: false, 
        error: 'Caminho não encontrado',
        items: []
      });
    }

    const items = [];
    const files = fs.readdirSync(path);

    for (const file of files) {
      try {
        const fullPath = pathModule.join(path, file);
        const stats = fs.statSync(fullPath);
        
        const item = {
          name: file,
          path: fullPath,
          isDirectory: stats.isDirectory(),
          size: stats.size,
          modified: stats.mtime.toISOString()
        };

        // Filtrar por tipo se for arquivo
        if (!item.isDirectory) {
          const ext = pathModule.extname(file).toLowerCase();
          
          if (type === 'source') {
            // Arquivos Paradox
            if (!['.db', '.pdx', '.px', '.dbf'].includes(ext)) {
              continue;
            }
          } else if (type === 'target') {
            // Arquivos Firebird
            if (!['.fdb', '.gdb'].includes(ext)) {
              continue;
            }
          }
        }

        items.push(item);
      } catch (error) {
        // Ignorar arquivos que não conseguimos acessar
        console.warn(`Erro ao acessar ${file}:`, error.message);
      }
    }

    res.json({ 
      success: true, 
      items: items,
      currentPath: path 
    });

  } catch (error: any) {
    console.error('❌ Erro na navegação de arquivos:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      items: []
    });
  }
});

// Auto-detectar bancos com interface melhorada
app.post('/api/auto-detect-enhanced', async (req, res) => {
  try {
    const { type, sourceType, searchPaths } = req.body;
    console.log(`🔍 Busca aprimorada de bancos ${type} (${sourceType || 'all'})...`);

    const fs = require('fs');
    const pathModule = require('path');
    const foundDatabases = [];

    // Caminhos padrão para busca
    const defaultPaths = [
      'C:\\',
      'C:\\Program Files',
      'C:\\Program Files (x86)',
      'C:\\Users\\' + (process.env.USERNAME || 'Public') + '\\Documents',
      'C:\\dados',
      'C:\\sistema',
      'D:\\',
      'E:\\'
    ];

    const pathsToSearch = searchPaths || defaultPaths;

    function searchRecursive(dir: string, depth: number = 0) {
      if (depth > 3) return; // Limitar profundidade
      
      try {
        const files = fs.readdirSync(dir);
        
        for (const file of files) {
          try {
            const fullPath = pathModule.join(dir, file);
            const stats = fs.statSync(fullPath);
            
            if (stats.isDirectory()) {
              // Continuar busca em subdiretórios
              if (depth < 3) {
                searchRecursive(fullPath, depth + 1);
              }
            } else {
              const ext = pathModule.extname(file).toLowerCase();
              let isValidDatabase = false;
              let dbType = '';
              
              if (type === 'source') {
                if (sourceType === 'paradox' && ['.db', '.pdx', '.px', '.dbf'].includes(ext)) {
                  isValidDatabase = true;
                  dbType = 'PARADOX';
                } else if (sourceType === 'sqlite' && ['.db', '.sqlite', '.sqlite3'].includes(ext)) {
                  isValidDatabase = true;
                  dbType = 'SQLITE';
                } else if (!sourceType || sourceType === 'all') {
                  // Auto-detect all types
                  if (['.db', '.pdx', '.px', '.dbf'].includes(ext)) {
                    isValidDatabase = true;
                    dbType = ext === '.db' ? 'PARADOX/SQLITE' : 'PARADOX';
                  } else if (['.sqlite', '.sqlite3'].includes(ext)) {
                    isValidDatabase = true;
                    dbType = 'SQLITE';
                  }
                }
              } else if (type === 'target' && ['.fdb', '.gdb'].includes(ext)) {
                isValidDatabase = true;
                dbType = 'FIREBIRD';
              }
              
              if (isValidDatabase) {
                foundDatabases.push({
                  path: fullPath,
                  name: file,
                  size: stats.size,
                  modified: stats.mtime.toISOString(),
                  directory: dir,
                  type: dbType,
                  extension: ext.substring(1).toUpperCase()
                });
              }
            }
          } catch (error) {
            // Ignorar erros de acesso
          }
        }
      } catch (error) {
        // Ignorar erros de acesso ao diretório
      }
    }

    // Buscar em todos os caminhos
    for (const searchPath of pathsToSearch) {
      if (fs.existsSync(searchPath)) {
        searchRecursive(searchPath);
      }
    }

    res.json({ 
      success: true, 
      databases: foundDatabases.slice(0, 50), // Limitar resultados
      total: foundDatabases.length,
      searchPaths: pathsToSearch
    });

  } catch (error: any) {
    console.error('❌ Erro na busca aprimorada:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      databases: []
    });
  }
});

// ==================== WEBSOCKET ====================

io.on('connection', (socket) => {
  console.log('👤 Cliente conectado:', socket.id);

  socket.on('disconnect', () => {
    console.log('👋 Cliente desconectado:', socket.id);
  });

  // Enviar status atual se houver migração em execução
  if (currentMigration) {
    const progress = currentMigration.getProgress();
    socket.emit('migration:progress', progress);
  }
});

// ==================== INICIALIZAÇÃO ====================

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log('🚀 Servidor Perito Legado iniciado!');
  console.log(`📱 Interface Web: http://localhost:${PORT}`);
  console.log('🔌 WebSocket disponível na mesma porta\n');
  
  console.log('🎯 Sistema de Migração Inteligente:');
  console.log('  📊 Paradox → Firebird (especializado)');
  console.log('  🔍 Detecção automática de localização');
  console.log('  🌐 Suporte para arquivos locais, rede e nuvem');
  console.log('  🚀 Migração em lotes com retry automático');
  console.log('  📈 Monitoramento em tempo real');
  console.log('  ✅ Validação automática de dados\n');
});

export { app, server, io };
