'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  BuildingOfficeIcon, 
  RocketLaunchIcon, 
  BriefcaseIcon, 
  UserGroupIcon,
  CheckCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function SalesDashboard() {
  const [stats, setStats] = useState({
    activePortfolio: 0,
    newLeads: 0,
    deliveryPipeline: 0,
    totalSubmissions: 0
  });
  const [wins, setWins] = useState<any[]>([]);
  const [pivots, setPivots] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      // 1. Fetch Clients
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .order('name', { ascending: true });
      
      if (clientError) throw clientError;
      setClients(clientData || []);

      // 2. Fetch Jobs for Delivery Pipeline count
      const { count: jobCount, error: jobError } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open');
      
      if (jobError) throw jobError;

      // 3. Fetch Impact Logs
      const { data: logData, error: logError } = await supabase
        .from('impact_logs')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (logError) throw logError;

      // 4. Fetch Candidates for Submissions count (Vetted + Assigned)
      const { count: submissionCount, error: subError } = await supabase
        .from('candidates')
        .select('*', { count: 'exact', head: true })
        .not('pipeline_stage', 'is', null);

      if (subError) throw subError;

      // Process Stats
      const active = clientData?.filter(c => c.status === 'Active Partner').length || 0;
      const leads = clientData?.filter(c => c.status === 'New Lead').length || 0;

      setStats({
        activePortfolio: active,
        newLeads: leads,
        deliveryPipeline: jobCount || 0,
        totalSubmissions: submissionCount || 0
      });

      setWins(logData?.filter(l => l.type === 'Success').slice(0, 5) || []);
      setPivots(logData?.filter(l => l.type === 'Pivot').slice(0, 5) || []);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="flex justify-between items-end border-b border-slate-200 pb-8 mb-12">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">LNKD Brain Dashboard</h1>
          <p className="text-slate-500 mt-2 font-medium">Executive Sales & Delivery Overview • Q1 2026</p>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">System Status</p>
          <div className="flex items-center gap-2 mt-1 justify-end">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
            <p className="text-sm font-semibold text-slate-700 uppercase tracking-tight">Live</p>
          </div>
        </div>
      </div>

      {/* Top Bar Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {[
          { label: 'Active Portfolio', value: stats.activePortfolio, detail: 'Engaged Partners', icon: BuildingOfficeIcon },
          { label: 'New Leads', value: stats.newLeads, detail: 'Contract Initiated', icon: RocketLaunchIcon },
          { label: 'Delivery Pipeline', value: stats.deliveryPipeline, detail: 'Active Vacancies', icon: BriefcaseIcon },
          { label: 'Total Submissions', value: stats.totalSubmissions, detail: 'Vetted Talent Sent', icon: UserGroupIcon },
        ].map((item, idx) => (
          <div key={idx} className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm transition hover:shadow-md">
            <div className="p-2 bg-slate-50 rounded-lg w-fit mb-4">
              <item.icon className="h-5 w-5 text-slate-600" />
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
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <CheckCircleIcon className="h-5 w-5 text-green-500" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-800">Successes (What Went Well)</h2>
          </div>
          <ul className="space-y-4">
            {wins.length > 0 ? wins.map((win, idx) => (
              <li key={idx} className="flex gap-3 text-slate-600 leading-relaxed text-sm font-medium">
                <span className="text-green-500 flex-shrink-0">✓</span> {win.content}
              </li>
            )) : (
              <li className="text-slate-400 text-sm italic font-medium">No successes logged for this period.</li>
            )}
          </ul>
        </div>

        {/* Pivots */}
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <ArrowPathIcon className="h-5 w-5 text-indigo-500" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-800">Pivots (What Didn't Work)</h2>
          </div>
          <ul className="space-y-4">
            {pivots.length > 0 ? pivots.map((pivot, idx) => (
              <li key={idx} className="flex gap-3 text-slate-600 leading-relaxed text-sm font-medium">
                <span className="text-indigo-500 flex-shrink-0">→</span> {pivot.content}
              </li>
            )) : (
              <li className="text-slate-400 text-sm italic font-medium">No pivots logged for this period.</li>
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
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Client Name</th>
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Deal Stage</th>
                <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Next Step</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {clients.length > 0 ? clients.map((client, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors duration-150 group">
                  <td className="px-8 py-5 font-bold text-slate-900 group-hover:text-black">{client.name}</td>
                  <td className="px-8 py-5">
                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest ${
                      client.status === 'Active Partner' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-blue-50 text-blue-700 border border-blue-100'
                    }`}>
                      {client.status}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-sm font-bold text-slate-600 italic tracking-tight">{client.deal_stage}</td>
                  <td className="px-8 py-5 text-sm font-medium text-slate-500 leading-snug">{client.next_step || '—'}</td>
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
