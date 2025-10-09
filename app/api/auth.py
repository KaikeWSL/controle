from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Usuario
from app.schemas import UsuarioCreate, UsuarioUpdate, UsuarioResponse, DeviceInfo, AuthResponse
from app.utils import get_device_id

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/check-device", response_model=AuthResponse)
async def check_device_authorization(request: Request, db: Session = Depends(get_db)):
    """
    Verifica se o dispositivo está autorizado
    """
    # Obtém o device ID
    device_id = get_device_id()
    
    # Busca o usuário no banco
    user = db.query(Usuario).filter(Usuario.id == device_id).first()
    
    if not user:
        # Registra o novo dispositivo como não liberado
        new_user = Usuario(id=device_id, nome="", liberado=False)
        db.add(new_user)
        db.commit()
        
        return AuthResponse(
            authorized=False,
            message=f"Dispositivo não autorizado. Envie o código {device_id} para o administrador."
        )
    
    if not user.liberado:
        return AuthResponse(
            authorized=False,
            message=f"Dispositivo pendente de liberação. Código: {device_id}"
        )
    
    return AuthResponse(
        authorized=True,
        user_name=user.nome,
        message="Acesso autorizado"
    )

@router.get("/device-id")
async def get_current_device_id():
    """
    Retorna o ID do dispositivo atual
    """
    return {"device_id": get_device_id()}

@router.post("/register", response_model=UsuarioResponse)
async def register_device(user_data: UsuarioCreate, db: Session = Depends(get_db)):
    """
    Registra um novo dispositivo (usado pelo admin)
    """
    user = db.query(Usuario).filter(Usuario.id == user_data.id).first()
    
    if user:
        # Atualiza usuário existente
        user.nome = user_data.nome
        user.liberado = True
    else:
        # Cria novo usuário
        user = Usuario(id=user_data.id, nome=user_data.nome, liberado=True)
        db.add(user)
    
    db.commit()
    db.refresh(user)
    
    return user