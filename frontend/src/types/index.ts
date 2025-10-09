// Tipos para autenticação
export interface User {
  id: string;
  nome: string;
  tipo: 'usuario' | 'admin';
  liberado?: boolean;
  ativo?: boolean;
  ultimo_acesso?: string;
  estatisticas?: {
    nodes_em_execucao: number;
    nodes_concluidos: number;
  };
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    token: string;
    user: User;
  };
}

export interface LoginUserRequest {
  hardwareId: string;
}

export interface LoginAdminRequest {
  password: string;
}

// Tipos para nodes
export interface Node {
  id: number;
  estado: string;
  cidade: string;
  nodes: string;
  status: 'Disponível' | 'Em Execução' | 'Concluído';
  ativo: boolean;
  observacao?: string;
  usuario?: string;
  usuario_id?: string;
  data_criacao: string;
  data_inicio?: string;
  data_conclusao?: string;
  tempo_execucao?: number;
  tempo_atual_minutos?: number;
  tempo_formatado?: string;
}

export interface NodesByState {
  [estado: string]: {
    [cidade: string]: Array<{
      id: number;
      nodes: string;
      data_criacao: string;
    }>;
  };
}

export interface NodesByStatus {
  'Em Execução': Node[];
  'Concluído': Node[];
}

// Tipos para API responses
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: string[];
}

export interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasNext: boolean;
}

export interface NodesResponse {
  nodes: Node[];
  nodesByState?: NodesByState;
  nodesByStatus?: NodesByStatus;
  pagination?: PaginationInfo;
  resumo?: {
    em_execucao: number;
    concluidos: number;
    total: number;
  };
}

// Tipos para estatísticas
export interface EstatisticasGerais {
  total_nodes: number;
  nodes_disponiveis: number;
  nodes_em_execucao: number;
  nodes_concluidos: number;
  usuarios_ativos: number;
  total_estados: number;
  total_cidades: number;
}

export interface EstatisticasUsuario {
  geral: {
    nodes_em_execucao: number;
    nodes_concluidos: number;
    total_nodes_atribuidos: number;
    tempo_medio_execucao: number;
    primeiro_node?: string;
    ultimo_node_concluido?: string;
  };
  hoje: {
    iniciados_hoje: number;
    concluidos_hoje: number;
  };
}

export interface UsuarioAtivo {
  usuario_id: string;
  usuario_nome: string;
  nodes_em_execucao: number;
  nodes_concluidos: number;
  total_nodes_atribuidos: number;
  tempo_medio_execucao: number;
  ultimo_node_iniciado?: string;
  ultimo_node_concluido?: string;
}

export interface NodesPorLocalizacao {
  estado: string;
  cidade: string;
  total_nodes: number;
  disponiveis: number;
  em_execucao: number;
  concluidos: number;
  percentual_concluido: number;
}

export interface AtividadeRecente {
  usuario: string;
  acao: string;
  detalhes: string;
  timestamp: string;
}

export interface LocalizacaoAtiva {
  estado: string;
  cidade: string;
  total_atividade: number;
  concluidos: number;
  ultima_atividade?: string;
}

export interface DashboardData {
  estatisticas_gerais: EstatisticasGerais;
  usuarios_ativos: UsuarioAtivo[];
  nodes_por_localizacao: NodesPorLocalizacao[];
  atividade_recente: AtividadeRecente[];
  localizacoes_ativas: LocalizacaoAtiva[];
}

// Tipos para usuários (admin)
export interface Usuario {
  id: string;
  nome: string;
  liberado: boolean;
  ativo: boolean;
  data_criacao: string;
  ultimo_acesso?: string;
  nodes_em_execucao: number;
  nodes_concluidos: number;
  total_nodes_atribuidos: number;
  tempo_medio_execucao: number;
}

export interface UsuarioCreateRequest {
  id: string;
  nome: string;
  liberado: boolean;
  ativo: boolean;
}

export interface UsuarioUpdateRequest {
  nome: string;
  liberado: boolean;
  ativo: boolean;
}

