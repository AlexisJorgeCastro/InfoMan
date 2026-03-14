import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend 
} from 'recharts';
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { Download, Search, Shield, ShieldAlert, Users, Calendar, Filter, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

interface VisitorLog {
  id: number;
  visitor_id: number;
  name: string;
  college: string;
  role: string;
  purpose: string;
  timestamp: string;
  is_blocked: number;
}

export default function AdminDashboard() {
  const [logs, setLogs] = React.useState<VisitorLog[]>([]);
  const [stats, setStats] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [dateRange, setDateRange] = React.useState({ start: '', end: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [logsRes, statsRes] = await Promise.all([
        fetch('/api/admin/logs'),
        fetch(`/api/admin/stats${dateRange.start ? `?start=${dateRange.start}&end=${dateRange.end}` : ''}`)
      ]);
      const logsData = await logsRes.json();
      const statsData = await statsRes.json();
      setLogs(logsData);
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, [dateRange]);

  const toggleBlock = async (visitorId: number, currentStatus: number) => {
    try {
      await fetch('/api/admin/visitor/toggle-block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitor_id: visitorId, is_blocked: !currentStatus })
      });
      fetchData();
    } catch (error) {
      console.error('Error toggling block:', error);
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('NEU Library Visitor Report', 14, 22);
    doc.setFontSize(11);
    doc.text(`Generated on: ${format(new Date(), 'PPP p')}`, 14, 30);
    doc.text(`Total Visitors: ${stats?.total || 0}`, 14, 38);

    const tableData = logs.map(log => [
      log.name,
      log.college,
      log.purpose,
      format(new Date(log.timestamp), 'MMM dd, yyyy p')
    ]);

    autoTable(doc, {
      startY: 45,
      head: [['Name', 'College/Office', 'Purpose', 'Date & Time']],
      body: tableData,
    });

    doc.save(`NEU_Library_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const filteredLogs = logs.filter(log => 
    log.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.college.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.purpose.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && !stats) return <div className="p-8 text-center">Loading dashboard...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-slate-500">Monitor library visitor activity and statistics</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={generatePDF}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Download size={18} />
            Export PDF
          </button>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Users size={24} />
            </div>
          </div>
          <h3 className="text-slate-500 text-sm font-medium">Total Visitors</h3>
          <p className="text-2xl font-bold text-slate-900">{stats?.total || 0}</p>
        </div>
        {/* Add more cards if needed */}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold mb-6">Visitor Traffic (Daily)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats?.dailyStats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" fontSize={12} tickFormatter={(val) => format(new Date(val), 'MMM d')} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#0088FE" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold mb-6">Purpose of Visit</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats?.byPurpose}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="count"
                  nameKey="purpose"
                >
                  {stats?.byPurpose.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-bottom border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-lg font-semibold">Recent Visitor Logs</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Search visitors..."
              className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">Visitor</th>
                <th className="px-6 py-4 font-medium">College/Office</th>
                <th className="px-6 py-4 font-medium">Purpose</th>
                <th className="px-6 py-4 font-medium">Time</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{log.name}</div>
                    <div className="text-xs text-slate-500">{log.role}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{log.college}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                      {log.purpose}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-sm">
                    {format(new Date(log.timestamp), 'MMM dd, p')}
                  </td>
                  <td className="px-6 py-4">
                    {log.is_blocked ? (
                      <span className="flex items-center gap-1 text-red-600 text-xs font-bold uppercase">
                        <ShieldAlert size={14} /> Blocked
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-emerald-600 text-xs font-bold uppercase">
                        <Shield size={14} /> Active
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => toggleBlock(log.visitor_id, log.is_blocked)}
                      className={`text-sm font-medium ${log.is_blocked ? 'text-emerald-600 hover:text-emerald-700' : 'text-red-600 hover:text-red-700'}`}
                    >
                      {log.is_blocked ? 'Unblock' : 'Block'}
                    </button>
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
