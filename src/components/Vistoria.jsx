import React, { useState, useEffect, useCallback } from 'react';
import Header from './Header';
import KPICard from './KPICard';
import ProjectColumn from './ProjectColumn';
import MultiSelect from './MultiSelect';
import './Dashboard.css'; // Reuse dashboard styles for grid
import { fetchDashboardData } from '../services/data';

const Vistoria = () => {
    const [vistoriaData, setVistoriaData] = useState({ solicitar: [], solicitadas: [], atrasadas: [] });
    const [cities, setCities] = useState([]);
    const [selectedCities, setSelectedCities] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async (citiesToFetch, isBackground = false) => {
        if (!isBackground) setLoading(true);
        try {
            const result = await fetchDashboardData(citiesToFetch);

            if (result) {
                if (result.vistoria) {
                    setVistoriaData(result.vistoria);
                }

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
    }, []);

    // Initial Load & Auto-Refresh
    useEffect(() => {
        loadData(selectedCities); // Initial (shows loading)

        // Refresh UI every 10 seconds to catch new data (Silent)
        const intervalId = setInterval(() => {
            loadData(selectedCities, true);
        }, 10 * 1000);

        return () => clearInterval(intervalId); // Cleanup on unmount
    }, [selectedCities, loadData]);

    // Handle City Change
    const handleCityChange = (newSelectedCities) => {
        setSelectedCities(newSelectedCities);
    };

    // Handle Search Change
    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
    };

    // Filter Logic
    const getFilteredData = (dataList) => {
        if (!dataList) return [];
        let filtered = dataList;

        if (searchTerm) {
            filtered = filtered.filter(item =>
                item.client.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        return filtered;
    };

    if (loading && !vistoriaData.solicitar.length && !vistoriaData.solicitadas.length && !vistoriaData.atrasadas.length) {
        return <div className="loading-screen">Carregando dados...</div>;
    }

    const filteredSolicitar = getFilteredData(vistoriaData.solicitar);
    const filteredSolicitadas = getFilteredData(vistoriaData.solicitadas);
    const filteredAtrasadas = getFilteredData(vistoriaData.atrasadas);

    return (
        <div className="dashboard-container">
            <div className="top-bar">
                <Header title="ANÁLISE PARA VISTORIA" />

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
                        <MultiSelect
                            options={cities}
                            selected={selectedCities}
                            onChange={handleCityChange}
                            placeholder="Todas"
                        />
                    </div>
                </div>
            </div>

            <div className="dashboard-content" style={{ padding: '20px' }}>
                {/* Using a 3-column grid for Vistoria */}
                <div className="column-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>

                    {/* Column 1: Solicitar Vistorias */}
                    <div className="dashboard-column">
                        <KPICard data={{ title: "SOLICITAR VISTORIAS", count: filteredSolicitar.length }} />
                        <ProjectColumn
                            title="OBRA"
                            secondTitle="DETALHES"
                            data={filteredSolicitar}
                            type="simple"
                            emptyMessage="Nenhuma vistoria a solicitar"
                        />
                    </div>

                    {/* Column 2: Vistorias Solicitadas */}
                    <div className="dashboard-column">
                        <KPICard data={{ title: "VISTORIAS SOLICITADAS", count: filteredSolicitadas.length }} />
                        <ProjectColumn
                            title="OBRA"
                            secondTitle="DIAS"
                            data={filteredSolicitadas}
                            type="with-days"
                            emptyMessage="Nenhuma solicitação pendente"
                        />
                    </div>

                    {/* Column 3: Vistorias Atrasadas */}
                    <div className="dashboard-column">
                        <KPICard data={{ title: "VISTORIAS ATRASADAS", count: filteredAtrasadas.length }} />
                        <ProjectColumn
                            title="OBRA"
                            secondTitle="DIAS"
                            data={filteredAtrasadas}
                            type="with-days"
                            emptyMessage="Nenhuma vistoria atrasada"
                        />
                    </div>

                </div>
            </div>
        </div>
    );
};

export default Vistoria;
