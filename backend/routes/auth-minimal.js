const express = require('express');
const router = express.Router();

/**
 * Rota GET de teste
 */
router.get('/status', (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Auth routes funcionando!',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Rota POST ultra-simples
 */
router.post('/test-post', (req, res) => {
  try {
    console.log('🔥 TEST POST chamado');
    console.log('📦 Body recebido:', req.body);
    
    res.json({
      success: true,
      message: 'POST funcionando!',
      received: req.body,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Erro no test-post:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

/**
 * Login mais simples possível
 */
router.post('/login-minimal', (req, res) => {
  try {
    console.log('🔥 LOGIN MINIMAL chamado');
    console.log('📦 Body:', req.body);
    
    const { hardwareId } = req.body;
    
    if (!hardwareId) {
      return res.status(400).json({
        success: false,
        message: 'hardwareId é obrigatório'
      });
    }
    
    // Resposta fake sem banco nem JWT
    res.json({
      success: true,
      message: 'Login minimal ok!',
      data: {
        user: {
          id: hardwareId,
          nome: `User_${hardwareId.substring(0, 5)}`,
          tipo: 'usuario'
        },
        token: 'minimal-fake-token'
      }
    });
    
  } catch (error) {
    console.error('❌ Erro no login-minimal:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

module.exports = router;