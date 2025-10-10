const XLSX = require('xlsx');

// Parser para arquivos Excel
const parseExcelFile = (fileBuffer) => {
  try {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Converter para JSON
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (data.length === 0) {
      throw new Error('Arquivo Excel vazio');
    }
    
    // Verificar se tem pelo menos o cabeçalho
    if (data.length < 2) {
      throw new Error('Arquivo deve conter pelo menos uma linha de dados além do cabeçalho');
    }
    
    const headers = data[0];
    const expectedHeaders = ['Estado', 'Cidade', 'Nodes'];
    
    // Verificar se tem as 3 colunas obrigatórias
    if (headers.length < 3) {
      throw new Error('Arquivo deve conter exatamente 3 colunas: Estado, Cidade, Nodes');
    }
    
    const nodes = [];
    const errors = [];
    
    // Processar cada linha (começando da linha 1, pois 0 é o cabeçalho)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // Pular linhas completamente vazias
      if (!row || row.every(cell => !cell || cell.toString().trim() === '')) {
        continue;
      }
      
      const estado = row[0] ? row[0].toString().trim() : '';
      const cidade = row[1] ? row[1].toString().trim() : '';
      const node = row[2] ? row[2].toString().trim() : '';
      
      // Validar se todos os campos obrigatórios estão preenchidos
      if (!estado || !cidade || !node) {
        errors.push({
          linha: i + 1,
          erro: 'Linha com campos vazios',
          dados: { estado, cidade, node }
        });
        continue;
      }
      
      nodes.push({
        estado,
        cidade,
        nodes: node
      });
    }
    
    return {
      success: true,
      nodes,
      errors,
      totalLinhas: data.length - 1,
      linhasProcessadas: nodes.length,
      linhasComErro: errors.length
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      nodes: [],
      errors: []
    };
  }
};

module.exports = {
  parseExcelFile
};