import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CreditCard, CheckCircle2, BookOpen, Search, Monitor, PenTool, Mail, Users, LogIn, LogOut, Sun, Moon } from 'lucide-react';
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
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { db, auth } from './firebase';

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

const PURPOSES = [
  { id: 'reading', label: 'Reading books', icon: BookOpen },
  { id: 'thesis', label: 'Research for thesis', icon: Search },
  { id: 'computer', label: 'Use of computer', icon: Monitor },
  { id: 'assignment', label: 'Doing assignments', icon: PenTool },
];

const COLLEGES = [
  "College of Informatics and Computing Studies",
  "College of Computer Studies",
  "College of Arts and Sciences",
  "College of Education",
  "College of Law",
  "College of Engineering",
  "College of Business Administration",
  "College of Nursing",
  "College of Criminology",
  "External / Guest"
];

const ROLES = ['Student', 'Faculty', 'Staff'];

export default function VisitorTerminal({ user }: { user: any }) {
  const [step, setStep] = React.useState('idle');
  const [visitor, setVisitor] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [liveCount, setLiveCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const initVisitor = async () => {
      if (user && user.email) {
        setLoading(true);
        try {
          const q = query(collection(db, 'visitors'), where('email', '==', user.email));
          const snapshot = await getDocs(q);
          
          let role = '';
          if (user.email === 'alexis.castro@neu.edu.ph') role = 'student';
          if (user.email === 'ajcken319@gmail.com') role = 'test';
          if (user.email === 'jcesperanza@neu.edu.ph') role = 'faculty';
          if (user.email === 'chynna.cardona@neu.edu.ph') role = 'faculty';

          if (!snapshot.empty) {
            const visitorDoc = snapshot.docs[0];
            const visitorData = { id: visitorDoc.id, ...(visitorDoc.data() as object) };
            // @ts-ignore
            if (visitorData.email && (!visitorData.name || visitorData.name === 'New Student')) {
              // @ts-ignore
              visitorData.name = parseNameFromEmail(visitorData.email);
            }
            // Override role if specified
            // @ts-ignore
            if (role !== '' || !visitorData.role) {
               // @ts-ignore
               visitorData.role = role || visitorData.role || '';
            }
            setVisitor(visitorData);
          } else {
            // Derive from email if not in database
            setVisitor({
              name: parseNameFromEmail(user.email),
              email: user.email,
              rfid_tag: 'N/A',
              college: '',
              role: role
            });
          }
          setStep('profile');
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, 'visitors');
        } finally {
          setLoading(false);
        }
      }
    };
    initVisitor();
  }, [user]);

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
      handleFirestoreError(err, OperationType.LIST, 'logs');
    });

    return () => unsubscribe();
  }, [user]);

  const handleAuthAction = async () => {
    if (user && !user.isAnonymous) {
      try {
        await signOut(auth);
      } catch (err: any) {
        setError("Logout Failed: " + err.message);
      }
    } else {
      login();
    }
  };

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setError("Login Failed: " + err.message);
    }
  };

  const parseNameFromEmail = (email: string) => {
    if (!email) return "Visitor";
    if (email === 'jcesperanza@neu.edu.ph') return "Jeremy Esperanza";
    const namePart = email.split('@')[0];
    return namePart
      .split('.')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
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
      
      let role = '';
      if (data.email === 'alexis.castro@neu.edu.ph') role = 'student';
      if (data.email === 'ajcken319@gmail.com') role = 'test';
      if (data.email === 'jcesperanza@neu.edu.ph') role = 'faculty';
      if (data.email === 'chynna.cardona@neu.edu.ph') role = 'faculty';

      if (snapshot.empty) {
        // If not found in database but we have an email, derive name from email
        if (data.email && data.email.endsWith('@neu.edu.ph')) {
          const derivedName = parseNameFromEmail(data.email);
          setVisitor({
            name: derivedName,
            email: data.email,
            rfid_tag: 'N/A',
            college: '',
            role: role
          });
          setStep('profile');
          return;
        }
        throw new Error("IDENTITY NOT RECOGNIZED");
      }
      
      const visitorDoc = snapshot.docs[0];
      const visitorData = { id: visitorDoc.id, ...(visitorDoc.data() as object) };
      
      // Use email-derived name if the database name is missing or generic
      // @ts-ignore
      if (visitorData.email && (!visitorData.name || visitorData.name === 'New Student')) {
        // @ts-ignore
        visitorData.name = parseNameFromEmail(visitorData.email);
      }
      
      // @ts-ignore
      if (visitorData.is_blocked) throw new Error("Access Denied: Blocked");
      
      // Override role if specified
      // @ts-ignore
      if (role !== '' || !visitorData.role) {
         // @ts-ignore
         visitorData.role = role || visitorData.role || '';
      }

      setVisitor(visitorData);
      setStep('profile');
    } catch (err: any) {
      if (err.message === "IDENTITY NOT RECOGNIZED" || err.message.includes("Access Denied")) {
        setError(err.message);
      } else {
        handleFirestoreError(err, OperationType.GET, 'visitors');
      }
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
      // Automatically sign out after 3 seconds to return to landing page
      setTimeout(async () => {
        try {
          await signOut(auth);
          setVisitor(null);
          setStep('idle');
        } catch (err) {
          console.error("Auto-logout failed:", err);
        }
      }, 3000);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, 'logs');
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
      <div className="atmosphere" />
      <div className="flex flex-col items-center gap-6 z-10">
        <img src="https://neu.edu.ph/main/img/neu.png" alt="NEU Logo" className="w-24 h-24 mb-4 animate-pulse" />
        <div className="w-16 h-16 border-4 border-[var(--neon-blue)]/20 border-t-[var(--neon-blue)] rounded-full animate-spin" />
        <div className="text-[var(--neon-blue)] font-black tracking-[0.4em] animate-pulse text-xs">ESTABLISHING SECURE LINK...</div>
      </div>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="atmosphere" />
      <div className="w-full max-w-md text-center z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="stat-card p-12 rounded-[3rem] border-zinc-200 dark:border-zinc-800">
          <img src="https://neu.edu.ph/main/img/neu.png" alt="NEU Logo" className="w-32 h-32 mx-auto mb-8" />
          <h1 className="text-3xl font-black mb-4 glow-text">NEU LIBRARY</h1>
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em] mb-12">Institutional Login Required</p>
          
          <button 
            onClick={login}
            className="w-full bg-[var(--neon-blue)] text-white dark:text-black py-5 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-[0_0_20px_rgba(0,242,255,0.3)]"
          >
            <LogIn size={20} /> Sign in with @neu.edu.ph
          </button>
          
          <p className="mt-8 text-[9px] text-zinc-500 uppercase font-black tracking-widest">
            New Era University • Library Monitoring System
          </p>
        </motion.div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="atmosphere" />
      
      <div className="w-full max-w-2xl text-center z-10">
        <AnimatePresence mode="wait">
          {step === 'idle' && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="mb-8 flex flex-col items-center gap-6">
                <img src="https://neu.edu.ph/main/img/neu.png" alt="NEU Logo" className="w-24 h-24" />
                <div className="stat-card px-4 py-2 rounded-full flex items-center gap-2 text-[var(--neon-blue)] border-zinc-200 dark:border-zinc-800">
                  <Users size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Today's Visitors: {liveCount}</span>
                </div>
              </div>
              
              <h1 className="text-4xl md:text-5xl font-black mb-12 glow-text">LIBRARY SYSTEM</h1>
              
              <div className="stat-card p-12 rounded-[3rem] border-zinc-200 dark:border-zinc-800">
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em] mb-4">Authenticating Session...</p>
                <div className="w-12 h-12 border-4 border-[var(--neon-blue)]/20 border-t-[var(--neon-blue)] rounded-full animate-spin mx-auto" />
              </div>
            </motion.div>
          )}

          {step === 'profile' && visitor && (
            <motion.div key="profile" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="stat-card p-8 rounded-[2.5rem] mb-8 border-zinc-200 dark:border-zinc-800">
                <h3 className="text-sm font-bold mb-6 uppercase tracking-widest text-[var(--neon-blue)]">Complete Your Profile</h3>
                
                <div className="space-y-6 text-left">
                  <div>
                    <label className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest block mb-2">Select College / Office <span className="text-red-500">*</span></label>
                    <select 
                      value={visitor.college}
                      onChange={(e) => setVisitor({ ...visitor, college: e.target.value })}
                      className="w-full bg-zinc-100 border-2 border-zinc-300 rounded-xl px-4 py-3.5 text-sm font-black focus:outline-none focus:ring-2 focus:ring-[var(--neon-blue)] text-zinc-900 shadow-sm"
                    >
                      <option value="" className="text-zinc-500">-- SELECT COLLEGE / OFFICE --</option>
                      {COLLEGES.map(c => <option key={c} value={c} className="text-zinc-900">{c}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest block mb-2">Select Role <span className="text-red-500">*</span></label>
                    <div className="grid grid-cols-2 gap-3">
                      {ROLES.map(r => (
                        <button
                          key={r}
                          onClick={() => setVisitor({ ...visitor, role: r.toLowerCase() })}
                          className={`px-4 py-4 rounded-xl text-[11px] font-black uppercase tracking-widest border-2 transition-all ${
                            visitor.role === r.toLowerCase() 
                              ? 'bg-[var(--neon-blue)] text-white dark:text-black border-[var(--neon-blue)] shadow-[0_0_20px_rgba(0,119,255,0.4)]' 
                              : 'bg-zinc-100 border-zinc-300 text-zinc-600 hover:border-[var(--neon-blue)] hover:text-[var(--neon-blue)]'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      if (visitor.college && visitor.role) {
                        setStep('purpose');
                      } else {
                        setError("Please select both College and Role");
                        setTimeout(() => setError(null), 3000);
                      }
                    }}
                    disabled={!visitor.college || !visitor.role}
                    className={`w-full py-4 rounded-xl font-black uppercase tracking-widest mt-4 transition-all ${
                      visitor.college && visitor.role
                        ? 'bg-zinc-900 dark:bg-white text-white dark:text-black hover:scale-[1.02] active:scale-95'
                        : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
                    }`}
                  >
                    Continue to Purpose
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'purpose' && visitor && (
            <motion.div key="purpose" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="stat-card p-8 rounded-[2.5rem] mb-8 border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-4 mb-8 text-left">
                  <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-2xl font-bold text-[var(--neon-blue)]">
                    {visitor.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold uppercase text-[var(--text-primary)]">{visitor.name}</h2>
                    <p className="text-[var(--neon-blue)] text-[11px] font-black uppercase tracking-widest">{visitor.college}</p>
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
              <p className="text-zinc-400 text-xs font-bold uppercase tracking-[0.2em] mb-8">Access Granted • Entry Logged</p>
              
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

    </div>
  );
}
