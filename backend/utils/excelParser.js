const XLSX = require('xlsx');
const path = require('path');

/**
 * Função para validar estrutura do Excel
 */
const validateExcelStructure = (worksheet) => {
  const headers = ['estado', 'cidade', 'nodes'];
  const range = XLSX.utils.decode_range(worksheet['!ref']);
  
  // Verificar se tem pelo menos as 3 colunas obrigatórias
  if (range.e.c < 2) {
    throw new Error('O arquivo deve ter pelo menos 3 colunas: Estado, Cidade, Nodes');
  }
  
  // Verificar cabeçalhos (primeira linha)
  const firstRow = [];
  for (let col = 0; col <= range.e.c && col < 3; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    const cell = worksheet[cellAddress];
    firstRow.push(cell ? cell.v.toString().toLowerCase().trim() : '');
  }
  
  // Verificar se os cabeçalhos estão corretos
  const hasValidHeaders = headers.every((header, index) => 
    firstRow[index] && firstRow[index].includes(header)
  );
  
  if (!hasValidHeaders) {
    throw new Error(`Cabeçalhos incorretos. Esperado: Estado, Cidade, Nodes. Encontrado: ${firstRow.join(', ')}`);
  }
  
  return true;
};

/**
 * Função para processar arquivo Excel
 */
const parseExcelFile = (buffer, filename) => {
  try {
    // Verificar extensão do arquivo
    const ext = path.extname(filename).toLowerCase();
    if (!['.xlsx', '.xls'].includes(ext)) {
      throw new Error('Formato de arquivo não suportado. Use .xlsx ou .xls');
    }
    
    // Ler arquivo Excel
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    // Pegar primeira planilha
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error('Nenhuma planilha encontrada no arquivo');
    }
    
    const worksheet = workbook.Sheets[sheetName];
    
    // Validar estrutura
    validateExcelStructure(worksheet);
    
    // Converter para JSON (pular primeira linha - cabeçalhos)
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: ['estado', 'cidade', 'nodes'],
      range: 1 // Pular primeira linha
    });
    
    if (jsonData.length === 0) {
      throw new Error('Arquivo não contém dados válidos');
    }
    
    // Validar e limpar dados
    const validData = [];
    const errors = [];
    
    jsonData.forEach((row, index) => {
      const lineNumber = index + 2; // +2 porque pulamos cabeçalho e array é 0-based
      
      // Verificar campos obrigatórios
      if (!row.estado || !row.cidade || !row.nodes) {
        errors.push(`Linha ${lineNumber}: Campos obrigatórios não preenchidos`);
        return;
      }
      
      // Limpar e validar dados
      const cleanRow = {
        estado: row.estado.toString().trim(),
        cidade: row.cidade.toString().trim(),
        nodes: row.nodes.toString().trim()
      };
      
      // Validações específicas
      if (cleanRow.estado.length < 2) {
        errors.push(`Linha ${lineNumber}: Estado deve ter pelo menos 2 caracteres`);
        return;
      }
      
      if (cleanRow.cidade.length < 2) {
        errors.push(`Linha ${lineNumber}: Cidade deve ter pelo menos 2 caracteres`);
        return;
      }
      
      if (cleanRow.nodes.length < 1) {
        errors.push(`Linha ${lineNumber}: Node deve ter pelo menos 1 caractere`);
        return;
      }
      
      validData.push(cleanRow);
    });
    
    return {
      success: true,
      data: validData,
      errors: errors,
      totalRows: jsonData.length,
      validRows: validData.length,
      invalidRows: errors.length,
      summary: {
        filename: filename,
        totalLinhas: jsonData.length,
        linhasValidas: validData.length,
        linhasComErro: errors.length,
        estados: [...new Set(validData.map(row => row.estado))].length,
        cidades: [...new Set(validData.map(row => row.cidade))].length
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      data: [],
      errors: [error.message]
    };
  }
};

/**
 * Função para preview do arquivo (primeiras 10 linhas)
 */
const previewExcelFile = (buffer, filename) => {
  try {
    const result = parseExcelFile(buffer, filename);
    
    if (!result.success) {
      return result;
    }
    
    return {
      ...result,
      data: result.data.slice(0, 10), // Apenas primeiras 10 linhas para preview
      isPreview: true,
      totalData: result.data.length
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      data: []
    };
  }
};

/**
 * Função para validar dados antes de inserir
 */
const validateNodeData = (nodeData) => {
  const errors = [];
  
  if (!nodeData.estado || typeof nodeData.estado !== 'string' || nodeData.estado.trim().length < 2) {
    errors.push('Estado é obrigatório e deve ter pelo menos 2 caracteres');
  }
  
  if (!nodeData.cidade || typeof nodeData.cidade !== 'string' || nodeData.cidade.trim().length < 2) {
    errors.push('Cidade é obrigatória e deve ter pelo menos 2 caracteres');
  }
  
  if (!nodeData.nodes || typeof nodeData.nodes !== 'string' || nodeData.nodes.trim().length < 1) {
    errors.push('Node é obrigatório e deve ter pelo menos 1 caractere');
  }
  
  // Validações adicionais
  if (nodeData.estado && nodeData.estado.length > 50) {
    errors.push('Estado não pode ter mais que 50 caracteres');
  }
  
  if (nodeData.cidade && nodeData.cidade.length > 100) {
    errors.push('Cidade não pode ter mais que 100 caracteres');
  }
  
  if (nodeData.nodes && nodeData.nodes.length > 100) {
    errors.push('Node não pode ter mais que 100 caracteres');
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
};

/**
 * Função para normalizar dados (capitalizar nomes)
 */
const normalizeData = (data) => {
  return {
    estado: data.estado.trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' '),
    cidade: data.cidade.trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' '),
    nodes: data.nodes.trim().toUpperCase()
  };
};

module.exports = {
  parseExcelFile,
  previewExcelFile,
  validateExcelStructure,
  validateNodeData,
  normalizeData
};