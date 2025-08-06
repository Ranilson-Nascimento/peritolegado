# 🤝 Contribuindo para o Perito Legado

Obrigado por considerar contribuir com o Perito Legado! Este documento fornece diretrizes para contribuir com o projeto.

## 📋 **Índice**
- [Começando](#-começando)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Padrões de Código](#-padrões-de-código)
- [Processo de Desenvolvimento](#-processo-de-desenvolvimento)
- [Testes](#-testes)
- [Documentação](#-documentação)
- [Pull Requests](#-pull-requests)

## 🚀 **Começando**

### **Configuração do Ambiente**
```bash
# 1. Fork e clone o repositório
git clone https://github.com/SEU-USUARIO/peritolegado.git
cd peritolegado

# 2. Instale as dependências
npm install

# 3. Configure o ambiente de desenvolvimento
npm run dev

# 4. Acesse a interface para testar
# http://localhost:3000/dashboard.html
```

### **Estrutura de Branches**
- `main` - Branch principal, sempre estável
- `develop` - Branch de desenvolvimento ativo
- `feature/nome-da-funcionalidade` - Novas funcionalidades
- `fix/nome-do-bug` - Correções de bugs
- `docs/nome-da-documentacao` - Atualizações de documentação

## 🏗️ **Estrutura do Projeto**

```
📁 Perito Legado/
├── 🌐 web/                         # Interface Web
│   ├── dashboard.html              # Dashboard principal
│   ├── index.html                  # Migração inteligente
│   ├── intelligent-mapping.html    # Sistema avançado
│   └── validation-panel.html       # Painel de validações
├── 🔧 src/                         # Core TypeScript
│   ├── cli.ts                      # Interface CLI
│   ├── config.ts                   # Configurações centrais
│   ├── 🎯 core/                    # Motor de Migração
│   │   ├── migration-engine.ts     # Engine principal
│   │   ├── type-mapper.ts          # Mapeamento de tipos
│   │   └── validator.ts            # Sistema de validação
│   ├── 🔌 adapters/                # Conectores de Banco
│   │   ├── paradox.ts              # Paradox (DB/PX)
│   │   ├── sqlite.ts               # SQLite
│   │   ├── firebird.ts             # Firebird (GDB/FDB)
│   │   ├── data-converters.ts      # Conversores de dados
│   │   └── types.ts                # Interfaces TypeScript
│   └── 🌐 web/                     # Servidor Web
│       ├── server.ts               # Express server
│       ├── socket-handlers.ts      # WebSocket handlers
│       └── routes/                 # API routes
├── 📚 docs/                        # Documentação
├── 🧪 tests/                       # Testes automatizados
└── 📦 scripts/                     # Scripts de build/deploy
```

## 📝 **Padrões de Código**

### **TypeScript**
```typescript
// ✅ Bom exemplo
interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export class FirebirdAdapter implements DatabaseAdapter {
  readonly type = 'firebird';
  private connection: any;

  async connect(config: DatabaseConfig): Promise<void> {
    try {
      this.connection = await this.createConnection(config);
      console.log(`✅ Conectado ao Firebird: ${config.host}`);
    } catch (error) {
      throw new Error(`❌ Erro ao conectar Firebird: ${error.message}`);
    }
  }
}
```

### **Nomenclatura**
- **Classes**: PascalCase (`FirebirdAdapter`, `MigrationEngine`)
- **Métodos/Variáveis**: camelCase (`connectDatabase`, `sourceSchema`)
- **Constantes**: UPPER_SNAKE_CASE (`DEFAULT_BATCH_SIZE`, `MAX_RETRIES`)
- **Arquivos**: kebab-case (`firebird-adapter.ts`, `type-mapper.ts`)

### **Comentários e Logs**
```typescript
// ✅ Comentários descritivos
/**
 * Migra dados entre bancos com processamento em lotes
 * @param sourceTable Tabela de origem
 * @param targetTable Tabela de destino  
 * @param batchSize Tamanho do lote (padrão: 1000)
 */
async function migrateTable(sourceTable: string, targetTable: string, batchSize = 1000) {
  console.log(`🚀 Iniciando migração: ${sourceTable} → ${targetTable}`);
  // ... implementação
}

// ✅ Logs estruturados com emojis
console.log('✅ Migração concluída com sucesso');
console.error('❌ Erro durante a migração:', error.message);
console.warn('⚠️ Aviso: Alguns registros podem ter sido ignorados');
console.info('ℹ️ Processando lote 5/10...');
```

## 🔄 **Processo de Desenvolvimento**

### **1. 🎯 Escolha uma Issue**
- Verifique issues abertas no GitHub
- Comente na issue para "clamar" o trabalho
- Priorize issues com labels `good first issue` ou `help wanted`

### **2. 🌿 Crie uma Branch**
```bash
# Para nova funcionalidade
git checkout -b feature/adicionar-suporte-mysql

# Para correção de bug
git checkout -b fix/corrigir-conexao-firebird

# Para documentação
git checkout -b docs/atualizar-readme
```

### **3. 🔧 Desenvolva**
```bash
# Execute em modo desenvolvimento
npm run dev

# Para apenas CLI
npm run dev:cli

# Para apenas servidor web
npm run dev:web
```

### **4. ✅ Teste suas mudanças**
```bash
# Testes automatizados
npm test

# Testes de integração
npm run test:integration

# Teste manual na interface web
# http://localhost:3000/dashboard.html
```

### **5. 📝 Commit suas mudanças**
Use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Funcionalidades novas
git commit -m "feat: adiciona suporte a MySQL na interface web"

# Correções de bugs
git commit -m "fix: corrige erro de conexão Firebird em Windows"

# Documentação
git commit -m "docs: atualiza README com exemplos de uso"

# Melhorias
git commit -m "perf: otimiza carregamento de schemas grandes"

# Refatoração
git commit -m "refactor: reorganiza estrutura dos adaptadores"
```

## 🧪 **Testes**

### **Estrutura de Testes**
```
tests/
├── unit/                    # Testes unitários
│   ├── adapters/           # Testes de adaptadores
│   ├── core/               # Testes do motor
│   └── utils/              # Testes de utilitários
├── integration/            # Testes de integração
│   ├── migration-flows/    # Fluxos completos de migração
│   └── database-connections/ # Conexões reais
└── e2e/                    # Testes end-to-end
    ├── web-interface/      # Interface web
    └── cli-commands/       # Comandos CLI
```

### **Executando Testes**
```bash
# Todos os testes
npm test

# Apenas testes unitários
npm run test:unit

# Apenas testes de integração
npm run test:integration

# Testes com coverage
npm run test:coverage

# Testes em modo watch
npm run test:watch
```

### **Escrevendo Testes**
```typescript
// tests/unit/adapters/firebird.test.ts
import { FirebirdAdapter } from '../../../src/adapters/firebird';

describe('FirebirdAdapter', () => {
  let adapter: FirebirdAdapter;

  beforeEach(() => {
    adapter = new FirebirdAdapter();
  });

  describe('connect', () => {
    it('deve conectar com configuração válida', async () => {
      const config = {
        host: 'localhost',
        database: 'test.fdb',
        user: 'SYSDBA',
        password: 'masterkey'
      };

      await expect(adapter.connect(config)).resolves.not.toThrow();
    });

    it('deve falhar com configuração inválida', async () => {
      const config = {
        host: 'invalid-host',
        database: 'nonexistent.fdb',
        user: 'invalid',
        password: 'wrong'
      };

      await expect(adapter.connect(config)).rejects.toThrow();
    });
  });
});
```

## 📚 **Documentação**

### **Atualizando README**
- Mantenha exemplos atualizados
- Adicione screenshots de novas funcionalidades
- Atualize a seção de roadmap

### **Documentação de Código**
```typescript
/**
 * Adaptador para bancos de dados Firebird
 * 
 * Suporta conexões com arquivos GDB e FDB, incluindo:
 * - Firebird 2.5, 3.0, 4.0+
 * - Embedded e Server mode
 * - SSL e conexões seguras
 * 
 * @example
 * ```typescript
 * const adapter = new FirebirdAdapter();
 * await adapter.connect({
 *   host: 'localhost',
 *   database: '/path/to/database.fdb',
 *   user: 'SYSDBA',
 *   password: 'masterkey'
 * });
 * ```
 */
export class FirebirdAdapter implements DatabaseAdapter {
  // ... implementação
}
```

### **JSDoc para Métodos**
```typescript
/**
 * Migra dados entre tabelas com suporte a transformações
 * 
 * @param sourceTable - Nome da tabela de origem
 * @param targetTable - Nome da tabela de destino
 * @param options - Opções de migração
 * @param options.batchSize - Tamanho do lote (padrão: 1000)
 * @param options.transforms - Transformações a aplicar
 * @returns Promise com estatísticas da migração
 * 
 * @throws {Error} Quando a conexão falha
 * @throws {ValidationError} Quando os dados são inválidos
 */
async migrateTable(
  sourceTable: string,
  targetTable: string,
  options: MigrationOptions = {}
): Promise<MigrationStats> {
  // ... implementação
}
```

## 🔀 **Pull Requests**

### **Antes de Submeter**
- [ ] ✅ Todos os testes passando
- [ ] 📝 Documentação atualizada
- [ ] 🔧 Código segue os padrões do projeto
- [ ] 🧪 Novos testes para funcionalidades adicionadas
- [ ] 📋 Descrição clara das mudanças

### **Template de PR**
```markdown
## 📋 Descrição
Breve descrição das mudanças realizadas.

## 🎯 Tipo de Mudança
- [ ] 🐛 Bug fix
- [ ] ✨ Nova funcionalidade
- [ ] 💥 Breaking change
- [ ] 📚 Documentação
- [ ] 🎨 Melhorias de UI/UX
- [ ] ⚡ Performance

## 🧪 Testes
- [ ] Testes unitários adicionados/atualizados
- [ ] Testes de integração passando
- [ ] Testado manualmente na interface web

## 📷 Screenshots (se aplicável)
Adicione prints da interface ou logs de terminal.

## 📝 Checklist
- [ ] Meu código segue os padrões do projeto
- [ ] Realizei auto-review do meu código
- [ ] Comentei partes complexas do código
- [ ] Atualizei a documentação correspondente
- [ ] Minhas mudanças não introduzem warnings
- [ ] Adicionei testes que provam que minha correção/funcionalidade funciona
- [ ] Testes novos e existentes passam localmente
```

## 🏷️ **Labels do GitHub**

### **Tipo**
- `enhancement` - Nova funcionalidade
- `bug` - Correção de bug
- `documentation` - Melhorias na documentação
- `performance` - Otimizações de performance
- `refactor` - Refatoração de código

### **Prioridade**
- `priority: high` - Alta prioridade
- `priority: medium` - Média prioridade  
- `priority: low` - Baixa prioridade

### **Dificuldade**
- `good first issue` - Boa para iniciantes
- `help wanted` - Precisamos de ajuda
- `advanced` - Requer conhecimento avançado

### **Área**
- `area: cli` - Interface de linha de comando
- `area: web` - Interface web
- `area: adapters` - Conectores de banco
- `area: core` - Motor de migração
- `area: docs` - Documentação

## 🎯 **Áreas que Precisam de Contribuição**

### **🔧 Alta Prioridade**
1. **Novos Adaptadores**
   - Oracle com interface web
   - SQL Server com interface web
   - MongoDB para dados NoSQL

2. **Melhorias na Interface Web**
   - Modo escuro/claro
   - Internacionalização (PT/EN/ES)
   - Acessibilidade (WCAG)
   - Interface mobile nativa

3. **Testes Automatizados**
   - Cobertura de testes > 80%
   - Testes E2E para interface web
   - Testes de performance

### **🎨 Média Prioridade**
1. **UX/UI**
   - Animações e micro-interações
   - Drag & drop mais intuitivo
   - Tooltips e ajuda contextual

2. **Performance**
   - Otimização de queries
   - Cache inteligente
   - Compressão de dados

3. **DevOps**
   - CI/CD com GitHub Actions
   - Docker containers
   - Deploy automatizado

### **🔮 Baixa Prioridade**
1. **Funcionalidades Avançadas**
   - API REST completa
   - Webhooks e integrações
   - Machine learning para sugestões

2. **Qualidade**
   - Métricas de código
   - Análise estática avançada
   - Security scanning

## 💬 **Comunicação**

### **Antes de Começar**
- 💬 **Discuta grandes mudanças** primeiro via issue
- 🎯 **Mantenha PRs pequenos** e focados
- 📝 **Documente decisões** de design complexas

### **Durante o Desenvolvimento**
- 🔄 **Mantenha sua branch atualizada** com `main`
- 💬 **Faça perguntas** se algo não estiver claro
- 📊 **Compartilhe progresso** em issues longas

### **Canais de Comunicação**
- **📧 Email**: dev@peritolegado.com
- **💬 Discussions**: GitHub Discussions para ideias
- **🐛 Issues**: GitHub Issues para bugs e features
- **📱 Chat**: Discord (em breve)

## 📜 **Código de Conduta**

Este projeto adere ao [Contributor Covenant](https://www.contributor-covenant.org/). Ao participar, você deve aderir a este código.

### **Resumo**
- 🤝 Seja respeitoso e inclusivo
- 💬 Use linguagem apropriada
- 🎯 Foque no que é melhor para a comunidade
- 🙏 Aceite feedback construtivo graciosamente
- 🔄 Aprenda com erros e ajude outros a aprender

---

## 🎉 **Obrigado por Contribuir!**

Cada contribuição, por menor que seja, ajuda a fazer o Perito Legado melhor para todos. Obrigado por dedicar seu tempo para melhorar este projeto! 🚀

---

> **💡 Dica**: Comece com issues marcadas como `good first issue` para se familiarizar com o código base!
