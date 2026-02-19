import React, { useState, useEffect, useCallback } from 'react';
import './AdminReport.css';

// Gera ou recupera um sessionId único por aba do navegador
function getSessionId() {
    let id = sessionStorage.getItem('__admin_sid');
    if (!id) {
        id = crypto.randomUUID();
        sessionStorage.setItem('__admin_sid', id);
    }
    return id;
}

function formatDuration(seconds) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
}

function formatTime(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleTimeString('pt-BR');
}

function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR');
}

function browserIcon(browser = '') {
    if (browser.includes('Edge')) return '🔵';
    if (browser.includes('Chrome')) return '🌐';
    if (browser.includes('Firefox')) return '🦊';
    if (browser.includes('Safari')) return '🍎';
    if (browser.includes('Opera')) return '🎭';
    return '🖥️';
}

function parseUA(ua = '') {
    if (ua.includes('Edg/') || ua.includes('Edge/')) return '🔵 Edge';
    if (ua.includes('Chrome')) return '🌐 Chrome';
    if (ua.includes('Firefox')) return '🦊 Firefox';
    if (ua.includes('Safari')) return '🍎 Safari';
    return '🖥️ Outro';
}

const AdminReport = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [error, setError] = useState(null);

    const fetchStats = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await fetch('/api/admin/stats');
            if (!res.ok) throw new Error('Falha ao buscar dados');
            const data = await res.json();
            setStats(data);
            setLastUpdate(new Date());
            setError(null);
        } catch (e) {
            setError(e.message);
        } finally {
            if (!silent) setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
        const interval = setInterval(() => fetchStats(true), 10000);
        return () => clearInterval(interval);
    }, [fetchStats]);

    if (loading) return (
        <div className="admin-container">
            <div className="admin-loading">Carregando relatório...</div>
        </div>
    );

    if (error) return (
        <div className="admin-container">
            <div className="admin-error">❌ {error}</div>
        </div>
    );

    const { activeUsers, sessions, totalAccesses, accessHistory, kpi, lastSync, serverTime } = stats;

    return (
        <div className="admin-container">
            {/* Header */}
            <div className="admin-header">
                <div className="admin-header-left">
                    <h1 className="admin-title">🔒 Painel Administrativo</h1>
                    <p className="admin-subtitle">Acesso restrito — Solturi Engenharia</p>
                </div>
                <div className="admin-header-right">
                    <div className="admin-meta">
                        <span>🕐 Servidor: {formatTime(serverTime)}</span>
                        <span>🔄 Atualizado: {lastUpdate ? lastUpdate.toLocaleTimeString('pt-BR') : '-'}</span>
                        <span>📡 Última Sync Sheets: {lastSync ? new Date(lastSync).toLocaleTimeString('pt-BR') : 'Nunca'}</span>
                    </div>
                </div>
            </div>

            {/* Active Users KPI */}
            <div className="admin-section">
                <h2 className="admin-section-title">👥 Usuários Ativos Agora</h2>
                <div className="admin-kpi-row">
                    <div className="admin-kpi-card accent-green">
                        <div className="admin-kpi-value">{activeUsers}</div>
                        <div className="admin-kpi-label">Online Agora</div>
                        <div className="admin-kpi-dot-row">
                            {Array.from({ length: Math.min(activeUsers, 20) }).map((_, i) => (
                                <span key={i} className="admin-dot" />
                            ))}
                        </div>
                    </div>
                    <div className="admin-kpi-card accent-purple">
                        <div className="admin-kpi-value">{totalAccesses ?? 0}</div>
                        <div className="admin-kpi-label">Total de Acessos</div>
                    </div>
                    <div className="admin-kpi-card accent-blue">
                        <div className="admin-kpi-value">{kpi.totalProjects}</div>
                        <div className="admin-kpi-label">Total de Projetos</div>
                    </div>
                    <div className="admin-kpi-card accent-yellow">
                        <div className="admin-kpi-value">{kpi.byStatus.find(s => (s.label || '').toLowerCase().includes('não iniciado') || (s.label || '').toLowerCase().includes('nao iniciado'))?.count || 0}</div>
                        <div className="admin-kpi-label">Em Elaboração</div>
                    </div>
                    <div className="admin-kpi-card accent-orange">
                        <div className="admin-kpi-value">{kpi.byStatus.find(s => (s.label || '').toLowerCase() === 'protocolado')?.count || 0}</div>
                        <div className="admin-kpi-label">Protocolados</div>
                    </div>
                    <div className="admin-kpi-card accent-emerald">
                        <div className="admin-kpi-value">{kpi.byStatus.find(s => (s.label || '').toLowerCase() === 'finalizado')?.count || 0}</div>
                        <div className="admin-kpi-label">Finalizados</div>
                    </div>
                </div>
            </div>

            {/* Sessions Table */}
            <div className="admin-section">
                <h2 className="admin-section-title">🌍 Sessões Ativas — Localização</h2>
                {sessions.length === 0 ? (
                    <div className="admin-empty">Nenhum usuário ativo no momento.</div>
                ) : (
                    <div className="admin-table-wrap">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>ID Sessão</th>
                                    <th>IP</th>
                                    <th>🌆 Cidade</th>
                                    <th>📍 Estado</th>
                                    <th>🌐 País</th>
                                    <th>🗺️ Coords</th>
                                    <th>🖥️ Navegador</th>
                                    <th>⏱️ Online há</th>
                                    <th>🕐 Última ação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sessions.map((s, i) => (
                                    <tr key={s.id}>
                                        <td>{i + 1}</td>
                                        <td><code>{s.id}…</code></td>
                                        <td>{s.ip}</td>
                                        <td>{s.geo?.city || '...'}</td>
                                        <td>{s.geo?.region || '...'}</td>
                                        <td>{s.geo?.country || '...'}</td>
                                        <td>
                                            {s.geo?.lat && s.geo?.lon
                                                ? <a href={`https://maps.google.com/?q=${s.geo.lat},${s.geo.lon}`} target="_blank" rel="noreferrer" className="admin-map-link">
                                                    {s.geo.lat.toFixed(2)}, {s.geo.lon.toFixed(2)}
                                                  </a>
                                                : '-'}
                                        </td>
                                        <td>{parseUA(s.userAgent)}</td>
                                        <td className="admin-cell-green">{formatDuration(s.secondsOnline)}</td>
                                        <td>{formatTime(s.lastSeen)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Projects by Status */}
            <div className="admin-grid-2">
                <div className="admin-section">
                    <h2 className="admin-section-title">📊 Projetos por Status</h2>
                    <div className="admin-bar-list">
                        {kpi.byStatus.filter(s => s.label).map((s) => {
                            const max = Math.max(...kpi.byStatus.map(x => x.count));
                            const pct = max > 0 ? (s.count / max) * 100 : 0;
                            return (
                                <div key={s.label} className="admin-bar-row">
                                    <span className="admin-bar-label">{s.label || '(vazio)'}</span>
                                    <div className="admin-bar-track">
                                        <div className="admin-bar-fill" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="admin-bar-count">{s.count}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Projects by City */}
                <div className="admin-section">
                    <h2 className="admin-section-title">🏙️ Projetos por Cidade</h2>
                    <div className="admin-bar-list">
                        {kpi.byCity.map((c) => {
                            const max = Math.max(...kpi.byCity.map(x => x.count));
                            const pct = max > 0 ? (c.count / max) * 100 : 0;
                            return (
                                <div key={c.label} className="admin-bar-row">
                                    <span className="admin-bar-label">{c.label}</span>
                                    <div className="admin-bar-track">
                                        <div className="admin-bar-fill accent-blue-fill" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="admin-bar-count">{c.count}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Projects by Category */}
            <div className="admin-section">
                <h2 className="admin-section-title">🏷️ Projetos por Categoria</h2>
                <div className="admin-pill-list">
                    {kpi.byCategory.filter(c => c.label).map((c) => (
                        <div key={c.label} className="admin-pill">
                            <span className="admin-pill-label">{c.label}</span>
                            <span className="admin-pill-count">{c.count}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Access History */}
            <div className="admin-section">
                <h2 className="admin-section-title">📋 Histórico de Acessos — Últimos {(accessHistory || []).length}</h2>
                {!accessHistory || accessHistory.length === 0 ? (
                    <div className="admin-empty">Nenhum acesso registrado ainda.</div>
                ) : (
                    <div className="admin-table-wrap">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>📅 Data e Hora</th>
                                    <th>IP</th>
                                    <th>🌆 Cidade</th>
                                    <th>📍 Estado</th>
                                    <th>🌐 País</th>
                                    <th>🗺️ Localização</th>
                                    <th>🖥️ Navegador</th>
                                    <th>User Agent</th>
                                </tr>
                            </thead>
                            <tbody>
                                {accessHistory.map((a, i) => (
                                    <tr key={a.id}>
                                        <td className="admin-cell-muted">{(accessHistory.length - i)}</td>
                                        <td className="admin-cell-date">{formatDateTime(a.accessedAt)}</td>
                                        <td><code>{a.ip}</code></td>
                                        <td>{a.city || '-'}</td>
                                        <td>{a.region || '-'}</td>
                                        <td>{a.country || '-'}</td>
                                        <td>
                                            {a.lat && a.lon
                                                ? <a href={`https://maps.google.com/?q=${a.lat},${a.lon}`} target="_blank" rel="noreferrer" className="admin-map-link">
                                                    {Number(a.lat).toFixed(2)}, {Number(a.lon).toFixed(2)}
                                                  </a>
                                                : '-'}
                                        </td>
                                        <td>{browserIcon(a.browser)} {a.browser || '-'}</td>
                                        <td className="admin-cell-ua" title={a.userAgent}>{a.userAgent ? a.userAgent.slice(0, 60) + (a.userAgent.length > 60 ? '…' : '') : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="admin-footer">
                Solturi Engenharia — Sistema de Gestão de Obras &nbsp;|&nbsp; Restrito
            </div>
        </div>
    );
};

// Ping hook — used by ALL pages to register session
export function usePing() {
    useEffect(() => {
        const sessionId = getSessionId();
        const ping = () => fetch('/api/ping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
        }).catch(() => {});
        ping(); // immediate first ping
        const interval = setInterval(ping, 30000);
        return () => clearInterval(interval);
    }, []);
}

export default AdminReport;
