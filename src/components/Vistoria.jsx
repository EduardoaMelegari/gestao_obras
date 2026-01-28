import React from 'react';
import Header from './Header';

import ProjectColumn from './ProjectColumn';
import './Dashboard.css'; // Reuse dashboard styles for grid

const Vistoria = () => {
    // Mock data for initial layout visualization
    const mockData = [];

    return (
        <div className="dashboard-container">
            <div className="top-bar">
                <Header title="ANÁLISE PARA VISTORIA" />
            </div>

            <div className="dashboard-content" style={{ padding: '20px' }}>
                {/* Using a 3-column grid for Vistoria */}
                <div className="column-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>

                    {/* Column 1: Solicitar Vistorias */}
                    <div className="dashboard-column">
                        <div className="kpi-card" style={{ borderLeft: '4px solid #FFA500' }}>
                            <h3 className="kpi-title">SOLICITAR VISTORIAS</h3>
                            <div className="kpi-value">0</div>
                        </div>
                        <ProjectColumn
                            title="OBRA"
                            secondTitle="DETALHES"
                            data={mockData}
                            type="simple"
                            emptyMessage="Nenhuma vistoria a solicitar"
                        />
                    </div>

                    {/* Column 2: Vistorias Solicitadas */}
                    <div className="dashboard-column">
                        <div className="kpi-card" style={{ borderLeft: '4px solid #FFA500' }}>
                            <h3 className="kpi-title">VISTORIAS SOLICITADAS</h3>
                            <div className="kpi-value">0</div>
                        </div>
                        <ProjectColumn
                            title="OBRA"
                            secondTitle="DATA"
                            data={mockData}
                            type="simple"
                            emptyMessage="Nenhuma solicitação pendente"
                        />
                    </div>

                    {/* Column 3: Vistorias Atrasadas */}
                    <div className="dashboard-column">
                        <div className="kpi-card" style={{ borderLeft: '4px solid #FF0000' }}> {/* Red for overdue */}
                            <h3 className="kpi-title">VISTORIAS ATRASADAS</h3>
                            <div className="kpi-value">0</div>
                        </div>
                        <ProjectColumn
                            title="OBRA"
                            secondTitle="DIAS DE ATRASO"
                            data={mockData}
                            type="simple"
                            emptyMessage="Nenhuma vistoria atrasada"
                        />
                    </div>

                </div>
            </div>
        </div>
    );
};

export default Vistoria;
