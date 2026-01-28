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
        const response = await axios.get(url);
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

    // Wipe and Replace Strategy
    // Note: In a real prod env with multiple sheets updating at different times, 
    // we might want to delete only by city, e.g. { where: { city: sheet.city } }
    // but for now, we wipe everything and re-fetch all configured sheets.
    await Project.destroy({ where: {}, truncate: true });

    let allProjects = [];

    for (const sheet of SHEETS_CONFIG) {
        const rows = await fetchAndParseCSV(sheet.url);
        console.log(`Fetched ${rows.length} rows for ${sheet.city}.`);

        const validRows = rows.map(row => {
            const status = determineStatus(row);
            const clientName = row['CLIENTE'] || 'Desconhecido';

            // Cleanup logic if needed
            if (!clientName || clientName === 'Desconhecido') return null;

            let days = parseInt(row['TEMPO ELABORAÇÃO O.S CONTINUO'] || row['TEMPO ELABORAÇÃO O.S'] || 0);
            if (isNaN(days)) days = 0;

            // Filter out rows that didn't match any status rule
            if (!status) return null;

            return {
                client: clientName,
                status: status,
                days: days,
                city: sheet.city,
                team: row['EQUIPE INSTALAÇÃO'] || '',
                details: row['OBSERVAÇÃO DA INSTALAÇÃO'] || '',
                external_id: row['ID PROJETO'] || null
            };
        }).filter(p => p !== null); // Remove empty/invalid

        allProjects.push(...validRows);
    }

    if (allProjects.length > 0) {
        await Project.bulkCreate(allProjects);
        console.log(`Synced ${allProjects.length} projects.`);
    } else {
        console.log("No valid projects found in sheet.");
    }
}

function determineStatus(row) {
    const statusInstalacao = (row['STATUS INSTALAÇÃO'] || '').trim().toUpperCase();
    const prioridade = (row['PRIORIDADE'] || '').trim();
    const materialEntregue = (row['MATERIAL ENTREGUE P/ EQUIPE INSTALAÇÃO?'] || '').trim();
    const osEmitida = (row['O.S EMITIDA?'] || '').trim().toUpperCase();
    const equipe = (row['EQUIPE INSTALAÇÃO'] || '').trim();
    const dataPagamento = (row['DATA PAGAMENTO'] || '').trim();

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

    // Default Fallback
    return null;
}

export default syncSheets;
