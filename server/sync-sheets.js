import axios from 'axios';
import Papa from 'papaparse';
import Project from './models/Project.js';

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
        const response = await axios.get(url, { timeout: 10000 });
        return new Promise((resolve, reject) => {
            Papa.parse(response.data, {
                header: true,
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

async function syncSheets() {
    console.log('Starting Sync...');

    let allProjects = [];

    // Fetch all data first (in parallel or sequence)
    // Using simple loop for sequence to be safe with rate limits, or Promise.all for speed.
    // Given the small number, sequence is fine but moving the delete is key.
    for (const sheet of SHEETS_CONFIG) {
        const rows = await fetchAndParseCSV(sheet.url);
        console.log(`Fetched ${rows.length} rows for ${sheet.city}.`);

        const validRows = rows.map(row => {
            const status = determineStatus(row);
            const clientName = row['CLIENTE'] || row['CLIENTE '] || 'Desconhecido'; // Fix for trailing space in SINOP sheet

            // Cleanup logic if needed
            if (!clientName || clientName === 'Desconhecido') return null;
            if (!status) return null;

            let days = parseInt(row['TEMPO ELABORAÇÃO O.S CONTINUO'] || row['TEMPO ELABORAÇÃO O.S'] || 0);
            if (isNaN(days)) days = 0;

            // Vistoria Date & Status
            const vistoriaStatus = row['STATUS VISTORIA'] || null;
            const vistoriaDateStr = row['DATA SOLITAÇÃO VISTORIA'] || row['DATA VISTORIA'] || null;

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
                project_status: row['STATUS PROJETO'] || null,
                days: days,
                city: sheet.city,
                team: row['EQUIPE INSTALAÇÃO'] || '',
                details: row['OBSERVAÇÃO DA INSTALAÇÃO'] || '',
                external_id: row['ID PROJETO'] || null,
                vistoria_status: row['STATUS VISTORIA'] || null,
                vistoria_date: row['DATA SOLITAÇÃO VISTORIA'] || row['DATA VISTORIA'] || null,
                vistoria_deadline: null
            };
        }).filter(p => p !== null); // Remove empty/invalid

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

    // 2. DELIVERED (User Request: Material Delivered = SIM, Not Finalized, Not In Execution)
    // - Incluir Material Entregue = SIM
    // - Excluir Status = Finalizado
    // - Excluir Status = Em Execução
    const isDeliveredCandidate =
        materialEntregue === 'SIM' &&
        statusInstalacao !== 'FINALIZADO' &&
        statusInstalacao !== 'EM EXECUÇÃO' &&
        statusInstalacao !== 'EM ANDAMENTO';

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
