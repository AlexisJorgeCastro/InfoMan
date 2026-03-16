import React from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, LineChart, Line 
} from 'recharts';
import { Shield, ShieldAlert, Download, Users, Calendar, Filter, Activity, LogIn, Sun, Moon, Trash2, RefreshCw } from 'lucide-react';
import { format, startOfDay, subDays, isWithinInterval } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot, 
  Timestamp,
  orderBy,
  limit,
  doc,
  getDoc,
  addDoc,
  updateDoc
} from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, signInAnonymously } from 'firebase/auth';
import { db, auth } from './firebase';
import { setDoc } from 'firebase/firestore';

const CHART_COLORS = ['#1e40af', '#166534', '#92400e', '#991b1b', '#5b21b6'];

const COLLEGES = [
  "College of Informatics and Computing Studies",
  "College of Computer Studies",
  "College of Arts and Sciences",
  "College of Education",
  "College of Law",
  "College of Engineering",
  "College of Business Administration",
  "College of Nursing",
  "College of Criminology"
];

export default function AdminDashboard() {
  const [logs, setLogs] = React.useState<any[]>([]);
  const [stats, setStats] = React.useState<any>({ total: 0, liveCount: 0, byPurpose: [], byCollege: [], dailyStats: [] });
  const [period, setPeriod] = React.useState('today');
  const [dateRange, setDateRange] = React.useState({ start: '', end: '' });
  const [filters, setFilters] = React.useState({ purpose: 'all', college: 'all', role: 'all' });
  const [user, setUser] = React.useState<any>(null);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [showRegisterModal, setShowRegisterModal] = React.useState(false);
  const [showDummyLogin, setShowDummyLogin] = React.useState(false);
  const [loginTab, setLoginTab] = React.useState<'google' | 'manual'>('manual');
  const [activeTab, setActiveTab] = React.useState<'overview' | 'logs' | 'students'>('overview');
  const [students, setStudents] = React.useState<any[]>([]);
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);
  const [dummyCredentials, setDummyCredentials] = React.useState({ username: '', password: '' });
  const [newStudent, setNewStudent] = React.useState({ 
    firstName: '', 
    middleName: '', 
    lastName: '', 
    email: '', 
    rfid_tag: '', 
    college: COLLEGES[0] 
  });
  const [registering, setRegistering] = React.useState(false);
  const [registrationPreview, setRegistrationPreview] = React.useState<any>(null);
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);
  const [notification, setNotification] = React.useState<{message: string, type: 'success' | 'error'} | null>(null);
  const isAuthenticatingTester = React.useRef(false);

  React.useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  React.useEffect(() => {
    const email = `${newStudent.firstName.toLowerCase()}.${newStudent.lastName.toLowerCase()}@neu.edu.ph`.replace(/\s+/g, '');
    setNewStudent(prev => ({ ...prev, email }));
  }, [newStudent.firstName, newStudent.lastName]);

  const generateStudentId = async () => {
    const year = new Date().getFullYear().toString().slice(-2);
    const q = query(collection(db, 'visitors'));
    const snap = await getDocs(q);
    const count = snap.size + 1;
    const sequence = count.toString().padStart(5, '0');
    return `${year}-${sequence}-000`;
  };

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Check if admin
        const adminEmails = ["alexis.castro@neu.edu.ph", "jcesperanza@neu.edu.ph", "ajcken319@gmail.com", "chynna.cardona@neu.edu.ph"];
        if (adminEmails.includes(u.email)) {
          setIsAdmin(true);
        } else if (u.isAnonymous) {
          // If we are currently in the middle of dummyLogin, let it handle the state
          if (isAuthenticatingTester.current) return;

          // Check if it's a verified tester session
          try {
            const userDoc = await getDoc(doc(db, 'users', u.uid));
            if (userDoc.exists() && userDoc.data().role === 'tester') {
              setIsAdmin(true);
            } else {
              setIsAdmin(false);
            }
          } catch (err) {
            console.error("Auth State Check Error:", err);
            setIsAdmin(false);
          }
        } else {
          // Check users collection for role
          const userDoc = await getDoc(doc(db, 'users', u.uid));
          if (userDoc.exists() && userDoc.data().role === 'admin') {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Login Failed:", err);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setIsAdmin(false);
      setUser(null);
    } catch (err: any) {
      console.error("Logout Failed:", err);
    }
  };

  const switchAccount = async () => {
    await logout();
    await login();
  };

  const dummyLogin = async (e: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    
    // Aggressive logging for debugging
    console.log("Login Triggered");
    if (typeof window !== 'undefined') {
      // We'll use a notification instead of alert to be less intrusive but still visible
      setNotification({ message: "Starting authorization process...", type: 'success' });
    }

    const user_id = dummyCredentials.username.trim();
    const pass = dummyCredentials.password.trim();

    if (user_id === 'admin_test' && pass === 'neu_admin_2026') {
      setIsLoggingIn(true);
      isAuthenticatingTester.current = true;
      
      try {
        if (!auth) throw new Error("Firebase Auth is not initialized.");
        
        console.log("Calling signInAnonymously...");
        const cred = await signInAnonymously(auth);
        console.log("Auth Success:", cred.user.uid);
        
        // Create a temporary tester record in Firestore to grant DB permissions
        await setDoc(doc(db, 'users', cred.user.uid), {
          role: 'tester',
          secret: 'neu_tester_2026',
          displayName: 'Tester Admin',
          email: 'tester@neu.edu.ph',
          timestamp: new Date().toISOString()
        });
        
        setIsAdmin(true);
        setUser({ email: 'tester@neu.edu.ph', displayName: 'Tester Admin', isAnonymous: true, uid: cred.user.uid });
        setNotification({ message: "Tester Access Granted!", type: 'success' });
      } catch (err: any) {
        console.error("Tester Login Error:", err);
        let msg = err.message || "Unknown error occurred";
        if (err.code === 'auth/operation-not-allowed') {
          msg = "Anonymous Auth is disabled. Please enable it in Firebase Console > Authentication > Sign-in method.";
        } else if (err.code === 'auth/network-request-failed') {
          msg = "Network error. Please check your internet connection and authorized domains.";
        }
        setNotification({ message: "Login Error: " + msg, type: 'error' });
      } finally {
        setIsLoggingIn(false);
        isAuthenticatingTester.current = false;
      }
    } else {
      setNotification({ message: "Invalid Tester ID or Access Key", type: 'error' });
    }
  };

  const toggleBlock = async (rfidTag: string, currentStatus: boolean) => {
    try {
      const q = query(collection(db, 'visitors'), where('rfid_tag', '==', rfidTag));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setNotification({ message: "Visitor record not found", type: 'error' });
        return;
      }

      const visitorId = snap.docs[0].id;
      await updateDoc(doc(db, 'visitors', visitorId), {
        is_blocked: !currentStatus
      });

      setNotification({ 
        message: `Visitor ${!currentStatus ? 'BLOCKED' : 'UNBLOCKED'} successfully`, 
        type: 'success' 
      });
      fetchData();
    } catch (err: any) {
      console.error("Toggle Block Error:", err);
      setNotification({ message: "Failed to update status", type: 'error' });
    }
  };

  const fetchData = React.useCallback(async () => {
    if (!isAdmin) return;

    try {
      let q = query(collection(db, 'logs'), orderBy('timestamp', 'desc'));
      
      const snapshot = await getDocs(q);
      const allLogs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: (doc.data().timestamp as Timestamp).toDate()
      })) as any[];

      setLogs(allLogs);

      // Fetch all visitors (students)
      const vSnap = await getDocs(collection(db, 'visitors'));
      const allStudents = vSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      setStudents(allStudents);

      // Map current block status to logs
      const logsWithCurrentStatus = allLogs.map(log => {
        const student = allStudents.find(s => s.rfid_tag === log.visitor_id);
        return {
          ...log,
          is_blocked: student ? student.is_blocked : log.is_blocked
        };
      });
      setLogs(logsWithCurrentStatus);

      // Calculate Stats & Filter Logs
      let filteredLogs = logsWithCurrentStatus;
      const now = new Date();
      const todayStart = startOfDay(now);

      if (period === 'today') {
        filteredLogs = filteredLogs.filter(l => l.timestamp >= todayStart);
      } else if (period === 'week') {
        filteredLogs = filteredLogs.filter(l => l.timestamp >= subDays(todayStart, 7));
      } else if (period === 'month') {
        filteredLogs = filteredLogs.filter(l => l.timestamp >= subDays(todayStart, 30));
      } else if (period === 'custom' && dateRange.start && dateRange.end) {
        const start = new Date(dateRange.start);
        const end = new Date(dateRange.end);
        end.setHours(23, 59, 59, 999);
        filteredLogs = filteredLogs.filter(l => isWithinInterval(l.timestamp, { start, end }));
      }

      // Apply additional filters
      if (filters.purpose !== 'all') {
        filteredLogs = filteredLogs.filter(l => l.purpose === filters.purpose);
      }
      if (filters.college !== 'all') {
        filteredLogs = filteredLogs.filter(l => l.visitor_college === filters.college);
      }
      if (filters.role === 'employee') {
        filteredLogs = filteredLogs.filter(l => l.visitor_role === 'faculty' || l.visitor_role === 'staff');
      } else if (filters.role === 'student') {
        filteredLogs = filteredLogs.filter(l => l.visitor_role === 'student');
      }

      setLogs(filteredLogs);

      const purposeMap: any = {};
      const collegeMap: any = {};
      const dailyMap: any = {};
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      filteredLogs.forEach(l => {
        purposeMap[l.purpose] = (purposeMap[l.purpose] || 0) + 1;
        collegeMap[l.visitor_college] = (collegeMap[l.visitor_college] || 0) + 1;
        
        const dateStr = format(l.timestamp, 'yyyy-MM-dd');
        dailyMap[dateStr] = (dailyMap[dateStr] || 0) + 1;
      });

      const liveCount = allLogs.filter(l => l.timestamp >= oneHourAgo).length;

      setStats({
        total: filteredLogs.length,
        liveCount,
        byPurpose: Object.entries(purposeMap).map(([purpose, count]) => ({ purpose, count })),
        byCollege: Object.entries(collegeMap).map(([college, count]) => ({ college, count })),
        dailyStats: Object.entries(dailyMap).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date))
      });
    } catch (err) {
      console.error("Fetch Data Error:", err);
    }
  }, [period, dateRange, isAdmin, filters]);

  React.useEffect(() => {
    if (!isAdmin) return;
    fetchData();
    const q = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(1));
    const unsubscribe = onSnapshot(q, () => {
      fetchData();
    });
    return () => unsubscribe();
  }, [fetchData, isAdmin]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505]">
      <div className="text-[var(--neon-blue)] font-black tracking-widest animate-pulse">AUTHENTICATING...</div>
    </div>
  );

  if (!isAdmin) return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] p-4 relative overflow-hidden">
      <div className="atmosphere" />
      
      {notification && (
        <div className={`fixed top-12 left-1/2 -translate-x-1/2 z-[500] px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl animate-in slide-in-from-top-4 duration-300 ${
          notification.type === 'success' ? 'bg-[var(--neon-green)] text-black' : 'bg-[var(--neon-red)] text-white'
        }`}>
          {notification.message}
        </div>
      )}

      <div className="stat-card p-8 md:p-12 rounded-[3rem] text-center max-w-lg w-full z-[100] border-zinc-800/50 relative pointer-events-auto">
        <ShieldAlert size={56} className="text-[var(--neon-red)] mx-auto mb-6" />
        <h1 className="text-3xl font-black mb-2 glow-text">ACCESS DENIED</h1>
        <p className="text-[var(--text-secondary)] text-[10px] mb-8 uppercase tracking-[0.3em] font-bold">Authentication Required</p>
        
        <div className="flex p-1 bg-black/40 rounded-2xl border border-zinc-800 mb-8">
          <button 
            onClick={() => setLoginTab('manual')}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              loginTab === 'manual' ? 'bg-zinc-800 text-[var(--neon-blue)] shadow-lg' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Tester Access
          </button>
          <button 
            onClick={() => setLoginTab('google')}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              loginTab === 'google' ? 'bg-zinc-800 text-[var(--neon-blue)] shadow-lg' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Official Login
          </button>
        </div>

        <div className="min-h-[240px] flex flex-col justify-center">
          {loginTab === 'manual' ? (
            <div className="animate-in fade-in slide-in-from-left-4 duration-300">
              <form onSubmit={dummyLogin} className="space-y-4">
                <p className="text-xs text-zinc-400 leading-relaxed mb-2">
                  Enter the provided tester credentials to bypass Google authentication.
                </p>
                <div className="space-y-1 text-left">
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Tester ID</label>
                  <input 
                    type="text" 
                    placeholder="admin_test"
                    className="w-full bg-black/60 border border-zinc-800 rounded-xl px-4 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--neon-blue)] transition-all"
                    value={dummyCredentials.username}
                    onChange={(e) => setDummyCredentials(prev => ({ ...prev, username: e.target.value }))}
                    disabled={isLoggingIn}
                  />
                </div>
                <div className="space-y-1 text-left">
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Access Key</label>
                  <input 
                    type="password" 
                    placeholder="••••••••"
                    className="w-full bg-black/60 border border-zinc-800 rounded-xl px-4 py-4 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--neon-blue)] transition-all"
                    value={dummyCredentials.password}
                    onChange={(e) => setDummyCredentials(prev => ({ ...prev, password: e.target.value }))}
                    disabled={isLoggingIn}
                  />
                </div>
                <button 
                  type="button"
                  onClick={(e) => {
                    dummyLogin(e);
                  }}
                  disabled={isLoggingIn}
                  className="w-full bg-zinc-800 text-[var(--neon-blue)] py-4 rounded-2xl font-black uppercase tracking-widest text-xs border border-[var(--neon-blue)]/30 hover:bg-[var(--neon-blue)]/10 transition-all mt-2 flex items-center justify-center gap-2 cursor-pointer pointer-events-auto"
                >
                  {isLoggingIn ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" /> Verifying...
                    </>
                  ) : (
                    "Verify Tester Access"
                  )}
                </button>
                <div className="pt-4 text-[8px] text-zinc-600 uppercase tracking-widest font-bold">
                  Status: {dummyCredentials.username.length > 0 ? "ID Entered" : "Waiting for ID"} | {dummyCredentials.password.length > 0 ? "Key Entered" : "Waiting for Key"}
                </div>
              </form>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              {!user ? (
                <div className="space-y-6">
                  <p className="text-xs text-zinc-400 leading-relaxed px-4">
                    Use your institutional Google account to access the administrative dashboard.
                  </p>
                  <button 
                    onClick={login}
                    className="w-full bg-[var(--neon-blue)] text-black py-5 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-[0_0_20px_rgba(0,242,255,0.2)]"
                  >
                    <LogIn size={20} /> Sign in with Google
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl">
                    <p className="text-[var(--neon-red)] text-[10px] font-black uppercase tracking-widest mb-2">Unauthorized Account</p>
                    <p className="text-zinc-300 text-xs font-medium break-all">{user.email}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={switchAccount}
                      className="bg-[var(--neon-blue)] text-black py-4 rounded-xl font-black uppercase tracking-widest text-[10px] hover:scale-[1.02] transition-all"
                    >
                      Switch
                    </button>
                    <button 
                      onClick={logout}
                      className="bg-zinc-800 text-zinc-400 py-4 rounded-xl font-black uppercase tracking-widest text-[10px] hover:text-white transition-all"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-12 pt-8 border-t border-zinc-900">
          <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-[0.2em]">
            NEU Library Monitoring System v2.0
          </p>
        </div>
      </div>
    </div>
  );

  const migrateData = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const q = collection(db, 'visitors');
      const snap = await getDocs(q);
      let count = 0;
      
      for (const vDoc of snap.docs) {
        const data = vDoc.data();
        let tag = data.rfid_tag || "";
        
        // Only migrate if it doesn't already match the format 00-00000-000
        const formatRegex = /^\d{2}-\d{5}-\d{3}$/;
        if (!formatRegex.test(tag)) {
          // Attempt to clean and format
          let digits = tag.replace(/\D/g, '');
          if (digits.length >= 5) {
            // Pad or truncate to 10 digits for a reasonable guess
            // e.g. 202400001 -> 2400001 -> 24-00001-000
            if (digits.startsWith('20')) digits = digits.slice(2); // Remove '20' from 2024
            
            // Ensure we have at least 10 digits by padding with zeros
            digits = digits.padEnd(10, '0');
            
            const newTag = `${digits.slice(0, 2)}-${digits.slice(2, 7)}-${digits.slice(7, 10)}`;
            
            const { updateDoc, doc: firestoreDoc } = await import('firebase/firestore');
            await updateDoc(firestoreDoc(db, 'visitors', vDoc.id), {
              rfid_tag: newTag
            });
            count++;
          }
        }
      }
      setNotification({ message: `Migration Complete! Updated ${count} records.`, type: 'success' });
      fetchData();
    } catch (err: any) {
      setNotification({ message: "Migration Failed: " + err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const seedData = async () => {
    if (!isAdmin) return;
    
    setLoading(true);
    try {
      // Reset logic: Clear logs and visitors
      const logsSnap = await getDocs(collection(db, 'logs'));
      const visitorsSnap = await getDocs(collection(db, 'visitors'));
      
      const { deleteDoc, doc: firestoreDoc } = await import('firebase/firestore');
      
      for (const d of logsSnap.docs) await deleteDoc(firestoreDoc(db, 'logs', d.id));
      for (const d of visitorsSnap.docs) await deleteDoc(firestoreDoc(db, 'visitors', d.id));

      setNotification({ message: "System Reset Successfully!", type: 'success' });
      setShowResetConfirm(false);
      fetchData();
    } catch (err: any) {
      setNotification({ message: "Reset Failed: " + err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setRegistering(true);

    try {
      const studentId = await generateStudentId();
      const fullName = `${newStudent.firstName} ${newStudent.middleName ? newStudent.middleName + ' ' : ''}${newStudent.lastName}`.trim();
      
      const studentData = {
        name: fullName,
        email: newStudent.email,
        rfid_tag: studentId,
        college: newStudent.college,
        role: 'student',
        is_blocked: false,
        created_at: Timestamp.now()
      };

      setRegistrationPreview(studentData);
      setRegistering(false);
    } catch (err: any) {
      setNotification({ message: "Generation Failed: " + err.message, type: 'error' });
      setRegistering(false);
    }
  };

  const confirmRegistration = async () => {
    if (!registrationPreview) return;
    setRegistering(true);
    try {
      await addDoc(collection(db, 'visitors'), registrationPreview);
      setNotification({ message: "Student Saved to Database!", type: 'success' });
      setShowRegisterModal(false);
      setRegistrationPreview(null);
      setNewStudent({ firstName: '', middleName: '', lastName: '', email: '', rfid_tag: '', college: COLLEGES[0] });
      fetchData();
    } catch (err: any) {
      setNotification({ message: "Save Failed: " + err.message, type: 'error' });
    } finally {
      setRegistering(false);
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(0, 242, 255);
    doc.text('NEU LIBRARY VISITOR REPORT', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${format(new Date(), 'PPP p')}`, 14, 30);
    doc.text(`Report Period: ${period.toUpperCase()}`, 14, 35);
    
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`Total Visitors: ${stats.total}`, 14, 45);
    
    // Summary Table
    const summaryData = stats.byPurpose.map((p: any) => [p.purpose, p.count]);
    autoTable(doc, {
      startY: 50,
      head: [['Purpose of Visit', 'Count']],
      body: summaryData,
      theme: 'grid',
      headStyles: { fillColor: [240, 240, 240], textColor: 0 }
    });

    // Detailed Logs
    doc.addPage();
    doc.setFontSize(14);
    doc.setTextColor(0, 242, 255);
    doc.text('DETAILED VISITOR ACTIVITY LOGS', 14, 20);
    
    const logData = logs.map(l => [
      `${l.visitor_name}\n(${l.visitor_id})`,
      l.visitor_college,
      l.purpose,
      format(new Date(l.timestamp), 'MMM dd, yyyy p')
    ]);
    
    autoTable(doc, {
      startY: 25,
      head: [['Visitor Identity', 'College/Office', 'Purpose', 'Timestamp']],
      body: logData,
      headStyles: { fillColor: [0, 242, 255], textColor: 0, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 40 },
        2: { cellWidth: 40 },
        3: { cellWidth: 40 }
      }
    });

    doc.save(`NEU_Library_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <div className="p-4 md:p-8 min-h-screen text-[var(--text-primary)] relative">
      <div className="atmosphere" />
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black glow-text">ADMIN COMMAND CENTER</h1>
          <p className="text-[var(--text-secondary)] text-xs mt-1 tracking-widest uppercase">Library Visitor Monitoring System</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select 
            value={period} 
            onChange={(e) => setPeriod(e.target.value)}
            className="stat-card px-4 py-2 rounded-lg text-xs font-bold bg-transparent border-zinc-800 focus:outline-none"
          >
            <option value="today">TODAY</option>
            <option value="week">LAST 7 DAYS</option>
            <option value="month">LAST 30 DAYS</option>
            <option value="custom">CUSTOM RANGE</option>
          </select>
          <button 
            onClick={() => setShowRegisterModal(true)}
            className="stat-card px-6 py-2 rounded-full flex items-center gap-2 text-[var(--neon-blue)] font-bold text-xs hover:bg-[var(--neon-blue)] hover:text-black transition-all"
          >
            <Users size={16} /> REGISTER STUDENT
          </button>
          <button 
            onClick={() => setShowResetConfirm(true)}
            className="stat-card px-6 py-2 rounded-full flex items-center gap-2 text-[var(--neon-red)] font-bold text-xs hover:bg-[var(--neon-red)] hover:text-black transition-all"
          >
            <RefreshCw size={16} /> RESET SYSTEM
          </button>
          <button 
            onClick={generatePDF}
            className="stat-card px-6 py-2 rounded-full flex items-center gap-2 text-[var(--neon-blue)] font-bold text-xs hover:bg-[var(--neon-blue)] hover:text-black transition-all"
          >
            <Download size={16} /> DOWNLOAD REPORT
          </button>
        </div>
      </div>

      {period === 'custom' && (
        <div className="stat-card p-4 rounded-2xl mb-8 flex gap-4 items-center animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-zinc-500">START:</span>
            <input type="date" className="bg-transparent text-xs border border-zinc-800 rounded p-1" onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-zinc-500">END:</span>
            <input type="date" className="bg-transparent text-xs border border-zinc-800 rounded p-1" onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))} />
          </div>
          <button onClick={fetchData} className="bg-[var(--neon-blue)] text-black text-[10px] font-bold px-4 py-1 rounded">APPLY</button>
        </div>
      )}

      {/* Filters Section */}
      <div className="stat-card p-6 rounded-3xl mb-8 flex flex-wrap gap-6 items-center border-zinc-800/50">
        <div className="flex items-center gap-3">
          <Filter size={14} className="text-zinc-500" />
          <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Filters:</span>
        </div>
        
        <div className="flex flex-col gap-1">
          <label className="text-[8px] font-black text-zinc-600 uppercase tracking-widest ml-1">Purpose</label>
          <select 
            value={filters.purpose}
            onChange={(e) => setFilters(prev => ({ ...prev, purpose: e.target.value }))}
            className="bg-[var(--input-bg)] border border-zinc-300 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-[var(--neon-blue)] text-[var(--text-primary)]"
          >
            <option value="all">ALL PURPOSES</option>
            <option value="Reading books">READING BOOKS</option>
            <option value="Research for thesis">RESEARCH FOR THESIS</option>
            <option value="Use of computer">USE OF COMPUTER</option>
            <option value="Doing assignments">DOING ASSIGNMENTS</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[8px] font-black text-zinc-600 uppercase tracking-widest ml-1">College</label>
          <select 
            value={filters.college}
            onChange={(e) => setFilters(prev => ({ ...prev, college: e.target.value }))}
            className="bg-[var(--input-bg)] border border-zinc-300 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-[var(--neon-blue)] text-[var(--text-primary)]"
          >
            <option value="all">ALL COLLEGES</option>
            {COLLEGES.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[8px] font-black text-zinc-600 uppercase tracking-widest ml-1">Visitor Type</label>
          <select 
            value={filters.role}
            onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value }))}
            className="bg-[var(--input-bg)] border border-zinc-300 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-[var(--neon-blue)] text-[var(--text-primary)]"
          >
            <option value="all">ALL TYPES</option>
            <option value="student">STUDENTS ONLY</option>
            <option value="employee">EMPLOYEES (FACULTY/STAFF)</option>
          </select>
        </div>

        <button 
          onClick={() => setFilters({ purpose: 'all', college: 'all', role: 'all' })}
          className="ml-auto text-[9px] font-black text-zinc-500 hover:text-[var(--neon-red)] transition-colors uppercase tracking-widest"
        >
          Clear Filters
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="stat-card p-6 rounded-3xl border-l-4 border-[var(--neon-blue)] flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <h3 className="text-[10px] text-[var(--text-secondary)] uppercase mb-2 font-bold tracking-widest">Total Logs</h3>
            <Users size={16} className="text-[var(--neon-blue)]" />
          </div>
          <p className="text-4xl font-black text-[var(--neon-blue)]">{stats.total}</p>
          <p className="text-[8px] text-zinc-500 dark:text-zinc-400 mt-2 uppercase font-bold">Filtered Count</p>
        </div>
        <div className="stat-card p-6 rounded-3xl border-l-4 border-[var(--neon-green)] flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <h3 className="text-[10px] text-[var(--text-secondary)] uppercase mb-2 font-bold tracking-widest">Live Visitors</h3>
            <Activity size={16} className="text-[var(--neon-green)] animate-pulse" />
          </div>
          <p className="text-4xl font-black text-[var(--neon-green)]">{stats.liveCount}</p>
          <p className="text-[8px] text-zinc-500 dark:text-zinc-400 mt-2 uppercase font-bold">Active in last hour</p>
        </div>
        <div className="stat-card p-6 rounded-3xl border-l-4 border-purple-500 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <h3 className="text-[10px] text-[var(--text-secondary)] uppercase mb-2 font-bold tracking-widest">Avg. Stay</h3>
            <Calendar size={16} className="text-purple-500" />
          </div>
          <p className="text-4xl font-black text-purple-500">15m</p>
          <p className="text-[8px] text-zinc-500 dark:text-zinc-400 mt-2 uppercase font-bold">Estimated duration</p>
        </div>
        <div className="stat-card p-6 rounded-3xl border-l-4 border-orange-500 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <h3 className="text-[10px] text-[var(--text-secondary)] uppercase mb-2 font-bold tracking-widest">Peak Hour</h3>
            <Activity size={16} className="text-orange-500" />
          </div>
          <p className="text-4xl font-black text-orange-500">2PM</p>
          <p className="text-[8px] text-zinc-500 dark:text-zinc-400 mt-2 uppercase font-bold">Most active time</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="stat-card p-8 rounded-3xl h-80 flex flex-col">
          <h3 className="text-[10px] text-[var(--text-secondary)] uppercase mb-2 font-bold">Purpose Distribution</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <Pie 
                  data={stats.byPurpose} 
                  innerRadius="60%" 
                  outerRadius="80%" 
                  paddingAngle={5} 
                  dataKey="count" 
                  nameKey="purpose"
                >
                  {stats.byPurpose.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'var(--bg-primary)', 
                    border: '1px solid var(--neon-blue)', 
                    borderRadius: '10px', 
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 600
                  }} 
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  iconType="circle" 
                  wrapperStyle={{ 
                    paddingTop: '20px', 
                    fontSize: '14px', 
                    fontWeight: 600,
                    fontFamily: 'Inter, sans-serif'
                  }} 
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="stat-card p-8 rounded-3xl h-80 flex flex-col">
          <h3 className="text-[10px] text-[var(--text-secondary)] uppercase mb-2 font-bold">Visitors by College</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.byCollege} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="college" 
                  fontSize={10} 
                  tick={{fill: 'var(--text-primary)', fontFamily: 'Inter, sans-serif'}} 
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={60}
                />
                <YAxis fontSize={10} tick={{fill: 'var(--text-primary)'}} />
                <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{backgroundColor: 'var(--bg-primary)', border: '1px solid var(--neon-blue)'}} />
                <Bar dataKey="count" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {notification && (
        <div className={`fixed top-12 left-1/2 -translate-x-1/2 z-[500] px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl animate-in slide-in-from-top-4 duration-300 ${
          notification.type === 'success' ? 'bg-[var(--neon-green)] text-black' : 'bg-[var(--neon-red)] text-white'
        }`}>
          {notification.message}
        </div>
      )}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="stat-card p-10 rounded-[3rem] w-full max-w-md text-center border-[var(--neon-red)] shadow-[0_0_30px_rgba(255,49,49,0.2)]">
            <ShieldAlert size={64} className="text-[var(--neon-red)] mx-auto mb-6" />
            <h2 className="text-2xl font-black mb-4 glow-text text-[var(--neon-red)] uppercase tracking-widest">System Reset</h2>
            <p className="text-sm text-zinc-400 font-bold mb-8 uppercase tracking-widest leading-relaxed">
              WARNING: This will permanently delete ALL visitor logs and registered students. This action cannot be undone.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 bg-zinc-800 text-zinc-400 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:text-white transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={seedData}
                className="flex-1 bg-[var(--neon-red)] text-black py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-[0_0_15px_rgba(255,49,49,0.3)] hover:scale-[1.02] transition-transform"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Toast removed from here and moved to top level */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="stat-card p-8 rounded-[2.5rem] w-full max-w-md animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-black mb-6 glow-text uppercase tracking-widest">
              {registrationPreview ? "Confirm Details" : "Register New Student"}
            </h2>
            
            {!registrationPreview ? (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">First Name</label>
                    <input 
                      required
                      type="text" 
                      placeholder="JUAN"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--neon-blue)]"
                      value={newStudent.firstName}
                      onChange={(e) => setNewStudent(prev => ({ ...prev, firstName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Middle Name</label>
                    <input 
                      type="text" 
                      placeholder="PROTASIO"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--neon-blue)]"
                      value={newStudent.middleName}
                      onChange={(e) => setNewStudent(prev => ({ ...prev, middleName: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Last Name</label>
                  <input 
                    required
                    type="text" 
                    placeholder="DELA CRUZ"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--neon-blue)]"
                    value={newStudent.lastName}
                    onChange={(e) => setNewStudent(prev => ({ ...prev, lastName: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">College / Office</label>
                  <select 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--neon-blue)]"
                    value={newStudent.college}
                    onChange={(e) => setNewStudent(prev => ({ ...prev, college: e.target.value }))}
                  >
                    {COLLEGES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                
                <div className="pt-4 flex gap-4">
                  <button 
                    type="button" 
                    onClick={() => setShowRegisterModal(false)}
                    className="flex-1 text-zinc-500 text-[10px] uppercase font-bold tracking-widest hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={registering}
                    className="flex-[2] bg-[var(--neon-blue)] text-black font-black py-3 rounded-xl uppercase tracking-widest text-xs shadow-[0_0_15px_rgba(0,242,255,0.3)] hover:scale-[1.02] transition-transform disabled:opacity-50"
                  >
                    {registering ? "GENERATING..." : "GENERATE PROFILE"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="space-y-4 bg-[var(--glass-surface)] p-6 rounded-2xl border border-[var(--glass-border)]">
                  <div className="flex flex-col border-b border-[var(--glass-border)] pb-3">
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest mb-1">Full Name</span>
                    <span className="text-sm font-black text-[var(--text-primary)] uppercase">{registrationPreview.name}</span>
                  </div>
                  <div className="flex flex-col border-b border-[var(--glass-border)] pb-3">
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest mb-1">Institutional Email</span>
                    <span className="text-sm font-bold text-[var(--neon-blue)] lowercase">{registrationPreview.email}</span>
                  </div>
                  <div className="flex flex-col border-b border-[var(--glass-border)] pb-3">
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest mb-1">Student ID / RFID</span>
                    <span className="text-sm font-black text-[var(--neon-green)] tracking-widest">{registrationPreview.rfid_tag}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest mb-1">College / Office</span>
                    <span className="text-sm font-bold text-[var(--text-primary)] uppercase leading-tight">{registrationPreview.college}</span>
                  </div>
                </div>
                
                <p className="text-[10px] text-center text-zinc-400 font-bold uppercase tracking-[0.2em] leading-relaxed">
                  Confirm the details above to seed this student into the database.
                </p>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setRegistrationPreview(null)}
                    className="flex-1 text-zinc-500 text-[10px] uppercase font-bold tracking-widest hover:text-white transition-colors"
                  >
                    Back
                  </button>
                  <button 
                    onClick={confirmRegistration}
                    disabled={registering}
                    className="flex-[2] bg-[var(--neon-green)] text-black font-black py-3 rounded-xl uppercase tracking-widest text-xs shadow-[0_0_15px_rgba(57,255,20,0.3)] hover:scale-[1.02] transition-transform disabled:opacity-50"
                  >
                    {registering ? "SAVING..." : "SEED TO DATABASE"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="stat-card rounded-3xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800/50">
          <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--neon-blue)]">Visitor Activity Logs</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-zinc-100 dark:bg-zinc-800/20 text-[var(--neon-blue)] text-[10px] uppercase">
              <tr>
                <th className="p-4">Visitor Identity</th>
                <th className="p-4">College/Office</th>
                <th className="p-4">Purpose</th>
                <th className="p-4">Timestamp</th>
                <th className="p-4">Security Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/30">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-zinc-500/5 transition-colors">
                  <td className="p-4 font-bold text-sm uppercase text-[var(--text-primary)]">{log.visitor_name}</td>
                  <td className="p-4 text-[var(--text-secondary)] uppercase text-[10px]">{log.visitor_college}</td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-[var(--tag-bg)] rounded text-[10px] font-bold text-[var(--neon-blue)]">{log.purpose}</span>
                  </td>
                  <td className="p-4 text-[var(--text-secondary)] text-[10px]">{format(new Date(log.timestamp), 'MMM dd, p')}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-4">
                      {log.is_blocked ? 
                        <span className="text-[var(--neon-red)] flex items-center gap-1 text-[10px] font-bold tracking-tighter"><ShieldAlert size={14}/> BLOCKED</span> : 
                        <span className="text-[var(--neon-green)] flex items-center gap-1 text-[10px] font-bold tracking-tighter"><Shield size={14}/> AUTHORIZED</span>
                      }
                      <button 
                        onClick={() => toggleBlock(log.visitor_id, !!log.is_blocked)}
                        className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${
                          log.is_blocked 
                            ? 'bg-[var(--neon-green)] text-black hover:scale-105' 
                            : 'bg-[var(--neon-red)] text-white hover:scale-105'
                        }`}
                      >
                        {log.is_blocked ? 'Unblock' : 'Block'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
