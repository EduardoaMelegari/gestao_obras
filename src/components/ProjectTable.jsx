import React from 'react';
import './ProjectTable.css';

const ProjectTable = ({ title, columns, data, getRowClass, emptyMessage = "Sem dados", headerColor = "#0B1B48" }) => {
    // Basic pagination state (local for now, or lifted if needed)
    const [currentPage, setCurrentPage] = React.useState(1);
    const itemsPerPage = 20;

    const totalPages = Math.ceil(data.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentData = data.slice(startIndex, startIndex + itemsPerPage);

    const handlePrev = () => {
        if (currentPage > 1) setCurrentPage(p => p - 1);
    };

    const handleNext = () => {
        if (currentPage < totalPages) setCurrentPage(p => p + 1);
    };

    // Reset page if data changes significantly
    React.useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(1);
        }
    }, [data.length, totalPages, currentPage]);

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
                <h3 className="project-table-title">{title}</h3>
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
                            {currentData.map((item, index) => {
                                const globalIndex = startIndex + index + 1;
                                const rowClass = getRowClass ? getRowClass(item) : '';
                                
                                return (
                                    <tr key={item.id || index} className={rowClass}>
                                        <td className="col-index">{globalIndex}.</td>
                                        {columns.map((col, colIndex) => (
                                            <td key={colIndex}>
                                                {col.render ? col.render(item) : (item[col.accessor] || '')}
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                            {currentData.length === 0 && (
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
                        {data.length > 0 ? `${startIndex + 1} - ${Math.min(startIndex + itemsPerPage, data.length)} / ${data.length}` : '0 / 0'}
                    </span>
                    <div className="pagination-controls">
                        <button onClick={handlePrev} disabled={currentPage === 1} className="page-btn">&lt;</button>
                        <button onClick={handleNext} disabled={currentPage >= totalPages} className="page-btn">&gt;</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectTable;
