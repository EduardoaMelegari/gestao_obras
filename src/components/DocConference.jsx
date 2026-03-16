import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Header from './Header';
import ProjectTable from './ProjectTable';
import MultiSelect from './MultiSelect';
import './Dashboard.css';
import './Projects.css';
import { fetchDocConferenceData } from '../services/data';

const OPERATION_TABS = [
    { id: 'pending', label: 'A Conferir', color: '#ea580c' },
    { id: 'completed', label: 'Conferidas', color: '#16a34a' },
];

const filterFieldStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: '4px',
    minWidth: 0,
};

const viewButtonStyle = (isActive, activeColor) => ({
    padding: '8px 22px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '13px',
    letterSpacing: '0.04em',
    backgroundColor: isActive ? activeColor : '#1e293b',
    color: isActive ? '#fff' : '#94a3b8',
    transition: 'background-color 0.2s',
});

const normalizeText = (value) =>
    String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

const parseFlexibleDate = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return null;

    if (raw.includes('/')) {
        const parts = raw.split('/').map(p => p.trim());
        if (parts.length === 3) {
            const [dd, mm, yyyy] = parts;
            const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
            return Number.isNaN(d.getTime()) ? null : d;
        }
    }

    if (raw.includes('-')) {
        const parts = raw.split('-').map(p => p.trim());
        if (parts.length === 3) {
            const [yyyy, mm, dd] = parts;
            const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
            return Number.isNaN(d.getTime()) ? null : d;
        }
    }

    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
};

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const uniqueSorted = (items) =>
    [...new Set(items.filter(Boolean).map(v => String(v).trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));

const DocConference = () => {
    const [rawRecords, setRawRecords] = useState([]);
    const [activeView, setActiveView] = useState('projetos');
    const [activeMode, setActiveMode] = useState('operacao');
    const [activeOperationTab, setActiveOperationTab] = useState('pending');

    const [cities, setCities] = useState([]);
    const [selectedCities, setSelectedCities] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [sellers, setSellers] = useState([]);
    const [selectedSellers, setSelectedSellers] = useState([]);
    const [confStatuses, setConfStatuses] = useState(['Finalizado', 'Não Finalizado']);
    const [selectedConfStatuses, setSelectedConfStatuses] = useState([]);

    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const isFirstLoad = useRef(true);
    const hasInitializedFilters = useRef(false);

    const loadData = useCallback(async (isBackground = false) => {
        if (!isBackground && isFirstLoad.current) setLoading(true);

        try {
            const result = await fetchDocConferenceData();
            if (!result) throw new Error('Resposta vazia da API de conferência');

            setError(null);

            const records = result.records || [
                ...(result.sections?.pending || []),
                ...(result.sections?.completed || []),
            ];
            setRawRecords(records);

            const optionCities = (result.cities && result.cities.length > 0)
                ? result.cities
                : uniqueSorted(records.map(r => r.city));
            const optionCategories = (result.categories && result.categories.length > 0)
                ? result.categories
                : uniqueSorted(records.map(r => r.category));
            const optionSellers = (result.sellers && result.sellers.length > 0)
                ? result.sellers
                : uniqueSorted(records.map(r => r.seller));

            setCities(optionCities);
            setCategories(optionCategories);
            setSellers(optionSellers);
            setConfStatuses(result.confStatuses && result.confStatuses.length > 0 ? result.confStatuses : ['Finalizado', 'Não Finalizado']);

            if (!hasInitializedFilters.current && optionCities.length > 0) {
                hasInitializedFilters.current = true;
                const withoutMatupa = optionCities.filter(c =>
                    normalizeText(c) !== 'matupa'
                );
                setSelectedCities(withoutMatupa);
            }
        } catch (err) {
            console.error(err);
            if (!isBackground) setError(`Erro ao carregar dados: ${err.message || 'falha de conexão com o servidor'}`);
        } finally {
            if (!isBackground && isFirstLoad.current) {
                setLoading(false);
                isFirstLoad.current = false;
            }
        }
    }, []);

    useEffect(() => {
        loadData();
        const intervalId = setInterval(() => {
            loadData(true);
        }, 30 * 1000);

        return () => clearInterval(intervalId);
    }, [loadData]);

    useEffect(() => {
        setSelectedCities((current) => current.filter(value => cities.includes(value)));
    }, [cities]);

    useEffect(() => {
        setSelectedCategories((current) => current.filter(value => categories.includes(value)));
    }, [categories]);

    useEffect(() => {
        setSelectedSellers((current) => current.filter(value => sellers.includes(value)));
    }, [sellers]);

    useEffect(() => {
        setSelectedConfStatuses((current) => current.filter(value => confStatuses.includes(value)));
    }, [confStatuses]);

    const filteredRecords = useMemo(() => {
        const fromDate = dateFrom ? parseFlexibleDate(dateFrom) : null;
        const toDateRaw = dateTo ? parseFlexibleDate(dateTo) : null;
        const toDate = toDateRaw ? new Date(startOfDay(toDateRaw).getTime() + (24 * 60 * 60 * 1000)) : null;
        const term = normalizeText(searchTerm);
        const selectedStatusSet = new Set(selectedConfStatuses.map(normalizeText));

        return rawRecords.filter((item) => {
            const isAmpliacao = String(item?.category || '').toUpperCase().includes('AMPLIA');
            if (activeView === 'projetos' && isAmpliacao) return false;
            if (activeView === 'ampliacao' && !isAmpliacao) return false;

            if (selectedCities.length > 0 && !selectedCities.includes(item.city)) return false;
            if (selectedCategories.length > 0 && !selectedCategories.includes(item.category)) return false;
            if (selectedSellers.length > 0 && !selectedSellers.includes(item.seller)) return false;

            if (selectedStatusSet.size > 0) {
                const statusGroup = normalizeText(item.doc_conf_status_group || 'Não Finalizado');
                if (!selectedStatusSet.has(statusGroup)) return false;
            }

            const payDate = parseFlexibleDate(item.payment_date);
            if (fromDate || toDate) {
                if (!payDate) return false;
                const payStart = startOfDay(payDate);
                if (fromDate && payStart < startOfDay(fromDate)) return false;
                if (toDate && payStart >= toDate) return false;
            }

            if (term) {
                const fields = [
                    item.client,
                    item.city,
                    item.seller,
                    item.external_id,
                    item.folder,
                    item.doc_conf_status,
                    item.doc_conf_status_group,
                ];
                const matches = fields.some((value) => normalizeText(value).includes(term));
                if (!matches) return false;
            }

            return true;
        });
    }, [
        rawRecords,
        activeView,
        selectedCities,
        selectedCategories,
        selectedSellers,
        selectedConfStatuses,
        dateFrom,
        dateTo,
        searchTerm
    ]);

    const pending = useMemo(
        () => filteredRecords.filter(item => item.conference_status === 'PENDENTE'),
        [filteredRecords]
    );

    const completed = useMemo(
        () => filteredRecords.filter(item => item.conference_status === 'CONFERIDA'),
        [filteredRecords]
    );

    const sellerRows = useMemo(() => {
        const onlyValidDays = filteredRecords.filter(item => Number.isFinite(Number(item.days_in_conference)));
        const map = new Map();

        onlyValidDays.forEach((item) => {
            const seller = String(item.seller || '').trim() || 'SEM VENDEDOR';
            const days = Number(item.days_in_conference);
            const isFinished = Boolean(parseFlexibleDate(item.doc_conf_date));

            if (!map.has(seller)) {
                map.set(seller, {
                    seller,
                    total: 0,
                    sumDays: 0,
                    maxDays: Number.NEGATIVE_INFINITY,
                    minDays: Number.POSITIVE_INFINITY,
                    finished: 0,
                    inProgress: 0,
                });
            }

            const row = map.get(seller);
            row.total += 1;
            row.sumDays += days;
            row.maxDays = Math.max(row.maxDays, days);
            row.minDays = Math.min(row.minDays, days);
            if (isFinished) row.finished += 1;
            else row.inProgress += 1;
        });

        return Array.from(map.values())
            .map((row) => ({
                seller: row.seller,
                avg_days: Number((row.sumDays / row.total).toFixed(1)),
                total_cases: row.total,
                finished_cases: row.finished,
                in_progress_cases: row.inProgress,
                max_days: row.maxDays,
                min_days: row.minDays,
            }))
            .sort((a, b) => {
                if (b.avg_days !== a.avg_days) return b.avg_days - a.avg_days;
                return b.total_cases - a.total_cases;
            });
    }, [filteredRecords]);

    const sellerTotals = useMemo(() => {
        const totalCases = sellerRows.reduce((acc, row) => acc + row.total_cases, 0);
        const weightedAvg = totalCases > 0
            ? Number((sellerRows.reduce((acc, row) => acc + (row.avg_days * row.total_cases), 0) / totalCases).toFixed(1))
            : 0;

        return {
            sellers: sellerRows.length,
            cases: totalCases,
            avg_days: weightedAvg,
        };
    }, [sellerRows]);

    const maxAvgDays = useMemo(
        () => sellerRows.length > 0 ? Math.max(...sellerRows.map(row => row.avg_days)) : 0,
        [sellerRows]
    );

    const getDaysRowClass = (item, tabId) => {
        const days = Number(item.days_in_conference);
        if (!Number.isFinite(days)) return '';

        if (tabId === 'pending') {
            if (days > 10) return 'row-red';
            if (days > 5) return 'row-yellow';
            return 'row-blue';
        }

        if (tabId === 'completed' && days > 10) return 'row-yellow';
        return '';
    };

    const columns = [
        { header: 'CIDADE', accessor: 'city', width: '8%' },
        { header: 'PASTA', accessor: 'folder', width: '8%' },
        { header: 'ID PROJETO', accessor: 'external_id', width: '10%' },
        { header: 'CLIENTE', accessor: 'client' },
        { header: 'VENDEDOR', accessor: 'seller', width: '12%' },
        { header: 'DATA PAGAMENTO', accessor: 'payment_date', width: '11%' },
        {
            header: 'DATA FINALIZAÇÃO CONF.',
            accessor: 'doc_conf_date',
            width: '12%',
            render: (item) => item.doc_conf_date || '-'
        },
        {
            header: 'DIAS',
            accessor: 'days_in_conference',
            width: '7%',
            render: (item) => (
                item.days_in_conference === null || item.days_in_conference === undefined
                    ? '-'
                    : item.days_in_conference
            )
        },
        {
            header: 'STATUS CONF. DOC.',
            accessor: 'doc_conf_status',
            width: '12%',
            render: (item) => item.doc_conf_status || 'SEM STATUS'
        },
        { header: 'OBS', accessor: 'details', width: '20%' },
    ];

    const getOperationTabContent = () => {
        if (activeOperationTab === 'pending') {
            return (
                <ProjectTable
                    title={`${activeView === 'ampliacao' ? 'AMPLIAÇÃO' : 'PROJETOS'} - A CONFERIR`}
                    columns={columns}
                    data={pending}
                    getRowClass={(item) => getDaysRowClass(item, 'pending')}
                    headerColor="#c2410c"
                />
            );
        }

        return (
            <ProjectTable
                title={`${activeView === 'ampliacao' ? 'AMPLIAÇÃO' : 'PROJETOS'} - CONFERIDAS`}
                columns={columns}
                data={completed}
                getRowClass={(item) => getDaysRowClass(item, 'completed')}
                headerColor="#166534"
            />
        );
    };

    const renderSellerDashboard = () => {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', minHeight: 0 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '8px 12px', color: '#cbd5e1' }}>
                            Vendedores: <strong style={{ color: '#fff' }}>{sellerTotals.sellers}</strong>
                        </div>
                        <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '8px 12px', color: '#cbd5e1' }}>
                            Casos: <strong style={{ color: '#fff' }}>{sellerTotals.cases}</strong>
                        </div>
                        <div style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '8px 12px', color: '#cbd5e1' }}>
                            Média geral: <strong style={{ color: '#fff' }}>{sellerTotals.avg_days} dias</strong>
                        </div>
                    </div>
                </div>

                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: '10px', padding: '14px' }}>
                    {sellerRows.length === 0 && (
                        <div style={{ color: '#94a3b8', padding: '12px 0' }}>Nenhum vendedor encontrado para os filtros atuais.</div>
                    )}

                    {sellerRows.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {sellerRows.map((row, index) => {
                                const width = maxAvgDays > 0 ? Math.max(4, (row.avg_days / maxAvgDays) * 100) : 4;
                                return (
                                    <div key={`${row.seller}-${index}`} style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '10px 12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '7px' }}>
                                            <strong style={{ color: '#f8fafc', fontSize: '0.9rem' }}>
                                                {index + 1}. {row.seller}
                                            </strong>
                                            <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: '0.9rem' }}>
                                                {row.avg_days} dias (média)
                                            </span>
                                        </div>

                                        <div style={{ width: '100%', height: '12px', backgroundColor: '#1e293b', borderRadius: '999px', overflow: 'hidden' }}>
                                            <div style={{ width: `${width}%`, height: '100%', background: 'linear-gradient(90deg, #f97316 0%, #dc2626 100%)' }} />
                                        </div>

                                        <div style={{ marginTop: '8px', color: '#cbd5e1', fontSize: '0.8rem', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                            <span>Casos: <strong style={{ color: '#fff' }}>{row.total_cases}</strong></span>
                                            <span>Finalizados: <strong style={{ color: '#22c55e' }}>{row.finished_cases}</strong></span>
                                            <span>Em andamento: <strong style={{ color: '#f59e0b' }}>{row.in_progress_cases}</strong></span>
                                            <span>Maior: <strong style={{ color: '#fff' }}>{row.max_days}d</strong></span>
                                            <span>Menor: <strong style={{ color: '#fff' }}>{row.min_days}d</strong></span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="dashboard-container projects-view">
            {loading && <div className="loading-screen">Carregando dados...</div>}
            {!loading && error && <div className="error-screen">{error}</div>}
            {!loading && !error && (
                <>
                    <div className="top-bar" style={{ height: 'auto', minHeight: '132px', alignItems: 'stretch', justifyContent: 'flex-start', flexDirection: 'column', gap: '8px', paddingTop: '10px', paddingBottom: '10px' }}>
                        <Header title="CONFERÊNCIA DE DOCUMENTAÇÃO" />

                        <div className="filter-group" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(220px, 1fr))', gap: '10px', width: '100%' }}>
                                <div style={filterFieldStyle}>
                                    <label htmlFor="doc-conf-search">Buscar:</label>
                                    <input
                                        type="text"
                                        id="doc-conf-search"
                                        className="search-input"
                                        placeholder="Busca..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ width: '100%' }}
                                    />
                                </div>

                                <div style={filterFieldStyle}>
                                    <label>Cidade:</label>
                                    <MultiSelect
                                        options={cities}
                                        selected={selectedCities}
                                        onChange={setSelectedCities}
                                        placeholder="Todas"
                                    />
                                </div>

                                <div style={filterFieldStyle}>
                                    <label>Vendedor:</label>
                                    <MultiSelect
                                        options={sellers}
                                        selected={selectedSellers}
                                        onChange={setSelectedSellers}
                                        placeholder="Todos"
                                    />
                                </div>

                                <div style={filterFieldStyle}>
                                    <label>Categoria:</label>
                                    <MultiSelect
                                        options={categories}
                                        selected={selectedCategories}
                                        onChange={setSelectedCategories}
                                        placeholder="Todas"
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(220px, 1fr))', gap: '10px', width: '100%' }}>
                                <div style={filterFieldStyle}>
                                    <label>Status Conf. Doc.:</label>
                                    <MultiSelect
                                        options={confStatuses}
                                        selected={selectedConfStatuses}
                                        onChange={setSelectedConfStatuses}
                                        placeholder="Todos"
                                    />
                                </div>

                                <div style={filterFieldStyle}>
                                    <label htmlFor="doc-conf-date-from-global">Pagto. de:</label>
                                    <input
                                        id="doc-conf-date-from-global"
                                        type="date"
                                        value={dateFrom}
                                        onChange={(e) => setDateFrom(e.target.value)}
                                        className="search-input"
                                        style={{ width: '100%' }}
                                    />
                                </div>

                                <div style={filterFieldStyle}>
                                    <label htmlFor="doc-conf-date-to-global">Pagto. até:</label>
                                    <input
                                        id="doc-conf-date-to-global"
                                        type="date"
                                        value={dateTo}
                                        onChange={(e) => setDateTo(e.target.value)}
                                        className="search-input"
                                        style={{ width: '100%' }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="dashboard-content">
                        <div style={{ display: 'flex', gap: '0', marginBottom: '14px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #334155', alignSelf: 'flex-start', width: 'fit-content' }}>
                            <button
                                onClick={() => setActiveView('projetos')}
                                style={viewButtonStyle(activeView === 'projetos', '#2563eb')}
                            >
                                Projetos
                            </button>
                            <button
                                onClick={() => setActiveView('ampliacao')}
                                style={{ ...viewButtonStyle(activeView === 'ampliacao', '#d97706'), borderLeft: '1px solid #334155' }}
                            >
                                Ampliações
                            </button>
                        </div>

                        <div className="tabs-container" style={{ marginBottom: '8px' }}>
                            <button
                                className={`tab-btn ${activeMode === 'operacao' ? 'tab-active' : ''}`}
                                style={activeMode === 'operacao' ? { backgroundColor: '#2563eb' } : {}}
                                onClick={() => setActiveMode('operacao')}
                            >
                                Operação
                            </button>
                            <button
                                className={`tab-btn ${activeMode === 'seller_dashboard' ? 'tab-active' : ''}`}
                                style={activeMode === 'seller_dashboard' ? { backgroundColor: '#9333ea' } : {}}
                                onClick={() => setActiveMode('seller_dashboard')}
                            >
                                Dashboard Vendedores
                            </button>
                        </div>

                        {activeMode === 'operacao' && (
                            <>
                                <div className="tabs-container">
                                    {OPERATION_TABS.map((tab) => (
                                        <button
                                            key={tab.id}
                                            className={`tab-btn ${activeOperationTab === tab.id ? 'tab-active' : ''}`}
                                            style={activeOperationTab === tab.id ? { backgroundColor: tab.color } : {}}
                                            onClick={() => setActiveOperationTab(tab.id)}
                                        >
                                            {tab.label} ({tab.id === 'pending' ? pending.length : completed.length})
                                        </button>
                                    ))}
                                </div>

                                <div className="tab-content">
                                    {getOperationTabContent()}
                                </div>
                            </>
                        )}

                        {activeMode === 'seller_dashboard' && (
                            <div className="tab-content">
                                {renderSellerDashboard()}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default DocConference;
