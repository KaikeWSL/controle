const { query, testConnection, closeConnection } = require('./connection');

/**
 * Script de migração para criar todas as tabelas do sistema
 * Execute: npm run setup-db
 */

const migrations = [
  {
    name: 'Criar tabela usuarios',
    sql: `
      CREATE TABLE IF NOT EXISTS usuarios (
        id TEXT PRIMARY KEY,                    -- Hardware ID único da máquina
        nome TEXT NOT NULL,                     -- Nome do usuário
        liberado BOOLEAN DEFAULT FALSE,         -- Se o usuário está liberado para acessar
        data_criacao TIMESTAMP DEFAULT NOW(),   -- Data de criação do registro
        ultimo_acesso TIMESTAMP,                -- Último acesso do usuário
        ativo BOOLEAN DEFAULT TRUE              -- Se o usuário está ativo no sistema
      );
    `
  },
  {
    name: 'Criar tabela nodes',
    sql: `
      CREATE TABLE IF NOT EXISTS nodes (
        id SERIAL PRIMARY KEY,                  -- ID único auto-incremento
        estado TEXT NOT NULL,                   -- Estado (ex: São Paulo, Rio de Janeiro)
        cidade TEXT NOT NULL,                   -- Cidade (ex: Campinas, Niterói)
        nodes TEXT NOT NULL,                    -- Identificador do node/tarefa
        status TEXT DEFAULT 'Disponível'       -- Status: Disponível, Em Execução, Concluído
          CHECK (status IN ('Disponível', 'Em Execução', 'Concluído')),
        ativo BOOLEAN DEFAULT TRUE,             -- Se o node está ativo
        observacao TEXT,                        -- Observações sobre o node
        usuario TEXT,                           -- Nome do usuário que pegou o node
        usuario_id TEXT,                        -- Hardware ID do usuário (para relatórios)
        data_criacao TIMESTAMP DEFAULT NOW(),   -- Data de criação do node
        data_inicio TIMESTAMP,                  -- Data que o usuário pegou o node
        data_conclusao TIMESTAMP,               -- Data que o node foi concluído
        tempo_execucao INTEGER,                 -- Tempo de execução em minutos (calculado)
        
        -- Foreign key para usuários
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
      );
    `
  },
  {
    name: 'Criar tabela logs',
    sql: `
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,                  -- ID único auto-incremento
        usuario TEXT,                           -- Nome do usuário
        usuario_id TEXT,                        -- Hardware ID do usuário
        acao TEXT NOT NULL,                     -- Ação realizada
        detalhes TEXT,                          -- Detalhes da ação (JSON ou texto)
        ip_address TEXT,                        -- IP do usuário
        user_agent TEXT,                        -- Browser/OS do usuário
        timestamp TIMESTAMP DEFAULT NOW()       -- Data e hora da ação
      );
    `
  },
  {
    name: 'Criar índices para logs',
    sql: `
      -- Índices para tabela logs
      CREATE INDEX IF NOT EXISTS idx_logs_usuario_id ON logs(usuario_id);
      CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_logs_acao ON logs(acao);
    `
  },
  {
    name: 'Criar índices para performance',
    sql: `
      -- Índices para tabela nodes
      CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status);
      CREATE INDEX IF NOT EXISTS idx_nodes_usuario ON nodes(usuario);
      CREATE INDEX IF NOT EXISTS idx_nodes_usuario_id ON nodes(usuario_id);
      CREATE INDEX IF NOT EXISTS idx_nodes_ativo ON nodes(ativo);
      CREATE INDEX IF NOT EXISTS idx_nodes_estado ON nodes(estado);
      CREATE INDEX IF NOT EXISTS idx_nodes_cidade ON nodes(cidade);
      CREATE INDEX IF NOT EXISTS idx_nodes_data_inicio ON nodes(data_inicio);
      CREATE INDEX IF NOT EXISTS idx_nodes_data_conclusao ON nodes(data_conclusao);
      
      -- Índices compostos para consultas comuns
      CREATE INDEX IF NOT EXISTS idx_nodes_status_ativo ON nodes(status, ativo);
      CREATE INDEX IF NOT EXISTS idx_nodes_usuario_status ON nodes(usuario_id, status);
      
      -- Índices para tabela usuarios
      CREATE INDEX IF NOT EXISTS idx_usuarios_liberado ON usuarios(liberado);
      CREATE INDEX IF NOT EXISTS idx_usuarios_ativo ON usuarios(ativo);
      CREATE INDEX IF NOT EXISTS idx_usuarios_ultimo_acesso ON usuarios(ultimo_acesso);
    `
  },
  {
    name: 'Inserir dados iniciais',
    sql: `
      -- Inserir usuário admin padrão (apenas se não existir)
      INSERT INTO usuarios (id, nome, liberado, ativo) 
      VALUES ('ADMIN_SYSTEM', 'Administrador Sistema', true, true)
      ON CONFLICT (id) DO NOTHING;
      
      -- Inserir alguns usuários de exemplo (apenas em desenvolvimento)
      INSERT INTO usuarios (id, nome, liberado, ativo) 
      VALUES 
        ('VCD569DW', 'Kaike', true, true),
        ('XYZ123AB', 'Maria Silva', true, true),
        ('ABC789CD', 'João Santos', false, true)
      ON CONFLICT (id) DO NOTHING;
    `
  },
  {
    name: 'Criar views para relatórios',
    sql: `
      -- View para estatísticas gerais
      CREATE OR REPLACE VIEW vw_estatisticas AS
      SELECT 
        COUNT(*) as total_nodes,
        COUNT(*) FILTER (WHERE status = 'Disponível' AND ativo = true) as nodes_disponiveis,
        COUNT(*) FILTER (WHERE status = 'Em Execução') as nodes_em_execucao,
        COUNT(*) FILTER (WHERE status = 'Concluído') as nodes_concluidos,
        COUNT(DISTINCT usuario_id) FILTER (WHERE status = 'Em Execução') as usuarios_ativos,
        COUNT(DISTINCT estado) as total_estados,
        COUNT(DISTINCT cidade) as total_cidades
      FROM nodes;
      
      -- View para nodes por usuário
      CREATE OR REPLACE VIEW vw_nodes_por_usuario AS
      SELECT 
        u.id as usuario_id,
        u.nome as usuario_nome,
        COUNT(*) FILTER (WHERE n.status = 'Em Execução') as nodes_em_execucao,
        COUNT(*) FILTER (WHERE n.status = 'Concluído') as nodes_concluidos,
        COUNT(*) as total_nodes_atribuidos,
        AVG(n.tempo_execucao) as tempo_medio_execucao,
        MAX(n.data_inicio) as ultimo_node_iniciado,
        MAX(n.data_conclusao) as ultimo_node_concluido
      FROM usuarios u
      LEFT JOIN nodes n ON u.id = n.usuario_id
      WHERE u.ativo = true
      GROUP BY u.id, u.nome;
      
      -- View para nodes por localização
      CREATE OR REPLACE VIEW vw_nodes_por_localizacao AS
      SELECT 
        estado,
        cidade,
        COUNT(*) as total_nodes,
        COUNT(*) FILTER (WHERE status = 'Disponível' AND ativo = true) as disponiveis,
        COUNT(*) FILTER (WHERE status = 'Em Execução') as em_execucao,
        COUNT(*) FILTER (WHERE status = 'Concluído') as concluidos,
        ROUND(
          (COUNT(*) FILTER (WHERE status = 'Concluído')::float / NULLIF(COUNT(*), 0)) * 100, 
          2
        ) as percentual_concluido
      FROM nodes
      GROUP BY estado, cidade
      ORDER BY estado, cidade;
    `
  }
];

