const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Função para executar queries
const query = (text, params) => pool.query(text, params);

// Função para inicializar as tabelas
const initializeTables = async () => {
  try {
    // Criar tabela usuarios
    await query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        liberado BOOLEAN DEFAULT FALSE,
        data_criacao TIMESTAMP DEFAULT NOW()
      )
    `);

    // Criar tabela nodes
    await query(`
      CREATE TABLE IF NOT EXISTS nodes (
        id SERIAL PRIMARY KEY,
        estado TEXT NOT NULL,
        cidade TEXT NOT NULL,
        nodes TEXT NOT NULL,
        status TEXT DEFAULT 'Disponível',
        ativo BOOLEAN DEFAULT TRUE,
        observacao TEXT,
        usuario TEXT,
        data_inicio TIMESTAMP,
        data_conclusao TIMESTAMP,
        data_criacao TIMESTAMP DEFAULT NOW()
      )
    `);

    // Criar tabela logs para auditoria
    await query(`
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        usuario TEXT,
        acao TEXT,
        detalhes TEXT,
        timestamp TIMESTAMP DEFAULT NOW()
      )
    `);

    // Criar índices para performance
    await query(`
      CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_nodes_usuario ON nodes(usuario);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_nodes_ativo ON nodes(ativo);
    `);

    console.log('✅ Tabelas criadas/verificadas com sucesso');
  } catch (err) {
    console.error('❌ Erro ao criar tabelas:', err);
    throw err;
  }
};

// Testar conexão
const testConnection = async () => {
  try {
    const result = await query('SELECT NOW()');
    console.log('✅ Conexão com PostgreSQL estabelecida:', result.rows[0].now);
    return true;
  } catch (err) {
    console.error('❌ Erro na conexão:', err.message);
    return false;
  }
};

module.exports = {
  query,
  initializeTables,
  testConnection,
  pool
};