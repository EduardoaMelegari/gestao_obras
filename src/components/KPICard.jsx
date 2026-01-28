import React from 'react';
import './KPICard.css';

const KPICard = ({ data }) => {
    if (!data) return null; // Safeguard against missing data

    return (
        <div className="kpi-card">
            <div className="kpi-title">{data.title}</div>
            <div className="kpi-value">{data.count}</div>
        </div>
    );
};

export default KPICard;
