import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import {
  MySQLAdapter,
  ParadoxAdapter,
  // PostgresAdapter,
  // OracleAdapter,
  // SQLServerAdapter,
  // MongoDBAdapter,
  // FirebirdAdapter,
  DatabaseAdapter
} from '../adapters';
import { MigrationEngine, MigrationConfig } from '../core/migration-engine';

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../web')));

// Instância global do motor de migração
const migrationEngine = new MigrationEngine();

// Factory de adaptadores
const adapterFactory = {
  mysql: () => new MySQLAdapter(),
  paradox: () => new ParadoxAdapter(),
  // postgres: () => new PostgresAdapter(),
  // oracle: () => new OracleAdapter(),
  // sqlserver: () => new SQLServerAdapter(),
  // mongodb: () => new MongoDBAdapter(),
  // firebird: () => new FirebirdAdapter(),
};

// ==================== ROTAS DA API ====================

// Rota principal - servir a interface
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../web/index.html'));
});

// Listar bancos de dados suportados
app.get('/api/databases', (_req, res) => {
  res.json({
    databases: [
      {
        id: 'paradox',
        name: 'Paradox',
        description: 'Banco de dados Paradox via ODBC',
        icon: 'database',
        supportedAsSource: true,
        supportedAsTarget: false,
        connectionFields: [
          { name: 'path', label: 'Caminho dos arquivos', type: 'text', required: true, placeholder: 'C:\\Database\\Paradox' },
          { name: 'driver', label: 'Driver ODBC', type: 'text', required: false, placeholder: 'Microsoft Paradox Driver (*.db )' }
        ]
      },
      {
        id: 'firebird',
        name: 'Firebird',
        description: 'Banco de dados Firebird',
        icon: 'fire',
        supportedAsSource: true,
        supportedAsTarget: true,
        connectionFields: [
          { name: 'host', label: 'Servidor', type: 'text', required: true, placeholder: 'localhost' },
          { name: 'port', label: 'Porta', type: 'number', required: false, placeholder: '3050' },
          { name: 'database', label: 'Arquivo do banco', type: 'text', required: true, placeholder: '/path/to/database.fdb' },
          { name: 'user', label: 'Usuário', type: 'text', required: true, placeholder: 'SYSDBA' },
          { name: 'password', label: 'Senha', type: 'password', required: true }
        ]
      },
      {
        id: 'mysql',
        name: 'MySQL',
        description: 'Banco de dados MySQL/MariaDB',
        icon: 'server',
        supportedAsSource: true,
        supportedAsTarget: true,
        connectionFields: [
          { name: 'host', label: 'Servidor', type: 'text', required: true, placeholder: 'localhost' },
          { name: 'port', label: 'Porta', type: 'number', required: false, placeholder: '3306' },
          { name: 'database', label: 'Base de dados', type: 'text', required: true },
          { name: 'user', label: 'Usuário', type: 'text', required: true, placeholder: 'root' },
          { name: 'password', label: 'Senha', type: 'password', required: true }
        ]
      },
      {
        id: 'postgres',
        name: 'PostgreSQL',
        description: 'Banco de dados PostgreSQL',
        icon: 'database',
        supportedAsSource: true,
        supportedAsTarget: true,
        connectionFields: [
          { name: 'host', label: 'Servidor', type: 'text', required: true, placeholder: 'localhost' },
          { name: 'port', label: 'Porta', type: 'number', required: false, placeholder: '5432' },
          { name: 'database', label: 'Base de dados', type: 'text', required: true },
          { name: 'user', label: 'Usuário', type: 'text', required: true, placeholder: 'postgres' },
          { name: 'password', label: 'Senha', type: 'password', required: true }
        ]
      }
    ]
  });
});

