/**
 * Sistema de mapeamento de tipos de dados entre diferentes bancos
 */

export interface TypeMapping {
  from: string;
  to: string;
  maxLength?: number;
  precision?: number;
  scale?: number;
}

export interface TypeMappingRule {
  sourceType: string;
  targetType: string;
  conversion?: (value: any) => any;
  validation?: (value: any) => boolean;
}

/**
 * Mapeamentos padrão entre tipos de bancos diferentes
 */
export class TypeMapper {
  
  /**
   * Mapeamentos de MySQL para outros bancos
   */
  static readonly MYSQL_MAPPINGS = {
    postgresql: new Map<string, string>([
      ['VARCHAR', 'VARCHAR'],
      ['CHAR', 'CHAR'],
      ['TEXT', 'TEXT'],
      ['LONGTEXT', 'TEXT'],
      ['MEDIUMTEXT', 'TEXT'],
      ['TINYTEXT', 'TEXT'],
      ['INT', 'INTEGER'],
      ['TINYINT', 'SMALLINT'],
      ['SMALLINT', 'SMALLINT'],
      ['MEDIUMINT', 'INTEGER'],
      ['BIGINT', 'BIGINT'],
      ['DECIMAL', 'DECIMAL'],
      ['NUMERIC', 'NUMERIC'],
      ['FLOAT', 'REAL'],
      ['DOUBLE', 'DOUBLE PRECISION'],
      ['BIT', 'BOOLEAN'],
      ['BOOLEAN', 'BOOLEAN'],
      ['DATE', 'DATE'],
      ['TIME', 'TIME'],
      ['DATETIME', 'TIMESTAMP'],
      ['TIMESTAMP', 'TIMESTAMP'],
      ['YEAR', 'SMALLINT'],
      ['BINARY', 'BYTEA'],
      ['VARBINARY', 'BYTEA'],
      ['BLOB', 'BYTEA'],
      ['LONGBLOB', 'BYTEA'],
      ['JSON', 'JSONB'],
      ['ENUM', 'VARCHAR'],
      ['SET', 'VARCHAR']
    ]),
    
    sqlserver: new Map<string, string>([
      ['VARCHAR', 'NVARCHAR'],
      ['CHAR', 'NCHAR'],
      ['TEXT', 'NVARCHAR(MAX)'],
      ['LONGTEXT', 'NVARCHAR(MAX)'],
      ['INT', 'INT'],
      ['TINYINT', 'TINYINT'],
      ['SMALLINT', 'SMALLINT'],
      ['BIGINT', 'BIGINT'],
      ['DECIMAL', 'DECIMAL'],
      ['FLOAT', 'REAL'],
      ['DOUBLE', 'FLOAT'],
      ['BOOLEAN', 'BIT'],
      ['DATE', 'DATE'],
      ['TIME', 'TIME'],
      ['DATETIME', 'DATETIME2'],
      ['TIMESTAMP', 'DATETIME2'],
      ['BINARY', 'VARBINARY'],
      ['BLOB', 'VARBINARY(MAX)'],
      ['JSON', 'NVARCHAR(MAX)']
    ]),
    
    oracle: new Map<string, string>([
      ['VARCHAR', 'VARCHAR2'],
      ['CHAR', 'CHAR'],
      ['TEXT', 'CLOB'],
      ['LONGTEXT', 'CLOB'],
      ['INT', 'NUMBER(10,0)'],
      ['TINYINT', 'NUMBER(3,0)'],
      ['SMALLINT', 'NUMBER(5,0)'],
      ['BIGINT', 'NUMBER(19,0)'],
      ['DECIMAL', 'NUMBER'],
      ['FLOAT', 'BINARY_FLOAT'],
      ['DOUBLE', 'BINARY_DOUBLE'],
      ['BOOLEAN', 'NUMBER(1,0)'],
      ['DATE', 'DATE'],
      ['TIME', 'TIMESTAMP'],
      ['DATETIME', 'TIMESTAMP'],
      ['TIMESTAMP', 'TIMESTAMP'],
      ['BINARY', 'RAW'],
      ['BLOB', 'BLOB'],
      ['JSON', 'CLOB']
    ])
  };

