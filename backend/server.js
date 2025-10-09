const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Importar conexão com banco e middleware
const { testConnection, closeConnection } = require('./db/connection');
const { runMigrations } = require('./db/migrations');

// Importar rotas
const authRoutes = require('./routes/auth');
const nodesRoutes = require('./routes/nodes');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * Configurações de segurança e middleware
 */

// Helmet para headers de segurança
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false // Desabilitado para desenvolvimento
}));

// Compressão de respostas
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests por IP
  message: {
    success: false,
    message: 'Muitas tentativas. Tente novamente em alguns minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Rate limiting mais rigoroso para login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 tentativas de login por IP
  message: {
    success: false,
    message: 'Muitas tentativas de login. Tente novamente em 15 minutos.'
  },
  skipSuccessfulRequests: true,
});

// CORS
const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requisições sem origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Lista de origens permitidas
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://controle-1-8qb9.onrender.com',
      'https://controle-7cfq.onrender.com'
    ];
    
    // Em produção, permitir qualquer origem do Render
    if (process.env.NODE_ENV === 'production' && origin.includes('.onrender.com')) {
      return callback(null, true);
    }
    
    // Verificar se a origem está na lista permitida
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('❌ Origem bloqueada pelo CORS:', origin);
      callback(new Error('Não permitido pelo CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Middleware adicional para resolver CORS em produção
app.use((req, res, next) => {
  const origin = req.get('Origin');
  
  // Se a origem é do Render, permitir explicitamente
  if (origin && origin.includes('.onrender.com')) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  }
  
  // Responder a preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Middleware para log de debugging 
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Origin: ${req.get('Origin') || 'none'}`);
  next();
});

// Trust proxy (para rate limiting correto atrás de reverse proxy)
app.set('trust proxy', 1);

/**
 * Middleware para capturar IP real
 */
app.use((req, res, next) => {
  req.realIP = req.ip || 
              req.connection.remoteAddress || 
              req.socket.remoteAddress ||
              (req.connection.socket ? req.connection.socket.remoteAddress : null);
  next();
});

/**
 * Rotas da API
 */

// Rota raiz para teste
app.get('/', (req, res) => {
  res.json({
    message: 'Sistema de Controle de Nodes - API funcionando!',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      nodes: '/api/nodes',
      admin: '/api/admin'
    }
  });
});

// Rota de health check
app.get('/api/health', async (req, res) => {
  try {
    const dbConnected = await testConnection();
    
    res.json({
      success: true,
      status: 'OK',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: dbConnected ? 'Connected' : 'Disconnected',
      environment: process.env.NODE_ENV || 'development',
      uptime: Math.floor(process.uptime())
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'Service Unavailable',
      message: 'Erro na verificação de saúde do serviço'
    });
  }
});

// Aplicar rate limiting específico para rotas de login
app.use('/api/auth/login-user', loginLimiter);
app.use('/api/auth/login-admin', loginLimiter);

// Rotas principais
app.use('/api/auth', authRoutes);
app.use('/api/nodes', nodesRoutes);
app.use('/api/admin', adminRoutes);

// Rota raiz
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Sistema de Controle de Nodes - API',
    version: '1.0.0',
    documentation: '/api/docs',
    healthCheck: '/api/health'
  });
});

/**
 * Middleware de tratamento de erros
 */

// Middleware para rotas não encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Rota não encontrada',
    path: req.originalUrl,
    method: req.method
  });
});

// Middleware global de tratamento de erros
app.use((error, req, res, next) => {
  console.error('Erro não tratado:', error);
  
  // Erro de validação do Multer (upload)
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'Arquivo muito grande. Tamanho máximo: 10MB'
    });
  }
  
  if (error.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({
      success: false,
      message: 'Muitos arquivos. Máximo: 1 arquivo'
    });
  }
  
  // Erro de JSON malformado
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'JSON inválido'
    });
  }
  
  // Erro de conexão com banco
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return res.status(503).json({
      success: false,
      message: 'Serviço temporariamente indisponível'
    });
  }
  
  // Erro genérico
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'development' 
      ? error.message 
      : 'Erro interno do servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

/**
 * Funções de inicialização e finalização
 */

const startServer = async () => {
  try {
    console.log('🚀 Iniciando Sistema de Controle de Nodes...\n');
    
    // Testar conexão com banco de dados
    console.log('📊 Testando conexão com banco de dados...');
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.error('❌ Falha na conexão com banco de dados');
      console.error('💡 Verifique as configurações no arquivo .env');
      process.exit(1);
    }
    
    // Executar migrações (criar tabelas)
    console.log('🔧 Executando migrações do banco de dados...');
    await runMigrations();
    console.log('✅ Migrações executadas com sucesso!');
    
    // Iniciar servidor
    const server = app.listen(PORT, () => {
      console.log('\n🎉 Servidor iniciado com sucesso!');
      console.log(`📍 URL: http://localhost:${PORT}`);
      console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔒 CORS habilitado para múltiplas origens (desenvolvimento + *.onrender.com)`);
      console.log(`📱 Frontend esperado: https://controle-1-8qb9.onrender.com`);
      console.log('\n📋 Endpoints disponíveis:');
      console.log('  🔐 Autenticação: /api/auth');
      console.log('  📦 Nodes (usuários): /api/nodes');
      console.log('  ⚙️  Admin: /api/admin');
      console.log('  ❤️  Health Check: /api/health');
      console.log('\n✅ Sistema pronto para uso!\n');
    });
    
    // Configurar graceful shutdown
    const gracefulShutdown = async (signal) => {
      console.log(`\n🛑 Recebido sinal ${signal}. Iniciando shutdown graceful...`);
      
      // Parar de aceitar novas conexões
      server.close(async () => {
        console.log('🔌 Servidor HTTP fechado');
        
        try {
          // Fechar conexões com banco
          await closeConnection();
          console.log('✅ Shutdown concluído com sucesso');
          process.exit(0);
        } catch (error) {
          console.error('❌ Erro durante shutdown:', error);
          process.exit(1);
        }
      });
      
      // Forçar saída após 30 segundos
      setTimeout(() => {
        console.error('⏰ Timeout no shutdown. Forçando saída...');
        process.exit(1);
      }, 30000);
    };
    
    // Registrar handlers para sinais de sistema
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Registrar handler para exceções não tratadas
    process.on('uncaughtException', (error) => {
      console.error('💥 Exceção não tratada:', error);
      gracefulShutdown('uncaughtException');
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 Promise rejeitada não tratada:', reason);
      console.error('   Promise:', promise);
      gracefulShutdown('unhandledRejection');
    });
    
  } catch (error) {
    console.error('💥 Erro ao iniciar servidor:', error);
    process.exit(1);
  }
};

/**
 * Validar variáveis de ambiente obrigatórias
 */
const validateEnvironment = () => {
  const required = ['DATABASE_URL', 'JWT_SECRET', 'ADMIN_PASSWORD'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Variáveis de ambiente obrigatórias não configuradas:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\n💡 Configure no arquivo .env e tente novamente\n');
    process.exit(1);
  }
  
  // Validar JWT_SECRET
  if (process.env.JWT_SECRET.length < 32) {
    console.error('❌ JWT_SECRET deve ter pelo menos 32 caracteres');
    process.exit(1);
  }
  
  console.log('✅ Variáveis de ambiente validadas');
};

// Iniciar aplicação
if (require.main === module) {
  validateEnvironment();
  startServer();
}

module.exports = app;