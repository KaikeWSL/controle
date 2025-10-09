const { query, testConnection, closeConnection } = require('./connection');

/**
 * Migrações essenciais apenas para produção
 */
const essentialMigrations = [
  {
    name: 'Criar tabela usuarios',
    sql: `
      CREATE TABLE IF NOT EXISTS usuarios (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        liberado BOOLEAN DEFAULT TRUE,
        data_criacao TIMESTAMP DEFAULT NOW(),
        ultimo_acesso TIMESTAMP,
        ativo BOOLEAN DEFAULT TRUE
      );
    `
  },
  {
    name: 'Adicionar coluna ativo se não existir',
    sql: `
      ALTER TABLE usuarios 
      ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE;
    `
  },
  {
    name: 'Criar tabela nodes',
    sql: `
      CREATE TABLE IF NOT EXISTS nodes (
        id SERIAL PRIMARY KEY,
        estado TEXT NOT NULL,
        cidade TEXT NOT NULL,
        nodes TEXT NOT NULL,
        status TEXT DEFAULT 'Disponível'
          CHECK (status IN ('Disponível', 'Em Execução', 'Concluído')),
        ativo BOOLEAN DEFAULT TRUE,
        observacao TEXT,
        usuario TEXT,
        usuario_id TEXT,
        data_criacao TIMESTAMP DEFAULT NOW(),
        data_inicio TIMESTAMP,
        data_conclusao TIMESTAMP,
        tempo_execucao INTEGER,
        
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
      );
    `
  },
  {
    name: 'Criar tabela logs',
    sql: `
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        usuario TEXT,
        usuario_id TEXT,
        acao TEXT NOT NULL,
        detalhes TEXT,
        ip_address TEXT,
        user_agent TEXT,
        timestamp TIMESTAMP DEFAULT NOW()
      );
    `
  }
];

const runEssentialMigrations = async () => {
  console.log('🚀 Executando migrações essenciais...\n');
  
  try {
    for (let i = 0; i < essentialMigrations.length; i++) {
      const migration = essentialMigrations[i];
      console.log(`${i + 1}/${essentialMigrations.length} - ${migration.name}...`);
      
      try {
        await query(migration.sql);
        console.log(`✅ ${migration.name} - OK\n`);
      } catch (error) {
        console.error(`❌ ${migration.name} - Erro:`, error.message);
        throw error;
      }
    }
    
    console.log('✅ Migrações essenciais concluídas!\n');
    return true;
    
  } catch (error) {
    console.error('💥 Erro durante migrações essenciais:', error.message);
    return false;
  }
};

module.exports = {
  runEssentialMigrations,
  essentialMigrations
};