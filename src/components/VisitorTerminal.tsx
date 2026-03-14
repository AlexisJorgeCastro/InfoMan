import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CreditCard, Mail, CheckCircle2, AlertCircle, Clock, BookOpen, Search, Monitor, PenTool } from 'lucide-react';
import { format } from 'date-fns';

const PURPOSES = [
  { id: 'reading', label: 'Reading books', icon: BookOpen },
  { id: 'thesis', label: 'Research for thesis', icon: Search },
  { id: 'computer', label: 'Use of computer', icon: Monitor },
  { id: 'assignment', label: 'Doing assignments', icon: PenTool },
];

export default function VisitorTerminal() {
  const [step, setStep] = React.useState<'idle' | 'identifying' | 'purpose' | 'welcome'>('idle');
  const [visitor, setVisitor] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [rfidInput, setRfidInput] = React.useState('');

  const identifyVisitor = async (data: { rfid_tag?: string; email?: string }) => {
    setError(null);
    setStep('identifying');
    try {
      const res = await fetch('/api/visitor/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Identification failed');
      }
      
      const visitorData = await res.json();
      setVisitor(visitorData);
      setStep('purpose');
    } catch (err: any) {
      setError(err.message);
      setStep('idle');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleLogEntry = async (purpose: string) => {
    try {
      await fetch('/api/visitor/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitor_id: visitor.id, purpose })
      });
      setVisitor({ ...visitor, purpose });
      setStep('welcome');
      setTimeout(() => {
        setStep('idle');
        setVisitor(null);
        setRfidInput('');
      }, 5000);
    } catch (err) {
      setError('Failed to record entry');
    }
  };

  const simulateRfid = (e: React.FormEvent) => {
    e.preventDefault();
    if (rfidInput) identifyVisitor({ rfid_tag: rfidInput });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-2xl">
        <AnimatePresence mode="wait">
          {step === 'idle' && (
            <motion.div 
              key="idle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center"
            >
              <div className="mb-12">
                <h1 className="text-5xl font-bold tracking-tighter mb-4">NEU LIBRARY</h1>
                <p className="text-zinc-500 text-lg">Please tap your ID or sign in with Google</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-3xl hover:border-zinc-700 transition-colors group">
                  <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                    <CreditCard size={32} />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">RFID Login</h3>
                  <p className="text-zinc-500 text-sm mb-6">Tap your NEU School ID on the reader</p>
                  <form onSubmit={simulateRfid}>
                    <input 
                      type="text" 
                      placeholder="Enter ID for simulation..."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={rfidInput}
                      onChange={(e) => setRfidInput(e.target.value)}
                    />
                    <button type="submit" className="hidden">Submit</button>
                  </form>
                </div>

                <button 
                  onClick={() => identifyVisitor({ email: 'juan.delacruz@neu.edu.ph' })}
                  className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-3xl hover:border-zinc-700 transition-colors group text-center"
                >
                  <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                    <Mail size={32} />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Google Login</h3>
                  <p className="text-zinc-500 text-sm">Sign in with your institutional email</p>
                </button>
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-8 p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center justify-center gap-2"
                >
                  <AlertCircle size={20} />
                  {error}
                </motion.div>
              )}
            </motion.div>
          )}

          {step === 'identifying' && (
            <motion.div 
              key="identifying"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <div className="w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-8"></div>
              <h2 className="text-2xl font-bold">Identifying...</h2>
              <p className="text-zinc-500 mt-2">Verifying your credentials with NEU database</p>
            </motion.div>
          )}

          {step === 'purpose' && visitor && (
            <motion.div 
              key="purpose"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="bg-zinc-900 border border-zinc-800 p-10 rounded-[2.5rem] shadow-2xl"
            >
              <div className="flex items-center gap-6 mb-10">
                <div className="w-20 h-20 bg-zinc-800 rounded-3xl flex items-center justify-center text-3xl font-bold text-blue-500">
                  {visitor.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-3xl font-bold">{visitor.name}</h2>
                  <p className="text-zinc-500">{visitor.college}</p>
                  <div className="flex items-center gap-2 text-zinc-400 text-sm mt-1">
                    <Clock size={14} />
                    {format(new Date(), 'p')}
                  </div>
                </div>
              </div>

              <h3 className="text-xl font-semibold mb-6">What is your purpose of visit?</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {PURPOSES.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleLogEntry(p.label)}
                    className="flex items-center gap-4 p-5 bg-zinc-950 border border-zinc-800 rounded-2xl hover:bg-blue-600 hover:border-blue-500 transition-all text-left group"
                  >
                    <div className="p-3 bg-zinc-900 rounded-xl group-hover:bg-blue-500 transition-colors">
                      <p.icon size={24} />
                    </div>
                    <span className="font-medium">{p.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 'welcome' && visitor && (
            <motion.div 
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <div className="w-24 h-24 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_50px_rgba(16,185,129,0.3)]">
                <CheckCircle2 size={48} />
              </div>
              <h1 className="text-5xl font-bold mb-4">Welcome to NEU Library!</h1>
              <p className="text-zinc-500 text-xl mb-12">Your entry has been recorded successfully.</p>
              
              <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl text-left max-w-md mx-auto">
                <div className="space-y-4">
                  <div className="flex justify-between border-b border-zinc-800 pb-3">
                    <span className="text-zinc-500">Visitor</span>
                    <span className="font-medium">{visitor.name}</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-800 pb-3">
                    <span className="text-zinc-500">College</span>
                    <span className="font-medium">{visitor.college}</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-800 pb-3">
                    <span className="text-zinc-500">Purpose</span>
                    <span className="font-medium">{visitor.purpose}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Time</span>
                    <span className="font-medium">{format(new Date(), 'p')}</span>
                  </div>
                </div>
              </div>
              <p className="mt-8 text-zinc-600 animate-pulse">Returning to home in 5 seconds...</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
