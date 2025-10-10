const XLSX = require('xlsx');

class ExcelUtils {
    /**
     * Processa arquivo Excel e extrai dados de nodes
     * @param {Buffer} fileBuffer - Buffer do arquivo Excel
     * @returns {Array} Array de objetos com dados dos nodes
     */
    static processNodesFile(fileBuffer) {
        try {
            const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            // Converte para JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            
            // Valida e processa os dados
            const processedNodes = [];
            
            for (let i = 0; i < jsonData.length; i++) {
                const row = jsonData[i];
                
                // Campos esperados no Excel: name, description, reward, max_users
                const node = {
                    name: this.validateString(row.name || row.Name || row.NOME, `Linha ${i + 2}: Nome`),
                    description: this.validateString(row.description || row.Description || row.DESCRICAO, `Linha ${i + 2}: Descrição`),
                    reward: this.validateNumber(row.reward || row.Reward || row.RECOMPENSA, `Linha ${i + 2}: Recompensa`),
                    max_users: this.validateNumber(row.max_users || row.MaxUsers || row.MAX_USUARIOS, `Linha ${i + 2}: Máximo de Usuários`),
                    status: 'available'
                };
                
                processedNodes.push(node);
            }
            
            return {
                success: true,
                data: processedNodes,
                total: processedNodes.length
            };
            
        } catch (error) {
            return {
                success: false,
                error: `Erro ao processar arquivo Excel: ${error.message}`,
                data: []
            };
        }
    }
    
    /**
     * Valida campo string
     * @param {any} value - Valor a ser validado
     * @param {string} fieldName - Nome do campo para erro
     * @returns {string} String validada
     */
    static validateString(value, fieldName) {
        if (!value || typeof value !== 'string' || value.trim() === '') {
            throw new Error(`${fieldName} é obrigatório e deve ser uma string válida`);
        }
        return value.trim();
    }
    
    /**
     * Valida campo numérico
     * @param {any} value - Valor a ser validado
     * @param {string} fieldName - Nome do campo para erro
     * @returns {number} Número validado
     */
    static validateNumber(value, fieldName) {
        const num = Number(value);
        if (isNaN(num) || num <= 0) {
            throw new Error(`${fieldName} deve ser um número positivo`);
        }
        return num;
    }
    
    /**
     * Gera arquivo Excel com dados dos nodes
     * @param {Array} nodes - Array de nodes
     * @param {Array} users - Array de usuários (opcional)
     * @returns {Buffer} Buffer do arquivo Excel
     */
    static generateNodesReport(nodes, users = []) {
        try {
            const workbook = XLSX.utils.book_new();
            
            // Aba dos Nodes
            const nodesData = nodes.map(node => ({
                'ID': node.id,
                'Nome': node.name,
                'Descrição': node.description,
                'Recompensa': node.reward,
                'Máx. Usuários': node.max_users,
                'Status': this.translateStatus(node.status),
                'Criado em': this.formatDate(node.created_at),
                'Atualizado em': this.formatDate(node.updated_at)
            }));
            
            const nodesSheet = XLSX.utils.json_to_sheet(nodesData);
            XLSX.utils.book_append_sheet(workbook, nodesSheet, 'Nodes');
            
            // Aba dos Usuários (se fornecida)
            if (users.length > 0) {
                const usersData = users.map(user => ({
                    'ID': user.id,
                    'Nome': user.name,
                    'Email': user.email,
                    'Tipo': user.user_type === 'admin' ? 'Administrador' : 'Usuário',
                    'Hardware ID': user.hardware_id,
                    'Criado em': this.formatDate(user.created_at),
                    'Último Login': user.last_login ? this.formatDate(user.last_login) : 'Nunca'
                }));
                
                const usersSheet = XLSX.utils.json_to_sheet(usersData);
                XLSX.utils.book_append_sheet(workbook, usersSheet, 'Usuários');
            }
            
            // Gera o buffer
            const buffer = XLSX.write(workbook, { 
                type: 'buffer', 
                bookType: 'xlsx' 
            });
            
            return buffer;
            
        } catch (error) {
            throw new Error(`Erro ao gerar relatório Excel: ${error.message}`);
        }
    }
    
    /**
     * Gera relatório de logs
     * @param {Array} logs - Array de logs
     * @returns {Buffer} Buffer do arquivo Excel
     */
    static generateLogsReport(logs) {
        try {
            const workbook = XLSX.utils.book_new();
            
            const logsData = logs.map(log => ({
                'ID': log.id,
                'Usuário': log.user_name,
                'Node': log.node_name,
                'Ação': this.translateAction(log.action),
                'Data/Hora': this.formatDateTime(log.created_at),
                'Detalhes': log.details || ''
            }));
            
            const logsSheet = XLSX.utils.json_to_sheet(logsData);
            XLSX.utils.book_append_sheet(workbook, logsSheet, 'Logs de Atividade');
            
            const buffer = XLSX.write(workbook, { 
                type: 'buffer', 
                bookType: 'xlsx' 
            });
            
            return buffer;
            
        } catch (error) {
            throw new Error(`Erro ao gerar relatório de logs: ${error.message}`);
        }
    }
    
    /**
     * Traduz status para português
     * @param {string} status - Status em inglês
     * @returns {string} Status em português
     */
    static translateStatus(status) {
        const translations = {
            'available': 'Disponível',
            'claimed': 'Em Execução',
            'completed': 'Concluído',
            'inactive': 'Inativo'
        };
        return translations[status] || status;
    }
    
    /**
     * Traduz ação para português
     * @param {string} action - Ação em inglês
     * @returns {string} Ação em português
     */
    static translateAction(action) {
        const translations = {
            'claim': 'Reivindicar Node',
            'complete': 'Concluir Node',
            'upload': 'Upload de Arquivo',
            'login': 'Login',
            'register': 'Registro',
            'create_node': 'Criar Node',
            'update_node': 'Atualizar Node',
            'delete_node': 'Deletar Node'
        };
        return translations[action] || action;
    }
    
    /**
     * Formata data para exibição
     * @param {string|Date} date - Data a ser formatada
     * @returns {string} Data formatada
     */
    static formatDate(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleDateString('pt-BR');
    }
    
    /**
     * Formata data e hora para exibição
     * @param {string|Date} date - Data a ser formatada
     * @returns {string} Data e hora formatadas
     */
    static formatDateTime(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleString('pt-BR');
    }
    
    /**
     * Valida estrutura do arquivo Excel
     * @param {Object} worksheet - Planilha do Excel
     * @returns {Object} Resultado da validação
     */
    static validateExcelStructure(worksheet) {
        const requiredColumns = ['name', 'description', 'reward', 'max_users'];
        const headerRow = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0];
        
        if (!headerRow || headerRow.length === 0) {
            return {
                valid: false,
                error: 'Arquivo Excel vazio ou sem cabeçalhos'
            };
        }
        
        const missingColumns = requiredColumns.filter(col => {
            return !headerRow.some(header => 
                header && header.toString().toLowerCase().includes(col.toLowerCase())
            );
        });
        
        if (missingColumns.length > 0) {
            return {
                valid: false,
                error: `Colunas obrigatórias ausentes: ${missingColumns.join(', ')}`
            };
        }
        
        return { valid: true };
    }
}

module.exports = ExcelUtils;