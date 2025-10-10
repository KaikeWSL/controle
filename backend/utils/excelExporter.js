const XLSX = require('xlsx');

// Exportar dados para Excel
const exportToExcel = (data, filename = 'export') => {
  try {
    // Criar um novo workbook
    const workbook = XLSX.utils.book_new();
    
    // Converter dados para worksheet
    const worksheet = XLSX.utils.json_to_sheet(data);
    
    // Configurar largura das colunas
    const colWidths = [
      { wch: 5 },   // ID
      { wch: 15 },  // Estado
      { wch: 20 },  // Cidade
      { wch: 15 },  // Nodes
      { wch: 12 },  // Status
      { wch: 8 },   // Ativo
      { wch: 30 },  // Observacao
      { wch: 15 },  // Usuario
      { wch: 20 },  // Data Inicio
      { wch: 20 }   // Data Conclusao
    ];
    worksheet['!cols'] = colWidths;
    
    // Adicionar worksheet ao workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Nodes');
    
    // Gerar buffer do arquivo Excel
    const buffer = XLSX.write(workbook, { 
      type: 'buffer', 
      bookType: 'xlsx',
      compression: true
    });
    
    return {
      success: true,
      buffer,
      filename: `${filename}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
    
  } catch (error) {
    console.error('Erro ao gerar Excel:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Formatar dados para exportação
const formatDataForExport = (nodes) => {
  return nodes.map(node => ({
    ID: node.id,
    Estado: node.estado,
    Cidade: node.cidade,
    Nodes: node.nodes,
    Status: node.status,
    Ativo: node.ativo ? 'Sim' : 'Não',
    Observacao: node.observacao || '',
    Usuario: node.usuario || '',
    'Data Inicio': node.data_inicio ? new Date(node.data_inicio).toLocaleString('pt-BR') : '',
    'Data Conclusao': node.data_conclusao ? new Date(node.data_conclusao).toLocaleString('pt-BR') : ''
  }));
};

module.exports = {
  exportToExcel,
  formatDataForExport
};