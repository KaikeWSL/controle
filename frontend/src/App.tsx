import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import type { User } from './types';
import apiService from './services/api';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Verificar se há token salvo ao inicializar
  useEffect(() => {
    const checkAuth = async () => {
      const savedToken = apiService.getToken();
      
      if (savedToken) {
        try {
          const response = await apiService.validateToken();
          if (response.success && response.data) {
            setUser(response.data.user);
            setToken(savedToken);
          } else {
            // Token inválido, limpar
            apiService.setToken(null);
          }
        } catch (error) {
          console.error('Erro ao validar token:', error);
          apiService.setToken(null);
        }
      }
      
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const handleLogin = (userData: User, authToken: string) => {
    setUser(userData);
    setToken(authToken);
    apiService.setToken(authToken);
  };

  const handleLogout = async () => {
    try {
      await apiService.logout();
    } catch (error) {
      console.error('Erro no logout:', error);
    } finally {
      setUser(null);
      setToken(null);
      apiService.setToken(null);
    }
  };

  // Tela de loading inicial
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <div className="w-8 h-8 bg-white rounded-full"></div>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Carregando Sistema
          </h2>
          <p className="text-gray-500">
            Verificando autenticação...
          </p>
        </div>
      </div>
    );
  }

  // Se não estiver logado, mostrar tela de login
  if (!user || !token) {
    return <Login onLogin={handleLogin} />;
  }

  // Se for usuário comum, mostrar dashboard do usuário
  if (user.tipo === 'usuario') {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">SN</span>
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">
                    Sistema de Nodes
                  </h1>
                  <p className="text-sm text-gray-500">
                    Dashboard do Usuário
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    Olá, {user.nome}!
                  </p>
                  <p className="text-xs text-gray-500">
                    Hardware ID: {user.id}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="btn-outline text-sm"
                >
                  Sair
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Dashboard do Usuário
            </h2>
            <p className="text-gray-600 mb-8">
              Em desenvolvimento...
            </p>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Informações do Usuário
              </h3>
              <div className="text-left space-y-2">
                <p><strong>Nome:</strong> {user.nome}</p>
                <p><strong>Hardware ID:</strong> {user.id}</p>
                <p><strong>Tipo:</strong> {user.tipo}</p>
                <p><strong>Status:</strong> {user.liberado ? 'Liberado' : 'Bloqueado'}</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Se for administrador, mostrar dashboard admin
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-warning-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">AD</span>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  Sistema de Nodes
                </h1>
                <p className="text-sm text-gray-500">
                  Painel Administrativo
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {user.nome}
                </p>
                <p className="text-xs text-gray-500">
                  Administrador
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="btn-outline text-sm"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Dashboard Administrativo
          </h2>
          <p className="text-gray-600 mb-8">
            Em desenvolvimento...
          </p>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Funcionalidades Administrativas
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold text-gray-900">Gerenciar Nodes</h4>
                <p className="text-sm text-gray-600">CRUD completo de nodes</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold text-gray-900">Upload Excel</h4>
                <p className="text-sm text-gray-600">Importação em massa</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold text-gray-900">Relatórios</h4>
                <p className="text-sm text-gray-600">Exportação para Power BI</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;