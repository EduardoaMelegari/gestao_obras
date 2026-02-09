import axios from 'axios';
import Papa from 'papaparse';
import Project from './models/Project.js';
import COLUMN_CONFIG from './column-config.js';

const SHEETS_CONFIG = [
    {
        url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQHlUaE1_7XtdwIBnBdpQslgLfuUF4nYkcb5naBD-r6wO1fvF71H7MSFS7aAgo23ZcWDV6NWNv60tXo/pub?gid=1627447881&single=true&output=csv',
        city: 'SORRISO'
    },
    {
        url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTPVWujNnTvpv-CDJ2FPYxytXxw0CiPDnmt_M5oxM6kBqQb6z25VvhbVHhsF78dI91RQAqSIVr9b8d8/pub?gid=190340504&single=true&output=csv',
        city: 'LUCAS DO RIO VERDE'
    },
    {
        url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTNNo3D9oIrM5zgIwMO13jNrxfom0AjKDxAQo52nNDDf4UV0xgs5uDBS1BKReo-9h4Nc74t-2JfZNk_/pub?gid=1627447881&single=true&output=csv',
        city: 'SINOP'
    },
    {
        url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR7xtQIZa-2ihoUiMoCl1SlIcIGrWJoO-mGCgvBaHUVe4VG-hBbgEIoBEc9pYPf_segqcdKqzhEW8ga/pub?gid=1094340291&single=true&output=csv',
        city: 'MATUPÁ'
    }

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

function resolveColumnIndices(headers, config) {
    const map = {};
    const headerUpper = headers.map(h => (h || '').toString().trim().toUpperCase());

    for (const [key, settings] of Object.entries(config)) {
        let foundIndex = -1;

        // Try finding by Name
        for (const name of settings.names) {
            const idx = headerUpper.indexOf(name.toUpperCase());
            if (idx !== -1) {
                foundIndex = idx;
                break;
            }
        }

        // Fallback to Index
        if (foundIndex === -1) {
            if (settings.index !== -1 && settings.index < headers.length) {
                console.warn(`Column '${key}' not found by name. Falling back to index ${settings.index}.`);
                foundIndex = settings.index;
            } else {
                console.warn(`Column '${key}' not found and no valid fallback index.`);
            }
        }

        map[key] = foundIndex;
    }
    return map;
}

function getValue(row, index) {
    if (index === -1 || index >= row.length) return '';
    return row[index] || '';
}

async function syncSheets() {
    console.log('Starting Sync...');

    let allProjects = [];

    for (const sheet of SHEETS_CONFIG) {
        const rawRows = await fetchAndParseCSV(sheet.url);
        console.log(`Fetched ${rawRows.length} rows for ${sheet.city}.`);

        if (rawRows.length === 0) continue;

        const headers = rawRows[0];
        const dataRows = rawRows.slice(1);
        const colMap = resolveColumnIndices(headers, COLUMN_CONFIG);

        const validRows = dataRows.map(row => {
            const getData = (key) => getValue(row, colMap[key]);

            // Reconstruct object for determineStatus
            const rowObj = {
                'STATUS INSTALAÇÃO': getData('STATUS INSTALAÇÃO'),
                'PRIORIDADE': getData('PRIORIDADE'),
                'MATERIAL ENTREGUE P/ EQUIPE INSTALAÇÃO?': getData('MATERIAL ENTREGUE P/ EQUIPE INSTALAÇÃO?'),
                'O.S EMITIDA?': getData('O.S EMITIDA?'),
                'EQUIPE INSTALAÇÃO': getData('EQUIPE INSTALAÇÃO'),
                'DATA PAGAMENTO': getData('DATA PAGAMENTO')
            };

            const status = determineStatus(rowObj);
            const clientName = getData('CLIENTE');

            // Cleanup logic if needed
            if (!clientName || clientName === 'Desconhecido') return null;
            if (!status) return null;

            let days = parseInt(getData('TEMPO ELABORAÇÃO O.S CONTINUO') || getData('TEMPO ELABORAÇÃO O.S') || 0);
            if (isNaN(days)) days = 0;

            // Fix for LUCAS DO RIO VERDE (and others) where O.S. days might not be calculated in sheet
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
                details: getData('OBSERVAÇÃO DA INSTALAÇÃO'),
                external_id: getData('ID PROJETO'),
                vistoria_status: vistoriaStatus,
                vistoria_date: vistoriaDateStr,
                vistoria_status: vistoriaStatus,
                vistoria_date: vistoriaDateStr,
                vistoria_deadline: null,
                // New Fields
                seller: getData('VENDEDOR'),
                folder: getData('PASTA')
            };
        }).filter(p => p !== null);

        // Removed Debug Logs

        allProjects.push(...validRows);
    }

    if (allProjects.length > 0) {
        // Critical: Only wipe DB once we have the new data ready
        await Project.destroy({ where: {}, truncate: true });

        await Project.bulkCreate(allProjects);
        console.log(`Synced ${allProjects.length} projects.`);
    } else {
        console.log("No valid projects found in sheet. Taking no action to preserve existing data.");
    }
}

