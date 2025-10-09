from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class UsuarioCreate(BaseModel):
    id: str
    nome: str

class UsuarioUpdate(BaseModel):
    nome: Optional[str] = None
    liberado: Optional[bool] = None

class UsuarioResponse(BaseModel):
    id: str
    nome: str
    liberado: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class NodeCreate(BaseModel):
    estado: str
    cidade: str
    bloco: str
    grupo: Optional[str] = "Geral"

class NodeUpdate(BaseModel):
    status: Optional[str] = None
    observacao: Optional[str] = None
    data_inicio: Optional[datetime] = None
    data_conclusao: Optional[datetime] = None

class NodeResponse(BaseModel):
    id: int
    estado: str
    cidade: str
    bloco: str
    status: str
    ativo: bool
    observacao: Optional[str]
    usuario: Optional[str]
    usuario_id: Optional[str]
    data_inicio: Optional[datetime]
    data_conclusao: Optional[datetime]
    grupo: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class DeviceInfo(BaseModel):
    device_id: str
    
class AuthResponse(BaseModel):
    authorized: bool
    user_name: Optional[str] = None
    message: str