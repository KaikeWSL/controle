// Sistema de Controle de Nodes - Aplicação Principal
class NodeControlApp {
    constructor() {
        this.currentUser = null;
        this.isAdmin = false;
        this.refreshInterval = null;
        this.lastUpdate = null;
        
        this.init();
    }
    
    async init() {
        console.log('Inicializando aplicação...');
        
        // Verificar se há usuário logado
        await this.checkAuthStatus();
        
        // Configurar event listeners
        this.setupEventListeners();
        
        // Configurar auto-refresh se logado
        if (this.currentUser) {
            this.startAutoRefresh();
            await this.loadUserDashboard();
        } else {
            this.showLoginForm();
        }
    }
    
    async checkAuthStatus() {
        const token = localStorage.getItem('token');
        const userType = localStorage.getItem('userType');
        
        if (token) {
            try {
                // Verificar se o token ainda é válido
                const response = await API.get('/auth/verify');
                if (response.success) {
                    this.currentUser = response.user;
                    this.isAdmin = userType === 'admin';
                    return true;
                }
            } catch (error) {
                console.log('Token inválido, fazendo logout...');
                this.logout();
            }
        }
        return false;
    }
    
    setupEventListeners() {
        // Botões de navegação
        document.getElementById('loginBtn')?.addEventListener('click', () => this.showLoginForm());
        document.getElementById('registerBtn')?.addEventListener('click', () => this.showRegisterForm());
        document.getElementById('logoutBtn')?.addEventListener('click', () => this.logout());
        document.getElementById('dashboardBtn')?.addEventListener('click', () => this.loadUserDashboard());
        document.getElementById('adminBtn')?.addEventListener('click', () => this.loadAdminDashboard());
        
        // Formulários
        document.getElementById('loginForm')?.addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('registerForm')?.addEventListener('submit', (e) => this.handleRegister(e));
        document.getElementById('adminLoginForm')?.addEventListener('submit', (e) => this.handleAdminLogin(e));
        
        // Modais
        document.getElementById('closeModal')?.addEventListener('click', () => this.closeModal());
        document.getElementById('closeAdminModal')?.addEventListener('click', () => this.closeAdminModal());
        document.getElementById('closeUserModal')?.addEventListener('click', () => this.closeUserModal());
        
        // Upload de arquivo
        document.getElementById('uploadForm')?.addEventListener('submit', (e) => this.handleFileUpload(e));
        
        // Formulário de node
        document.getElementById('nodeForm')?.addEventListener('submit', (e) => this.handleNodeSubmit(e));
        
        // Formulário de usuário
        document.getElementById('userForm')?.addEventListener('submit', (e) => this.handleUserSubmit(e));
        
        // Fechar modal clicando fora
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal();
                this.closeAdminModal();
                this.closeUserModal();
            }
        });
        
        // Atualizar quando a página ganha foco
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.currentUser) {
                this.refreshData();
            }
        });
    }
    
    showLoginForm() {
        document.getElementById('authSection').style.display = 'block';
        document.getElementById('userDashboard').style.display = 'none';
        document.getElementById('adminDashboard').style.display = 'none';
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
        document.getElementById('adminLoginForm').style.display = 'none';
    }
    
    showRegisterForm() {
        document.getElementById('authSection').style.display = 'block';
        document.getElementById('userDashboard').style.display = 'none';
        document.getElementById('adminDashboard').style.display = 'none';
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
        document.getElementById('adminLoginForm').style.display = 'none';
    }
    
    showAdminLoginForm() {
        document.getElementById('authSection').style.display = 'block';
        document.getElementById('userDashboard').style.display = 'none';
        document.getElementById('adminDashboard').style.display = 'none';
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'none';
        document.getElementById('adminLoginForm').style.display = 'block';
    }
    
    async handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        if (!email || !password) {
            Utils.showToast('Por favor, preencha todos os campos', 'error');
            return;
        }
        
        Utils.showLoading(true);
        
        try {
            const hardwareId = await generateHardwareId();
            
            const response = await API.post('/auth/login', {
                email,
                password,
                hardware_id: hardwareId
            });
            
            if (response.success) {
                localStorage.setItem('token', response.token);
                localStorage.setItem('userType', 'user');
                
                this.currentUser = response.user;
                this.isAdmin = false;
                
                Utils.showToast('Login realizado com sucesso!', 'success');
                await this.loadUserDashboard();
                this.startAutoRefresh();
            } else {
                Utils.showToast(response.message || 'Erro no login', 'error');
            }
        } catch (error) {
            console.error('Erro no login:', error);
            Utils.showToast('Erro interno do servidor', 'error');
        } finally {
            Utils.showLoading(false);
        }
    }
    
    async handleRegister(e) {
        e.preventDefault();
        
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (!name || !email || !password || !confirmPassword) {
            Utils.showToast('Por favor, preencha todos os campos', 'error');
            return;
        }
        
        if (password !== confirmPassword) {
            Utils.showToast('As senhas não coincidem', 'error');
            return;
        }
        
        if (password.length < 6) {
            Utils.showToast('A senha deve ter pelo menos 6 caracteres', 'error');
            return;
        }
        
        Utils.showLoading(true);
        
        try {
            const hardwareId = await generateHardwareId();
            
            const response = await API.post('/auth/register', {
                name,
                email,
                password,
                hardware_id: hardwareId
            });
            
            if (response.success) {
                Utils.showToast('Registro realizado com sucesso! Faça o login.', 'success');
                this.showLoginForm();
                
                // Limpar formulário
                document.getElementById('registerForm').reset();
            } else {
                Utils.showToast(response.message || 'Erro no registro', 'error');
            }
        } catch (error) {
            console.error('Erro no registro:', error);
            Utils.showToast('Erro interno do servidor', 'error');
        } finally {
            Utils.showLoading(false);
        }
    }
    
    async handleAdminLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('adminEmail').value;
        const password = document.getElementById('adminPassword').value;
        
        if (!email || !password) {
            Utils.showToast('Por favor, preencha todos os campos', 'error');
            return;
        }
        
        Utils.showLoading(true);
        
        try {
            const hardwareId = await generateHardwareId();
            
            const response = await API.post('/auth/admin-login', {
                email,
                password,
                hardware_id: hardwareId
            });
            
            if (response.success) {
                localStorage.setItem('token', response.token);
                localStorage.setItem('userType', 'admin');
                
                this.currentUser = response.user;
                this.isAdmin = true;
                
                Utils.showToast('Login administrativo realizado!', 'success');
                await this.loadAdminDashboard();
                this.startAutoRefresh();
            } else {
                Utils.showToast(response.message || 'Erro no login administrativo', 'error');
            }
        } catch (error) {
            console.error('Erro no login admin:', error);
            Utils.showToast('Erro interno do servidor', 'error');
        } finally {
            Utils.showLoading(false);
        }
    }
    
    async loadUserDashboard() {
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('userDashboard').style.display = 'block';
        document.getElementById('adminDashboard').style.display = 'none';
        
        // Atualizar informações do usuário
        document.getElementById('userName').textContent = this.currentUser.name;
        
        // Mostrar/ocultar botão admin
        const adminBtn = document.getElementById('adminBtn');
        if (adminBtn) {
            adminBtn.style.display = this.isAdmin ? 'inline-block' : 'none';
        }
        
        // Carregar dados
        await Promise.all([
            this.loadAvailableNodes(),
            this.loadMyNodes()
        ]);
    }
    
    async loadAdminDashboard() {
        if (!this.isAdmin) {
            Utils.showToast('Acesso negado', 'error');
            return;
        }
        
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('userDashboard').style.display = 'none';
        document.getElementById('adminDashboard').style.display = 'block';
        
        // Carregar dados administrativos
        await Promise.all([
            this.loadDashboardStats(),
            this.loadAllNodes(),
            this.loadAllUsers()
        ]);
    }
    
    async loadAvailableNodes() {
        try {
            const response = await API.get('/nodes');
            
            if (response.success) {
                this.renderAvailableNodes(response.nodes);
            } else {
                Utils.showToast('Erro ao carregar nodes', 'error');
            }
        } catch (error) {
            console.error('Erro ao carregar nodes:', error);
        }
    }
    
    renderAvailableNodes(nodes) {
        const container = document.getElementById('availableNodes');
        
        if (!nodes || nodes.length === 0) {
            container.innerHTML = '<p class="no-data">Nenhum node disponível no momento</p>';
            return;
        }
        
        container.innerHTML = nodes.map(node => {
            const canClaim = node.current_users < node.max_users;
            return '<div class="node-card">' +
                '<h3>' + Utils.escapeHtml(node.name) + '</h3>' +
                '<p>' + Utils.escapeHtml(node.description) + '</p>' +
                '<div class="node-info">' +
                '<span class="reward">Recompensa: R$ ' + Utils.formatCurrency(node.reward) + '</span>' +
                '<span class="users">' + node.current_users + '/' + node.max_users + ' usuários</span>' +
                '</div>' +
                '<button class="btn btn-primary" ' +
                (canClaim ? 'onclick="app.claimNode(' + node.id + ')"' : 'disabled') + '>' +
                (canClaim ? 'Reivindicar' : 'Lotado') +
                '</button>' +
                '</div>';
        }).join('');
    }
    
    async loadMyNodes() {
        try {
            const response = await API.get('/nodes/my-nodes');
            
            if (response.success) {
                this.renderMyNodes(response.nodes);
            }
        } catch (error) {
            console.error('Erro ao carregar meus nodes:', error);
        }
    }
    
    renderMyNodes(nodes) {
        const container = document.getElementById('myNodes');
        
        if (!nodes || nodes.length === 0) {
            container.innerHTML = '<p class="no-data">Você não possui nodes em execução</p>';
            return;
        }
        
        container.innerHTML = nodes.map(node => {
            const claimedDate = new Date(node.claimed_at).toLocaleString('pt-BR');
            return '<div class="node-card claimed">' +
                '<h3>' + Utils.escapeHtml(node.name) + '</h3>' +
                '<p>' + Utils.escapeHtml(node.description) + '</p>' +
                '<div class="node-info">' +
                '<span class="reward">Recompensa: R$ ' + Utils.formatCurrency(node.reward) + '</span>' +
                '<span class="claimed-date">Reivindicado em: ' + claimedDate + '</span>' +
                '</div>' +
                '<button class="btn btn-success" onclick="app.completeNode(' + node.id + ')">' +
                'Concluir Node' +
                '</button>' +
                '</div>';
        }).join('');
    }
    
    async claimNode(nodeId) {
        if (!confirm('Deseja reivindicar este node?')) {
            return;
        }
        
        Utils.showLoading(true);
        
        try {
            const response = await API.post('/nodes/claim', { node_id: nodeId });
            
            if (response.success) {
                Utils.showToast('Node reivindicado com sucesso!', 'success');
                
                // Efeito visual de celebração
                if (typeof confetti !== 'undefined') {
                    confetti({
                        particleCount: 100,
                        spread: 70,
                        origin: { y: 0.6 }
                    });
                }
                
                // Atualizar listas
                await Promise.all([
                    this.loadAvailableNodes(),
                    this.loadMyNodes()
                ]);
            } else {
                Utils.showToast(response.message || 'Erro ao reivindicar node', 'error');
            }
        } catch (error) {
            console.error('Erro ao reivindicar node:', error);
            Utils.showToast('Erro interno do servidor', 'error');
        } finally {
            Utils.showLoading(false);
        }
    }
    
    async completeNode(nodeId) {
        if (!confirm('Confirma a conclusão deste node? Esta ação não pode ser desfeita.')) {
            return;
        }
        
        Utils.showLoading(true);
        
        try {
            const response = await API.post('/nodes/complete', { node_id: nodeId });
            
            if (response.success) {
                Utils.showToast('Node concluído! Recompensa creditada.', 'success');
                
                // Efeito visual de celebração maior
                if (typeof confetti !== 'undefined') {
                    confetti({
                        particleCount: 200,
                        spread: 100,
                        origin: { y: 0.6 }
                    });
                }
                
                // Atualizar listas
                await Promise.all([
                    this.loadAvailableNodes(),
                    this.loadMyNodes()
                ]);
            } else {
                Utils.showToast(response.message || 'Erro ao concluir node', 'error');
            }
        } catch (error) {
            console.error('Erro ao concluir node:', error);
            Utils.showToast('Erro interno do servidor', 'error');
        } finally {
            Utils.showLoading(false);
        }
    }
    
    async loadDashboardStats() {
        try {
            const response = await API.get('/admin/dashboard');
            
            if (response.success) {
                const stats = response.stats;
                
                document.getElementById('totalUsers').textContent = stats.totalUsers || 0;
                document.getElementById('totalNodes').textContent = stats.totalNodes || 0;
                document.getElementById('activeNodes').textContent = stats.activeNodes || 0;
                document.getElementById('totalRewards').textContent = 'R$ ' + Utils.formatCurrency(stats.totalRewards || 0);
            }
        } catch (error) {
            console.error('Erro ao carregar estatísticas:', error);
        }
    }
    
    async loadAllNodes() {
        try {
            const response = await API.get('/admin/nodes');
            
            if (response.success) {
                this.renderAdminNodes(response.nodes);
            }
        } catch (error) {
            console.error('Erro ao carregar nodes admin:', error);
        }
    }
    
    renderAdminNodes(nodes) {
        const tbody = document.querySelector('#nodesTable tbody');
        
        if (!nodes || nodes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">Nenhum node encontrado</td></tr>';
            return;
        }
        
        tbody.innerHTML = nodes.map(node => {
            const statusClass = {
                'available': 'status-available',
                'claimed': 'status-claimed',
                'completed': 'status-completed',
                'inactive': 'status-inactive'
            }[node.status] || '';
            
            const statusText = {
                'available': 'Disponível',
                'claimed': 'Em Execução',
                'completed': 'Concluído',
                'inactive': 'Inativo'
            }[node.status] || node.status;
            
            return '<tr>' +
                '<td>' + node.id + '</td>' +
                '<td>' + Utils.escapeHtml(node.name) + '</td>' +
                '<td>R$ ' + Utils.formatCurrency(node.reward) + '</td>' +
                '<td>' + node.current_users + '/' + node.max_users + '</td>' +
                '<td><span class="status ' + statusClass + '">' + statusText + '</span></td>' +
                '<td>' +
                '<button class="btn btn-sm btn-primary" onclick="app.editNode(' + node.id + ')">Editar</button> ' +
                '<button class="btn btn-sm btn-danger" onclick="app.deleteNode(' + node.id + ')">Excluir</button>' +
                '</td>' +
                '</tr>';
        }).join('');
    }
    
    async loadAllUsers() {
        try {
            const response = await API.get('/admin/users');
            
            if (response.success) {
                this.renderAdminUsers(response.users);
            }
        } catch (error) {
            console.error('Erro ao carregar usuários:', error);
        }
    }
    
    renderAdminUsers(users) {
        const tbody = document.querySelector('#usersTable tbody');
        
        if (!users || users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">Nenhum usuário encontrado</td></tr>';
            return;
        }
        
        tbody.innerHTML = users.map(user => {
            const lastLogin = user.last_login ? 
                new Date(user.last_login).toLocaleString('pt-BR') : 
                'Nunca';
            
            const typeText = user.user_type === 'admin' ? 'Administrador' : 'Usuário';
            
            return '<tr>' +
                '<td>' + user.id + '</td>' +
                '<td>' + Utils.escapeHtml(user.name) + '</td>' +
                '<td>' + Utils.escapeHtml(user.email) + '</td>' +
                '<td>' + typeText + '</td>' +
                '<td>' + lastLogin + '</td>' +
                '<td>' +
                '<button class="btn btn-sm btn-primary" onclick="app.editUser(' + user.id + ')">Editar</button>' +
                '</td>' +
                '</tr>';
        }).join('');
    }
    
    // Funções de administração
    openNodeModal(nodeData = null) {
        const modal = document.getElementById('nodeModal');
        const form = document.getElementById('nodeForm');
        const title = document.getElementById('nodeModalTitle');
        
        if (nodeData) {
            title.textContent = 'Editar Node';
            document.getElementById('nodeId').value = nodeData.id;
            document.getElementById('nodeName').value = nodeData.name;
            document.getElementById('nodeDescription').value = nodeData.description;
            document.getElementById('nodeReward').value = nodeData.reward;
            document.getElementById('nodeMaxUsers').value = nodeData.max_users;
            document.getElementById('nodeStatus').value = nodeData.status;
        } else {
            title.textContent = 'Novo Node';
            form.reset();
            document.getElementById('nodeId').value = '';
        }
        
        modal.style.display = 'block';
    }
    
    openUserModal(userData = null) {
        const modal = document.getElementById('userModal');
        const form = document.getElementById('userForm');
        const title = document.getElementById('userModalTitle');
        
        if (userData) {
            title.textContent = 'Editar Usuário';
            document.getElementById('userId').value = userData.id;
            document.getElementById('editUserName').value = userData.name;
            document.getElementById('editUserEmail').value = userData.email;
            document.getElementById('editUserType').value = userData.user_type;
        } else {
            title.textContent = 'Novo Usuário';
            form.reset();
            document.getElementById('userId').value = '';
        }
        
        modal.style.display = 'block';
    }
    
    closeModal() {
        document.getElementById('nodeModal').style.display = 'none';
    }
    
    closeAdminModal() {
        document.getElementById('adminModal').style.display = 'none';
    }
    
    closeUserModal() {
        document.getElementById('userModal').style.display = 'none';
    }
    
    async handleNodeSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const nodeData = {
            name: formData.get('name'),
            description: formData.get('description'),
            reward: parseFloat(formData.get('reward')),
            max_users: parseInt(formData.get('max_users')),
            status: formData.get('status')
        };
        
        const nodeId = formData.get('id');
        const isEdit = nodeId && nodeId !== '';
        
        Utils.showLoading(true);
        
        try {
            const response = isEdit ?
                await API.put('/admin/nodes/' + nodeId, nodeData) :
                await API.post('/admin/nodes', nodeData);
            
            if (response.success) {
                Utils.showToast(isEdit ? 'Node atualizado!' : 'Node criado!', 'success');
                this.closeModal();
                await this.loadAllNodes();
            } else {
                Utils.showToast(response.message || 'Erro ao salvar node', 'error');
            }
        } catch (error) {
            console.error('Erro ao salvar node:', error);
            Utils.showToast('Erro interno do servidor', 'error');
        } finally {
            Utils.showLoading(false);
        }
    }
    
    async editNode(nodeId) {
        try {
            const response = await API.get('/admin/nodes/' + nodeId);
            if (response.success) {
                this.openNodeModal(response.node);
            }
        } catch (error) {
            console.error('Erro ao carregar node:', error);
            Utils.showToast('Erro ao carregar dados do node', 'error');
        }
    }
    
    async deleteNode(nodeId) {
        if (!confirm('Tem certeza que deseja excluir este node?')) {
            return;
        }
        
        Utils.showLoading(true);
        
        try {
            const response = await API.delete('/admin/nodes/' + nodeId);
            
            if (response.success) {
                Utils.showToast('Node excluído com sucesso!', 'success');
                await this.loadAllNodes();
            } else {
                Utils.showToast(response.message || 'Erro ao excluir node', 'error');
            }
        } catch (error) {
            console.error('Erro ao excluir node:', error);
            Utils.showToast('Erro interno do servidor', 'error');
        } finally {
            Utils.showLoading(false);
        }
    }
    
    async editUser(userId) {
        try {
            const response = await API.get('/admin/users/' + userId);
            if (response.success) {
                this.openUserModal(response.user);
            }
        } catch (error) {
            console.error('Erro ao carregar usuário:', error);
            Utils.showToast('Erro ao carregar dados do usuário', 'error');
        }
    }
    
    async handleUserSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const userData = {
            name: formData.get('name'),
            email: formData.get('email'),
            user_type: formData.get('user_type')
        };
        
        const userId = formData.get('id');
        
        Utils.showLoading(true);
        
        try {
            const response = await API.put('/admin/users/' + userId, userData);
            
            if (response.success) {
                Utils.showToast('Usuário atualizado!', 'success');
                this.closeUserModal();
                await this.loadAllUsers();
            } else {
                Utils.showToast(response.message || 'Erro ao atualizar usuário', 'error');
            }
        } catch (error) {
            console.error('Erro ao atualizar usuário:', error);
            Utils.showToast('Erro interno do servidor', 'error');
        } finally {
            Utils.showLoading(false);
        }
    }
    
    async handleFileUpload(e) {
        e.preventDefault();
        
        const fileInput = document.getElementById('excelFile');
        const file = fileInput.files[0];
        
        if (!file) {
            Utils.showToast('Selecione um arquivo Excel', 'error');
            return;
        }
        
        const formData = new FormData();
        formData.append('excel', file);
        
        Utils.showLoading(true);
        
        try {
            const response = await API.postFile('/admin/upload', formData);
            
            if (response.success) {
                Utils.showToast('Arquivo processado! ' + response.processed + ' nodes adicionados.', 'success');
                fileInput.value = '';
                await this.loadAllNodes();
            } else {
                Utils.showToast(response.message || 'Erro ao processar arquivo', 'error');
            }
        } catch (error) {
            console.error('Erro no upload:', error);
            Utils.showToast('Erro interno do servidor', 'error');
        } finally {
            Utils.showLoading(false);
        }
    }
    
    async exportData() {
        Utils.showLoading(true);
        
        try {
            const response = await API.getBlob('/admin/export');
            
            // Criar link de download
            const url = window.URL.createObjectURL(response);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'nodes-export-' + new Date().toISOString().split('T')[0] + '.xlsx';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            Utils.showToast('Arquivo exportado com sucesso!', 'success');
        } catch (error) {
            console.error('Erro na exportação:', error);
            Utils.showToast('Erro ao exportar dados', 'error');
        } finally {
            Utils.showLoading(false);
        }
    }
    
    startAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        this.refreshInterval = setInterval(() => {
            this.refreshData();
        }, 30000); // Refresh a cada 30 segundos
    }
    
    async refreshData() {
        if (!this.currentUser) return;
        
        try {
            if (this.isAdmin && document.getElementById('adminDashboard').style.display !== 'none') {
                await Promise.all([
                    this.loadDashboardStats(),
                    this.loadAllNodes(),
                    this.loadAllUsers()
                ]);
            } else if (document.getElementById('userDashboard').style.display !== 'none') {
                await Promise.all([
                    this.loadAvailableNodes(),
                    this.loadMyNodes()
                ]);
            }
            
            this.lastUpdate = new Date();
            console.log('Dados atualizados:', this.lastUpdate.toLocaleTimeString());
        } catch (error) {
            console.error('Erro ao atualizar dados:', error);
        }
    }
    
    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('userType');
        
        this.currentUser = null;
        this.isAdmin = false;
        
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        
        this.showLoginForm();
        Utils.showToast('Logout realizado com sucesso', 'success');
    }
}

// Funções globais para botões
window.showLoginForm = () => app.showLoginForm();
window.showRegisterForm = () => app.showRegisterForm();
window.showAdminLoginForm = () => app.showAdminLoginForm();
window.openNodeModal = () => app.openNodeModal();
window.exportData = () => app.exportData();

// Inicializar aplicação quando a página carregar
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new NodeControlApp();
});

// Exportar para uso global
window.app = app;