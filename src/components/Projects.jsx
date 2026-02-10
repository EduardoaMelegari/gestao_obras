import React, { useState, useEffect, useCallback } from 'react';
import Header from './Header';
import ProjectTable from './ProjectTable';
import MultiSelect from './MultiSelect';
import './Dashboard.css'; 
import './Projects.css'; // specific overrides
import { fetchProjectData } from '../services/data';

const Projects = () => {
    const [projectData, setProjectData] = useState({ new: [], inProgress: [], finished: [] });
    // Default KPI Data structure to avoid null checks on first render
    const [kpiData, setKpiData] = useState({
        new: { count: 0, title: 'NOVOS PROJETOS', color: '#007bff' },
        inProgress: { count: 0, title: 'EM ANDAMENTO', color: '#ffc107' },
        finished: { count: 0, title: 'FINALIZADOS', color: '#28a745' }
    });
    
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
                    setProjectData(result.sections);
                }
                if (result.kpi) {
                    setKpiData(result.kpi);
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            if (!isBackground) setLoading(false);
        }
    }, []);

    // Initial load for filter options (we can grab them from the main dashboard API or similar)
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
            filtered = filtered.filter(item =>
                (item.client || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                (item.city || '').toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        return filtered;
    };

    const filteredInProgress = getFilteredData(projectData.inProgress);
    const filteredFinished = getFilteredData(projectData.finished);

    // --- Table Configurations ---

    // 2. PROJECTS IN PROGRESS (Em Andamento)
    // Columns based on User Image 2: CIDADE, PASTA, CLIENTE, STATUS, OBS.
    // Has Color Logic.
    const columnsInProgress = [
        { header: 'CIDADE', accessor: 'city', width: '10%' },
        { header: 'PASTA', accessor: 'folder', width: '8%' },
        { header: 'CATEGORIA', accessor: 'category', width: '10%' },
        { header: 'CLIENTE', accessor: 'client' },
        { header: 'DIAS APÓS CONF.', accessor: 'days_since_doc_conf', width: '10%' },
        { header: 'STATUS', accessor: 'project_status', width: '15%' },
        { header: 'OBS', accessor: 'details', width: '20%' },
    ];

    const getRowClassInProgress = (item) => {
        const status = (item.project_status || '').toLowerCase();
        // Logic inferred from images/standard practices
        if (status.includes('atrasado') || status.includes('não iniciado')) return 'row-red';
        if (status.includes('falta art') || status.includes('pendente')) return 'row-yellow';
        if (status.includes('andamento') || status.includes('em andamento')) return 'row-blue';
        return '';
    };

    // 3. PROJECTS ANALYSIS/FINISHED (Análise de Circuito/Obra)
    // Columns based on User Image 3: CIDADE, ID, CLIENTE, STATUS, PARECER ENERGISA, DATA INICIAL OBRA, DATA FINAL PREVISTA
    const columnsFinished = [
        { header: 'CIDADE', accessor: 'city', width: '8%' },
        { header: 'ID', accessor: 'external_id', width: '10%' },
        { header: 'CLIENTE', accessor: 'client' },
        { header: 'STATUS', accessor: 'project_status', width: '12%' },
        { header: 'PARECER ENERGISA', accessor: 'vistoria_opinion', width: '15%' }, // Mapped to 'PARECER VISTORIA' column logic if applicable
        { header: 'DATA INICIAL OBRA', accessor: 'install_date', width: '12%' },
        { header: 'DATA FINAL PREVISTA', accessor: 'deadline', width: '12%' },
    ];

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
                            placeholder="Cliente ou Cidade"
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
                {/* Instead of columns in a grid, we stack Tables vertically */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    {/* TABLE 2: EM ANDAMENTO */}
                    <ProjectTable 
                        title="PROJETOS EM ANDAMENTO"
                        columns={columnsInProgress}
                        data={filteredInProgress}
                        getRowClass={getRowClassInProgress}
                    />

                    {/* TABLE 3: FINALIZADOS / ANÁLISE */}
                    <ProjectTable 
                        title="PROJETOS ANÁLISE DE CIRCUITO/OBRA"
                        columns={columnsFinished}
                        data={filteredFinished}
                    />

                </div>
            </div>
        </div>
    );
};


export default Projects;
