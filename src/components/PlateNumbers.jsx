import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header from './Header';
import MultiSelect from './MultiSelect';
import ProjectTable from './ProjectTable';
import { fetchPlatesData } from '../services/data';
import './Dashboard.css';
import './Projects.css';
import './PlateNumbers.css';

function parseDateString(value) {
    if (!value) return null;
    const text = String(value).trim();
    if (!text) return null;

    const normalized = text
        .replace(/[^0-9/-]/g, '')
        .replace(/\/+/g, '/')
        .replace(/-+/g, '-')
        .replace(/^[/\\-]+|[/\\-]+$/g, '');

    if (normalized.includes('/') || normalized.includes('-')) {
        const separator = normalized.includes('/') ? '/' : '-';
        const parts = normalized.split(separator).filter(Boolean);
        if (parts.length === 3) {
            if (parts[0].length === 4) {
                const [yyyy, mm, dd] = parts;
                const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
                return Number.isNaN(d.getTime()) ? null : d;
            }
            const [dd, mm, yyyy] = parts;
            const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
            return Number.isNaN(d.getTime()) ? null : d;
        }
    }

    const d = new Date(text);
    return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatNumber(value, fractionDigits = 0) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
    return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: fractionDigits, minimumFractionDigits: fractionDigits });
}

