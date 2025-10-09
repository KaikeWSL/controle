from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.sql import func
from app.database import Base

class Usuario(Base):
    __tablename__ = "usuarios"
    
    id = Column(String, primary_key=True)  # Device ID
    nome = Column(String, nullable=False)
    liberado = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Node(Base):
    __tablename__ = "nodes"
    
    id = Column(Integer, primary_key=True, index=True)
    estado = Column(String, nullable=False)
    cidade = Column(String, nullable=False)
    bloco = Column(String, nullable=False, unique=True)
    status = Column(String, default="Ativo")  # Ativo, Em andamento, Concluído
    ativo = Column(Boolean, default=True)
    observacao = Column(Text)
    usuario = Column(String)  # Nome do usuário executando
    usuario_id = Column(String)  # Device ID do usuário
    data_inicio = Column(DateTime(timezone=True))
    data_conclusao = Column(DateTime(timezone=True))
    grupo = Column(String, default="Geral")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())