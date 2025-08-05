# Instruções para resolver problema de autenticação Git

## O problema
O erro `Permission denied to GiGa-Informatica` indica que o Git está usando credenciais salvas de outro usuário.

## Soluções possíveis:

### Opção 1: Limpar credenciais salvas (Recomendado)
```powershell
# Limpar credenciais do Windows Credential Manager
git config --global --unset credential.helper
cmdkey /list:git:https://github.com
cmdkey /delete:git:https://github.com
```

### Opção 2: Usar token de acesso pessoal
1. Vá para GitHub.com → Settings → Developer settings → Personal access tokens
2. Gere um novo token com permissões de repository
3. Use o token como senha quando solicitado

### Opção 3: Configurar SSH (Mais seguro)
```powershell
# Gerar chave SSH
ssh-keygen -t ed25519 -C "ranilsonnunes6@gmail.com"

# Adicionar a chave ao ssh-agent
ssh-add ~/.ssh/id_ed25519

# Copiar a chave pública para adicionar no GitHub
cat ~/.ssh/id_ed25519.pub
```

Depois altere a URL do repositório para SSH:
```powershell
git remote set-url origin git@github.com:Ranilson-Nascimento/peritolegado.git
```

### Após resolver a autenticação:
```powershell
git push -u origin main
```

## Verificar se o repositório existe
Certifique-se de que o repositório https://github.com/Ranilson-Nascimento/peritolegado.git foi criado no GitHub.
