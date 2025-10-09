const ExcelJS = require('exceljs');

/**
 * Função para exportar dados para Excel
 */
const exportToExcel = async (data, options = {}) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(options.sheetName || 'Dados');
    
    // Metadados do arquivo
    workbook.creator = 'Sistema de Controle de Nodes';
    workbook.lastModifiedBy = 'Sistema';
    workbook.created = new Date();
    workbook.modified = new Date();
    
    // Definir colunas
    const columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Estado', key: 'estado', width: 20 },
      { header: 'Cidade', key: 'cidade', width: 25 },
      { header: 'Node', key: 'nodes', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Ativo', key: 'ativo', width: 10 },
      { header: 'Observação', key: 'observacao', width: 30 },
      { header: 'Usuário', key: 'usuario', width: 20 },
      { header: 'Usuário ID', key: 'usuario_id', width: 15 },
      { header: 'Data Criação', key: 'data_criacao', width: 20 },
      { header: 'Data Início', key: 'data_inicio', width: 20 },
      { header: 'Data Conclusão', key: 'data_conclusao', width: 20 },
      { header: 'Tempo Execução (min)', key: 'tempo_execucao', width: 20 }
    ];
    
    worksheet.columns = columns;
    
    // Estilo do cabeçalho
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '2563EB' } // Azul primary
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
    
    // Adicionar dados
    data.forEach((row, index) => {
      const worksheetRow = worksheet.addRow({
        id: row.id,
        estado: row.estado,
        cidade: row.cidade,
        nodes: row.nodes,
        status: row.status,
        ativo: row.ativo ? 'Sim' : 'Não',
        observacao: row.observacao || '',
        usuario: row.usuario || '',
        usuario_id: row.usuario_id || '',
        data_criacao: row.data_criacao ? new Date(row.data_criacao) : '',
        data_inicio: row.data_inicio ? new Date(row.data_inicio) : '',
        data_conclusao: row.data_conclusao ? new Date(row.data_conclusao) : '',
        tempo_execucao: row.tempo_execucao || ''
      });
      
      // Formatação condicional baseada no status
      const statusCell = worksheetRow.getCell('status');
      switch (row.status) {
        case 'Disponível':
          statusCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'D1FAE5' } // Verde claro
          };
          statusCell.font = { color: { argb: '065F46' } }; // Verde escuro
          break;
        case 'Em Execução':
          statusCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FEF3C7' } // Amarelo claro
          };
          statusCell.font = { color: { argb: '92400E' } }; // Amarelo escuro
          break;
        case 'Concluído':
          statusCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'DBEAFE' } // Azul claro
          };
          statusCell.font = { color: { argb: '1E3A8A' } }; // Azul escuro
          break;
      }
      
      // Formatação da coluna Ativo
      const ativoCell = worksheetRow.getCell('ativo');
      if (row.ativo) {
        ativoCell.font = { color: { argb: '059669' } }; // Verde
      } else {
        ativoCell.font = { color: { argb: 'DC2626' } }; // Vermelho
      }
      
      // Zebra striping
      if (index % 2 === 1) {
        worksheetRow.eachCell((cell) => {
          if (!cell.fill || !cell.fill.fgColor) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'F9FAFB' } // Cinza muito claro
            };
          }
        });
      }
      
      // Bordas
      worksheetRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'E5E7EB' } },
          left: { style: 'thin', color: { argb: 'E5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'E5E7EB' } },
          right: { style: 'thin', color: { argb: 'E5E7EB' } }
        };
      });
    });
    
    // Formatar colunas de data
    ['data_criacao', 'data_inicio', 'data_conclusao'].forEach(colKey => {
      const column = worksheet.getColumn(colKey);
      column.numFmt = 'dd/mm/yyyy hh:mm:ss';
    });
    
    // Auto-fit colunas (ajustar largura baseado no conteúdo)
    worksheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = Math.min(Math.max(maxLength + 2, 10), 50);
    });
    
    // Congelar primeira linha (cabeçalho)
    worksheet.views = [
      { state: 'frozen', ySplit: 1 }
    ];
    
    // Adicionar filtros automáticos
    worksheet.autoFilter = {
      from: 'A1',
      to: `M${data.length + 1}`
    };
    
    // Adicionar sumário no final
    if (data.length > 0) {
      const summaryRow = worksheet.addRow({});
      summaryRow.getCell(1).value = 'RESUMO:';
      summaryRow.getCell(1).font = { bold: true };
      
      const statsRow = worksheet.addRow({
        id: 'Total:',
        estado: data.length,
        cidade: 'Disponíveis:',
        nodes: data.filter(row => row.status === 'Disponível' && row.ativo).length,
        status: 'Em Execução:',
        ativo: data.filter(row => row.status === 'Em Execução').length,
        observacao: 'Concluídos:',
        usuario: data.filter(row => row.status === 'Concluído').length
      });
      
      statsRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'F3F4F6' }
        };
      });
    }
    
    // Gerar buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    return {
      success: true,
      buffer: buffer,
      filename: generateFilename(options.type),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
    
  } catch (error) {
    console.error('Erro ao exportar Excel:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Função para exportar relatório de usuários
 */
const exportUsersToExcel = async (users, options = {}) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Usuários');
    
    // Definir colunas para usuários
    const columns = [
      { header: 'Hardware ID', key: 'id', width: 15 },
      { header: 'Nome', key: 'nome', width: 25 },
      { header: 'Liberado', key: 'liberado', width: 12 },
      { header: 'Ativo', key: 'ativo', width: 10 },
      { header: 'Data Criação', key: 'data_criacao', width: 20 },
      { header: 'Último Acesso', key: 'ultimo_acesso', width: 20 },
      { header: 'Nodes Em Execução', key: 'nodes_em_execucao', width: 18 },
      { header: 'Nodes Concluídos', key: 'nodes_concluidos', width: 18 },
      { header: 'Total Nodes', key: 'total_nodes', width: 15 }
    ];
    
    worksheet.columns = columns;
    
    // Estilo do cabeçalho
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '059669' } // Verde
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    
    // Adicionar dados
    users.forEach((user) => {
      worksheet.addRow({
        id: user.id,
        nome: user.nome,
        liberado: user.liberado ? 'Sim' : 'Não',
        ativo: user.ativo ? 'Sim' : 'Não',
        data_criacao: user.data_criacao ? new Date(user.data_criacao) : '',
        ultimo_acesso: user.ultimo_acesso ? new Date(user.ultimo_acesso) : '',
        nodes_em_execucao: user.nodes_em_execucao || 0,
        nodes_concluidos: user.nodes_concluidos || 0,
        total_nodes: (user.nodes_em_execucao || 0) + (user.nodes_concluidos || 0)
      });
    });
    
    const buffer = await workbook.xlsx.writeBuffer();
    
    return {
      success: true,
      buffer: buffer,
      filename: `usuarios_${new Date().toISOString().split('T')[0]}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Função para gerar nome do arquivo
 */
const generateFilename = (type = 'all') => {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, ''); // HHMMSS
  
  const typeMap = {
    'all': 'nodes_completo',
    'today': 'nodes_hoje',
    'available': 'nodes_disponiveis',
    'completed': 'nodes_concluidos',
    'in-progress': 'nodes_em_execucao'
  };
  
  const filename = typeMap[type] || 'nodes_export';
  return `${filename}_${dateStr}_${timeStr}.xlsx`;
};

/**
 * Função para criar template de importação
 */
const createImportTemplate = async () => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Template Importação');
    
    // Definir colunas do template
    const columns = [
      { header: 'Estado', key: 'estado', width: 20 },
      { header: 'Cidade', key: 'cidade', width: 25 },
      { header: 'Nodes', key: 'nodes', width: 15 }
    ];
    
    worksheet.columns = columns;
    
    // Estilo do cabeçalho
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'DC2626' } // Vermelho
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    
    // Adicionar exemplos
    const examples = [
      { estado: 'São Paulo', cidade: 'Campinas', nodes: 'SP-001' },
      { estado: 'Rio de Janeiro', cidade: 'Niterói', nodes: 'RJ-001' },
      { estado: 'Minas Gerais', cidade: 'Belo Horizonte', nodes: 'MG-001' }
    ];
    
    examples.forEach(example => {
      worksheet.addRow(example);
    });
    
    // Adicionar instruções
    const instructionsRow = worksheet.addRow({});
    instructionsRow.getCell(1).value = 'INSTRUÇÕES:';
    instructionsRow.getCell(1).font = { bold: true };
    
    const instructions = [
      '1. Preencha os dados nas colunas Estado, Cidade e Nodes',
      '2. Não altere os nomes das colunas (cabeçalho)',
      '3. Não deixe células em branco',
      '4. Use nomes completos para Estados e Cidades',
      '5. Nodes podem ser códigos ou identificadores únicos'
    ];
    
    instructions.forEach(instruction => {
      const row = worksheet.addRow({});
      row.getCell(1).value = instruction;
    });
    
    const buffer = await workbook.xlsx.writeBuffer();
    
    return {
      success: true,
      buffer: buffer,
      filename: 'template_importacao_nodes.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  exportToExcel,
  exportUsersToExcel,
  generateFilename,
  createImportTemplate
};