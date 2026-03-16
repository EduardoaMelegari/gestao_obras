import express from 'express';
import cors from 'cors';
import { sequelize, Op } from './db.js';
import Project from './models/Project.js';
import AccessLog from './models/AccessLog.js';
import syncSheets from './sync-sheets.js';
import https from 'https';

const app = express();
const PORT = process.env.PORT || 36006;

app.use(cors());
app.use(express.json());
app.use('/api', (req, res, next) => {
    // Prevent stale API responses in browser/proxy caches.
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    next();
});

// ---------------------------------------------------------------------------
// Global Version Tracking (Force Refresh)
// ---------------------------------------------------------------------------
let currentVersion = Date.now().toString(); // Initialize with server start time

app.get('/api/version', (req, res) => {
    res.json({ version: currentVersion });
});

app.post('/api/admin/reset-version', (req, res) => {
    currentVersion = Date.now().toString();
    console.log(`[Admin] Version reset to: ${currentVersion}`);
    res.json({ success: true, version: currentVersion });
});

// ---------------------------------------------------------------------------
// Active user session tracking
// ---------------------------------------------------------------------------
const activeSessions = new Map(); // sessionId -> { ip, geo, lastSeen, userAgent }
const SESSION_TIMEOUT_MS = 90 * 1000; // 90 seconds without ping = inactive

function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return forwarded.split(',')[0].trim();
    return req.socket?.remoteAddress || req.ip || 'unknown';
}

function fetchGeo(ip) {
    return new Promise((resolve) => {
        const unknown = { city: '-', region: '-', country: '-', lat: null, lon: null };

        // Skip private/loopback IPs
        if (!ip || ip === 'unknown' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.') || ip === '::1') {
            resolve({ city: 'Local', region: '-', country: 'LAN', lat: null, lon: null });
            return;
        }

        // ipinfo.io supports both IPv4 and IPv6 natively (free, 50k req/month, no key needed)
        const url = `https://ipinfo.io/${ip}/json`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    // loc comes as "lat,lon"
                    let lat = null, lon = null;
                    if (json.loc) {
                        const parts = json.loc.split(',');
                        lat = parseFloat(parts[0]);
                        lon = parseFloat(parts[1]);
                    }
                    resolve({
                        city: json.city || '-',
                        region: json.region || '-',
                        country: json.country || '-',
                        lat,
                        lon,
                    });
                } catch {
                    resolve(unknown);
                }
            });
        }).on('error', () => resolve(unknown));
    });
}

function parseBrowser(ua = '') {
    if (ua.includes('Edg/') || ua.includes('Edge/')) return 'Edge';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('OPR') || ua.includes('Opera')) return 'Opera';
    return 'Outro';
}

// Ping endpoint — clients call this every 30s
app.post('/api/ping', async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const now = new Date();

    if (activeSessions.has(sessionId)) {
        const session = activeSessions.get(sessionId);
        session.lastSeen = now;
        session.ip = ip;
    } else {
        // New session — fetch geo async, then persist to AccessLog
        const session = { ip, geo: null, lastSeen: now, userAgent, connectedAt: now };
        activeSessions.set(sessionId, session);
        fetchGeo(ip).then(async (geo) => {
            if (activeSessions.has(sessionId)) {
                activeSessions.get(sessionId).geo = geo;
            }
            try {
                await AccessLog.create({
                    sessionId,
                    ip,
                    city: geo.city,
                    region: geo.region,
                    country: geo.country,
                    lat: geo.lat,
                    lon: geo.lon,
                    userAgent,
                    browser: parseBrowser(userAgent),
                    accessedAt: now,
                });
            } catch (e) {
                console.error('[AccessLog] Failed to persist:', e.message);
            }
        });
    }

    res.json({ ok: true });
});

