from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models import Node, Usuario
from app.schemas import NodeCreate, NodeUpdate, NodeResponse
from app.utils import get_device_id
import pandas as pd
import io

router = APIRouter(prefix="/api/nodes", tags=["Nodes"])

def get_current_user(db: Session = Depends(get_db)):
    """
    Middleware para verificar se o usuário está autorizado
    """
    device_id = get_device_id()
    user = db.query(Usuario).filter(Usuario.id == device_id, Usuario.liberado == True).first()
    
    if not user:
        raise HTTPException(status_code=401, detail="Usuário não autorizado")
    
    return user

@router.get("/", response_model=List[NodeResponse])
async def get_all_nodes(
    status: Optional[str] = None,
    grupo: Optional[str] = None,
    usuario_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Lista todos os nodes com filtros opcionais
    """
    query = db.query(Node)
    
    if status:
        query = query.filter(Node.status == status)
    if grupo:
        query = query.filter(Node.grupo == grupo)
    if usuario_id:
        query = query.filter(Node.usuario_id == usuario_id)
    
    nodes = query.all()
    return nodes

@router.get("/available", response_model=List[NodeResponse])
async def get_available_nodes(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Lista nodes disponíveis para execução (status = Ativo)
    """
    nodes = db.query(Node).filter(Node.status == "Ativo", Node.ativo == True).all()
    return nodes

@router.get("/my-nodes", response_model=List[NodeResponse])
async def get_my_nodes(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Lista nodes do usuário atual
    """
    nodes = db.query(Node).filter(Node.usuario_id == current_user.id).all()
    return nodes

@router.post("/", response_model=NodeResponse)
async def create_node(
    node: NodeCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Cria um novo node
    """
    # Verifica se o bloco já existe
    existing_node = db.query(Node).filter(Node.bloco == node.bloco).first()
    if existing_node:
        raise HTTPException(status_code=400, detail="Bloco já existe")
    
    db_node = Node(**node.dict())
    db.add(db_node)
    db.commit()
    db.refresh(db_node)
    
    return db_node

@router.put("/{node_id}", response_model=NodeResponse)
async def update_node(
    node_id: int,
    node_update: NodeUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Atualiza um node
    """
    node = db.query(Node).filter(Node.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node não encontrado")
    
    # Atualiza os campos fornecidos
    update_data = node_update.dict(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(node, field, value)
    
    # Se estiver iniciando a execução
    if node_update.status == "Em andamento" and not node.data_inicio:
        node.data_inicio = datetime.now()
        node.usuario = current_user.nome
        node.usuario_id = current_user.id
    
    # Se estiver concluindo
    if node_update.status == "Concluído" and not node.data_conclusao:
        node.data_conclusao = datetime.now()
    
    db.commit()
    db.refresh(node)
    
    return node

@router.post("/{node_id}/start", response_model=NodeResponse)
async def start_node_execution(
    node_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Inicia a execução de um node
    """
    node = db.query(Node).filter(Node.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node não encontrado")
    
    if node.status != "Ativo":
        raise HTTPException(status_code=400, detail="Node não está disponível para execução")
    
    # Verifica se o usuário já tem outro node em execução
    active_node = db.query(Node).filter(
        Node.usuario_id == current_user.id,
        Node.status == "Em andamento"
    ).first()
    
    if active_node:
        raise HTTPException(
            status_code=400, 
            detail=f"Você já possui o node {active_node.bloco} em execução"
        )
    
    # Inicia a execução
    node.status = "Em andamento"
    node.data_inicio = datetime.now()
    node.usuario = current_user.nome
    node.usuario_id = current_user.id
    
    db.commit()
    db.refresh(node)
    
    return node

@router.post("/{node_id}/complete", response_model=NodeResponse)
async def complete_node_execution(
    node_id: int,
    observacao: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Completa a execução de um node
    """
    node = db.query(Node).filter(Node.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node não encontrado")
    
    if node.usuario_id != current_user.id:
        raise HTTPException(status_code=403, detail="Você não pode completar este node")
    
    if node.status != "Em andamento":
        raise HTTPException(status_code=400, detail="Node não está em execução")
    
    # Completa a execução
    node.status = "Concluído"
    node.data_conclusao = datetime.now()
    if observacao:
        node.observacao = observacao
    
    db.commit()
    db.refresh(node)
    
    return node

@router.delete("/{node_id}")
async def delete_node(
    node_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Remove um node
    """
    node = db.query(Node).filter(Node.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node não encontrado")
    
    db.delete(node)
    db.commit()
    
    return {"message": "Node removido com sucesso"}