from fastapi import FastAPI, Request, Depends
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.database import get_db, create_tables
from app.api import auth, users, nodes, import_export
from app.models import Usuario
from app.utils import get_device_id

# Criar aplicação FastAPI
app = FastAPI(
    title="Sistema de Gerenciamento de Nodes",
    description="Sistema para gerenciamento de execução de nodes com autenticação por Device ID",
    version="1.0.0"
)

# Configurar templates e arquivos estáticos
templates = Jinja2Templates(directory="app/templates")
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# Incluir routers da API
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(nodes.router)
app.include_router(import_export.router)

# Criar tabelas no banco de dados
@app.on_event("startup")
async def startup_event():
    create_tables()

# Middleware para verificar autorização nas rotas protegidas
@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    # Rotas que não precisam de autenticação
    public_paths = [
        "/", "/admin", "/api/auth/", "/api/users/", 
        "/static/", "/docs", "/openapi.json", "/redoc"
    ]
    
    # Verifica se é uma rota pública
    is_public = any(request.url.path.startswith(path) for path in public_paths)
    
    if not is_public:
        # Para rotas protegidas, verifica se o usuário está autorizado
        # (implementação simplificada - em produção, usar sistema de tokens)
        pass
    
    response = await call_next(request)
    return response

# Rotas de interface web
@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    """Página principal - Dashboard"""
    return templates.TemplateResponse("dashboard.html", {"request": request})

@app.get("/admin", response_class=HTMLResponse)
async def admin_panel(request: Request):
    """Painel administrativo"""
    return templates.TemplateResponse("admin.html", {"request": request})

@app.get("/available", response_class=HTMLResponse)
async def available_nodes(request: Request):
    """Página de nodes disponíveis"""
    return templates.TemplateResponse("available_nodes.html", {"request": request})

@app.get("/nodes", response_class=HTMLResponse)
async def my_nodes(request: Request):
    """Página dos meus nodes"""
    return templates.TemplateResponse("my_nodes.html", {"request": request})

# Rota de healthcheck
@app.get("/health")
async def health_check():
    """Verificação de saúde da aplicação"""
    return {"status": "healthy", "message": "Sistema funcionando normalmente"}

# Rota de informações da API
@app.get("/info")
async def app_info():
    """Informações da aplicação"""
    return {
        "name": "Sistema de Gerenciamento de Nodes",
        "version": "1.0.0",
        "description": "Sistema para gerenciamento de execução de nodes com autenticação por Device ID"
    }

if __name__ == "__main__":
    import uvicorn
    import os
    
    # Configurações do servidor
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    debug = os.getenv("DEBUG", "True").lower() == "true"
    
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=debug,
        log_level="info"
    )