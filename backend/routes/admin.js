const express = require('express');
const multer = require('multer');
const { query } = require('../db/connection');
const { authMiddleware, adminMiddleware } = require('../middleware/authMiddleware');
const { parseExcelFile } = require('../utils/excelParser');
const { exportToExcel, formatDataForExport } = require('../utils/excelExporter');
const router = express.Router();

// Configurar multer para upload de arquivos
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
        file.originalname.endsWith('.xlsx')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos .xlsx são permitidos'));
    }
  }
});

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

// Aplicar middlewares de autenticação e admin
router.use(authMiddleware);
router.use(adminMiddleware);

// Dashboard - obter métricas
router.get('/metricas', async (req, res) => {
  try {
    // Total de nodes
    const total = await query('SELECT COUNT(*) FROM nodes');
    
    // Disponíveis
    const disponiveis = await query(
      "SELECT COUNT(*) FROM nodes WHERE status = 'Disponível' AND ativo = TRUE"
    );
    
    // Em execução
    const emExecucao = await query(
      "SELECT COUNT(*) FROM nodes WHERE status = 'Em Execução'"
    );
    
    // Concluídos
    const concluidos = await query(
      "SELECT COUNT(*) FROM nodes WHERE status = 'Concluído'"
    );
    
    // Por usuário
    const porUsuario = await query(
      "SELECT usuario, COUNT(*) as count FROM nodes WHERE status = 'Em Execução' GROUP BY usuario ORDER BY count DESC"
    );
    
    // Hoje
    const hoje = await query(
      "SELECT COUNT(*) FROM nodes WHERE DATE(data_inicio) = CURRENT_DATE OR DATE(data_conclusao) = CURRENT_DATE"
    );
    
    res.json({
      success: true,
      metricas: {
        total: parseInt(total.rows[0].count),
        disponiveis: parseInt(disponiveis.rows[0].count),
        emExecucao: parseInt(emExecucao.rows[0].count),
        concluidos: parseInt(concluidos.rows[0].count),
        hoje: parseInt(hoje.rows[0].count),
        porUsuario: porUsuario.rows
      }
    });
    
  } catch (error) {
    console.error('Erro ao buscar métricas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar métricas'
    });
  }
});

// Upload de Excel com nodes
router.post('/upload', upload.single('excel'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Arquivo Excel é obrigatório'
      });
    }
    
    // Parse do arquivo Excel
    const parseResult = parseExcelFile(req.file.buffer);
    
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: parseResult.error
      });
    }
    
    const { nodes, errors } = parseResult;
    
    if (nodes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum node válido encontrado no arquivo'
      });
    }
    
    // Inserir nodes no banco
    let insertedCount = 0;
    const insertErrors = [];
    
    for (const node of nodes) {
      try {
        await query(
          'INSERT INTO nodes (estado, cidade, nodes, status, ativo) VALUES ($1, $2, $3, $4, $5)',
          [node.estado, node.cidade, node.nodes, 'Disponível', true]
        );
        insertedCount++;
      } catch (insertError) {
        insertErrors.push({
          node,
          error: insertError.message
        });
      }
    }
    
    await logAction(req.user.nome, 'UPLOAD_EXCEL', 
      `Upload de ${insertedCount} nodes. Erros: ${insertErrors.length}`);
    
    res.json({
      success: true,
      message: `Upload concluído! ${insertedCount} nodes cadastrados.`,
      resultado: {
        totalProcessado: nodes.length,
        inseridos: insertedCount,
        errosValidacao: errors.length,
        errosInsercao: insertErrors.length,
        errosValidacao: errors,
        errosInsercao: insertErrors
      }
    });
    
  } catch (error) {
    console.error('Erro no upload:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Listar todos os nodes (com filtros)
router.get('/nodes', async (req, res) => {
  try {
    const { estado, cidade, status, usuario, page = 1, limit = 50 } = req.query;
    
    let queryText = `
      SELECT id, estado, cidade, nodes, status, ativo, observacao, usuario, 
             data_inicio, data_conclusao, data_criacao
      FROM nodes 
      WHERE 1=1
    `;
    const queryParams = [];
    
    // Aplicar filtros
    if (estado) {
      queryParams.push(estado);
      queryText += ` AND estado = $${queryParams.length}`;
    }
    
    if (cidade) {
      queryParams.push(cidade);
      queryText += ` AND cidade = $${queryParams.length}`;
    }
    
    if (status) {
      queryParams.push(status);
      queryText += ` AND status = $${queryParams.length}`;
    }
    
    if (usuario) {
      queryParams.push(usuario);
      queryText += ` AND usuario = $${queryParams.length}`;
    }
    
    // Ordenação e paginação
    queryText += ' ORDER BY data_criacao DESC';
    
    const offset = (page - 1) * limit;
    queryParams.push(limit, offset);
    queryText += ` LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`;
    
    const result = await query(queryText, queryParams);
    
    // Contar total (para paginação)
    let countQuery = `SELECT COUNT(*) FROM nodes WHERE 1=1`;
    const countParams = [];
    
    if (estado) {
      countParams.push(estado);
      countQuery += ` AND estado = $${countParams.length}`;
    }
    if (cidade) {
      countParams.push(cidade);
      countQuery += ` AND cidade = $${countParams.length}`;
    }
    if (status) {
      countParams.push(status);
      countQuery += ` AND status = $${countParams.length}`;
    }
    if (usuario) {
      countParams.push(usuario);
      countQuery += ` AND usuario = $${countParams.length}`;
    }
    
    const countResult = await query(countQuery, countParams);
    
    res.json({
      success: true,
      nodes: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
    
  } catch (error) {
    console.error('Erro ao listar nodes:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar nodes'
    });
  }
});

// Atualizar node
router.put('/nodes/:id', async (req, res) => {
  try {
    const nodeId = req.params.id;
    const { estado, cidade, nodes, status, ativo, observacao, usuario } = req.body;
    
    const result = await query(
      `UPDATE nodes 
       SET estado = $1, cidade = $2, nodes = $3, status = $4, ativo = $5, observacao = $6, usuario = $7
       WHERE id = $8
       RETURNING *`,
      [estado, cidade, nodes, status, ativo, observacao, usuario, nodeId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Node não encontrado'
      });
    }
    
    await logAction(req.user.nome, 'UPDATE_NODE', `Node ID ${nodeId} atualizado`);
    
    res.json({
      success: true,
      message: 'Node atualizado com sucesso',
      node: result.rows[0]
    });
    
  } catch (error) {
    console.error('Erro ao atualizar node:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar node'
    });
  }
});

// Deletar node
router.delete('/nodes/:id', async (req, res) => {
  try {
    const nodeId = req.params.id;
    
    const result = await query('DELETE FROM nodes WHERE id = $1 RETURNING *', [nodeId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Node não encontrado'
      });
    }
    
    await logAction(req.user.nome, 'DELETE_NODE', `Node ID ${nodeId} deletado`);
    
    res.json({
      success: true,
      message: 'Node deletado com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao deletar node:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar node'
    });
  }
});

