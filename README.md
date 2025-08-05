# Perito Legado

Uma ferramenta CLI para testar conexões com diferentes bancos de dados legados, desenvolvida em TypeScript.

## 📋 Descrição

O Perito Legado é uma aplicação de linha de comando que permite testar conexões com diversos tipos de bancos de dados comumente encontrados em sistemas legados. Suporta múltiplos SGBDs através de uma arquitetura modular de adaptadores.

## 🔧 Bancos de Dados Suportados

- **MySQL** - Banco de dados relacional popular
- **PostgreSQL** - Banco de dados relacional avançado
- **Oracle** - Sistema de gerenciamento de banco de dados empresarial
- **SQL Server** - Banco de dados da Microsoft
- **MongoDB** - Banco de dados NoSQL orientado a documentos
- **Firebird** - Banco de dados relacional open source

## 🚀 Instalação

### Pré-requisitos

- Node.js (versão 16 ou superior)
- npm ou yarn

### Instalação das dependências

```bash
npm install
```

### Configuração

1. Copie o arquivo `.env.example` para `.env`:
```bash
cp .env.example .env
```

2. Configure as variáveis de ambiente no arquivo `.env` com suas credenciais de banco:

```env
# MySQL
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASS=sua_senha
MYSQL_DB=seu_banco

# PostgreSQL
PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=sua_senha
PG_DATABASE=seu_banco

# Oracle
ORACLE_USER=system
ORACLE_PASSWORD=sua_senha
ORACLE_CONNECT_STRING=localhost:1521/xe

# SQL Server
SQLSERVER_HOST=localhost
SQLSERVER_PORT=1433
SQLSERVER_USER=sa
SQLSERVER_PASSWORD=sua_senha
SQLSERVER_DATABASE=seu_banco

# MongoDB
MONGODB_URI=mongodb://localhost:27017/seu_banco

# Firebird
FIREBIRD_HOST=localhost
FIREBIRD_PORT=3050
FIREBIRD_USER=SYSDBA
FIREBIRD_PASSWORD=sua_senha
FIREBIRD_DATABASE=caminho/para/seu_banco.fdb
```

## 📦 Build

Para compilar o projeto TypeScript:

```bash
npm run build
```

## 🎯 Uso

### Testando Conexão com Banco de Dados

```bash
# Testar conexão MySQL
npx ts-node src/cli.ts test-connection -d mysql

# Testar conexão PostgreSQL
npx ts-node src/cli.ts test-connection -d postgres

# Testar conexão Oracle
npx ts-node src/cli.ts test-connection -d oracle

# Testar conexão SQL Server
npx ts-node src/cli.ts test-connection -d sqlserver

# Testar conexão MongoDB
npx ts-node src/cli.ts test-connection -d mongodb

# Testar conexão Firebird
npx ts-node src/cli.ts test-connection -d firebird
```

### Exemplos de Uso

```bash
# Verificar se o MySQL está acessível
npx ts-node src/cli.ts test-connection --db mysql

# Verificar conectividade com PostgreSQL
npx ts-node src/cli.ts test-connection --db postgres
```

## 🏗️ Arquitetura

O projeto segue uma arquitetura modular baseada em adaptadores:

```
src/
├── cli.ts              # Interface de linha de comando
├── config.ts           # Configurações centralizadas
└── adapters/
    ├── index.ts         # Exports dos adaptadores
    ├── types.ts         # Tipos TypeScript
    ├── mysql.ts         # Adaptador MySQL
    ├── postgres.ts      # Adaptador PostgreSQL
    ├── oracle.ts        # Adaptador Oracle
    ├── sqlserver.ts     # Adaptador SQL Server
    ├── mongodb.ts       # Adaptador MongoDB
    └── firebird.ts      # Adaptador Firebird
```

### Adicionando Novos Adaptadores

Para adicionar suporte a um novo banco de dados:

1. Crie um novo arquivo adaptador em `src/adapters/`
2. Implemente a interface `DatabaseAdapter` 
3. Adicione o adaptador ao factory em `cli.ts`
4. Exporte o adaptador em `src/adapters/index.ts`
5. Adicione as configurações necessárias em `config.ts`

## 🧪 Desenvolvimento

### Scripts Disponíveis

```bash
# Executar em modo de desenvolvimento
npm run dev

# Compilar TypeScript
npm run build

# Executar testes
npm test

# Verificar formatação do código
npm run lint
```

## 📝 Licença

Este projeto está licenciado sob a licença ISC.

## 🤝 Contribuindo

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📞 Suporte

Para suporte ou dúvidas, abra uma issue no repositório.

## 🔄 Changelog

### v1.0.0
- Suporte inicial para MySQL, PostgreSQL, Oracle, SQL Server, MongoDB e Firebird
- Interface CLI básica para teste de conexões
- Arquitetura modular de adaptadores
