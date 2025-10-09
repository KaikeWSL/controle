const express = require('express');
const bcrypt = require('bcryptjs');
const Joi = require('joi');
const { query } = require('../db/connection');
const { generateToken, verifyToken } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * Rota de teste para debug
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Rota de autenticação funcionando!',
    timestamp: new Date().toISOString()
  });
});

/**
 * Rota de teste básica para login
 */
router.post('/test-login', (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Endpoint de login funcionando!',
      received: req.body,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro no teste de login',
      error: error.message
    });
  }
});

/**
 * Schemas de validação
 */
const loginUserSchema = Joi.object({
  hardwareId: Joi.string().required().min(3).max(100)
    .pattern(/^[A-Za-z0-9_-]+$/)
    .messages({
      'string.pattern.base': 'Hardware ID deve conter apenas letras, números, _ e -'
    })
});

const loginAdminSchema = Joi.object({
  password: Joi.string().required().min(1)
});

/**
 * Função para registrar logs de auditoria
 */
const logAction = async (usuario, usuario_id, acao, detalhes, req) => {
  try {
    const detalhesStr = typeof detalhes === 'object' ? JSON.stringify(detalhes) : String(detalhes || '');
    
    await query(
      `INSERT INTO logs (usuario, usuario_id, acao, detalhes, ip_address, user_agent) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        usuario || 'unknown',
        usuario_id || 'unknown',
        acao || 'unknown',
        detalhesStr,
        req?.ip || req?.connection?.remoteAddress || 'unknown',
        req?.get('User-Agent') || 'unknown'
      ]
    );
  } catch (error) {
    // Log de auditoria não deve quebrar o fluxo principal
    console.error('⚠️  Erro ao registrar log de auditoria:', error.message);
  }
};

/**
 * POST /api/auth/login-user-simple
 * Versão simplificada para debug
 */
router.post('/login-user-simple', async (req, res) => {
  try {
    console.log('🔐 LOGIN SIMPLE - Início');
    console.log('📦 Body recebido:', req.body);
    
    const { hardwareId } = req.body;
    
    if (!hardwareId) {
      return res.status(400).json({
        success: false,
        message: 'Hardware ID é obrigatório'
      });
    }
    
    console.log('🆔 Hardware ID:', hardwareId);
    
    // Token fake para teste
    const fakeToken = 'fake-jwt-token-for-testing';
    
    console.log('✅ LOGIN SIMPLE - Sucesso');
    
    res.json({
      success: true,
      message: 'Login teste bem-sucedido!',
      data: {
        user: {
          id: hardwareId,
          nome: `Usuario_${hardwareId.substring(0, 8)}`,
          tipo: 'usuario'
        },
        token: fakeToken
      }
    });
    
  } catch (error) {
    console.error('❌ LOGIN SIMPLE - Erro:', error);
    res.status(500).json({
      success: false,
      message: 'Erro no login simples',
      error: error.message
    });
  }
});

/**
 * POST /api/auth/login-user
 * Login de usuário via Hardware ID
 */
router.post('/login-user', async (req, res) => {
  try {
    console.log('🔐 Tentativa de login de usuário:', req.body);
    
    // Validação básica sem Joi
    const { hardwareId } = req.body;
    
    if (!hardwareId || typeof hardwareId !== 'string') {
      console.log('❌ Hardware ID inválido');
      return res.status(400).json({
        success: false,
        message: 'Hardware ID é obrigatório e deve ser uma string'
      });
    }
    
    if (hardwareId.length < 3 || hardwareId.length > 100) {
      console.log('❌ Hardware ID com tamanho inválido');
      return res.status(400).json({
        success: false,
        message: 'Hardware ID deve ter entre 3 e 100 caracteres'
      });
    }
    
    console.log('🆔 Hardware ID recebido:', hardwareId);
    
    // Verificar se usuário existe
    console.log('🔍 Verificando se usuário existe...');
    const userResult = await query(
      'SELECT id, nome, liberado, ativo FROM usuarios WHERE id = $1',
      [hardwareId]
    );
    
    console.log('📊 Resultado da query:', userResult.rows.length, 'usuários encontrados');
    
    if (userResult.rows.length === 0) {
      console.log('👤 Usuário não encontrado, criando novo usuário...');
      
      // Criar usuário automaticamente (liberado por padrão)
      const novoNome = `Usuario_${hardwareId.substring(0, 8)}`;
      
      console.log('💾 Inserindo novo usuário:', novoNome);
      await query(
        'INSERT INTO usuarios (id, nome, liberado, ativo, data_criacao) VALUES ($1, $2, $3, $4, NOW())',
        [hardwareId, novoNome, true, true]
      );
      
      console.log('✅ Novo usuário criado:', novoNome);
      
      // Gerar token JWT
      const tokenPayload = {
        userId: hardwareId,
        nome: novoNome,
        tipo: 'usuario',
        liberado: true
      };
      
      console.log('🔑 Gerando token JWT...');
      const token = generateToken(tokenPayload);
      
      console.log('✅ Login de novo usuário bem-sucedido');
      return res.json({
        success: true,
        message: `Bem-vindo, ${novoNome}! Conta criada automaticamente.`,
        data: {
          user: {
            id: hardwareId,
            nome: novoNome,
            tipo: 'usuario',
            liberado: true
          },
          token
        }
      });
    }
    
    const user = userResult.rows[0];
    console.log('👤 Usuário encontrado:', user.nome);
    
    if (!user.liberado) {
      return res.status(403).json({
        success: false,
        message: 'Usuário não autorizado. Entre em contato com o administrador.'
      });
    }
    
    if (!user.ativo) {
      return res.status(403).json({
        success: false,
        message: 'Usuário inativo. Entre em contato com o administrador.'
      });
    }
    
    // Gerar token JWT
    const tokenPayload = {
      userId: user.id,
      nome: user.nome,
      tipo: 'usuario',
      liberado: user.liberado
    };
    
    console.log('🔑 Gerando token JWT para usuário existente...');
    const token = generateToken(tokenPayload);
    
    // Atualizar último acesso
    console.log('📝 Atualizando último acesso...');
    await query(
      'UPDATE usuarios SET ultimo_acesso = NOW() WHERE id = $1',
      [hardwareId]
    );
    
    console.log('✅ Login bem-sucedido para:', user.nome);
    res.json({
      success: true,
      message: `Bem-vindo, ${user.nome}!`,
      data: {
        token,
        user: {
          id: user.id,
          nome: user.nome,
          tipo: 'usuario'
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Erro no login de usuário:', error);
    console.error('Stack trace:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/auth/login-admin
 * Login de administrador via senha
 */
router.post('/login-admin', async (req, res) => {
  try {
    // Validar entrada
    const { error, value } = loginAdminSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        details: error.details[0].message
      });
    }
    
    const { password } = value;
    
    // Verificar senha (em produção, use hash)
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (password !== adminPassword) {
      await logAction('Admin', 'ADMIN_ATTEMPT', 'LOGIN_FALHOU', { motivo: 'Senha incorreta' }, req);
      
      return res.status(401).json({
        success: false,
        message: 'Senha incorreta'
      });
    }
    
    // Gerar token JWT para admin
    const tokenPayload = {
      userId: 'ADMIN',
      nome: 'Administrador',
      tipo: 'admin'
    };
    
    const token = generateToken(tokenPayload);
    
    // Registrar log de sucesso
    await logAction('Administrador', 'ADMIN', 'LOGIN_SUCESSO', { tipo: 'admin' }, req);
    
    res.json({
      success: true,
      message: 'Login de administrador realizado com sucesso!',
      data: {
        token,
        user: {
          id: 'ADMIN',
          nome: 'Administrador',
          tipo: 'admin'
        }
      }
    });
    
  } catch (error) {
    console.error('Erro no login de admin:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/auth/validate-token
 * Validar token JWT
 */
router.get('/validate-token', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token não fornecido'
      });
    }
    
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(403).json({
        success: false,
        message: 'Token inválido ou expirado'
      });
    }
    
    // Se for admin, retornar diretamente
    if (decoded.tipo === 'admin') {
      return res.json({
        success: true,
        data: {
          user: {
            id: decoded.userId,
            nome: decoded.nome,
            tipo: decoded.tipo
          },
          valid: true
        }
      });
    }
    
    // Para usuários, verificar se ainda está liberado
    const userResult = await query(
      'SELECT id, nome, liberado, ativo FROM usuarios WHERE id = $1',
      [decoded.userId]
    );
    
    if (userResult.rows.length === 0 || !userResult.rows[0].liberado || !userResult.rows[0].ativo) {
      return res.status(403).json({
        success: false,
        message: 'Usuário não autorizado ou acesso revogado'
      });
    }
    
    res.json({
      success: true,
      data: {
        user: {
          id: decoded.userId,
          nome: decoded.nome,
          tipo: decoded.tipo
        },
        valid: true
      }
    });
    
  } catch (error) {
    console.error('Erro na validação do token:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout (apenas para logs)
 */
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
      const decoded = verifyToken(token);
      if (decoded) {
        await logAction(
          decoded.nome,
          decoded.userId,
          'LOGOUT',
          { tipo: decoded.tipo },
          req
        );
      }
    }
    
    res.json({
      success: true,
      message: 'Logout realizado com sucesso'
    });
    
  } catch (error) {
    console.error('Erro no logout:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/auth/me
 * Obter informações do usuário logado
 */
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token não fornecido'
      });
    }
    
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(403).json({
        success: false,
        message: 'Token inválido'
      });
    }
    
    if (decoded.tipo === 'admin') {
      return res.json({
        success: true,
        data: {
          id: decoded.userId,
          nome: decoded.nome,
          tipo: decoded.tipo
        }
      });
    }
    
    // Para usuários, buscar dados atualizados
    const userResult = await query(
      `SELECT id, nome, liberado, ativo, ultimo_acesso,
              (SELECT COUNT(*) FROM nodes WHERE usuario_id = $1 AND status = 'Em Execução') as nodes_em_execucao,
              (SELECT COUNT(*) FROM nodes WHERE usuario_id = $1 AND status = 'Concluído') as nodes_concluidos
       FROM usuarios WHERE id = $1`,
      [decoded.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    const user = userResult.rows[0];
    
    res.json({
      success: true,
      data: {
        id: user.id,
        nome: user.nome,
        tipo: 'usuario',
        liberado: user.liberado,
        ativo: user.ativo,
        ultimo_acesso: user.ultimo_acesso,
        estatisticas: {
          nodes_em_execucao: parseInt(user.nodes_em_execucao),
          nodes_concluidos: parseInt(user.nodes_concluidos)
        }
      }
    });
    
  } catch (error) {
    console.error('Erro ao obter dados do usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;