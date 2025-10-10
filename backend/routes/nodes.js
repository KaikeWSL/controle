const express = require('express');
const { query } = require('../db/connection');
const { authMiddleware } = require('../middleware/authMiddleware');
const router = express.Router();

// Função para registrar logs
const logAction = async (usuario, acao, detalhes) => {
  try {
    await query(
      'INSERT INTO logs (usuario, acao, detalhes) VALUES ($1, $2, $3)',
      [usuario, acao, detalhes]
    );
  } catch (error) {
    console.error('Erro ao registrar log:', error);
  }
};

// Aplicar middleware de autenticação em todas as rotas
router.use(authMiddleware);

// Obter nodes disponíveis
router.get('/disponiveis', async (req, res) => {
  try {
    const { estado, cidade } = req.query;
    
    let queryText = `
      SELECT id, estado, cidade, nodes 
      FROM nodes 
      WHERE status = 'Disponível' AND ativo = TRUE
    `;
    const queryParams = [];
    
    // Aplicar filtros se fornecidos
    if (estado) {
      queryParams.push(estado);
      queryText += ` AND estado = $${queryParams.length}`;
    }
    
    if (cidade) {
      queryParams.push(cidade);
      queryText += ` AND cidade = $${queryParams.length}`;
    }
    
    queryText += ' ORDER BY estado, cidade, nodes';
    
    const result = await query(queryText, queryParams);
    
    res.json({
      success: true,
      nodes: result.rows,
      total: result.rows.length
    });
    
  } catch (error) {
    console.error('Erro ao buscar nodes disponíveis:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar nodes disponíveis'
    });
  }
});

// Pegar um node (claim)
router.post('/pegar/:id', async (req, res) => {
  const client = await require('../db/connection').pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const nodeId = req.params.id;
    const userName = req.user.nome;
    
    // Trava o registro para evitar conflitos (FOR UPDATE NOWAIT)
    const checkResult = await client.query(
      'SELECT id, status, nodes, estado, cidade FROM nodes WHERE id = $1 AND status = $2 AND ativo = TRUE FOR UPDATE NOWAIT',
      [nodeId, 'Disponível']
    );
    
    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Este node já foi atribuído ou não está disponível'
      });
    }
    
    const node = checkResult.rows[0];
    
    // Atualizar o node para "Em Execução"
    await client.query(
      'UPDATE nodes SET usuario = $1, status = $2, data_inicio = NOW() WHERE id = $3',
      [userName, 'Em Execução', nodeId]
    );
    
    await client.query('COMMIT');
    
    await logAction(userName, 'CLAIM_NODE', `Node ${node.nodes} (${node.estado}/${node.cidade}) atribuído`);
    
    res.json({
      success: true,
      message: 'Node atribuído com sucesso!',
      node: {
        id: node.id,
        nodes: node.nodes,
        estado: node.estado,
        cidade: node.cidade
      }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    
    if (error.code === '55P03') { // NOWAIT timeout
      res.status(409).json({
        success: false,
        message: 'Este node está sendo processado por outro usuário'
      });
    } else {
      console.error('Erro ao pegar node:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  } finally {
    client.release();
  }
});

// Concluir um node
router.put('/concluir/:id', async (req, res) => {
  try {
    const nodeId = req.params.id;
    const userName = req.user.nome;
    const { observacao } = req.body;
    
    // Verificar se o node pertence ao usuário e está em execução
    const checkResult = await query(
      'SELECT id, nodes, estado, cidade FROM nodes WHERE id = $1 AND usuario = $2 AND status = $3',
      [nodeId, userName, 'Em Execução']
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Node não encontrado ou não pertence a você'
      });
    }
    
    const node = checkResult.rows[0];
    
    // Atualizar para concluído
    await query(
      'UPDATE nodes SET status = $1, data_conclusao = NOW(), observacao = $2 WHERE id = $3',
      ['Concluído', observacao || null, nodeId]
    );
    
    await logAction(userName, 'CONCLUIR_NODE', `Node ${node.nodes} (${node.estado}/${node.cidade}) concluído`);
    
    res.json({
      success: true,
      message: 'Node concluído com sucesso!',
      node: {
        id: node.id,
        nodes: node.nodes,
        estado: node.estado,
        cidade: node.cidade
      }
    });
    
  } catch (error) {
    console.error('Erro ao concluir node:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Obter meus nodes em execução
router.get('/meus', async (req, res) => {
  try {
    const userName = req.user.nome;
    
    const result = await query(
      `SELECT id, estado, cidade, nodes, data_inicio, observacao
       FROM nodes 
       WHERE usuario = $1 AND status = 'Em Execução'
       ORDER BY data_inicio DESC`,
      [userName]
    );
    
    res.json({
      success: true,
      nodes: result.rows,
      total: result.rows.length
    });
    
  } catch (error) {
    console.error('Erro ao buscar meus nodes:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar seus nodes'
    });
  }
});

// Obter estatísticas gerais para o dashboard do usuário
router.get('/estatisticas', async (req, res) => {
  try {
    // Total disponível
    const disponiveis = await query(
      "SELECT COUNT(*) FROM nodes WHERE status = 'Disponível' AND ativo = TRUE"
    );
    
    // Em execução
    const emExecucao = await query(
      "SELECT COUNT(*) FROM nodes WHERE status = 'Em Execução'"
    );
    
    // Meus nodes em execução
    const meusNodes = await query(
      "SELECT COUNT(*) FROM nodes WHERE usuario = $1 AND status = 'Em Execução'",
      [req.user.nome]
    );
    
    // Meus nodes concluídos hoje
    const meusConcluidos = await query(
      "SELECT COUNT(*) FROM nodes WHERE usuario = $1 AND status = 'Concluído' AND DATE(data_conclusao) = CURRENT_DATE",
      [req.user.nome]
    );
    
    res.json({
      success: true,
      estatisticas: {
        disponiveis: parseInt(disponiveis.rows[0].count),
        emExecucao: parseInt(emExecucao.rows[0].count),
        meusNodes: parseInt(meusNodes.rows[0].count),
        meusConcluidos: parseInt(meusConcluidos.rows[0].count)
      }
    });
    
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar estatísticas'
    });
  }
});

module.exports = router;