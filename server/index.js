import express from 'express';
import cors from 'cors';
import { sequelize, Op } from './db.js';
import Project from './models/Project.js';
import syncSheets from './sync-sheets.js';
import https from 'https';

const app = express();
const PORT = process.env.PORT || 36006;

app.use(cors());
app.use(express.json());

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
        if (!ip || ip === 'unknown' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('::')) {
            resolve({ city: 'Local', region: '-', country: 'LAN', lat: null, lon: null });
            return;
        }

        // ip-api.com free tier does not support IPv6 — skip lookup, just show raw IP
        const isIPv6 = ip.includes(':');
        if (isIPv6) {
            resolve({ city: '-', region: '-', country: 'IPv6', lat: null, lon: null });
            return;
        }

        const url = `https://ip-api.com/json/${ip}?fields=status,country,regionName,city,lat,lon`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.status === 'success') {
                        resolve({ city: json.city, region: json.regionName, country: json.country, lat: json.lat, lon: json.lon });
                    } else {
                        resolve(unknown);
                    }
                } catch {
                    resolve(unknown);
                }
            });
        }).on('error', () => resolve(unknown));
    });
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
        // New session — fetch geo async
        const session = { ip, geo: null, lastSeen: now, userAgent, connectedAt: now };
        activeSessions.set(sessionId, session);
        fetchGeo(ip).then(geo => {
            if (activeSessions.has(sessionId)) {
                activeSessions.get(sessionId).geo = geo;
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

        res.json({
            activeUsers: sessions.length,
            sessions,
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

// Tracks the timestamp of the last successful Google Sheets → DB sync
let lastSuccessfulSync = null;

// API Routes
app.get('/api/dashboard', async (req, res) => {
    try {
        const whereClause = buildFilterClause(req.query);

        // Fetch Data with optional filter
        const queryOptions = {
            where: { ...whereClause },
            order: [['days', 'DESC']]
        };

        const generateOS = await Project.findAll({ ...queryOptions, where: { ...queryOptions.where, status: 'GENERATE_OS' } });
        const priorities = await Project.findAll({ ...queryOptions, where: { ...queryOptions.where, status: 'PRIORITY' } });
        const toDeliver = await Project.findAll({ ...queryOptions, where: { ...queryOptions.where, status: 'TO_DELIVER' } });
        const delivered = await Project.findAll({ ...queryOptions, where: { ...queryOptions.where, status: 'DELIVERED' } });
        const inExecution = await Project.findAll({ ...queryOptions, where: { ...queryOptions.where, status: 'IN_EXECUTION' } });

        // Get list of available cities for the filter dropdown
        const allCities = await Project.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('city')), 'city']]
        });
        const cities = allCities.map(c => c.city).filter(Boolean);

        // Get list of available categories for the filter dropdown
        const allCategories = await Project.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('category')), 'category']]
        });
        const categories = allCategories.map(c => c.category).filter(Boolean);

        // Get list of available sellers for the filter dropdown
        const allSellers = await Project.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('seller')), 'seller']]
        });
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

        // Vistoria Data Queries
        const vistoriaSolicitar = await Project.findAll({
            ...queryOptions,
            where: {
                ...queryOptions.where,
                status: 'COMPLETED',
                vistoria_status: 'Não Solicitado',
                project_status: 'Finalizado'
            }
        });

        // Fetch all Solicitadas then split by days (to avoid DB type issues)
        const allSolicitadas = await Project.findAll({
            ...queryOptions,
            where: {
                ...queryOptions.where,
                vistoria_status: 'Solicitado',
                status: 'COMPLETED'
            }
        });

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
        await syncSheets();
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
            [Op.in]: ['PROJECT', 'GENERATE_OS', 'PRIORITY', 'IN_EXECUTION', 'TO_DELIVER', 'DELIVERED', 'COMPLETED']
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

// Start Server
async function start() {
    try {
        await sequelize.sync({ alter: true });
        console.log('Database synced');

        // Initial Data Load
        syncSheets()
            .then(() => { lastSuccessfulSync = new Date(); })
            .catch(err => console.error('Initial sync failed:', err));

        // Auto-Sync every 10 seconds
        setInterval(async () => {
            try {
                await syncSheets();
                lastSuccessfulSync = new Date();
            } catch (err) {
                console.error('Auto-sync failed:', err);
            }
        }, 10 * 1000);

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server running on http://0.0.0.0:${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
    }
}

start();
