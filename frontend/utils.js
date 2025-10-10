// Utilitários gerais

// Função para mostrar/ocultar elementos
function show(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.remove('hidden');
    }
}

function hide(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.add('hidden');
    }
}

// Função para mostrar loading
function showLoading(text = 'Carregando...') {
    const overlay = document.getElementById('loading-overlay');
    const loadingText = overlay.querySelector('p');
    loadingText.textContent = text;
    overlay.classList.remove('hidden');
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.add('hidden');
}

// Sistema de notificações Toast
function showToast(message, type = 'info', duration = 5000) {
    const container = document.getElementById('toast-container');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // Remover automaticamente
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-in forwards';
        setTimeout(() => {
            if (container.contains(toast)) {
                container.removeChild(toast);
            }
        }, 300);
    }, duration);
    
    // Clique para remover
    toast.addEventListener('click', () => {
        toast.style.animation = 'slideOut 0.3s ease-in forwards';
        setTimeout(() => {
            if (container.contains(toast)) {
                container.removeChild(toast);
            }
        }, 300);
    });
}

// Adicionar CSS para slideOut
if (!document.querySelector('#toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

// Função para formatar data
function formatDate(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Função para calcular tempo decorrido
function getTimeElapsed(startTime) {
    if (!startTime) return '';
    
    const start = new Date(startTime);
    const now = new Date();
    const diff = now - start;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
        return `${hours}h${minutes.toString().padStart(2, '0')}min`;
    } else {
        return `${minutes}min`;
    }
}

// Função para validar formulários
function validateForm(formId) {
    const form = document.getElementById(formId);
    const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
    
    for (let input of inputs) {
        if (!input.value.trim()) {
            input.focus();
            showToast(`Campo "${input.previousElementSibling.textContent}" é obrigatório`, 'error');
            return false;
        }
    }
    
    return true;
}

// Função para limpar formulário
function clearForm(formId) {
    const form = document.getElementById(formId);
    const inputs = form.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
        if (input.type === 'checkbox') {
            input.checked = false;
        } else {
            input.value = '';
        }
    });
}

// Função para confirmar ação
function confirmAction(message, callback) {
    if (confirm(message)) {
        callback();
    }
}

// Função para debounce (evitar múltiplas chamadas rápidas)
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Função para sanitizar HTML
function sanitizeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Função para copiar para clipboard
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('Copiado para a área de transferência!', 'success');
    } catch (err) {
        console.error('Erro ao copiar:', err);
        showToast('Erro ao copiar para área de transferência', 'error');
    }
}

