import React from 'react';
import './Sidebar.css';

const Sidebar = ({ activePage, onNavigate, isExpanded, onToggle }) => {
    return (
        <div
            className={`sidebar ${isExpanded ? 'expanded' : 'collapsed'}`}
        >
            <div className="sidebar-header">
                <button className="toggle-btn" onClick={onToggle}>
                    {isExpanded ? '◀' : '☰'}
                </button>
            </div>

            <div className="sidebar-content">
                <div
                    className={`nav-item ${activePage === 'dashboard' ? 'active' : ''}`}
                    onClick={() => onNavigate('dashboard')}
                    title="Dashboard"
                >
                    <span className="icon">📊</span>
                    {isExpanded && <span className="label">Dashboard</span>}
                </div>

                <div
                    className={`nav-item ${activePage === 'projects' ? 'active' : ''}`}
                    onClick={() => onNavigate('projects')}
                    title="Projetos"
                >
                    <span className="icon">🏗️</span>
                    {isExpanded && <span className="label">Projetos</span>}
                </div>

                <div
                    className={`nav-item ${activePage === 'plate_numbers' ? 'active' : ''}`}
                    onClick={() => onNavigate('plate_numbers')}
                    title="Número de placas"
                >
                    <span className="icon">🔢</span>
                    {isExpanded && <span className="label">Número de placas</span>}
                </div>

                <div
                    className={`nav-item ${activePage === 'vistoria' ? 'active' : ''}`}
                    onClick={() => onNavigate('vistoria')}
                    title="Vistoria"
                >
                    <span className="icon">📋</span>
                    {isExpanded && <span className="label">Vistoria</span>}
                </div>

                <div
                    className={`nav-item ${activePage === 'alertas' ? 'active' : ''}`}
                    onClick={() => onNavigate('alertas')}
                    title="Alertas e Indicadores"
                >
                    <span className="icon">🚨</span>
                    {isExpanded && <span className="label">Alertas e Indicadores</span>}
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
