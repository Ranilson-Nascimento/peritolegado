import { DatabaseAdapter, TableInfo, ColumnInfo } from './types';

export interface ParadoxConfig {
  // Suporte para diferentes localizações do banco
  path?: string;           // Caminho local: C:\dados\paradox
  networkPath?: string;    // Caminho de rede: \\servidor\pasta\dados
  cloudPath?: string;      // Caminho na nuvem (será mapeado)
  
  // Configurações de conexão
  driver?: string;         // Driver ODBC
  username?: string;       // Usuário (se necessário)
  password?: string;       // Senha (se necessário)
  
  // Configurações específicas do Paradox
  version?: string;        // Versão do Paradox (3, 4, 5, 7, etc.)
  encryption?: boolean;    // Se os arquivos estão criptografados
  collation?: string;      // Ordenação (ASCII, ANSI, etc.)
  
  // Configurações de performance
  cacheSize?: number;      // Tamanho do cache
  timeout?: number;        // Timeout de conexão
}

export class ParadoxEnhancedAdapter {
  public readonly type = 'paradox';
  private connection: any = null;
  private resolvedPath: string = '';

  constructor(private config: ParadoxConfig) {}

  async connect(): Promise<any> {
    try {
      // Resolver o caminho do banco (local, rede ou nuvem)
      this.resolvedPath = await this.resolveDatabasePath();
      
      const odbc = require('odbc');
      
      // Configurar string de conexão baseada na localização
      const connectionString = this.buildConnectionString();
      
      console.log(`🔗 Conectando ao Paradox em: ${this.resolvedPath}`);
      
      this.connection = await odbc.connect(connectionString);
      
      // Testar a conexão listando algumas tabelas
      await this.validateConnection();
      
      return this.connection;
    } catch (error: any) {
      throw new Error(`❌ Falha ao conectar no Paradox: ${error.message}`);
    }
  }

  private async resolveDatabasePath(): Promise<string> {
    const fs = require('fs').promises;
    const path = require('path');
    
    // 1. Tentar caminho local primeiro
    if (this.config.path) {
      try {
        await fs.access(this.config.path);
        console.log(`📁 Banco local encontrado: ${this.config.path}`);
        return this.config.path;
      } catch (error) {
        console.log(`⚠️ Caminho local não acessível: ${this.config.path}`);
      }
    }
    
    // 2. Tentar caminho de rede
    if (this.config.networkPath) {
      try {
        await fs.access(this.config.networkPath);
        console.log(`🌐 Banco em rede encontrado: ${this.config.networkPath}`);
        return this.config.networkPath;
      } catch (error) {
        console.log(`⚠️ Caminho de rede não acessível: ${this.config.networkPath}`);
      }
    }
    
    // 3. Tentar mapear caminho da nuvem
    if (this.config.cloudPath) {
      const mappedPath = await this.mapCloudPath(this.config.cloudPath);
      try {
        await fs.access(mappedPath);
        console.log(`☁️ Banco na nuvem mapeado: ${mappedPath}`);
        return mappedPath;
      } catch (error) {
        console.log(`⚠️ Caminho da nuvem não acessível: ${mappedPath}`);
      }
    }
    
    throw new Error('Nenhum caminho válido encontrado para o banco Paradox');
  }

  private async mapCloudPath(cloudPath: string): Promise<string> {
    // Mapear diferentes provedores de nuvem
    if (cloudPath.includes('onedrive') || cloudPath.includes('sharepoint')) {
      return this.mapOneDrivePath(cloudPath);
    } else if (cloudPath.includes('googledrive') || cloudPath.includes('drive.google.com')) {
      return this.mapGoogleDrivePath(cloudPath);
    } else if (cloudPath.includes('dropbox')) {
      return this.mapDropboxPath(cloudPath);
    }
    
    // Assumir que é um caminho UNC ou mapeado
    return cloudPath;
  }

  private mapOneDrivePath(cloudPath: string): string {
    const os = require('os');
    const path = require('path');
    
    // Caminhos típicos do OneDrive
    const oneDrivePaths = [
      path.join(os.homedir(), 'OneDrive'),
      path.join(os.homedir(), 'OneDrive - Personal'),
      path.join(os.homedir(), 'OneDrive - Business'),
    ];
    
    // Extrair parte relativa do caminho
    const relativePath = cloudPath.replace(/.*onedrive[\/\\]/i, '');
    
    for (const basePath of oneDrivePaths) {
      const fullPath = path.join(basePath, relativePath);
      try {
        require('fs').accessSync(fullPath);
        return fullPath;
      } catch (error) {
        continue;
      }
    }
    
    return cloudPath;
  }

  private mapGoogleDrivePath(cloudPath: string): string {
    // Google Drive File Stream typical path
    const path = require('path');
    const driveLetter = 'G:'; // Comum para Google Drive File Stream
    
    const relativePath = cloudPath.replace(/.*googledrive[\/\\]/i, '');
    return path.join(driveLetter, relativePath);
  }

