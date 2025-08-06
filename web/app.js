class DatabaseMigrationApp {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.migrationRunning = false;
        this.sourceConfig = {};
        this.targetConfig = {};
        
        this.init();
    }

    init() {
        this.connectWebSocket();
        this.loadDatabaseOptions();
        this.setupEventListeners();
        this.addLog('Sistema iniciado - Aguardando configurações...', 'info');
    }

    connectWebSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            this.isConnected = true;
            this.addLog('Conectado ao servidor', 'success');
        });

        this.socket.on('disconnect', () => {
            this.isConnected = false;
            this.addLog('Desconectado do servidor', 'warning');
        });

        this.socket.on('migration:progress', (data) => {
            this.updateProgress(data);
        });

        this.socket.on('migration:complete', (data) => {
            this.migrationComplete(data);
        });

        this.socket.on('migration:error', (data) => {
            this.migrationError(data);
        });

        this.socket.on('migration:table-start', (data) => {
            this.addLog(`Iniciando migração da tabela: ${data.table}`, 'info');
            document.getElementById('statCurrentTable').textContent = data.table;
        });

        this.socket.on('migration:table-complete', (data) => {
            this.addLog(`Tabela ${data.table} migrada com sucesso (${data.recordCount} registros)`, 'success');
        });
    }

    setupEventListeners() {
        // Listeners para seleção de banco de dados
        document.addEventListener('click', (e) => {
            if (e.target.closest('.database-option')) {
                this.selectDatabase(e.target.closest('.database-option'));
            }
        });
    }

    loadDatabaseOptions() {
        const databases = [
            {
                type: 'paradox',
                name: 'Paradox',
                description: 'Banco de dados legado (.db files)',
                icon: 'fas fa-archive',
                color: '#e53e3e'
            },
            {
                type: 'firebird',
                name: 'Firebird',
                description: 'Open Source SQL Database',
                icon: 'fas fa-fire',
                color: '#d69e2e'
            },
            {
                type: 'mysql',
                name: 'MySQL',
                description: 'MySQL Database Server',
                icon: 'fas fa-database',
                color: '#3182ce'
            },
            {
                type: 'postgres',
                name: 'PostgreSQL',
                description: 'Advanced Open Source Database',
                icon: 'fas fa-elephant',
                color: '#2d3748'
            },
            {
                type: 'sqlserver',
                name: 'SQL Server',
                description: 'Microsoft SQL Server',
                icon: 'fas fa-server',
                color: '#805ad5'
            },
            {
                type: 'oracle',
                name: 'Oracle',
                description: 'Oracle Database',
                icon: 'fas fa-shield-alt',
                color: '#c53030'
            },
            {
                type: 'mongodb',
                name: 'MongoDB',
                description: 'NoSQL Document Database',
                icon: 'fas fa-leaf',
                color: '#38a169'
            }
        ];

        this.renderDatabaseOptions('sourceDatabaseSelector', databases);
        this.renderDatabaseOptions('targetDatabaseSelector', databases);
    }

    renderDatabaseOptions(containerId, databases) {
        const container = document.getElementById(containerId);
        container.innerHTML = databases.map(db => `
            <div class="database-option" data-type="${db.type}" data-container="${containerId}">
                <i class="${db.icon}" style="color: ${db.color}"></i>
                <div class="name">${db.name}</div>
                <div class="description">${db.description}</div>
            </div>
        `).join('');
    }

    selectDatabase(element) {
        const container = element.dataset.container;
        const type = element.dataset.type;
        
        // Remove seleção anterior
        document.querySelectorAll(`#${container} .database-option`).forEach(el => {
            el.classList.remove('selected');
        });
        
        // Adiciona seleção atual
        element.classList.add('selected');
        
        // Mostra campos de conexão
        this.showConnectionFields(container, type);
        
        // Armazena configuração
        const configKey = container.includes('source') ? 'sourceConfig' : 'targetConfig';
        this[configKey].type = type;
    }

    showConnectionFields(containerId, dbType) {
        const fieldsContainer = document.getElementById(
            containerId.includes('source') ? 'sourceConnectionFields' : 'targetConnectionFields'
        );
        
        const fields = this.getConnectionFields(dbType);
        fieldsContainer.innerHTML = fields;
        fieldsContainer.classList.add('active');
    }

    getConnectionFields(dbType) {
        const commonFields = {
            host: '<div class="form-group"><label class="form-label">Host:</label><input type="text" class="form-control" name="host" value="localhost"></div>',
            port: '<div class="form-group"><label class="form-label">Porta:</label><input type="number" class="form-control" name="port"></div>',
            database: '<div class="form-group"><label class="form-label">Nome do Banco:</label><input type="text" class="form-control" name="database" required></div>',
            username: '<div class="form-group"><label class="form-label">Usuário:</label><input type="text" class="form-control" name="username" required></div>',
            password: '<div class="form-group"><label class="form-label">Senha:</label><input type="password" class="form-control" name="password"></div>'
        };

        const dbPorts = {
            mysql: 3306,
            postgres: 5432,
            sqlserver: 1433,
            oracle: 1521,
            firebird: 3050,
            mongodb: 27017
        };

        switch (dbType) {
            case 'paradox':
                return `
                    <div class="form-group">
                        <label class="form-label">Caminho dos arquivos Paradox:</label>
                        <input type="text" class="form-control" name="path" placeholder="C:\\dados\\paradox" required>
                        <small class="form-text text-muted">Caminho para a pasta contendo os arquivos .db do Paradox</small>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Driver ODBC:</label>
                        <input type="text" class="form-control" name="driver" value="Microsoft Paradox Driver (*.db )" readonly>
                    </div>
                `;

            case 'firebird':
                return `
                    ${commonFields.host}
                    <div class="form-group">
                        <label class="form-label">Porta:</label>
                        <input type="number" class="form-control" name="port" value="${dbPorts.firebird}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Arquivo do Banco (.fdb):</label>
                        <input type="text" class="form-control" name="database" placeholder="C:\\dados\\database.fdb" required>
                    </div>
                    ${commonFields.username}
                    ${commonFields.password}
                `;

            case 'mysql':
                return `
                    ${commonFields.host}
                    <div class="form-group">
                        <label class="form-label">Porta:</label>
                        <input type="number" class="form-control" name="port" value="${dbPorts.mysql}">
                    </div>
                    ${commonFields.database}
                    ${commonFields.username}
                    ${commonFields.password}
                `;

            case 'postgres':
                return `
                    ${commonFields.host}
                    <div class="form-group">
                        <label class="form-label">Porta:</label>
                        <input type="number" class="form-control" name="port" value="${dbPorts.postgres}">
                    </div>
                    ${commonFields.database}
                    ${commonFields.username}
                    ${commonFields.password}
                `;

            case 'sqlserver':
                return `
                    ${commonFields.host}
                    <div class="form-group">
                        <label class="form-label">Porta:</label>
                        <input type="number" class="form-control" name="port" value="${dbPorts.sqlserver}">
                    </div>
                    ${commonFields.database}
                    ${commonFields.username}
                    ${commonFields.password}
                    <div class="form-group">
                        <label class="form-label" style="display: flex; align-items: center; gap: 10px;">
                            <input type="checkbox" name="trustServerCertificate" style="width: auto;">
                            Confiar no certificado do servidor
                        </label>
                    </div>
                `;

            case 'oracle':
                return `
                    ${commonFields.host}
                    <div class="form-group">
                        <label class="form-label">Porta:</label>
                        <input type="number" class="form-control" name="port" value="${dbPorts.oracle}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">SID/Service Name:</label>
                        <input type="text" class="form-control" name="serviceName" required>
                    </div>
                    ${commonFields.username}
                    ${commonFields.password}
                `;

            case 'mongodb':
                return `
                    ${commonFields.host}
                    <div class="form-group">
                        <label class="form-label">Porta:</label>
                        <input type="number" class="form-control" name="port" value="${dbPorts.mongodb}">
                    </div>
                    ${commonFields.database}
                    <div class="form-group">
                        <label class="form-label">Usuário (opcional):</label>
                        <input type="text" class="form-control" name="username">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Senha (opcional):</label>
                        <input type="password" class="form-control" name="password">
                    </div>
                `;

            default:
                return '<div class="alert alert-warning">Selecione um banco de dados</div>';
        }
    }

    getConnectionConfig(type) {
        const containerId = type === 'source' ? 'sourceConnectionFields' : 'targetConnectionFields';
        const container = document.getElementById(containerId);
        const inputs = container.querySelectorAll('input, select');
        
        const config = {};
        inputs.forEach(input => {
            if (input.type === 'checkbox') {
                config[input.name] = input.checked;
            } else if (input.value.trim()) {
                config[input.name] = input.value.trim();
            }
        });
        
        return config;
    }

    showAlert(message, type = 'info') {
        const alertHtml = `
            <div class="alert alert-${type} animate__animated animate__fadeInDown">
                <i class="fas fa-${this.getAlertIcon(type)}"></i>
                ${message}
            </div>
        `;
        
        const container = document.querySelector('.main-content');
        container.insertAdjacentHTML('afterbegin', alertHtml);
        
        // Remove o alerta após 5 segundos
        setTimeout(() => {
            const alert = container.querySelector('.alert');
            if (alert) {
                alert.classList.add('animate__fadeOutUp');
                setTimeout(() => alert.remove(), 500);
            }
        }, 5000);
    }

    getAlertIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    addLog(message, type = 'info') {
        const logContainer = document.getElementById('logContainer');
        const timestamp = new Date().toLocaleTimeString('pt-BR');
        
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${type}`;
        logEntry.innerHTML = `[${timestamp}] ${message}`;
        
        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight;
        
        // Limita o número de logs
        const entries = logContainer.querySelectorAll('.log-entry');
        if (entries.length > 100) {
            entries[0].remove();
        }
    }

    updateProgress(data) {
        const { progress, currentTable, processedRecords, totalRecords, errors } = data;
        
        document.getElementById('progressFill').style.width = `${progress}%`;
        document.getElementById('statusTitle').textContent = 
            `Migração em andamento - ${Math.round(progress)}%`;
        
        if (currentTable) {
            document.getElementById('statCurrentTable').textContent = currentTable;
        }
        
        document.getElementById('statProcessed').textContent = processedRecords || 0;
        document.getElementById('statTotal').textContent = totalRecords || 0;
        document.getElementById('statErrors').textContent = errors || 0;
        
        this.addLog(`Progresso: ${Math.round(progress)}% - ${processedRecords}/${totalRecords} registros`, 'info');
    }

    migrationComplete(data) {
        this.migrationRunning = false;
        document.getElementById('statusTitle').textContent = 'Migração Concluída com Sucesso!';
        document.getElementById('progressFill').style.width = '100%';
        document.getElementById('stopBtn').style.display = 'none';
        
        this.addLog(`Migração concluída! ${data.totalRecords} registros migrados`, 'success');
        this.showAlert('Migração concluída com sucesso!', 'success');
    }

    migrationError(data) {
        this.migrationRunning = false;
        document.getElementById('statusTitle').textContent = 'Erro na Migração';
        document.getElementById('stopBtn').style.display = 'none';
        
        this.addLog(`Erro na migração: ${data.error}`, 'error');
        this.showAlert(`Erro na migração: ${data.error}`, 'error');
    }
}

// Funções globais para os botões
async function testConnection(type) {
    const app = window.migrationApp;
    const config = app.getConnectionConfig(type);
    const dbType = type === 'source' ? app.sourceConfig.type : app.targetConfig.type;
    
    if (!dbType) {
        app.showAlert('Selecione um banco de dados primeiro', 'warning');
        return;
    }
    
    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Testando...';
    btn.disabled = true;
    
    try {
        const response = await fetch('/api/test-connection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: dbType, config })
        });
        
        const result = await response.json();
        
        if (result.success) {
            app.showAlert(`Conexão ${type} testada com sucesso!`, 'success');
            app.addLog(`Conexão ${type} (${dbType}) estabelecida com sucesso`, 'success');
            
            if (type === 'source') {
                app.sourceConfig = { type: dbType, ...config };
            } else {
                app.targetConfig = { type: dbType, ...config };
            }
        } else {
            app.showAlert(`Erro na conexão ${type}: ${result.error}`, 'error');
            app.addLog(`Falha na conexão ${type}: ${result.error}`, 'error');
        }
    } catch (error) {
        app.showAlert(`Erro na conexão ${type}: ${error.message}`, 'error');
        app.addLog(`Erro na conexão ${type}: ${error.message}`, 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function loadSchema(type) {
    const app = window.migrationApp;
    const config = type === 'source' ? app.sourceConfig : app.targetConfig;
    
    if (!config.type) {
        app.showAlert(`Configure a conexão ${type} primeiro`, 'warning');
        return;
    }
    
    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Carregando...';
    btn.disabled = true;
    
    try {
        const response = await fetch('/api/schema', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        
        const result = await response.json();
        
        if (result.success) {
            const tables = result.tables;
            app.addLog(`Esquema carregado: ${tables.length} tabelas encontradas`, 'success');
            
            // Aqui você pode implementar uma modal ou seção para mostrar as tabelas
            console.log('Tabelas encontradas:', tables);
            app.showAlert(`Esquema carregado: ${tables.length} tabelas encontradas`, 'success');
        } else {
            app.showAlert(`Erro ao carregar esquema: ${result.error}`, 'error');
        }
    } catch (error) {
        app.showAlert(`Erro ao carregar esquema: ${error.message}`, 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function validateConnections() {
    const app = window.migrationApp;
    
    if (!app.sourceConfig.type || !app.targetConfig.type) {
        app.showAlert('Configure ambas as conexões primeiro', 'warning');
        return;
    }
    
    app.addLog('Validando configurações...', 'info');
    
    // Testa ambas as conexões
    try {
        await testConnection('source');
        await testConnection('target');
        app.showAlert('Todas as configurações estão válidas!', 'success');
    } catch (error) {
        app.showAlert('Erro na validação das configurações', 'error');
    }
}

async function startMigration() {
    const app = window.migrationApp;
    
    if (!app.sourceConfig.type || !app.targetConfig.type) {
        app.showAlert('Configure ambas as conexões primeiro', 'warning');
        return;
    }
    
    if (app.migrationRunning) {
        app.showAlert('Migração já está em execução', 'warning');
        return;
    }
    
    const migrationOptions = {
        batchSize: parseInt(document.getElementById('batchSize').value) || 1000,
        parallelTables: parseInt(document.getElementById('parallelTables').value) || 1,
        dryRun: document.getElementById('dryRun').checked,
        tablesOption: document.getElementById('tablesOption').value
    };
    
    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Iniciando...';
    btn.disabled = true;
    
    try {
        const response = await fetch('/api/migrate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source: app.sourceConfig,
                target: app.targetConfig,
                options: migrationOptions
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            app.migrationRunning = true;
            document.getElementById('statusPanel').style.display = 'block';
            document.getElementById('stopBtn').style.display = 'block';
            app.addLog('Migração iniciada com sucesso', 'success');
            app.showAlert('Migração iniciada!', 'success');
        } else {
            app.showAlert(`Erro ao iniciar migração: ${result.error}`, 'error');
        }
    } catch (error) {
        app.showAlert(`Erro ao iniciar migração: ${error.message}`, 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function stopMigration() {
    const app = window.migrationApp;
    
    if (!app.migrationRunning) {
        return;
    }
    
    try {
        const response = await fetch('/api/stop-migration', {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            app.migrationRunning = false;
            document.getElementById('stopBtn').style.display = 'none';
            app.addLog('Migração interrompida pelo usuário', 'warning');
            app.showAlert('Migração interrompida', 'warning');
        }
    } catch (error) {
        app.showAlert(`Erro ao parar migração: ${error.message}`, 'error');
    }
}

// Inicializa a aplicação quando a página carrega
document.addEventListener('DOMContentLoaded', () => {
    window.migrationApp = new DatabaseMigrationApp();
});
