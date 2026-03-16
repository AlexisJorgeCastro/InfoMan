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
  const [view, setView] = useState('terminal');
  const [theme, setTheme] = useState('dark');
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeRole, setActiveRole] = useState<'user' | 'admin'>('user');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const adminEmails = ["alexis.castro@neu.edu.ph", "jcesperanza@neu.edu.ph"];
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
        setActiveRole('user');
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
          className="p-3 rounded-full bg-zinc-800 text-zinc-400 hover:text-[#00f2ff] transition-all shadow-lg"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        
        {isAdmin && (
          <div className="flex bg-zinc-800 rounded-full p-1 shadow-lg border border-zinc-700">
            <button 
              onClick={() => setActiveRole('user')}
              className={`px-4 py-2 rounded-full text-[9px] font-black uppercase transition-all ${
                activeRole === 'user' ? 'bg-[#00f2ff] text-black shadow-[0_0_10px_#00f2ff]' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              User Mode
            </button>
            <button 
              onClick={() => setActiveRole('admin')}
              className={`px-4 py-2 rounded-full text-[9px] font-black uppercase transition-all ${
                activeRole === 'admin' ? 'bg-[#00f2ff] text-black shadow-[0_0_10px_#00f2ff]' : 'text-zinc-500 hover:text-zinc-300'
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
              view === 'admin' ? 'bg-[#00f2ff] text-black shadow-[0_0_15px_#00f2ff]' : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            {view === 'admin' ? 'Terminal' : 'Admin'}
          </button>
        )}
      </div>

      {/* View Logic */}
      <main>
        {activeRole === 'admin' ? <AdminDashboard /> : <VisitorTerminal />}
      </main>
    </div>
  );
}

const container = document.getElementById('app');
const root = createRoot(container);
root.render(<App />);
