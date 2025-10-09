const express = require('express');
const router = express.Router();

/**
 * Rota de teste super básica
 */
router.get('/ping', (req, res) => {
  res.json({ message: 'pong', timestamp: new Date().toISOString() });
});

/**
 * Rota de login ultra-simples sem dependências
 */
router.post('/login-basic', (req, res) => {
  console.log('📥 Login básico chamado');
  console.log('📦 Body:', req.body);
  
  res.json({
    success: true,
    message: 'Login básico funcionando!',
    data: {
      user: { id: 'test', nome: 'Test User' },
      token: 'fake-token-123'
    }
  });
});

module.exports = router;