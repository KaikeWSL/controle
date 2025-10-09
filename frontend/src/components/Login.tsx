import React, { useState } from 'react';
import { User, Lock, Loader2, Fingerprint, Shield, AlertCircle } from 'lucide-react';
import { generateHardwareId } from '../utils/hardwareId';
import apiService from '../services/api';
import type { LoginUserRequest, LoginAdminRequest } from '../types';

interface LoginProps {
  onLogin: (user: any, token: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [loginType, setLoginType] = useState<'select' | 'user' | 'admin'>('select');
  const [adminPassword, setAdminPassword] = useState('');
  const [hardwareId, setHardwareId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isGeneratingId, setIsGeneratingId] = useState(false);

  // Gerar Hardware ID para login de usuário
  const handleUserLogin = async () => {
    setIsLoading(true);
    setError('');
    setIsGeneratingId(true);

    try {
      // Gerar Hardware ID
      const hwId = generateHardwareId();
      setHardwareId(hwId);
      setIsGeneratingId(false);

      // Fazer login
      const credentials: LoginUserRequest = { hardwareId: hwId };
      const response = await apiService.loginUser(credentials);

      if (response.success && response.data) {
        onLogin(response.data.user, response.data.token);
      } else {
        setError(response.message || 'Erro no login');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar com o servidor');
    } finally {
      setIsLoading(false);
      setIsGeneratingId(false);
    }
  };

  // Login de administrador
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const credentials: LoginAdminRequest = { password: adminPassword };
      const response = await apiService.loginAdmin(credentials);

      if (response.success && response.data) {
        onLogin(response.data.user, response.data.token);
      } else {
        setError(response.message || 'Senha incorreta');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar com o servidor');
    } finally {
      setIsLoading(false);
    }
  };

  const resetToSelect = () => {
    setLoginType('select');
    setAdminPassword('');
    setHardwareId('');
    setError('');
  };

  // Tela de seleção inicial
  if (loginType === 'select') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Sistema de Controle
            </h1>
            <p className="text-gray-600">
              Gerenciamento de Nodes
            </p>
          </div>

          {/* Card de login */}
          <div className="card">
            <div className="card-body space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Escolha seu tipo de acesso
                </h2>
                <p className="text-sm text-gray-500">
                  Selecione como deseja entrar no sistema
                </p>
              </div>

              <div className="space-y-4">
                {/* Botão Usuário */}
                <button
                  onClick={() => setLoginType('user')}
                  className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-all duration-200 group"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center group-hover:bg-primary-200 transition-colors">
                      <User className="w-6 h-6 text-primary-600" />
                    </div>
                    <div className="text-left flex-1">
                      <h3 className="font-semibold text-gray-900">
                        Entrar como Usuário
                      </h3>
                      <p className="text-sm text-gray-500">
                        Acesso via Hardware ID automático
                      </p>
                    </div>
                    <Fingerprint className="w-5 h-5 text-gray-400 group-hover:text-primary-500 transition-colors" />
                  </div>
                </button>

                {/* Botão Admin */}
                <button
                  onClick={() => setLoginType('admin')}
                  className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-warning-300 hover:bg-warning-50 transition-all duration-200 group"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-warning-100 rounded-lg flex items-center justify-center group-hover:bg-warning-200 transition-colors">
                      <Lock className="w-6 h-6 text-warning-600" />
                    </div>
                    <div className="text-left flex-1">
                      <h3 className="font-semibold text-gray-900">
                        Entrar como Administrador
                      </h3>
                      <p className="text-sm text-gray-500">
                        Acesso via senha administrativa
                      </p>
                    </div>
                    <Shield className="w-5 h-5 text-gray-400 group-hover:text-warning-500 transition-colors" />
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-6 text-xs text-gray-500">
            Sistema de Controle de Nodes v1.0.0
          </div>
        </div>
      </div>
    );
  }

  // Tela de login de usuário
  if (loginType === 'user') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Login de Usuário
            </h1>
            <p className="text-gray-600">
              Gerando identificação automática...
            </p>
          </div>

          {/* Card de login */}
          <div className="card">
            <div className="card-body space-y-6">
              {isGeneratingId ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 mx-auto mb-4">
                    <Loader2 className="w-12 h-12 text-primary-600 animate-spin" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Gerando Hardware ID
                  </h3>
                  <p className="text-sm text-gray-500">
                    Analisando características do dispositivo...
                  </p>
                </div>
              ) : (
                <>
                  {hardwareId && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <label className="form-label">Hardware ID Gerado:</label>
                      <div className="font-mono text-lg font-bold text-primary-600 bg-white p-3 rounded border">
                        {hardwareId}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Este ID identifica unicamente seu dispositivo
                      </p>
                    </div>
                  )}

                  {error && (
                    <div className="alert-danger">
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="w-5 h-5" />
                        <span>{error}</span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <button
                      onClick={handleUserLogin}
                      disabled={isLoading}
                      className="btn-primary w-full py-3 text-base"
                    >
                      {isLoading ? (
                        <div className="flex items-center justify-center space-x-2">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Entrando...</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center space-x-2">
                          <Fingerprint className="w-5 h-5" />
                          <span>Entrar no Sistema</span>
                        </div>
                      )}
                    </button>

                    <button
                      onClick={resetToSelect}
                      disabled={isLoading}
                      className="btn-outline w-full"
                    >
                      Voltar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Tela de login de admin
  return (
    <div className="min-h-screen bg-gradient-to-br from-warning-50 to-warning-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-warning-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Acesso Administrativo
          </h1>
          <p className="text-gray-600">
            Digite a senha para continuar
          </p>
        </div>

        {/* Card de login */}
        <div className="card">
          <div className="card-body">
            <form onSubmit={handleAdminLogin} className="space-y-6">
              <div>
                <label htmlFor="password" className="form-label">
                  Senha Administrativa
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    id="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="form-input pl-10"
                    placeholder="Digite a senha administrativa"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              {error && (
                <div className="alert-danger">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-5 h-5" />
                    <span>{error}</span>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <button
                  type="submit"
                  disabled={isLoading || !adminPassword.trim()}
                  className="btn-warning w-full py-3 text-base"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Verificando...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center space-x-2">
                      <Shield className="w-5 h-5" />
                      <span>Entrar como Admin</span>
                    </div>
                  )}
                </button>

                <button
                  type="button"
                  onClick={resetToSelect}
                  disabled={isLoading}
                  className="btn-outline w-full"
                >
                  Voltar
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Aviso de segurança */}
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <strong>Aviso:</strong> O acesso administrativo permite controle total do sistema. 
              Use apenas se autorizado.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;