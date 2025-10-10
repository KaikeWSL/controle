const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { query } = require('../db/connection');
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

// Login de usuário (Hardware ID)
router.post('/login-user', async (req, res) => {
  try {
    const { hardwareId } = req.body;
    
    if (!hardwareId) {
      return res.status(400).json({
        success: false,
        message: 'Hardware ID é obrigatório'
      });
    }
    
    // Verificar se o usuário existe e está liberado
    const result = await query(
      'SELECT id, nome, liberado FROM usuarios WHERE id = $1 AND liberado = TRUE',
      [hardwareId]
    );
    
    if (result.rows.length === 0) {
      await logAction(hardwareId, 'LOGIN_NEGADO', 'Usuário não encontrado ou não liberado');
      return res.status(401).json({
        success: false,
        message: 'Acesso não autorizado. Entre em contato com o administrador.'
      });
    }
    
    const user = result.rows[0];
    
    // Gerar token JWT
    const token = jwt.sign(
      {
        userId: user.id,
        nome: user.nome,
        tipo: 'usuario',
        liberado: user.liberado
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    await logAction(user.nome, 'LOGIN_USUARIO', 'Login realizado com sucesso');
    
    res.json({
      success: true,
      message: 'Login realizado com sucesso',
      token,
      user: {
        id: user.id,
        nome: user.nome,
        tipo: 'usuario'
      }
    });
    
  } catch (error) {
    console.error('Erro no login do usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Login de administrador (senha)
router.post('/login-admin', async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Senha é obrigatória'
      });
    }
    
    // Verificar senha (em produção, use hash)
    if (password !== process.env.ADMIN_PASSWORD) {
      await logAction('ADMIN', 'LOGIN_ADMIN_NEGADO', 'Senha incorreta');
      return res.status(401).json({
        success: false,
        message: 'Senha incorreta'
      });
    }
    
    // Gerar token JWT para admin
    const token = jwt.sign(
      {
        userId: 'admin',
        nome: 'Administrador',
        tipo: 'admin'
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    await logAction('Administrador', 'LOGIN_ADMIN', 'Login administrativo realizado');
    
    res.json({
      success: true,
      message: 'Login administrativo realizado com sucesso',
      token,
      user: {
        id: 'admin',
        nome: 'Administrador',
        tipo: 'admin'
      }
    });
    
  } catch (error) {
    console.error('Erro no login do admin:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Validar token
router.get('/validate-token', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token não fornecido'
      });
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Se for usuário comum, verificar se ainda está liberado
      if (decoded.tipo === 'usuario') {
        const userResult = await query(
          'SELECT nome, liberado FROM usuarios WHERE id = $1', 
          [decoded.userId]
        );
        
        if (userResult.rows.length === 0 || !userResult.rows[0].liberado) {
          return res.status(401).json({
            success: false,
            message: 'Usuário não autorizado ou acesso revogado'
          });
        }
      }
      
      res.json({
        success: true,
        user: {
          id: decoded.userId,
          nome: decoded.nome,
          tipo: decoded.tipo
        }
      });
      
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }
    
  } catch (error) {
    console.error('Erro na validação do token:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;