# 🎯 Perito Legado - Sistema Profissional de Migração

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)
![License](https://img.shields.io/badge/license-ISC-green.svg)

**Sistema completo de migração entre bancos de dados com interface web inteligente e CLI profissional**

> 🚀 **Especializado em migração de sistemas legados**: Paradox, SQLite → Firebird com mapeamento automático e interface visual avançada.

## ✨ **Características Principais**

### 🌐 **Interface Web Inteligente** *(NOVA!)*
- **Dashboard profissional** com navegação intuitiva
- **Migração visual drag-and-drop** com mapeamento automático
- **Validação em tempo real** de conexões e esquemas
- **Monitoramento ao vivo** do progresso de migração
- **Sistema de abas** para organização do workflow
- **Debug tools** integradas para troubleshooting

### 🎯 **Migração Inteligente** *(DESTAQUE!)*
- **Auto-detecção de bancos** locais e em rede
- **Mapeamento automático** de tabelas e campos similares
- **Sugestões inteligentes** baseadas em nomes e tipos
- **Validação automática** de tipos e compatibilidade
- **Transferência em lotes** com retry automático
- **Interface responsiva** para qualquer dispositivo

### 🔧 **CLI Profissional**
- **Comandos avançados** para automação
- **Processamento paralelo** de múltiplas tabelas
- **Configuração flexível** via JSON
- **Logs estruturados** e rastreamento completo
- **Modo dry-run** para simulação segura

## �️ **Bancos de Dados Suportados**

| Banco | Origem | Destino | Interface Web | Recursos Especiais |
|-------|--------|---------|---------------|-------------------|
| **Paradox** | ✅ | ❌ | ✅ | DB/PX files, Auto-increment |
| **SQLite** | ✅ | ❌ | ✅ | Local files, Portabilidade |
| **Firebird** | ✅ | ✅ | ✅ | Generators, Domains, GDB/FDB |
| **MySQL** | ✅ | ✅ | 🔧 | Auto-increment, JSON, Índices |
| **PostgreSQL** | ✅ | ✅ | 🔧 | Arrays, JSONB, UUID |

> **Legenda**: ✅ Suportado | 🔧 Em desenvolvimento | ❌ Não aplicável

## 🚀 **Instalação e Configuração**

### **Pré-requisitos**
- Node.js 18+ (recomendado: 20 LTS)
- npm ou yarn
- Windows 10/11, Linux ou macOS

### **Instalação Rápida**
```bash
# 1. Clone o repositório
git clone https://github.com/Ranilson-Nascimento/peritolegado.git
cd peritolegado

# 2. Instale as dependências
npm install

# 3. Inicie o sistema (modo desenvolvimento)
npm run dev
```

### **Acesso à Interface Web**
Após a inicialização, acesse:
- **🏠 Dashboard Principal**: http://localhost:3000/dashboard.html
- **🎯 Migração Inteligente**: http://localhost:3000/
- **🧪 Painel de Validações**: http://localhost:3000/validation-panel.html

## 🎯 **Como Usar - Interface Web**

### **1. 🏠 Dashboard (Recomendado para Iniciantes)**
```
1. Acesse: http://localhost:3000/dashboard.html
2. Clique em "🚀 Iniciar Migração Inteligente"
3. Siga o workflow visual passo a passo
```

### **2. 🎯 Migração Inteligente (Usuários Avançados)**
```
1. 📁 CONEXÕES: Configure bancos origem e destino
2. 🔍 ANÁLISE: Auto-detecção e verificação de esquemas
3. 🎨 MAPEAMENTO: Interface visual drag-and-drop
4. ✅ VALIDAÇÃO: Verificação automática de compatibilidade
5. 🚀 MIGRAÇÃO: Execução com monitoramento em tempo real
```

### **3. 🧪 Validações (Troubleshooting)**
- **Teste de conectividade** dos bancos
- **Verificação de dependências** do sistema
- **Diagnóstico automático** de problemas
- **Relatórios detalhados** de status

## 📱 **Interface Web - Recursos Principais**

### **🎨 Mapeamento Visual**
- **Drag & Drop**: Arraste campos para criar mapeamentos
- **Sugestões automáticas**: Sistema IA sugere mapeamentos similares
- **Validação em tempo real**: Verificação instantânea de compatibilidade
- **Preview de dados**: Visualize antes de migrar

### **📊 Monitoramento Avançado**
- **Progresso em tempo real** com barras de status
- **Logs detalhados** com timestamps
- **Estatísticas ao vivo** (registros/segundo, tempo restante)
- **Notificações** de erros e sucessos

### **🔧 Debug Tools**
- **Inspetor de estado** do sistema
- **Logs estruturados** com filtragem
- **Teste de conexões** individual
- **Análise de performance** em tempo real

## 💻 **CLI - Linha de Comando**

### **Comandos Essenciais**

```bash
# 🔌 Testar conexões
npm run cli test-connection --type firebird
npm run cli test-connection --type paradox

# 📋 Listar esquemas
npm run cli list-schema --source paradox --output schema.json

# 🚀 Migração direta (CLI)
npm run cli migrate --source paradox --target firebird --tables "users,products"

# 🔧 Modo desenvolvimento
npm run dev        # Interface web + CLI
npm run dev:cli    # Apenas CLI
```

### **Configuração via Arquivo**
```json
{
  "source": {
    "type": "paradox",
    "config": {
      "directory": "C:\\Database\\Paradox",
      "encoding": "cp1252"
    }
  },
  "target": {
    "type": "firebird",
    "config": {
      "host": "localhost",
      "database": "C:\\Database\\sistema.fdb",
      "user": "SYSDBA",
      "password": "masterkey"
    }
  },
  "options": {
    "batchSize": 1000,
    "parallel": true,
    "dryRun": false
  }
}
```

## 🏗️ **Arquitetura do Sistema**

```
📁 Perito Legado/
├── � web/                      # Interface Web
│   ├── dashboard.html           # Dashboard principal
│   ├── index.html              # Migração inteligente  
│   ├── intelligent-mapping.html # Sistema avançado
│   └── validation-panel.html   # Painel de validações
├── 🔧 src/                      # Core do Sistema
│   ├── cli.ts                  # Interface CLI
│   ├── config.ts               # Configurações
│   ├── 🎯 core/                # Motor de Migração
│   │   ├── migration-engine.ts # Engine principal
│   │   └── type-mapper.ts      # Mapeamento de tipos
│   ├── 🔌 adapters/            # Conectores de Banco
│   │   ├── paradox.ts          # Paradox (origem)
│   │   ├── sqlite.ts           # SQLite (origem)
│   │   ├── firebird.ts         # Firebird (destino)
│   │   └── data-converters.ts  # Conversores de dados
│   └── 🌐 web/                 # Servidor Web
│       ├── server.ts           # Servidor Express
│       └── socket-handlers.ts  # WebSocket handlers
└── 📚 docs/                    # Documentação
```

### **🔥 Características da Arquitetura**
- **🎯 Modular**: Adaptadores independentes para cada banco
- **⚡ Performático**: Streaming e processamento paralelo
- **🔧 Extensível**: Fácil adição de novos bancos
- **🌐 Híbrido**: Interface web + CLI profissional
- **📊 Observável**: Logs estruturados e métricas em tempo real
- **🛡️ Resiliente**: Retry automático e tratamento de erros

## 🎮 **Exemplos Práticos**

### **📊 Caso 1: Migração Paradox → Firebird (Visual)**
```
🎯 Cenário: Sistema ERP legado em Paradox para Firebird moderno

1. 🏠 Dashboard → "Migração Inteligente"
2. 📁 Conectar Paradox: Selecionar pasta com arquivos .DB
3. 📁 Conectar Firebird: Configurar servidor e base
4. 🔍 Auto-análise: Sistema detecta tabelas automaticamente
5. 🎨 Mapeamento: Drag & Drop para ajustar campos
6. ✅ Validação: Verificação automática de compatibilidade
7. 🚀 Migração: Execução com monitoramento ao vivo
```

### **💻 Caso 2: Migração SQLite → Firebird (CLI)**
```bash
# Análise inicial
npm run cli list-schema --source sqlite --file "dados.sqlite"

# Migração com configuração
npm run cli migrate \
  --source sqlite \
  --target firebird \
  --config migration-config.json \
  --batch-size 2000 \
  --parallel 3
```

### **🔧 Caso 3: Validação de Sistema**
```
🧪 Painel de Validações:
✅ Conectividade Paradox: OK
✅ Conectividade Firebird: OK  
✅ Dependências Sistema: OK
✅ Espaço em Disco: 15GB disponível
⚠️ Memória RAM: 8GB (recomendado: 16GB)
```

## 🚨 **Boas Práticas e Segurança**

### **🛡️ Antes da Migração**
- ✅ **Backup completo** dos dados originais
- ✅ **Teste em ambiente** de homologação
- ✅ **Validação de espaço** em disco
- ✅ **Verificação de dependências** do sistema

### **⚡ Performance**
- **Batch Size**: 1000-5000 registros (padrão: 1000)
- **Paralelismo**: 2-4 threads (baseado em CPU)
- **Memória**: 8GB mínimo, 16GB recomendado
- **Disco**: SSD recomendado para melhor I/O

### **🔐 Segurança**
- **Credenciais**: Sempre via variáveis de ambiente
- **Conexões**: SSL/TLS quando disponível
- **Logs**: Não armazenam senhas ou dados sensíveis
- **Isolamento**: Transações independentes por tabela

## 🧪 **Desenvolvimento e Testes**

### **🚀 Scripts de Desenvolvimento**
```bash
# 🔥 Desenvolvimento principal (interface web + CLI)
npm run dev

# � Apenas CLI
npm run dev:cli

# 🌐 Apenas servidor web
npm run dev:web

# 🧪 Testes automatizados
npm test

# 📦 Build para produção
npm run build

# 🧹 Limpeza de builds
npm run clean

# 🎯 Script Windows direto
./dev.bat
```

### **🔧 Configuração do Nodemon**
- **Monitoramento**: Arquivos `.ts`, `.html`, `.css`, `.json`
- **Pastas**: `src/`, `web/`
- **Hot-reload**: Automático em mudanças
- **Restart manual**: Digite `rs` + Enter

### **🧪 Adicionando Novos Adaptadores**
```typescript
// src/adapters/meu-banco.ts
export class MeuBancoAdapter implements DatabaseAdapter {
  readonly type = 'meu-banco';
  
  async connect(config: ConnectionConfig): Promise<any> {
    // Implementar conexão
  }
  
  async getSchema(): Promise<DatabaseSchema> {
    // Implementar análise de esquema
  }
  
  async readData(table: string): Promise<any[]> {
    // Implementar leitura de dados
  }
}

// Registrar em src/adapters/index.ts
export { MeuBancoAdapter } from './meu-banco';
```

## � **Roadmap e Futuras Funcionalidades**

### **🚀 Versão 2.1 (Próxima)**
- ✅ **Interface mobile-responsive** aprimorada
- ✅ **Suporte a Oracle** e SQL Server na interface web
- ✅ **Export de relatórios** em PDF/Excel
- ✅ **Agendamento** de migrações automáticas
- ✅ **API REST** para integrações externas

### **🎯 Versão 2.2 (Futuro)**
- 🔧 **Suporte a MongoDB** e ElasticSearch
- 🔧 **Machine Learning** para sugestões de mapeamento
- 🔧 **Clusters** e migração distribuída
- 🔧 **Interface de administração** multi-usuário
- 🔧 **Plugin system** para extensões customizadas

### **🌟 Versão 3.0 (Visão)**
- 🔮 **Cloud migration** (AWS, Azure, GCP)
- 🔮 **Real-time synchronization** entre bancos
- 🔮 **Data quality** e limpeza automática
- 🔮 **Compliance** e auditoria avançada
- 🔮 **AI-powered** schema evolution

## 🤝 **Contribuindo**

### **🔀 Como Contribuir**
```bash
# 1. Fork o projeto
git fork https://github.com/Ranilson-Nascimento/peritolegado

# 2. Crie uma branch
git checkout -b feature/nova-funcionalidade

# 3. Faça suas alterações
# ... desenvolvimento ...

# 4. Commit com mensagem clara
git commit -m "feat: adiciona suporte a PostgreSQL na interface web"

# 5. Push e Pull Request
git push origin feature/nova-funcionalidade
```

### **📝 Padrões de Código**
- **TypeScript** strict mode
- **ESLint** + Prettier para formatação
- **Conventional Commits** para mensagens
- **Testes unitários** obrigatórios para novos recursos
- **Documentação** atualizada sempre

### **🎯 Áreas que Precisam de Ajuda**
- 🔧 Novos adaptadores de banco
- 🎨 Melhorias na interface web
- 📚 Documentação e exemplos
- 🧪 Testes automatizados
- 🌐 Internacionalização (i18n)

## 📞 **Suporte e Comunidade**

### **💬 Canais de Suporte**
- **📧 Email**: suporte@peritolegado.com
- **🐛 Issues**: [GitHub Issues](https://github.com/Ranilson-Nascimento/peritolegado/issues)
- **💡 Discussões**: [GitHub Discussions](https://github.com/Ranilson-Nascimento/peritolegado/discussions)
- **📚 Wiki**: [Documentação Completa](https://github.com/Ranilson-Nascimento/peritolegado/wiki)

### **🆘 FAQ - Problemas Comuns**

**❓ "Erro de conexão com Firebird"**
```bash
# Verificar se o servidor está ativo
telnet localhost 3050

# Testar credenciais
npm run cli test-connection --type firebird
```

**❓ "Paradox não detecta arquivos"**
```bash
# Verificar permissões da pasta
# Certificar que há arquivos .DB na pasta
# Tentar diferentes encodings (cp1252, utf8)
```

**❓ "Interface web não carrega"**
```bash
# Verificar se o servidor está ativo
npm run dev

# Acessar: http://localhost:3000/dashboard.html
# Verificar logs no console do navegador
```

## � **Licença e Créditos**

### **📄 Licença**
Este projeto está licenciado sob a **ISC License** - veja o arquivo [LICENSE](LICENSE) para detalhes.

### **🙏 Créditos e Agradecimentos**
- **Node.js** e comunidade TypeScript
- **Firebird Foundation** pela documentação técnica
- **Paradox Community** pelo suporte a formatos legados
- **Express.js** e **Socket.IO** para infraestrutura web
- **Contribuidores** que tornam este projeto possível

### **⭐ Star History**
Se este projeto te ajudou, considere dar uma ⭐ no repositório!

---

## � **Status do Projeto**

![GitHub Workflow Status](https://img.shields.io/github/workflow/status/Ranilson-Nascimento/peritolegado/CI)
![GitHub issues](https://img.shields.io/github/issues/Ranilson-Nascimento/peritolegado)
![GitHub pull requests](https://img.shields.io/github/issues-pr/Ranilson-Nascimento/peritolegado)
![GitHub last commit](https://img.shields.io/github/last-commit/Ranilson-Nascimento/peritolegado)
![GitHub code size](https://img.shields.io/github/languages/code-size/Ranilson-Nascimento/peritolegado)

**🎯 Perito Legado v2.0** - *Migração inteligente de dados legados com interface web profissional*

> Desenvolvido com ❤️ para facilitar a modernização de sistemas legados

---

## 🔄 **Changelog Recente**

### **v2.0.0** *(Janeiro 2025)*
- 🚀 **NOVO**: Interface web completa com dashboard profissional
- 🎯 **NOVO**: Sistema de migração inteligente com drag-and-drop
- 🔧 **NOVO**: Painel de validações avançado com diagnóstico automático
- ⚡ **MELHORIA**: Motor de migração completamente reescrito
- 🎨 **MELHORIA**: Interface responsiva e moderna
- 🛡️ **MELHORIA**: Sistema de logs e debug aprimorado
- 📊 **MELHORIA**: Monitoramento em tempo real
- 🔌 **NOVO**: Suporte aprimorado para Paradox e SQLite
- 🌐 **NOVO**: WebSocket para comunicação em tempo real
- 📱 **NOVO**: Design responsivo para dispositivos móveis

### **v1.0.0** *(Dezembro 2024)*
- ✅ Sistema CLI básico funcional
- ✅ Adaptadores para múltiplos bancos
- ✅ Motor de migração com processamento paralelo
- ✅ Mapeamento automático de tipos
- ✅ Documentação inicial completa
