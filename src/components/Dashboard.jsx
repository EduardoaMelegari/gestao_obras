import React from 'react';
import Header from './Header';
import KPICard from './KPICard';
import ProjectColumn from './ProjectColumn';
import MultiSelect from './MultiSelect';
import './Dashboard.css';

const Dashboard = () => {
    const [kpiData, setKpiData] = React.useState(null);
    const [projectData, setProjectData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);

    // City Filter State
    const [cities, setCities] = React.useState([]);
    const [selectedCities, setSelectedCities] = React.useState([]); // Changed to array
    // Search State
    const [searchTerm, setSearchTerm] = React.useState('');
    // Days Filter State
    const [daysFilter, setDaysFilter] = React.useState('');

    const loadData = React.useCallback(async (citiesToFetch, isBackground = false) => {
        if (!isBackground) setLoading(true);
        try {
            const { fetchDashboardData } = await import('../services/data');
            // If empty array, it might fetch all or nothing depending on backend. 
            // Usually if "All" is selected, we might pass empty or handle it in service.
            // Let's pass the array directly.
            const result = await fetchDashboardData(citiesToFetch);

            if (result) {
                setKpiData(result.kpi);
                setProjectData(result.projects);

                // Update available cities if provided
                if (result.cities && result.cities.length > 0) {
                    setCities(result.cities);
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            if (!isBackground) setLoading(false);
        }
    }, [selectedCities]);

    // Initial Load & Auto-Refresh
    React.useEffect(() => {
        loadData(selectedCities); // Initial (shows loading)

        // Refresh UI every 10 seconds to catch new data (Silent)
        const intervalId = setInterval(() => {
            loadData(selectedCities, true);
        }, 10 * 1000);

        return () => clearInterval(intervalId); // Cleanup on unmount
    }, [selectedCities]); // Re-run if city changes

    // Handle City Change
    const handleCityChange = (newSelectedCities) => {
        setSelectedCities(newSelectedCities);
        // loadData is triggered by useEffect dependency
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
            const minDays = parseInt(daysFilter);
            filtered = filtered.filter(item => item.days > minDays);
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
                <Header title="STATUS ENTREGA/INSTALAÇÃO OBRAS MATO GROSSO" />

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
                </div>
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
                            data={filteredDelivered}
                            type="simple"
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
                <p>Data de última atualização: {new Date().toLocaleString()} | Política de Privacidade</p>
            </footer>
        </div>
    );
};

export default Dashboard;
