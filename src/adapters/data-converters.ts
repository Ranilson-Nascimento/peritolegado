/**
 * Sistema de Conversão de Dados entre Diferentes Tipos
 * Permite conversão automática durante a migração de dados
 */

export interface ConversionResult {
    success: boolean;
    value: any;
    originalValue: any;
    originalType: string;
    targetType: string;
    conversionType: string;
    warning?: string;
    error?: string;
}

export class DataConverter {
    
    /**
     * Converte um valor de um tipo para outro
     */
    static convert(value: any, sourceType: string, targetType: string): ConversionResult {
        const result: ConversionResult = {
            success: false,
            value: null,
            originalValue: value,
            originalType: sourceType,
            targetType: targetType,
            conversionType: this.getConversionType(sourceType, targetType)
        };

        try {
            // Se valor é null ou undefined, manter como está
            if (value === null || value === undefined) {
                result.success = true;
                result.value = value;
                return result;
            }

            const sourceNorm = this.normalizeType(sourceType);
            const targetNorm = this.normalizeType(targetType);

            // Se tipos são iguais, sem conversão
            if (sourceNorm === targetNorm) {
                result.success = true;
                result.value = value;
                result.conversionType = 'DIRECT';
                return result;
            }

            // Executar conversão baseada nos tipos
            result.value = this.executeConversion(value, sourceNorm, targetNorm);
            result.success = true;

        } catch (error: any) {
            result.success = false;
            result.error = error.message;
            result.value = value; // Manter valor original em caso de erro
        }

        return result;
    }

    /**
     * Normaliza tipos para comparação
     */
    private static normalizeType(type: string): string {
        if (!type) return 'VARCHAR';
        
        return type.toUpperCase()
            .replace(/\(\d+\)/g, '') // Remove (20), (255), etc.
            .replace(/\(\d+,\d+\)/g, '') // Remove (18,2), etc.
            .replace(/FB_TYPE_\d+/g, 'VARCHAR') // Converter códigos FB_TYPE
            .trim();
    }

    /**
     * Determina o tipo de conversão necessária
     */
    private static getConversionType(sourceType: string, targetType: string): string {
        const sourceNorm = this.normalizeType(sourceType);
        const targetNorm = this.normalizeType(targetType);
        
        if (sourceNorm === targetNorm) return 'DIRECT';
        
        const textTypes = ['VARCHAR', 'TEXT', 'CHAR', 'STRING', 'CSTRING'];
        const numberTypes = ['INTEGER', 'BIGINT', 'SMALLINT', 'NUMERIC', 'REAL', 'DOUBLE', 'FLOAT'];
        const dateTypes = ['DATE', 'TIMESTAMP', 'DATETIME', 'TIME'];
        
        // Texto para Data
        if (textTypes.includes(sourceNorm) && dateTypes.includes(targetNorm)) {
            return 'TEXT_TO_DATE';
        }
        
        // Texto para Número
        if (textTypes.includes(sourceNorm) && numberTypes.includes(targetNorm)) {
            return 'TEXT_TO_NUMBER';
        }
        
        // Número para Texto
        if (numberTypes.includes(sourceNorm) && textTypes.includes(targetNorm)) {
            return 'NUMBER_TO_TEXT';
        }
        
        // Data para Texto
        if (dateTypes.includes(sourceNorm) && textTypes.includes(targetNorm)) {
            return 'DATE_TO_TEXT';
        }
        
        // Entre tipos numéricos
        if (numberTypes.includes(sourceNorm) && numberTypes.includes(targetNorm)) {
            return 'NUMBER_TO_NUMBER';
        }
        
        // Entre tipos de texto
        if (textTypes.includes(sourceNorm) && textTypes.includes(targetNorm)) {
            return 'TEXT_TO_TEXT';
        }
        
        return 'CUSTOM_CONVERSION';
    }

    /**
     * Executa a conversão do valor
     */
    private static executeConversion(value: any, sourceType: string, targetType: string): any {
        const textTypes = ['VARCHAR', 'TEXT', 'CHAR', 'STRING', 'CSTRING'];
        const numberTypes = ['INTEGER', 'BIGINT', 'SMALLINT', 'NUMERIC', 'REAL', 'DOUBLE', 'FLOAT'];
        const dateTypes = ['DATE', 'TIMESTAMP', 'DATETIME', 'TIME'];

        // Texto para Data
        if (textTypes.includes(sourceType) && dateTypes.includes(targetType)) {
            return this.convertTextToDate(value, targetType);
        }

        // Texto para Número
        if (textTypes.includes(sourceType) && numberTypes.includes(targetType)) {
            return this.convertTextToNumber(value, targetType);
        }

        // Número para Texto
        if (numberTypes.includes(sourceType) && textTypes.includes(targetType)) {
            return this.convertNumberToText(value);
        }

        // Data para Texto
        if (dateTypes.includes(sourceType) && textTypes.includes(targetType)) {
            return this.convertDateToText(value);
        }

        // Entre números
        if (numberTypes.includes(sourceType) && numberTypes.includes(targetType)) {
            return this.convertNumberToNumber(value, targetType);
        }

        // Entre textos (sem conversão especial)
        if (textTypes.includes(sourceType) && textTypes.includes(targetType)) {
            return String(value);
        }

        // Conversão genérica
        return String(value);
    }

