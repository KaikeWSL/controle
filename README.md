[README.md](https://github.com/user-attachments/files/22801166/README.md)
# Sistema de Controle de Dados com Validação e Gerenciamento de Nodes

Sistema web completo de controle de dados com autenticação baseada em hardware ID e gerenciamento de nodes (tarefas) para múltiplos usuários simultâneos.

## 🚀 Funcionalidades

### Para Usuários
- ✅ Autenticação via Hardware ID
- ✅ Visualização de nodes disponíveis
- ✅ Sistema de claim thread-safe (pegar nodes)
- ✅ Gerenciamento de "Meus Nodes"
- ✅ Conclusão de tarefas
- ✅ Interface intuitiva e responsiva

### Para Administradores
- ✅ Autenticação via senha (Projetos151443)
- ✅ Dashboard com métricas em tempo real
- ✅ Upload em massa via Excel
- ✅ CRUD completo de nodes
- ✅ Gerenciamento de usuários
- ✅ Exportação para Excel (Power BI)
- ✅ Logs de auditoria

## 🛠️ Stack Tecnológica

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express
- **Banco**: PostgreSQL (Neon)
- **Autenticação**: JWT + bcrypt
- **Excel**: xlsx + exceljs
- **Hardware ID**: fingerprintjs

## 📋 Pré-requisitos

- Node.js 18+
- npm ou yarn
- PostgreSQL (Neon configurado)

## 🔧 Instalação

### 1. Clone o repositório
```bash
git clone [url-do-repositorio]
cd sistema-controle-nodes
```

### 2. Configure o Backend
```bash
cd backend
npm install
cp .env.example .env
# Configure as variáveis de ambiente no .env
npm run setup-db  # Criar tabelas
npm start
```

### 3. Configure o Frontend
```bash
cd frontend
npm install
npm start
```

## 🌐 Configuração

### Variáveis de Ambiente (.env)
```env
DATABASE_URL=postgresql://neondb_owner:npg_YKokAaJL90db@ep-billowing-wildflower-acyonxuq-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
ADMIN_PASSWORD=Projetos151443
JWT_SECRET=sua_chave_secreta_aqui
PORT=3000
NODE_ENV=development
```

## 📊 Estrutura do Banco

### Tabela: usuarios
```sql
CREATE TABLE usuarios (
    id TEXT PRIMARY KEY,      -- Hardware ID
    nome TEXT,                -- Nome do usuário
    liberado BOOLEAN DEFAULT FALSE
);
```

### Tabela: nodes
```sql
CREATE TABLE nodes (
    id SERIAL PRIMARY KEY,
    estado TEXT,
    cidade TEXT,
    nodes TEXT,
    status TEXT,              -- "Disponível", "Em Execução", "Concluído"
    ativo BOOLEAN DEFAULT TRUE,
    observacao TEXT,
    usuario TEXT,             -- Nome do usuário
    data_inicio TIMESTAMP,
    data_conclusao TIMESTAMP
);
```

### Tabela: logs
```sql
CREATE TABLE logs (
    id SERIAL PRIMARY KEY,
    usuario TEXT,
    acao TEXT,
    detalhes TEXT,
    timestamp TIMESTAMP DEFAULT NOW()
);
```

## 🔐 Autenticação

### Usuários Normais
- Autenticação automática via Hardware ID
- Deve ter `liberado = TRUE` na tabela usuarios

### Administradores
- Senha: `Projetos151443`
- Acesso total ao sistema

## 📱 Uso do Sistema

### Login
1. **Usuário**: Clique em "Entrar como Usuário" - Hardware ID gerado automaticamente
2. **Admin**: Clique em "Entrar como Administrador" - Digite a senha

### Dashboard Usuário
1. Visualize nodes disponíveis agrupados por estado
2. Clique em "Pegar para Executar" para claim um node
3. Execute a tarefa externamente
4. Retorne e clique em "Concluir"

### Dashboard Admin
1. **Métricas**: Visualize estatísticas em tempo real
2. **Upload**: Arraste arquivo Excel (Estado, Cidade, Nodes)
3. **Gerenciar**: Edite nodes e usuários
4. **Exportar**: Baixe dados para Power BI

## 📁 Estrutura de Arquivos

```
sistema-controle-nodes/
├── backend/
│   ├── db/
│   │   ├── connection.js
│   │   └── migrations.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── nodes.js
│   │   └── admin.js
│   ├── middleware/
│   │   ├── authMiddleware.js
│   │   └── adminMiddleware.js
│   ├── utils/
│   │   ├── excelParser.js
│   │   └── excelExporter.js
│   ├── .env
│   ├── server.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Login.tsx
│   │   │   ├── DashboardUser.tsx
│   │   │   ├── DashboardAdmin.tsx
│   │   │   ├── NodeCard.tsx
│   │   │   └── ExcelUpload.tsx
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── utils/
│   │   │   └── hardwareId.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── App.tsx
│   └── package.json
└── README.md
```

## 🔄 API Endpoints

### Autenticação
- `POST /api/auth/login-user` - Login usuário (Hardware ID)
- `POST /api/auth/login-admin` - Login admin (senha)
- `GET /api/auth/validate-token` - Validar token

### Nodes (Usuários)
- `GET /api/nodes/disponiveis` - Listar nodes disponíveis
- `POST /api/nodes/pegar/:id` - Pegar node para execução
- `PUT /api/nodes/concluir/:id` - Marcar node como concluído
- `GET /api/nodes/meus` - Meus nodes em execução

### Admin
- `GET /api/admin/nodes` - Todos os nodes
- `POST /api/admin/nodes/upload` - Upload Excel
- `PUT /api/admin/nodes/:id` - Editar node
- `DELETE /api/admin/nodes/:id` - Deletar node
- `POST /api/admin/nodes/:id/resetar` - Resetar node
- `GET /api/admin/export` - Exportar todos os dados
- `GET /api/admin/export-hoje` - Exportar dados de hoje
- `GET /api/admin/usuarios` - Listar usuários
- `POST /api/admin/usuarios` - Criar usuário
- `PUT /api/admin/usuarios/:id` - Editar usuário
- `DELETE /api/admin/usuarios/:id` - Deletar usuário

## 🧪 Testes

### Teste de Concorrência
```bash
# Simular múltiplos usuários pegando o mesmo node
npm run test:concurrency
```

### Teste de Performance
```bash
# Teste com 1000+ nodes
npm run test:performance
```

## 📈 Monitoramento

- Auto-refresh das listas (10s usuários, 30s admin)
- Logs de auditoria completos
- Métricas em tempo real
- Notificações toast

## 🔒 Segurança

- ✅ Senhas nunca expostas no frontend
- ✅ Prepared statements (SQL injection)
- ✅ JWT com expiração
- ✅ Rate limiting
- ✅ Validação completa de inputs
- ✅ HTTPS obrigatório em produção

## 🚀 Deploy

### Produção
1. Configure variáveis de ambiente
2. Build do frontend: `npm run build`
3. Deploy backend + frontend
4. Configure HTTPS
5. Configure backups do banco

## 📞 Suporte

- **Hardware ID não funciona**: Limpe cache do navegador
- **Node não aparece**: Verifique se status = 'Disponível' e ativo = TRUE
- **Conflito ao pegar node**: Normal - outro usuário pegou primeiro
- **Erro de conexão**: Verifique DATABASE_URL

## 📄 Licença

Sistema proprietário - Todos os direitos reservados
