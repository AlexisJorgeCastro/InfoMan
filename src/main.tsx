import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import VisitorTerminal from './VisitorTerminal';
import AdminDashboard from './AdminDashboard';
import { Sun, Moon, Lock } from 'lucide-react';

function App() {
  const [view, setView] = useState('terminal');
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="min-h-screen transition-colors duration-300">
      {/* Navigation Toggle */}
      <div className="fixed bottom-4 right-4 z-50 flex gap-2">
        <button 
          onClick={toggleTheme}
          className="p-3 rounded-full bg-zinc-800 text-zinc-400 hover:text-[#00f2ff] transition-all shadow-lg"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <button 
          onClick={() => setView('terminal')}
          className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase transition-all ${
            view === 'terminal' ? 'bg-[#00f2ff] text-black shadow-[0_0_15px_#00f2ff]' : 'bg-zinc-800 text-zinc-400'
          }`}
        >
          Terminal
        </button>
        <button 
          onClick={() => setView('admin')}
          className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase transition-all ${
            view === 'admin' ? 'bg-[#00f2ff] text-black shadow-[0_0_15px_#00f2ff]' : 'bg-zinc-800 text-zinc-400'
          }`}
        >
          Admin
        </button>
      </div>

      {/* View Logic */}
      <main>
        {view === 'terminal' ? <VisitorTerminal /> : <AdminDashboard />}
      </main>
    </div>
  );
}

const container = document.getElementById('app');
const root = createRoot(container);
root.render(<App />);
