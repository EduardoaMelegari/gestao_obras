import React from 'react';
import './ProjectTable.css';

const ProjectTable = ({ title, columns, data, getRowClass, emptyMessage = "Sem dados", headerColor = "#0B1B48" }) => {

    const handleExport = () => {
        if (!data || data.length === 0) return;

        // Create CSV Content
        const headers = columns.map(c => c.header).join(';');
        const rows = data.map(item => {
            return columns.map(col => {
                let cellData = col.render ? col.render(item) : (item[col.accessor] || '');
                 // Escape newlines and semicolons if needed
                 if (typeof cellData === 'string') {
                    cellData = cellData.replace(/;/g, ',').replace(/\n/g, ' ');
                 }
                 return cellData;
            }).join(';');
        }).join('\n');

        const csvContent = "\uFEFF" + headers + '\n' + rows; // Add BOM for Excel

        // Trigger Download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `${title.replace(/\s+/g, '_')}_export.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    return (
        <div className="project-table-container">
            <div className="project-table-header" style={{ backgroundColor: headerColor }}>
                <h3 className="project-table-title">
                    {title} <span style={{ opacity: 0.7, marginLeft: '8px' }}>({data.length})</span>
                </h3>
                <button className="btn-export" onClick={handleExport} disabled={data.length === 0}>
                    Exportar CSV
                </button>
            </div>
            
            <div className="project-table-body">
                <div className="table-wrapper">
                    <table className="project-table">
                        <thead>
                            <tr>
                                <th className="col-index">#</th>
                                {columns.map((col, index) => (
                                    <th key={index} style={{ width: col.width || 'auto' }}>
                                        {col.header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((item, index) => {
                                const globalIndex = index + 1;
                                const rowClass = getRowClass ? getRowClass(item) : '';
                                
                                return (
                                    <tr key={item.id || index} className={rowClass}>
                                        <td className="col-index">{globalIndex}.</td>
                                        {columns.map((col, colIndex) => {
                                            const val = col.render ? col.render(item) : (item[col.accessor]);
                                            return (
                                                <td key={colIndex}>
                                                    {val !== null && val !== undefined ? val : ''}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                            {data.length === 0 && (
                                <tr>
                                    <td colSpan={columns.length + 1} className="empty-cell">
                                        {emptyMessage}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="table-footer">
                    <span className="page-info">
                        Total: {data.length}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default ProjectTable;
