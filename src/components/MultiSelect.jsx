import React, { useState, useEffect, useRef } from 'react';
import './MultiSelect.css';

const MultiSelect = ({ options, selected, onChange, placeholder = "Selecione..." }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const toggleOption = (option) => {
        let newSelected;
        if (selected.includes(option)) {
            newSelected = selected.filter(item => item !== option);
        } else {
            newSelected = [...selected, option];
        }
        onChange(newSelected);
    };

    const handleSelectAll = () => {
        if (selected.length === options.length) {
            onChange([]);
        } else {
            onChange([...options]);
        }
    };

    return (
        <div className="multi-select-container" ref={containerRef}>
            <div className="multi-select-header" onClick={() => setIsOpen(!isOpen)}>
                <span className="multi-select-value">
                    {selected.length === 0
                        ? placeholder
                        : selected.length === options.length
                            ? "Todas as Cidades"
                            : `${selected.length} selecionada(s)`}
                </span>
                <span className={`arrow ${isOpen ? 'up' : 'down'}`}>▼</span>
            </div>
            {isOpen && (
                <div className="multi-select-dropdown">
                    <div className="multi-select-option" onClick={handleSelectAll}>
                        <input
                            type="checkbox"
                            checked={selected.length === options.length && options.length > 0}
                            readOnly
                        />
                        <span>Todas</span>
                    </div>
                    {options.map(option => (
                        <div key={option} className="multi-select-option" onClick={() => toggleOption(option)}>
                            <input
                                type="checkbox"
                                checked={selected.includes(option)}
                                readOnly
                            />
                            <span>{option}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MultiSelect;
