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

    const hasSetDefaultFilter = React.useRef(false);

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

                    // Set default filter: Select all EXCEPT 'MATUPÁ' ONLY ONCE
                    if (!hasSetDefaultFilter.current) {
                        const defaultSelection = result.cities.filter(c => c.toUpperCase() !== 'MATUPÁ');
                        setSelectedCities(defaultSelection);
                        hasSetDefaultFilter.current = true;
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
                <Header title="GESTÃO DE VISTORIAS" />

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

            <div className="dashboard-content" style={{ padding: '20px', overflowY: 'auto' }}>
                {/* Upper Cards removed as requested */}

                {/* Vistorias Detailed View Tables */}
                <div style={{ marginTop: '40px', paddingBottom: '40px' }}>
                    {renderTable("SOLICITAR VISTORIAS", filteredSolicitar, "#0B1B48", false)}
                    {renderTable("VISTORIAS SOLICITADAS", filteredSolicitadas, "#0B1B48", true)}
                    {renderTable("VISTORIAS ATRASADAS", filteredAtrasadas, "#B71C1C", true)}
                </div>
            </div>
        </div>
    );

    function renderTable(title, data, headerColor, showDays = true) {
        return (
            <div style={{ marginBottom: '30px' }}>
                <div className="section-header" style={{ backgroundColor: headerColor, color: 'white', padding: '10px 20px', fontSize: '1.2rem', fontWeight: 'bold', borderRadius: '5px 5px 0 0' }}>
                    {title}
                </div>
                <div style={{ overflowX: 'auto', backgroundColor: 'white', padding: '10px', borderRadius: '0 0 5px 5px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', color: 'black' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#F0F4F8', color: 'black', textAlign: 'left' }}>
                                <th style={{ padding: '10px', borderBottom: '2px solid #E0E0E0' }}>#</th>
                                <th style={{ padding: '10px', borderBottom: '2px solid #E0E0E0' }}>CIDADE</th>
                                <th style={{ padding: '10px', borderBottom: '2px solid #E0E0E0' }}>VENDEDOR</th>
                                <th style={{ padding: '10px', borderBottom: '2px solid #E0E0E0' }}>PASTA</th>
                                <th style={{ padding: '10px', borderBottom: '2px solid #E0E0E0' }}>ID PROJETO</th>
                                <th style={{ padding: '10px', borderBottom: '2px solid #E0E0E0' }}>CLIENTE</th>
                                <th style={{ padding: '10px', borderBottom: '2px solid #E0E0E0' }}>STATUS PROJETO</th>
                                <th style={{ padding: '10px', borderBottom: '2px solid #E0E0E0' }}>STATUS VISTORIA</th>
                                {showDays && <th style={{ padding: '10px', borderBottom: '2px solid #E0E0E0' }}>DIAS</th>}
                                <th style={{ padding: '10px', borderBottom: '2px solid #E0E0E0' }}>INSTALADOR</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((item, index) => (
                                <tr key={index} style={{ borderBottom: '1px solid #eee', backgroundColor: index % 2 === 0 ? 'white' : '#F9F9F9', color: 'black' }}>
                                    <td style={{ padding: '10px' }}>{index + 1}.</td>
                                    <td style={{ padding: '10px' }}>{item.city}</td>
                                    <td style={{ padding: '10px' }}>{item.seller || '-'}</td>
                                    <td style={{ padding: '10px' }}>{item.folder || '-'}</td>
                                    <td style={{ padding: '10px' }}>{item.external_id || '-'}</td>
                                    <td style={{ padding: '10px' }}>{item.client}</td>
                                    <td style={{ padding: '10px' }}>{item.project_status}</td>
                                    <td style={{ padding: '10px' }}>{item.vistoria_status || 'Não Solicitado'}</td>
                                    {showDays && <td style={{ padding: '10px' }}>{item.days || 0}</td>}
                                    <td style={{ padding: '10px' }}>{item.team || item.details?.split(' - ')[0] || 'null'}</td>
                                </tr>
                            ))}
                            {data.length === 0 && (
                                <tr>
                                    <td colSpan={showDays ? "10" : "9"} style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                                        Nenhum dado encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }
};

export default Vistoria;
