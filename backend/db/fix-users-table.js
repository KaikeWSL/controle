const { query } = require('./connection');

/**
 * Script para corrigir schema da tabela usuarios em produção
 */
const fixUsersTable = async () => {
  try {
    console.log('🔧 Corrigindo schema da tabela usuarios...');
    
    // Primeiro, verificar se a tabela existe
    const tableExists = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'usuarios'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('📋 Criando tabela usuarios...');
      await query(`
        CREATE TABLE usuarios (
          id TEXT PRIMARY KEY,
          nome TEXT NOT NULL,
          liberado BOOLEAN DEFAULT TRUE,
          data_criacao TIMESTAMP DEFAULT NOW(),
          ultimo_acesso TIMESTAMP,
          ativo BOOLEAN DEFAULT TRUE
        );
      `);
      console.log('✅ Tabela usuarios criada!');
    } else {
      console.log('📋 Tabela usuarios existe, verificando colunas...');
      
      // Verificar e adicionar coluna 'ativo' se não existir
      const ativoExists = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'usuarios' AND column_name = 'ativo'
        );
      `);
      
      if (!ativoExists.rows[0].exists) {
        console.log('➕ Adicionando coluna ativo...');
        await query(`
          ALTER TABLE usuarios 
          ADD COLUMN ativo BOOLEAN DEFAULT TRUE;
        `);
        console.log('✅ Coluna ativo adicionada!');
      } else {
        console.log('✅ Coluna ativo já existe!');
      }
      
      // Verificar e adicionar coluna 'liberado' se não existir
      const liberadoExists = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'usuarios' AND column_name = 'liberado'
        );
      `);
      
      if (!liberadoExists.rows[0].exists) {
        console.log('➕ Adicionando coluna liberado...');
        await query(`
          ALTER TABLE usuarios 
          ADD COLUMN liberado BOOLEAN DEFAULT TRUE;
        `);
        console.log('✅ Coluna liberado adicionada!');
      } else {
        console.log('✅ Coluna liberado já existe!');
      }
    }
    
    // Verificar schema final
    const columns = await query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'usuarios'
      ORDER BY ordinal_position;
    `);
    
    console.log('📊 Schema final da tabela usuarios:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}${col.column_default ? ` (default: ${col.column_default})` : ''}`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ Erro ao corrigir tabela usuarios:', error.message);
    return false;
  }
};

module.exports = { fixUsersTable };