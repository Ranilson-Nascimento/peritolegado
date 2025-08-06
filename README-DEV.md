# 🚀 Perito Legado - Modo Desenvolvimento

## 📋 Comandos Disponíveis

### Desenvolvimento Principal
```bash
npm run dev
```
- **Objetivo**: Inicia o servidor web em modo desenvolvimento
- **Características**: 
  - ✅ Hot-reload automático com nodemon
  - ✅ Monitoramento de arquivos TypeScript, HTML, CSS
  - ✅ Reinicialização automática ao detectar mudanças
  - ✅ Ambiente NODE_ENV=development

### Comandos Alternativos
```bash
# Comando específico para web com nodemon
npm run dev:web

# Comando com monitoramento estendido
npm run dev:watch

# Comando para CLI apenas
npm run dev:cli
```

### Script Windows (.bat)
```bash
# Execute diretamente no Windows
./dev.bat
```

## 🔧 Configuração do Nodemon

O arquivo `nodemon.json` está configurado para:

- **Monitorar**: Pastas `src/` e `web/`
- **Extensões**: `.ts`, `.js`, `.html`, `.css`, `.json`
- **Ignorar**: `node_modules`, `dist`, arquivos de teste
- **Delay**: 1 segundo entre mudanças
- **Comando de reinício**: Digite `rs` + Enter

## 🌐 URLs de Desenvolvimento

- **Interface Principal**: http://localhost:3000
- **Painel de Validação**: http://localhost:3000/validation-panel.html
- **Dashboard**: http://localhost:3000/dashboard.html

## 🔥 Hot-Reload em Ação

O sistema detecta automaticamente mudanças em:
- ✅ Arquivos TypeScript (`src/**/*.ts`)
- ✅ Arquivos HTML (`web/**/*.html`)
- ✅ Arquivos CSS (estilos)
- ✅ Arquivos de configuração JSON

### Logs de Exemplo:
```
[nodemon] restarting due to changes...
[nodemon] starting `ts-node src/web/enhanced-server.ts`
🚀 Servidor Perito Legado iniciado!
```

## 💡 Dicas de Uso

1. **Reinicialização Manual**: Digite `rs` + Enter no terminal
2. **Parar Servidor**: Ctrl+C
3. **Ver Logs**: O nodemon mostra logs detalhados de mudanças
4. **Debugging**: Logs automáticos do WebSocket e conexões

## 🛠️ Troubleshooting

### Se o servidor não reiniciar:
```bash
# Parar todos os processos Node
taskkill /F /IM node.exe

# Reiniciar em modo desenvolvimento
npm run dev
```

### Se houver conflito de porta:
- O servidor tenta usar a porta 3000
- Verifique se nenhum outro processo está usando a porta

---

**Modo desenvolvimento ativo!** 🔥 
O sistema agora reinicia automaticamente a cada mudança no código.
