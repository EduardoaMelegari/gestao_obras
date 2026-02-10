import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import Projects from './components/Projects';
import Sidebar from './components/Sidebar';
import Vistoria from './components/Vistoria';

function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  return (
    <div className="App">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        isExpanded={isSidebarExpanded}
        onToggle={() => setIsSidebarExpanded(!isSidebarExpanded)}
      />

      <div style={{
        marginLeft: isSidebarExpanded ? '250px' : '50px',
        width: isSidebarExpanded ? 'calc(100% - 250px)' : 'calc(100% - 50px)',
        transition: 'margin-left 0.3s ease, width 0.3s ease'
      }}>
        {activePage === 'dashboard' && <Dashboard />}
        {activePage === 'projects' && <Projects />}
        {activePage === 'vistoria' && <Vistoria />}
      </div>
    </div>
  );
}

export default App;