  /**
   * Mapeamentos de PostgreSQL para outros bancos
   */
  static readonly POSTGRESQL_MAPPINGS = {
    mysql: new Map<string, string>([
      ['VARCHAR', 'VARCHAR'],
      ['CHAR', 'CHAR'],
      ['TEXT', 'LONGTEXT'],
      ['INTEGER', 'INT'],
      ['SMALLINT', 'SMALLINT'],
      ['BIGINT', 'BIGINT'],
      ['DECIMAL', 'DECIMAL'],
      ['NUMERIC', 'DECIMAL'],
      ['REAL', 'FLOAT'],
      ['DOUBLE PRECISION', 'DOUBLE'],
      ['BOOLEAN', 'BOOLEAN'],
      ['DATE', 'DATE'],
      ['TIME', 'TIME'],
      ['TIMESTAMP', 'DATETIME'],
      ['TIMESTAMPTZ', 'DATETIME'],
      ['BYTEA', 'LONGBLOB'],
      ['JSON', 'JSON'],
      ['JSONB', 'JSON'],
      ['UUID', 'CHAR(36)'],
      ['INET', 'VARCHAR(45)'],
      ['CIDR', 'VARCHAR(45)']
    ]),
    
    sqlserver: new Map<string, string>([
      ['VARCHAR', 'NVARCHAR'],
      ['CHAR', 'NCHAR'],
      ['TEXT', 'NVARCHAR(MAX)'],
      ['INTEGER', 'INT'],
      ['SMALLINT', 'SMALLINT'],
      ['BIGINT', 'BIGINT'],
      ['DECIMAL', 'DECIMAL'],
      ['REAL', 'REAL'],
      ['DOUBLE PRECISION', 'FLOAT'],
      ['BOOLEAN', 'BIT'],
      ['DATE', 'DATE'],
      ['TIME', 'TIME'],
      ['TIMESTAMP', 'DATETIME2'],
      ['BYTEA', 'VARBINARY(MAX)'],
      ['JSON', 'NVARCHAR(MAX)'],
      ['JSONB', 'NVARCHAR(MAX)'],
      ['UUID', 'UNIQUEIDENTIFIER']
    ])
  };

  /**
   * Mapeia um tipo de dados entre bancos
   */
  static mapType(sourceType: string, sourceDb: string, targetDb: string): string {
    const normalizedSourceType = sourceType.toUpperCase();
    
    // Extrair tipo base (sem parâmetros)
    const baseType = normalizedSourceType.split('(')[0]?.trim() || normalizedSourceType;
    
    // Buscar mapeamento específico
    let mappings: Map<string, string> | undefined;
    
    switch (sourceDb.toLowerCase()) {
      case 'mysql':
        mappings = this.MYSQL_MAPPINGS[targetDb.toLowerCase() as keyof typeof this.MYSQL_MAPPINGS];
        break;
      case 'postgresql':
      case 'postgres':
        mappings = this.POSTGRESQL_MAPPINGS[targetDb.toLowerCase() as keyof typeof this.POSTGRESQL_MAPPINGS];
        break;
    }
    
    if (mappings && mappings.has(baseType)) {
      const targetType = mappings.get(baseType)!;
      
      // Preservar parâmetros quando possível
      const params = this.extractTypeParameters(normalizedSourceType);
      if (params && this.supportsParameters(targetType)) {
        return `${targetType}${params}`;
      }
      
      return targetType;
    }
    
    // Fallback para tipo genérico
    return this.getGenericMapping(baseType, targetDb);
  }

