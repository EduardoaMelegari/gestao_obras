import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchParadosData } from '../services/data';

// Color map for workflow stage badges
const STAGE_COLORS = {
    'Gerar O.S.':           { bg: '#fef3c7', text: '#92400e' },
    'Obras a Entregar':     { bg: '#dbeafe', text: '#1e40af' },
    'Prioridade p/ Entrega':{ bg: '#ede9fe', text: '#5b21b6' },
    'Obras Entregues':      { bg: '#d1fae5', text: '#065f46' },
    'Em Execução':          { bg: '#cffafe', text: '#155e75' },
    'Indefinido':           { bg: '#f3f4f6', text: '#374151' },
};

const thStyle = {
    padding: '10px',
    borderBottom: '2px solid #E0E0E0',
    textAlign: 'left',
    fontSize: '0.9rem',
    fontWeight: 700,
    color: 'black',
};

const tdStyle = { padding: '10px', color: 'black' };

const Parados = ({ searchTerm = '', selectedCities = [], selectedSellers = [] }) => {
    const [paradosData, setParadosData] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async (isBackground = false) => {
        if (!isBackground) setLoading(true);
        try {
            const result = await fetchParadosData(selectedCities, selectedSellers);
            if (result) {
                setParadosData(result.parados || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            if (!isBackground) setLoading(false);
        }
    }, [selectedCities, selectedSellers]);

    useEffect(() => {
        loadData();
        const id = setInterval(() => loadData(true), 30_000);
        return () => clearInterval(id);
    }, [loadData]);

    const filteredData = useMemo(() => {
        if (!searchTerm) return paradosData;
        const lower = searchTerm.toLowerCase();
        return paradosData.filter(item =>
            (item.client || '').toLowerCase().includes(lower)
        );
    }, [paradosData, searchTerm]);

    if (loading && paradosData.length === 0) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 0', color: '#94a3b8' }}>
                Carregando dados...
            </div>
        );
    }

    return (
        <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
            <div style={{ marginBottom: '30px' }}>
                {/* Header bar */}
                <div className="section-header" style={{
                    backgroundColor: '#7f1d1d',
                    color: 'white',
                    padding: '10px 20px',
                    fontSize: '1.2rem',
                    fontWeight: 'bold',
                    borderRadius: '5px 5px 0 0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}>
                    <span>OBRAS PARADAS</span>
                    <span style={{
                        backgroundColor: 'rgba(255,255,255,0.25)',
                        padding: '2px 12px',
                        borderRadius: '12px',
                        fontSize: '0.9rem',
                    }}>
                        {filteredData.length}
                    </span>
                </div>

                {/* Table */}
                <div style={{ overflowX: 'auto', backgroundColor: 'white', padding: '10px', borderRadius: '0 0 5px 5px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', color: 'black' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#F0F4F8', color: 'black', textAlign: 'left' }}>
                                <th style={thStyle}>#</th>
                                <th style={thStyle}>CIDADE</th>
                                <th style={thStyle}>VENDEDOR</th>
                                <th style={thStyle}>PASTA</th>
                                <th style={thStyle}>CLIENTE</th>
                                <th style={thStyle}>ETAPA</th>
                                <th style={thStyle}>DIAS</th>
                                <th style={thStyle}>STATUS</th>
                                <th style={thStyle}>OBS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.map((item, index) => {
                                const stage = item.stopped_stage || 'Indefinido';
                                const stageColor = STAGE_COLORS[stage] || STAGE_COLORS['Indefinido'];
                                return (
                                    <tr
                                        key={item.id || index}
                                        style={{
                                            borderBottom: '1px solid #eee',
                                            backgroundColor: index % 2 === 0 ? 'white' : '#F9F9F9',
                                            color: 'black',
                                        }}
                                    >
                                        <td style={tdStyle}>{index + 1}.</td>
                                        <td style={tdStyle}>{item.city || '-'}</td>
                                        <td style={tdStyle}>{item.seller || '-'}</td>
                                        <td style={tdStyle}>{item.folder || '-'}</td>
                                        <td style={{ ...tdStyle, fontWeight: 500 }}>{item.client}</td>
                                        <td style={tdStyle}>
                                            <span style={{
                                                backgroundColor: stageColor.bg,
                                                color: stageColor.text,
                                                padding: '3px 10px',
                                                borderRadius: '12px',
                                                fontWeight: 700,
                                                fontSize: '0.75rem',
                                                whiteSpace: 'nowrap',
                                            }}>
                                                {stage}
                                            </span>
                                        </td>
                                        <td style={{ ...tdStyle, fontWeight: 'bold' }}>{item.days ?? '-'}</td>
                                        <td style={tdStyle}>
                                            <span style={{
                                                backgroundColor: '#fee2e2',
                                                color: '#991b1b',
                                                padding: '3px 10px',
                                                borderRadius: '12px',
                                                fontWeight: 700,
                                                fontSize: '0.75rem',
                                            }}>
                                                {item.install_status || 'Parado'}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>{item.details || '-'}</td>
                                    </tr>
                                );
                            })}
                            {filteredData.length === 0 && (
                                <tr>
                                    <td colSpan="9" style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                                        Nenhuma obra parada encontrada.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Parados;
