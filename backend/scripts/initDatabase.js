const db = require('../config/database');
const bcrypt = require('bcryptjs');

class DatabaseInit {
    /**
     * Inicializa o banco de dados criando todas as tabelas necessárias
     */
    static async initializeDatabase() {
        try {
            console.log('🔄 Iniciando configuração do banco de dados...');
            
            // Criar tabelas
            await this.createTables();
            
            // Criar usuário admin padrão
            await this.createDefaultAdmin();
            
            // Criar alguns nodes de exemplo
            await this.createSampleNodes();
            
            console.log('✅ Banco de dados configurado com sucesso!');
            
        } catch (error) {
            console.error('❌ Erro ao configurar banco de dados:', error);
            throw error;
        }
    }
    
    /**
     * Cria todas as tabelas necessárias
     */
    static async createTables() {
        console.log('📋 Criando tabelas...');
        
        // Tabela de usuários
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                hardware_id VARCHAR(255) UNIQUE NOT NULL,
                user_type VARCHAR(20) DEFAULT 'user' CHECK (user_type IN ('user', 'admin')),
                last_login TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Tabela de nodes
        await db.query(`
            CREATE TABLE IF NOT EXISTS nodes (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                reward DECIMAL(10,2) NOT NULL,
                max_users INTEGER NOT NULL DEFAULT 1,
                current_users INTEGER DEFAULT 0,
                status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'claimed', 'completed', 'inactive')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Tabela de relacionamento usuário-node (claims)
        await db.query(`
            CREATE TABLE IF NOT EXISTS user_nodes (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                node_id INTEGER REFERENCES nodes(id) ON DELETE CASCADE,
                claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                status VARCHAR(20) DEFAULT 'claimed' CHECK (status IN ('claimed', 'completed')),
                UNIQUE(user_id, node_id)
            )
        `);
        
        // Tabela de logs
        await db.query(`
            CREATE TABLE IF NOT EXISTS logs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                node_id INTEGER REFERENCES nodes(id) ON DELETE SET NULL,
                action VARCHAR(50) NOT NULL,
                details TEXT,
                ip_address INET,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Tabela de tentativas de login
        await db.query(`
            CREATE TABLE IF NOT EXISTS login_attempts (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255),
                hardware_id VARCHAR(255),
                success BOOLEAN NOT NULL,
                ip_address INET,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Criar índices para melhor performance
        await this.createIndexes();
        
        // Criar triggers para atualizar updated_at
        await this.createTriggers();
        
        console.log('✅ Tabelas criadas com sucesso!');
    }
    
    /**
     * Cria índices para melhor performance
     */
    static async createIndexes() {
        console.log('📊 Criando índices...');
        
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
            'CREATE INDEX IF NOT EXISTS idx_users_hardware_id ON users(hardware_id)',
            'CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status)',
            'CREATE INDEX IF NOT EXISTS idx_user_nodes_user_id ON user_nodes(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_user_nodes_node_id ON user_nodes(node_id)',
            'CREATE INDEX IF NOT EXISTS idx_user_nodes_status ON user_nodes(status)',
            'CREATE INDEX IF NOT EXISTS idx_logs_user_id ON logs(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_logs_action ON logs(action)',
            'CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at)',
            'CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address)',
            'CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON login_attempts(created_at)'
        ];
        
        for (const indexQuery of indexes) {
            await db.query(indexQuery);
        }
        
        console.log('✅ Índices criados com sucesso!');
    }
    
    /**
     * Cria triggers para atualizar updated_at automaticamente
     */
    static async createTriggers() {
        console.log('⚡ Criando triggers...');
        
        // Função para atualizar updated_at
        await db.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql'
        `);
        
        // Triggers para cada tabela
        const triggers = [
            'CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
            'CREATE TRIGGER update_nodes_updated_at BEFORE UPDATE ON nodes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()'
        ];
        
        for (const triggerQuery of triggers) {
            await db.query(`DROP TRIGGER IF EXISTS ${triggerQuery.split(' ')[2]} ON ${triggerQuery.split(' ')[6]}`);
            await db.query(triggerQuery);
        }
        
        console.log('✅ Triggers criados com sucesso!');
    }
    
    /**
     * Cria usuário administrador padrão
     */
    static async createDefaultAdmin() {
        console.log('👤 Criando usuário administrador padrão...');
        
        try {
            // Verificar se já existe um admin
            const existingAdmin = await db.query(
                "SELECT id FROM users WHERE user_type = 'admin' LIMIT 1"
            );
            
            if (existingAdmin.rows.length > 0) {
                console.log('ℹ️  Usuário administrador já existe!');
                return;
            }
            
            // Criar hash da senha padrão
            const defaultPassword = 'admin123';
            const hashedPassword = await bcrypt.hash(defaultPassword, 12);
            
            // Hardware ID padrão para admin
            const adminHardwareId = 'admin-default-hardware-id-12345';
            
            // Inserir admin padrão
            await db.query(`
                INSERT INTO users (name, email, password, hardware_id, user_type)
                VALUES ($1, $2, $3, $4, $5)
            `, [
                'Administrador',
                'admin@sistema.com',
                hashedPassword,
                adminHardwareId,
                'admin'
            ]);
            
            console.log('✅ Usuário administrador criado com sucesso!');
            console.log('📧 Email: admin@sistema.com');
            console.log('🔑 Senha: admin123');
            console.log('⚠️  IMPORTANTE: Altere a senha padrão após o primeiro login!');
            
        } catch (error) {
            if (error.code === '23505') { // Unique violation
                console.log('ℹ️  Usuário administrador já existe!');
            } else {
                throw error;
            }
        }
    }
    
    /**
     * Cria alguns nodes de exemplo
     */
    static async createSampleNodes() {
        console.log('🎯 Criando nodes de exemplo...');
        
        try {
            // Verificar se já existem nodes
            const existingNodes = await db.query('SELECT COUNT(*) FROM nodes');
            const nodeCount = parseInt(existingNodes.rows[0].count);
            
            if (nodeCount > 0) {
                console.log('ℹ️  Nodes já existem no sistema!');
                return;
            }
            
            const sampleNodes = [
                {
                    name: 'Node Mineração Bitcoin',
                    description: 'Node para mineração de Bitcoin com alta performance. Requer hardware dedicado e conhecimento técnico em blockchain.',
                    reward: 50.00,
                    max_users: 2
                },
                {
                    name: 'Node Validação Ethereum',
                    description: 'Node para validação de transações na rede Ethereum. Processo automatizado com recompensas diárias.',
                    reward: 35.00,
                    max_users: 3
                },
                {
                    name: 'Node Rede Lightning',
                    description: 'Node para facilitar transações rápidas de Bitcoin através da Lightning Network. Baixo risco e boa rentabilidade.',
                    reward: 25.00,
                    max_users: 5
                },
                {
                    name: 'Node Staking Cardano',
                    description: 'Node para staking de tokens ADA na rede Cardano. Processo passivo com recompensas regulares.',
                    reward: 40.00,
                    max_users: 4
                },
                {
                    name: 'Node Masternode Dash',
                    description: 'Masternode da rede Dash para processamento de transações privadas. Requer investimento inicial significativo.',
                    reward: 60.00,
                    max_users: 1
                }
            ];
            
            for (const node of sampleNodes) {
                await db.query(`
                    INSERT INTO nodes (name, description, reward, max_users)
                    VALUES ($1, $2, $3, $4)
                `, [node.name, node.description, node.reward, node.max_users]);
            }
            
            console.log(`✅ ${sampleNodes.length} nodes de exemplo criados com sucesso!`);
            
        } catch (error) {
            console.error('Erro ao criar nodes de exemplo:', error);
        }
    }
    
    /**
     * Verifica a conexão com o banco de dados
     */
    static async checkConnection() {
        try {
            const result = await db.query('SELECT NOW() as current_time');
            console.log('✅ Conexão com banco de dados OK:', result.rows[0].current_time);
            return true;
        } catch (error) {
            console.error('❌ Erro na conexão com banco de dados:', error.message);
            return false;
        }
    }
    
    /**
     * Limpa todas as tabelas (CUIDADO!)
     */
    static async resetDatabase() {
        console.log('⚠️  ATENÇÃO: Limpando banco de dados...');
        
        const tables = [
            'login_attempts',
            'logs',
            'user_nodes',
            'nodes',
            'users'
        ];
        
        for (const table of tables) {
            await db.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        }
        
        console.log('🗑️  Tabelas removidas. Recriando...');
        await this.initializeDatabase();
    }
    
    /**
     * Executa backup básico das tabelas principais
     */
    static async createBackup() {
        try {
            console.log('💾 Criando backup dos dados...');
            
            const tables = ['users', 'nodes', 'user_nodes'];
            const backup = {};
            
            for (const table of tables) {
                const result = await db.query(`SELECT * FROM ${table}`);
                backup[table] = result.rows;
            }
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupData = {
                timestamp,
                tables: backup
            };
            
            // Em um ambiente real, você salvaria isso em um arquivo
            console.log(`✅ Backup criado com timestamp: ${timestamp}`);
            return backupData;
            
        } catch (error) {
            console.error('❌ Erro ao criar backup:', error);
            throw error;
        }
    }
}

// Se executado diretamente
if (require.main === module) {
    DatabaseInit.checkConnection()
        .then((connected) => {
            if (connected) {
                return DatabaseInit.initializeDatabase();
            } else {
                throw new Error('Não foi possível conectar ao banco de dados');
            }
        })
        .then(() => {
            console.log('🎉 Configuração do banco concluída!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Erro na configuração:', error);
            process.exit(1);
        });
}

module.exports = DatabaseInit;