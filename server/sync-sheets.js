import axios from 'axios';
import Papa from 'papaparse';
import Project from './models/Project.js';
import COLUMN_CONFIG from './column-config.js';
import { sequelize } from './db.js';

// ---------------------------------------------------------------------------
// Date utilities
// ---------------------------------------------------------------------------
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const CSV_TIMEOUT_MS = Number(process.env.CSV_TIMEOUT_MS || 45000);
const CSV_MAX_RETRIES = Number(process.env.CSV_MAX_RETRIES || 3);
const CSV_RETRY_BASE_DELAY_MS = Number(process.env.CSV_RETRY_BASE_DELAY_MS || 1500);

/** Parse a date string in DD/MM/YYYY or any JS-parseable format. Returns null if invalid. */
function parseDateStr(str) {
    if (!str) return null;
    if (str.includes('/')) {
        const parts = str.split('/');
        if (parts.length === 3) {
            const d = new Date(parts[2], parts[1] - 1, parts[0]);
            return isNaN(d.getTime()) ? null : d;
        }
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
}

/** Returns whole days elapsed since the given date string (positive = past). Returns null if unparseable. */
function daysSince(dateStr) {
    const date = parseDateStr(dateStr);
    if (!date) return null;
    return Math.floor((Date.now() - date.getTime()) / MS_PER_DAY);
}

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
    },
    {
        url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR7xtQIZa-2ihoUiMoCl1SlIcIGrWJoO-mGCgvBaHUVe4VG-hBbgEIoBEc9pYPf_segqcdKqzhEW8ga/pub?gid=1182505943&single=true&output=csv',
        city: 'MATUPÁ',
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
    'ID PROJETO', 'DATA INSTALAÇÃO', 'PARECER VISTORIA',
    'NUMERO', 'QNTD. PLACAS', 'POTÊNCIA PLACA (W)'
];

