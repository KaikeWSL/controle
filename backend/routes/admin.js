const express = require('express');
const multer = require('multer');
const Joi = require('joi');
const { query, transaction } = require('../db/connection');
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');
const { parseExcelFile, previewExcelFile, validateNodeData, normalizeData } = require('../utils/excelParser');
const { exportToExcel, exportUsersToExcel, createImportTemplate } = require('../utils/excelExporter');

const router = express.Router();

// Configuração do Multer para upload de arquivos
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.xlsx', '.xls'];
    const fileExtension = file.originalname.toLowerCase().slice(-5);
    
    if (allowedExtensions.some(ext => fileExtension.includes(ext))) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos .xlsx e .xls são permitidos'), false);
    }
  }
});

/**
 * Schemas de validação
 */
const nodeUpdateSchema = Joi.object({
  estado: Joi.string().min(2).max(50).required(),
  cidade: Joi.string().min(2).max(100).required(),
  nodes: Joi.string().min(1).max(100).required(),
  status: Joi.string().valid('Disponível', 'Em Execução', 'Concluído').required(),
  ativo: Joi.boolean().required(),
  observacao: Joi.string().max(500).allow('')
});

const userSchema = Joi.object({
  id: Joi.string().min(3).max(100).pattern(/^[A-Za-z0-9_-]+$/).required(),
  nome: Joi.string().min(2).max(100).required(),
  liberado: Joi.boolean().required(),
  ativo: Joi.boolean().required()
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
 * GET /api/admin/dashboard
 * Dashboard com métricas gerais
 */
router.get('/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Buscar estatísticas gerais
    const statsResult = await query(`
      SELECT * FROM vw_estatisticas
    `);
    
    // Buscar nodes por usuário
    const userStatsResult = await query(`
      SELECT * FROM vw_nodes_por_usuario 
      WHERE total_nodes_atribuidos > 0
      ORDER BY nodes_em_execucao DESC, nodes_concluidos DESC
      LIMIT 10
    `);
    
    // Buscar nodes por localização
    const locationStatsResult = await query(`
      SELECT * FROM vw_nodes_por_localizacao 
      ORDER BY total_nodes DESC
      LIMIT 10
    `);
    
    // Atividade recente (últimas 24h)
    const recentActivityResult = await query(`
      SELECT 
        usuario, acao, detalhes, timestamp
      FROM logs 
      WHERE timestamp >= NOW() - INTERVAL '24 hours'
      ORDER BY timestamp DESC
      LIMIT 20
    `);
    
    // Nodes mais ativos (estados/cidades com mais atividade)
    const activeLocationsResult = await query(`
      SELECT 
        estado, cidade,
        COUNT(*) as total_atividade,
        COUNT(*) FILTER (WHERE status = 'Concluído') as concluidos,
        MAX(data_conclusao) as ultima_atividade
      FROM nodes 
      WHERE data_inicio >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY estado, cidade
      ORDER BY total_atividade DESC
      LIMIT 5
    `);
    
    res.json({
      success: true,
      data: {
        estatisticas_gerais: statsResult.rows[0],
        usuarios_ativos: userStatsResult.rows,
        nodes_por_localizacao: locationStatsResult.rows,
        atividade_recente: recentActivityResult.rows,
        localizacoes_ativas: activeLocationsResult.rows
      }
    });
    
  } catch (error) {
    console.error('Erro ao buscar dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/admin/nodes
 * Listar todos os nodes (com filtros e paginação)
 */
router.get('/nodes', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { 
      estado, cidade, status, usuario, ativo, 
      limit = 50, offset = 0, sortBy = 'id', sortOrder = 'desc' 
    } = req.query;
    
    let whereConditions = [];
    let queryParams = [];
    let paramCount = 0;
    
    // Filtros
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
    
    if (status) {
      paramCount++;
      whereConditions.push(`status = $${paramCount}`);
      queryParams.push(status);
    }
    
    if (usuario) {
      paramCount++;
      whereConditions.push(`(usuario ILIKE $${paramCount} OR usuario_id ILIKE $${paramCount})`);
      queryParams.push(`%${usuario}%`);
    }
    
    if (ativo !== undefined) {
      paramCount++;
      whereConditions.push(`ativo = $${paramCount}`);
      queryParams.push(ativo === 'true');
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Validar ordenação
    const allowedSortColumns = ['id', 'estado', 'cidade', 'nodes', 'status', 'usuario', 'data_criacao', 'data_inicio', 'data_conclusao'];
    const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'id';
    const sortDirection = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    
    // Paginação
    paramCount++;
    const limitValue = Math.min(parseInt(limit), 100);
    queryParams.push(limitValue);
    
    paramCount++;
    const offsetValue = Math.max(parseInt(offset), 0);
    queryParams.push(offsetValue);
    
    // Query principal
    const nodesQuery = `
      SELECT 
        id, estado, cidade, nodes, status, ativo, observacao,
        usuario, usuario_id, data_criacao, data_inicio, data_conclusao, tempo_execucao
      FROM nodes 
      ${whereClause}
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT $${paramCount - 1} OFFSET $${paramCount}
    `;
    
    // Query para contagem
    const countQuery = `
      SELECT COUNT(*) as total
      FROM nodes 
      ${whereClause}
    `;
    
    const [nodesResult, countResult] = await Promise.all([
      query(nodesQuery, queryParams),
      query(countQuery, queryParams.slice(0, -2))
    ]);
    
    res.json({
      success: true,
      data: {
        nodes: nodesResult.rows,
        pagination: {
          total: parseInt(countResult.rows[0].total),
          limit: limitValue,
          offset: offsetValue,
          hasNext: (offsetValue + limitValue) < parseInt(countResult.rows[0].total)
        }
      }
    });
    
  } catch (error) {
    console.error('Erro ao buscar nodes:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * POST /api/admin/nodes/upload
 * Upload de arquivo Excel com nodes
 */
router.post('/nodes/upload', authenticateToken, requireAdmin, upload.single('excel'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum arquivo foi enviado'
      });
    }
    
    const { preview = false } = req.body;
    
    // Parse do arquivo Excel
    const parseResult = preview 
      ? previewExcelFile(req.file.buffer, req.file.originalname)
      : parseExcelFile(req.file.buffer, req.file.originalname);
    
    if (!parseResult.success) {
      await logAction(req.user.nome, req.user.userId, 'UPLOAD_EXCEL_ERRO', {
        filename: req.file.originalname,
        error: parseResult.error
      }, req);
      
      return res.status(400).json({
        success: false,
        message: parseResult.error,
        errors: parseResult.errors
      });
    }
    
    // Se for apenas preview, retornar dados sem inserir
    if (preview) {
      return res.json({
        success: true,
        message: 'Preview do arquivo gerado com sucesso',
        data: parseResult
      });
    }
    
    // Validar e inserir dados
    const { data: validData } = parseResult;
    let insertedCount = 0;
    let errors = [];
    
    // Processar em transação
    const result = await transaction(async (client) => {
      for (let i = 0; i < validData.length; i++) {
        const rowData = validData[i];
        const lineNumber = i + 1;
        
        try {
          // Validar dados
          const validation = validateNodeData(rowData);
          if (!validation.isValid) {
            errors.push(`Linha ${lineNumber}: ${validation.errors.join(', ')}`);
            continue;
          }
          
          // Normalizar dados
          const normalizedData = normalizeData(rowData);
          
          // Verificar duplicatas (mesmo estado, cidade e node)
          const duplicateCheck = await client.query(`
            SELECT id FROM nodes 
            WHERE estado = $1 AND cidade = $2 AND nodes = $3
          `, [normalizedData.estado, normalizedData.cidade, normalizedData.nodes]);
          
          if (duplicateCheck.rows.length > 0) {
            errors.push(`Linha ${lineNumber}: Node ${normalizedData.nodes} já existe em ${normalizedData.cidade}/${normalizedData.estado}`);
            continue;
          }
          
          // Inserir node
          await client.query(`
            INSERT INTO nodes (estado, cidade, nodes, status, ativo, data_criacao) 
            VALUES ($1, $2, $3, 'Disponível', true, NOW())
          `, [normalizedData.estado, normalizedData.cidade, normalizedData.nodes]);
          
          insertedCount++;
          
        } catch (insertError) {
          errors.push(`Linha ${lineNumber}: Erro ao inserir - ${insertError.message}`);
        }
      }
      
      return { insertedCount, errors };
    });
    
    // Log da operação
    await logAction(req.user.nome, req.user.userId, 'UPLOAD_EXCEL_SUCESSO', {
      filename: req.file.originalname,
      total_linhas: validData.length,
      inseridos: result.insertedCount,
      erros: result.errors.length
    }, req);
    
    res.json({
      success: true,
      message: `Upload concluído! ${result.insertedCount} nodes inseridos com sucesso.`,
      data: {
        ...parseResult,
        inserted: result.insertedCount,
        errors: result.errors,
        summary: {
          ...parseResult.summary,
          inseridos: result.insertedCount,
          erros_insercao: result.errors.length
        }
      }
    });
    
  } catch (error) {
    console.error('Erro no upload:', error);
    
    await logAction(req.user.nome, req.user.userId, 'UPLOAD_EXCEL_ERRO', {
      filename: req.file?.originalname,
      error: error.message
    }, req);
    
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor durante upload'
    });
  }
});

/**
 * PUT /api/admin/nodes/:id
 * Editar node
 */
router.put('/nodes/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const nodeId = parseInt(req.params.id);
    
    if (!nodeId || nodeId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'ID do node inválido'
      });
    }
    
    // Validar dados
    const { error, value } = nodeUpdateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        details: error.details[0].message
      });
    }
    
    const { estado, cidade, nodes, status, ativo, observacao } = value;
    
    // Verificar se node existe
    const existingNodeResult = await query(
      'SELECT * FROM nodes WHERE id = $1',
      [nodeId]
    );
    
    if (existingNodeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Node não encontrado'
      });
    }
    
    const originalNode = existingNodeResult.rows[0];
    
    // Verificar duplicatas (exceto o próprio node)
    const duplicateResult = await query(`
      SELECT id FROM nodes 
      WHERE estado = $1 AND cidade = $2 AND nodes = $3 AND id != $4
    `, [estado, cidade, nodes, nodeId]);
    
    if (duplicateResult.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Node ${nodes} já existe em ${cidade}/${estado}`
      });
    }
    
    // Atualizar node
    const updateResult = await query(`
      UPDATE nodes 
      SET estado = $1, cidade = $2, nodes = $3, status = $4, ativo = $5, observacao = $6
      WHERE id = $7
      RETURNING *
    `, [estado, cidade, nodes, status, ativo, observacao || null, nodeId]);
    
    // Log da ação
    await logAction(req.user.nome, req.user.userId, 'NODE_EDITADO', {
      nodeId: nodeId,
      original: originalNode,
      novo: updateResult.rows[0]
    }, req);
    
    res.json({
      success: true,
      message: 'Node atualizado com sucesso',
      data: updateResult.rows[0]
    });
    
  } catch (error) {
    console.error('Erro ao editar node:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * DELETE /api/admin/nodes/:id
 * Deletar node
 */
router.delete('/nodes/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const nodeId = parseInt(req.params.id);
    
    if (!nodeId || nodeId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'ID do node inválido'
      });
    }
    
    // Verificar se node existe e buscar dados para log
    const nodeResult = await query(
      'SELECT * FROM nodes WHERE id = $1',
      [nodeId]
    );
    
    if (nodeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Node não encontrado'
      });
    }
    
    const node = nodeResult.rows[0];
    
    // Não permitir deletar nodes em execução
    if (node.status === 'Em Execução') {
      return res.status(400).json({
        success: false,
        message: 'Não é possível deletar um node em execução. Primeiro conclua ou resete o node.'
      });
    }
    
    // Deletar node
    await query('DELETE FROM nodes WHERE id = $1', [nodeId]);
    
    // Log da ação
    await logAction(req.user.nome, req.user.userId, 'NODE_DELETADO', {
      nodeId: nodeId,
      node: node
    }, req);
    
    res.json({
      success: true,
      message: 'Node deletado com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao deletar node:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * POST /api/admin/nodes/:id/resetar
 * Resetar node (liberar de usuário)
 */
router.post('/nodes/:id/resetar', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const nodeId = parseInt(req.params.id);
    
    if (!nodeId || nodeId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'ID do node inválido'
      });
    }
    
    // Buscar node atual
    const nodeResult = await query(
      'SELECT * FROM nodes WHERE id = $1',
      [nodeId]
    );
    
    if (nodeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Node não encontrado'
      });
    }
    
    const node = nodeResult.rows[0];
    
    // Resetar node para disponível
    const updateResult = await query(`
      UPDATE nodes 
      SET 
        status = 'Disponível',
        usuario = NULL,
        usuario_id = NULL,
        data_inicio = NULL,
        data_conclusao = NULL,
        tempo_execucao = NULL,
        observacao = NULL
      WHERE id = $1
      RETURNING *
    `, [nodeId]);
    
    // Log da ação
    await logAction(req.user.nome, req.user.userId, 'NODE_RESETADO', {
      nodeId: nodeId,
      usuario_anterior: node.usuario,
      status_anterior: node.status
    }, req);
    
    res.json({
      success: true,
      message: 'Node resetado com sucesso',
      data: updateResult.rows[0]
    });
    
  } catch (error) {
    console.error('Erro ao resetar node:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/admin/export
 * Exportar todos os dados para Excel
 */
router.get('/export', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { type = 'all' } = req.query;
    
    let whereClause = '';
    let queryParams = [];
    
    switch (type) {
      case 'today':
        whereClause = 'WHERE DATE(data_inicio) = CURRENT_DATE OR DATE(data_conclusao) = CURRENT_DATE';
        break;
      case 'available':
        whereClause = "WHERE status = 'Disponível' AND ativo = true";
        break;
      case 'completed':
        whereClause = "WHERE status = 'Concluído'";
        break;
      case 'in-progress':
        whereClause = "WHERE status = 'Em Execução'";
        break;
    }
    
    const dataResult = await query(`
      SELECT * FROM nodes 
      ${whereClause}
      ORDER BY data_criacao DESC
    `, queryParams);
    
    const exportResult = await exportToExcel(dataResult.rows, { type });
    
    if (!exportResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao gerar arquivo Excel'
      });
    }
    
    // Log da ação
    await logAction(req.user.nome, req.user.userId, 'EXPORT_DADOS', {
      type: type,
      total_registros: dataResult.rows.length,
      filename: exportResult.filename
    }, req);
    
    res.set({
      'Content-Type': exportResult.contentType,
      'Content-Disposition': `attachment; filename="${exportResult.filename}"`,
      'Content-Length': exportResult.buffer.length
    });
    
    res.send(exportResult.buffer);
    
  } catch (error) {
    console.error('Erro na exportação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/admin/usuarios
 * Listar todos os usuários
 */
router.get('/usuarios', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { ativo, liberado, limit = 50, offset = 0 } = req.query;
    
    let whereConditions = [];
    let queryParams = [];
    let paramCount = 0;
    
    if (ativo !== undefined) {
      paramCount++;
      whereConditions.push(`ativo = $${paramCount}`);
      queryParams.push(ativo === 'true');
    }
    
    if (liberado !== undefined) {
      paramCount++;
      whereConditions.push(`liberado = $${paramCount}`);
      queryParams.push(liberado === 'true');
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Paginação
    paramCount++;
    const limitValue = Math.min(parseInt(limit), 100);
    queryParams.push(limitValue);
    
    paramCount++;
    const offsetValue = Math.max(parseInt(offset), 0);
    queryParams.push(offsetValue);
    
    const usersQuery = `
      SELECT 
        u.*,
        COUNT(n.id) FILTER (WHERE n.status = 'Em Execução') as nodes_em_execucao,
        COUNT(n.id) FILTER (WHERE n.status = 'Concluído') as nodes_concluidos,
        COUNT(n.id) as total_nodes_atribuidos,
        AVG(n.tempo_execucao) FILTER (WHERE n.tempo_execucao IS NOT NULL) as tempo_medio_execucao
      FROM usuarios u
      LEFT JOIN nodes n ON u.id = n.usuario_id
      ${whereClause}
      GROUP BY u.id, u.nome, u.liberado, u.ativo, u.data_criacao, u.ultimo_acesso
      ORDER BY u.data_criacao DESC
      LIMIT $${paramCount - 1} OFFSET $${paramCount}
    `;
    
    const countQuery = `
      SELECT COUNT(*) as total FROM usuarios u ${whereClause}
    `;
    
    const [usersResult, countResult] = await Promise.all([
      query(usersQuery, queryParams),
      query(countQuery, queryParams.slice(0, -2))
    ]);
    
    res.json({
      success: true,
      data: {
        usuarios: usersResult.rows.map(user => ({
          ...user,
          nodes_em_execucao: parseInt(user.nodes_em_execucao) || 0,
          nodes_concluidos: parseInt(user.nodes_concluidos) || 0,
          total_nodes_atribuidos: parseInt(user.total_nodes_atribuidos) || 0,
          tempo_medio_execucao: user.tempo_medio_execucao ? Math.round(parseFloat(user.tempo_medio_execucao)) : 0
        })),
        pagination: {
          total: parseInt(countResult.rows[0].total),
          limit: limitValue,
          offset: offsetValue,
          hasNext: (offsetValue + limitValue) < parseInt(countResult.rows[0].total)
        }
      }
    });
    
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * POST /api/admin/usuarios
 * Criar novo usuário
 */
router.post('/usuarios', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Validar dados
    const { error, value } = userSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        details: error.details[0].message
      });
    }
    
    const { id, nome, liberado, ativo } = value;
    
    // Verificar se usuário já existe
    const existingUserResult = await query(
      'SELECT id FROM usuarios WHERE id = $1',
      [id]
    );
    
    if (existingUserResult.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Usuário com este Hardware ID já existe'
      });
    }
    
    // Criar usuário
    const createResult = await query(`
      INSERT INTO usuarios (id, nome, liberado, ativo, data_criacao) 
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
    `, [id, nome, liberado, ativo]);
    
    // Log da ação
    await logAction(req.user.nome, req.user.userId, 'USUARIO_CRIADO', {
      usuario_criado: createResult.rows[0]
    }, req);
    
    res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso',
      data: createResult.rows[0]
    });
    
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * PUT /api/admin/usuarios/:id
 * Editar usuário
 */
router.put('/usuarios/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { nome, liberado, ativo } = req.body;
    
    // Validação básica
    if (!nome || typeof liberado !== 'boolean' || typeof ativo !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos. Nome, liberado e ativo são obrigatórios.'
      });
    }
    
    // Verificar se usuário existe
    const existingUserResult = await query(
      'SELECT * FROM usuarios WHERE id = $1',
      [userId]
    );
    
    if (existingUserResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    const originalUser = existingUserResult.rows[0];
    
    // Atualizar usuário
    const updateResult = await query(`
      UPDATE usuarios 
      SET nome = $1, liberado = $2, ativo = $3
      WHERE id = $4
      RETURNING *
    `, [nome, liberado, ativo, userId]);
    
    // Log da ação
    await logAction(req.user.nome, req.user.userId, 'USUARIO_EDITADO', {
      usuario_id: userId,
      original: originalUser,
      novo: updateResult.rows[0]
    }, req);
    
    res.json({
      success: true,
      message: 'Usuário atualizado com sucesso',
      data: updateResult.rows[0]
    });
    
  } catch (error) {
    console.error('Erro ao editar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * DELETE /api/admin/usuarios/:id
 * Deletar usuário
 */
router.delete('/usuarios/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Verificar se usuário existe
    const userResult = await query(
      'SELECT * FROM usuarios WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    const user = userResult.rows[0];
    
    // Verificar se usuário tem nodes em execução
    const activeNodesResult = await query(
      'SELECT COUNT(*) as count FROM nodes WHERE usuario_id = $1 AND status = $2',
      [userId, 'Em Execução']
    );
    
    const activeNodesCount = parseInt(activeNodesResult.rows[0].count);
    
    if (activeNodesCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Não é possível deletar usuário com ${activeNodesCount} nodes em execução. Primeiro conclua ou resete os nodes.`
      });
    }
    
    // Deletar usuário (nodes concluídos ficarão sem referência, mas manterão o nome)
    await query('DELETE FROM usuarios WHERE id = $1', [userId]);
    
    // Log da ação
    await logAction(req.user.nome, req.user.userId, 'USUARIO_DELETADO', {
      usuario_deletado: user
    }, req);
    
    res.json({
      success: true,
      message: 'Usuário deletado com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao deletar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/admin/export-usuarios
 * Exportar usuários para Excel
 */
router.get('/export-usuarios', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const usersResult = await query(`
      SELECT 
        u.*,
        COUNT(n.id) FILTER (WHERE n.status = 'Em Execução') as nodes_em_execucao,
        COUNT(n.id) FILTER (WHERE n.status = 'Concluído') as nodes_concluidos,
        COUNT(n.id) as total_nodes_atribuidos
      FROM usuarios u
      LEFT JOIN nodes n ON u.id = n.usuario_id
      GROUP BY u.id, u.nome, u.liberado, u.ativo, u.data_criacao, u.ultimo_acesso
      ORDER BY u.data_criacao DESC
    `);
    
    const exportResult = await exportUsersToExcel(usersResult.rows);
    
    if (!exportResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao gerar arquivo Excel'
      });
    }
    
    // Log da ação
    await logAction(req.user.nome, req.user.userId, 'EXPORT_USUARIOS', {
      total_usuarios: usersResult.rows.length,
      filename: exportResult.filename
    }, req);
    
    res.set({
      'Content-Type': exportResult.contentType,
      'Content-Disposition': `attachment; filename="${exportResult.filename}"`,
      'Content-Length': exportResult.buffer.length
    });
    
    res.send(exportResult.buffer);
    
  } catch (error) {
    console.error('Erro na exportação de usuários:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/admin/template
 * Baixar template para importação
 */
router.get('/template', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const templateResult = await createImportTemplate();
    
    if (!templateResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao gerar template'
      });
    }
    
    res.set({
      'Content-Type': templateResult.contentType,
      'Content-Disposition': `attachment; filename="${templateResult.filename}"`,
      'Content-Length': templateResult.buffer.length
    });
    
    res.send(templateResult.buffer);
    
  } catch (error) {
    console.error('Erro ao gerar template:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/admin/logs
 * Listar logs de auditoria
 */
router.get('/logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { 
      usuario, acao, limit = 50, offset = 0,
      data_inicio, data_fim 
    } = req.query;
    
    let whereConditions = [];
    let queryParams = [];
    let paramCount = 0;
    
    if (usuario) {
      paramCount++;
      whereConditions.push(`(usuario ILIKE $${paramCount} OR usuario_id ILIKE $${paramCount})`);
      queryParams.push(`%${usuario}%`);
    }
    
    if (acao) {
      paramCount++;
      whereConditions.push(`acao ILIKE $${paramCount}`);
      queryParams.push(`%${acao}%`);
    }
    
    if (data_inicio) {
      paramCount++;
      whereConditions.push(`timestamp >= $${paramCount}`);
      queryParams.push(data_inicio);
    }
    
    if (data_fim) {
      paramCount++;
      whereConditions.push(`timestamp <= $${paramCount}`);
      queryParams.push(data_fim);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Paginação
    paramCount++;
    const limitValue = Math.min(parseInt(limit), 200);
    queryParams.push(limitValue);
    
    paramCount++;
    const offsetValue = Math.max(parseInt(offset), 0);
    queryParams.push(offsetValue);
    
    const logsQuery = `
      SELECT usuario, usuario_id, acao, detalhes, ip_address, user_agent, timestamp
      FROM logs 
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT $${paramCount - 1} OFFSET $${paramCount}
    `;
    
    const countQuery = `
      SELECT COUNT(*) as total FROM logs ${whereClause}
    `;
    
    const [logsResult, countResult] = await Promise.all([
      query(logsQuery, queryParams),
      query(countQuery, queryParams.slice(0, -2))
    ]);
    
    res.json({
      success: true,
      data: {
        logs: logsResult.rows,
        pagination: {
          total: parseInt(countResult.rows[0].total),
          limit: limitValue,
          offset: offsetValue,
          hasNext: (offsetValue + limitValue) < parseInt(countResult.rows[0].total)
        }
      }
    });
    
  } catch (error) {
    console.error('Erro ao buscar logs:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * POST /api/admin/nodes/bulk-actions
 * Ações em massa para nodes
 */
router.post('/nodes/bulk-actions', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { action, nodeIds } = req.body;
    
    if (!action || !Array.isArray(nodeIds) || nodeIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Ação e lista de IDs são obrigatórios'
      });
    }
    
    if (nodeIds.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Máximo 100 nodes por operação'
      });
    }
    
    let updateQuery = '';
    let actionMessage = '';
    
    switch (action) {
      case 'activate':
        updateQuery = 'UPDATE nodes SET ativo = true WHERE id = ANY($1)';
        actionMessage = 'ativados';
        break;
      case 'deactivate':
        updateQuery = 'UPDATE nodes SET ativo = false WHERE id = ANY($1)';
        actionMessage = 'desativados';
        break;
      case 'reset':
        updateQuery = `
          UPDATE nodes 
          SET status = 'Disponível', usuario = NULL, usuario_id = NULL, 
              data_inicio = NULL, data_conclusao = NULL, tempo_execucao = NULL
          WHERE id = ANY($1)
        `;
        actionMessage = 'resetados';
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Ação não reconhecida'
        });
    }
    
    const result = await query(updateQuery, [nodeIds]);
    
    // Log da ação
    await logAction(req.user.nome, req.user.userId, 'BULK_ACTION', {
      action: action,
      nodeIds: nodeIds,
      affectedRows: result.rowCount
    }, req);
    
    res.json({
      success: true,
      message: `${result.rowCount} nodes ${actionMessage} com sucesso`,
      data: {
        action: action,
        affectedRows: result.rowCount
      }
    });
    
  } catch (error) {
    console.error('Erro na ação em massa:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;