const jwt = require('jsonwebtoken');
const { query } = require('../db/connection');

// Middleware de autenticação
const authMiddleware = async (req, res, next) => {
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
      
      // Verificar se o usuário ainda existe e está liberado (se não for admin)
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
      
      req.user = decoded;
      next();
    } catch (jwtError) {
      console.error('Erro JWT:', jwtError.message);
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }
  } catch (error) {
    console.error('Erro no middleware de auth:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

// Middleware específico para administradores
const adminMiddleware = (req, res, next) => {
  if (req.user.tipo !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado. Apenas administradores.'
    });
  }
  next();
};

module.exports = {
  authMiddleware,
  adminMiddleware
};