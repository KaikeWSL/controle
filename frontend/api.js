// Configuração da API - Auto-detecta ambiente
const API_BASE_URL = (() => {
    // Em produção no Render, use a URL do backend
    if (window.location.hostname.includes('onrender.com')) {
        return 'https://sistema-nodes-backend.onrender.com/api';
    }
    // Em desenvolvimento local
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3000/api';
    }
    // Fallback para mesmo domínio
    return window.location.origin + '/api';
})();

// Função para fazer requisições HTTP
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    };
    
    // Adicionar token de autenticação se disponível
    const token = localStorage.getItem('authToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    
    try {
        const response = await fetch(url, config);
        
        // Verificar se a resposta é JSON
        const contentType = response.headers.get('content-type');
        let data;
        
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            // Para downloads de arquivos
            data = await response.blob();
        }
        
        if (!response.ok) {
            // Se for erro de autenticação, limpar token e redirecionar
            if (response.status === 401) {
                localStorage.removeItem('authToken');
                localStorage.removeItem('userData');
                window.location.reload();
                return;
            }
            
            throw new Error(data.message || `Erro HTTP: ${response.status}`);
        }
        
        return { success: true, data, response };
        
    } catch (error) {
        console.error(`Erro na requisição ${endpoint}:`, error);
        
        if (!navigator.onLine) {
            throw new Error('Sem conexão com a internet');
        }
        
        throw error;
    }
}

// Funções de autenticação
const authAPI = {
    // Login de usuário
    async loginUser(hardwareId) {
        return await apiRequest('/auth/login-user', {
            method: 'POST',
            body: JSON.stringify({ hardwareId })
        });
    },
    
    // Login de administrador
    async loginAdmin(password) {
        return await apiRequest('/auth/login-admin', {
            method: 'POST',
            body: JSON.stringify({ password })
        });
    },
    
    // Validar token
    async validateToken() {
        return await apiRequest('/auth/validate-token');
    }
};

// Funções para nodes (usuário)
const nodesAPI = {
    // Obter nodes disponíveis
    async getAvailable(filters = {}) {
        const params = new URLSearchParams();
        if (filters.estado) params.append('estado', filters.estado);
        if (filters.cidade) params.append('cidade', filters.cidade);
        
        const query = params.toString() ? `?${params.toString()}` : '';
        return await apiRequest(`/nodes/disponiveis${query}`);
    },
    
    // Pegar um node
    async claimNode(nodeId) {
        return await apiRequest(`/nodes/pegar/${nodeId}`, {
            method: 'POST'
        });
    },
    
    // Concluir um node
    async completeNode(nodeId, observacao = '') {
        return await apiRequest(`/nodes/concluir/${nodeId}`, {
            method: 'PUT',
            body: JSON.stringify({ observacao })
        });
    },
    
    // Obter meus nodes
    async getMyNodes() {
        return await apiRequest('/nodes/meus');
    },
    
    // Obter estatísticas
    async getStatistics() {
        return await apiRequest('/nodes/estatisticas');
    }
};

// Funções para administração
const adminAPI = {
    // Obter métricas
    async getMetrics() {
        return await apiRequest('/admin/metricas');
    },
    
    // Upload de Excel
    async uploadExcel(file, onProgress = null) {
        const formData = new FormData();
        formData.append('excel', file);
        
        return await apiRequest('/admin/upload', {
            method: 'POST',
            headers: {
                // Não definir Content-Type para FormData
            },
            body: formData
        });
    },
    
    // Listar nodes
    async getNodes(filters = {}) {
        const params = new URLSearchParams();
        if (filters.estado) params.append('estado', filters.estado);
        if (filters.cidade) params.append('cidade', filters.cidade);
        if (filters.status) params.append('status', filters.status);
        if (filters.usuario) params.append('usuario', filters.usuario);
        if (filters.page) params.append('page', filters.page);
        if (filters.limit) params.append('limit', filters.limit);
        
        const query = params.toString() ? `?${params.toString()}` : '';
        return await apiRequest(`/admin/nodes${query}`);
    },
    
    // Atualizar node
    async updateNode(nodeId, nodeData) {
        return await apiRequest(`/admin/nodes/${nodeId}`, {
            method: 'PUT',
            body: JSON.stringify(nodeData)
        });
    },
    
    // Deletar node
    async deleteNode(nodeId) {
        return await apiRequest(`/admin/nodes/${nodeId}`, {
            method: 'DELETE'
        });
    },
    
    // Resetar node
    async resetNode(nodeId) {
        return await apiRequest(`/admin/nodes/${nodeId}/resetar`, {
            method: 'POST'
        });
    },
    
    // Exportar todos os dados
    async exportAll() {
        const result = await apiRequest('/admin/export');
        return result.data; // Retorna o blob diretamente
    },
    
    // Exportar dados de hoje
    async exportToday() {
        const result = await apiRequest('/admin/export-hoje');
        return result.data; // Retorna o blob diretamente
    },
    
    // Listar usuários
    async getUsers() {
        return await apiRequest('/admin/usuarios');
    },
    
    // Adicionar usuário
    async addUser(userData) {
        return await apiRequest('/admin/usuarios', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    },
    
    // Atualizar usuário
    async updateUser(userId, userData) {
        return await apiRequest(`/admin/usuarios/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(userData)
        });
    },
    
    // Deletar usuário
    async deleteUser(userId) {
        return await apiRequest(`/admin/usuarios/${userId}`, {
            method: 'DELETE'
        });
    }
};

// Função para obter listas de estados e cidades
async function getStatesAndCities() {
    try {
        // Esta função busca os dados dos nodes para extrair estados e cidades únicos
        const { data } = await adminAPI.getNodes({ limit: 1000 });
        
        const estados = [...new Set(data.nodes.map(node => node.estado))].sort();
        const cidades = [...new Set(data.nodes.map(node => node.cidade))].sort();
        
        return { estados, cidades };
    } catch (error) {
        console.error('Erro ao buscar estados e cidades:', error);
        return { estados: [], cidades: [] };
    }
}

// Função para verificar saúde da API
async function checkAPIHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('Erro ao verificar saúde da API:', error);
        return false;
    }
}

// Função para fazer logout
function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    window.location.reload();
}

// Função para verificar se está autenticado
function isAuthenticated() {
    return !!localStorage.getItem('authToken');
}

// Função para obter dados do usuário logado
function getCurrentUser() {
    const userData = localStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
}

// Função para salvar dados de autenticação
function saveAuthData(token, user) {
    localStorage.setItem('authToken', token);
    localStorage.setItem('userData', JSON.stringify(user));
}

// Interceptador para tratar erros de rede globalmente
window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && event.reason.message) {
        if (event.reason.message.includes('fetch')) {
            console.error('Erro de rede não tratado:', event.reason);
            utils.handleNetworkError(event.reason);
            event.preventDefault();
        }
    }
});

// Export das funções da API
window.api = {
    authAPI,
    nodesAPI,
    adminAPI,
    getStatesAndCities,
    checkAPIHealth,
    logout,
    isAuthenticated,
    getCurrentUser,
    saveAuthData
};