  /**
   * Extrai parâmetros do tipo (ex: VARCHAR(255) -> (255))
   */
  private static extractTypeParameters(type: string): string | null {
    const match = type.match(/\(([^)]+)\)/);
    return match ? `(${match[1]})` : null;
  }

  /**
   * Verifica se o tipo suporta parâmetros
   */
  private static supportsParameters(type: string): boolean {
    const typesWithParams = [
      'VARCHAR', 'CHAR', 'NVARCHAR', 'NCHAR', 'VARCHAR2',
      'DECIMAL', 'NUMERIC', 'NUMBER', 'FLOAT'
    ];
    
    return typesWithParams.some(t => type.toUpperCase().startsWith(t));
  }

  /**
   * Mapeamento genérico baseado em categorias
   */
  private static getGenericMapping(sourceType: string, targetDb: string): string {
    // Tipos de string
    if (['VARCHAR', 'CHAR', 'TEXT', 'STRING'].some(t => sourceType.includes(t))) {
      switch (targetDb.toLowerCase()) {
        case 'mysql': return 'VARCHAR(255)';
        case 'postgresql': return 'VARCHAR';
        case 'sqlserver': return 'NVARCHAR(255)';
        case 'oracle': return 'VARCHAR2(255)';
        default: return 'VARCHAR(255)';
      }
    }
    
    // Tipos numéricos inteiros
    if (['INT', 'INTEGER', 'NUMBER'].some(t => sourceType.includes(t))) {
      switch (targetDb.toLowerCase()) {
        case 'oracle': return 'NUMBER(10,0)';
        default: return 'INTEGER';
      }
    }
    
    // Tipos decimais
    if (['DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE'].some(t => sourceType.includes(t))) {
      switch (targetDb.toLowerCase()) {
        case 'oracle': return 'NUMBER';
        default: return 'DECIMAL';
      }
    }
    
    // Tipos de data/hora
    if (['DATE', 'TIME', 'TIMESTAMP', 'DATETIME'].some(t => sourceType.includes(t))) {
      switch (targetDb.toLowerCase()) {
        case 'mysql': return 'DATETIME';
        case 'postgresql': return 'TIMESTAMP';
        case 'sqlserver': return 'DATETIME2';
        case 'oracle': return 'TIMESTAMP';
        default: return 'TIMESTAMP';
      }
    }
    
    // Tipos booleanos
    if (['BOOLEAN', 'BOOL', 'BIT'].some(t => sourceType.includes(t))) {
      switch (targetDb.toLowerCase()) {
        case 'mysql': return 'BOOLEAN';
        case 'postgresql': return 'BOOLEAN';
        case 'sqlserver': return 'BIT';
        case 'oracle': return 'NUMBER(1,0)';
        default: return 'BOOLEAN';
      }
    }
    
    // Tipos binários
    if (['BINARY', 'BLOB', 'BYTEA'].some(t => sourceType.includes(t))) {
      switch (targetDb.toLowerCase()) {
        case 'mysql': return 'LONGBLOB';
        case 'postgresql': return 'BYTEA';
        case 'sqlserver': return 'VARBINARY(MAX)';
        case 'oracle': return 'BLOB';
        default: return 'BLOB';
      }
    }
    
    // Fallback
    return 'VARCHAR(255)';
  }

  /**
   * Cria regras de transformação de valores
   */
  static createValueTransformRules(sourceDb: string, targetDb: string): TypeMappingRule[] {
    const rules: TypeMappingRule[] = [];
    
    // Transformações específicas entre bancos
    if (sourceDb === 'mysql' && targetDb === 'oracle') {
      rules.push({
        sourceType: 'BOOLEAN',
        targetType: 'NUMBER(1,0)',
        conversion: (value: boolean) => value ? 1 : 0,
        validation: (value: any) => typeof value === 'boolean'
      });
    }
    
    if (sourceDb === 'postgresql' && targetDb === 'mysql') {
      rules.push({
        sourceType: 'BOOLEAN',
        targetType: 'BOOLEAN',
        conversion: (value: boolean) => value,
        validation: (value: any) => typeof value === 'boolean'
      });
    }
    
    // Regras de data/hora
    rules.push({
      sourceType: 'TIMESTAMP',
      targetType: 'TIMESTAMP',
      conversion: (value: any) => {
        if (value instanceof Date) return value;
        if (typeof value === 'string') return new Date(value);
        return value;
      },
      validation: (value: any) => value instanceof Date || typeof value === 'string'
    });
    
    return rules;
  }

  /**
   * Aplica transformação de valor baseada nas regras
   */
  static transformValue(value: any, sourceType: string, targetType: string, rules: TypeMappingRule[]): any {
    const rule = rules.find(r => 
      r.sourceType.toUpperCase() === sourceType.toUpperCase() &&
      r.targetType.toUpperCase() === targetType.toUpperCase()
    );
    
    if (rule && rule.conversion) {
      try {
        if (!rule.validation || rule.validation(value)) {
          return rule.conversion(value);
        }
      } catch (error) {
        console.warn(`Error transforming value ${value} from ${sourceType} to ${targetType}:`, error);
      }
    }
    
    return value;
  }
}