  private mapDropboxPath(cloudPath: string): string {
    const os = require('os');
    const path = require('path');
    
    const dropboxPath = path.join(os.homedir(), 'Dropbox');
    const relativePath = cloudPath.replace(/.*dropbox[\/\\]/i, '');
    
    return path.join(dropboxPath, relativePath);
  }

  private buildConnectionString(): string {
    const driver = this.config.driver || 'Microsoft Paradox Driver (*.db )';
    
    let connectionString = `Driver=${driver};`;
    connectionString += `DefaultDir=${this.resolvedPath};`;
    connectionString += `DriverId=538;`; // Paradox driver ID
    connectionString += `FIL=Paradox;`;
    
    // Configurações específicas baseadas na versão
    if (this.config.version) {
      connectionString += `ParadoxNetStyle=${this.getNetStyleForVersion(this.config.version)};`;
    }
    
    // Configurações de collation
    if (this.config.collation) {
      connectionString += `CollatingSequence=${this.config.collation};`;
    }
    
    // Configurações de performance
    if (this.config.cacheSize) {
      connectionString += `PageTimeout=${this.config.cacheSize};`;
    }
    
    return connectionString;
  }

  private getNetStyleForVersion(version: string): string {
    // Mapear versões do Paradox para NetStyle
    const versionMap: { [key: string]: string } = {
      '3': '3.x',
      '4': '4.x',
      '5': '5.x',
      '7': '7.x',
      '9': '9.x',
      '10': '10.x',
      '11': '11.x'
    };
    
    return versionMap[version] || '4.x';
  }

