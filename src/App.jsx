import React, { useState, useEffect, useRef } from 'react';
import Dashboard from './components/Dashboard';
import Projects from './components/Projects';
import Sidebar from './components/Sidebar';
import Vistoria from './components/Vistoria';
import AlertsCenter from './components/AlertsCenter';
import AdminReport, { usePing } from './components/AdminReport';
import { fetchJson } from './services/http';
import './theme-v2.css';

// Hidden admin panel — accessible only via /#admin in the URL
const isAdminRoute = window.location.hash === '#admin';

// Hook to check server version and force reload if changed
function useVersionCheck() {
  const versionRef = useRef(null);

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const data = await fetchJson('/api/version', { cache: 'no-store' });
        if (!data?.version) throw new Error('Missing "version" in /api/version response');

        if (versionRef.current && data.version !== versionRef.current) {
          console.log('New version detected! Reloading...', data.version);
          window.location.reload(true);
          return;
        }

        if (!versionRef.current) {
          console.log('App version initialized:', data.version);
        }
        versionRef.current = data.version;
      } catch (err) {
        console.error('Version check failed:', err.message || err);
      }
    };

    checkVersion();
    const interval = setInterval(checkVersion, 30000); // Check every 30s

    return () => clearInterval(interval);
  }, []);
}

function AppContent() {
  const [activePage, setActivePage] = useState('dashboard');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  // Track this session as an active user
  usePing();
  useVersionCheck();

  return (
      <div className="App theme-v2">
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
          {activePage === 'alertas' && <AlertsCenter />}
        </div>
      </div>
  );
}

function App() {
  if (isAdminRoute) return <AdminReport />;
  return <AppContent />;
}

export default App;
