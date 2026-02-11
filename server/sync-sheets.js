import axios from 'axios';
import Papa from 'papaparse';
import Project from './models/Project.js';
import COLUMN_CONFIG from './column-config.js';

const SHEETS_CONFIG = [
    {
        url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQHlUaE1_7XtdwIBnBdpQslgLfuUF4nYkcb5naBD-r6wO1fvF71H7MSFS7aAgo23ZcWDV6NWNv60tXo/pub?gid=1627447881&single=true&output=csv',
        city: 'SORRISO',
        type: 'INSTALLATION'
    },
    {
        url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTPVWujNnTvpv-CDJ2FPYxytXxw0CiPDnmt_M5oxM6kBqQb6z25VvhbVHhsF78dI91RQAqSIVr9b8d8/pub?gid=190340504&single=true&output=csv',
        city: 'LUCAS DO RIO VERDE',
        type: 'INSTALLATION'
    },
    {
        url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTNNo3D9oIrM5zgIwMO13jNrxfom0AjKDxAQo52nNDDf4UV0xgs5uDBS1BKReo-9h4Nc74t-2JfZNk_/pub?gid=1627447881&single=true&output=csv',
        city: 'SINOP',
        type: 'INSTALLATION'
    },
    {
        url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR7xtQIZa-2ihoUiMoCl1SlIcIGrWJoO-mGCgvBaHUVe4VG-hBbgEIoBEc9pYPf_segqcdKqzhEW8ga/pub?gid=1094340291&single=true&output=csv',
        city: 'MATUPÁ',
        type: 'INSTALLATION'
    },
    // NEW PROJECT TABS
    {
        url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQHlUaE1_7XtdwIBnBdpQslgLfuUF4nYkcb5naBD-r6wO1fvF71H7MSFS7aAgo23ZcWDV6NWNv60tXo/pub?gid=99118266&single=true&output=csv',
        city: 'SORRISO',
        type: 'PROJECT'
    },
    {
        url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTPVWujNnTvpv-CDJ2FPYxytXxw0CiPDnmt_M5oxM6kBqQb6z25VvhbVHhsF78dI91RQAqSIVr9b8d8/pub?gid=1882866735&single=true&output=csv',
        city: 'LUCAS DO RIO VERDE',
        type: 'PROJECT'
    },
    {
        url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTNNo3D9oIrM5zgIwMO13jNrxfom0AjKDxAQo52nNDDf4UV0xgs5uDBS1BKReo-9h4Nc74t-2JfZNk_/pub?gid=99118266&single=true&output=csv',
        city: 'SINOP',
        type: 'PROJECT'
    }
];

// Columns to ignore warnings for in Installation Sheets
const INSTALLATION_IGNORE = [
    'TEM INVERSOR', 'PRAZO', 'PARECER VISTORIA', 'DATA 2° SOLITAÇÃO VISTORIA', 
    'DATA INSTALAÇÃO', 'STATUS PROJETO', 'STATUS MEDIDOR', 'STATUS APP', 'PRIORIDADE',
    'DATA FINALIZAÇÃO CONF.', 'ART EMITIDA?', 'OBSERVAÇÃO CONF.', 'DATA PROTOCOLO', 'DATA FINAL PREVISTA', 'DATA INICIAL OBRA', 'INSTALADOR', 'DATA VISTORIA', 'REVISADO E PROTOCOLADO'
];

// Columns to ignore warnings for in Project Sheets
const PROJECT_IGNORE = [
    'EQUIPE INSTALAÇÃO', 'OBSERVAÇÃO DA INSTALAÇÃO', 'STATUS INSTALAÇÃO', 
    'MATERIAL ENTREGUE P/ EQUIPE INSTALAÇÃO?', 'O.S EMITIDA?', 
    'TEMPO ELABORAÇÃO O.S', 'TEMPO ELABORAÇÃO O.S CONTINUO', 'PRIORIDADE',
    'STATUS VISTORIA', 'DATA SOLITAÇÃO VISTORIA',
    'TEM INVERSOR', 'PRAZO', 'STATUS MEDIDOR', 'STATUS APP', 'DATA 2° SOLITAÇÃO VISTORIA',
    'ID PROJETO', 'DATA INSTALAÇÃO', 'PARECER VISTORIA'
];

async function fetchAndParseCSV(url) {
    try {
        const response = await axios.get(url, { timeout: 30000 });
        return new Promise((resolve, reject) => {
            Papa.parse(response.data, {
                header: false, // Changed to false to get raw rows
                skipEmptyLines: true,
                complete: (results) => resolve(results.data),
                error: (err) => reject(err)
            });
        });
    } catch (error) {
        console.error(`Error fetching CSV from ${url}:`, error.message);
        return [];
    }
}

