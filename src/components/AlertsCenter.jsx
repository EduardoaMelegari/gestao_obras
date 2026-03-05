import React, { useState, useEffect } from 'react';
import { fetchProjectData } from '../services/data';
import ProjectTable from './ProjectTable';

const AlertsCenter = () => {
    const [loading, setLoading] = useState(true);
    const [allProjects, setAllProjects] = useState([]);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const result = await fetchProjectData([], [], []);
                if (result && result.sections) {
                    const data = [
                        ...(result.sections.new || []),
                        ...(result.sections.inProgress || []),
                        ...(result.sections.finished || [])
                    ];
                    setAllProjects(data);
                }
            } catch (err) {
                console.error("Failed to load alerts data:", err);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    const [activeTab, setActiveTab] = useState('atrasados');

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'white' }}>
                <h2>Carregando Alertas...</h2>
            </div>
        );
    }

    // 1. Clientes mais atrasados
    // Find the max delay for each project (using protocol, doc conf, etc)
    const delayedProjects = allProjects.filter(p => {
        const isFinished = p.project_status === 'COMPLETED' || (p.project_status || '').toLowerCase() === 'concluído' || (p.project_status || '').toLowerCase() === 'finalizado';
        return !isFinished;
    }).map(p => {
        const d1 = p.days_since_protocol || 0;
        const d2 = p.days_since_doc_conf || 0;
        const d3 = p.days || 0;
        return {
            ...p,
            max_delay: Math.max(d1, d2, d3)
        };
    }).sort((a, b) => b.max_delay - a.max_delay)
      .filter(p => p.max_delay > 0)
      .slice(0, 50); // Top 50 delayed

    // 2. Ajustes: Clientes Duplicados
    const clientMap = {};
    allProjects.forEach(p => {
        // use lower case, trimmed normalized name
        const normalizedName = (p.client || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
        if (!normalizedName) return;
        if (!clientMap[normalizedName]) clientMap[normalizedName] = [];
        clientMap[normalizedName].push(p);
    });

    // filter to only those with > 1 occurrences
    const duplicatedProjects = [];
    Object.keys(clientMap).forEach(key => {
        if (clientMap[key].length > 1) {
            duplicatedProjects.push(...clientMap[key]);
        }
    });

    const columnsDelayed = [
        { header: 'CLIENTE', accessor: 'client' },
        { header: 'CIDADE', accessor: 'city', width: '10%' },
        { header: 'PASTA', accessor: 'folder', width: '8%' },
        { header: 'STATUS', accessor: 'project_status', width: '15%' },
        { header: 'DIAS ATRASO', accessor: 'max_delay', width: '10%' },
    ];

    const columnsDuplicated = [
        { header: 'CLIENTE', accessor: 'client' },
        { header: 'CIDADE', accessor: 'city', width: '10%' },
        { header: 'PASTA', accessor: 'folder', width: '8%' },
        { header: 'STATUS', accessor: 'project_status', width: '15%' },
        { header: 'ID', accessor: 'external_id', width: '10%' },
    ];

    return (
        <div style={{ padding: '20px', color: 'white' }}>
            <h1 style={{ marginBottom: '20px', fontSize: '24px', fontWeight: 'bold' }}>Central de Alertas e Indicadores</h1>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button
                    onClick={() => setActiveTab('atrasados')}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: activeTab === 'atrasados' ? '#dc2626' : '#1e293b',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        opacity: activeTab === 'atrasados' ? 1 : 0.7
                    }}
                >
                    🔥 Mais Atrasados ({delayedProjects.length})
                </button>
                <button
                    onClick={() => setActiveTab('duplicados')}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: activeTab === 'duplicados' ? '#ca8a04' : '#1e293b',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        opacity: activeTab === 'duplicados' ? 1 : 0.7
                    }}
                >
                    ⚠️ Ajustes & Duplicados ({duplicatedProjects.length})
                </button>
            </div>

            <div>
                {activeTab === 'atrasados' && (
                    <ProjectTable 
                        title="TOP CLIENTES MAIS ATRASADOS"
                        columns={columnsDelayed}
                        data={delayedProjects}
                        headerColor="#dc2626"
                    />
                )}
                
                {activeTab === 'duplicados' && (
                    <ProjectTable 
                        title="CLIENTES DUPLICADOS / MULTIPLAS OCORRÊNCIAS"
                        columns={columnsDuplicated}
                        data={duplicatedProjects}
                        headerColor="#ca8a04"
                    />
                )}
            </div>
        </div>
    );
};

export default AlertsCenter;
