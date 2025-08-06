import { EventEmitter } from 'events';
import { DatabaseAdapter, TableInfo, ColumnInfo } from '../adapters/types';

/**
 * Interface para configuração de mapeamento de tabelas
 */
export interface TableMapping {
  id: string;
  sourceTable: string;
  sourceSchema?: string;
  targetTable: string;
  targetSchema?: string;
  columnMappings: ColumnMapping[];
  transformation?: DataTransformation;
  enabled: boolean;
  confidence: number; // 0-100: confiança do mapeamento automático
  mappingType: 'one-to-one' | 'many-to-one' | 'one-to-many' | 'many-to-many';
  joinConditions?: JoinCondition[];
  filterConditions?: string[];
}

/**
 * Interface para mapeamento de colunas
 */
export interface ColumnMapping {
  id: string;
  sourceColumn: string;
  sourceType: string;
  targetColumn: string;
  targetType: string;
  transformation?: FieldTransformation;
  nullable: boolean;
  defaultValue?: any;
  confidence: number;
  autoDetected: boolean;
  paradoxType?: string; // Tipo original do Paradox
  firebirdType?: string; // Tipo convertido para Firebird
}

/**
 * Interface para condições de junção
 */
export interface JoinCondition {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
}

/**
 * Interface para transformação de dados específica Paradox → Firebird
 */
export interface DataTransformation {
  type: 'direct' | 'custom' | 'lookup' | 'aggregate' | 'split' | 'merge';
  expression?: string;
  lookupTable?: string;
  lookupMapping?: Record<string, any>;
  filters?: string[];
  validation?: ValidationRule[];
  paradoxSpecific?: ParadoxTransformation;
  firebirdSpecific?: FirebirdTransformation;
}

/**
 * Transformações específicas do Paradox
 */
export interface ParadoxTransformation {
  handleEmptyStrings?: boolean; // Paradox usa espaços em branco
  trimSpaces?: boolean;
  convertDates?: boolean; // Conversão de datas do Paradox
  handleCurrency?: boolean; // Tipo Currency do Paradox
  booleanConversion?: 'T/F' | '1/0' | 'true/false';
}

/**
 * Transformações específicas do Firebird
 */
export interface FirebirdTransformation {
  useGenerators?: boolean; // Para campos auto-incremento
  generatorName?: string;
  useUTF8?: boolean;
  setBlobSubtype?: boolean;
  timestampPrecision?: number;
}

/**
 * Interface para transformação de campo
 */
export interface FieldTransformation {
  type: 'direct' | 'convert' | 'format' | 'calculate' | 'lookup';
  expression?: string;
  format?: string;
  precision?: number;
  scale?: number;
  lookupValues?: Record<string, any>;
  validation?: ValidationRule;
  paradoxType?: string;
  firebirdType?: string;
}

/**
 * Interface para regras de validação
 */
export interface ValidationRule {
  type: 'required' | 'length' | 'range' | 'pattern' | 'custom';
  value?: any;
  min?: number;
  max?: number;
  pattern?: string;
  customFunction?: string;
  errorMessage?: string;
}

/**
 * Interface para sugestões de mapeamento
 */
export interface MappingSuggestion {
  type: 'table' | 'column';
  sourceItem: string;
  targetItem: string;
  confidence: number;
  reason: string;
  transformation?: any;
}

/**
 * Configuração do motor de mapeamento
 */
export interface MappingEngineConfig {
  similarityThreshold: number; // 0.0-1.0
  autoMapTables: boolean;
  autoMapColumns: boolean;
  smartTypeConversion: boolean;
  preserveNaming: boolean;
  useAI: boolean;
}

/**
 * Motor de Mapeamento Inteligente
 */
export class IntelligentMappingEngine extends EventEmitter {
  private config: MappingEngineConfig;
  private sourceSchema: TableInfo[] = [];
  private targetSchema: TableInfo[] = [];
  private tableMappings: Map<string, TableMapping> = new Map();
  private suggestions: MappingSuggestion[] = [];

  constructor(config: Partial<MappingEngineConfig> = {}) {
    super();
    
    this.config = {
      similarityThreshold: 0.7,
      autoMapTables: true,
      autoMapColumns: true,
      smartTypeConversion: true,
      preserveNaming: false,
      useAI: true,
      ...config
    };

    this.emit('initialized', { config: this.config });
  }

