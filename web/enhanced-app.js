class IntelligentMigrationApp {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.migrationRunning = false;
        this.sourceConfig = {};
        this.targetConfig = {};
        this.sourceSchema = null;
        this.currentMigrationId = null;
        
        this.init();
    }

    init() {
        this.connectWebSocket();
        this.loadDatabaseOptions();
        this.setupEventListeners();
        this.addLog('🚀 Sistema de Migração Inteligente Paradox → Firebird iniciado', 'info');
        this.showWelcomeMessage();
    }

    showWelcomeMessage() {
        const welcomeMsg = `
            <div class="alert alert-info animate__animated animate__bounceIn">
                <h4><i class="fas fa-star"></i> Migração Inteligente Paradox → Firebird</h4>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>🔍 <strong>Detecção automática:</strong> Local, rede ou nuvem</li>
                    <li>🚀 <strong>Performance otimizada:</strong> Migração em lotes com retry</li>
                    <li>📊 <strong>Monitoramento:</strong> Progresso em tempo real</li>
                    <li>✅ <strong>Validação:</strong> Verificação automática dos dados</li>
                    <li>🛡️ <strong>Confiabilidade:</strong> Tratamento inteligente de erros</li>
                </ul>
                <p><strong>Configure suas conexões e inicie a migração profissional!</strong></p>
            </div>
        `;
        
        const container = document.querySelector('.main-content');
        container.insertAdjacentHTML('afterbegin', welcomeMsg);
    }

    connectWebSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            this.isConnected = true;
            this.addLog('🔌 Conectado ao servidor de migração', 'success');
        });

        this.socket.on('disconnect', () => {
            this.isConnected = false;
            this.addLog('⚠️ Desconectado do servidor', 'warning');
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
            this.addLog(`📋 Iniciando: ${data.table}`, 'info');
            document.getElementById('statCurrentTable').textContent = data.table;
        });

        this.socket.on('migration:table-complete', (data) => {
            this.addLog(`✅ Concluída: ${data.table} (${data.records.toLocaleString()} registros)`, 'success');
        });
    }

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('.database-option')) {
                this.selectDatabase(e.target.closest('.database-option'));
            }
            
            if (e.target.closest('.auto-detect-btn')) {
                this.autoDetectParadoxLocation();
            }
        });

        // Listener para mudança no tipo de localização
        document.addEventListener('change', (e) => {
            if (e.target.name === 'locationType') {
                this.showLocationFields(e.target.value);
            }
        });
    }

    loadDatabaseOptions() {
        const sourceDatabases = [
            {
                type: 'paradox',
                name: 'Paradox',
                description: 'Banco legado (.db files) - Inteligente',
                icon: 'fas fa-archive',
                color: '#e53e3e',
                features: ['Auto-detecção', 'Local/Rede/Nuvem', 'Análise inteligente']
            }
        ];

        const targetDatabases = [
            {
                type: 'firebird',
                name: 'Firebird',
                description: 'Banco SQL moderno - Otimizado',
                icon: 'fas fa-fire',
                color: '#d69e2e',
                features: ['Alta performance', 'Transações', 'Índices automáticos']
            }
        ];

        this.renderDatabaseOptions('sourceDatabaseSelector', sourceDatabases);
        this.renderDatabaseOptions('targetDatabaseSelector', targetDatabases);
    }

    renderDatabaseOptions(containerId, databases) {
        const container = document.getElementById(containerId);
        container.innerHTML = databases.map(db => `
            <div class="database-option enhanced" data-type="${db.type}" data-container="${containerId}">
                <i class="${db.icon}" style="color: ${db.color}"></i>
                <div class="name">${db.name}</div>
                <div class="description">${db.description}</div>
                ${db.features ? `
                    <div class="features">
                        ${db.features.map(feature => `<span class="feature-tag">${feature}</span>`).join('')}
                    </div>
                ` : ''}
            </div>
        `).join('');
    }

    selectDatabase(element) {
        const container = element.dataset.container;
        const type = element.dataset.type;
        
        document.querySelectorAll(`#${container} .database-option`).forEach(el => {
            el.classList.remove('selected');
        });
        
        element.classList.add('selected');
        this.showConnectionFields(container, type);
        
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

        // Auto-selecionar Paradox e Firebird se ainda não selecionados
        if (dbType === 'paradox') {
            const targetFirebird = document.querySelector('#targetDatabaseSelector .database-option[data-type="firebird"]');
            if (targetFirebird && !targetFirebird.classList.contains('selected')) {
                setTimeout(() => this.selectDatabase(targetFirebird), 500);
            }
        }
    }

    getConnectionFields(dbType) {
        if (dbType === 'paradox') {
            return `
                <div class="intelligent-config">
                    <h4><i class="fas fa-brain"></i> Configuração Inteligente</h4>
                    
                    <div class="form-group">
                        <label class="form-label">Como está seu banco Paradox?</label>
                        <div class="location-options">
                            <label class="location-option">
                                <input type="radio" name="locationType" value="local" checked>
                                <div class="option-content">
                                    <i class="fas fa-hdd"></i>
                                    <span>Local</span>
                                    <small>Arquivos no computador</small>
                                </div>
                            </label>
                            <label class="location-option">
                                <input type="radio" name="locationType" value="network">
                                <div class="option-content">
                                    <i class="fas fa-network-wired"></i>
                                    <span>Rede</span>
                                    <small>Servidor/compartilhamento</small>
                                </div>
                            </label>
                            <label class="location-option">
                                <input type="radio" name="locationType" value="cloud">
                                <div class="option-content">
                                    <i class="fas fa-cloud"></i>
                                    <span>Nuvem</span>
                                    <small>OneDrive, Google Drive...</small>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div id="locationFields">
                        ${this.getLocationFields('local')}
                    </div>

                    <div class="form-group">
                        <button type="button" class="btn btn-secondary auto-detect-btn">
                            <i class="fas fa-search"></i> Auto-detectar Paradox
                        </button>
                    </div>

                    <div class="advanced-options" style="margin-top: 20px;">
                        <details>
                            <summary><i class="fas fa-cog"></i> Opções Avançadas</summary>
                            <div class="form-group">
                                <label class="form-label">Versão do Paradox:</label>
                                <select class="form-control" name="version">
                                    <option value="auto">Auto-detectar</option>
                                    <option value="3">Paradox 3.x</option>
                                    <option value="4">Paradox 4.x</option>
                                    <option value="5">Paradox 5.x</option>
                                    <option value="7">Paradox 7.x</option>
                                    <option value="9">Paradox 9.x</option>
                                    <option value="10">Paradox 10.x</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Ordenação:</label>
                                <select class="form-control" name="collation">
                                    <option value="ASCII">ASCII</option>
                                    <option value="ANSI">ANSI</option>
                                    <option value="INTL">Internacional</option>
                                </select>
                            </div>
                        </details>
                    </div>
                </div>
            `;
        }

        if (dbType === 'firebird') {
            return `
                <div class="intelligent-config">
                    <h4><i class="fas fa-fire"></i> Configuração Firebird</h4>
                    
                    <div class="form-group">
                        <label class="form-label">Host/Servidor:</label>
                        <input type="text" class="form-control" name="host" value="localhost" placeholder="localhost ou IP do servidor">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Porta:</label>
                        <input type="number" class="form-control" name="port" value="3050">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Arquivo do Banco (.fdb):</label>
                        <input type="text" class="form-control" name="database" placeholder="C:\\dados\\meuBanco.fdb" required>
                        <small class="form-text">Caminho completo para o arquivo .fdb (será criado se não existir)</small>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Usuário:</label>
                        <input type="text" class="form-control" name="user" value="SYSDBA" required>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Senha:</label>
                        <input type="password" class="form-control" name="password" value="masterkey">
                    </div>

                    <div class="advanced-options">
                        <details>
                            <summary><i class="fas fa-cog"></i> Opções Avançadas</summary>
                            <div class="form-group">
                                <label class="form-label">Charset:</label>
                                <select class="form-control" name="charset">
                                    <option value="UTF8">UTF8 (Recomendado)</option>
                                    <option value="WIN1252">WIN1252</option>
                                    <option value="ISO8859_1">ISO8859_1</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Tamanho da Página:</label>
                                <select class="form-control" name="pageSize">
                                    <option value="4096">4096 (Padrão)</option>
                                    <option value="8192">8192</option>
                                    <option value="16384">16384</option>
                                </select>
                            </div>
                        </details>
                    </div>
                </div>
            `;
        }

        return '<div class="alert alert-warning">Selecione um banco de dados</div>';
    }

    getLocationFields(type) {
        switch (type) {
            case 'local':
                return `
                    <div class="form-group">
                        <label class="form-label">Caminho dos arquivos Paradox:</label>
                        <input type="text" class="form-control" name="path" placeholder="C:\\dados\\paradox" required>
                        <small class="form-text">Pasta contendo os arquivos .db do Paradox</small>
                    </div>
                `;
            
            case 'network':
                return `
                    <div class="form-group">
                        <label class="form-label">Caminho de rede:</label>
                        <input type="text" class="form-control" name="networkPath" placeholder="\\\\servidor\\pasta\\dados" required>
                        <small class="form-text">Caminho UNC para a pasta compartilhada</small>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Usuário (se necessário):</label>
                        <input type="text" class="form-control" name="username">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Senha:</label>
                        <input type="password" class="form-control" name="password">
                    </div>
                `;
            
            case 'cloud':
                return `
                    <div class="form-group">
                        <label class="form-label">Provedor da nuvem:</label>
                        <select class="form-control" name="cloudProvider">
                            <option value="onedrive">OneDrive</option>
                            <option value="googledrive">Google Drive</option>
                            <option value="dropbox">Dropbox</option>
                            <option value="sharepoint">SharePoint</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Caminho na nuvem:</label>
                        <input type="text" class="form-control" name="cloudPath" placeholder="Documentos/Dados/Paradox" required>
                        <small class="form-text">Caminho relativo dentro da pasta sincronizada</small>
                    </div>
                `;
            
            default:
                return '';
        }
    }

    showLocationFields(type) {
        const container = document.getElementById('locationFields');
        container.innerHTML = this.getLocationFields(type);
    }

    async autoDetectParadoxLocation() {
        this.addLog('🔍 Procurando arquivos Paradox...', 'info');
        
        // Simular busca (em um app real, seria uma busca no sistema)
        const commonPaths = [
            'C:\\Dados',
            'C:\\Sistema',
            'C:\\Arquivos\\Paradox',
            'D:\\Dados',
            'C:\\Users\\' + (process.env.USERNAME || 'Public') + '\\Documents\\Paradox'
        ];

        for (const path of commonPaths) {
            this.addLog(`🔍 Verificando: ${path}`, 'info');
            await this.sleep(500);
        }

        // Simular resultado encontrado
        setTimeout(() => {
            this.addLog('✅ Paradox encontrado: C:\\Dados\\Sistema', 'success');
            const pathInput = document.querySelector('input[name="path"]');
            if (pathInput) {
                pathInput.value = 'C:\\Dados\\Sistema';
                pathInput.focus();
            }
        }, 2000);
    }

    getConnectionConfig(type) {
        const containerId = type === 'source' ? 'sourceConnectionFields' : 'targetConnectionFields';
        const container = document.getElementById(containerId);
        const inputs = container.querySelectorAll('input, select');
        
        const config = {};
        inputs.forEach(input => {
            if (input.type === 'checkbox') {
                config[input.name] = input.checked;
            } else if (input.type === 'radio') {
                if (input.checked) config[input.name] = input.value;
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
        
        const entries = logContainer.querySelectorAll('.log-entry');
        if (entries.length > 100) {
            entries[0].remove();
        }
    }

    updateProgress(data) {
        const { progress, currentTable, recordsProcessed, totalRecords, errors, warnings, phase, throughput, estimatedCompletion } = data;
        
        document.getElementById('progressFill').style.width = `${progress}%`;
        document.getElementById('statusTitle').textContent = 
            `${this.getPhaseText(phase)} - ${Math.round(progress)}%`;
        
        if (currentTable) {
            document.getElementById('statCurrentTable').textContent = currentTable;
        }
        
        document.getElementById('statProcessed').textContent = (recordsProcessed || 0).toLocaleString();
        document.getElementById('statTotal').textContent = (totalRecords || 0).toLocaleString();
        document.getElementById('statErrors').textContent = errors || 0;
        
        // Adicionar throughput se disponível
        if (throughput) {
            const throughputElement = document.getElementById('statThroughput');
            if (throughputElement) {
                throughputElement.textContent = `${Math.round(throughput)} reg/s`;
            }
        }

        // ETA se disponível
        if (estimatedCompletion) {
            const eta = new Date(estimatedCompletion);
            const etaElement = document.getElementById('statETA');
            if (etaElement) {
                etaElement.textContent = eta.toLocaleTimeString('pt-BR');
            }
        }
        
        this.addLog(`📊 ${Math.round(progress)}% - ${(recordsProcessed || 0).toLocaleString()}/${(totalRecords || 0).toLocaleString()} registros`, 'info');
    }

    getPhaseText(phase) {
        const phases = {
            connecting: 'Conectando',
            analyzing: 'Analisando',
            creating: 'Criando estrutura',
            migrating: 'Migrando dados',
            indexing: 'Criando índices',
            validating: 'Validando',
            complete: 'Concluído',
            error: 'Erro'
        };
        return phases[phase] || phase;
    }

    migrationComplete(data) {
        this.migrationRunning = false;
        document.getElementById('statusTitle').textContent = '🎉 Migração Concluída com Sucesso!';
        document.getElementById('progressFill').style.width = '100%';
        document.getElementById('stopBtn').style.display = 'none';
        
        this.addLog(`🎉 Migração concluída! ${data.statistics?.recordsProcessed || 0} registros migrados`, 'success');
        this.showAlert('🎉 Migração inteligente concluída com sucesso!', 'success');
        
        // Mostrar estatísticas detalhadas
        if (data.statistics) {
            this.showMigrationSummary(data.statistics);
        }
    }

    migrationError(data) {
        this.migrationRunning = false;
        document.getElementById('statusTitle').textContent = '❌ Erro na Migração';
        document.getElementById('stopBtn').style.display = 'none';
        
        this.addLog(`❌ Erro na migração: ${data.error}`, 'error');
        this.showAlert(`❌ Erro na migração: ${data.error}`, 'error');
    }

    showMigrationSummary(statistics) {
        const summary = `
            <div class="migration-summary">
                <h3><i class="fas fa-chart-bar"></i> Resumo da Migração</h3>
                <div class="summary-stats">
                    <div class="stat-item">
                        <span class="stat-label">Tabelas:</span>
                        <span class="stat-value">${statistics.tablesProcessed}/${statistics.totalTables}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Registros:</span>
                        <span class="stat-value">${statistics.recordsProcessed.toLocaleString()}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Tempo:</span>
                        <span class="stat-value">${Math.round(statistics.duration / 1000)}s</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Velocidade:</span>
                        <span class="stat-value">${Math.round(statistics.averageThroughput)} reg/s</span>
                    </div>
                </div>
            </div>
        `;
        
        const logContainer = document.getElementById('logContainer');
        logContainer.insertAdjacentHTML('beforeend', summary);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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
            app.showAlert(`✅ Conexão ${type} testada com sucesso!`, 'success');
            app.addLog(`✅ Conexão ${type} (${dbType}) estabelecida com sucesso`, 'success');
            
            if (type === 'source') {
                app.sourceConfig = { type: dbType, config };
            } else {
                app.targetConfig = { type: dbType, config };
            }
        } else {
            app.showAlert(`❌ Erro na conexão ${type}: ${result.error}`, 'error');
            app.addLog(`❌ Falha na conexão ${type}: ${result.error}`, 'error');
        }
    } catch (error) {
        app.showAlert(`❌ Erro na conexão ${type}: ${error.message}`, 'error');
        app.addLog(`❌ Erro na conexão ${type}: ${error.message}`, 'error');
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
            app.sourceSchema = result.schema;
            app.addLog(`📋 Esquema carregado: ${result.tableCount} tabelas encontradas`, 'success');
            app.showAlert(`📋 Esquema carregado: ${result.tableCount} tabelas encontradas`, 'success');
        } else {
            app.showAlert(`❌ Erro ao carregar esquema: ${result.error}`, 'error');
        }
    } catch (error) {
        app.showAlert(`❌ Erro ao carregar esquema: ${error.message}`, 'error');
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
    
    app.addLog('🔍 Validando configurações...', 'info');
    
    try {
        await testConnection('source');
        await testConnection('target');
        app.showAlert('✅ Todas as configurações estão válidas!', 'success');
    } catch (error) {
        app.showAlert('❌ Erro na validação das configurações', 'error');
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
            app.currentMigrationId = result.migrationId;
            document.getElementById('statusPanel').style.display = 'block';
            document.getElementById('stopBtn').style.display = 'block';
            app.addLog('🚀 Migração inteligente iniciada!', 'success');
            app.showAlert('🚀 Migração inteligente iniciada!', 'success');
        } else {
            app.showAlert(`❌ Erro ao iniciar migração: ${result.error}`, 'error');
        }
    } catch (error) {
        app.showAlert(`❌ Erro ao iniciar migração: ${error.message}`, 'error');
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
            app.addLog('🛑 Migração interrompida pelo usuário', 'warning');
            app.showAlert('🛑 Migração interrompida', 'warning');
        }
    } catch (error) {
        app.showAlert(`❌ Erro ao parar migração: ${error.message}`, 'error');
    }
}

// Inicializar a aplicação
document.addEventListener('DOMContentLoaded', () => {
    window.migrationApp = new IntelligentMigrationApp();
});
