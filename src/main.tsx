import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import VisitorTerminal from './VisitorTerminal';
import AdminDashboard from './AdminDashboard';
import { Sun, Moon } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

function App() {
  const [view, setView] = useState<'terminal' | 'admin'>('terminal');
  const [theme, setTheme] = useState('light');
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const adminEmails = ["alexis.castro@neu.edu.ph", "jcesperanza@neu.edu.ph", "ajcken319@gmail.com", "chynna.cardona@neu.edu.ph"];
        if (adminEmails.includes(u.email)) {
          setIsAdmin(true);
        } else {
          const userDoc = await getDoc(doc(db, 'users', u.uid));
          if (userDoc.exists() && userDoc.data().role === 'admin') {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
        }
      } else {
        setIsAdmin(false);
        setView('terminal');
      }
    });
    return () => unsubscribe();
  }, []);

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
          className="p-3 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-[var(--neon-blue)] transition-all shadow-lg border border-zinc-200 dark:border-zinc-700"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        
        {isAdmin && (
          <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-full p-1 shadow-lg border border-zinc-200 dark:border-zinc-700">
            <button 
              onClick={() => setView('terminal')}
              className={`px-4 py-2 rounded-full text-[9px] font-black uppercase transition-all ${
                view === 'terminal' ? 'bg-[var(--neon-blue)] text-white dark:text-black shadow-[0_0_10px_var(--neon-blue)]' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              User Mode
            </button>
            <button 
              onClick={() => setView('admin')}
              className={`px-4 py-2 rounded-full text-[9px] font-black uppercase transition-all ${
                view === 'admin' ? 'bg-[var(--neon-blue)] text-white dark:text-black shadow-[0_0_10px_var(--neon-blue)]' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              Admin Mode
            </button>
          </div>
        )}

        {!isAdmin && (
          <button 
            onClick={() => setView(prev => prev === 'terminal' ? 'admin' : 'terminal')}
            className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase transition-all ${
              view === 'admin' ? 'bg-[var(--neon-blue)] text-white dark:text-black shadow-[0_0_15px_var(--neon-blue)]' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700'
            }`}
          >
            {view === 'admin' ? 'Terminal' : 'Admin'}
          </button>
        )}
      </div>

      {/* View Logic */}
      <main>
        {view === 'admin' ? <AdminDashboard /> : <VisitorTerminal />}
      </main>
    </div>
  );
}

const container = document.getElementById('app');
const root = createRoot(container);
root.render(<App />);
