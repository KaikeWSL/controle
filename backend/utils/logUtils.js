const db = require('../config/database');

class LogUtils {
    /**
     * Registra uma ação no sistema de logs
     * @param {number} userId - ID do usuário
     * @param {number|null} nodeId - ID do node (opcional)
     * @param {string} action - Ação realizada
     * @param {string|null} details - Detalhes adicionais (opcional)
     * @param {string|null} ipAddress - Endereço IP (opcional)
     * @returns {Promise<Object>} Resultado da operação
     */
    static async logAction(userId, nodeId, action, details = null, ipAddress = null) {
        try {
            const query = `
                INSERT INTO logs (user_id, node_id, action, details, ip_address, created_at)
                VALUES ($1, $2, $3, $4, $5, NOW())
                RETURNING id, created_at
            `;
            
            const values = [userId, nodeId, action, details, ipAddress];
            const result = await db.query(query, values);
            
            return {
                success: true,
                logId: result.rows[0].id,
                timestamp: result.rows[0].created_at
            };
            
        } catch (error) {
            console.error('Erro ao registrar log:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Busca logs com filtros opcionais
     * @param {Object} filters - Filtros para busca
     * @param {number} page - Página atual
     * @param {number} limit - Limite de registros por página
     * @returns {Promise<Object>} Logs encontrados
     */
    static async getLogs(filters = {}, page = 1, limit = 50) {
        try {
            const offset = (page - 1) * limit;
            let whereConditions = [];
            let values = [];
            let valueIndex = 1;
            
            // Construir condições WHERE dinamicamente
            if (filters.userId) {
                whereConditions.push(`l.user_id = $${valueIndex++}`);
                values.push(filters.userId);
            }
            
            if (filters.nodeId) {
                whereConditions.push(`l.node_id = $${valueIndex++}`);
                values.push(filters.nodeId);
            }
            
            if (filters.action) {
                whereConditions.push(`l.action = $${valueIndex++}`);
                values.push(filters.action);
            }
            
            if (filters.startDate) {
                whereConditions.push(`l.created_at >= $${valueIndex++}`);
                values.push(filters.startDate);
            }
            
            if (filters.endDate) {
                whereConditions.push(`l.created_at <= $${valueIndex++}`);
                values.push(filters.endDate);
            }
            
            if (filters.ipAddress) {
                whereConditions.push(`l.ip_address = $${valueIndex++}`);
                values.push(filters.ipAddress);
            }
            
            const whereClause = whereConditions.length > 0 
                ? `WHERE ${whereConditions.join(' AND ')}`
                : '';
            
            // Query principal
            const query = `
                SELECT 
                    l.id,
                    l.user_id,
                    l.node_id,
                    l.action,
                    l.details,
                    l.ip_address,
                    l.created_at,
                    u.name as user_name,
                    u.email as user_email,
                    n.name as node_name
                FROM logs l
                LEFT JOIN users u ON l.user_id = u.id
                LEFT JOIN nodes n ON l.node_id = n.id
                ${whereClause}
                ORDER BY l.created_at DESC
                LIMIT $${valueIndex++} OFFSET $${valueIndex++}
            `;
            
            values.push(limit, offset);
            
            // Query para contar total
            const countQuery = `
                SELECT COUNT(*) as total
                FROM logs l
                LEFT JOIN users u ON l.user_id = u.id
                LEFT JOIN nodes n ON l.node_id = n.id
                ${whereClause}
            `;
            
            const countValues = values.slice(0, -2); // Remove limit e offset
            
            const [logsResult, countResult] = await Promise.all([
                db.query(query, values),
                db.query(countQuery, countValues)
            ]);
            
            const totalRecords = parseInt(countResult.rows[0].total);
            const totalPages = Math.ceil(totalRecords / limit);
            
            return {
                success: true,
                data: logsResult.rows,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalRecords,
                    recordsPerPage: limit,
                    hasNextPage: page < totalPages,
                    hasPreviousPage: page > 1
                }
            };
            
        } catch (error) {
            console.error('Erro ao buscar logs:', error);
            return {
                success: false,
                error: error.message,
                data: []
            };
        }
    }
    
    /**
     * Busca estatísticas de atividade
     * @param {Object} filters - Filtros para estatísticas
     * @returns {Promise<Object>} Estatísticas de atividade
     */
    static async getActivityStats(filters = {}) {
        try {
            let whereConditions = [];
            let values = [];
            let valueIndex = 1;
            
            if (filters.startDate) {
                whereConditions.push(`created_at >= $${valueIndex++}`);
                values.push(filters.startDate);
            }
            
            if (filters.endDate) {
                whereConditions.push(`created_at <= $${valueIndex++}`);
                values.push(filters.endDate);
            }
            
            const whereClause = whereConditions.length > 0 
                ? `WHERE ${whereConditions.join(' AND ')}`
                : '';
            
            // Estatísticas por ação
            const actionStatsQuery = `
                SELECT 
                    action,
                    COUNT(*) as count
                FROM logs
                ${whereClause}
                GROUP BY action
                ORDER BY count DESC
            `;
            
            // Atividade por dia
            const dailyActivityQuery = `
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as count
                FROM logs
                ${whereClause}
                GROUP BY DATE(created_at)
                ORDER BY date DESC
                LIMIT 30
            `;
            
            // Usuários mais ativos
            const topUsersQuery = `
                SELECT 
                    u.name,
                    u.email,
                    COUNT(l.id) as activity_count
                FROM logs l
                JOIN users u ON l.user_id = u.id
                ${whereClause}
                GROUP BY u.id, u.name, u.email
                ORDER BY activity_count DESC
                LIMIT 10
            `;
            
            const [actionStats, dailyActivity, topUsers] = await Promise.all([
                db.query(actionStatsQuery, values),
                db.query(dailyActivityQuery, values),
                db.query(topUsersQuery, values)
            ]);
            
            return {
                success: true,
                data: {
                    actionStats: actionStats.rows,
                    dailyActivity: dailyActivity.rows,
                    topUsers: topUsers.rows
                }
            };
            
        } catch (error) {
            console.error('Erro ao buscar estatísticas:', error);
            return {
                success: false,
                error: error.message,
                data: {}
            };
        }
    }
    
    /**
     * Limpa logs antigos (para manutenção)
     * @param {number} daysToKeep - Dias para manter os logs
     * @returns {Promise<Object>} Resultado da limpeza
     */
    static async cleanOldLogs(daysToKeep = 90) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
            
            const query = `
                DELETE FROM logs 
                WHERE created_at < $1
                RETURNING COUNT(*) as deleted_count
            `;
            
            const result = await db.query(query, [cutoffDate]);
            
            return {
                success: true,
                deletedCount: result.rowCount,
                cutoffDate
            };
            
        } catch (error) {
            console.error('Erro ao limpar logs antigos:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Registra tentativa de login
     * @param {string} email - Email do usuário
     * @param {string} hardwareId - Hardware ID
     * @param {boolean} success - Se o login foi bem-sucedido
     * @param {string} ipAddress - Endereço IP
     * @returns {Promise<Object>} Resultado da operação
     */
    static async logLoginAttempt(email, hardwareId, success, ipAddress) {
        try {
            const query = `
                INSERT INTO login_attempts (email, hardware_id, success, ip_address, created_at)
                VALUES ($1, $2, $3, $4, NOW())
                RETURNING id
            `;
            
            const values = [email, hardwareId, success, ipAddress];
            const result = await db.query(query, values);
            
            return {
                success: true,
                attemptId: result.rows[0].id
            };
            
        } catch (error) {
            console.error('Erro ao registrar tentativa de login:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Verifica tentativas de login suspeitas
     * @param {string} ipAddress - Endereço IP
     * @param {number} windowMinutes - Janela de tempo em minutos
     * @param {number} maxAttempts - Máximo de tentativas permitidas
     * @returns {Promise<Object>} Resultado da verificação
     */
    static async checkSuspiciousActivity(ipAddress, windowMinutes = 15, maxAttempts = 5) {
        try {
            const windowStart = new Date();
            windowStart.setMinutes(windowStart.getMinutes() - windowMinutes);
            
            const query = `
                SELECT COUNT(*) as attempts
                FROM login_attempts
                WHERE ip_address = $1 
                AND success = false 
                AND created_at >= $2
            `;
            
            const result = await db.query(query, [ipAddress, windowStart]);
            const attempts = parseInt(result.rows[0].attempts);
            
            return {
                success: true,
                isSuspicious: attempts >= maxAttempts,
                attemptCount: attempts,
                maxAttempts,
                windowMinutes
            };
            
        } catch (error) {
            console.error('Erro ao verificar atividade suspeita:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Formata ação para exibição
     * @param {string} action - Ação a ser formatada
     * @returns {string} Ação formatada
     */
    static formatAction(action) {
        const actionMap = {
            'login': 'Login realizado',
            'logout': 'Logout realizado',
            'register': 'Usuário registrado',
            'claim': 'Node reivindicado',
            'complete': 'Node concluído',
            'create_node': 'Node criado',
            'update_node': 'Node atualizado',
            'delete_node': 'Node deletado',
            'upload': 'Arquivo enviado',
            'download': 'Arquivo baixado',
            'admin_access': 'Acesso ao painel admin',
            'user_updated': 'Usuário atualizado',
            'user_deleted': 'Usuário deletado'
        };
        
        return actionMap[action] || action;
    }
}

module.exports = LogUtils;