  /**
   * Analisa esquemas de origem e destino
   */
  async analyzeSchemas(
    sourceAdapter: DatabaseAdapter<any>,
    targetAdapter: DatabaseAdapter<any>
  ): Promise<void> {
    this.emit('analysis-started');

    try {
      // Obter esquemas
      const sourceSchema = await sourceAdapter.getSchema();
      const targetSchema = await targetAdapter.getSchema();

      this.sourceSchema = sourceSchema.tables;
      this.targetSchema = targetSchema.tables;

      this.emit('schemas-loaded', {
        source: {
          name: sourceSchema.name,
          tables: this.sourceSchema.length,
          columns: this.sourceSchema.reduce((acc, t) => acc + t.columns.length, 0)
        },
        target: {
          name: targetSchema.name,
          tables: this.targetSchema.length,
          columns: this.targetSchema.reduce((acc, t) => acc + t.columns.length, 0)
        }
      });

      // Gerar sugestões automáticas
      if (this.config.autoMapTables) {
        await this.generateTableSuggestions();
      }

      this.emit('analysis-completed', {
        suggestions: this.suggestions.length,
        autoMapped: this.tableMappings.size
      });

    } catch (error) {
      this.emit('analysis-error', error);
      throw error;
    }
  }

  /**
   * Gera sugestões automáticas de mapeamento de tabelas
   */
  private async generateTableSuggestions(): Promise<void> {
    this.suggestions = [];

    for (const sourceTable of this.sourceSchema) {
      const suggestions = this.findTableSuggestions(sourceTable);
      
      if (suggestions.length > 0) {
        const bestMatch = suggestions[0];
        
        if (bestMatch.confidence >= this.config.similarityThreshold) {
          // Auto-mapear tabela com alta confiança
          await this.createTableMapping(sourceTable.name, bestMatch.targetItem, true);
        }
        
        this.suggestions.push(...suggestions);
      }
    }

    this.emit('suggestions-generated', {
      total: this.suggestions.length,
      autoMapped: this.tableMappings.size
    });
  }

