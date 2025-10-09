import uuid
import platform
import hashlib

def get_device_id():
    """
    Gera um ID único baseado no hardware do dispositivo
    """
    try:
        # Tenta obter o MAC address
        mac = uuid.getnode()
        
        # Adiciona informações do sistema para tornar mais único
        system_info = f"{platform.node()}-{platform.system()}-{platform.processor()}"
        
        # Cria um hash único
        unique_string = f"{mac}-{system_info}"
        device_id = hashlib.md5(unique_string.encode()).hexdigest()[:12].upper()
        
        return device_id
    except Exception:
        # Fallback para um UUID simples
        return str(uuid.uuid4())[:12].upper()

def format_device_id(device_id: str) -> str:
    """
    Formata o device ID para exibição
    """
    return device_id.upper()