  private async validateConnection(): Promise<void> {
    try {
      // Listar tabelas para validar a conexão
      const tables = await this.listTables();
      console.log(`✅ Conexão validada. ${tables.length} tabelas encontradas.`);
      
      if (tables.length === 0) {
        console.warn('⚠️ Nenhuma tabela encontrada no diretório especificado');
      }
    } catch (error) {
      throw new Error(`Falha na validação da conexão: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.close();
        console.log('📤 Conexão Paradox fechada');
      } catch (error) {
        console.warn('⚠️ Aviso ao fechar conexão Paradox:', error);
      }
      this.connection = null;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.connect();
      return true;
    } catch (error) {
      console.error('❌ Teste de conexão Paradox falhou:', error);
      return false;
    }
  }

  async query(sql: string, params: any[] = []): Promise<any[]> {
    if (!this.connection) {
      await this.connect();
    }

    try {
      const result = await this.connection.query(sql, params);
      return Array.isArray(result) ? result : [result];
    } catch (error: any) {
      throw new Error(`Erro na query Paradox: ${error.message}\nSQL: ${sql}`);
    }
  }

  async listTables(): Promise<string[]> {
    try {
      // Paradox: listar arquivos .db no diretório
      const fs = require('fs').promises;
      const path = require('path');
      
      const files = await fs.readdir(this.resolvedPath);
      const dbFiles = files
        .filter((file: string) => file.toLowerCase().endsWith('.db'))
        .map((file: string) => path.basename(file, '.db'));
      
      console.log(`📋 Tabelas Paradox encontradas: ${dbFiles.join(', ')}`);
      return dbFiles;
    } catch (error: any) {
      throw new Error(`Erro ao listar tabelas: ${error.message}`);
    }
  }

  async getTableInfo(tableName: string): Promise<TableInfo> {
    try {
      // Obter informações das colunas via ODBC
      const columns = await this.getTableColumns(tableName);
      
      return {
        name: tableName,
        type: 'table' as const,
        columns,
        primaryKeys: await this.getPrimaryKeys(tableName),
        indexes: []
      };
    } catch (error: any) {
      throw new Error(`Erro ao obter informações da tabela ${tableName}: ${error.message}`);
    }
  }

  private async getTableColumns(tableName: string): Promise<ColumnInfo[]> {
    // Query para obter informações das colunas
    const sql = `SELECT * FROM "${tableName}" WHERE 1=0`; // Query vazia para obter metadados
    
    try {
      const result = await this.connection.query(sql);
      const columns = await this.connection.columns(tableName);
      
      return columns.map((col: any) => ({
        name: col.COLUMN_NAME,
        type: this.mapParadoxTypeToFirebird(col.TYPE_NAME, col.COLUMN_SIZE, col.DECIMAL_DIGITS),
        originalType: col.TYPE_NAME,
        nullable: col.NULLABLE === 1,
        defaultValue: col.COLUMN_DEF,
        precision: col.DECIMAL_DIGITS,
        scale: col.NUM_PREC_RADIX
      }));
    } catch (error: any) {
      // Fallback: tentar ler a estrutura diretamente do arquivo
      return await this.readTableStructureFromFile(tableName);
    }
  }

  private mapParadoxTypeToFirebird(paradoxType: string, length?: number, precision?: number): string {
    const typeMap: { [key: string]: string } = {
      'ALPHA': length ? `VARCHAR(${Math.min(length, 32765)})` : 'VARCHAR(255)',
      'NUMBER': precision ? `NUMERIC(18,${precision})` : 'NUMERIC(18,4)',
      'MONEY': 'NUMERIC(15,4)',
      'DATE': 'DATE',
      'TIME': 'TIME',
      'TIMESTAMP': 'TIMESTAMP',
      'MEMO': 'BLOB SUB_TYPE 1',
      'BINARY': 'BLOB SUB_TYPE 0',
      'FORMATTED MEMO': 'BLOB SUB_TYPE 1',
      'OLE': 'BLOB SUB_TYPE 0',
      'GRAPHIC': 'BLOB SUB_TYPE 0',
      'LOGICAL': 'SMALLINT', // 0/1 para false/true
      'AUTOINCREMENT': 'INTEGER',
      'BCD': 'NUMERIC(18,4)',
      'BYTES': `CHAR(${length || 255})`
    };

    return typeMap[paradoxType.toUpperCase()] || 'VARCHAR(255)';
  }

  private async readTableStructureFromFile(tableName: string): Promise<ColumnInfo[]> {
    // Implementação para ler estrutura diretamente do arquivo .db
    // Isso é um fallback quando ODBC não funciona corretamente
    
    console.log(`📖 Lendo estrutura da tabela ${tableName} diretamente do arquivo`);
    
    // Por enquanto, retorna estrutura básica
    // TODO: Implementar parser binário do formato Paradox
    return [
      {
        name: 'ID',
        type: 'INTEGER',
        originalType: 'AUTOINCREMENT',
        nullable: false,
        defaultValue: null,
        precision: 0,
        scale: 0
      }
    ];
  }

  private async getPrimaryKeys(tableName: string): Promise<string[]> {
    try {
      const primaryKeys = await this.connection.primaryKeys(tableName);
      return primaryKeys.map((pk: any) => pk.COLUMN_NAME);
    } catch (error) {
      console.warn(`⚠️ Não foi possível determinar chave primária para ${tableName}`);
      return [];
    }
  }

  async getSchema(): Promise<{ name: string; tables: TableInfo[] }> {
    const tables = await this.listTables();
    const tableInfos: TableInfo[] = [];
    
    console.log(`🔍 Analisando esquema de ${tables.length} tabelas...`);
    
    for (const table of tables) {
      try {
        const tableInfo = await this.getTableInfo(table);
        tableInfos.push(tableInfo);
        console.log(`✅ Tabela ${table}: ${tableInfo.columns.length} colunas`);
      } catch (error) {
        console.error(`❌ Erro ao analisar tabela ${table}:`, error);
      }
    }
    
    return {
      name: `Paradox Database (${this.resolvedPath})`,
      tables: tableInfos
    };
  }

  async streamData(tableName: string, batchSize: number = 1000): Promise<AsyncIterable<any[]>> {
    const totalRecords = await this.getRecordCount(tableName);
    let offset = 0;
    
    console.log(`🚀 Iniciando stream da tabela ${tableName} (${totalRecords} registros)`);
    
    return {
      async *[Symbol.asyncIterator]() {
        while (offset < totalRecords) {
          try {
            // Paradox não suporta LIMIT/OFFSET padrão, usar diferentes estratégias
            const sql = `SELECT * FROM "${tableName}"`;
            const allData = await this.query(sql);
            
            // Simular paginação em memória (não ideal, mas funcional)
            const batch = allData.slice(offset, offset + batchSize);
            
            if (batch.length === 0) break;
            
            console.log(`📦 Lote ${Math.floor(offset/batchSize) + 1}: ${batch.length} registros`);
            yield batch;
            
            offset += batchSize;
            
            if (batch.length < batchSize) break;
          } catch (error) {
            console.error(`❌ Erro no streaming do lote ${offset}-${offset + batchSize}:`, error);
            break;
          }
        }
      }
    };
  }

  async getRecordCount(tableName: string): Promise<number> {
    try {
      const result = await this.query(`SELECT COUNT(*) as TOTAL FROM "${tableName}"`);
      return result[0]?.TOTAL || 0;
    } catch (error) {
      console.warn(`⚠️ Não foi possível contar registros de ${tableName}, usando aproximação`);
      return 0;
    }
  }

  // Métodos não aplicáveis para Paradox (somente leitura)
  async createTable(tableInfo: TableInfo): Promise<void> {
    throw new Error('Paradox é um banco de origem (somente leitura). Use Firebird como destino.');
  }

  async insertData(tableName: string, data: any[]): Promise<void> {
    throw new Error('Paradox é um banco de origem (somente leitura). Use Firebird como destino.');
  }

  async executeTransaction(operations: (() => Promise<void>)[]): Promise<void> {
    throw new Error('Paradox é um banco de origem (somente leitura). Use Firebird como destino.');
  }
}