const PlateNumbers = () => {
    const [entries, setEntries] = useState([]);
    const [branches, setBranches] = useState([]);
    const [powerOptions, setPowerOptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const isFirstLoad = useRef(true);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBranches, setSelectedBranches] = useState([]);
    const [selectedPowers, setSelectedPowers] = useState([]);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [plateCountMin, setPlateCountMin] = useState('');
    const [plateCountMax, setPlateCountMax] = useState('');
    const [totalKwMin, setTotalKwMin] = useState('');
    const [totalKwMax, setTotalKwMax] = useState('');

    const loadData = useCallback(async (isBackground = false) => {
        if (!isBackground && isFirstLoad.current) setLoading(true);
        try {
            const result = await fetchPlatesData();
            if (!result) throw new Error('Resposta vazia da API de placas');

            setEntries(result.entries || []);

            const branchOptions = result.filters?.branches || [];
            const powerList = (result.filters?.platePowers || []).map((v) => String(v));

            setBranches(branchOptions);
            setPowerOptions(powerList);
            setError(null);

            if (isFirstLoad.current) {
                setSelectedBranches(branchOptions);
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
        const intervalId = setInterval(() => loadData(true), 10000);
        return () => clearInterval(intervalId);
    }, [loadData]);

    const filteredEntries = useMemo(() => {
        const fromDate = dateFrom ? startOfDay(new Date(dateFrom)) : null;
        const toDateExclusive = dateTo ? new Date(new Date(dateTo).getFullYear(), new Date(dateTo).getMonth(), new Date(dateTo).getDate() + 1) : null;
        const countMin = plateCountMin === '' ? null : Number(plateCountMin);
        const countMax = plateCountMax === '' ? null : Number(plateCountMax);
        const kwMin = totalKwMin === '' ? null : Number(totalKwMin);
        const kwMax = totalKwMax === '' ? null : Number(totalKwMax);
        const activePowerSet = new Set(selectedPowers);
        const activeBranchSet = new Set(selectedBranches);
        const query = searchTerm.trim().toLowerCase();

        const filtered = entries.filter((item) => {
            if (selectedBranches.length > 0 && !activeBranchSet.has(item.branch)) return false;

            if (selectedPowers.length > 0) {
                const powerLabel = item.plate_power_w === null || item.plate_power_w === undefined ? '' : String(item.plate_power_w);
                if (!activePowerSet.has(powerLabel)) return false;
            }

            if (countMin !== null && Number.isFinite(countMin)) {
                if (item.plate_count === null || item.plate_count === undefined || Number(item.plate_count) < countMin) return false;
            }
            if (countMax !== null && Number.isFinite(countMax)) {
                if (item.plate_count === null || item.plate_count === undefined || Number(item.plate_count) > countMax) return false;
            }

            if (kwMin !== null && Number.isFinite(kwMin)) {
                if (item.plate_total_power_kw === null || item.plate_total_power_kw === undefined || Number(item.plate_total_power_kw) < kwMin) return false;
            }
            if (kwMax !== null && Number.isFinite(kwMax)) {
                if (item.plate_total_power_kw === null || item.plate_total_power_kw === undefined || Number(item.plate_total_power_kw) > kwMax) return false;
            }

            if (fromDate || toDateExclusive) {
                const installDate = parseDateString(item.install_date_iso || item.install_date);
                if (!installDate) return false;
                if (fromDate && installDate < fromDate) return false;
                if (toDateExclusive && installDate >= toDateExclusive) return false;
            }

            if (query) {
                const haystack = [
                    item.client,
                    item.folder,
                    item.seller,
                    item.plate_number,
                    item.branch,
                    item.install_status
                ]
                    .map(v => (v || '').toString().toLowerCase())
                    .join(' ');
                if (!haystack.includes(query)) return false;
            }

            return true;
        });

        return filtered.sort((a, b) => {
            const da = parseDateString(a.install_date_iso || a.install_date);
            const db = parseDateString(b.install_date_iso || b.install_date);
            if (da && db) return da.getTime() - db.getTime();
            if (da) return -1;
            if (db) return 1;
            return (b.days || 0) - (a.days || 0);
        });
    }, [
        entries,
        selectedBranches,
        selectedPowers,
        dateFrom,
        dateTo,
        plateCountMin,
        plateCountMax,
        totalKwMin,
        totalKwMax,
        searchTerm
    ]);

    const totals = useMemo(() => {
        const totalProjects = filteredEntries.length;
        const totalPlates = filteredEntries.reduce((sum, item) => sum + (item.plate_count || 0), 0);
        const totalPowerKw = filteredEntries.reduce((sum, item) => sum + (item.plate_total_power_kw || 0), 0);
        return { totalProjects, totalPlates, totalPowerKw };
    }, [filteredEntries]);

    const columns = [
        { header: 'FILIAL', accessor: 'branch', width: '9%' },
        { header: 'DATA INSTALAÇÃO', accessor: 'install_date', width: '10%' },
        { header: 'NÚMERO', accessor: 'plate_number', width: '8%' },
        { header: 'QTD. PLACAS', accessor: 'plate_count', width: '8%' },
        { header: 'POTÊNCIA PLACA (W)', accessor: 'plate_power_w', width: '10%', render: (item) => formatNumber(item.plate_power_w, 0) },
        { header: 'TOTAL (kWp)', accessor: 'plate_total_power_kw', width: '8%', render: (item) => formatNumber(item.plate_total_power_kw, 3) },
        { header: 'CLIENTE', accessor: 'client' },
        { header: 'PASTA', accessor: 'folder', width: '8%' },
        { header: 'VENDEDOR', accessor: 'seller', width: '10%' },
        { header: 'STATUS INSTALAÇÃO', accessor: 'install_status', width: '12%' },
        { header: 'DIAS', accessor: 'days', width: '6%' },
    ];

    return (
        <div className="dashboard-container projects-view plate-numbers-view">
            {loading && (
                <div className="loading-screen">Carregando dados...</div>
            )}

            {!loading && error && (
                <div className="error-screen">{error}</div>
            )}

            {!loading && !error && (
                <>
                    <div className="top-bar">
                        <Header title="NÚMERO DE PLACAS" />

                        <div className="filter-group plate-filters">
                            <div className="search-box">
                                <label htmlFor="plate-search">Buscar:</label>
                                <input
                                    id="plate-search"
                                    type="text"
                                    className="search-input"
                                    placeholder="Cliente, pasta, vendedor..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            <div className="city-selector">
                                <label>Filial:</label>
                                <MultiSelect
                                    options={branches}
                                    selected={selectedBranches}
                                    onChange={setSelectedBranches}
                                    placeholder="Todas"
                                />
                            </div>

                            <div className="city-selector">
                                <label>Potência Placa (W):</label>
                                <MultiSelect
                                    options={powerOptions}
                                    selected={selectedPowers}
                                    onChange={setSelectedPowers}
                                    placeholder="Todas"
                                />
                            </div>

                            <div className="plate-filter-inline">
                                <label htmlFor="plate-count-min">Qtd Placas:</label>
                                <input
                                    id="plate-count-min"
                                    className="city-dropdown plate-number-input"
                                    type="number"
                                    min="0"
                                    placeholder="Min"
                                    value={plateCountMin}
                                    onChange={(e) => setPlateCountMin(e.target.value)}
                                />
                                <input
                                    className="city-dropdown plate-number-input"
                                    type="number"
                                    min="0"
                                    placeholder="Max"
                                    value={plateCountMax}
                                    onChange={(e) => setPlateCountMax(e.target.value)}
                                />
                            </div>

                            <div className="plate-filter-inline">
                                <label>Totalizador (kWp):</label>
                                <input
                                    className="city-dropdown plate-number-input"
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    placeholder="Min"
                                    value={totalKwMin}
                                    onChange={(e) => setTotalKwMin(e.target.value)}
                                />
                                <input
                                    className="city-dropdown plate-number-input"
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    placeholder="Max"
                                    value={totalKwMax}
                                    onChange={(e) => setTotalKwMax(e.target.value)}
                                />
                            </div>

                            <div className="plate-filter-inline">
                                <label htmlFor="plate-date-from">Data:</label>
                                <input
                                    id="plate-date-from"
                                    className="city-dropdown"
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                />
                                <input
                                    className="city-dropdown"
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="dashboard-content">
                        <div className="plates-totals-row">
                            <div className="plates-total-card">
                                <span className="plates-total-label">Projetos</span>
                                <span className="plates-total-value">{formatNumber(totals.totalProjects, 0)}</span>
                            </div>
                            <div className="plates-total-card">
                                <span className="plates-total-label">Total de Placas</span>
                                <span className="plates-total-value">{formatNumber(totals.totalPlates, 0)}</span>
                            </div>
                            <div className="plates-total-card">
                                <span className="plates-total-label">Totalizador (kWp)</span>
                                <span className="plates-total-value">{formatNumber(totals.totalPowerKw, 3)}</span>
                            </div>
                        </div>

                        <div className="tab-content">
                            <ProjectTable
                                title="NÚMERO DE PLACAS (MAIS ANTIGOS PRIMEIRO)"
                                columns={columns}
                                data={filteredEntries}
                                headerColor="#0f4c81"
                                emptyMessage="Nenhum registro encontrado para os filtros selecionados."
                            />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default PlateNumbers;
