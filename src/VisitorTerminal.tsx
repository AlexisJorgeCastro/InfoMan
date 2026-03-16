import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CreditCard, CheckCircle2, BookOpen, Search, Monitor, PenTool, Mail, Users, LogIn, Sun, Moon } from 'lucide-react';
import { format } from 'date-fns';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  onSnapshot, 
  Timestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from 'firebase/auth';
import { db, auth } from './firebase';

const PURPOSES = [
  { id: 'reading', label: 'Reading books', icon: BookOpen },
  { id: 'thesis', label: 'Research for thesis', icon: Search },
  { id: 'computer', label: 'Use of computer', icon: Monitor },
  { id: 'assignment', label: 'Doing assignments', icon: PenTool },
];

export default function VisitorTerminal() {
  const [step, setStep] = React.useState('idle');
  const [visitor, setVisitor] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [liveCount, setLiveCount] = React.useState(0);
  const [user, setUser] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      
      // Auto-login anonymously if not authenticated
      if (!u) {
        try {
          const { signInAnonymously } = await import('firebase/auth');
          await signInAnonymously(auth);
        } catch (err) {
          console.error("Auto-login failed:", err);
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    if (!user) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const q = query(
      collection(db, 'logs'),
      where('timestamp', '>=', Timestamp.fromDate(today))
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLiveCount(snapshot.size);
    }, (err) => {
      console.error("Firestore Error:", err);
    });

    return () => unsubscribe();
  }, [user]);

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setError("Login Failed: " + err.message);
    }
  };

  const identifyVisitor = async (data: { rfid_tag?: string; email?: string }) => {
    if (!user) {
      setError("System Offline: Please Login");
      return;
    }

    try {
      let q;
      if (data.rfid_tag) {
        // Ensure ID format consistency (XX-XXXXX-XXX)
        let cleanTag = data.rfid_tag.replace(/\D/g, '');
        if (cleanTag.length === 10) {
          cleanTag = cleanTag.slice(0, 2) + '-' + cleanTag.slice(2, 7) + '-' + cleanTag.slice(7);
        }
        q = query(collection(db, 'visitors'), where('rfid_tag', '==', cleanTag));
      } else {
        q = query(collection(db, 'visitors'), where('email', '==', data.email));
      }

      const snapshot = await getDocs(q);
      if (snapshot.empty) throw new Error("IDENTITY NOT RECOGNIZED");
      
      const visitorDoc = snapshot.docs[0];
      const visitorData = { id: visitorDoc.id, ...(visitorDoc.data() as object) };
      
      // @ts-ignore
      if (visitorData.is_blocked) throw new Error("Access Denied: Blocked");
      
      setVisitor(visitorData);
      setStep('purpose');
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => setError(null), 3000);
    }
  };

  const submitLog = async (purpose: string) => {
    try {
      await addDoc(collection(db, 'logs'), {
        visitor_name: visitor.name,
        visitor_email: visitor.email,
        visitor_id: visitor.rfid_tag,
        visitor_college: visitor.college || 'N/A',
        visitor_role: visitor.role || 'student',
        is_blocked: visitor.is_blocked || false,
        purpose,
        timestamp: Timestamp.now()
      });

      setVisitor((prev: any) => ({ 
        ...prev, 
        purpose, 
        time: format(new Date(), 'p'), 
        date: format(new Date(), 'PP') 
      }));
      setStep('welcome');
      setTimeout(() => { setStep('idle'); setVisitor(null); }, 5000);
    } catch (err: any) {
      setError("Log Failed: " + err.message);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505]">
      <div className="flex flex-col items-center gap-6">
        <div className="w-16 h-16 border-4 border-[var(--neon-blue)]/20 border-t-[var(--neon-blue)] rounded-full animate-spin" />
        <div className="text-[var(--neon-blue)] font-black tracking-[0.4em] animate-pulse text-xs">ESTABLISHING SECURE LINK...</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="atmosphere" />
      
      <div className="w-full max-w-2xl text-center z-10">
        {user?.email === "jcesperanza@neu.edu.ph" && step === 'idle' && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }} 
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 bg-[var(--neon-blue)]/10 border border-[var(--neon-blue)]/30 rounded-2xl inline-block"
          >
            <p className="text-[var(--neon-blue)] font-black uppercase tracking-widest text-xs">
              Welcome to NEU library, Professor Esperanza
            </p>
          </motion.div>
        )}
        <AnimatePresence mode="wait">
          {step === 'idle' && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="mb-8 flex justify-center items-center gap-4">
                <div className="stat-card px-4 py-2 rounded-full flex items-center gap-2 text-[var(--neon-blue)]">
                  <Users size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Today's Visitors: {liveCount}</span>
                </div>
              </div>
              
              <h1 className="text-4xl md:text-5xl font-black mb-12 glow-text">NEU LIBRARY SYSTEM</h1>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                {/* RFID / Student Number Input */}
                <div className="stat-card p-8 rounded-3xl flex flex-col items-center gap-6">
                  <div className="pulse-ring w-24 h-24" onClick={() => {
                    const input = document.getElementById('manualRfid') as HTMLInputElement;
                    identifyVisitor({ rfid_tag: input.value || '26-00001-000' });
                  }}>
                    <CreditCard size={32} className="text-[var(--neon-blue)]" />
                  </div>
                  <div className="w-full space-y-4">
                    <h3 className="text-[10px] font-bold text-[var(--text-secondary)] tracking-widest uppercase">RFID / STUDENT NUMBER</h3>
                    <div className="relative">
                      <input 
                        type="text" 
                        id="manualRfid"
                        placeholder="00-00000-000"
                        maxLength={12}
                        className="w-full bg-[var(--input-bg)] border border-zinc-800/30 rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--neon-blue)] text-center tracking-widest text-[var(--text-primary)]"
                        onChange={(e) => {
                          let val = e.target.value.replace(/\D/g, '');
                          if (val.length > 2) val = val.slice(0, 2) + '-' + val.slice(2);
                          if (val.length > 8) val = val.slice(0, 8) + '-' + val.slice(8);
                          e.target.value = val.slice(0, 12);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            identifyVisitor({ rfid_tag: (e.target as HTMLInputElement).value });
                          }
                        }}
                      />
                    </div>
                    <button 
                      onClick={() => {
                        const val = (document.getElementById('manualRfid') as HTMLInputElement).value;
                        if (val) identifyVisitor({ rfid_tag: val });
                      }}
                      className="w-full bg-[var(--neon-blue)]/10 text-[var(--neon-blue)] border border-[var(--neon-blue)]/20 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-[var(--neon-blue)] hover:text-black transition-all"
                    >
                      Identify ID
                    </button>
                  </div>
                </div>

                {/* Email Input */}
                <div className="stat-card p-8 rounded-3xl flex flex-col items-center gap-6">
                  <div 
                    className="w-24 h-24 rounded-full border-2 border-zinc-800 flex items-center justify-center hover:border-[var(--neon-green)] hover:text-[var(--neon-green)] transition-all cursor-pointer group"
                    onClick={() => identifyVisitor({ email: 'juan.delacruz@neu.edu.ph' })}
                  >
                    <Mail size={32} className="group-hover:scale-110 transition-transform text-[var(--neon-green)]" />
                  </div>
                  <div className="w-full space-y-4">
                    <h3 className="text-[10px] font-bold text-[var(--text-secondary)] tracking-widest uppercase">INSTITUTIONAL EMAIL</h3>
                    <div className="relative">
                      <input 
                        type="email" 
                        id="manualEmail"
                        placeholder="ENTER EMAIL ADDRESS"
                        className="w-full bg-[var(--input-bg)] border border-zinc-800/30 rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--neon-green)] text-center tracking-widest text-[var(--text-primary)]"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            identifyVisitor({ email: (e.target as HTMLInputElement).value });
                          }
                        }}
                      />
                    </div>
                    <button 
                      onClick={() => {
                        const val = (document.getElementById('manualEmail') as HTMLInputElement).value;
                        if (val) identifyVisitor({ email: val });
                      }}
                      className="w-full bg-[var(--neon-green)]/10 text-[var(--neon-green)] border border-[var(--neon-green)]/20 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-[var(--neon-green)] hover:text-black transition-all"
                    >
                      Identify Email
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-[var(--neon-green)] font-bold tracking-[0.3em] animate-pulse h-6">
                {error ? <span className="text-[var(--neon-red)]">{error}</span> : "READY FOR INPUT"}
              </p>
            </motion.div>
          )}

          {step === 'purpose' && (
            <motion.div key="purpose" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="stat-card p-8 rounded-[2.5rem] mb-8">
                <div className="flex items-center gap-4 mb-8 text-left">
                  <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center text-2xl font-bold text-[var(--neon-blue)]">
                    {visitor.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold uppercase text-[var(--text-primary)]">{visitor.name}</h2>
                    <p className="text-[var(--text-secondary)] text-[10px] uppercase tracking-widest">{visitor.college}</p>
                  </div>
                </div>
                
                <h3 className="text-sm font-bold mb-6 uppercase tracking-widest text-[var(--neon-blue)]">Select Purpose of Visit</h3>
                <div className="grid grid-cols-2 gap-4">
                  {PURPOSES.map((p) => (
                    <button key={p.id} onClick={() => submitLog(p.label)} className="stat-card p-6 rounded-2xl flex flex-col items-center gap-4 hover:bg-[var(--neon-blue)] hover:text-black transition-all group">
                      <p.icon size={32} className="text-[var(--neon-blue)] group-hover:text-black" />
                      <span className="text-[10px] font-bold uppercase">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {step === 'welcome' && (
            <motion.div key="welcome" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <CheckCircle2 size={80} className="text-[var(--neon-green)] mx-auto mb-6 drop-shadow-[0_0_15px_var(--neon-green)]" />
              <h1 className="text-4xl font-black mb-2 glow-text text-[var(--neon-green)]">Welcome to NEU Library!</h1>
              
              <div className="stat-card p-8 rounded-3xl mt-8 max-w-sm mx-auto text-left space-y-4 border-zinc-800/50">
                <div className="flex justify-between items-center border-b border-zinc-800/30 pb-3">
                  <span className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Name</span>
                  <span className="text-xs font-bold uppercase tracking-tight">{visitor.name}</span>
                </div>
                <div className="flex justify-between items-center border-b border-zinc-800/30 pb-3">
                  <span className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">College</span>
                  <span className="text-xs font-mono font-medium text-[var(--neon-blue)] uppercase text-right max-w-[180px] leading-tight">
                    {visitor.college}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-zinc-800/30 pb-3">
                  <span className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Purpose</span>
                  <span className="text-xs font-bold uppercase text-[var(--neon-blue)]">{visitor.purpose}</span>
                </div>
                <div className="flex justify-between items-center border-b border-zinc-800/30 pb-3">
                  <span className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Date</span>
                  <span className="text-xs font-mono font-medium">{visitor.date}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Time</span>
                  <span className="text-xs font-mono font-medium">{visitor.time}</span>
                </div>
              </div>
              
              <p className="mt-12 text-zinc-600 text-[10px] uppercase tracking-[0.5em] animate-pulse">System Resetting...</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* System Status / Login */}
      <div className="fixed bottom-4 left-4 z-50 flex gap-2">
        <button 
          onClick={login}
          className="p-3 rounded-full bg-zinc-800 text-zinc-400 hover:text-[#00f2ff] transition-all shadow-lg flex items-center gap-2 px-4"
          title="System Login"
        >
          <LogIn size={16} />
          <span className="text-[10px] font-bold uppercase tracking-widest">
            {user ? (user.isAnonymous ? "Guest Mode" : "Librarian Mode") : "System Offline"}
          </span>
        </button>
      </div>
    </div>
  );
}
