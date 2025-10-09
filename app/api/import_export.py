from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, date
from app.database import get_db
from app.models import Node, Usuario
from app.utils import get_device_id
import pandas as pd
import io
import os
import tempfile

router = APIRouter(prefix="/api/import-export", tags=["Import/Export"])

def get_current_user(db: Session = Depends(get_db)):
    """
    Middleware para verificar se o usuário está autorizado
    """
    device_id = get_device_id()
    user = db.query(Usuario).filter(Usuario.id == device_id, Usuario.liberado == True).first()
    
    if not user:
        raise HTTPException(status_code=401, detail="Usuário não autorizado")
    
    return user

@router.post("/import-excel")
async def import_nodes_from_excel(
    file: UploadFile = File(...),
    grupo: str = "Geral",
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Importa nodes de um arquivo Excel
    Formato esperado: Estado, Cidade, Node (ou Bloco)
    """
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Arquivo deve ser Excel (.xlsx ou .xls)")
    
    try:
        # Lê o arquivo Excel
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        # Verifica se as colunas necessárias existem
        required_columns = ['Estado', 'Cidade']
        node_column = None
        
        for col in ['Node', 'Bloco', 'Nó']:
            if col in df.columns:
                node_column = col
                break
        
        if not node_column:
            raise HTTPException(
                status_code=400, 
                detail="Arquivo deve conter as colunas: Estado, Cidade e Node (ou Bloco)"
            )
        
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise HTTPException(
                status_code=400, 
                detail=f"Colunas obrigatórias não encontradas: {missing_columns}"
            )
        
        # Processa os dados
        imported_count = 0
        skipped_count = 0
        errors = []
        
        for index, row in df.iterrows():
            try:
                estado = str(row['Estado']).strip()
                cidade = str(row['Cidade']).strip()
                bloco = str(row[node_column]).strip()
                
                # Pula linhas vazias
                if pd.isna(row['Estado']) or pd.isna(row['Cidade']) or pd.isna(row[node_column]):
                    skipped_count += 1
                    continue
                
                # Verifica se o node já existe
                existing_node = db.query(Node).filter(Node.bloco == bloco).first()
                if existing_node:
                    skipped_count += 1
                    errors.append(f"Linha {index + 2}: Node {bloco} já existe")
                    continue
                
                # Cria novo node
                new_node = Node(
                    estado=estado,
                    cidade=cidade,
                    bloco=bloco,
                    grupo=grupo,
                    status="Ativo",
                    ativo=True
                )
                
                db.add(new_node)
                imported_count += 1
                
            except Exception as e:
                errors.append(f"Linha {index + 2}: {str(e)}")
                skipped_count += 1
        
        db.commit()
        
        return {
            "message": "Importação concluída",
            "imported": imported_count,
            "skipped": skipped_count,
            "errors": errors
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao processar arquivo: {str(e)}")

@router.get("/export-excel")
async def export_nodes_to_excel(
    start_date: str = None,
    end_date: str = None,
    status: str = None,
    grupo: str = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Exporta nodes para Excel com filtros opcionais
    """
    try:
        # Constrói a query
        query = db.query(Node)
        
        # Aplica filtros
        if start_date:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
            query = query.filter(Node.created_at >= start_dt)
        
        if end_date:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
            query = query.filter(Node.created_at <= end_dt)
        
        if status:
            query = query.filter(Node.status == status)
        
        if grupo:
            query = query.filter(Node.grupo == grupo)
        
        nodes = query.all()
        
        # Converte para DataFrame
        data = []
        for node in nodes:
            data.append({
                'ID': node.id,
                'Estado': node.estado,
                'Cidade': node.cidade,
                'Bloco': node.bloco,
                'Status': node.status,
                'Ativo': 'Sim' if node.ativo else 'Não',
                'Usuário': node.usuario or '',
                'Data Início': node.data_inicio.strftime('%d/%m/%Y %H:%M') if node.data_inicio else '',
                'Data Conclusão': node.data_conclusao.strftime('%d/%m/%Y %H:%M') if node.data_conclusao else '',
                'Grupo': node.grupo,
                'Observação': node.observacao or '',
                'Criado em': node.created_at.strftime('%d/%m/%Y %H:%M')
            })
        
        df = pd.DataFrame(data)
        
        # Cria arquivo temporário
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp_file:
            df.to_excel(tmp_file.name, index=False, sheet_name='Nodes')
            tmp_file_path = tmp_file.name
        
        # Nome do arquivo para download
        today = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"nodes_export_{today}.xlsx"
        
        return FileResponse(
            path=tmp_file_path,
            filename=filename,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao exportar dados: {str(e)}")

@router.get("/export-daily")
async def export_daily_report(
    report_date: str = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Exporta relatório diário de atividades
    """
    if not report_date:
        report_date = datetime.now().strftime('%Y-%m-%d')
    
    try:
        report_dt = datetime.strptime(report_date, "%Y-%m-%d").date()
        
        # Busca atividades do dia
        nodes = db.query(Node).filter(
            (Node.data_inicio >= report_dt) | 
            (Node.data_conclusao >= report_dt) |
            (Node.updated_at >= report_dt)
        ).all()
        
        # Estatísticas do dia
        stats = {
            'total_nodes': db.query(Node).count(),
            'ativos': db.query(Node).filter(Node.status == 'Ativo').count(),
            'em_andamento': db.query(Node).filter(Node.status == 'Em andamento').count(),
            'concluidos': db.query(Node).filter(Node.status == 'Concluído').count(),
            'iniciados_hoje': db.query(Node).filter(Node.data_inicio >= report_dt).count(),
            'concluidos_hoje': db.query(Node).filter(Node.data_conclusao >= report_dt).count()
        }
        
        # Cria workbook com múltiplas abas
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp_file:
            with pd.ExcelWriter(tmp_file.name, engine='openpyxl') as writer:
                
                # Aba 1: Atividades do dia
                atividades_data = []
                for node in nodes:
                    atividades_data.append({
                        'Estado': node.estado,
                        'Cidade': node.cidade,
                        'Bloco': node.bloco,
                        'Status': node.status,
                        'Usuário': node.usuario or '',
                        'Data Início': node.data_inicio.strftime('%d/%m/%Y %H:%M') if node.data_inicio else '',
                        'Data Conclusão': node.data_conclusao.strftime('%d/%m/%Y %H:%M') if node.data_conclusao else '',
                        'Grupo': node.grupo,
                        'Observação': node.observacao or ''
                    })
                
                df_atividades = pd.DataFrame(atividades_data)
                df_atividades.to_excel(writer, sheet_name='Atividades', index=False)
                
                # Aba 2: Estatísticas
                df_stats = pd.DataFrame([stats])
                df_stats.to_excel(writer, sheet_name='Estatísticas', index=False)
            
            tmp_file_path = tmp_file.name
        
        filename = f"relatorio_diario_{report_date.replace('-', '')}.xlsx"
        
        return FileResponse(
            path=tmp_file_path,
            filename=filename,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar relatório: {str(e)}")

@router.get("/template-excel")
async def download_import_template():
    """
    Baixa template Excel para importação de nodes
    """
    try:
        # Cria template
        template_data = {
            'Estado': ['SC', 'PR', 'SP'],
            'Cidade': ['NAVEGANTES', 'CURITIBA', 'SÃO PAULO'],
            'Node': ['BL_NAV01', 'BL_CWB01', 'BL_SP01']
        }
        
        df = pd.DataFrame(template_data)
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp_file:
            df.to_excel(tmp_file.name, index=False, sheet_name='Nodes')
            tmp_file_path = tmp_file.name
        
        return FileResponse(
            path=tmp_file_path,
            filename="template_importacao_nodes.xlsx",
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar template: {str(e)}")