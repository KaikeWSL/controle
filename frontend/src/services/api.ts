import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import type {
  ApiResponse,
  AuthResponse,
  LoginUserRequest,
  LoginAdminRequest,
  User,
  NodesResponse,
  Node,
  DashboardData,
  Usuario,
  UsuarioCreateRequest,
  UsuarioUpdateRequest,
  ExcelParseResult,
  LogEntry,
  NodesFilters,
  UsuariosFilters,
  LogsFilters,
  BulkActionRequest,
  BulkActionResponse,
  NodeUpdateForm,
  EstatisticasUsuario,
  ApiError
} from '../types';

class ApiService {
  private api: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Interceptor para adicionar token automaticamente
    this.api.interceptors.request.use(
      (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Interceptor para tratar respostas
    this.api.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        // Se token expirou, limpar token local
        if (error.response?.status === 401 || error.response?.status === 403) {
          this.setToken(null);
          // Redirecionar para login se necessário
          if (window.location.pathname !== '/') {
            window.location.href = '/';
          }
        }
        return Promise.reject(this.handleError(error));
      }
    );

    // Carregar token do localStorage
    this.loadToken();
  }

  private handleError(error: AxiosError): ApiError {
    if (error.response?.data) {
      const data = error.response.data as any;
      return {
        message: data.message || 'Erro na requisição',
        status: error.response.status,
        details: data.details
      };
    }

    if (error.code === 'ECONNABORTED') {
      return {
        message: 'Timeout na requisição. Tente novamente.',
        status: 408
      };
    }

    if (!error.response) {
      return {
        message: 'Erro de conexão. Verifique sua internet.',
        status: 0
      };
    }

    return {
      message: error.message || 'Erro desconhecido',
      status: error.response?.status
    };
  }

  // Gerenciamento de token
  setToken(token: string | null): void {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private loadToken(): void {
    const savedToken = localStorage.getItem('auth_token');
    if (savedToken) {
      this.token = savedToken;
    }
  }

  // Métodos de autenticação
  async loginUser(credentials: LoginUserRequest): Promise<AuthResponse> {
    const response: AxiosResponse<AuthResponse> = await this.api.post('/auth/login-user', credentials);
    
    if (response.data.success && response.data.data?.token) {
      this.setToken(response.data.data.token);
    }
    
    return response.data;
  }

  async loginAdmin(credentials: LoginAdminRequest): Promise<AuthResponse> {
    const response: AxiosResponse<AuthResponse> = await this.api.post('/auth/login-admin', credentials);
    
    if (response.data.success && response.data.data?.token) {
      this.setToken(response.data.data.token);
    }
    
    return response.data;
  }

  async validateToken(): Promise<ApiResponse<{ user: User; valid: boolean }>> {
    const response = await this.api.get('/auth/validate-token');
    return response.data;
  }

  async getUserInfo(): Promise<ApiResponse<User>> {
    const response = await this.api.get('/auth/me');
    return response.data;
  }

  async logout(): Promise<void> {
    try {
      await this.api.post('/auth/logout');
    } finally {
      this.setToken(null);
    }
  }

  // Métodos para nodes (usuários)
  async getNodesDisponiveis(filters?: Partial<NodesFilters>): Promise<ApiResponse<NodesResponse>> {
    const params = new URLSearchParams();
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }
    
    const response = await this.api.get(`/nodes/disponiveis?${params.toString()}`);
    return response.data;
  }

  async claimNode(nodeId: number): Promise<ApiResponse<{ node: Node }>> {
    const response = await this.api.post(`/nodes/pegar/${nodeId}`);
    return response.data;
  }

  async completeNode(nodeId: number, observacao?: string): Promise<ApiResponse<{ node: Node; tempo_execucao: number }>> {
    const response = await this.api.put(`/nodes/concluir/${nodeId}`, {
      observacao: observacao || ''
    });
    return response.data;
  }

  async getMyNodes(status?: string): Promise<ApiResponse<NodesResponse>> {
    const params = status ? `?status=${encodeURIComponent(status)}` : '';
    const response = await this.api.get(`/nodes/meus${params}`);
    return response.data;
  }

  async getNodeStatistics(): Promise<ApiResponse<EstatisticasUsuario>> {
    const response = await this.api.get('/nodes/estatisticas');
    return response.data;
  }

  // Métodos administrativos
  async getDashboard(): Promise<ApiResponse<DashboardData>> {
    const response = await this.api.get('/admin/dashboard');
    return response.data;
  }

  async getAllNodes(filters?: NodesFilters): Promise<ApiResponse<NodesResponse>> {
    const params = new URLSearchParams();
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }
    
    const response = await this.api.get(`/admin/nodes?${params.toString()}`);
    return response.data;
  }

  async updateNode(nodeId: number, data: NodeUpdateForm): Promise<ApiResponse<Node>> {
    const response = await this.api.put(`/admin/nodes/${nodeId}`, data);
    return response.data;
  }

  async deleteNode(nodeId: number): Promise<ApiResponse<void>> {
    const response = await this.api.delete(`/admin/nodes/${nodeId}`);
    return response.data;
  }

  async resetNode(nodeId: number): Promise<ApiResponse<Node>> {
    const response = await this.api.post(`/admin/nodes/${nodeId}/resetar`);
    return response.data;
  }

  async bulkActionNodes(request: BulkActionRequest): Promise<ApiResponse<BulkActionResponse>> {
    const response = await this.api.post('/admin/nodes/bulk-actions', request);
    return response.data;
  }

  // Upload de Excel
  async uploadExcel(file: File, preview: boolean = false): Promise<ApiResponse<ExcelParseResult>> {
    const formData = new FormData();
    formData.append('excel', file);
    formData.append('preview', preview.toString());

    const response = await this.api.post('/admin/nodes/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000, // 1 minuto para uploads
    });
    
    return response.data;
  }

  // Exportação de dados
  async exportNodes(type: string = 'all'): Promise<Blob> {
    const response = await this.api.get(`/admin/export?type=${type}`, {
      responseType: 'blob',
      timeout: 60000, // 1 minuto para exports
    });
    
    return response.data;
  }

  async downloadTemplate(): Promise<Blob> {
    const response = await this.api.get('/admin/template', {
      responseType: 'blob',
    });
    
    return response.data;
  }

  // Gerenciamento de usuários
  async getUsuarios(filters?: UsuariosFilters): Promise<ApiResponse<{ usuarios: Usuario[]; pagination: any }>> {
    const params = new URLSearchParams();
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }
    
    const response = await this.api.get(`/admin/usuarios?${params.toString()}`);
    return response.data;
  }

  async createUsuario(data: UsuarioCreateRequest): Promise<ApiResponse<Usuario>> {
    const response = await this.api.post('/admin/usuarios', data);
    return response.data;
  }

  async updateUsuario(userId: string, data: UsuarioUpdateRequest): Promise<ApiResponse<Usuario>> {
    const response = await this.api.put(`/admin/usuarios/${userId}`, data);
    return response.data;
  }

  async deleteUsuario(userId: string): Promise<ApiResponse<void>> {
    const response = await this.api.delete(`/admin/usuarios/${userId}`);
    return response.data;
  }

  async exportUsuarios(): Promise<Blob> {
    const response = await this.api.get('/admin/export-usuarios', {
      responseType: 'blob',
    });
    
    return response.data;
  }

  // Logs de auditoria
  async getLogs(filters?: LogsFilters): Promise<ApiResponse<{ logs: LogEntry[]; pagination: any }>> {
    const params = new URLSearchParams();
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }
    
    const response = await this.api.get(`/admin/logs?${params.toString()}`);
    return response.data;
  }

  // Health check
  async healthCheck(): Promise<any> {
    const response = await this.api.get('/health');
    return response.data;
  }
}

// Exportar instância singleton
export const apiService = new ApiService();
export default apiService;