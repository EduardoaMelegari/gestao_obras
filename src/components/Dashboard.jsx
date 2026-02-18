import React, { useState, useEffect, useCallback } from 'react';
import Header from './Header';
import KPICard from './KPICard';
import ProjectColumn from './ProjectColumn';
import MultiSelect from './MultiSelect';
import { fetchDashboardData } from '../services/data';
import './Dashboard.css';

const Dashboard = () => {
    const [kpiData, setKpiData] = useState(null);
    const [projectData, setProjectData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [lastSync, setLastSync] = useState(null);

    // City Filter State
    const [cities, setCities] = useState([]);
    const [selectedCities, setSelectedCities] = useState([]); 
    // Category Filter State
    const [categories, setCategories] = useState([]);
    const [selectedCategories, setSelectedCategories] = useState([]);
    // Seller Filter State
    const [sellers, setSellers] = useState([]);
    const [selectedSellers, setSelectedSellers] = useState([]);
    // Search State
    const [searchTerm, setSearchTerm] = useState('');
    // Days Filter State
    const [daysFilter, setDaysFilter] = useState('');

    const loadData = useCallback(async (citiesToFetch, categoriesToFetch, sellersToFetch, isBackground = false) => {
        if (!isBackground) setLoading(true);
        try {
            const result = await fetchDashboardData(citiesToFetch, categoriesToFetch, sellersToFetch);

            if (result) {
                setKpiData(result.kpi);
                setProjectData(result.projects);
                if (result.lastSync) setLastSync(new Date(result.lastSync));

                // Update available cities if provided
                if (result.cities && result.cities.length > 0) {
                    setCities(result.cities);
                }
                // Update available categories if provided
                if (result.categories && result.categories.length > 0) {
                   setCategories(result.categories);
                }
                // Update available sellers if provided
                if (result.sellers && result.sellers.length > 0) {
                   setSellers(result.sellers);
                } else {
                    // Fail-safe: Extract from current projects if API doesn't return list yet
                     const allProjs = [
                        ...(result.projects.generate_os || []),
                        ...(result.projects.priority || []),
                        ...(result.projects.to_deliver || []),
                        ...(result.projects.delivered || []),
                        ...(result.projects.in_execution || [])
                    ];
                    const uniqueSellers = [...new Set(allProjs.map(p => p.seller).filter(Boolean))].sort();
                    if (uniqueSellers.length > 0) {
                        setSellers(uniqueSellers);
                    }
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            if (!isBackground) setLoading(false);
        }
    }, []);

    // Initial Load & Auto-Refresh
    useEffect(() => {
        loadData(selectedCities, selectedCategories, selectedSellers); // Initial (shows loading)

        // Refresh UI every 10 seconds to catch new data (Silent)
        const intervalId = setInterval(() => {
            loadData(selectedCities, selectedCategories, selectedSellers, true);
        }, 10 * 1000);

        return () => clearInterval(intervalId); // Cleanup on unmount
    }, [selectedCities, selectedCategories, selectedSellers, loadData]); // Re-run if filter changes

    // Handle City Change
    const handleCityChange = (newSelectedCities) => {
        setSelectedCities(newSelectedCities);
    };

    // Handle Category Change
    const handleCategoryChange = (newSelectedCategories) => {
        setSelectedCategories(newSelectedCategories);
    };

    // Handle Seller Change
    const handleSellerChange = (newSelectedSellers) => {
        setSelectedSellers(newSelectedSellers);
    };

    // Handle Search Change
    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
    };

    // Handle Days Filter Change
    const handleDaysFilterChange = (e) => {
        setDaysFilter(e.target.value);
    };

    // Filter Logic
    const getFilteredData = (dataList) => {
        if (!dataList) return [];

        let filtered = dataList;

        // Filter by Search Term
        if (searchTerm) {
            filtered = filtered.filter(item =>
                item.client.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }


        // Filter by Days
        if (daysFilter) {
            if (daysFilter === '<30') {
                filtered = filtered.filter(item => item.days < 30);
            } else {
                const minDays = parseInt(daysFilter);
                filtered = filtered.filter(item => item.days > minDays);
            }
        }

        return filtered;
    };

    if (loading && !kpiData) {
        return <div className="loading-screen">Carregando dados...</div>;
    }

    if (!kpiData || !projectData) {
        return <div className="error-screen">Erro ao carregar dados. Verifique a conexão com o servidor.</div>;
    }

    const filteredGenerateOS = getFilteredData(projectData.generate_os);
    const filteredToDeliver = getFilteredData(projectData.to_deliver);
    const filteredPriorities = getFilteredData(projectData.priority);
    const filteredDelivered = getFilteredData(projectData.delivered);
    const filteredInExecution = getFilteredData(projectData.in_execution);

    return (
        <div className="dashboard-container">
            <div className="top-bar">
                <Header title="INSTALAÇÃO OBRAS MATO GROSSO" />

                <div className="filter-group">
                    <div className="search-box">
                        <label htmlFor="client-search">Buscar Cliente:</label>
                        <input
                            type="text"
                            id="client-search"
                            placeholder="Digite o nome..."
                            value={searchTerm}
                            onChange={handleSearchChange}
                            className="search-input"
                        />
                    </div>

                    <div className="days-selector">
                        <label htmlFor="days-select">Filtro Dias:</label>
                        <select
                            id="days-select"
                            value={daysFilter}
                            onChange={handleDaysFilterChange}
                            className="city-dropdown" // Reusing same style class
                        >
                            <option value="">Todos</option>
                            <option value="<30">{'<'} 30 Dias</option>
                            <option value="30">{'>'} 30 Dias</option>
                            <option value="60">{'>'} 60 Dias</option>
                            <option value="90">{'>'} 90 Dias</option>
                        </select>
                    </div>

                    <div className="city-selector">
                        <label htmlFor="city-select">Filtrar por Cidade:</label>
                        <MultiSelect
                            options={cities}
                            selected={selectedCities}
                            onChange={handleCityChange}
                            placeholder="Todas"
                        />
                    </div>
                    <div className="city-selector">
                        <label htmlFor="seller-select">Filtrar por Vendedor:</label>
                        <MultiSelect
                            options={sellers}
                            selected={selectedSellers}
                            onChange={handleSellerChange}
                            placeholder="Selecione Vendedores"
                        />
                    </div>
                    <div className="city-selector">
                        <label htmlFor="category-select">Filtrar por Categoria:</label>
                        <MultiSelect
                            options={categories}
                            selected={selectedCategories}
                            onChange={handleCategoryChange}
                            placeholder="Selecione Categorias"
                        />
                    </div>                </div>
            </div>

            <div className="dashboard-content">
                <div className="column-grid">
                    {/* Column 0: Generate O.S. (New) */}
                    <div className="dashboard-column">
                        <KPICard data={{ ...kpiData.generateOS, count: filteredGenerateOS.length }} />
                        <ProjectColumn
                            title="CLIENTE"
                            secondTitle="DIAS"
                            data={filteredGenerateOS}
                            type="with-days"
                        />
                    </div>

                    {/* Column 1: To Deliver (Swapped) */}
                    <div className="dashboard-column">
                        <KPICard data={{ ...kpiData.toDeliver, count: filteredToDeliver.length }} />
                        <ProjectColumn
                            title="CLIENTE"
                            secondTitle="DIAS"
                            data={filteredToDeliver}
                            type="with-days"
                        />
                    </div>

                    {/* Column 2: Priority (Swapped) */}
                    <div className="dashboard-column">
                        <KPICard data={{ ...kpiData.priorities, count: filteredPriorities.length }} />
                        <ProjectColumn
                            title="CLIENTE"
                            secondTitle="DIAS"
                            data={filteredPriorities}
                            type="with-days"
                        />
                    </div>

                    {/* Column 3: Delivered */}
                    <div className="dashboard-column">
                        <KPICard data={{ ...kpiData.delivered, count: filteredDelivered.length }} />
                        <ProjectColumn
                            title="CLIENTES SEM EQUIPE"
                            secondTitle="DIAS"
                            data={filteredDelivered}
                            type="with-days"
                            emptyMessage="SEM OBRAS A DESIGNAR"
                        />
                    </div>

                    {/* Column 4: In Execution */}
                    <div className="dashboard-column">
                        <KPICard data={{ ...kpiData.inExecution, count: filteredInExecution.length }} />
                        <ProjectColumn
                            title="CLIENTE"
                            secondTitle="EQUIPE INSTALAÇÃO"
                            data={filteredInExecution}
                            type="with-team"
                        />
                    </div>
                </div>
            </div>

            <footer className="dashboard-footer">
                <p>Última sincronização com Google Sheets: {lastSync ? lastSync.toLocaleString('pt-BR') : 'aguardando...'}</p>
            </footer>
        </div>
    );
};

export default Dashboard;
