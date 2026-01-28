import React from 'react';
import Header from './Header';
import KPICard from './KPICard';
import ProjectColumn from './ProjectColumn';
import './Dashboard.css';

const Dashboard = () => {
    const [kpiData, setKpiData] = React.useState(null);
    const [projectData, setProjectData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);

    // City Filter State
    const [cities, setCities] = React.useState([]);
    const [selectedCity, setSelectedCity] = React.useState('');
    // Search State
    const [searchTerm, setSearchTerm] = React.useState('');

    const loadData = React.useCallback(async (cityToFetch) => {
        setLoading(true);
        try {
            const { fetchDashboardData } = await import('../services/data');
            const result = await fetchDashboardData(cityToFetch);

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
            setLoading(false);
        }
    }, [selectedCity]);

    // Initial Load
    React.useEffect(() => {
        loadData(selectedCity);
    }, []); // Run once on mount

    // Handle City Change
    const handleCityChange = (e) => {
        const newCity = e.target.value;
        setSelectedCity(newCity);
        loadData(newCity);
    };

    // Handle Search Change
    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
    };

    // Filter Logic
    const getFilteredData = (dataList) => {
        if (!dataList) return [];
        if (!searchTerm) return dataList;
        return dataList.filter(item =>
            item.client.toLowerCase().includes(searchTerm.toLowerCase())
        );
    };

    if (loading && !kpiData) {
        return <div className="loading-screen">Carregando dados...</div>;
    }

    if (!kpiData || !projectData) {
        return <div className="error-screen">Erro ao carregar dados. Verifique a conexão com o servidor.</div>;
    }

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

                    <div className="city-selector">
                        <label htmlFor="city-select">Filtrar por Cidade:</label>
                        <select
                            id="city-select"
                            value={selectedCity}
                            onChange={handleCityChange}
                            className="city-dropdown"
                        >
                            <option value="">Todas</option>
                            {cities.map(city => (
                                <option key={city} value={city}>{city}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="dashboard-content">
                <div className="column-grid">
                    {/* Column 0: Generate O.S. (New) */}
                    <div className="dashboard-column">
                        <KPICard data={kpiData.generateOS} />
                        <ProjectColumn
                            title="CLIENTE"
                            secondTitle="DIAS"
                            data={getFilteredData(projectData.generate_os)}
                            type="with-days"
                        />
                    </div>

                    {/* Column 1: To Deliver (Swapped) */}
                    <div className="dashboard-column">
                        <KPICard data={kpiData.toDeliver} />
                        <ProjectColumn
                            title="CLIENTE"
                            secondTitle="DIAS"
                            data={getFilteredData(projectData.to_deliver)}
                            type="with-days"
                        />
                    </div>

                    {/* Column 2: Priority (Swapped) */}
                    <div className="dashboard-column">
                        <KPICard data={kpiData.priorities} />
                        <ProjectColumn
                            title="CLIENTE"
                            secondTitle="DIAS"
                            data={getFilteredData(projectData.priority)}
                            type="with-days"
                        />
                    </div>

                    {/* Column 3: Delivered */}
                    <div className="dashboard-column">
                        <KPICard data={kpiData.delivered} />
                        <ProjectColumn
                            title="CLIENTES SEM EQUIPE"
                            data={getFilteredData(projectData.delivered)}
                            type="simple"
                            emptyMessage="SEM OBRAS A DESIGNAR"
                        />
                    </div>

                    {/* Column 4: In Execution */}
                    <div className="dashboard-column">
                        <KPICard data={kpiData.inExecution} />
                        <ProjectColumn
                            title="CLIENTE"
                            secondTitle="EQUIPE INSTALAÇÃO"
                            data={getFilteredData(projectData.in_execution)}
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