async function fetchAndParseCSV(url) {
    const response = await axios.get(url, { timeout: CSV_TIMEOUT_MS });
    return new Promise((resolve, reject) => {
        Papa.parse(response.data, {
            header: false, // Changed to false to get raw rows
            skipEmptyLines: true,
            complete: (results) => resolve(results.data),
            error: (err) => reject(err)
        });
    });
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSheetRowsWithRetry(sheet) {
    let lastError = null;

    for (let attempt = 1; attempt <= CSV_MAX_RETRIES; attempt++) {
        try {
            const rawRows = await fetchAndParseCSV(sheet.url);
            if (!rawRows || rawRows.length === 0) {
                throw new Error('Empty CSV response');
            }

            if (attempt > 1) {
                console.log(`[sync] ${sheet.city}/${sheet.type} recovered on attempt ${attempt}/${CSV_MAX_RETRIES}.`);
            }

            return rawRows;
        } catch (error) {
            lastError = error;
            const message = error?.message || 'Unknown error';
            console.error(`[sync] Failed to fetch ${sheet.city}/${sheet.type} (attempt ${attempt}/${CSV_MAX_RETRIES}): ${message}`);

            if (attempt < CSV_MAX_RETRIES) {
                const delay = CSV_RETRY_BASE_DELAY_MS * attempt;
                await sleep(delay);
            }
        }
    }

    throw new Error(lastError?.message || 'Unknown error');
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

function parseNumber(value) {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    if (!text) return null;

    // Keep only numeric symbols, then normalize locale decimal separators.
    const cleaned = text.replace(/[^0-9,.-]/g, '');
    if (!cleaned) return null;

    let normalized = cleaned;
    if (cleaned.includes(',') && cleaned.includes('.')) {
        normalized = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
            ? cleaned.replace(/\./g, '').replace(',', '.')
            : cleaned.replace(/,/g, '');
    } else if (cleaned.includes(',')) {
        normalized = cleaned.replace(',', '.');
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

async function syncSheets() {
    const allProjects = [];
    const failedSheets = [];

    for (const sheet of SHEETS_CONFIG) {
        try {
            const rawRows = await fetchSheetRowsWithRetry(sheet);
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

                // For STOPPED projects, determine which workflow stage they were at
                const stoppedStage = status === 'STOPPED' ? determineStoppedStage(rowObj) : null;

                let days = parseInt(getData('TEMPO ELABORAÇÃO O.S CONTINUO') || getData('TEMPO ELABORAÇÃO O.S') || 0);
                if (isNaN(days)) days = 0;

                // Calculate days since payment for GENERATE_OS
                if (status === 'GENERATE_OS') {
                    days = daysSince(getData('DATA PAGAMENTO')) ?? days;
                }

                // Vistoria Date & Status
                const vistoriaStatus = getData('STATUS VISTORIA');
                const vistoriaDateStr = getData('DATA SOLITAÇÃO VISTORIA');

                // Doc Conference & Protocol date calculations use the shared helper
                const docConfDateStr = getData('DATA FINALIZAÇÃO CONF.');
                const daysSinceDocConf = daysSince(docConfDateStr);

                const protocolDateStr = getData('DATA PROTOCOLO');
                const daysSinceProtocol = daysSince(protocolDateStr);
                const plateNumber = getData('NUMERO');
                const plateCountNumber = parseNumber(getData('QNTD. PLACAS'));
                const plateCount = plateCountNumber === null ? null : Math.round(plateCountNumber);
                const platePowerW = parseNumber(getData('POTÊNCIA PLACA (W)'));
                const plateTotalPowerKw = (plateCount !== null && platePowerW !== null)
                    ? Number(((plateCount * platePowerW) / 1000).toFixed(3))
                    : null;

                // Calculate days for Vistoria if active (TODAY - DATA SOLITAÇÃO VISTORIA)
                if (status === 'COMPLETED' && vistoriaDateStr) {
                    days = daysSince(vistoriaDateStr) ?? days;
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
                    plate_number: plateNumber,
                    plate_count: plateCount,
                    plate_power_w: platePowerW,
                    plate_total_power_kw: plateTotalPowerKw,
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
                    days_since_protocol: daysSinceProtocol,
                    install_status: getData('STATUS INSTALAÇÃO'),
                    stopped_stage: stoppedStage
                };
            }).filter(p => p !== null);

            allProjects.push(...validRows);
        } catch (error) {
            console.error(`Error fetching CSV from ${sheet.url}:`, error.message);
            failedSheets.push(`${sheet.city}/${sheet.type}`);
        }
    }

    if (failedSheets.length > 0) {
        throw new Error(`[sync] Sync aborted. ${failedSheets.length} sheet(s) failed: ${failedSheets.join(', ')}`);
    }

    if (allProjects.length === 0) {
        throw new Error('[sync] Sync aborted. No valid rows were parsed from sheets.');
    }

    // Use a transaction so that if bulkCreate fails, the data is NOT lost
    const t = await sequelize.transaction();
    try {
        await Project.destroy({ where: {}, truncate: true, transaction: t });
        await Project.bulkCreate(allProjects, { transaction: t });
        await t.commit();
    } catch (err) {
        await t.rollback();
        console.error('[sync] Transaction rolled back, database preserved:', err.message);
        throw err;
    }
}

function determineStoppedStage(row) {
    const osEmitida = (row['O.S EMITIDA?'] || '').trim().toUpperCase();
    const dataPagamento = (row['DATA PAGAMENTO'] || '').trim();
    const materialEntregue = (row['MATERIAL ENTREGUE P/ EQUIPE INSTALAÇÃO?'] || '').trim();
    const equipe = (row['EQUIPE INSTALAÇÃO'] || '').trim();
    const prioridade = (row['PRIORIDADE'] || '').trim();
    const statusInstalacao = (row['STATUS INSTALAÇÃO'] || '').trim().toUpperCase();

    // Same logic as determineStatus but WITHOUT the PARADO check — returns friendly label
    if ((osEmitida.length === 0 || osEmitida === 'NÃO' || osEmitida === 'NAO') && dataPagamento.length > 0)
        return 'Gerar O.S.';

    if (prioridade.length > 0 && materialEntregue.length === 0 && osEmitida.length > 0)
        return 'Prioridade p/ Entrega';

    if (materialEntregue === 'SIM' &&
        ((statusInstalacao !== 'EM EXECUÇÃO' && statusInstalacao !== 'EM ANDAMENTO') || equipe.length === 0))
        return 'Obras Entregues';

    if (equipe.length > 0)
        return 'Em Execução';

    if (osEmitida === 'SIM' && materialEntregue.length === 0 && dataPagamento.length > 0)
        return 'Obras a Entregar';

    return 'Indefinido';
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

    // -1. PARADO
    if (statusInstalacao === 'PARADO') return 'STOPPED';

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
