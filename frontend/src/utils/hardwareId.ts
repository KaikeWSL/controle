/**
 * Utilitário para gerar Hardware ID único para identificação do usuário
 * Utiliza várias características do navegador e sistema para criar um ID único
 */

// Função para gerar um hash simples de uma string
const simpleHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Converter para 32bit
  }
  return Math.abs(hash).toString(36);
};

// Função para obter informações do canvas (fingerprint)
const getCanvasFingerprint = (): string => {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return 'no-canvas';
    
    canvas.width = 200;
    canvas.height = 50;
    
    // Desenhar texto com diferentes estilos
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Sistema Nodes 🚀', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('HardwareID Gen', 4, 30);
    
    // Adicionar alguns elementos gráficos
    ctx.beginPath();
    ctx.arc(50, 25, 20, 0, Math.PI * 2);
    ctx.stroke();
    
    return canvas.toDataURL();
  } catch {
    return 'canvas-error';
  }
};

// Função para obter informações do WebGL
const getWebGLFingerprint = (): string => {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!gl) return 'no-webgl';
    
    // Usar any para evitar problemas de tipo do WebGL
    const glAny = gl as any;
    const debugInfo = glAny.getExtension('WEBGL_debug_renderer_info');
    const vendor = debugInfo ? glAny.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'unknown';
    const renderer = debugInfo ? glAny.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown';
    
    return `${vendor}|${renderer}`;
  } catch {
    return 'webgl-error';
  }
};

// Função para obter timezone e idioma
const getLocaleInfo = (): string => {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const language = navigator.language || 'unknown';
  const languages = navigator.languages ? navigator.languages.join(',') : 'unknown';
  
  return `${timezone}|${language}|${languages}`;
};

// Função para obter informações de hardware (aproximadas)
const getHardwareInfo = (): string => {
  const memory = (navigator as any).deviceMemory || 'unknown';
  const cores = navigator.hardwareConcurrency || 'unknown';
  const platform = navigator.platform || 'unknown';
  const userAgent = navigator.userAgent || 'unknown';
  
  return `${memory}|${cores}|${platform}|${simpleHash(userAgent)}`;
};

// Função para obter informações da tela
const getScreenInfo = (): string => {
  const screen = window.screen;
  const screenInfo = `${screen.width}x${screen.height}|${screen.colorDepth}|${screen.pixelDepth}`;
  const availInfo = `${screen.availWidth}x${screen.availHeight}`;
  const orientation = screen.orientation ? screen.orientation.type : 'unknown';
  
  return `${screenInfo}|${availInfo}|${orientation}`;
};

// Função para obter informações de fontes instaladas
const getFontsInfo = (): string => {
  const testFonts = [
    'Arial', 'Helvetica', 'Times New Roman', 'Times', 'Courier New', 'Courier',
    'Verdana', 'Georgia', 'Palatino', 'Garamond', 'Bookman', 'Comic Sans MS',
    'Trebuchet MS', 'Arial Black', 'Impact', 'Sans-serif', 'Serif', 'Monospace'
  ];
  
  const availableFonts: string[] = [];
  const testString = 'mmmmmmmmmmlli';
  const testSize = '72px';
  const baseWidth: { [key: string]: number } = {};
  
  // Criar canvas para testar largura do texto
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  if (!context) return 'no-canvas-fonts';
  
  // Medir larguras base com fontes padrão
  const baseFonts = ['serif', 'sans-serif', 'monospace'];
  baseFonts.forEach(font => {
    context.font = `${testSize} ${font}`;
    baseWidth[font] = context.measureText(testString).width;
  });
  
  // Testar cada fonte
  testFonts.forEach(font => {
    baseFonts.forEach(baseFont => {
      context.font = `${testSize} ${font}, ${baseFont}`;
      const width = context.measureText(testString).width;
      
      if (width !== baseWidth[baseFont]) {
        availableFonts.push(font);
      }
    });
  });
  
  return simpleHash(availableFonts.sort().join(','));
};

// Função principal para gerar Hardware ID
export const generateHardwareId = (): string => {
  try {
    // Verificar se já existe um ID salvo
    const existingId = localStorage.getItem('hardware_id');
    if (existingId && existingId.length > 0) {
      return existingId;
    }
    
    // Coletar todas as informações
    const components = [
      getCanvasFingerprint(),
      getWebGLFingerprint(),
      getLocaleInfo(),
      getHardwareInfo(),
      getScreenInfo(),
      getFontsInfo(),
      Date.now().toString(), // Timestamp para garantir unicidade
      Math.random().toString(36), // Componente aleatório adicional
    ];
    
    // Criar hash final
    const fullString = components.join('|');
    const hash1 = simpleHash(fullString);
    const hash2 = simpleHash(fullString.split('').reverse().join(''));
    
    // Combinar hashes e formatar
    const hardwareId = `${hash1}${hash2}`.substring(0, 12).toUpperCase();
    
    // Salvar no localStorage
    localStorage.setItem('hardware_id', hardwareId);
    
    console.log('Hardware ID gerado:', hardwareId);
    return hardwareId;
    
  } catch (error) {
    console.error('Erro ao gerar Hardware ID:', error);
    
    // Fallback: usar timestamp + random
    const fallbackId = `FB${Date.now().toString(36)}${Math.random().toString(36).substring(2, 8)}`.toUpperCase();
    localStorage.setItem('hardware_id', fallbackId);
    
    return fallbackId;
  }
};

// Função para obter Hardware ID existente (sem gerar novo)
export const getExistingHardwareId = (): string | null => {
  return localStorage.getItem('hardware_id');
};

// Função para limpar Hardware ID (para testes ou reset)
export const clearHardwareId = (): void => {
  localStorage.removeItem('hardware_id');
  console.log('Hardware ID removido');
};

// Função para validar formato do Hardware ID
export const isValidHardwareId = (id: string): boolean => {
  return /^[A-Z0-9]{8,15}$/.test(id);
};

// Função para obter informações detalhadas do sistema (para debug)
export const getSystemInfo = () => {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    languages: navigator.languages,
    cookieEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: (navigator as any).deviceMemory,
    connection: (navigator as any).connection?.effectiveType,
    screen: {
      width: screen.width,
      height: screen.height,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
    },
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    webgl: getWebGLFingerprint(),
    canvas: simpleHash(getCanvasFingerprint()),
    fonts: getFontsInfo(),
  };
};

// Hook React para usar Hardware ID (será implementado quando React estiver disponível)
// export const useHardwareId = () => {
//   const [hardwareId, setHardwareId] = useState<string>('');
//   const [isLoading, setIsLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
  
//   useEffect(() => {
//     try {
//       const id = generateHardwareId();
//       setHardwareId(id);
//       setError(null);
//     } catch (err) {
//       setError('Erro ao gerar Hardware ID');
//       console.error('Erro no useHardwareId:', err);
//     } finally {
//       setIsLoading(false);
//     }
//   }, []);
  
//   const regenerate = () => {
//     clearHardwareId();
//     setIsLoading(true);
//     setTimeout(() => {
//       try {
//         const id = generateHardwareId();
//         setHardwareId(id);
//         setError(null);
//       } catch (err) {
//         setError('Erro ao regenerar Hardware ID');
//       } finally {
//         setIsLoading(false);
//       }
//     }, 100);
//   };
  
//   return {
//     hardwareId,
//     isLoading,
//     error,
//     regenerate,
//     systemInfo: getSystemInfo(),
//   };
// };