// Admin stats endpoint
app.get('/api/admin/stats', async (req, res) => {
    const now = Date.now();

    // Prune timed-out sessions
    for (const [id, s] of activeSessions.entries()) {
        if (now - new Date(s.lastSeen).getTime() > SESSION_TIMEOUT_MS) {
            activeSessions.delete(id);
        }
    }

    const sessions = Array.from(activeSessions.entries()).map(([id, s]) => ({
        id: id.slice(0, 8),
        ip: s.ip,
        geo: s.geo,
        userAgent: s.userAgent,
        connectedAt: s.connectedAt,
        lastSeen: s.lastSeen,
        secondsOnline: Math.floor((now - new Date(s.connectedAt).getTime()) / 1000),
    }));

    // Aggregate KPIs from DB
    try {
        const [totalProjects, byCity, byCategory, byStatus, lastSync] = await Promise.all([
            Project.count({ where: { status: { [Op.in]: ['PROJECT'] } } }),
            Project.findAll({
                where: { status: 'PROJECT' },
                attributes: ['city', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
                group: ['city'],
                order: [[sequelize.literal('count'), 'DESC']]
            }),
            Project.findAll({
                where: { status: 'PROJECT' },
                attributes: ['category', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
                group: ['category'],
                order: [[sequelize.literal('count'), 'DESC']]
            }),
            Project.findAll({
                where: { status: 'PROJECT' },
                attributes: ['project_status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
                group: ['project_status'],
                order: [[sequelize.literal('count'), 'DESC']]
            }),
            Promise.resolve(lastSuccessfulSync)
        ]);

        // Access log history + total count
        const [totalAccesses, accessHistory] = await Promise.all([
            AccessLog.count(),
            AccessLog.findAll({
                order: [['accessedAt', 'DESC']],
                limit: 200,
            }),
        ]);

        res.json({
            activeUsers: sessions.length,
            sessions,
            totalAccesses,
            accessHistory: accessHistory.map(a => ({
                id: a.id,
                ip: a.ip,
                city: a.city,
                region: a.region,
                country: a.country,
                lat: a.lat,
                lon: a.lon,
                browser: a.browser,
                userAgent: a.userAgent,
                accessedAt: a.accessedAt,
            })),
            kpi: {
                totalProjects,
                byCity: byCity.map(r => ({ label: r.city, count: parseInt(r.get('count')) })),
                byCategory: byCategory.map(r => ({ label: r.category, count: parseInt(r.get('count')) })),
                byStatus: byStatus.map(r => ({ label: r.project_status, count: parseInt(r.get('count')) })),
            },
            lastSync,
            serverTime: new Date(),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------------------------------------------------------------------
// Helper: build a Sequelize WHERE clause from multi-value query string params
// Supports ?city=A,B or ?city=A&city=B patterns.
// ---------------------------------------------------------------------------
function buildFilterClause(query, fields = ['city', 'category', 'seller']) {
    const where = {};
    for (const field of fields) {
        const val = query[field];
        if (!val) continue;
        if (Array.isArray(val)) {
            where[field] = { [Op.in]: val };
        } else if (val.includes(',')) {
            where[field] = { [Op.in]: val.split(',') };
        } else {
            where[field] = val;
        }
    }
    return where;
}

function parseDateString(value) {
    if (!value) return null;
    const raw = String(value).trim();
    if (!raw) return null;

    const normalized = raw
        .replace(/[^0-9/-]/g, '')
        .replace(/\/+/g, '/')
        .replace(/-+/g, '-')
        .replace(/^[/\\-]+|[/\\-]+$/g, '');

    if (normalized.includes('/') || normalized.includes('-')) {
        const separator = normalized.includes('/') ? '/' : '-';
        const parts = normalized.split(separator).filter(Boolean);
        if (parts.length === 3) {
            if (parts[0].length === 4) {
                const [yyyy, mm, dd] = parts;
                const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
                return Number.isNaN(d.getTime()) ? null : d;
            }
            const [dd, mm, yyyy] = parts;
            const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
            return Number.isNaN(d.getTime()) ? null : d;
        }
    }

    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

// Tracks the timestamp of the last successful Google Sheets → DB sync
function toPlainProject(project) {
    if (project && typeof project.get === 'function') {
        return project.get({ plain: true });
    }
    return project;
}

function daysSinceDateString(value) {
    const parsed = parseDateString(value);
    if (!parsed) return null;

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const parsedStart = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    const diffMs = todayStart.getTime() - parsedStart.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function isAmpliacaoProject(project) {
    return String(project?.category || '').toUpperCase().includes('AMPLIA');
}

function resolveAmpliacaoVistoriaDays(project) {
    const vistoriaStatus = String(project?.vistoria_status || '').trim().toUpperCase();
    if (vistoriaStatus === 'SOLICITADO') {
        const byVistoriaDate = daysSinceDateString(project?.vistoria_date);
        if (byVistoriaDate !== null) return byVistoriaDate;
    }

    const byInstallDate = daysSinceDateString(project?.install_date);
    if (byInstallDate !== null) return byInstallDate;

    const byDocConfDate = daysSinceDateString(project?.doc_conf_date);
    if (byDocConfDate !== null) return byDocConfDate;

    const fallbackDays = Number(project?.days);
    return Number.isFinite(fallbackDays) ? fallbackDays : 0;
}

function normalizeVistoriaItems(list = []) {
    return list.map((item) => {
        const plain = toPlainProject(item);
        if (!isAmpliacaoProject(plain)) return plain;
        return {
            ...plain,
            days: resolveAmpliacaoVistoriaDays(plain),
        };
    });
}

function buildVistoriaDedupKey(project) {
    const city = normalizeSortText(project?.city);
    const folder = normalizeSortText(project?.folder);
    if (folder) return `FOLDER:${folder}|CITY:${city}`;

    const externalId = normalizeSortText(project?.external_id);
    if (externalId) return `EXTERNAL:${externalId}|CITY:${city}`;

    const client = normalizeSortText(project?.client);
    const vistoriaDate = normalizeSortText(project?.vistoria_date);
    const installDate = normalizeSortText(project?.install_date);
    return `CLIENT:${client}|CITY:${city}|VIST:${vistoriaDate}|INST:${installDate}`;
}

function scoreVistoriaRecord(project) {
    let score = 0;
    if (normalizeSortText(project?.folder)) score += 2;
    if (normalizeSortText(project?.external_id)) score += 2;
    if (normalizeSortText(project?.vistoria_date)) score += 1;
    if (normalizeSortText(project?.install_date)) score += 1;
    if (normalizeSortText(project?.doc_conf_date)) score += 1;
    return score;
}

function shouldReplaceVistoriaRecord(current, next) {
    if (next?.status === 'PROJECT' && current?.status !== 'PROJECT') return true;
    if (current?.status === 'PROJECT' && next?.status !== 'PROJECT') return false;

    const currentScore = scoreVistoriaRecord(current);
    const nextScore = scoreVistoriaRecord(next);
    if (nextScore !== currentScore) return nextScore > currentScore;

    const currentUpdated = current?.updatedAt ? new Date(current.updatedAt).getTime() : 0;
    const nextUpdated = next?.updatedAt ? new Date(next.updatedAt).getTime() : 0;
    return nextUpdated > currentUpdated;
}

function dedupeVistoriaItems(list = []) {
    const map = new Map();

    for (const item of list) {
        const key = buildVistoriaDedupKey(item);
        if (!map.has(key)) {
            map.set(key, item);
            continue;
        }

        const current = map.get(key);
        if (shouldReplaceVistoriaRecord(current, item)) {
            map.set(key, item);
        }
    }

    return Array.from(map.values());
}

const SYNC_INTERVAL_MS = Number(process.env.SYNC_INTERVAL_MS || 60_000);
let lastSuccessfulSync = null;
let syncInProgress = false;

function normalizeSortText(value) {
    return String(value ?? '').trim().toLowerCase();
}

function compareProjectsStable(a, b) {
    const dayA = Number.isFinite(Number(a?.days)) ? Number(a.days) : 0;
    const dayB = Number.isFinite(Number(b?.days)) ? Number(b.days) : 0;

    if (dayB !== dayA) return dayB - dayA;

    const keys = ['client', 'city', 'seller', 'folder', 'external_id', 'team', 'status'];
    for (const key of keys) {
        const valueA = normalizeSortText(a?.[key]);
        const valueB = normalizeSortText(b?.[key]);
        if (valueA !== valueB) {
            return valueA.localeCompare(valueB, 'pt-BR', { sensitivity: 'base' });
        }
    }

    return 0;
}

function sortProjectsStable(list = []) {
    return [...list].sort(compareProjectsStable);
}

async function runSheetsSync(trigger = 'auto') {
    if (syncInProgress) {
        console.log(`[sync] Skipping ${trigger} trigger because another sync is still running.`);
        return false;
    }

    syncInProgress = true;
    try {
        await syncSheets();
        lastSuccessfulSync = new Date();
        return true;
    } catch (err) {
        console.error(`[sync] ${trigger} sync failed:`, err.message);
        return false;
    } finally {
        syncInProgress = false;
    }
}

// API Routes
app.get('/api/dashboard', async (req, res) => {
    try {
        const whereClause = buildFilterClause(req.query);

        // Single query for all workflow statuses + JS grouping (much faster than 5 separate queries)
        const [allWorkflow, allCities, allCategories, allSellers] = await Promise.all([
            Project.findAll({
                where: { ...whereClause, status: { [Op.in]: ['GENERATE_OS', 'PRIORITY', 'TO_DELIVER', 'DELIVERED', 'IN_EXECUTION'] } },
                order: [['days', 'DESC']]
            }),
            Project.findAll({ attributes: [[sequelize.fn('DISTINCT', sequelize.col('city')), 'city']] }),
            Project.findAll({ attributes: [[sequelize.fn('DISTINCT', sequelize.col('category')), 'category']] }),
            Project.findAll({ attributes: [[sequelize.fn('DISTINCT', sequelize.col('seller')), 'seller']] }),
        ]);

        const grouped = { GENERATE_OS: [], PRIORITY: [], TO_DELIVER: [], DELIVERED: [], IN_EXECUTION: [] };
        allWorkflow.forEach(p => { if (grouped[p.status]) grouped[p.status].push(p); });

        const generateOS = sortProjectsStable(grouped.GENERATE_OS);
        const priorities = sortProjectsStable(grouped.PRIORITY);
        const toDeliver = sortProjectsStable(grouped.TO_DELIVER);
        const delivered = sortProjectsStable(grouped.DELIVERED);
        const inExecution = sortProjectsStable(grouped.IN_EXECUTION);

        const cities = allCities.map(c => c.city).filter(Boolean);
        const categories = allCategories.map(c => c.category).filter(Boolean);
        const sellers = allSellers.map(s => s.seller).filter(Boolean);

        // Calculate KPIs
        const kpi = {
            generateOS: {
                title: "GERAR O.S.",
                count: generateOS.length,
                color: "#FFA500",
                statusId: "generate_os"
            },
            priorities: {
                title: "PRIORIDADES PARA ENTREGA",
                count: priorities.length,
                color: "#FFA500",
                statusId: "priority"
            },
            toDeliver: {
                title: "OBRAS A ENTREGAR",
                count: toDeliver.length,
                color: "#FFA500",
                statusId: "to_deliver"
            },
            delivered: {
                title: "OBRAS ENTREGUES",
                count: delivered.length,
                color: "#FFA500",
                statusId: "delivered"
            },
            inExecution: {
                title: "OBRAS EM EXECUÇÃO",
                count: inExecution.length,
                color: "#FFA500",
                statusId: "in_execution"
            }
        };

        // Vistoria Data Queries (parallelized) — include COMPLETED (installation) + PROJECT/Ampliação
        const [vistoriaSolicitarCompleted, vistoriaSolicitarAmpliacao, allSolicitadasCompleted, allSolicitadasAmpliacao] = await Promise.all([
            Project.findAll({
                where: { ...whereClause, status: 'COMPLETED', vistoria_status: 'Não Solicitado', project_status: 'Finalizado' },
                order: [['days', 'DESC']]
            }),
            Project.findAll({
                where: { ...whereClause, status: 'PROJECT', category: { [Op.like]: '%Amplia%' }, vistoria_status: 'Não Solicitado', project_status: 'Finalizado' },
                order: [['days', 'DESC']]
            }),
            Project.findAll({
                where: { ...whereClause, vistoria_status: 'Solicitado', status: 'COMPLETED' },
                order: [['days', 'DESC']]
            }),
            Project.findAll({
                where: { ...whereClause, vistoria_status: 'Solicitado', status: 'PROJECT', category: { [Op.like]: '%Amplia%' } },
                order: [['days', 'DESC']]
            }),
        ]);

        const vistoriaSolicitar = sortProjectsStable(
            dedupeVistoriaItems(
                normalizeVistoriaItems([...vistoriaSolicitarCompleted, ...vistoriaSolicitarAmpliacao])
            )
        );
        const allSolicitadas = sortProjectsStable(
            dedupeVistoriaItems(
                normalizeVistoriaItems([...allSolicitadasCompleted, ...allSolicitadasAmpliacao])
            )
        );

        const vistoriaSolicitadas = allSolicitadas.filter(p => p.days <= 7);
        const vistoriaAtrasadas = allSolicitadas.filter(p => p.days > 7);

        const data = {
            cities,
            categories,
            sellers,
            kpi,
            lastSync: lastSuccessfulSync,
            projects: {
                generate_os: generateOS,
                priority: priorities,
                to_deliver: toDeliver,
                delivered: delivered,
                in_execution: inExecution
            },
            vistoria: {
                solicitar: vistoriaSolicitar,
                solicitadas: vistoriaSolicitadas,
                atrasadas: vistoriaAtrasadas
            }
        };

        res.json(data);
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/sync', async (req, res) => {
    try {
        if (syncInProgress) {
            return res.status(409).json({ error: 'Sync already in progress' });
        }

        const synced = await runSheetsSync('manual');
        if (!synced) {
            return res.status(500).json({ error: 'Failed to sync data' });
        }

        res.json({ success: true, message: 'Data synced successfully' });
    } catch (error) {
        console.error('Sync error:', error);
        res.status(500).json({ error: 'Failed to sync data' });
    }
});

app.get('/api/projects', async (req, res) => {
    try {
        const whereClause = buildFilterClause(req.query);

        // Expanded logic: Include 'PROJECT' status OR active pipeline statuses
        // Also include DELIVERED and COMPLETED so cities like Matupá (installation-only sheets)
        // are not filtered out — deduplication below handles any overlap with PROJECT entries.
        whereClause.status = {
            [Op.in]: ['PROJECT', 'GENERATE_OS', 'PRIORITY', 'IN_EXECUTION', 'TO_DELIVER', 'DELIVERED', 'COMPLETED', 'STOPPED']
        }

        const allProjects = await Project.findAll({
            where: whereClause,
            order: [['updatedAt', 'DESC']]
        });

        // Deduplication Logic: Prioritize PROJECT status entries
        const uniqueProjectsMap = new Map();

        allProjects.forEach(p => {
            // Unique key: Folder + City (or Client + City as fallback)
            const cityKey = p.city ? p.city.trim().toUpperCase() : 'UNKNOWN';
            const key = (p.folder && p.folder.toString().trim().length > 0)
                ? `FOLDER:${p.folder.trim()}|CITY:${cityKey}`
                : `CLIENT:${p.client.trim().toUpperCase()}|CITY:${cityKey}`;

            if (uniqueProjectsMap.has(key)) {
                const existing = uniqueProjectsMap.get(key);
                if (p.status === 'PROJECT' && existing.status !== 'PROJECT') {
                    uniqueProjectsMap.set(key, p);
                }
            } else {
                uniqueProjectsMap.set(key, p);
            }
        });

        const dedupedProjects = Array.from(uniqueProjectsMap.values());

        const group1 = []; // Novos
        const group2 = []; // Em Andamento
        const group3 = []; // Finalizados

        const allowedInProgress = [
            'NÃO INICIADO', 'NAO INICIADO',
            'ATRASADO',
            'ANDAMENTO', 'EM ANDAMENTO',
            'FALTA ART',
            'MANDAR',
            'PROTOCOLADO'
        ];

        dedupedProjects.forEach(p => {
            const status = (p.project_status || '').trim().toUpperCase();
            const category = (p.category || '').trim().toUpperCase();

            // Ampliação: send ALL to group1 regardless of project_status so
            // none are silently dropped. The front-end allProjectsPool distributes
            // them by project_status into the correct Ampliação sub-tab.
            if (category.includes('AMPLIA')) {
                group1.push(p);
                return;
            }

            // 1. Finished
            if (status === 'FINALIZADO') {
                group3.push(p);
                return;
            }

            // 2. In Progress (Strict Filter)
            if (allowedInProgress.includes(status)) {
                // Exclude specific categories or types
                const isExcluded =
                    category.includes('SEM PROJETO') ||
                    (p.details && (
                        p.details.toUpperCase().includes('AMPLIAÇÃO') ||
                        p.details.toUpperCase().includes('EM ESPERA')
                    ));

                if (!isExcluded) {
                    group2.push(p);
                }
                return;
            }

            // 3. New (Everything else)
            // Example: Protocolado, Em Obra, Aguardando Conferência Doc...
            group1.push(p);
        });

        // Fetch filter lists to avoid a second /api/dashboard round-trip from the client
        const [allCities, allSellers, allCategories] = await Promise.all([
            Project.findAll({ attributes: [[sequelize.fn('DISTINCT', sequelize.col('city')), 'city']] }),
            Project.findAll({ attributes: [[sequelize.fn('DISTINCT', sequelize.col('seller')), 'seller']] }),
            Project.findAll({ attributes: [[sequelize.fn('DISTINCT', sequelize.col('category')), 'category']] }),
        ]);

        res.json({
            lastSync: lastSuccessfulSync,
            cities: allCities.map(c => c.city).filter(Boolean).sort(),
            sellers: allSellers.map(s => s.seller).filter(Boolean).sort(),
            categories: allCategories.map(c => c.category).filter(Boolean).sort(),
            kpi: {
                new: { count: group1.length, title: 'NOVOS PROJETOS', color: '#007bff' },
                inProgress: { count: group2.length, title: 'EM ANDAMENTO', color: '#ffc107' },
                finished: { count: group3.length, title: 'FINALIZADOS', color: '#28a745' }
            },
            sections: {
                new: group1,
                inProgress: group2,
                finished: group3
            }
        });

    } catch (error) {
        console.error('Error fetching projects dashboard:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/plates', async (req, res) => {
    try {
        const whereClause = buildFilterClause(req.query, ['city']);
        whereClause.status = {
            [Op.in]: ['GENERATE_OS', 'PRIORITY', 'TO_DELIVER', 'DELIVERED', 'IN_EXECUTION', 'COMPLETED', 'STOPPED']
        };

        const projects = await Project.findAll({
            where: whereClause,
            order: [['updatedAt', 'DESC']]
        });

        const dateFromRaw = req.query.date_from ? new Date(req.query.date_from) : null;
        const dateToRaw = req.query.date_to ? new Date(req.query.date_to) : null;
        const dateFrom = (dateFromRaw && !Number.isNaN(dateFromRaw.getTime())) ? startOfDay(dateFromRaw) : null;
        const dateTo = (dateToRaw && !Number.isNaN(dateToRaw.getTime())) ? addDays(startOfDay(dateToRaw), 1) : null;
        const plateCountFilter = req.query.plate_count ? Number(req.query.plate_count) : null;
        const platePowerFilter = req.query.plate_power_w ? Number(req.query.plate_power_w) : null;

        const normalized = projects.map((p) => {
            const installDateObj = parseDateString(p.install_date);
            return {
                id: p.id,
                city: p.city,
                branch: p.city, // Filial = cidade para este dashboard
                client: p.client,
                seller: p.seller,
                folder: p.folder,
                plate_number: p.plate_number,
                plate_count: p.plate_count,
                plate_power_w: p.plate_power_w,
                plate_total_power_kw: p.plate_total_power_kw,
                install_date: p.install_date,
                install_date_iso: installDateObj ? installDateObj.toISOString().slice(0, 10) : null,
                install_status: p.install_status,
                status: p.status,
                days: p.days ?? 0,
                sort_date_ms: installDateObj ? installDateObj.getTime() : null,
            };
        });

        const filtered = normalized.filter((item) => {
            if (dateFrom || dateTo) {
                if (!item.sort_date_ms) return false;
                const d = new Date(item.sort_date_ms);
                if (dateFrom && d < dateFrom) return false;
                if (dateTo && d >= dateTo) return false;
            }

            if (plateCountFilter !== null && Number.isFinite(plateCountFilter)) {
                if (item.plate_count !== plateCountFilter) return false;
            }

            if (platePowerFilter !== null && Number.isFinite(platePowerFilter)) {
                if (item.plate_power_w !== platePowerFilter) return false;
            }

            return true;
        });

        filtered.sort((a, b) => {
            if (a.sort_date_ms !== null && b.sort_date_ms !== null) return a.sort_date_ms - b.sort_date_ms;
            if (a.sort_date_ms !== null) return -1;
            if (b.sort_date_ms !== null) return 1;
            return (b.days || 0) - (a.days || 0);
        });

        const branches = [...new Set(normalized.map(p => p.branch).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        const plateCounts = [...new Set(normalized.map(p => p.plate_count).filter(v => Number.isFinite(v)))].sort((a, b) => a - b);
        const platePowers = [...new Set(normalized.map(p => p.plate_power_w).filter(v => Number.isFinite(v)))].sort((a, b) => a - b);

        const totalProjects = filtered.length;
        const totalPlates = filtered.reduce((acc, item) => acc + (item.plate_count || 0), 0);
        const totalPowerKw = Number(filtered.reduce((acc, item) => acc + (item.plate_total_power_kw || 0), 0).toFixed(3));

        res.json({
            lastSync: lastSuccessfulSync,
            filters: {
                branches,
                plateCounts,
                platePowers
            },
            totals: {
                totalProjects,
                totalPlates,
                totalPowerKw
            },
            entries: filtered
        });
    } catch (error) {
        console.error('Error fetching plates dashboard:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/parados', async (req, res) => {
    try {
        const whereClause = buildFilterClause(req.query);
        whereClause.status = 'STOPPED';

        const parados = await Project.findAll({
            where: whereClause,
            order: [['days', 'DESC']]
        });

        const [allCities, allSellers] = await Promise.all([
            Project.findAll({ attributes: [[sequelize.fn('DISTINCT', sequelize.col('city')), 'city']] }),
            Project.findAll({ attributes: [[sequelize.fn('DISTINCT', sequelize.col('seller')), 'seller']] }),
        ]);

        res.json({
            parados,
            cities: allCities.map(c => c.city).filter(Boolean).sort(),
            sellers: allSellers.map(s => s.seller).filter(Boolean).sort(),
        });
    } catch (error) {
        console.error('Error fetching parados:', error);
        res.status(500).json({ error: error.message });
    }
});


// Start Server
async function start() {
    try {
        await sequelize.sync({ alter: true });
        console.log('Database synced');

        // Initial Data Load
        runSheetsSync('initial');

        // Auto-Sync (default 60s, configurable via SYNC_INTERVAL_MS)
        setInterval(() => {
            runSheetsSync('auto');
        }, SYNC_INTERVAL_MS);

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server running on http://0.0.0.0:${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
    }
}

start();