// Tipos para upload de Excel
export interface ExcelParseResult {
  success: boolean;
  data: Array<{
    estado: string;
    cidade: string;
    nodes: string;
  }>;
  errors: string[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  inserted?: number;
  summary: {
    filename: string;
    totalLinhas: number;
    linhasValidas: number;
    linhasComErro: number;
    estados: number;
    cidades: number;
    inseridos?: number;
    erros_insercao?: number;
  };
  isPreview?: boolean;
  totalData?: number;
}

// Tipos para logs
export interface LogEntry {
  usuario: string;
  usuario_id: string;
  acao: string;
  detalhes: string;
  ip_address: string;
  user_agent: string;
  timestamp: string;
}

// Tipos para formulários
export interface NodeUpdateForm {
  estado: string;
  cidade: string;
  nodes: string;
  status: 'Disponível' | 'Em Execução' | 'Concluído';
  ativo: boolean;
  observacao?: string;
}

// Tipos para filtros
export interface NodesFilters {
  estado?: string;
  cidade?: string;
  status?: string;
  usuario?: string;
  ativo?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface UsuariosFilters {
  ativo?: boolean;
  liberado?: boolean;
  limit?: number;
  offset?: number;
}

export interface LogsFilters {
  usuario?: string;
  acao?: string;
  data_inicio?: string;
  data_fim?: string;
  limit?: number;
  offset?: number;
}

// Tipos para ações em massa
export interface BulkActionRequest {
  action: 'activate' | 'deactivate' | 'reset';
  nodeIds: number[];
}

export interface BulkActionResponse {
  action: string;
  affectedRows: number;
}

// Tipos para componentes
export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: any;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface LoadingState {
  isLoading: boolean;
  message?: string;
}

export interface FormState<T> {
  data: T;
  errors: Record<string, string>;
  isSubmitting: boolean;
  isDirty: boolean;
}

// Tipos para contexto de autenticação
export interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginUserRequest | LoginAdminRequest, type: 'user' | 'admin') => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

// Tipos para hooks
export interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export interface UseNodesResult extends UseApiResult<NodesResponse> {
  claimNode: (nodeId: number) => Promise<void>;
  completeNode: (nodeId: number, observacao?: string) => Promise<void>;
}

// Tipos para configurações
export interface AppConfig {
  apiBaseUrl: string;
  refreshInterval: number;
  maxFileSize: number;
  supportedFileTypes: string[];
  pagination: {
    defaultPageSize: number;
    maxPageSize: number;
  };
}

// Tipo para erro de API
export interface ApiError {
  message: string;
  status?: number;
  details?: string;
}

// Enums úteis
export enum NodeStatus {
  DISPONIVEL = 'Disponível',
  EM_EXECUCAO = 'Em Execução',
  CONCLUIDO = 'Concluído'
}

export enum UserType {
  USUARIO = 'usuario',
  ADMIN = 'admin'
}

export enum ActionType {
  LOGIN_SUCESSO = 'LOGIN_SUCESSO',
  LOGIN_FALHOU = 'LOGIN_FALHOU',
  LOGOUT = 'LOGOUT',
  NODE_CLAIM = 'NODE_CLAIM',
  NODE_CONCLUIDO = 'NODE_CONCLUIDO',
  NODE_EDITADO = 'NODE_EDITADO',
  NODE_DELETADO = 'NODE_DELETADO',
  NODE_RESETADO = 'NODE_RESETADO',
  UPLOAD_EXCEL_SUCESSO = 'UPLOAD_EXCEL_SUCESSO',
  UPLOAD_EXCEL_ERRO = 'UPLOAD_EXCEL_ERRO',
  EXPORT_DADOS = 'EXPORT_DADOS',
  USUARIO_CRIADO = 'USUARIO_CRIADO',
  USUARIO_EDITADO = 'USUARIO_EDITADO',
  USUARIO_DELETADO = 'USUARIO_DELETADO',
  BULK_ACTION = 'BULK_ACTION'
}