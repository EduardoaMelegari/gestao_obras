
const COLUMN_CONFIG = {
    // 0: DATA
    'CLIENTE': { names: ['CLIENTE', 'CLIENTE '], index: 1 },
    // 2: PASTA
    // 3: VENDEDOR
    // 4: PAGAMENTO
    'DATA PAGAMENTO': { names: ['DATA PAGAMENTO'], index: 5 },
    // 6: CATEGORIA
    'CATEGORIA': { names: ['CATEGORIA'], index: 6 },
    // 7: TRIAGEM
    // 8: STATUS CONF. DOC.
    // 9: PROJETISTA
    'STATUS PROJETO': { names: ['STATUS PROJETO'], index: 10 },
    // 11: LIBERADO INSTALAÇÃO
    'ID PROJETO': { names: ['ID PROJETO', 'N° ORDEM SERVICO (OS)'], index: 12 }, 
    'O.S EMITIDA?': { names: ['O.S EMITIDA?', 'O.S. EMITIDA?'], index: 13 },
    'TEMPO ELABORAÇÃO O.S': { names: ['TEMPO ELABORAÇÃO O.S'], index: 14 },
    'TEMPO ELABORAÇÃO O.S CONTINUO': { names: ['TEMPO ELABORAÇÃO O.S CONTINUO'], index: 15 },
    // 16: MATERIAL SEPARADO?
    // 17: OBSERVAÇÃO
    'MATERIAL ENTREGUE P/ EQUIPE INSTALAÇÃO?': { names: ['MATERIAL ENTREGUE P/ EQUIPE INSTALAÇÃO?', 'MATERIAL ENTREGUE?'], index: 18 },
    // 19: DATA ENTREGA MATERIAL
    // 20: CIDADE
    // ...
    // 35: EQUIPE INSTALAÇÃO
    'EQUIPE INSTALAÇÃO': { names: ['EQUIPE INSTALAÇÃO'], index: 35 },
    'STATUS INSTALAÇÃO': { names: ['STATUS INSTALAÇÃO'], index: 36 },
    // 37: OBSERVAÇÃO_2 (Usually Observation of Installation)
    'OBSERVAÇÃO DA INSTALAÇÃO': { names: ['OBSERVAÇÃO DA INSTALAÇÃO', 'OBSERVAÇÃO_2'], index: 37 },
    'STATUS VISTORIA': { names: ['STATUS VISTORIA'], index: 38 },
    // ...
    'DATA SOLITAÇÃO VISTORIA': { names: ['DATA SOLITAÇÃO VISTORIA', 'DATA VISTORIA'], index: 41 },
    
    // Non-Lucas fields (Likely Sorriso indices might differ, but we need defaults)
    // If Sorriso has PRIORIDADE at 12? No, let's just guess or use name.
    'PRIORIDADE': { names: ['PRIORIDADE'], index: -1 } // -1 means if name not found, don't fallback to a dangerous index
};

export default COLUMN_CONFIG;
