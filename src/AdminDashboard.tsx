import React from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, LineChart, Line 
} from 'recharts';
import { Shield, ShieldAlert, Download, Users, Calendar, Filter, Activity, LogIn, LogOut, Sun, Moon, Trash2, RefreshCw } from 'lucide-react';
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
import { auth, db } from './firebase';
import { setDoc } from 'firebase/firestore';

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

export default function AdminDashboard({ user, isAdmin }: { user: any, isAdmin: boolean }) {
  const [logs, setLogs] = React.useState<any[]>([]);
  const [stats, setStats] = React.useState<any>({ total: 0, liveCount: 0, byPurpose: [], byCollege: [], dailyStats: [] });
  const [period, setPeriod] = React.useState('today');
  const [dateRange, setDateRange] = React.useState({ start: '', end: '' });
  const [filters, setFilters] = React.useState({ purpose: 'all', college: 'all', role: 'all' });
  const [loading, setLoading] = React.useState(true);
  const [showRegisterModal, setShowRegisterModal] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'overview' | 'logs' | 'students'>('overview');
  const [students, setStudents] = React.useState<any[]>([]);
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

  const fetchData = React.useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);

    try {
      const now = new Date();
      const todayStart = startOfDay(now);
      let logQuery;

      // Optimize query based on period to reduce initial data load
      if (period === 'today') {
        logQuery = query(collection(db, 'logs'), where('timestamp', '>=', Timestamp.fromDate(todayStart)), orderBy('timestamp', 'desc'));
      } else if (period === 'week') {
        logQuery = query(collection(db, 'logs'), where('timestamp', '>=', Timestamp.fromDate(subDays(todayStart, 7))), orderBy('timestamp', 'desc'));
      } else if (period === 'month') {
        logQuery = query(collection(db, 'logs'), where('timestamp', '>=', Timestamp.fromDate(subDays(todayStart, 30))), orderBy('timestamp', 'desc'));
      } else if (period === 'custom' && dateRange.start && dateRange.end) {
        const start = new Date(dateRange.start);
        const end = new Date(dateRange.end);
        end.setHours(23, 59, 59, 999);
        logQuery = query(collection(db, 'logs'), where('timestamp', '>=', Timestamp.fromDate(start)), where('timestamp', '<=', Timestamp.fromDate(end)), orderBy('timestamp', 'desc'));
      } else {
        // Fallback or 'all' - limit to prevent massive data transfer
        logQuery = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(500));
      }
      
      const snapshot = await getDocs(logQuery);
      const allLogs = snapshot.docs.map(doc => {
        const data = doc.data() as any;
        return {
          id: doc.id,
          ...data,
          timestamp: (data.timestamp as Timestamp).toDate()
        };
      }) as any[];

      // Fetch visitors only if needed (e.g. for students tab or to get current block status)
      // For performance, we only fetch visitors present in the current logs unless on students tab
      const visitorIds = [...new Set(allLogs.map(l => l.visitor_id))].filter(Boolean);
      let currentVisitors: any[] = [];
      
      if (activeTab === 'students') {
        const vSnap = await getDocs(collection(db, 'visitors'));
        currentVisitors = vSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } else if (visitorIds.length > 0) {
        // Fetch only visitors in logs (batch in chunks of 30 for 'in' query - Firestore limit is 30)
        const chunks = [];
        for (let i = 0; i < visitorIds.length; i += 30) {
          chunks.push(visitorIds.slice(i, i + 30));
        }
        const visitorPromises = chunks.map(chunk => 
          getDocs(query(collection(db, 'visitors'), where('rfid_tag', 'in', chunk)))
        );
        const visitorSnaps = await Promise.all(visitorPromises);
        currentVisitors = visitorSnaps.flatMap(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }

      setStudents(currentVisitors);

      // Map current block status to logs
      const logsWithCurrentStatus = allLogs.map(log => {
        const student = currentVisitors.find(s => s.rfid_tag === log.visitor_id);
        return {
          ...log,
          is_blocked: student ? student.is_blocked : log.is_blocked
        };
      });

      // Apply additional filters (purpose, college, role)
      let filteredLogs = logsWithCurrentStatus;
      if (filters.purpose !== 'all') {
        filteredLogs = filteredLogs.filter(l => l.purpose === filters.purpose);
      }
      if (filters.college !== 'all') {
        filteredLogs = filteredLogs.filter(l => l.visitor_college === filters.college);
      }
      if (filters.role === 'employee') {
        filteredLogs = filteredLogs.filter(l => l.visitor_role === 'faculty' || l.visitor_role === 'staff');
      } else if (filters.role !== 'all') {
        filteredLogs = filteredLogs.filter(l => l.visitor_role === filters.role);
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
      
      setLoading(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'logs/visitors');
      setLoading(false);
    }
  }, [period, dateRange, isAdmin, filters, activeTab]);

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err: any) {
      console.error("Logout Failed:", err);
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

  React.useEffect(() => {
    if (user && isAdmin) {
      fetchData();
    }
  }, [user, isAdmin, period, filters, dateRange, fetchData]);

  React.useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(1));
    const unsubscribe = onSnapshot(q, () => {
      fetchData();
    });
    return () => unsubscribe();
  }, [fetchData, isAdmin]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
      <div className="atmosphere" />
      <div className="text-[var(--neon-blue)] font-black tracking-widest animate-pulse">SYNCHRONIZING DATA...</div>
    </div>
  );

  if (!isAdmin) return null;

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
        <div className="flex items-center gap-4">
          <img src="https://neu.edu.ph/main/img/neu.png" alt="NEU Logo" className="w-16 h-16" />
          <div>
            <h1 className="text-3xl font-black glow-text">ADMIN DASHBOARD</h1>
            <p className="text-[var(--text-secondary)] text-[10px] font-black uppercase tracking-[0.2em] mt-1">
              Welcome, {user?.displayName || user?.email || 'Admin'} • NEU Library System
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <select 
            value={period} 
            onChange={(e) => setPeriod(e.target.value)}
            className="stat-card px-4 py-2 rounded-lg text-xs font-black bg-white dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-[var(--neon-blue)] text-[var(--text-primary)] shadow-sm"
          >
            <option value="today">TODAY</option>
            <option value="week">LAST 7 DAYS</option>
            <option value="month">LAST 30 DAYS</option>
            <option value="custom">CUSTOM RANGE</option>
          </select>
          <button 
            onClick={() => setShowRegisterModal(true)}
            className="stat-card px-6 py-2 rounded-full flex items-center gap-2 text-[var(--neon-blue)] font-black text-xs bg-white dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 hover:bg-[var(--neon-blue)] hover:text-white dark:hover:text-black transition-all shadow-sm"
          >
            <Users size={16} /> REGISTER STUDENT
          </button>
          <button 
            onClick={() => setShowResetConfirm(true)}
            className="stat-card px-6 py-2 rounded-full flex items-center gap-2 text-[var(--neon-red)] font-black text-xs bg-white dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 hover:bg-[var(--neon-red)] hover:text-white dark:hover:text-black transition-all shadow-sm"
          >
            <RefreshCw size={16} /> RESET SYSTEM
          </button>
          <button 
            onClick={generatePDF}
            className="stat-card px-6 py-2 rounded-full flex items-center gap-2 text-[var(--neon-blue)] font-black text-xs bg-white dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 hover:bg-[var(--neon-blue)] hover:text-white dark:hover:text-black transition-all shadow-sm"
          >
            <Download size={16} /> DOWNLOAD REPORT
          </button>
          <button 
            onClick={logout}
            className="stat-card px-6 py-2 rounded-full flex items-center gap-2 text-zinc-600 dark:text-zinc-400 font-black text-xs bg-white dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-900 dark:hover:bg-white hover:text-white dark:hover:text-black transition-all shadow-sm"
            title="Sign Out to Guest Mode"
          >
            <LogOut size={16} /> SIGN OUT
          </button>
        </div>
      </div>

      {period === 'custom' && (
        <div className="stat-card p-4 rounded-2xl mb-8 flex gap-4 items-center animate-in slide-in-from-top-2 border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900/50 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-zinc-600 dark:text-zinc-400 uppercase tracking-widest">START:</span>
            <input type="date" className="bg-zinc-100 text-xs font-bold border-2 border-zinc-300 rounded-lg p-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[var(--neon-blue)]" onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-zinc-600 dark:text-zinc-400 uppercase tracking-widest">END:</span>
            <input type="date" className="bg-zinc-100 text-xs font-bold border-2 border-zinc-300 rounded-lg p-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[var(--neon-blue)]" onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))} />
          </div>
          <button onClick={fetchData} className="bg-[var(--neon-blue)] text-white dark:text-black text-[10px] font-black px-6 py-2 rounded-lg uppercase tracking-widest hover:scale-105 transition-transform shadow-md">APPLY RANGE</button>
        </div>
      )}

      {/* Filters Section */}
      <div className="stat-card p-6 rounded-3xl mb-8 flex flex-wrap gap-6 items-center border-2 border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800/40 shadow-lg">
        <div className="flex items-center gap-3">
          <Filter size={18} className="text-[var(--neon-blue)]" />
          <span className="text-[11px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-widest">Filter Records:</span>
        </div>
        
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest ml-1">Purpose</label>
          <select 
            value={filters.purpose}
            onChange={(e) => setFilters(prev => ({ ...prev, purpose: e.target.value }))}
            className="bg-zinc-100 border-2 border-zinc-300 rounded-xl px-4 py-2.5 text-[11px] font-black focus:outline-none focus:ring-2 focus:ring-[var(--neon-blue)] text-zinc-900 shadow-sm transition-all"
          >
            <option value="all">ALL PURPOSES</option>
            <option value="Reading books">READING BOOKS</option>
            <option value="Research for thesis">RESEARCH FOR THESIS</option>
            <option value="Use of computer">USE OF COMPUTER</option>
            <option value="Doing assignments">DOING ASSIGNMENTS</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest ml-1">College</label>
          <select 
            value={filters.college}
            onChange={(e) => setFilters(prev => ({ ...prev, college: e.target.value }))}
            className="bg-zinc-100 border-2 border-zinc-300 rounded-xl px-4 py-2.5 text-[11px] font-black focus:outline-none focus:ring-2 focus:ring-[var(--neon-blue)] text-zinc-900 shadow-sm transition-all"
          >
            <option value="all">ALL COLLEGES</option>
            {COLLEGES.map(c => <option key={c} value={c} className="text-zinc-900">{c.toUpperCase()}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest ml-1">Visitor Type</label>
          <select 
            value={filters.role}
            onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value }))}
            className="bg-zinc-100 border-2 border-zinc-300 rounded-xl px-4 py-2.5 text-[11px] font-black focus:outline-none focus:ring-2 focus:ring-[var(--neon-blue)] text-zinc-900 shadow-sm transition-all"
          >
            <option value="all">ALL TYPES</option>
            <option value="student">STUDENTS</option>
            <option value="faculty">FACULTY</option>
            <option value="staff">STAFF</option>
            <option value="employee">ALL EMPLOYEES (FACULTY/STAFF)</option>
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
                    <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">First Name</label>
                    <input 
                      required
                      type="text" 
                      placeholder="JUAN"
                      className="w-full bg-white dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--neon-blue)] text-[var(--text-primary)]"
                      value={newStudent.firstName}
                      onChange={(e) => setNewStudent(prev => ({ ...prev, firstName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Middle Name</label>
                    <input 
                      type="text" 
                      placeholder="PROTASIO"
                      className="w-full bg-white dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--neon-blue)] text-[var(--text-primary)]"
                      value={newStudent.middleName}
                      onChange={(e) => setNewStudent(prev => ({ ...prev, middleName: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Last Name</label>
                  <input 
                    required
                    type="text" 
                    placeholder="DELA CRUZ"
                    className="w-full bg-white dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--neon-blue)] text-[var(--text-primary)]"
                    value={newStudent.lastName}
                    onChange={(e) => setNewStudent(prev => ({ ...prev, lastName: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">College / Office</label>
                  <select 
                    className="w-full bg-white dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm font-black focus:outline-none focus:ring-2 focus:ring-[var(--neon-blue)] text-[var(--neon-blue)]"
                    value={newStudent.college}
                    onChange={(e) => setNewStudent(prev => ({ ...prev, college: e.target.value }))}
                  >
                    {COLLEGES.map(c => <option key={c} value={c} className="text-[var(--text-primary)]">{c}</option>)}
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
