import React, { useState, useEffect, useCallback } from 'react';
import Header from './Header';
import ProjectTable from './ProjectTable';
import MultiSelect from './MultiSelect';
import './Dashboard.css'; 
import './Projects.css';
import { fetchProjectData } from '../services/data';

const Projects = () => {
    const [projectData, setProjectData] = useState({ new: [], inProgress: [], finished: [] });
    const [kpiData, setKpiData] = useState({
        new: { count: 0, title: 'NOVOS PROJETOS', color: '#007bff' },
        inProgress: { count: 0, title: 'EM ANDAMENTO', color: '#ffc107' },
        finished: { count: 0, title: 'FINALIZADOS', color: '#28a745' }
    });
    
    // Tab State
    const [activeTab, setActiveTab] = useState('andamento');
    const [protocoladosSubTab, setProtocoladosSubTab] = useState('clean'); // 'clean' or 'pendencias'

    // Filter State
    const [cities, setCities] = useState([]);
    const [selectedCities, setSelectedCities] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [sellers, setSellers] = useState([]);
    const [selectedSellers, setSelectedSellers] = useState([]);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async (citiesToFetch, categoriesToFetch, sellersToFetch, isBackground = false) => {
        if (!isBackground) setLoading(true);
        try {
            const result = await fetchProjectData(citiesToFetch, categoriesToFetch, sellersToFetch);
            if (result) {
                if (result.sections) {
                    // Sort each section by a stable key to prevent rows from jumping on refresh
                    const stableSort = (arr) => [...arr].sort((a, b) => {
                        const clientA = (a.client || '').toLowerCase();
                        const clientB = (b.client || '').toLowerCase();
                        if (clientA !== clientB) return clientA.localeCompare(clientB);
                        // Secondary sort by id for clients with same name
                        return (a.id || 0) - (b.id || 0);
                    });
                    setProjectData({
                        new: stableSort(result.sections.new || []),
                        inProgress: stableSort(result.sections.inProgress || []),
                        finished: stableSort(result.sections.finished || []),
                    });
                }
                if (result.kpi) setKpiData(result.kpi);
            }
        } catch (err) {
            console.error(err);
        } finally {
            if (!isBackground) setLoading(false);
        }
    }, []);

    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const response = await fetch('/api/dashboard');
                const data = await response.json();
                if (data.cities) setCities(data.cities);
                if (data.categories) setCategories(data.categories);
                if (data.sellers) setSellers(data.sellers);
            } catch (err) {
                console.error("Failed to fetch filter options", err);
            }
        };
        fetchFilters();
    }, []);

    useEffect(() => {
        loadData(selectedCities, selectedCategories, selectedSellers);
        const intervalId = setInterval(() => {
            loadData(selectedCities, selectedCategories, selectedSellers, true);
        }, 10 * 1000);
        return () => clearInterval(intervalId);
    }, [selectedCities, selectedCategories, selectedSellers, loadData]);

    const handleCityChange = (newCities) => setSelectedCities(newCities);
    const handleCategoryChange = (newCats) => setSelectedCategories(newCats);
    const handleSellerChange = (newSellers) => setSelectedSellers(newSellers);

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
    };

    const getFilteredData = (dataList) => {
        if (!dataList) return [];
        let filtered = dataList;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(item =>
                (item.client || '').toLowerCase().includes(term) || 
                (item.city || '').toLowerCase().includes(term) ||
                (item.external_id || '').toString().toLowerCase().includes(term) ||
                (item.folder || '').toString().toLowerCase().includes(term)
            );
        }
        return filtered;
    };

    // --- Derived data per tab ---
    const allInProgress = projectData.inProgress || [];
    const allFinished = projectData.finished || [];
    const allNew = projectData.new || [];

    // Sub-filters from inProgress
    const projectsEmAndamento = allInProgress.filter(p => {
        const status = (p.project_status || '').toLowerCase();
        const category = (p.category || '').toLowerCase();
        
        // Logical filter: Status must be "Não Iniciado" AND Category must be "PROJETO"
        const isNaoIniciado = status.includes('não iniciado') || status.includes('nao iniciado');
        const isProjeto = category.trim() === 'projeto'; 
        
        return isNaoIniciado && isProjeto;
    }).sort((a, b) => (b.days_since_doc_conf || 0) - (a.days_since_doc_conf || 0));

    const projectsAtrasados = allInProgress.filter(p => {
        const status = (p.project_status || '').toLowerCase();
        return status.includes('atrasado') || status.includes('não iniciado') || status.includes('nao iniciado');
    });

    const projectsPendentes = allInProgress.filter(p => {
        const status = (p.project_status || '').toLowerCase();
        return status.includes('falta art');
    }).sort((a, b) => (b.days_since_doc_conf || 0) - (a.days_since_doc_conf || 0));

    const projectsEnviarEnergisa = allInProgress.filter(p => {
        const status = (p.project_status || '').toLowerCase();
        const obs = (p.details || '').toLowerCase();
        return status.includes('mandar') && obs.includes('sm');
    }).sort((a, b) => (b.days_since_doc_conf || 0) - (a.days_since_doc_conf || 0));

    // Split Protocolados into two groups: With OBS and Without OBS
    const projectsProtocoladosFiltered = allInProgress.filter(p => {
        const status = (p.project_status || '').toLowerCase().trim();
        return status === 'protocolado';
    });

    const projectsProtocoladosClean = projectsProtocoladosFiltered.filter(p => !p.details || !p.details.trim()).sort((a, b) => (b.days_since_protocol || 0) - (a.days_since_protocol || 0));
    
    const projectsProtocoladosPendencias = projectsProtocoladosFiltered.filter(p => p.details && p.details.trim()).sort((a, b) => (b.days_since_protocol || 0) - (a.days_since_protocol || 0));

    const projectsConcluidos = allFinished;

    // Using filteredFinished (which comes from finished section)
    const projectsAnaliseCircuito = [...allNew, ...allInProgress, ...allFinished].filter(p => {
        const parecer = (p.vistoria_opinion || '').toLowerCase(); // Mapped to PARECER column
        return parecer.includes('análise de circuito') || 
               parecer.includes('analise de circuito') || 
               parecer.includes('obra 60d') || 
               parecer.includes('obra 120d');
    }).sort((a, b) => {
        const getDeadlineDate = (item) => {
             const parecer = (item.vistoria_opinion || '').toLowerCase();
             const baseDateStr = item.protocol_date || item.install_date;
             
             // Default to far future if waiting/invalid
             if (!baseDateStr) return new Date(8640000000000000);

             let startDate = null;
             // Parsing Logic
             if (baseDateStr.includes('/')) {
                 const parts = baseDateStr.split('/');
                 if (parts.length === 3) startDate = new Date(parts[2], parts[1] - 1, parts[0]);
             } else {
                 startDate = new Date(baseDateStr);
             }
             
             if (!startDate || isNaN(startDate.getTime())) return new Date(8640000000000000);

             let days = 0;
             if (parecer.includes('análise') || parecer.includes('analise')) days = 30;
             else if (parecer.includes('obra 60d')) days = 60;
             else if (parecer.includes('obra 120d')) days = 120;
             
             const end = new Date(startDate);
             end.setDate(end.getDate() + days);
             return end;
        };

        return getDeadlineDate(a) - getDeadlineDate(b);
    });

    const allProjects = [...allNew, ...allInProgress, ...allFinished];

    // --- Table Columns ---
    const columnsInProgress = [
        { header: 'CIDADE', accessor: 'city', width: '10%' },
        { header: 'PASTA', accessor: 'folder', width: '8%' },
        { header: 'CATEGORIA', accessor: 'category', width: '10%' },
        { header: 'CLIENTE', accessor: 'client' },
        { header: 'DIAS APÓS CONF.', accessor: 'days_since_doc_conf', width: '10%' },
        { header: 'STATUS', accessor: 'project_status', width: '15%' },
        { header: 'OBS', accessor: 'details', width: '20%' },
    ];

    const columnsAnalise = [
        { header: 'CIDADE', accessor: 'city', width: '8%' },
        { header: 'ID', accessor: 'external_id', width: '10%' },
        { header: 'CLIENTE', accessor: 'client' },
        { header: 'STATUS', accessor: 'project_status', width: '12%' },
        { header: 'PARECER ENERGISA', accessor: 'vistoria_opinion', width: '15%' },
        { header: 'DATA PROTOCOLO', accessor: 'protocol_date', width: '12%' },
        { 
            header: 'DATA FINAL PREVISTA', 
            accessor: 'deadline', 
            width: '12%',
            render: (item) => {
                const parecer = (item.vistoria_opinion || '').toLowerCase();
                // Depending on data format (assuming DD/MM/YYYY or YYYY-MM-DD), logic varies.
                // Assuming stored as text, we might need robust parsing. 
                // BUT for now, simple JS Add Days Logic if date is valid.
                
                // Helper to parse "DD/MM/YYYY" or "YYYY-MM-DD"
                const parseDate = (str) => {
                    if (!str) return null;
                    
                    // Priority: PT-BR DD/MM/YYYY (Common in sheets)
                    if (str.includes('/')) {
                        const parts = str.split('/');
                        if (parts.length === 3) {
                            return new Date(parts[2], parts[1] - 1, parts[0]);
                        }
                    }

                    // Fallback: ISO or other standard formats
                    let d = new Date(str);
                    if (!isNaN(d.getTime())) return d;
                    
                    return null;
                };

                // Use Protocol Date as primary source, fallback to Install Date
                const baseDateStr = item.protocol_date || item.install_date;
                if (!baseDateStr) return '-';

                const startDate = parseDate(baseDateStr);
                if (!startDate) return item.deadline || '-';

                let daysToAdd = 0;
                if (parecer.includes('análise de circuito') || parecer.includes('analise de circuito')) {
                    daysToAdd = 30;
                } else if (parecer.includes('obra 60d')) {
                    daysToAdd = 60;
                } else if (parecer.includes('obra 120d')) {
                    daysToAdd = 120;
                } else {
                    return item.deadline || '-';
                }

                const endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + daysToAdd);
                
                return endDate.toLocaleDateString('pt-BR');
            }
        },
    ];

    const columnsProtocolados = [
        { header: 'CIDADE', accessor: 'city', width: '10%' },
        { header: 'PASTA', accessor: 'folder', width: '8%' },
        { header: 'ID', accessor: 'external_id', width: '10%' },
        { header: 'CLIENTE', accessor: 'client' },
        { header: 'DATA PROTOCOLO', accessor: 'protocol_date', width: '15%' },
        { 
            header: 'DIAS PROTOCOLADO', 
            accessor: 'days_since_protocol', 
            width: '15%',
            render: (item) => {
                const val = item.days_since_protocol;
                if (val === null || val === undefined) return '-';
                return val;
            }
        },
        { header: 'OBS', accessor: 'details', width: '20%' },
    ];

    const columnsConcluidos = [
        { header: 'CIDADE', accessor: 'city', width: '8%' },
        { header: 'ID', accessor: 'external_id', width: '10%' },
        { header: 'CLIENTE', accessor: 'client' },
        { header: 'STATUS', accessor: 'project_status', width: '12%' },
        { header: 'PARECER ENERGISA', accessor: 'vistoria_opinion', width: '15%' },
    ];

    const getRowClassInProgress = (item) => {
        const status = (item.project_status || '').toLowerCase();
        if (status.includes('atrasado') || status.includes('não iniciado') || status.includes('nao iniciado')) return 'row-red';
        if (status.includes('falta art') || status.includes('pendente')) return 'row-yellow';
        if (status.includes('andamento') || status.includes('em andamento')) return 'row-blue';
        return '';
    };

    // --- Tab config ---
    const level1Tabs = [
        { id: 'elaboracao', label: 'Projetos em Elaboração', color: '#3b82f6' },
        { id: 'pendentes', label: 'Projetos Pendentes (ART)', color: '#eab308' },
        { id: 'energisa', label: 'Projetos Enviar Energisa', color: '#f97316' },
    ];

    const level2Tabs = [
        { id: 'protocolados', label: 'Projetos Protocolados', color: '#0ea5e9' },
        { id: 'analise', label: 'Análise de Circuito', color: '#8b5cf6' },
        { id: 'concluidos', label: 'Projetos Concluídos', color: '#22c55e' },
    ];

    const getTabContent = () => {
        switch (activeTab) {
            case 'elaboracao':
            case 'andamento': // fallback
                return (
                    <ProjectTable 
                        title="PROJETOS EM ELABORAÇÃO"
                        columns={columnsInProgress}
                        data={getFilteredData(projectsEmAndamento)}
                        getRowClass={getRowClassInProgress}
                        headerColor="#1e3a5f"
                    />
                );
            case 'pendentes':
                return (
                    <ProjectTable 
                        title="PROJETOS PENDENTES - AGUARDANDO ART"
                        columns={columnsInProgress}
                        data={getFilteredData(projectsPendentes)}
                        getRowClass={getRowClassInProgress}
                        headerColor="#854d0e"
                    />
                );
            case 'energisa':
                return (
                    <ProjectTable 
                        title="PROJETOS ENVIAR ENERGISA"
                        columns={columnsInProgress}
                        data={getFilteredData(projectsEnviarEnergisa)}
                        getRowClass={getRowClassInProgress}
                        headerColor="#c2410c"
                    />
                );
            case 'protocolados':
                return (
                    <div>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                            <button 
                                onClick={() => setProtocoladosSubTab('clean')}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: protocoladosSubTab === 'clean' ? '#0ea5e9' : '#1e293b',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    opacity: protocoladosSubTab === 'clean' ? 1 : 0.7
                                }}
                            >
                                Protocolados ({getFilteredData(projectsProtocoladosClean).length})
                            </button>
                            <button 
                                onClick={() => setProtocoladosSubTab('pendencias')}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: protocoladosSubTab === 'pendencias' ? '#dc2626' : '#1e293b',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    opacity: protocoladosSubTab === 'pendencias' ? 1 : 0.7
                                }}
                            >
                                Com Pendências ({getFilteredData(projectsProtocoladosPendencias).length})
                            </button>
                        </div>

                        {protocoladosSubTab === 'clean' ? (
                            <ProjectTable 
                                title="PROJETOS PROTOCOLADOS"
                                columns={columnsProtocolados}
                                data={getFilteredData(projectsProtocoladosClean)}
                                getRowClass={getRowClassInProgress}
                                headerColor="#0ea5e9"
                            />
                        ) : (
                             <ProjectTable 
                                title="PROJETOS COM PENDÊNCIAS"
                                columns={columnsProtocolados}
                                data={getFilteredData(projectsProtocoladosPendencias)}
                                getRowClass={getRowClassInProgress}
                                headerColor="#dc2626"
                            />
                        )}
                    </div>
                );
            case 'analise':
                return (
                    <ProjectTable 
                        title="ANÁLISE DE CIRCUITO"
                        columns={columnsAnalise}
                        data={getFilteredData(projectsAnaliseCircuito)}
                        headerColor="#5b21b6"
                    />
                );
            case 'concluidos':
                return (
                    <ProjectTable 
                        title="PROJETOS CONCLUÍDOS"
                        columns={columnsConcluidos}
                        data={getFilteredData(projectsConcluidos)}
                        headerColor="#166534"
                    />
                );
            default:
                return null;
        }
    };

    const getTabCount = (tabId) => {
        switch (tabId) {
            case 'elaboracao':
            case 'andamento': // fallback
                return getFilteredData(projectsEmAndamento).length;
            case 'pendentes':
                return getFilteredData(projectsPendentes).length;
            case 'energisa':
                return getFilteredData(projectsEnviarEnergisa).length;
            case 'protocolados':
                return getFilteredData(projectsProtocoladosClean).length + getFilteredData(projectsProtocoladosPendencias).length;
            case 'analise':
                return getFilteredData(projectsAnaliseCircuito).length;
            case 'concluidos':
                return getFilteredData(projectsConcluidos).length;
            default:
                return 0;
        }
    };

    return (
        <div className="dashboard-container projects-view">
            <div className="top-bar">
                <Header title="GESTÃO DE PROJETOS" />

                <div className="filter-group">
                    <div className="search-box">
                        <label htmlFor="client-search">Buscar:</label>
                        <input
                            type="text"
                            id="client-search"
                            className="search-input"
                            placeholder="Busca..."
                            value={searchTerm}
                            onChange={handleSearchChange}
                        />
                    </div>

                    <div className="city-selector">
                        <label>Cidade:</label>
                        <MultiSelect
                            options={cities}
                            selected={selectedCities}
                            onChange={handleCityChange}
                            placeholder="Todas"
                        />
                    </div>

                    <div className="city-selector">
                        <label>Vendedor:</label>
                        <MultiSelect
                            options={sellers}
                            selected={selectedSellers}
                            onChange={handleSellerChange}
                            placeholder="Todos"
                        />
                    </div>
                </div>
            </div>

            <div className="dashboard-content">
                {/* Tabs Navigation */}
                <div className="tabs-container">
                    {level1Tabs.map((tab) => (
                        <button
                            key={tab.id}
                            className={`tab-btn ${activeTab === tab.id ? 'tab-active' : ''}`}
                            style={activeTab === tab.id ? { backgroundColor: tab.color } : {}}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.label} ({getTabCount(tab.id)})
                        </button>
                    ))}
                </div>

                <div className="tabs-container" style={{ marginTop: '-8px' }}>
                    {level2Tabs.map((tab) => (
                        <button
                            key={tab.id}
                            className={`tab-btn ${activeTab === tab.id ? 'tab-active' : ''}`}
                            style={activeTab === tab.id ? { backgroundColor: tab.color } : {}}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.label} ({getTabCount(tab.id)})
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="tab-content">
                    {getTabContent()}
                </div>
            </div>
        </div>
    );
};

export default Projects;