    /**
     * Converte texto para data
     */
    private static convertTextToDate(value: string, targetType: string): Date | string {
        if (!value || typeof value !== 'string') {
            throw new Error('Valor inválido para conversão de data');
        }

        const cleanValue = value.trim();
        
        // Tentar diferentes formatos de data
        const dateFormats = [
            /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
            /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
            /^(\d{2})-(\d{2})-(\d{4})$/, // DD-MM-YYYY
            /^(\d{4})(\d{2})(\d{2})$/, // YYYYMMDD
            /^(\d{2})(\d{2})(\d{4})$/, // DDMMYYYY
        ];

        for (const format of dateFormats) {
            const match = cleanValue.match(format);
            if (match) {
                let year: number, month: number, day: number;
                
                if (format.source.startsWith('^(\\d{4})')) {
                    // Formato YYYY primeiro
                    [, year, month, day] = match.map(Number);
                } else {
                    // Formato DD primeiro
                    [, day, month, year] = match.map(Number);
                }

                const date = new Date(year, month - 1, day);
                
                // Verificar se a data é válida
                if (date.getFullYear() === year && 
                    date.getMonth() === month - 1 && 
                    date.getDate() === day) {
                    
                    // Retornar formato baseado no tipo de destino
                    if (targetType.includes('TIMESTAMP')) {
                        return date.toISOString();
                    } else if (targetType.includes('TIME')) {
                        return '00:00:00';
                    } else {
                        return date.toISOString().split('T')[0];
                    }
                }
            }
        }

        // Tentar parsing direto com Date
        const directDate = new Date(cleanValue);
        if (!isNaN(directDate.getTime())) {
            if (targetType.includes('TIMESTAMP')) {
                return directDate.toISOString();
            } else {
                return directDate.toISOString().split('T')[0];
            }
        }

        throw new Error(`Não foi possível converter "${value}" para data`);
    }

    /**
     * Converte texto para número
     */
    private static convertTextToNumber(value: string, targetType: string): number {
        if (!value || typeof value !== 'string') {
            throw new Error('Valor inválido para conversão numérica');
        }

        // Limpar valor (remover espaços, vírgulas como separador de milhares)
        let cleanValue = value.trim()
            .replace(/\s/g, '') // Remove espaços
            .replace(/,(?=\d{3})/g, ''); // Remove vírgulas como separador de milhares

        // Trocar vírgula por ponto se for separador decimal
        if (cleanValue.includes(',') && !cleanValue.includes('.')) {
            cleanValue = cleanValue.replace(',', '.');
        }

        const numValue = Number(cleanValue);
        
        if (isNaN(numValue)) {
            throw new Error(`Não foi possível converter "${value}" para número`);
        }

        // Ajustar baseado no tipo de destino
        if (targetType.includes('INTEGER') || targetType.includes('BIGINT') || targetType.includes('SMALLINT')) {
            return Math.round(numValue);
        }

        return numValue;
    }

    /**
     * Converte número para texto
     */
    private static convertNumberToText(value: number): string {
        if (typeof value !== 'number') {
            return String(value);
        }
        return value.toString();
    }

    /**
     * Converte data para texto
     */
    private static convertDateToText(value: Date | string): string {
        if (value instanceof Date) {
            return value.toISOString().split('T')[0];
        }
        return String(value);
    }

    /**
     * Converte entre tipos numéricos
     */
    private static convertNumberToNumber(value: number, targetType: string): number {
        if (typeof value !== 'number') {
            const numValue = Number(value);
            if (isNaN(numValue)) {
                throw new Error(`Não foi possível converter "${value}" para número`);
            }
            value = numValue;
        }

        // Ajustar baseado no tipo de destino
        if (targetType.includes('INTEGER') || targetType.includes('BIGINT') || targetType.includes('SMALLINT')) {
            return Math.round(value);
        }

        return value;
    }

    /**
     * Converte um array de dados aplicando as regras de mapeamento
     */
    static convertDataArray(
        data: any[], 
        columnMappings: Array<{
            sourceColumn: string;
            targetColumn: string;
            sourceType: string;
            targetType: string;
            requiresConversion?: boolean;
        }>
    ): { convertedData: any[], conversionReport: ConversionResult[] } {
        const conversionReport: ConversionResult[] = [];
        
        const convertedData = data.map((row, rowIndex) => {
            const convertedRow: any = {};
            
            columnMappings.forEach(mapping => {
                const sourceValue = row[mapping.sourceColumn];
                
                if (mapping.requiresConversion) {
                    const result = this.convert(
                        sourceValue, 
                        mapping.sourceType, 
                        mapping.targetType
                    );
                    
                    convertedRow[mapping.targetColumn] = result.value;
                    
                    // Adicionar ao relatório se houver problemas
                    if (!result.success || result.warning) {
                        result.originalValue = sourceValue;
                        conversionReport.push({
                            ...result,
                            rowIndex,
                            sourceColumn: mapping.sourceColumn,
                            targetColumn: mapping.targetColumn
                        } as any);
                    }
                } else {
                    // Cópia direta sem conversão
                    convertedRow[mapping.targetColumn] = sourceValue;
                }
            });
            
            return convertedRow;
        });

        return { convertedData, conversionReport };
    }
}
