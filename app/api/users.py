from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import Usuario
from app.schemas import UsuarioResponse, UsuarioUpdate
import os

router = APIRouter(prefix="/api/users", tags=["Users"])

def verify_admin_password(password: str):
    """
    Verifica se a senha do administrador está correta
    """
    admin_password = os.getenv("ADMIN_PASSWORD", "admin123")
    if password != admin_password:
        raise HTTPException(status_code=401, detail="Senha de administrador incorreta")

@router.get("/pending", response_model=List[UsuarioResponse])
async def get_pending_users(admin_password: str, db: Session = Depends(get_db)):
    """
    Lista usuários pendentes de liberação
    """
    verify_admin_password(admin_password)
    
    users = db.query(Usuario).filter(Usuario.liberado == False).all()
    return users

@router.get("/", response_model=List[UsuarioResponse])
async def get_all_users(admin_password: str, db: Session = Depends(get_db)):
    """
    Lista todos os usuários
    """
    verify_admin_password(admin_password)
    
    users = db.query(Usuario).all()
    return users

@router.put("/{user_id}", response_model=UsuarioResponse)
async def update_user(
    user_id: str, 
    user_update: UsuarioUpdate, 
    admin_password: str,
    db: Session = Depends(get_db)
):
    """
    Atualiza um usuário (libera/bloqueia acesso, muda nome)
    """
    verify_admin_password(admin_password)
    
    user = db.query(Usuario).filter(Usuario.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    if user_update.nome is not None:
        user.nome = user_update.nome
    if user_update.liberado is not None:
        user.liberado = user_update.liberado
    
    db.commit()
    db.refresh(user)
    
    return user

@router.delete("/{user_id}")
async def delete_user(user_id: str, admin_password: str, db: Session = Depends(get_db)):
    """
    Remove um usuário
    """
    verify_admin_password(admin_password)
    
    user = db.query(Usuario).filter(Usuario.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    db.delete(user)
    db.commit()
    
    return {"message": "Usuário removido com sucesso"}