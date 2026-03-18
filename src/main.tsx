import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import VisitorTerminal from './VisitorTerminal';
import AdminDashboard from './AdminDashboard';
import { Sun, Moon, LogIn, Shield, Users } from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, getDocFromServer } from 'firebase/firestore';
import { auth, db } from './firebase';
import { motion, AnimatePresence } from 'motion/react';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function App() {
  const [view, setView] = useState<'terminal' | 'admin'>('terminal');
  const [hasSelectedView, setHasSelectedView] = useState(false);
  const [theme, setTheme] = useState('light');
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const adminEmails = ["alexis.castro@neu.edu.ph", "jcesperanza@neu.edu.ph", "ajcken319@gmail.com"];
        const isUAdmin = adminEmails.includes(u.email || "");

        // Enforce @neu.edu.ph domain for non-admins
        if (!isUAdmin && !u.email?.endsWith('@neu.edu.ph')) {
          await signOut(auth);
          setUser(null);
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        setUser(u);
        
        let finalIsAdmin = isUAdmin;
        if (!finalIsAdmin) {
          try {
            const userDoc = await getDoc(doc(db, 'users', u.uid));
            if (userDoc.exists() && userDoc.data().role === 'admin') {
              finalIsAdmin = true;
            }
          } catch (error) {
            handleFirestoreError(error, OperationType.GET, `users/${u.uid}`);
          }
        }

        setIsAdmin(finalIsAdmin);
      } else {
        setUser(null);
        setIsAdmin(false);
        setView('terminal');
        setHasSelectedView(false);
      }
      setLoading(false);
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

  const handleLogin = async (targetView: 'terminal' | 'admin') => {
    if (user) {
      setView(targetView);
      setHasSelectedView(true);
      return;
    }
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if (result.user.email?.endsWith('@neu.edu.ph') || ["ajcken319@gmail.com", "alexis.castro@neu.edu.ph", "jcesperanza@neu.edu.ph"].includes(result.user.email || "")) {
        setView(targetView);
        setHasSelectedView(true);
      }
    } catch (err) {
      console.error("Login Error:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] relative overflow-hidden">
        <div className="atmosphere" />
        <div className="flex flex-col items-center gap-6 z-10">
          <img src="https://neu.edu.ph/main/img/neu.png" alt="NEU Logo" className="w-24 h-24 mb-4 animate-pulse" />
          <div className="w-16 h-16 border-4 border-[var(--neon-blue)]/20 border-t-[var(--neon-blue)] rounded-full animate-spin" />
          <div className="text-[var(--neon-blue)] font-black tracking-[0.4em] animate-pulse text-xs">ESTABLISHING SECURE LINK...</div>
        </div>
      </div>
    );
  }

  if (!user || !hasSelectedView) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[var(--bg-primary)]">
        <div className="atmosphere" />
        <div className="w-full max-w-4xl z-10 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <img src="https://neu.edu.ph/main/img/neu.png" alt="NEU Logo" className="w-32 h-32 mx-auto mb-12" />
            <h1 className="text-4xl md:text-6xl font-black mb-16 glow-text tracking-tighter">NEU LIBRARY SYSTEM</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <button 
                onClick={() => handleLogin('terminal')}
                className="stat-card p-12 rounded-[3rem] border-2 border-zinc-300 dark:border-zinc-800 flex flex-col items-center gap-6 hover:border-[var(--neon-blue)] hover:scale-[1.02] transition-all group shadow-md"
              >
                <Users size={56} className="text-[var(--neon-blue)] group-hover:scale-110 transition-transform" />
                <span className="text-2xl font-black uppercase tracking-[0.2em] text-[var(--text-primary)]">Visitor Sign In</span>
              </button>

              <button 
                onClick={() => handleLogin('admin')}
                className="stat-card p-12 rounded-[3rem] border-2 border-zinc-300 dark:border-zinc-800 flex flex-col items-center gap-6 hover:border-[var(--neon-red)] hover:scale-[1.02] transition-all group shadow-md"
              >
                <Shield size={56} className="text-[var(--neon-red)] group-hover:scale-110 transition-transform" />
                <span className="text-2xl font-black uppercase tracking-[0.2em] text-[var(--text-primary)]">Admin Sign In</span>
              </button>
            </div>
            
            <p className="mt-16 text-[10px] text-zinc-600 font-black uppercase tracking-[0.5em]">
              Institutional Access Only • @neu.edu.ph
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen transition-colors duration-300">
      {/* View Logic */}
      <main>
        {view === 'admin' ? (
          isAdmin ? (
            <AdminDashboard user={user} isAdmin={isAdmin} />
          ) : (
            <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-primary)]">
              <div className="atmosphere" />
              <div className="stat-card p-12 rounded-[3rem] text-center max-w-md z-10 border-zinc-300 dark:border-zinc-800">
                <Shield size={64} className="text-[var(--neon-red)] mx-auto mb-6" />
                <h1 className="text-3xl font-black mb-4 glow-text">ACCESS DENIED</h1>
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em] mb-8">
                  You do not have administrative privileges.
                </p>
                <button 
                  onClick={() => {
                    signOut(auth);
                    setHasSelectedView(false);
                  }}
                  className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-black transition-all"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )
        ) : (
          <VisitorTerminal user={user} />
        )}
      </main>
    </div>
  );
}

const container = document.getElementById('app');
const root = createRoot(container);
root.render(<App />);