// Testar conexão com banco
app.post('/api/test-connection', async (req, res) => {
  try {
    const { database, config } = req.body;
    
    if (!adapterFactory[database as keyof typeof adapterFactory]) {
      return res.status(400).json({ error: 'Banco de dados não suportado' });
    }

    const adapter = adapterFactory[database as keyof typeof adapterFactory]() as any;
    await adapter.connect(config);
    await adapter.testConnection();
    await adapter.disconnect();

    return res.json({ success: true, message: 'Conexão estabelecida com sucesso' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obter esquema de um banco
app.post('/api/get-schema', async (req, res) => {
  try {
    const { database, config } = req.body;
    
    if (!adapterFactory[database as keyof typeof adapterFactory]) {
      return res.status(400).json({ error: 'Banco de dados não suportado' });
    }

    const adapter = adapterFactory[database as keyof typeof adapterFactory]() as any;
    await adapter.connect(config);
    const schema = await adapter.getSchema();
    await adapter.disconnect();

    return res.json({ success: true, schema });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Iniciar migração
app.post('/api/start-migration', async (req, res) => {
  try {
    const { source, target, options } = req.body;

    const migrationConfig: MigrationConfig = {
      source: {
        adapter: adapterFactory[source.database as keyof typeof adapterFactory]() as any,
        config: source.config
      },
      target: {
        adapter: adapterFactory[target.database as keyof typeof adapterFactory]() as any,
        config: target.config
      },
      tables: options.tables || 'all',
      batchSize: options.batchSize || 1000,
      parallelTables: options.parallelTables || 1,
      dryRun: options.dryRun || false,
      mapping: options.mapping,
      filters: options.filters,
      transforms: options.transforms
    };

    const jobId = await migrationEngine.startMigration(migrationConfig);
    
    return res.json({ success: true, jobId });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obter status de migração
app.get('/api/migration-status/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    const status = migrationEngine.getMigrationStatus(jobId);
    
    if (!status) {
      return res.status(404).json({ error: 'Migração não encontrada' });
    }

    return res.json({ success: true, status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Parar migração
app.post('/api/stop-migration/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    await migrationEngine.stopMigration(jobId);
    
    res.json({ success: true, message: 'Migração parada' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Listar migrações ativas
app.get('/api/active-migrations', (_req, res) => {
  try {
    const migrations = migrationEngine.getActiveMigrations();
    res.json({ success: true, migrations });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== WEBSOCKET EVENTS ====================

io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);

  // Configurar listeners do motor de migração para este socket
  const setupMigrationListeners = (jobId: string) => {
    migrationEngine.on('migration:started', (id) => {
      if (id === jobId) {
        socket.emit('migration:started', { jobId: id });
      }
    });

    migrationEngine.on('migration:progress', (id, progress) => {
      if (id === jobId) {
        socket.emit('migration:progress', { jobId: id, progress });
      }
    });

    migrationEngine.on('table:started', (id, tableName) => {
      if (id === jobId) {
        socket.emit('table:started', { jobId: id, tableName });
      }
    });

    migrationEngine.on('table:completed', (id, tableName, rowCount) => {
      if (id === jobId) {
        socket.emit('table:completed', { jobId: id, tableName, rowCount });
      }
    });

    migrationEngine.on('migration:completed', (id) => {
      if (id === jobId) {
        socket.emit('migration:completed', { jobId: id });
      }
    });

    migrationEngine.on('migration:failed', (id, error) => {
      if (id === jobId) {
        socket.emit('migration:failed', { jobId: id, error: error.message });
      }
    });
  };

  // Cliente se inscreve para receber updates de uma migração específica
  socket.on('subscribe:migration', (data) => {
    const { jobId } = data;
    setupMigrationListeners(jobId);
    console.log(`Cliente ${socket.id} inscrito para migração ${jobId}`);
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

// Iniciar servidor
const PORT = process.env['PORT'] || 3000;

server.listen(PORT, () => {
  console.log('🚀 Servidor Perito Legado iniciado!');
  console.log(`📱 Interface Web: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket disponível na mesma porta`);
  console.log('');
  console.log('Bancos suportados:');
  console.log('  📊 Paradox (origem)');
  console.log('  🔥 Firebird (origem/destino)');
  console.log('  🐬 MySQL (origem/destino)');
  console.log('  🐘 PostgreSQL (origem/destino)');
});

export default app;
