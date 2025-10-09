const { Pool } = require('pg');
require('dotenv').config();

// Configuração da conexão com o banco PostgreSQL (Neon)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  // Configurações de performance
  max: 20, // máximo de conexões no pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Função para testar a conexão
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Conexão com PostgreSQL (Neon) estabelecida com sucesso!');
    const result = await client.query('SELECT NOW()');
    console.log('🕐 Horário do servidor:', result.rows[0].now);
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Erro ao conectar com o banco de dados:', error.message);
    return false;
  }
};

// Função para executar queries com retry
const query = async (text, params) => {
  const maxRetries = 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      const start = Date.now();
      const result = await pool.query(text, params);
      const duration = Date.now() - start;
      
      // Log da query apenas em desenvolvimento
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Query executada:', {
          query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
          duration: `${duration}ms`,
          rows: result.rowCount
        });
      }
      
      return result;
    } catch (error) {
      attempt++;
      console.error(`❌ Erro na query (tentativa ${attempt}/${maxRetries}):`, error.message);
      
      if (attempt >= maxRetries) {
        throw error;
      }
      
      // Aguarda antes de tentar novamente
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
};

// Função para executar transações
const transaction = async (callback) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Função para finalizar conexões (graceful shutdown)
const closeConnection = async () => {
  try {
    await pool.end();
    console.log('✅ Conexões com banco de dados fechadas com sucesso');
  } catch (error) {
    console.error('❌ Erro ao fechar conexões:', error.message);
  }
};

module.exports = {
  pool,
  query,
  transaction,
  testConnection,
  closeConnection
};