function determineStatus(row) {
    const statusInstalacao = (row['STATUS INSTALAÇÃO'] || '').trim().toUpperCase();
    const prioridade = (row['PRIORIDADE'] || '').trim();
    const materialEntregue = (row['MATERIAL ENTREGUE P/ EQUIPE INSTALAÇÃO?'] || '').trim();
    const osEmitida = (row['O.S EMITIDA?'] || '').trim().toUpperCase();
    const equipe = (row['EQUIPE INSTALAÇÃO'] || '').trim();
    const dataPagamento = (row['DATA PAGAMENTO'] || '').trim();

    // 0. GENERATE O.S. (User Request)
    // - O.S Emitida == Nulo/Empty OR "NÃO"
    // - Status Instalação != Finalizado
    // - Data Pagamento != Nulo
    const isGenerateOSCandidate =
        (osEmitida.length === 0 || osEmitida === 'NÃO' || osEmitida === 'NAO') &&
        statusInstalacao !== 'FINALIZADO' &&
        dataPagamento.length > 0;

    if (isGenerateOSCandidate) {
        return 'GENERATE_OS';
    }

    // 1. PRIORITY LOGIC
    // - Prioridade != Nulo
    // - Status Instalação != Finalizado
    // - Material Entregue == Nulo
    // - O.S Emitida != Nulo (assuming any value is fine based on previous prompt, or should it match 'SIM' too? adhering to previous prompt 'not null')
    const isPriorityCandidate =
        prioridade.length > 0 &&
        statusInstalacao !== 'FINALIZADO' &&
        materialEntregue.length === 0 &&
        osEmitida.length > 0;

    if (isPriorityCandidate) {
        return 'PRIORITY';
    }

    // 2. DELIVERED
    // - Incluir Material Entregue = SIM
    // - Excluir Status = Finalizado
    // - Excluir Status = Em Execução/Andamento APENAS SE tiver equipe definida
    // (Se estiver em execução mas sem equipe, considera como Entregue/Aguardando Equipe)
    const isDeliveredCandidate =
        materialEntregue === 'SIM' &&
        statusInstalacao !== 'FINALIZADO' &&
        (
            (statusInstalacao !== 'EM EXECUÇÃO' && statusInstalacao !== 'EM ANDAMENTO') ||
            equipe.length === 0
        );

    if (isDeliveredCandidate) {
        return 'DELIVERED';
    }

    // 3. IN EXECUTION (User Request)
    // - Excluir se Equipe = Nulo
    // - Incluir se Status = Em Execução (Covered by !Finalizado + Has Team usually, strict adherence below)
    // - Excluir se Status = Finalizado
    const isInExecutionCandidate =
        equipe.length > 0 &&
        statusInstalacao !== 'FINALIZADO';

    if (isInExecutionCandidate) {
        return 'IN_EXECUTION';
    }

    // 4. TO DELIVER LOGIC (User Request)
    // - O.S Emitida == SIM
    // - Material Entregue == Nulo
    // - Status Instalação != Finalizado
    // - Data Pagamento != Nulo
    const isToDeliverCandidate =
        osEmitida === 'SIM' &&
        materialEntregue.length === 0 &&
        statusInstalacao !== 'FINALIZADO' &&
        dataPagamento.length > 0;

    if (isToDeliverCandidate) {
        return 'TO_DELIVER';
    }

    // 5. COMPLETED (For Vistoria Analysis)
    // - Status Instalação == 'FINALIZADO'
    // This allows these projects to be in the DB so we can check "Solicitar Vistorias"
    if (statusInstalacao === 'FINALIZADO') {
        return 'COMPLETED';
    }

    // Default Fallback
    return null;
}

export default syncSheets;