function resolveColumnIndices(headers, config, sheetType) {
    const map = {};
    const headerUpper = headers.map(h => (h || '').toString().trim().toUpperCase());

    for (const [key, settings] of Object.entries(config)) {
        let foundIndex = -1;

        // Try finding by Name
        for (const name of settings.names) {
            const idx = headerUpper.indexOf(name.toUpperCase());
            if (idx !== -1) {
                foundIndex = idx;
                // Handle duplicate header names (e.g. Sinop has two 'STATUS CONF. DOC.' columns)
                // The first occurrence is the date, the second is the status text
                if (key === 'DATA FINALIZAÇÃO CONF.' && name.toUpperCase() === 'STATUS CONF. DOC.') {
                     const firstIdx = headerUpper.indexOf('STATUS CONF. DOC.');
                     const lastIdx = headerUpper.lastIndexOf('STATUS CONF. DOC.');
                     if (firstIdx !== lastIdx) {
                         foundIndex = firstIdx;
                     }
                }
                break;
            }
        }

        // Fallback to Index
        if (foundIndex === -1) {
            // Check suppression lists
            const shouldIgnore = 
                (sheetType === 'INSTALLATION' && INSTALLATION_IGNORE.includes(key)) ||
                (sheetType === 'PROJECT' && PROJECT_IGNORE.includes(key));

            if (!shouldIgnore) {
                if (settings.index !== -1 && settings.index < headers.length) {
                    foundIndex = settings.index;
                } else {
                    console.warn(`[${sheetType || 'UNKNOWN'}] Column '${key}' not found and no valid fallback index.`);
                }
            }
        }

        map[key] = foundIndex;
    }
    return map;
}

function getValue(row, index) {
    if (index === -1 || ((index >= row.length) && index !== -1)) return '';
    return row[index] || ''; 
}

async function syncSheets() {

    let allProjects = [];

    for (const sheet of SHEETS_CONFIG) {
        const rawRows = await fetchAndParseCSV(sheet.url);

        if (rawRows.length === 0) continue;

        const headers = rawRows[0];
        const dataRows = rawRows.slice(1);
        const colMap = resolveColumnIndices(headers, COLUMN_CONFIG, sheet.type);

        const validRows = dataRows.map(row => {
            const getData = (key) => getValue(row, colMap[key]);

            const clientName = getData('CLIENTE');
            if (!clientName || clientName === 'Desconhecido') return null;

            // Reconstruct object for determineStatus
            const rowObj = {
                'STATUS INSTALAÇÃO': getData('STATUS INSTALAÇÃO'),
                'PRIORIDADE': getData('PRIORIDADE'),
                'MATERIAL ENTREGUE P/ EQUIPE INSTALAÇÃO?': getData('MATERIAL ENTREGUE P/ EQUIPE INSTALAÇÃO?'),
                'O.S EMITIDA?': getData('O.S EMITIDA?'),
                'EQUIPE INSTALAÇÃO': getData('EQUIPE INSTALAÇÃO'),
                'DATA PAGAMENTO': getData('DATA PAGAMENTO'),
                'STATUS PROJETO': getData('STATUS PROJETO')
            };

            const status = determineStatus(rowObj, sheet.type);
            if (!status) return null;

            let days = parseInt(getData('TEMPO ELABORAÇÃO O.S CONTINUO') || getData('TEMPO ELABORAÇÃO O.S') || 0);
            if (isNaN(days)) days = 0;

            // Calculate days since payment for GENERATE_OS
            if (status === 'GENERATE_OS') {
                const dataPagamentoStr = getData('DATA PAGAMENTO');
                if (dataPagamentoStr) {
                    const parts = dataPagamentoStr.split('/');
                    if (parts.length === 3) {
                        const pDate = new Date(parts[2], parts[1] - 1, parts[0]);
                        const today = new Date();
                        const diffTime = today - pDate;
                        days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    }
                }
            }

            // Vistoria Date & Status
            const vistoriaStatus = getData('STATUS VISTORIA');
            const vistoriaDateStr = getData('DATA SOLITAÇÃO VISTORIA');

            // Doc Conference Date Calculation
            const docConfDateStr = getData('DATA FINALIZAÇÃO CONF.');
            let daysSinceDocConf = null;

            if (docConfDateStr) {
                // Try DD/MM/YYYY
                let parts = docConfDateStr.split('/');
                if (parts.length === 3) {
                    const cDate = new Date(parts[2], parts[1] - 1, parts[0]);
                    if (!isNaN(cDate.getTime())) {
                        const today = new Date();
                        const diffTime = today - cDate;
                        daysSinceDocConf = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    }
                } else {
                    // Try YYYY-MM-DD or other standard formats
                    const cDate = new Date(docConfDateStr);
                    if (!isNaN(cDate.getTime())) {
                        const today = new Date();
                        const diffTime = today - cDate;
                        daysSinceDocConf = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    }
                }
            }

            // Protocol Date Calculation
            const protocolDateStr = getData('DATA PROTOCOLO');
            let daysSinceProtocol = null;

            if (protocolDateStr) {
                let parts = protocolDateStr.split('/');
                if (parts.length === 3) {
                    const cDate = new Date(parts[2], parts[1] - 1, parts[0]);
                    if (!isNaN(cDate.getTime())) {
                        const today = new Date();
                        const diffTime = today - cDate;
                        daysSinceProtocol = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    }
                } else {
                     const cDate = new Date(protocolDateStr);
                     if (!isNaN(cDate.getTime())) {
                         const today = new Date();
                         const diffTime = today - cDate;
                         daysSinceProtocol = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                     }
                }
            }

            // Calculate days for Vistoria if active (status is already determined above)
            if (status === 'COMPLETED' && vistoriaDateStr) {
                const parts = vistoriaDateStr.split('/');
                if (parts.length === 3) {
                    // DD/MM/YYYY
                    const vDate = new Date(parts[2], parts[1] - 1, parts[0]);
                    const today = new Date();
                    // User requested formula: TODAY - DATA SOLITAÇÃO VISTORIA
                    const diffTime = today - vDate;
                    days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                }
            }

            return {
                client: clientName,
                status: status,
                project_status: getData('STATUS PROJETO'),
                category: getData('CATEGORIA'),
                days: days,
                city: sheet.city,
                team: getData('EQUIPE INSTALAÇÃO'),
                details: getData('OBSERVAÇÃO DA INSTALAÇÃO') || getData('OBSERVAÇÃO'), 
                external_id: getData('ID PROJETO'),
                vistoria_status: vistoriaStatus,
                vistoria_date: vistoriaDateStr,
                vistoria_deadline: null,
                // New Fields
                seller: getData('VENDEDOR'),
                folder: getData('PASTA'),
                install_date: getData('DATA INSTALAÇÃO'), 
                has_inverter: getData('TEM INVERSOR'),
                deadline: getData('PRAZO'),
                vistoria_opinion: getData('PARECER VISTORIA'),
                meter_status: getData('STATUS MEDIDOR'),
                app_status: getData('STATUS APP'),
                vistoria_2nd_date: getData('DATA 2° SOLITAÇÃO VISTORIA'),
                days_since_doc_conf: daysSinceDocConf,
                doc_conf_date: docConfDateStr,
                protocol_date: protocolDateStr,
                days_since_protocol: daysSinceProtocol
            };
        }).filter(p => p !== null);

        allProjects.push(...validRows);
    }

    if (allProjects.length > 0) {
        // Critical: Only wipe DB once we have the new data ready
        await Project.destroy({ where: {}, truncate: true });

        await Project.bulkCreate(allProjects);
    }
}