// Função para download de arquivo
function downloadFile(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

// Função para formatar números
function formatNumber(num) {
    return new Intl.NumberFormat('pt-BR').format(num);
}

// Função para capitalizar primeira letra
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Função para truncar texto
function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// Função para animar números (contador)
function animateNumber(element, targetNumber, duration = 1000) {
    const startNumber = 0;
    const startTime = performance.now();
    
    function updateNumber(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const currentNumber = Math.floor(startNumber + (targetNumber - startNumber) * progress);
        element.textContent = formatNumber(currentNumber);
        
        if (progress < 1) {
            requestAnimationFrame(updateNumber);
        }
    }
    
    requestAnimationFrame(updateNumber);
}

// Função para observar mudanças de visibilidade da página
function onVisibilityChange(callback) {
    document.addEventListener('visibilitychange', () => {
        callback(!document.hidden);
    });
}

// Função para retry de operações com falha
async function retryOperation(operation, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error) {
            if (i === maxRetries - 1) {
                throw error;
            }
            
            console.warn(`Tentativa ${i + 1} falhou, tentando novamente em ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
        }
    }
}

// Função para verificar se está online
function isOnline() {
    return navigator.onLine;
}

// Listeners para status de conexão
window.addEventListener('online', () => {
    showToast('Conexão restaurada!', 'success');
});

window.addEventListener('offline', () => {
    showToast('Conexão perdida. Tentativas serão refeitas quando a conexão for restaurada.', 'warning', 10000);
});

// Função para throttle (limitar frequência de execução)
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Função para auto-refresh de dados
function setupAutoRefresh(refreshFunction, interval = 10000) {
    let intervalId;
    
    function startRefresh() {
        intervalId = setInterval(() => {
            if (isOnline() && !document.hidden) {
                refreshFunction();
            }
        }, interval);
    }
    
    function stopRefresh() {
        if (intervalId) {
            clearInterval(intervalId);
        }
    }
    
    // Parar refresh quando a página não está visível
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopRefresh();
        } else {
            startRefresh();
        }
    });
    
    // Iniciar refresh
    startRefresh();
    
    return { stop: stopRefresh, start: startRefresh };
}

// Função para lidar com erros de rede
function handleNetworkError(error) {
    console.error('Erro de rede:', error);
    
    if (!isOnline()) {
        showToast('Sem conexão com a internet', 'error');
    } else {
        showToast('Erro de conexão com o servidor', 'error');
    }
}

// Função para validar entrada de texto
function validateInput(input, type) {
    const value = input.value.trim();
    
    switch (type) {
        case 'hardwareId':
            // Hardware ID deve ter pelo menos 6 caracteres alfanuméricos
            return /^[A-Za-z0-9]{6,}$/.test(value);
        
        case 'nome':
            // Nome deve ter pelo menos 2 caracteres
            return value.length >= 2;
        
        case 'estado':
        case 'cidade':
            // Estado e cidade devem ter pelo menos 2 caracteres
            return value.length >= 2;
        
        case 'node':
            // Node ID deve ter pelo menos 1 caractere
            return value.length >= 1;
        
        default:
            return value.length > 0;
    }
}

// Função para adicionar indicador visual de validação
function addValidationFeedback(input, isValid) {
    input.style.borderColor = isValid ? '#10b981' : '#ef4444';
    
    // Remover feedback anterior
    const existingFeedback = input.parentNode.querySelector('.validation-feedback');
    if (existingFeedback) {
        existingFeedback.remove();
    }
    
    // Adicionar novo feedback se inválido
    if (!isValid) {
        const feedback = document.createElement('div');
        feedback.className = 'validation-feedback';
        feedback.style.color = '#ef4444';
        feedback.style.fontSize = '12px';
        feedback.style.marginTop = '4px';
        feedback.textContent = 'Formato inválido';
        input.parentNode.appendChild(feedback);
    }
}

// Função para criar elemento com atributos
function createElement(tag, attributes = {}, textContent = '') {
    const element = document.createElement(tag);
    
    Object.keys(attributes).forEach(key => {
        if (key === 'className') {
            element.className = attributes[key];
        } else {
            element.setAttribute(key, attributes[key]);
        }
    });
    
    if (textContent) {
        element.textContent = textContent;
    }
    
    return element;
}

// Função para escutar teclas de atalho
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl + R ou F5 para refresh
        if ((e.ctrlKey && e.key === 'r') || e.key === 'F5') {
            e.preventDefault();
            location.reload();
        }
        
        // ESC para fechar modais
        if (e.key === 'Escape') {
            const openModal = document.querySelector('.modal:not(.hidden)');
            if (openModal) {
                openModal.classList.add('hidden');
            }
        }
    });
}

// Inicializar atalhos de teclado
setupKeyboardShortcuts();

// Export das funções para uso global
window.utils = {
    show,
    hide,
    showLoading,
    hideLoading,
    showToast,
    formatDate,
    getTimeElapsed,
    validateForm,
    clearForm,
    confirmAction,
    debounce,
    throttle,
    sanitizeHtml,
    copyToClipboard,
    downloadFile,
    formatNumber,
    capitalize,
    truncateText,
    animateNumber,
    onVisibilityChange,
    retryOperation,
    isOnline,
    setupAutoRefresh,
    handleNetworkError,
    validateInput,
    addValidationFeedback,
    createElement
};