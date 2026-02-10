import React from 'react';
import './Header.css';

const Header = ({ title }) => {
    return (
        <header className="app-header">
            <div className="header-left">
                <h1>{title}</h1>
            </div>
            <div className="header-right">
                {/* Elements removed per user request */}
            </div>
        </header>
    );
};

export default Header;
