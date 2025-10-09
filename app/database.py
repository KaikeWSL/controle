import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Carrega variáveis de ambiente apenas se não estiver em produção (Render)
if not os.getenv("RENDER"):
    load_dotenv()

# URL do banco de dados - Render fornece automaticamente
DATABASE_URL = os.getenv("DATABASE_URL")

# Fallback para desenvolvimento local
if not DATABASE_URL:
    DATABASE_URL = "postgresql://user:password@localhost/nodemanagement"
    print("⚠️ Usando banco de dados local de desenvolvimento")

# Configuração do SQLAlchemy
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_tables():
    """Cria as tabelas no banco de dados"""
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Tabelas criadas com sucesso")
    except Exception as e:
        print(f"❌ Erro ao criar tabelas: {e}")

def test_connection():
    """Testa a conexão com o banco de dados"""
    try:
        with engine.connect() as connection:
            result = connection.execute("SELECT 1")
            print("✅ Conexão com banco de dados estabelecida")
            return True
    except Exception as e:
        print(f"❌ Erro na conexão com banco: {e}")
        return False