function determineStatus(row, sheetType) {
    const statusInstalacao = (row['STATUS INSTALAÇÃO'] || '').trim().toUpperCase();
    const prioridade = (row['PRIORIDADE'] || '').trim();
    const materialEntregue = (row['MATERIAL ENTREGUE P/ EQUIPE INSTALAÇÃO?'] || '').trim();
    const osEmitida = (row['O.S EMITIDA?'] || '').trim().toUpperCase();
    const equipe = (row['EQUIPE INSTALAÇÃO'] || '').trim();
    const dataPagamento = (row['DATA PAGAMENTO'] || '').trim();
    const statusProjeto = (row['STATUS PROJETO'] || '').trim();

    if (sheetType === 'PROJECT') {
        return 'PROJECT';
    }

    // --- INSTALLATION SHEET LOGIC ---

    // 0. GENERATE O.S. (User Request)
    const isGenerateOSCandidate =
        (osEmitida.length === 0 || osEmitida === 'NÃO' || osEmitida === 'NAO') &&
        statusInstalacao !== 'FINALIZADO' &&
        dataPagamento.length > 0;

    if (isGenerateOSCandidate) return 'GENERATE_OS';

    // 1. PRIORITY LOGIC
    const isPriorityCandidate =
        prioridade.length > 0 &&
        statusInstalacao !== 'FINALIZADO' &&
        materialEntregue.length === 0 &&
        osEmitida.length > 0;

    if (isPriorityCandidate) return 'PRIORITY';

    // 2. DELIVERED
    const isDeliveredCandidate =
        materialEntregue === 'SIM' &&
        statusInstalacao !== 'FINALIZADO' &&
        (
            (statusInstalacao !== 'EM EXECUÇÃO' && statusInstalacao !== 'EM ANDAMENTO') ||
            equipe.length === 0
        );

    if (isDeliveredCandidate) return 'DELIVERED';

    // 3. IN EXECUTION
    const isInExecutionCandidate =
        equipe.length > 0 &&
        statusInstalacao !== 'FINALIZADO';

    if (isInExecutionCandidate) return 'IN_EXECUTION';

    // 4. TO DELIVER LOGIC
    const isToDeliverCandidate =
        osEmitida === 'SIM' &&
        materialEntregue.length === 0 &&
        statusInstalacao !== 'FINALIZADO' &&
        dataPagamento.length > 0;

    if (isToDeliverCandidate) return 'TO_DELIVER';

    // 5. COMPLETED (For Vistoria Analysis)
    if (statusInstalacao === 'FINALIZADO') {
        return 'COMPLETED';
    }

    // Default Fallback
    return null;
}

export default syncSheets;
