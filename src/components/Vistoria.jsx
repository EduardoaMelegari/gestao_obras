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
    const [activeVistoriaTab, setActiveVistoriaTab] = useState('projetos');

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

    const isAmpliacaoItem = (item) => (item.category || '').toUpperCase().includes('AMPLIA');

    const filterByVistoriaTab = (dataList) => {
        if (activeVistoriaTab === 'ampliacao') return dataList.filter(isAmpliacaoItem);
        return dataList.filter(item => !isAmpliacaoItem(item));
    };

    const tabCount = (tab) => {
        const shouldBeAmpliacao = tab === 'ampliacao';
        const countByTab = (dataList) => dataList.filter(item => isAmpliacaoItem(item) === shouldBeAmpliacao).length;
        return countByTab(filteredSolicitar) + countByTab(filteredSolicitadas) + countByTab(filteredAtrasadas);
    };

    const visibleSolicitar = filterByVistoriaTab(filteredSolicitar);
    const visibleSolicitadas = filterByVistoriaTab(filteredSolicitadas);
    const visibleAtrasadas = filterByVistoriaTab(filteredAtrasadas);

    // ── Theme-aware color helpers ──────────────────────────────────────────
    const tc = {
        tablePanel:   'white',
        tableBorder:  'rgba(0,0,0,0.1)',
        headBg:       '#F0F4F8',
        headText:     'black',
        rowEven:      'white',
        rowOdd:       '#F9F9F9',
        rowBorder:    '#eee',
        cellText:     'black',
        emptyText:    '#888',
    };

    const getTipo = (item) => {
        const cat = (item.category || '').toUpperCase();
        return cat.includes('AMPLIA') ? 'AMPLIAÇÃO' : 'PROJETO';
    };

    const renderTable = (title, data, headerColor, showDays = true) => {
        return (
            <div style={{ marginBottom: '30px' }}>
                <div className="section-header" style={{ backgroundColor: headerColor, color: 'white', padding: '10px 20px', fontSize: '1.2rem', fontWeight: 'bold', borderRadius: '5px 5px 0 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {title}
                    <span style={{ fontSize: '0.85rem', fontWeight: 'normal', opacity: 0.85, background: 'rgba(255,255,255,0.15)', borderRadius: '12px', padding: '2px 10px' }}>{data.length} registros</span>
                </div>
                <div style={{ overflowX: 'auto', backgroundColor: tc.tablePanel, padding: '10px', borderRadius: '0 0 5px 5px', boxShadow: `0 2px 4px ${tc.tableBorder}` }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', color: tc.cellText }}>
                        <thead>
                            <tr style={{ backgroundColor: tc.headBg, color: tc.headText, textAlign: 'left' }}>
                                <th style={{ padding: '10px', borderBottom: `2px solid ${tc.rowBorder}` }}>#</th>
                                <th style={{ padding: '10px', borderBottom: `2px solid ${tc.rowBorder}` }}>TIPO</th>
                                <th style={{ padding: '10px', borderBottom: `2px solid ${tc.rowBorder}` }}>CIDADE</th>
                                <th style={{ padding: '10px', borderBottom: `2px solid ${tc.rowBorder}` }}>VENDEDOR</th>
                                <th style={{ padding: '10px', borderBottom: `2px solid ${tc.rowBorder}` }}>PASTA</th>
                                <th style={{ padding: '10px', borderBottom: `2px solid ${tc.rowBorder}` }}>ID PROJETO</th>
                                <th style={{ padding: '10px', borderBottom: `2px solid ${tc.rowBorder}` }}>CLIENTE</th>
                                <th style={{ padding: '10px', borderBottom: `2px solid ${tc.rowBorder}` }}>STATUS PROJETO</th>
                                <th style={{ padding: '10px', borderBottom: `2px solid ${tc.rowBorder}` }}>STATUS VISTORIA</th>
                                {showDays && <th style={{ padding: '10px', borderBottom: `2px solid ${tc.rowBorder}` }}>DIAS</th>}
                                <th style={{ padding: '10px', borderBottom: `2px solid ${tc.rowBorder}` }}>INSTALADOR</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((item, index) => {
                                const tipo = getTipo(item);
                                const isAmpliacao = tipo === 'AMPLIAÇÃO';
                                return (
                                    <tr key={index} style={{ borderBottom: `1px solid ${tc.rowBorder}`, backgroundColor: index % 2 === 0 ? tc.rowEven : tc.rowOdd, color: tc.cellText }}>
                                        <td style={{ padding: '10px' }}>{index + 1}.</td>
                                        <td style={{ padding: '10px' }}>
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '2px 10px',
                                                borderRadius: '12px',
                                                fontSize: '0.78rem',
                                                fontWeight: 700,
                                                letterSpacing: '0.03em',
                                                background: isAmpliacao ? '#f0abfc' : '#bfdbfe',
                                                color: isAmpliacao ? '#701a75' : '#1e3a8a',
                                                border: `1px solid ${isAmpliacao ? '#d946ef' : '#3b82f6'}`,
                                            }}>
                                                {tipo}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px' }}>{item.city}</td>
                                        <td style={{ padding: '10px' }}>{item.seller || '-'}</td>
                                        <td style={{ padding: '10px' }}>{item.folder || '-'}</td>
                                        <td style={{ padding: '10px' }}>{item.external_id || '-'}</td>
                                        <td style={{ padding: '10px', fontWeight: 600 }}>{item.client}</td>
                                        <td style={{ padding: '10px' }}>{item.project_status}</td>
                                        <td style={{ padding: '10px' }}>{item.vistoria_status || 'Não Solicitado'}</td>
                                        {showDays && (
                                            <td style={{ padding: '10px' }}>
                                                <span style={{
                                                    fontWeight: 700,
                                                    color: (item.days || 0) > 7 ? '#ef4444' : (item.days || 0) > 3 ? '#f59e0b' : '#22c55e'
                                                }}>
                                                    {item.days || 0}d
                                                </span>
                                            </td>
                                        )}
                                        <td style={{ padding: '10px' }}>{item.team || item.details?.split(' - ')[0] || '-'}</td>
                                    </tr>
                                );
                            })}
                            {data.length === 0 && (
                                <tr>
                                    <td colSpan={showDays ? "11" : "10"} style={{ padding: '20px', textAlign: 'center', color: tc.emptyText }}>
                                        Nenhum dado encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

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
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                        <button
                            onClick={() => setActiveVistoriaTab('projetos')}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: activeVistoriaTab === 'projetos' ? '#1d4ed8' : '#1e293b',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                opacity: activeVistoriaTab === 'projetos' ? 1 : 0.75
                            }}
                        >
                            Vistorias de Projetos ({tabCount('projetos')})
                        </button>
                        <button
                            onClick={() => setActiveVistoriaTab('ampliacao')}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: activeVistoriaTab === 'ampliacao' ? '#b45309' : '#1e293b',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                opacity: activeVistoriaTab === 'ampliacao' ? 1 : 0.75
                            }}
                        >
                            Vistorias de Ampliação ({tabCount('ampliacao')})
                        </button>
                    </div>

                    {renderTable(`${activeVistoriaTab === 'projetos' ? 'PROJETOS' : 'AMPLIAÇÃO'} - SOLICITAR VISTORIAS`, visibleSolicitar, "#0B1B48", true)}
                    {renderTable(`${activeVistoriaTab === 'projetos' ? 'PROJETOS' : 'AMPLIAÇÃO'} - VISTORIAS SOLICITADAS`, visibleSolicitadas, "#0B1B48", true)}
                    {renderTable(`${activeVistoriaTab === 'projetos' ? 'PROJETOS' : 'AMPLIAÇÃO'} - VISTORIAS ATRASADAS`, visibleAtrasadas, "#B71C1C", true)}
                </div>
            </div>
        </div>
    );
};

export default Vistoria;