  /**
   * Encontra sugestões de tabelas similares
   */
  private findTableSuggestions(sourceTable: TableInfo): MappingSuggestion[] {
    const suggestions: MappingSuggestion[] = [];

    for (const targetTable of this.targetSchema) {
      const similarity = this.calculateTableSimilarity(sourceTable, targetTable);
      
      if (similarity > 0.3) { // Threshold mínimo
        suggestions.push({
          type: 'table',
          sourceItem: sourceTable.name,
          targetItem: targetTable.name,
          confidence: similarity,
          reason: this.getTableSimilarityReason(sourceTable, targetTable, similarity)
        });
      }
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Calcula similaridade entre tabelas
   */
  private calculateTableSimilarity(source: TableInfo, target: TableInfo): number {
    let similarity = 0;
    let factors = 0;

    // 1. Similaridade de nomes (40% do peso)
    const nameSimilarity = this.calculateStringSimilarity(source.name, target.name);
    similarity += nameSimilarity * 0.4;
    factors += 0.4;

    // 2. Similaridade de estrutura - número de colunas (20% do peso)
    const columnCountRatio = Math.min(source.columns.length, target.columns.length) / 
                            Math.max(source.columns.length, target.columns.length);
    similarity += columnCountRatio * 0.2;
    factors += 0.2;

    // 3. Similaridade de colunas (40% do peso)
    const columnSimilarity = this.calculateColumnStructureSimilarity(source.columns, target.columns);
    similarity += columnSimilarity * 0.4;
    factors += 0.4;

    return similarity / factors;
  }

  /**
   * Calcula similaridade entre estruturas de colunas
   */
  private calculateColumnStructureSimilarity(sourceColumns: ColumnInfo[], targetColumns: ColumnInfo[]): number {
    let matchingColumns = 0;
    let totalWeight = 0;

    for (const sourceCol of sourceColumns) {
      let bestMatch = 0;
      
      for (const targetCol of targetColumns) {
        const nameSim = this.calculateStringSimilarity(sourceCol.name, targetCol.name);
        const typeSim = this.calculateTypeSimilarity(sourceCol.type, targetCol.type);
        const colSim = (nameSim * 0.7) + (typeSim * 0.3);
        
        bestMatch = Math.max(bestMatch, colSim);
      }
      
      matchingColumns += bestMatch;
      totalWeight += 1;
    }

    return totalWeight > 0 ? matchingColumns / totalWeight : 0;
  }

  /**
   * Calcula similaridade entre strings (algoritmo Levenshtein normalizado)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 1;
    if (s1.length === 0 || s2.length === 0) return 0;

    // Verificar se uma string está contida na outra
    if (s1.includes(s2) || s2.includes(s1)) {
      return 0.8; // Alta similaridade para substring
    }

    // Algoritmo Levenshtein
    const matrix = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));

    for (let i = 0; i <= s1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= s2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= s2.length; j++) {
      for (let i = 1; i <= s1.length; i++) {
        const substitutionCost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + substitutionCost // substitution
        );
      }
    }

    const maxLength = Math.max(s1.length, s2.length);
    return (maxLength - matrix[s2.length][s1.length]) / maxLength;
  }

  /**
   * Calcula similaridade entre tipos de dados
   */
  private calculateTypeSimilarity(type1: string, type2: string): number {
    const t1 = type1.toUpperCase();
    const t2 = type2.toUpperCase();

    if (t1 === t2) return 1;

    // Grupos de tipos compatíveis
    const typeGroups = [
      ['VARCHAR', 'CHAR', 'TEXT', 'STRING'],
      ['INTEGER', 'INT', 'SMALLINT', 'BIGINT', 'NUMBER'],
      ['DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE', 'REAL'],
      ['DATE', 'DATETIME', 'TIMESTAMP'],
      ['BOOLEAN', 'BIT', 'LOGICAL'],
      ['BLOB', 'BINARY', 'VARBINARY']
    ];

    for (const group of typeGroups) {
      if (group.includes(t1) && group.includes(t2)) {
        return 0.8; // Alta compatibilidade dentro do mesmo grupo
      }
    }

    return 0; // Tipos incompatíveis
  }

  /**
   * Gera razão para similaridade de tabelas
   */
  private getTableSimilarityReason(source: TableInfo, target: TableInfo, similarity: number): string {
    if (similarity > 0.9) return `Nome muito similar e estrutura compatível`;
    if (similarity > 0.7) return `Estrutura de colunas compatível`;
    if (similarity > 0.5) return `Algumas colunas similares encontradas`;
    return `Possível correspondência baseada em análise estrutural`;
  }

  /**
   * Cria mapeamento de tabela
   */
  async createTableMapping(
    sourceTable: string,
    targetTable: string,
    autoDetected: boolean = false
  ): Promise<TableMapping> {
    const sourceTableInfo = this.sourceSchema.find(t => t.name === sourceTable);
    const targetTableInfo = this.targetSchema.find(t => t.name === targetTable);

    if (!sourceTableInfo || !targetTableInfo) {
      throw new Error(`Tabela não encontrada: ${sourceTable} ou ${targetTable}`);
    }

    const mappingId = `${sourceTable}_to_${targetTable}`;
    
    // Gerar mapeamentos de colunas automáticos
    const columnMappings = await this.generateColumnMappings(
      sourceTableInfo.columns,
      targetTableInfo.columns
    );

    const mapping: TableMapping = {
      id: mappingId,
      sourceTable,
      targetTable,
      columnMappings,
      enabled: true,
      confidence: autoDetected ? 
        this.calculateTableSimilarity(sourceTableInfo, targetTableInfo) * 100 : 100,
      mappingType: 'one-to-one' // Padrão para mapeamento simples
    };

    this.tableMappings.set(mappingId, mapping);

    this.emit('table-mapped', {
      mapping,
      autoDetected,
      columnMappings: columnMappings.length
    });

    return mapping;
  }

  /**
   * Cria mapeamento complexo N:1 (múltiplas tabelas → uma tabela)
   */
  async createManyToOneMapping(
    sourceTables: string[],
    targetTable: string,
    joinConditions: JoinCondition[]
  ): Promise<TableMapping> {
    if (sourceTables.length < 2) {
      throw new Error('Mapeamento N:1 requer pelo menos 2 tabelas de origem');
    }

    const targetTableInfo = this.targetSchema.find(t => t.name === targetTable);
    if (!targetTableInfo) {
      throw new Error(`Tabela de destino não encontrada: ${targetTable}`);
    }

    const mappingId = `${sourceTables.join('_')}_to_${targetTable}`;
    
    // Combinar colunas de todas as tabelas de origem
    const allSourceColumns: ColumnInfo[] = [];
    for (const sourceTable of sourceTables) {
      const sourceTableInfo = this.sourceSchema.find(t => t.name === sourceTable);
      if (sourceTableInfo) {
        allSourceColumns.push(...sourceTableInfo.columns.map(col => ({
          ...col,
          name: `${sourceTable}.${col.name}` // Prefixar com nome da tabela
        })));
      }
    }

    const columnMappings = await this.generateColumnMappings(
      allSourceColumns,
      targetTableInfo.columns
    );

    const mapping: TableMapping = {
      id: mappingId,
      sourceTable: sourceTables.join(','), // Múltiplas tabelas
      targetTable,
      columnMappings,
      enabled: true,
      confidence: 85, // Confiança média para mapeamentos complexos
      mappingType: 'many-to-one',
      joinConditions
    };

    this.tableMappings.set(mappingId, mapping);

    this.emit('complex-mapping-created', {
      type: 'many-to-one',
      mapping,
      sourceTables,
      targetTable
    });

    return mapping;
  }

  /**
   * Cria mapeamento complexo 1:N (uma tabela → múltiplas tabelas)
   */
  async createOneToManyMapping(
    sourceTable: string,
    targetTables: string[],
    splitRules: Record<string, string[]>
  ): Promise<TableMapping[]> {
    if (targetTables.length < 2) {
      throw new Error('Mapeamento 1:N requer pelo menos 2 tabelas de destino');
    }

    const sourceTableInfo = this.sourceSchema.find(t => t.name === sourceTable);
    if (!sourceTableInfo) {
      throw new Error(`Tabela de origem não encontrada: ${sourceTable}`);
    }

    const mappings: TableMapping[] = [];

    for (const targetTable of targetTables) {
      const targetTableInfo = this.targetSchema.find(t => t.name === targetTable);
      if (!targetTableInfo) continue;

      const mappingId = `${sourceTable}_to_${targetTable}_split`;
      
      // Mapear apenas as colunas específicas para esta tabela
      const relevantColumns = splitRules[targetTable] || [];
      const filteredSourceColumns = sourceTableInfo.columns.filter(col => 
        relevantColumns.includes(col.name)
      );

      const columnMappings = await this.generateColumnMappings(
        filteredSourceColumns,
        targetTableInfo.columns
      );

      const mapping: TableMapping = {
        id: mappingId,
        sourceTable,
        targetTable,
        columnMappings,
        enabled: true,
        confidence: 80,
        mappingType: 'one-to-many',
        filterConditions: [`-- Split rule: ${relevantColumns.join(', ')}`]
      };

      this.tableMappings.set(mappingId, mapping);
      mappings.push(mapping);
    }

    this.emit('complex-mapping-created', {
      type: 'one-to-many',
      mappings,
      sourceTable,
      targetTables
    });

    return mappings;
  }

  /**
   * Cria transformação específica Paradox → Firebird
   */
  createParadoxToFirebirdTransformation(
    sourceColumn: ColumnInfo,
    targetColumn: ColumnInfo
  ): FieldTransformation {
    const sourceType = sourceColumn.type.toUpperCase();
    const targetType = targetColumn.type.toUpperCase();

    // Transformações específicas Paradox → Firebird
    if (sourceType === 'A' || sourceType === 'ALPHA') {
      // Campo Alpha do Paradox → VARCHAR do Firebird
      return {
        type: 'convert',
        expression: `TRIM(${sourceColumn.name})`, // Remover espaços em branco
        validation: {
          type: 'length',
          max: targetColumn.maxLength || 255,
          errorMessage: 'Texto muito longo para o campo de destino'
        },
        paradoxType: 'ALPHA',
        firebirdType: 'VARCHAR'
      };
    }

    if (sourceType === 'N' || sourceType === 'NUMBER') {
      // Campo Number do Paradox → NUMERIC do Firebird
      return {
        type: 'convert',
        expression: `CAST(${sourceColumn.name} AS NUMERIC(${targetColumn.precision || 15},${targetColumn.scale || 2}))`,
        precision: targetColumn.precision || 15,
        scale: targetColumn.scale || 2,
        paradoxType: 'NUMBER',
        firebirdType: 'NUMERIC'
      };
    }

    if (sourceType === 'C' || sourceType === 'CURRENCY') {
      // Campo Currency do Paradox → NUMERIC(15,2) do Firebird
      return {
        type: 'convert',
        expression: `CAST(${sourceColumn.name} AS NUMERIC(15,2))`,
        precision: 15,
        scale: 2,
        paradoxType: 'CURRENCY',
        firebirdType: 'NUMERIC'
      };
    }

    if (sourceType === 'D' || sourceType === 'DATE') {
      // Campo Date do Paradox → DATE do Firebird
      return {
        type: 'format',
        format: 'YYYY-MM-DD',
        expression: `CAST(${sourceColumn.name} AS DATE)`,
        paradoxType: 'DATE',
        firebirdType: 'DATE'
      };
    }

    if (sourceType === 'T' || sourceType === 'TIME') {
      // Campo Time do Paradox → TIME do Firebird
      return {
        type: 'format',
        format: 'HH:mm:ss',
        expression: `CAST(${sourceColumn.name} AS TIME)`,
        paradoxType: 'TIME',
        firebirdType: 'TIME'
      };
    }

    if (sourceType === '@' || sourceType === 'TIMESTAMP') {
      // Campo TimeStamp do Paradox → TIMESTAMP do Firebird
      return {
        type: 'format',
        format: 'YYYY-MM-DD HH:mm:ss',
        expression: `CAST(${sourceColumn.name} AS TIMESTAMP)`,
        paradoxType: 'TIMESTAMP',
        firebirdType: 'TIMESTAMP'
      };
    }

    if (sourceType === 'L' || sourceType === 'LOGICAL') {
      // Campo Logical do Paradox → BOOLEAN do Firebird (Firebird 3.0+)
      return {
        type: 'convert',
        expression: `CASE WHEN ${sourceColumn.name} = 'T' THEN TRUE WHEN ${sourceColumn.name} = 'F' THEN FALSE ELSE NULL END`,
        paradoxType: 'LOGICAL',
        firebirdType: 'BOOLEAN'
      };
    }

    if (sourceType === 'M' || sourceType === 'MEMO') {
      // Campo Memo do Paradox → BLOB SUB_TYPE TEXT do Firebird
      return {
        type: 'convert',
        expression: `CAST(${sourceColumn.name} AS BLOB SUB_TYPE TEXT)`,
        paradoxType: 'MEMO',
        firebirdType: 'BLOB SUB_TYPE TEXT'
      };
    }

    if (sourceType === '#' || sourceType === '+') {
      // Campo Autoincrement do Paradox → INTEGER com Generator do Firebird
      return {
        type: 'calculate',
        expression: `GEN_ID(GEN_${targetColumn.name.toUpperCase()}, 1)`,
        paradoxType: 'AUTOINCREMENT',
        firebirdType: 'INTEGER'
      };
    }

    // Conversão padrão
    return {
      type: 'convert',
      expression: `CAST(${sourceColumn.name} AS ${targetType})`
    };
  }

  /**
   * Gera mapeamentos automáticos de colunas
   */
  private async generateColumnMappings(
    sourceColumns: ColumnInfo[],
    targetColumns: ColumnInfo[]
  ): Promise<ColumnMapping[]> {
    const mappings: ColumnMapping[] = [];

    for (const sourceCol of sourceColumns) {
      const bestMatch = this.findBestColumnMatch(sourceCol, targetColumns);
      
      if (bestMatch) {
        const transformation = this.generateFieldTransformation(sourceCol, bestMatch.column);
        
        mappings.push({
          id: `${sourceCol.name}_to_${bestMatch.column.name}`,
          sourceColumn: sourceCol.name,
          sourceType: sourceCol.type,
          targetColumn: bestMatch.column.name,
          targetType: bestMatch.column.type,
          transformation,
          nullable: bestMatch.column.nullable,
          confidence: bestMatch.confidence * 100,
          autoDetected: true
        });
      }
    }

    return mappings;
  }

  /**
   * Encontra melhor correspondência para uma coluna
   */
  private findBestColumnMatch(
    sourceColumn: ColumnInfo,
    targetColumns: ColumnInfo[]
  ): { column: ColumnInfo; confidence: number } | null {
    let bestMatch: { column: ColumnInfo; confidence: number } | null = null;

    for (const targetCol of targetColumns) {
      const nameSimilarity = this.calculateStringSimilarity(sourceColumn.name, targetCol.name);
      const typeSimilarity = this.calculateTypeSimilarity(sourceColumn.type, targetCol.type);
      
      const confidence = (nameSimilarity * 0.7) + (typeSimilarity * 0.3);
      
      if (confidence > 0.5 && (!bestMatch || confidence > bestMatch.confidence)) {
        bestMatch = { column: targetCol, confidence };
      }
    }

    return bestMatch;
  }

  /**
   * Gera transformação de campo automaticamente
   */
  private generateFieldTransformation(
    sourceColumn: ColumnInfo,
    targetColumn: ColumnInfo
  ): FieldTransformation {
    // Usar transformação específica Paradox → Firebird se disponível
    if (this.isParadoxColumn(sourceColumn)) {
      return this.createParadoxToFirebirdTransformation(sourceColumn, targetColumn);
    }

    // Usar transformação específica SQLite → Firebird se disponível
    if (this.isSQLiteColumn(sourceColumn)) {
      return this.createSQLiteToFirebirdTransformation(sourceColumn, targetColumn);
    }

    const sourceType = sourceColumn.type.toUpperCase();
    const targetType = targetColumn.type.toUpperCase();

    // Transformação direta se tipos compatíveis
    if (this.calculateTypeSimilarity(sourceType, targetType) >= 0.8) {
      return { type: 'direct' };
    }

    // Conversão de string para número
    if (['VARCHAR', 'CHAR', 'TEXT'].includes(sourceType) && 
        ['INTEGER', 'DECIMAL', 'NUMERIC'].includes(targetType)) {
      return {
        type: 'convert',
        expression: `CAST(${sourceColumn.name} AS ${targetType})`,
        validation: {
          type: 'pattern',
          pattern: '^[0-9.,-]+$',
          errorMessage: 'Valor deve ser numérico'
        }
      };
    }

    // Conversão de número para string
    if (['INTEGER', 'DECIMAL', 'NUMERIC'].includes(sourceType) && 
        ['VARCHAR', 'CHAR', 'TEXT'].includes(targetType)) {
      return {
        type: 'convert',
        expression: `CAST(${sourceColumn.name} AS ${targetType})`
      };
    }

    // Formatação de data
    if (sourceType.includes('DATE') && targetType.includes('DATE')) {
      return {
        type: 'format',
        format: 'YYYY-MM-DD HH:mm:ss'
      };
    }

    // Conversão padrão
    return {
      type: 'convert',
      expression: `CAST(${sourceColumn.name} AS ${targetType})`
    };
  }

  /**
   * Verifica se é uma coluna do Paradox
   */
  private isParadoxColumn(column: ColumnInfo): boolean {
    const paradoxTypes = ['A', 'N', 'C', 'D', 'T', '@', 'L', 'M', 'B', 'F', 'O', 'G', '#', '+', 'Y'];
    return paradoxTypes.includes(column.type) || column.originalType?.length === 1;
  }

  /**
   * Verifica se é uma coluna do SQLite
   */
  private isSQLiteColumn(column: ColumnInfo): boolean {
    const sqliteTypes = ['INTEGER', 'TEXT', 'REAL', 'BLOB', 'NUMERIC'];
    return sqliteTypes.includes(column.type.toUpperCase());
  }

  /**
   * Cria transformação específica SQLite → Firebird
   */
  createSQLiteToFirebirdTransformation(
    sourceColumn: ColumnInfo,
    targetColumn: ColumnInfo
  ): FieldTransformation {
    const sourceType = sourceColumn.type.toUpperCase();
    const targetType = targetColumn.type.toUpperCase();

    // Transformações específicas SQLite → Firebird
    if (sourceType === 'TEXT' && targetType.includes('VARCHAR')) {
      return {
        type: 'convert',
        expression: `CAST(${sourceColumn.name} AS VARCHAR(${targetColumn.maxLength || 255}))`,
        validation: {
          type: 'length',
          max: targetColumn.maxLength || 255,
          errorMessage: 'Texto muito longo para o campo de destino'
        },
        paradoxType: 'TEXT',
        firebirdType: 'VARCHAR'
      };
    }

    if (sourceType === 'INTEGER' && targetType === 'INTEGER') {
      return {
        type: 'direct',
        paradoxType: 'INTEGER',
        firebirdType: 'INTEGER'
      };
    }

    if (sourceType === 'REAL' && targetType.includes('NUMERIC')) {
      return {
        type: 'convert',
        expression: `CAST(${sourceColumn.name} AS NUMERIC(${targetColumn.precision || 15},${targetColumn.scale || 2}))`,
        precision: targetColumn.precision || 15,
        scale: targetColumn.scale || 2,
        paradoxType: 'REAL',
        firebirdType: 'NUMERIC'
      };
    }

    if (sourceType === 'BLOB' && targetType.includes('BLOB')) {
      return {
        type: 'convert',
        expression: `CAST(${sourceColumn.name} AS BLOB SUB_TYPE BINARY)`,
        paradoxType: 'BLOB',
        firebirdType: 'BLOB SUB_TYPE BINARY'
      };
    }

    // Conversão padrão
    return {
      type: 'convert',
      expression: `CAST(${sourceColumn.name} AS ${targetType})`
    };
  }

  /**
   * Obtém todos os mapeamentos de tabelas
   */
  getTableMappings(): TableMapping[] {
    return Array.from(this.tableMappings.values());
  }

  /**
   * Obtém mapeamento específico
   */
  getTableMapping(id: string): TableMapping | undefined {
    return this.tableMappings.get(id);
  }

  /**
   * Atualiza mapeamento de tabela
   */
  updateTableMapping(id: string, updates: Partial<TableMapping>): void {
    const mapping = this.tableMappings.get(id);
    if (mapping) {
      Object.assign(mapping, updates);
      this.emit('mapping-updated', { id, mapping });
    }
  }

  /**
   * Remove mapeamento de tabela
   */
  removeTableMapping(id: string): void {
    if (this.tableMappings.delete(id)) {
      this.emit('mapping-removed', { id });
    }
  }

  /**
   * Obtém sugestões de mapeamento
   */
  getSuggestions(): MappingSuggestion[] {
    return this.suggestions;
  }

  /**
   * Obtém esquema de origem
   */
  getSourceSchema(): TableInfo[] {
    return this.sourceSchema;
  }

  /**
   * Obtém esquema de destino
   */
  getTargetSchema(): TableInfo[] {
    return this.targetSchema;
  }

  /**
   * Valida todos os mapeamentos
   */
  validateMappings(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const mapping of this.tableMappings.values()) {
      // Verificar se tabelas existem
      const sourceExists = this.sourceSchema.some(t => t.name === mapping.sourceTable);
      const targetExists = this.targetSchema.some(t => t.name === mapping.targetTable);

      if (!sourceExists) {
        errors.push(`Tabela de origem não encontrada: ${mapping.sourceTable}`);
      }

      if (!targetExists) {
        errors.push(`Tabela de destino não encontrada: ${mapping.targetTable}`);
      }

      // Verificar mapeamentos de colunas
      for (const colMapping of mapping.columnMappings) {
        if (sourceExists) {
          const sourceTable = this.sourceSchema.find(t => t.name === mapping.sourceTable)!;
          const sourceColExists = sourceTable.columns.some(c => c.name === colMapping.sourceColumn);
          
          if (!sourceColExists) {
            errors.push(`Coluna de origem não encontrada: ${mapping.sourceTable}.${colMapping.sourceColumn}`);
          }
        }

        if (targetExists) {
          const targetTable = this.targetSchema.find(t => t.name === mapping.targetTable)!;
          const targetColExists = targetTable.columns.some(c => c.name === colMapping.targetColumn);
          
          if (!targetColExists) {
            errors.push(`Coluna de destino não encontrada: ${mapping.targetTable}.${colMapping.targetColumn}`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Exporta configuração de mapeamento
   */
  exportMappingConfig(): any {
    return {
      config: this.config,
      mappings: Array.from(this.tableMappings.values()),
      sourceSchema: this.sourceSchema.map(t => ({ name: t.name, columns: t.columns.length })),
      targetSchema: this.targetSchema.map(t => ({ name: t.name, columns: t.columns.length })),
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Importa configuração de mapeamento
   */
  importMappingConfig(config: any): void {
    if (config.mappings) {
      this.tableMappings.clear();
      for (const mapping of config.mappings) {
        this.tableMappings.set(mapping.id, mapping);
      }
    }

    if (config.config) {
      this.config = { ...this.config, ...config.config };
    }

    this.emit('config-imported', {
      mappings: this.tableMappings.size,
      config: this.config
    });
  }

  /**
   * Gera script DDL do Firebird para tabelas de destino
   */
  generateFirebirdDDL(): string[] {
    const ddlStatements: string[] = [];
    const processedTables = new Set<string>();

    for (const mapping of this.tableMappings.values()) {
      if (processedTables.has(mapping.targetTable)) continue;
      
      const targetTable = this.targetSchema.find(t => t.name === mapping.targetTable);
      if (!targetTable) continue;

      // CREATE TABLE statement
      let createTable = `CREATE TABLE "${mapping.targetTable}" (\n`;
      
      const columnDefs = targetTable.columns.map(col => {
        let def = `  "${col.name}" ${col.originalType || col.type}`;
        
        if (!col.nullable) {
          def += ' NOT NULL';
        }
        
        if (col.defaultValue !== undefined && col.defaultValue !== null) {
          def += ` DEFAULT ${typeof col.defaultValue === 'string' ? `'${col.defaultValue}'` : col.defaultValue}`;
        }
        
        return def;
      });

      createTable += columnDefs.join(',\n');

      // Primary Key
      if (targetTable.primaryKeys && targetTable.primaryKeys.length > 0) {
        const pkColumns = targetTable.primaryKeys.map(pk => `"${pk}"`).join(', ');
        createTable += `,\n  PRIMARY KEY (${pkColumns})`;
      }

      createTable += '\n);';
      ddlStatements.push(createTable);

      // Generators para campos auto-incremento
      const autoIncrementColumns = mapping.columnMappings.filter(cm => 
        cm.transformation?.type === 'calculate' && 
        cm.transformation.expression?.includes('GEN_ID')
      );

      for (const autoCol of autoIncrementColumns) {
        const generatorName = `GEN_${autoCol.targetColumn.toUpperCase()}`;
        ddlStatements.push(`CREATE GENERATOR ${generatorName};`);
        ddlStatements.push(`SET GENERATOR ${generatorName} TO 0;`);
      }

      // Índices (se necessário)
      if (targetTable.primaryKeys && targetTable.primaryKeys.length > 0) {
        const indexName = `PK_${mapping.targetTable.toUpperCase()}`;
        const pkColumns = targetTable.primaryKeys.map(pk => `"${pk}"`).join(', ');
        ddlStatements.push(`CREATE UNIQUE INDEX ${indexName} ON "${mapping.targetTable}" (${pkColumns});`);
      }

      processedTables.add(mapping.targetTable);
    }

    return ddlStatements;
  }

  /**
   * Gera scripts de migração DML
   */
  generateMigrationDML(): string[] {
    const dmlStatements: string[] = [];

    for (const mapping of this.tableMappings.values()) {
      if (mapping.mappingType === 'one-to-one') {
        dmlStatements.push(this.generateSimpleInsert(mapping));
      } else if (mapping.mappingType === 'many-to-one') {
        dmlStatements.push(this.generateJoinInsert(mapping));
      } else if (mapping.mappingType === 'one-to-many') {
        dmlStatements.push(...this.generateSplitInserts(mapping));
      }
    }

    return dmlStatements;
  }

  /**
   * Gera INSERT simples para mapeamento 1:1
   */
  private generateSimpleInsert(mapping: TableMapping): string {
    const targetColumns = mapping.columnMappings.map(cm => `"${cm.targetColumn}"`).join(', ');
    
    const sourceColumns = mapping.columnMappings.map(cm => {
      if (cm.transformation?.type === 'direct') {
        return `"${cm.sourceColumn}"`;
      } else if (cm.transformation?.expression) {
        return cm.transformation.expression;
      } else {
        return `CAST("${cm.sourceColumn}" AS ${cm.targetType})`;
      }
    }).join(', ');

    return `INSERT INTO "${mapping.targetTable}" (${targetColumns}) 
SELECT ${sourceColumns} 
FROM "${mapping.sourceTable}";`;
  }

  /**
   * Gera INSERT com JOIN para mapeamento N:1
   */
  private generateJoinInsert(mapping: TableMapping): string {
    const targetColumns = mapping.columnMappings.map(cm => `"${cm.targetColumn}"`).join(', ');
    
    const sourceColumns = mapping.columnMappings.map(cm => {
      if (cm.transformation?.expression) {
        return cm.transformation.expression;
      } else {
        return `CAST(${cm.sourceColumn} AS ${cm.targetType})`;
      }
    }).join(', ');

    const sourceTables = mapping.sourceTable.split(',');
    const mainTable = sourceTables[0];
    
    let fromClause = `"${mainTable}"`;
    
    if (mapping.joinConditions) {
      for (const join of mapping.joinConditions) {
        fromClause += ` ${join.joinType} JOIN "${join.targetTable}" ON "${join.sourceTable}"."${join.sourceColumn}" = "${join.targetTable}"."${join.targetColumn}"`;
      }
    }

    return `INSERT INTO "${mapping.targetTable}" (${targetColumns}) 
SELECT ${sourceColumns} 
FROM ${fromClause};`;
  }

  /**
   * Gera múltiplos INSERTs para mapeamento 1:N
   */
  private generateSplitInserts(mapping: TableMapping): string[] {
    // Para mapeamento 1:N, cada tabela de destino terá seu próprio INSERT
    // Isso é mais complexo e pode requerer lógica específica do negócio
    return [`-- TODO: Implementar split insert para ${mapping.sourceTable} -> ${mapping.targetTable}`];
  }

  /**
   * Detecta relacionamentos automáticamente
   */
  detectRelationships(): JoinCondition[] {
    const relationships: JoinCondition[] = [];

    for (const sourceTable of this.sourceSchema) {
      for (const targetTable of this.targetSchema) {
        // Procurar por chaves estrangeiras baseadas em convenções de nomenclatura
        for (const sourceCol of sourceTable.columns) {
          for (const targetCol of targetTable.columns) {
            if (this.isPossibleForeignKey(sourceCol, targetCol, sourceTable, targetTable)) {
              relationships.push({
                sourceTable: sourceTable.name,
                sourceColumn: sourceCol.name,
                targetTable: targetTable.name,
                targetColumn: targetCol.name,
                joinType: 'INNER'
              });
            }
          }
        }
      }
    }

    return relationships;
  }

  /**
   * Verifica se pode ser uma chave estrangeira
   */
  private isPossibleForeignKey(
    sourceCol: ColumnInfo,
    targetCol: ColumnInfo,
    sourceTable: TableInfo,
    targetTable: TableInfo
  ): boolean {
    // Convenção: campo termina com _ID ou ID
    const isIdField = sourceCol.name.toUpperCase().endsWith('_ID') || 
                     sourceCol.name.toUpperCase().endsWith('ID');
    
    // Verifica se o nome da coluna contém o nome da tabela de destino
    const containsTableName = sourceCol.name.toLowerCase().includes(targetTable.name.toLowerCase());
    
    // Verifica se os tipos são compatíveis
    const typesCompatible = this.calculateTypeSimilarity(sourceCol.type, targetCol.type) >= 0.8;
    
    // Verifica se a coluna de destino é chave primária
    const isTargetPrimaryKey = targetTable.primaryKeys?.includes(targetCol.name);

    return isIdField && containsTableName && typesCompatible && isTargetPrimaryKey;
  }

  /**
   * Aplica regras de negócio específicas Paradox → Firebird
   */
  applyParadoxToFirebirdRules(): void {
    for (const mapping of this.tableMappings.values()) {
      for (const columnMapping of mapping.columnMappings) {
        // Aplicar transformações específicas
        if (columnMapping.transformation?.paradoxType) {
          this.applyParadoxSpecificTransformations(columnMapping);
        }
      }
    }

    this.emit('business-rules-applied', {
      mappings: this.tableMappings.size,
      rules: 'Paradox to Firebird specific transformations'
    });
  }

  /**
   * Aplica transformações específicas do Paradox
   */
  private applyParadoxSpecificTransformations(columnMapping: ColumnMapping): void {
    if (!columnMapping.transformation) return;

    const paradoxType = columnMapping.transformation.paradoxType;
    
    switch (paradoxType) {
      case 'ALPHA':
        // Remover espaços em branco do Paradox
        columnMapping.transformation.expression = `TRIM(${columnMapping.sourceColumn})`;
        break;
        
      case 'CURRENCY':
        // Garantir precisão de moeda
        columnMapping.transformation.precision = 15;
        columnMapping.transformation.scale = 2;
        break;
        
      case 'LOGICAL':
        // Conversão booleana específica
        columnMapping.transformation.expression = 
          `CASE WHEN ${columnMapping.sourceColumn} = 'T' THEN TRUE ELSE FALSE END`;
        break;
        
      case 'AUTOINCREMENT':
        // Usar generator do Firebird
        const generatorName = `GEN_${columnMapping.targetColumn.toUpperCase()}`;
        columnMapping.transformation.expression = `GEN_ID(${generatorName}, 1)`;
        break;
    }
  }

  /**
   * Retorna todos os mapeamentos configurados
   */
  getAllMappings(): TableMapping[] {
    return Array.from(this.tableMappings.values());
  }
}
