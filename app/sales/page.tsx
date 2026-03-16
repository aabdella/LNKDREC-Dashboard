'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  BuildingOfficeIcon, 
  RocketLaunchIcon, 
  BriefcaseIcon, 
  UserGroupIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  Cog6ToothIcon,
  XMarkIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import { format, startOfDay, addDays, isWithinInterval, subDays } from 'date-fns';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const BASE_DATE = new Date(2026, 2, 3); // March 3, 2026 (0-indexed month)

export default function SalesDashboard() {
  const [stats, setStats] = useState({
    activePortfolio: 0,
    newLeads: 0,
    deliveryPipeline: 0,
    totalSubmissions: 0
  });
  const [prevStats, setPrevStats] = useState<any>(null);
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [newImpact, setNewImpact] = useState({ type: 'Success', content: '', category: 'General' });
  const [editingImpact, setEditingImpact] = useState<any>(null);
  
  // Period Selection
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState(0);

  const periods = useMemo(() => {
    const p = [];
    let current = startOfDay(BASE_DATE);
    const now = new Date();
    
    // Generate periods until 2 months ahead for planning
    for (let i = 0; i < 12; i++) {
      const start = current;
      const end = addDays(current, 13);
      p.push({
        label: `P${i + 1}: ${format(start, 'MMM d')} - ${format(end, 'MMM d')}`,
        start,
        end
      });
      current = addDays(current, 14);
      if (start > now && i > 4) break; 
    }
    return p;
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedPeriodIdx]);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      const period = periods[selectedPeriodIdx];
      const prevPeriod = selectedPeriodIdx > 0 ? periods[selectedPeriodIdx - 1] : null;

      // 1. Clients (Not period dependent for now, but shown in roster)
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*');
      
      if (clientError) throw clientError;
      const sortedClients = clientData ? [...clientData].sort((a, b) => {
        const order: Record<string, number> = { 'New Lead': 1, 'Active Partner': 2, 'Churned': 3 };
        return (order[a.status] || 99) - (order[b.status] || 99);
      }) : [];
      setClients(sortedClients);

      // 2. Main Stats (Calculate for current period vs previous)
      const fetchStatsForPeriod = async (p: any) => {
        if (!p) return null;
        
        // Active Portfolio & Leads (count at end of period)
        const activeCount = clientData?.filter(c => c.status === 'Active Partner' && new Date(c.created_at || 0) <= p.end).length || 0;
        const leadCount = clientData?.filter(c => c.status === 'New Lead' && new Date(c.created_at || 0) <= p.end).length || 0;

        // Delivery Pipeline
        const { data: jobData } = await supabase
          .from('jobs')
          .select('total_openings')
          .ilike('status', 'open')
          .lte('created_at', p.end.toISOString());
        const totalVacancies = jobData?.reduce((sum, job) => sum + (job.total_openings || 1), 0) || 0;

        // Total Submissions
        const excludedStages = ["Sourced", "Contacted/No Reply", "Rejected"];
        const { count: submissionCount } = await supabase
          .from('candidates')
          .select('*', { count: 'exact', head: true })
          .not('pipeline_stage', 'is', null)
          .not('pipeline_stage', 'in', `(${excludedStages.map(s => `"${s}"`).join(',')})`)
          .gte('created_at', p.start.toISOString())
          .lte('created_at', p.end.toISOString());

        return {
          activePortfolio: activeCount,
          newLeads: leadCount,
          deliveryPipeline: totalVacancies,
          totalSubmissions: submissionCount || 0
        };
      };

      const currentStats = await fetchStatsForPeriod(period);
      const pastStats = prevPeriod ? await fetchStatsForPeriod(prevPeriod) : null;

      if (currentStats) setStats(currentStats);
      setPrevStats(pastStats);

      // 3. Impact Logs
      const { data: logData, error: logError } = await supabase
        .from('impact_logs')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (logError) throw logError;
      setAllLogs(logData || []);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredLogs = useMemo(() => {
    const period = periods[selectedPeriodIdx];
    return allLogs.filter(log => {
      const date = new Date(log.created_at);
      return isWithinInterval(date, { start: period.start, end: period.end });
    });
  }, [allLogs, selectedPeriodIdx, periods]);

  const wins = filteredLogs.filter(l => l.type === 'Success');
  const pivots = filteredLogs.filter(l => l.type === 'Pivot');

  async function handleUpdateClient() {
    if (!editingClient) return;
    const { error } = await supabase
      .from('clients')
      .update({
        status: editingClient.status,
        deal_stage: editingClient.deal_stage,
        next_step: editingClient.next_step
      })
      .eq('id', editingClient.id);

    if (!error) {
      setEditingClient(null);
      fetchDashboardData();
    }
  }

  async function handleAddImpact() {
    if (!newImpact.content) return;
    const period = periods[selectedPeriodIdx];
    
    // If adding to a past period, use a timestamp within that period
    const createdAt = isWithinInterval(new Date(), { start: period.start, end: period.end }) 
      ? new Date().toISOString() 
      : period.end.toISOString();

    const { error } = await supabase
      .from('impact_logs')
      .insert([{ ...newImpact, created_at: createdAt }]);

    if (!error) {
      setNewImpact({ ...newImpact, content: '' });
      fetchDashboardData();
    }
  }

  async function handleDeleteImpact(id: string) {
    if (!window.confirm('Delete this insight?')) return;
    const { error } = await supabase.from('impact_logs').delete().eq('id', id);
    if (!error) fetchDashboardData();
  }

  async function handleUpdateImpact() {
    if (!editingImpact) return;
    const { error } = await supabase
      .from('impact_logs')
      .update({ content: editingImpact.content, type: editingImpact.type })
      .eq('id', editingImpact.id);
    
    if (!error) {
      setEditingImpact(null);
      fetchDashboardData();
    }
  }

  const DeltaBadge = ({ current, previous }: { current: number, previous: number | null }) => {
    if (previous === null || previous === 0) return null;
    const diff = current - previous;
    const pct = Math.round((diff / previous) * 100);
    if (pct === 0) return null;

    return (
      <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
        pct > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
      }`}>
        {pct > 0 ? '+' : ''}{pct}%
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-12 relative">
      {/* Admin Toggle */}
      <button 
        onClick={() => setShowAdmin(!showAdmin)}
        className="fixed bottom-8 right-8 bg-black text-white p-4 rounded-full shadow-2xl hover:scale-110 transition z-50 group"
      >
        {showAdmin ? <XMarkIcon className="h-6 w-6" /> : <Cog6ToothIcon className="h-6 w-6" />}
        <span className="absolute right-full mr-4 bg-black text-white px-3 py-1 rounded text-xs font-bold opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
          {showAdmin ? 'Close Admin' : 'Manage Data'}
        </span>
      </button>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-slate-200 pb-8 mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">LNKD Platform Dashboard</h1>
          <p className="text-slate-500 mt-2 font-medium">Executive Sales & Delivery Overview • Q1 2026</p>
        </div>
        
        <div className="flex flex-col items-end gap-3 w-full md:w-auto">
          <div className="relative group w-full md:w-64">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5 text-right">Reporting Period</label>
            <div className="relative">
              <select 
                value={selectedPeriodIdx}
                onChange={(e) => setSelectedPeriodIdx(parseInt(e.target.value))}
                className="w-full appearance-none bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition cursor-pointer shadow-sm"
              >
                {periods.map((p, i) => (
                  <option key={i} value={i}>{p.label}</option>
                ))}
              </select>
              <ChevronDownIcon className="h-4 w-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Admin Panel Overlay */}
      {showAdmin && (
        <div className="mb-12 bg-slate-900 text-white rounded-3xl p-8 shadow-2xl border border-slate-800 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Cog6ToothIcon className="h-5 w-5 text-indigo-400" />
              Platform Control Center
            </h2>
            <p className="text-xs text-slate-400 italic font-medium">Manage executive insights and client status</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Impact Entry */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-4">Add Executive Insight ({periods[selectedPeriodIdx].label})</h3>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <select 
                    value={newImpact.type}
                    onChange={(e) => setNewImpact({...newImpact, type: e.target.value})}
                    className="appearance-none bg-slate-800 border-none rounded-lg text-sm font-bold px-4 py-2 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Success">Success</option>
                    <option value="Pivot">Pivot</option>
                  </select>
                  <input 
                    type="text" 
                    placeholder="Enter insight content..."
                    value={newImpact.content}
                    onChange={(e) => setNewImpact({...newImpact, content: e.target.value})}
                    className="flex-1 bg-slate-800 border-none rounded-lg text-sm px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <button 
                    onClick={handleAddImpact}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Client Stage Update */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-4">Update Client Status</h3>
              <div className="space-y-4">
                <select 
                  onChange={(e) => {
                    const client = clients.find(c => c.id === e.target.value);
                    setEditingClient(client ? {...client} : null);
                  }}
                  className="appearance-none w-full bg-slate-800 border-none rounded-lg text-sm font-bold px-4 py-2"
                >
                  <option value="">Select a client to edit...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>

                {editingClient && (
                  <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-200">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500">Status</label>
                      <select 
                        value={editingClient.status}
                        onChange={(e) => setEditingClient({...editingClient, status: e.target.value})}
                        className="appearance-none w-full bg-slate-700 border-none rounded-lg text-xs font-bold px-3 py-2"
                      >
                        <option value="Active Partner">Active Partner</option>
                        <option value="New Lead">New Lead</option>
                        <option value="Churned">Churned</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500">Deal Stage</label>
                      <select 
                        value={editingClient.deal_stage}
                        onChange={(e) => setEditingClient({...editingClient, deal_stage: e.target.value})}
                        className="appearance-none w-full bg-slate-700 border-none rounded-lg text-xs font-bold px-3 py-2"
                      >
                        <option value="Discovery">Discovery</option>
                        <option value="Proposal">Proposal</option>
                        <option value="Negotiation">Negotiation</option>
                        <option value="Sourcing">Sourcing</option>
                        <option value="Interviewing">Interviewing</option>
                        <option value="Closing">Closing</option>
                      </select>
                    </div>
                    <div className="col-span-2 space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-500">Next Step</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={editingClient.next_step || ''}
                          onChange={(e) => setEditingClient({...editingClient, next_step: e.target.value})}
                          className="flex-1 bg-slate-700 border-none rounded-lg text-xs px-3 py-2 outline-none"
                        />
                        <button 
                          onClick={handleUpdateClient}
                          className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Impact Modal */}
      {editingImpact && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Edit Insight</h2>
              <button onClick={() => setEditingImpact(null)} className="p-2 hover:bg-slate-50 rounded-full transition">
                <XMarkIcon className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type</label>
                <select 
                  value={editingImpact.type}
                  onChange={(e) => setEditingImpact({...editingImpact, type: e.target.value})}
                  className="w-full appearance-none bg-slate-50 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="Success">Success</option>
                  <option value="Pivot">Pivot</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Content</label>
                <textarea 
                  value={editingImpact.content}
                  onChange={(e) => setEditingImpact({...editingImpact, content: e.target.value})}
                  className="w-full bg-slate-50 border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-600 h-32 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => handleDeleteImpact(editingImpact.id)}
                  className="px-6 py-3 rounded-xl border border-rose-100 text-rose-600 text-sm font-bold hover:bg-rose-50 transition"
                >
                  Delete
                </button>
                <button 
                  onClick={handleUpdateImpact}
                  className="flex-1 bg-slate-900 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-black transition"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Bar Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {[
          { label: 'Active Portfolio', value: stats.activePortfolio, key: 'activePortfolio', detail: 'Engaged Partners', icon: BuildingOfficeIcon },
          { label: 'New Leads', value: stats.newLeads, key: 'newLeads', detail: 'Contract Initiated', icon: RocketLaunchIcon },
          { label: 'Delivery Pipeline', value: stats.deliveryPipeline, key: 'deliveryPipeline', detail: 'Active Vacancies', icon: BriefcaseIcon },
          { label: 'Total Submissions', value: stats.totalSubmissions, key: 'totalSubmissions', detail: 'Vetted Talent Sent', icon: UserGroupIcon },
        ].map((item, idx) => (
          <div key={idx} className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm transition hover:shadow-md">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-slate-50 rounded-lg">
                <item.icon className="h-5 w-5 text-slate-600" />
              </div>
              <DeltaBadge 
                current={item.value} 
                previous={prevStats ? prevStats[item.key as keyof typeof stats] : null} 
              />
            </div>
            <h3 className="text-4xl font-bold text-slate-900 tracking-tighter">{item.value.toString().padStart(2, '0')}</h3>
            <p className="text-xs font-bold text-slate-800 mt-1 uppercase tracking-widest">{item.label}</p>
            <p className="text-[10px] text-slate-400 mt-1 font-medium italic">{item.detail}</p>
          </div>
        ))}
      </div>

      {/* Middle Section: Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        {/* Successes */}
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm group">
          <div className="flex items-center gap-2 mb-6">
            <CheckCircleIcon className="h-5 w-5 text-green-500" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-800">Successes (What Went Well)</h2>
          </div>
          <ul className="space-y-4">
            {wins.length > 0 ? wins.map((win, idx) => (
              <li key={idx} className="flex items-start justify-between group/item p-2 -mx-2 rounded-xl hover:bg-slate-50 transition animate-in fade-in duration-300">
                <div className="flex gap-3 text-slate-600 leading-relaxed text-sm font-medium">
                  <span className="text-green-500 flex-shrink-0 mt-0.5">✓</span> 
                  {win.content}
                </div>
                <button 
                  onClick={() => setEditingImpact(win)}
                  className="p-1.5 opacity-0 group-hover/item:opacity-100 text-slate-400 hover:text-slate-900 transition"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
              </li>
            )) : (
              <li className="text-slate-400 text-sm italic font-medium px-2">No successes logged for this period.</li>
            )}
          </ul>
        </div>

        {/* Pivots */}
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm group">
          <div className="flex items-center gap-2 mb-6">
            <ArrowPathIcon className="h-5 w-5 text-indigo-500" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-800">Pivots (What Didn't Work)</h2>
          </div>
          <ul className="space-y-4">
            {pivots.length > 0 ? pivots.map((pivot, idx) => (
              <li key={idx} className="flex items-start justify-between group/item p-2 -mx-2 rounded-xl hover:bg-slate-50 transition animate-in fade-in duration-300">
                <div className="flex gap-3 text-slate-600 leading-relaxed text-sm font-medium">
                  <span className="text-indigo-500 flex-shrink-0 mt-0.5">→</span> 
                  {pivot.content}
                </div>
                <button 
                  onClick={() => setEditingImpact(pivot)}
                  className="p-1.5 opacity-0 group-hover/item:opacity-100 text-slate-400 hover:text-slate-900 transition"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
              </li>
            )) : (
              <li className="text-slate-400 text-sm italic font-medium px-2">No pivots logged for this period.</li>
            )}
          </ul>
        </div>
      </div>

      {/* Client Roster */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Detailed Client Roster</h2>
          <button className="text-[10px] font-bold text-indigo-600 border border-indigo-100 px-3 py-1.5 rounded-full hover:bg-indigo-50 transition uppercase tracking-widest">
            Export Report
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-fixed">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="w-1/4 px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Client Name</th>
                <th className="w-1/5 px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="w-1/5 px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Deal Stage</th>
                <th className="w-1/3 px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Next Step</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {clients.length > 0 ? clients.map((client, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors duration-150 group">
                  <td className="px-8 py-4 font-bold text-slate-900 group-hover:text-black truncate">{client.name}</td>
                  <td className="px-8 py-4 text-center">
                    <span className={`inline-block whitespace-nowrap px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border ${
                      client.status === 'Active Partner' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-blue-50 text-blue-700 border-blue-100'
                    }`}>
                      {client.status}
                    </span>
                  </td>
                  <td className="px-8 py-4 text-sm font-bold text-slate-600 italic tracking-tight truncate">{client.deal_stage}</td>
                  <td className="px-8 py-4">
                    <p className="text-xs font-medium text-slate-500 leading-snug line-clamp-2 overflow-hidden">
                      {client.next_step || '—'}
                    </p>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-8 py-12 text-center text-slate-400 font-medium italic">No client data found in Supabase.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