/**
 * Função para executar todas as migrações
 */
const runMigrations = async () => {
  console.log('🚀 Iniciando configuração do banco de dados...\n');
  
  try {
    // Testar conexão primeiro
    const connected = await testConnection();
    if (!connected) {
      console.error('❌ Falha na conexão. Verifique as configurações do banco.');
      process.exit(1);
    }
    
    console.log('\n📋 Executando migrações...\n');
    
    // Executar cada migração
    for (let i = 0; i < migrations.length; i++) {
      const migration = migrations[i];
      console.log(`${i + 1}/${migrations.length} - ${migration.name}...`);
      
      try {
        await query(migration.sql);
        console.log(`✅ ${migration.name} - Concluída\n`);
      } catch (error) {
        console.error(`❌ ${migration.name} - Erro:`, error.message);
        
        // Se for erro de índice ou dados iniciais, continuar
        if (migration.name.includes('índices') || migration.name.includes('dados iniciais')) {
          console.log(`⚠️  Continuando mesmo com erro em: ${migration.name}\n`);
        } else {
          // Para tabelas essenciais, parar a execução
          throw error;
        }
      }
    }
    
    // Verificar se as tabelas foram criadas
    console.log('🔍 Verificando tabelas criadas...\n');
    const tablesResult = await query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    
    console.log('📊 Tabelas criadas:');
    tablesResult.rows.forEach(table => {
      console.log(`  ✓ ${table.table_name}`);
    });
    
    // Verificar views criadas
    const viewsResult = await query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    if (viewsResult.rows.length > 0) {
      console.log('\n📈 Views criadas:');
      viewsResult.rows.forEach(view => {
        console.log(`  ✓ ${view.table_name}`);
      });
    }
    
    // Verificar dados iniciais
    const usuariosCount = await query('SELECT COUNT(*) as count FROM usuarios');
    console.log(`\n👥 Usuários cadastrados: ${usuariosCount.rows[0].count}`);
    
    console.log('\n🎉 Configuração do banco de dados concluída com sucesso!');
    console.log('\n📝 Próximos passos:');
    console.log('  1. Instale as dependências: npm install');
    console.log('  2. Inicie o servidor: npm start');
    console.log('  3. Acesse o sistema: http://localhost:3000\n');
    
  } catch (error) {
    console.error('\n💥 Erro durante a configuração:', error.message);
    console.error('📋 Stack trace:', error.stack);
    process.exit(1);
  }
};

/**
 * Função para fazer rollback (desenvolvimento)
 */
const rollback = async () => {
  console.log('⚠️  CUIDADO: Isso irá deletar TODAS as tabelas e dados!\n');
  
  const dropQueries = [
    'DROP VIEW IF EXISTS vw_estatisticas CASCADE;',
    'DROP VIEW IF EXISTS vw_nodes_por_usuario CASCADE;',
    'DROP VIEW IF EXISTS vw_nodes_por_localizacao CASCADE;',
    'DROP TABLE IF EXISTS logs CASCADE;',
    'DROP TABLE IF EXISTS nodes CASCADE;',
    'DROP TABLE IF EXISTS usuarios CASCADE;'
  ];
  
  try {
    for (const dropQuery of dropQueries) {
      await query(dropQuery);
    }
    console.log('✅ Rollback concluído. Todas as tabelas foram removidas.');
  } catch (error) {
    console.error('❌ Erro durante rollback:', error.message);
  }
};

// Executar migrações se este arquivo for chamado diretamente
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'rollback') {
    rollback().finally(() => closeConnection());
  } else {
    runMigrations().finally(() => closeConnection());
  }
}

module.exports = {
  runMigrations,
  rollback,
  migrations
};