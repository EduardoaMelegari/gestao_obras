import React from 'react';
import './ProjectColumn.css';

const ProjectColumn = ({ title, secondTitle, thirdTitle, data, type, emptyMessage = "Sem dados" }) => {
    return (
        <div className="project-column-container">
            {/* ... */}
            {/* List Rows */}
            <div className="column-list">
                {data.map((item) => (
                    // ...
                    <div key={item.id} className={`list-row ${type}`}>
                        {/* ... items ... */}
                        <div className="cell main-cell">
                            {item.client}
                            {item.city && <span className="city-badge">{item.city}</span>}
                        </div>
                        {type === 'with-days' && <div className="cell value-cell">{item.days}</div>}
                        {type === 'with-team' && <div className="cell value-cell team-cell">{item.team}</div>}
                    </div>
                ))}

                {data.length === 0 && (
                    <div className="list-row empty">
                        <div className="cell">{emptyMessage}</div>
                    </div>
                )}
            </div>
            {/* ... */}

            {/* Pagination / Footer of the list */}
            <div className="list-footer">
                <span>1 - {data.length}/{data.length}</span>
                <div className="pagination-arrows">
                    <span>&lt;</span>
                    <span>&gt;</span>
                </div>
            </div>
        </div>
    );
};

export default ProjectColumn;
