const { Pool } = require('pg');
require('dotenv').config();

// Configuração simplificada para produção
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
});

// Teste de conexão simplificado
const testConnection = async () => {
  let client;
  try {
    console.log('🔄 Testando conexão com Neon PostgreSQL...');
    client = await pool.connect();
    const result = await client.query('SELECT 1 as test');
    console.log('✅ Conexão estabelecida!', result.rows[0]);
    return true;
  } catch (error) {
    console.error('❌ Erro de conexão:', error.message);
    console.error('🔍 DATABASE_URL:', process.env.DATABASE_URL ? 'Configurada' : 'Não configurada');
    return false;
  } finally {
    if (client) client.release();
  }
};

const query = async (text, params) => {
  return await pool.query(text, params);
};

module.exports = { pool, query, testConnection };