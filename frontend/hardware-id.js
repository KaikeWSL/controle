// Geração de Hardware ID para identificação única da máquina

// Função principal para gerar Hardware ID
async function generateHardwareId() {
    try {
        // Combinar várias características do dispositivo para criar um ID único
        const components = await gatherSystemInfo();
        
        // Criar hash das características
        const combinedString = Object.values(components).join('|');
        const hardwareId = await hashString(combinedString);
        
        return hardwareId.substring(0, 12).toUpperCase(); // Retornar primeiros 12 caracteres em maiúsculo
        
    } catch (error) {
        console.error('Erro ao gerar Hardware ID:', error);
        
        // Fallback: usar características básicas do navegador
        const fallbackId = generateFallbackId();
        return fallbackId;
    }
}

// Coletar informações do sistema
async function gatherSystemInfo() {
    const info = {};
    
    try {
        // Screen information
        info.screen = `${screen.width}x${screen.height}x${screen.colorDepth}`;
        
        // Timezone
        info.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        // Language
        info.language = navigator.language || navigator.userLanguage || 'en';
        
        // Platform
        info.platform = navigator.platform || 'unknown';
        
        // User Agent (simplified)
        const ua = navigator.userAgent || '';
        info.browser = getBrowserFingerprint(ua);
        
        // Hardware concurrency (CPU cores)
        info.cores = navigator.hardwareConcurrency || 1;
        
        // Memory (if available)
        if (navigator.deviceMemory) {
            info.memory = navigator.deviceMemory;
        }
        
        // Canvas fingerprint
        info.canvas = getCanvasFingerprint();
        
        // WebGL fingerprint
        info.webgl = getWebGLFingerprint();
        
        // Audio context fingerprint
        info.audio = await getAudioFingerprint();
        
        // Local storage test
        info.storage = getStorageFingerprint();
        
    } catch (error) {
        console.warn('Erro ao coletar algumas informações do sistema:', error);
    }
    
    return info;
}

// Obter fingerprint do navegador
function getBrowserFingerprint(userAgent) {
    // Extrair informações relevantes do User Agent
    const matches = {
        browser: userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)\/?\s*(\d+)/i),
        os: userAgent.match(/(Windows|Mac|Linux|Android|iOS)/i),
        version: userAgent.match(/Version\/([0-9._]+)/i)
    };
    
    return Object.values(matches)
        .filter(match => match)
        .map(match => match[1] || match[0])
        .join('-');
}

// Canvas fingerprint
function getCanvasFingerprint() {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = 200;
        canvas.height = 50;
        
        // Desenhar texto e formas para criar fingerprint único
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('Hardware ID', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('🖥️💻📱', 4, 35);
        
        return canvas.toDataURL().substring(22, 42); // Substring do hash
        
    } catch (error) {
        return 'canvas-error';
    }
}

// WebGL fingerprint
function getWebGLFingerprint() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        
        if (!gl) {
            return 'webgl-not-supported';
        }
        
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
            const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '';
            const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
            return `${vendor}-${renderer}`.substring(0, 20);
        }
        
        return gl.getParameter(gl.VERSION) || 'webgl-available';
        
    } catch (error) {
        return 'webgl-error';
    }
}

// Audio fingerprint
async function getAudioFingerprint() {
    try {
        if (!window.AudioContext && !window.webkitAudioContext) {
            return 'audio-not-supported';
        }
        
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContext();
        
        const oscillator = audioCtx.createOscillator();
        const analyser = audioCtx.createAnalyser();
        const gain = audioCtx.createGain();
        const scriptProcessor = audioCtx.createScriptProcessor(4096, 1, 1);
        
        gain.gain.value = 0;
        oscillator.frequency.value = 10000;
        oscillator.type = 'triangle';
        
        oscillator.connect(analyser);
        analyser.connect(scriptProcessor);
        scriptProcessor.connect(gain);
        gain.connect(audioCtx.destination);
        
        oscillator.start(0);
        
        return new Promise((resolve) => {
            scriptProcessor.onaudioprocess = (bins) => {
                const samples = bins.inputBuffer.getChannelData(0);
                let sum = 0;
                for (let i = 0; i < samples.length; i++) {
                    sum += Math.abs(samples[i]);
                }
                
                audioCtx.close();
                oscillator.disconnect();
                
                resolve(sum.toString().substring(0, 10));
            };
            
            // Timeout para evitar travamento
            setTimeout(() => {
                audioCtx.close();
                resolve('audio-timeout');
            }, 1000);
        });
        
    } catch (error) {
        return 'audio-error';
    }
}

