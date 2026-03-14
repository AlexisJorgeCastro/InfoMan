import React from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, LineChart, Line 
} from 'recharts';
import { Shield, ShieldAlert, Download, Users, Calendar, Filter, Activity, LogIn } from 'lucide-react';
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
  addDoc
} from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from 'firebase/auth';
import { db, auth } from './firebase';

const CHART_COLORS = ['#1e40af', '#166534', '#92400e', '#991b1b', '#5b21b6'];

const COLLEGES = [
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
  const [user, setUser] = React.useState<any>(null);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [showRegisterModal, setShowRegisterModal] = React.useState(false);
  const [newStudent, setNewStudent] = React.useState({ name: '', email: '', rfid_tag: '', college: COLLEGES[0] });
  const [registering, setRegistering] = React.useState(false);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Check if admin
        const adminEmail = "alexis.castro@neu.edu.ph";
        if (u.email === adminEmail) {
          setIsAdmin(true);
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

      // Calculate Stats
      let filteredLogs = allLogs;
      const now = new Date();
      const todayStart = startOfDay(now);

      if (period === 'today') {
        filteredLogs = allLogs.filter(l => l.timestamp >= todayStart);
      } else if (period === 'week') {
        filteredLogs = allLogs.filter(l => l.timestamp >= subDays(todayStart, 7));
      } else if (period === 'month') {
        filteredLogs = allLogs.filter(l => l.timestamp >= subDays(todayStart, 30));
      } else if (period === 'custom' && dateRange.start && dateRange.end) {
        const start = new Date(dateRange.start);
        const end = new Date(dateRange.end);
        end.setHours(23, 59, 59, 999);
        filteredLogs = allLogs.filter(l => isWithinInterval(l.timestamp, { start, end }));
      }

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
  }, [period, dateRange, isAdmin]);

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
    <div className="min-h-screen flex items-center justify-center bg-[#050505] p-4">
      <div className="stat-card p-12 rounded-[3rem] text-center max-w-md w-full">
        <ShieldAlert size={64} className="text-[var(--neon-red)] mx-auto mb-8" />
        <h1 className="text-3xl font-black mb-4 glow-text">ACCESS DENIED</h1>
        <p className="text-[var(--text-secondary)] text-sm mb-8 uppercase tracking-widest">Admin Privileges Required</p>
        {!user ? (
          <button 
            onClick={login}
            className="w-full bg-[var(--neon-blue)] text-black py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3"
          >
            <LogIn size={20} /> Admin Login
          </button>
        ) : (
          <p className="text-[var(--neon-red)] text-xs font-bold">Logged in as {user.email}. This account is not authorized.</p>
        )}
      </div>
    </div>
  );

  const seedData = async () => {
    if (!isAdmin) return;
    const visitors = [
      { name: "Juan Dela Cruz", email: "juan.delacruz@neu.edu.ph", rfid_tag: "RFID12345", college: "College of Computer Studies", role: "student", is_blocked: false, created_at: Timestamp.now() },
      { name: "Maria Clara", email: "maria.clara@neu.edu.ph", rfid_tag: "RFID67890", college: "College of Arts and Sciences", role: "faculty", is_blocked: false, created_at: Timestamp.now() },
      { name: "Jose Rizal", email: "jose.rizal@neu.edu.ph", rfid_tag: "2024-00001", college: "College of Education", role: "student", is_blocked: false, created_at: Timestamp.now() },
      { name: "Andres Bonifacio", email: "andres.b@neu.edu.ph", rfid_tag: "2024-00002", college: "College of Law", role: "student", is_blocked: false, created_at: Timestamp.now() }
    ];

    try {
      for (const v of visitors) {
        const q = query(collection(db, 'visitors'), where('email', '==', v.email));
        const snap = await getDocs(q);
        if (snap.empty) {
          await addDoc(collection(db, 'visitors'), v);
        }
      }
      alert("Seed Data Added Successfully!");
      fetchData();
    } catch (err: any) {
      alert("Seed Failed: " + err.message);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setRegistering(true);

    try {
      // Check if email or RFID already exists
      const emailQ = query(collection(db, 'visitors'), where('email', '==', newStudent.email));
      const rfidQ = query(collection(db, 'visitors'), where('rfid_tag', '==', newStudent.rfid_tag));
      
      const [emailSnap, rfidSnap] = await Promise.all([getDocs(emailQ), getDocs(rfidQ)]);

      if (!emailSnap.empty) throw new Error("Email already registered");
      if (!rfidSnap.empty) throw new Error("RFID/Student Number already registered");

      await addDoc(collection(db, 'visitors'), {
        ...newStudent,
        role: 'student',
        is_blocked: false,
        created_at: Timestamp.now()
      });

      alert("Student Registered Successfully!");
      setShowRegisterModal(false);
      setNewStudent({ name: '', email: '', rfid_tag: '', college: COLLEGES[0] });
    } catch (err: any) {
      alert("Registration Failed: " + err.message);
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
    doc.text('DETAILED VISITOR LOGS', 14, 20);
    const logData = logs.map(l => [
      l.name,
      l.college,
      l.purpose,
      format(new Date(l.timestamp), 'MMM dd, yyyy p')
    ]);
    
    autoTable(doc, {
      startY: 25,
      head: [['Name', 'College/Office', 'Purpose', 'Timestamp']],
      body: logData,
    });

    doc.save(`NEU_Library_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <div className="p-4 md:p-8 min-h-screen text-[var(--text-primary)]">
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
            onClick={seedData}
            className="stat-card px-6 py-2 rounded-full flex items-center gap-2 text-[var(--neon-green)] font-bold text-xs hover:bg-[var(--neon-green)] hover:text-black transition-all"
          >
            <Activity size={16} /> SEED DATA
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="stat-card p-6 rounded-3xl">
          <div className="flex justify-between items-start">
            <h3 className="text-[10px] text-[var(--text-secondary)] uppercase mb-2 font-bold">Total Logs</h3>
            <Users size={16} className="text-[var(--neon-blue)]" />
          </div>
          <p className="text-4xl font-black text-[var(--neon-blue)]">{stats.total}</p>
        </div>
        <div className="stat-card p-6 rounded-3xl">
          <div className="flex justify-between items-start">
            <h3 className="text-[10px] text-[var(--text-secondary)] uppercase mb-2 font-bold">Live Visitors</h3>
            <Activity size={16} className="text-[var(--neon-green)] animate-pulse" />
          </div>
          <p className="text-4xl font-black text-[var(--neon-green)]">{stats.liveCount}</p>
        </div>
        <div className="stat-card p-6 rounded-3xl md:col-span-2">
          <h3 className="text-[10px] text-[var(--text-secondary)] uppercase mb-2 font-bold">Traffic Trend</h3>
          <div className="h-16">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.dailyStats}>
                <Line type="monotone" dataKey="count" stroke="var(--neon-blue)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
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

      {/* Registration Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="stat-card p-8 rounded-[2.5rem] w-full max-w-md animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-black mb-6 glow-text uppercase tracking-widest">Register New Student</h2>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Full Name</label>
                <input 
                  required
                  type="text" 
                  placeholder="JUAN DELA CRUZ"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--neon-blue)]"
                  value={newStudent.name}
                  onChange={(e) => setNewStudent(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Institutional Email</label>
                <input 
                  required
                  type="email" 
                  placeholder="juan.delacruz@neu.edu.ph"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--neon-blue)]"
                  value={newStudent.email}
                  onChange={(e) => setNewStudent(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">RFID / Student Number</label>
                <input 
                  required
                  type="text" 
                  placeholder="2024-00001"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--neon-blue)]"
                  value={newStudent.rfid_tag}
                  onChange={(e) => setNewStudent(prev => ({ ...prev, rfid_tag: e.target.value }))}
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
                  {registering ? "REGISTERING..." : "CONFIRM REGISTRATION"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="stat-card rounded-3xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800/50">
          <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--neon-blue)]">Visitor Activity Logs</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-zinc-800/20 text-[var(--neon-blue)] text-[10px] uppercase">
              <tr>
                <th className="p-4">Visitor Identity</th>
                <th className="p-4">College/Office</th>
                <th className="p-4">Purpose</th>
                <th className="p-4">Timestamp</th>
                <th className="p-4">Security Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/30">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-zinc-500/5 transition-colors">
                  <td className="p-4 font-bold text-sm uppercase text-[var(--text-primary)]">{log.name}</td>
                  <td className="p-4 text-[var(--text-secondary)] uppercase text-[10px]">{log.college}</td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-[var(--tag-bg)] rounded text-[10px] font-bold text-[var(--neon-blue)]">{log.purpose}</span>
                  </td>
                  <td className="p-4 text-[var(--text-secondary)] text-[10px]">{format(new Date(log.timestamp), 'MMM dd, p')}</td>
                  <td className="p-4">
                    {log.is_blocked ? 
                      <span className="text-[var(--neon-red)] flex items-center gap-1 text-[10px] font-bold tracking-tighter"><ShieldAlert size={14}/> BLOCKED</span> : 
                      <span className="text-[var(--neon-green)] flex items-center gap-1 text-[10px] font-bold tracking-tighter"><Shield size={14}/> AUTHORIZED</span>
                    }
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