// Resetar node (liberar)
router.post('/nodes/:id/resetar', async (req, res) => {
  try {
    const nodeId = req.params.id;
    
    const result = await query(
      `UPDATE nodes 
       SET status = 'Disponível', usuario = NULL, data_inicio = NULL, data_conclusao = NULL, observacao = NULL
       WHERE id = $1
       RETURNING *`,
      [nodeId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Node não encontrado'
      });
    }
    
    await logAction(req.user.nome, 'RESET_NODE', `Node ID ${nodeId} resetado`);
    
    res.json({
      success: true,
      message: 'Node resetado com sucesso',
      node: result.rows[0]
    });
    
  } catch (error) {
    console.error('Erro ao resetar node:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao resetar node'
    });
  }
});

// Exportar todos os dados
router.get('/export', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM nodes ORDER BY data_criacao DESC'
    );
    
    const formattedData = formatDataForExport(result.rows);
    const exportResult = exportToExcel(formattedData, `nodes_export_${new Date().toISOString().slice(0, 10)}`);
    
    if (!exportResult.success) {
      throw new Error(exportResult.error);
    }
    
    await logAction(req.user.nome, 'EXPORT_ALL', `Exportação de ${result.rows.length} nodes`);
    
    res.setHeader('Content-Type', exportResult.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
    res.send(exportResult.buffer);
    
  } catch (error) {
    console.error('Erro na exportação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao exportar dados'
    });
  }
});

// Exportar dados de hoje
router.get('/export-hoje', async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM nodes 
       WHERE DATE(data_inicio) = CURRENT_DATE 
          OR DATE(data_conclusao) = CURRENT_DATE
       ORDER BY data_inicio DESC, data_conclusao DESC`
    );
    
    const formattedData = formatDataForExport(result.rows);
    const exportResult = exportToExcel(formattedData, `nodes_hoje_${new Date().toISOString().slice(0, 10)}`);
    
    if (!exportResult.success) {
      throw new Error(exportResult.error);
    }
    
    await logAction(req.user.nome, 'EXPORT_TODAY', `Exportação de ${result.rows.length} nodes de hoje`);
    
    res.setHeader('Content-Type', exportResult.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
    res.send(exportResult.buffer);
    
  } catch (error) {
    console.error('Erro na exportação de hoje:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao exportar dados de hoje'
    });
  }
});

// CRUD de usuários
// Listar usuários
router.get('/usuarios', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, nome, liberado, data_criacao FROM usuarios ORDER BY nome'
    );
    
    res.json({
      success: true,
      usuarios: result.rows
    });
    
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar usuários'
    });
  }
});

// Adicionar usuário
router.post('/usuarios', async (req, res) => {
  try {
    const { id, nome, liberado = false } = req.body;
    
    if (!id || !nome) {
      return res.status(400).json({
        success: false,
        message: 'ID e nome são obrigatórios'
      });
    }
    
    const result = await query(
      'INSERT INTO usuarios (id, nome, liberado) VALUES ($1, $2, $3) RETURNING *',
      [id, nome, liberado]
    );
    
    await logAction(req.user.nome, 'ADD_USER', `Usuário ${nome} (${id}) adicionado`);
    
    res.json({
      success: true,
      message: 'Usuário adicionado com sucesso',
      usuario: result.rows[0]
    });
    
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      res.status(409).json({
        success: false,
        message: 'ID de usuário já existe'
      });
    } else {
      console.error('Erro ao adicionar usuário:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao adicionar usuário'
      });
    }
  }
});

// Atualizar usuário
router.put('/usuarios/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const { nome, liberado } = req.body;
    
    const result = await query(
      'UPDATE usuarios SET nome = $1, liberado = $2 WHERE id = $3 RETURNING *',
      [nome, liberado, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    await logAction(req.user.nome, 'UPDATE_USER', `Usuário ${userId} atualizado`);
    
    res.json({
      success: true,
      message: 'Usuário atualizado com sucesso',
      usuario: result.rows[0]
    });
    
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar usuário'
    });
  }
});

// Deletar usuário
router.delete('/usuarios/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    
    const result = await query('DELETE FROM usuarios WHERE id = $1 RETURNING *', [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    await logAction(req.user.nome, 'DELETE_USER', `Usuário ${userId} deletado`);
    
    res.json({
      success: true,
      message: 'Usuário deletado com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao deletar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar usuário'
    });
  }
});

module.exports = router;