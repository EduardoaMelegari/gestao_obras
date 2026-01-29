import express from 'express';
import cors from 'cors';
import { sequelize, Op } from './db.js';
import Project from './models/Project.js';
import syncSheets from './sync-sheets.js';

const app = express();
const PORT = process.env.PORT || 36006;

app.use(cors());
app.use(express.json());

// API Routes
app.get('/api/dashboard', async (req, res) => {
    try {
        const { city } = req.query;
        const whereClause = {};

        if (city) {
            if (Array.isArray(city)) {
                whereClause.city = { [Op.in]: city };
            } else if (typeof city === 'string' && city.includes(',')) {
                whereClause.city = { [Op.in]: city.split(',') };
            } else {
                whereClause.city = city;
            }
        }

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
            kpi,
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

// Start Server
async function start() {
    try {
        await sequelize.sync({ alter: true }); // Creates tables if they don't exist and updates schema
        console.log('Database synced');

        // Initial Data Load - NON-BLOCKING
        syncSheets().catch(err => console.error('Initial sync failed:', err));

        // Auto-Sync every 10 seconds
        setInterval(async () => {
            console.log('Running auto-sync...');
            await syncSheets();
        }, 10 * 1000);

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server running on http://0.0.0.0:${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
    }
}

start();
