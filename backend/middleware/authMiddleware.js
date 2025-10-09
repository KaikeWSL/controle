const jwt = require('jsonwebtoken');
const { query } = require('../db/connection');

/**
 * Middleware para verificar autenticação JWT
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token de acesso não fornecido'
      });
    }
    
    // Verificar e decodificar o token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verificar se é admin ou usuário comum
    if (decoded.tipo === 'admin') {
      req.user = decoded;
      return next();
    }
    
    // Para usuários comuns, verificar se ainda está liberado
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
    
    // Atualizar último acesso
    await query(
      'UPDATE usuarios SET ultimo_acesso = NOW() WHERE id = $1',
      [decoded.userId]
    );
    
    req.user = {
      ...decoded,
      ...userResult.rows[0]
    };
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({
        success: false,
        message: 'Token inválido'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({
        success: false,
        message: 'Token expirado'
      });
    }
    
    console.error('Erro no middleware de autenticação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

/**
 * Middleware específico para administradores
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.tipo !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Acesso restrito a administradores'
    });
  }
  next();
};

/**
 * Middleware para verificar se é usuário comum
 */
const requireUser = (req, res, next) => {
  if (!req.user || req.user.tipo !== 'usuario') {
    return res.status(403).json({
      success: false,
      message: 'Acesso restrito a usuários autenticados'
    });
  }
  next();
};

/**
 * Middleware opcional de autenticação (não obrigatório)
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    }
    
    next();
  } catch (error) {
    // Ignorar erros de token em autenticação opcional
    next();
  }
};

/**
 * Gerar token JWT
 */
const generateToken = (payload) => {
  return jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

/**
 * Verificar token sem middleware (para validação)
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireUser,
  optionalAuth,
  generateToken,
  verifyToken
};