import React, { useState, useEffect, useRef } from 'react';
import Dashboard from './components/Dashboard';
import Projects from './components/Projects';
import Sidebar from './components/Sidebar';
import Vistoria from './components/Vistoria';
import AdminReport, { usePing } from './components/AdminReport';
import './theme-v2.css';
import { ThemeContext } from './ThemeContext';

// Hidden admin panel — accessible only via /#admin in the URL
const isAdminRoute = window.location.hash === '#admin';
const API_BASE = 'http://localhost:36006';

// Hook to check server version and force reload if changed
function useVersionCheck() {
  const versionRef = useRef(null);

  useEffect(() => {
    // Initial check
    fetch(`${API_BASE}/api/version`)
      .then(res => res.json())
      .then(data => {
        versionRef.current = data.version;
        console.log('App version initialized:', data.version);
      })
      .catch(err => console.error('Version check failed', err));

    // Periodic check
    const interval = setInterval(() => {
      fetch(`${API_BASE}/api/version`)
        .then(res => res.json())
        .then(data => {
          if (versionRef.current && data.version !== versionRef.current) {
            console.log('New version detected! Reloading...', data.version);
            window.location.reload(true);
          }
        })
        .catch(err => console.error('Version check failed', err));
    }, 30000); // Check every 30s

    return () => clearInterval(interval);
  }, []);
}

function AppContent() {
  const [activePage, setActivePage] = useState('dashboard');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isV2, setIsV2] = useState(() => {
    return localStorage.getItem('ui-theme') === 'v2';
  });

  // Track this session as an active user
  usePing();
  useVersionCheck();

  // Apply / remove theme class on the #app-root element
  useEffect(() => {
    const root = document.getElementById('root');
    if (root) {
      if (isV2) {
        root.classList.add('theme-v2');
      } else {
        root.classList.remove('theme-v2');
      }
    }
    localStorage.setItem('ui-theme', isV2 ? 'v2' : 'v1');
  }, [isV2]);

  const toggleTheme = () => setIsV2(v => !v);

  return (
    <ThemeContext.Provider value={{ isV2 }}>
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

        {/* Floating V1 / V2 Toggle Button */}
        <button
          className={`theme-toggle-btn ${isV2 ? 'v2-mode' : 'v1-mode'}`}
          onClick={toggleTheme}
          title={isV2 ? 'Alternar para V1 (clássico)' : 'Alternar para V2 (moderno)'}
        >
          {isV2 ? '◀ V1' : 'V2 ✦'}
        </button>
      </div>
    </ThemeContext.Provider>
  );
}

function App() {
  if (isAdminRoute) return <AdminReport />;
  return <AppContent />;
}

export default App;
