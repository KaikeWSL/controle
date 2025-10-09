const express = require('express');
const Joi = require('joi');
const { query, transaction } = require('../db/connection');
const { authenticateToken, requireUser } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * Schemas de validação
 */
const claimNodeSchema = Joi.object({
  nodeId: Joi.number().integer().positive().required()
});

/**
 * Função para registrar logs
 */
const logAction = async (usuario, usuario_id, acao, detalhes, req) => {
  try {
    await query(
      `INSERT INTO logs (usuario, usuario_id, acao, detalhes, ip_address, user_agent) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        usuario,
        usuario_id,
        acao,
        JSON.stringify(detalhes),
        req.ip || req.connection.remoteAddress,
        req.get('User-Agent')
      ]
    );
  } catch (error) {
    console.error('Erro ao registrar log:', error);
  }
};

/**
 * GET /api/nodes/disponiveis
 * Listar nodes disponíveis para usuários
 */
router.get('/disponiveis', authenticateToken, requireUser, async (req, res) => {
  try {
    const { estado, cidade, limit = 50, offset = 0 } = req.query;
    
    let whereConditions = [`status = 'Disponível'`, `ativo = true`];
    let queryParams = [];
    let paramCount = 0;
    
    // Filtros opcionais
    if (estado) {
      paramCount++;
      whereConditions.push(`estado ILIKE $${paramCount}`);
      queryParams.push(`%${estado}%`);
    }
    
    if (cidade) {
      paramCount++;
      whereConditions.push(`cidade ILIKE $${paramCount}`);
      queryParams.push(`%${cidade}%`);
    }
    
    // Paginação
    paramCount++;
    const limitValue = Math.min(parseInt(limit), 100); // Máximo 100 por página
    queryParams.push(limitValue);
    
    paramCount++;
    const offsetValue = Math.max(parseInt(offset), 0);
    queryParams.push(offsetValue);
    
    const nodesQuery = `
      SELECT 
        id, estado, cidade, nodes, data_criacao,
        ROW_NUMBER() OVER (ORDER BY estado, cidade, nodes) as row_num
      FROM nodes 
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY estado, cidade, nodes
      LIMIT $${paramCount - 1} OFFSET $${paramCount}
    `;
    
    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM nodes 
      WHERE ${whereConditions.join(' AND ')}
    `;
    
    const [nodesResult, countResult] = await Promise.all([
      query(nodesQuery, queryParams),
      query(countQuery, queryParams.slice(0, -2)) // Remove limit e offset para contagem
    ]);
    
    // Agrupar por estado para facilitar exibição
    const nodesByState = {};
    nodesResult.rows.forEach(node => {
      if (!nodesByState[node.estado]) {
        nodesByState[node.estado] = {};
      }
      if (!nodesByState[node.estado][node.cidade]) {
        nodesByState[node.estado][node.cidade] = [];
      }
      nodesByState[node.estado][node.cidade].push({
        id: node.id,
        nodes: node.nodes,
        data_criacao: node.data_criacao
      });
    });
    
    res.json({
      success: true,
      data: {
        nodes: nodesResult.rows,
        nodesByState: nodesByState,
        pagination: {
          total: parseInt(countResult.rows[0].total),
          limit: limitValue,
          offset: offsetValue,
          hasNext: (offsetValue + limitValue) < parseInt(countResult.rows[0].total)
        }
      }
    });
    
  } catch (error) {
    console.error('Erro ao buscar nodes disponíveis:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * POST /api/nodes/pegar/:id
 * Pegar node para execução (claim) - TRANSAÇÃO ATÔMICA
 */
router.post('/pegar/:id', authenticateToken, requireUser, async (req, res) => {
  try {
    const nodeId = parseInt(req.params.id);
    
    if (!nodeId || nodeId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'ID do node inválido'
      });
    }
    
    // Transação atômica para evitar conflitos
    const result = await transaction(async (client) => {
      // 1. Verificar e travar o node (FOR UPDATE NOWAIT)
      const lockResult = await client.query(`
        SELECT id, estado, cidade, nodes, status, ativo 
        FROM nodes 
        WHERE id = $1 AND status = 'Disponível' AND ativo = true
        FOR UPDATE NOWAIT
      `, [nodeId]);
      
      if (lockResult.rows.length === 0) {
        throw new Error('Node não está disponível ou já foi atribuído a outro usuário');
      }
      
      const node = lockResult.rows[0];
      
      // 2. Verificar se usuário não tem muitos nodes em execução (limite de 10)
      const userNodesResult = await client.query(`
        SELECT COUNT(*) as count 
        FROM nodes 
        WHERE usuario_id = $1 AND status = 'Em Execução'
      `, [req.user.userId]);
      
      const currentNodesCount = parseInt(userNodesResult.rows[0].count);
      if (currentNodesCount >= 10) {
        throw new Error('Você já tem o máximo de 10 nodes em execução. Conclua alguns antes de pegar novos.');
      }
      
      // 3. Atualizar o node para "Em Execução"
      const updateResult = await client.query(`
        UPDATE nodes 
        SET 
          status = 'Em Execução',
          usuario = $1,
          usuario_id = $2,
          data_inicio = NOW()
        WHERE id = $3
        RETURNING *
      `, [req.user.nome, req.user.userId, nodeId]);
      
      return {
        node: updateResult.rows[0],
        originalNode: node
      };
    });
    
    // Log da ação
    await logAction(
      req.user.nome,
      req.user.userId,
      'NODE_CLAIM',
      {
        nodeId: nodeId,
        estado: result.originalNode.estado,
        cidade: result.originalNode.cidade,
        nodes: result.originalNode.nodes
      },
      req
    );
    
    res.json({
      success: true,
      message: `Node ${result.originalNode.nodes} atribuído com sucesso!`,
      data: {
        node: {
          id: result.node.id,
          estado: result.node.estado,
          cidade: result.node.cidade,
          nodes: result.node.nodes,
          data_inicio: result.node.data_inicio
        }
      }
    });
    
  } catch (error) {
    console.error('Erro ao pegar node:', error);
    
    // Tratar erro de lock específico
    if (error.message.includes('could not obtain lock') || error.message.includes('NOWAIT')) {
      return res.status(409).json({
        success: false,
        message: 'Este node já foi atribuído a outro usuário. Tente outro node.'
      });
    }
    
    res.status(400).json({
      success: false,
      message: error.message || 'Erro ao pegar node'
    });
  }
});

/**
 * PUT /api/nodes/concluir/:id
 * Marcar node como concluído
 */
router.put('/concluir/:id', authenticateToken, requireUser, async (req, res) => {
  try {
    const nodeId = parseInt(req.params.id);
    const { observacao } = req.body;
    
    if (!nodeId || nodeId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'ID do node inválido'
      });
    }
    
    // Verificar se o node pertence ao usuário e está em execução
    const nodeResult = await query(`
      SELECT id, estado, cidade, nodes, status, usuario_id, data_inicio
      FROM nodes 
      WHERE id = $1 AND usuario_id = $2 AND status = 'Em Execução'
    `, [nodeId, req.user.userId]);
    
    if (nodeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Node não encontrado ou não está em execução por você'
      });
    }
    
    const node = nodeResult.rows[0];
    
    // Calcular tempo de execução
    const dataInicio = new Date(node.data_inicio);
    const agora = new Date();
    const tempoExecucao = Math.round((agora - dataInicio) / (1000 * 60)); // em minutos
    
    // Atualizar node para concluído
    const updateResult = await query(`
      UPDATE nodes 
      SET 
        status = 'Concluído',
        data_conclusao = NOW(),
        tempo_execucao = $1,
        observacao = $2
      WHERE id = $3
      RETURNING *
    `, [tempoExecucao, observacao || null, nodeId]);
    
    // Log da ação
    await logAction(
      req.user.nome,
      req.user.userId,
      'NODE_CONCLUIDO',
      {
        nodeId: nodeId,
        estado: node.estado,
        cidade: node.cidade,
        nodes: node.nodes,
        tempo_execucao: tempoExecucao,
        observacao: observacao
      },
      req
    );
    
    res.json({
      success: true,
      message: `Node ${node.nodes} concluído com sucesso!`,
      data: {
        node: updateResult.rows[0],
        tempo_execucao: tempoExecucao
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

/**
 * GET /api/nodes/meus
 * Listar nodes do usuário (em execução)
 */
router.get('/meus', authenticateToken, requireUser, async (req, res) => {
  try {
    const { status = 'Em Execução' } = req.query;
    
    let whereConditions = ['usuario_id = $1'];
    const queryParams = [req.user.userId];
    
    if (status && ['Em Execução', 'Concluído'].includes(status)) {
      whereConditions.push('status = $2');
      queryParams.push(status);
    }
    
    const nodesResult = await query(`
      SELECT 
        id, estado, cidade, nodes, status, observacao,
        data_inicio, data_conclusao, tempo_execucao,
        CASE 
          WHEN status = 'Em Execução' AND data_inicio IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (NOW() - data_inicio))/60 
          ELSE tempo_execucao 
        END as tempo_atual_minutos
      FROM nodes 
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY 
        CASE WHEN status = 'Em Execução' THEN 1 ELSE 2 END,
        data_inicio DESC
    `, queryParams);
    
    // Separar por status
    const nodesByStatus = {
      'Em Execução': [],
      'Concluído': []
    };
    
    nodesResult.rows.forEach(node => {
      nodesByStatus[node.status].push({
        ...node,
        tempo_formatado: formatTempo(node.tempo_atual_minutos)
      });
    });
    
    res.json({
      success: true,
      data: {
        nodes: nodesResult.rows,
        nodesByStatus: nodesByStatus,
        resumo: {
          em_execucao: nodesByStatus['Em Execução'].length,
          concluidos: nodesByStatus['Concluído'].length,
          total: nodesResult.rows.length
        }
      }
    });
    
  } catch (error) {
    console.error('Erro ao buscar nodes do usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/nodes/estatisticas
 * Estatísticas gerais para o usuário
 */
router.get('/estatisticas', authenticateToken, requireUser, async (req, res) => {
  try {
    const statsResult = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'Em Execução') as nodes_em_execucao,
        COUNT(*) FILTER (WHERE status = 'Concluído') as nodes_concluidos,
        COUNT(*) as total_nodes_atribuidos,
        AVG(tempo_execucao) FILTER (WHERE tempo_execucao IS NOT NULL) as tempo_medio_execucao,
        MIN(data_inicio) as primeiro_node,
        MAX(data_conclusao) as ultimo_node_concluido
      FROM nodes 
      WHERE usuario_id = $1
    `, [req.user.userId]);
    
    const stats = statsResult.rows[0];
    
    // Estatísticas de hoje
    const todayStatsResult = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'Em Execução' AND DATE(data_inicio) = CURRENT_DATE) as iniciados_hoje,
        COUNT(*) FILTER (WHERE status = 'Concluído' AND DATE(data_conclusao) = CURRENT_DATE) as concluidos_hoje
      FROM nodes 
      WHERE usuario_id = $1
    `, [req.user.userId]);
    
    const todayStats = todayStatsResult.rows[0];
    
    res.json({
      success: true,
      data: {
        geral: {
          nodes_em_execucao: parseInt(stats.nodes_em_execucao) || 0,
          nodes_concluidos: parseInt(stats.nodes_concluidos) || 0,
          total_nodes_atribuidos: parseInt(stats.total_nodes_atribuidos) || 0,
          tempo_medio_execucao: stats.tempo_medio_execucao ? Math.round(parseFloat(stats.tempo_medio_execucao)) : 0,
          primeiro_node: stats.primeiro_node,
          ultimo_node_concluido: stats.ultimo_node_concluido
        },
        hoje: {
          iniciados_hoje: parseInt(todayStats.iniciados_hoje) || 0,
          concluidos_hoje: parseInt(todayStats.concluidos_hoje) || 0
        }
      }
    });
    
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * Função auxiliar para formatar tempo
 */
const formatTempo = (minutos) => {
  if (!minutos || minutos < 0) return '0min';
  
  const horas = Math.floor(minutos / 60);
  const mins = Math.round(minutos % 60);
  
  if (horas > 0) {
    return `${horas}h${mins > 0 ? ` ${mins}min` : ''}`;
  }
  
  return `${mins}min`;
};

module.exports = router;