// Storage fingerprint
function getStorageFingerprint() {
    try {
        const testKey = 'hwid-test';
        const testValue = 'test-' + Date.now();
        
        localStorage.setItem(testKey, testValue);
        const retrieved = localStorage.getItem(testKey);
        localStorage.removeItem(testKey);
        
        if (retrieved === testValue) {
            return 'localStorage-available';
        } else {
            return 'localStorage-error';
        }
        
    } catch (error) {
        return 'localStorage-disabled';
    }
}

// Hash string usando SubtleCrypto API
async function hashString(str) {
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
        
    } catch (error) {
        // Fallback para navegadores que não suportam SubtleCrypto
        return simpleHash(str);
    }
}

// Hash simples para fallback
function simpleHash(str) {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(16).toUpperCase();
}

// Gerar ID de fallback usando características básicas
function generateFallbackId() {
    try {
        const components = [
            screen.width || 1920,
            screen.height || 1080,
            screen.colorDepth || 24,
            navigator.language || 'en',
            navigator.platform || 'unknown',
            navigator.hardwareConcurrency || 1,
            Date.now().toString().slice(-6) // Últimos 6 dígitos do timestamp
        ];
        
        const combined = components.join('|');
        const hash = simpleHash(combined);
        
        return hash.substring(0, 12).toUpperCase();
        
    } catch (error) {
        // Último recurso: ID baseado em timestamp
        return 'HW' + Date.now().toString().slice(-8);
    }
}

// Função para validar Hardware ID
function validateHardwareId(hardwareId) {
    // Hardware ID deve ter entre 6-20 caracteres alfanuméricos
    const regex = /^[A-Z0-9]{6,20}$/;
    return regex.test(hardwareId);
}

// Função para obter ou gerar Hardware ID (com cache)
async function getHardwareId() {
    try {
        // Verificar se já existe um ID salvo
        let savedId = localStorage.getItem('hardwareId');
        
        if (savedId && validateHardwareId(savedId)) {
            return savedId;
        }
        
        // Gerar novo ID
        const newId = await generateHardwareId();
        
        if (validateHardwareId(newId)) {
            localStorage.setItem('hardwareId', newId);
            return newId;
        } else {
            throw new Error('ID gerado inválido');
        }
        
    } catch (error) {
        console.error('Erro ao obter Hardware ID:', error);
        
        // Último recurso
        const fallbackId = generateFallbackId();
        localStorage.setItem('hardwareId', fallbackId);
        return fallbackId;
    }
}

// Função para resetar Hardware ID (para testes)
function resetHardwareId() {
    localStorage.removeItem('hardwareId');
    utils.showToast('Hardware ID resetado. A página será recarregada.', 'info');
    setTimeout(() => {
        window.location.reload();
    }, 2000);
}

// Função para mostrar informações de debug do Hardware ID
async function debugHardwareId() {
    if (api.getCurrentUser()?.tipo !== 'admin') {
        utils.showToast('Apenas administradores podem ver informações de debug', 'error');
        return;
    }
    
    try {
        const components = await gatherSystemInfo();
        const hardwareId = await getHardwareId();
        
        console.group('🔍 Hardware ID Debug');
        console.log('Hardware ID:', hardwareId);
        console.log('Componentes:', components);
        console.groupEnd();
        
        utils.showToast('Informações de debug exibidas no console', 'info');
        
    } catch (error) {
        console.error('Erro no debug:', error);
        utils.showToast('Erro ao gerar informações de debug', 'error');
    }
}

// Adicionar comando de debug global (apenas para desenvolvimento)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.debugHardwareId = debugHardwareId;
    window.resetHardwareId = resetHardwareId;
    console.log('🛠️ Comandos de debug disponíveis: debugHardwareId(), resetHardwareId()');
}

// Export das funções
window.hardwareId = {
    getHardwareId,
    validateHardwareId,
    resetHardwareId,
    debugHardwareId
};