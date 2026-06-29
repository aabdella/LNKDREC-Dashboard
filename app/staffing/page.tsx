'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  PlusIcon, XMarkIcon, CheckCircleIcon, ExclamationCircleIcon,
  MagnifyingGlassIcon, UserGroupIcon, ArrowDownTrayIcon,
  ChevronLeftIcon, TrashIcon,
} from '@heroicons/react/24/outline';
import { OFFERINGS, getOfferingsForType, getOffering, type Offering, type ProjectType } from '@/lib/staffing/offerings';
import { calculateMemberCost, calculateTeamBudget, HOURS_PER_MONTH, type TeamMemberCost } from '@/lib/staffing/calculations';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

interface Client { id: string; name: string; contact_name?: string; contact_email?: string; notes?: string; created_at: string; }
interface Project { id: string; client_id: string | null; title: string; description?: string; project_type: ProjectType; offering_key: string; status: string; start_date?: string; end_date?: string; created_at: string; client?: Client; }
interface ProjectTeam { id: string; project_id: string; name: string; overhead_multiplier: number; blended_sell_rate: number | null; hours_per_month: number; notes?: string; }
interface TeamMember { id: string; team_id: string; candidate_id: string; role_on_project: string; allocation_pct: number; outsourcing_salary_usd: number; hours_per_month: number | null; candidate?: { id: string; full_name: string; title?: string; current_salary?: number; }; }
interface Candidate { id: string; full_name: string; title?: string; current_salary?: number; is_vetted?: boolean; }

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  proposed: 'bg-blue-50 text-blue-700 border-blue-100',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  on_hold: 'bg-amber-50 text-amber-700 border-amber-100',
  completed: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  lost: 'bg-rose-50 text-rose-600 border-rose-100',
};

const PROJECT_TYPE_LABELS: Record<ProjectType, string> = { feature: 'Feature', module: 'Module', full_solution: 'Full Solution' };

function exportBudgetCSV(
  project: Project,
  team: ProjectTeam,
  memberCosts: TeamMemberCost[],
  blendedSellRate: number
) {
  const headers = ['Name', 'Role', 'Alloc %', 'Cost/hr (USD)', 'Loaded/hr (USD)', 'Hours/mo', 'Monthly Cost (USD)'];
  const rows = memberCosts.map((m) => [
    m.candidateName, m.role, m.allocationPct + '%',
    m.costPerHour.toFixed(2), m.loadedCostPerHour.toFixed(2),
    String(m.monthlyHours), m.monthlyCost.toFixed(2),
  ]);
  const budget = calculateTeamBudget(memberCosts, blendedSellRate, team.hours_per_month);
  rows.push(['TOTALS', '', '', '', '', String(budget.totalMonthlyHours), budget.totalMonthlyCost.toFixed(2)]);
  rows.push(['Revenue', '', '', '', '', '', budget.monthlyRevenue.toFixed(2)]);
  rows.push(['Margin ($)', '', '', '', '', '', budget.monthlyMargin.toFixed(2)]);
  rows.push(['Margin (%)', '', '', '', '', '', budget.marginPct.toFixed(1) + '%']);
  const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = project.title.replace(/\s+/g, '_') + '_budget.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function StaffingPage() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectTeam, setProjectTeam] = useState<ProjectTeam | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [newProject, setNewProject] = useState({ clientId: '', newClientName: '', title: '', description: '', projectType: 'feature' as ProjectType, offeringKey: '' });
  const [saving, setSaving] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [candidateResults, setCandidateResults] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [newMember, setNewMember] = useState({ role: '', allocationPct: 100, outsourcingSalaryUsd: 0, hoursPerMonth: '' });
  const [overhead, setOverhead] = useState(1.3);
  const [blendedRate, setBlendedRate] = useState(0);
  const [teamHours, setTeamHours] = useState(160);

  // Fetch projects + clients
  const fetchProjects = useCallback(async () => {
    setLoading(true);
    const { data: proj } = await supabase.from('projects').select('*, client:clients(id, name)').order('created_at', { ascending: false });
    const { data: cli } = await supabase.from('clients').select('*').order('name');
    setProjects(proj || []);
    setClients(cli || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  // Load project detail
  const loadProjectDetail = useCallback(async (projectId: string) => {
    const { data: proj } = await supabase.from('projects').select('*, client:clients(id, name)').eq('id', projectId).single();
    setSelectedProject(proj);
    const { data: teams } = await supabase.from('project_teams').select('*').eq('project_id', projectId).limit(1);
    const team = teams?.[0] || null;
    setProjectTeam(team);
    if (team) {
      setOverhead(team.overhead_multiplier);
      setBlendedRate(team.blended_sell_rate || 0);
      setTeamHours(team.hours_per_month);
      const { data: members } = await supabase.from('team_members').select('*, candidate:candidates(id, full_name, title)').eq('team_id', team.id);
      setTeamMembers(members || []);
    } else {
      setTeamMembers([]);
    }
  }, [supabase]);

  useEffect(() => { if (selectedProjectId) loadProjectDetail(selectedProjectId); }, [selectedProjectId, loadProjectDetail]);

  // Create project
  const handleCreateProject = async () => {
    setSaving(true);
    let clientId = newProject.clientId;
    if (!clientId && newProject.newClientName.trim()) {
      const { data: newCli } = await supabase.from('clients').insert({ name: newProject.newClientName.trim() }).select().single();
      if (newCli) clientId = newCli.id;
    }
    const { data: proj } = await supabase.from('projects').insert({
      client_id: clientId || null, title: newProject.title, description: newProject.description || null,
      project_type: newProject.projectType, offering_key: newProject.offeringKey, status: 'draft',
    }).select().single();
    if (proj) {
      await supabase.from('project_teams').insert({ project_id: proj.id, name: 'Default Team', overhead_multiplier: 1.30, hours_per_month: 160 });
    }
    setShowCreateProject(false);
    setNewProject({ clientId: '', newClientName: '', title: '', description: '', projectType: 'feature', offeringKey: '' });
    setSaving(false);
    fetchProjects();
  };

  // Update team settings
  const saveTeamSettings = useCallback(async (oh: number, rate: number, hrs: number) => {
    if (!projectTeam) return;
    await supabase.from('project_teams').update({ overhead_multiplier: oh, blended_sell_rate: rate, hours_per_month: hrs }).eq('id', projectTeam.id);
  }, [supabase, projectTeam]);

  // Search candidates
  const searchCandidates = async (q: string) => {
    setCandidateSearch(q);
    if (q.length < 2) { 
      // If search is cleared, reload initial list
      if (q.length === 0) {
        loadInitialCandidates();
      } else {
        setCandidateResults([]); 
      }
      return; 
    }
    // Search by full_name, then fetch latest vetting salary for matched candidates
    const { data: cands, error } = await supabase
      .from('candidates')
      .select('id, full_name, title, status')
      .ilike('full_name', `%${q}%`)
      .order('full_name', { ascending: true })
      .limit(20);
    
    if (error) {
      console.error('Candidate search error:', error);
      setCandidateResults([]);
      return;
    }
    
    if (!cands || cands.length === 0) { setCandidateResults([]); return; }
    // Fetch latest vetting expected_salary for these candidates
    const ids = cands.map((c) => c.id);
    const { data: vettings } = await supabase
      .from('vettings')
      .select('candidate_id, expected_salary')
      .in('candidate_id', ids)
      .order('vetted_at', { ascending: false });
    // Map latest expected salary per candidate + track who's vetted
    const salaryMap: Record<string, number> = {};
    const vettedIds = new Set<string>();
    (vettings || []).forEach((v) => {
      vettedIds.add(v.candidate_id);
      if (!(v.candidate_id in salaryMap) && v.expected_salary) {
        salaryMap[v.candidate_id] = v.expected_salary * 12; // monthly → annual
      }
    });
    // Sort: vetted candidates first, then alphabetical
    const results = cands
      .map((c) => ({ ...c, current_salary: salaryMap[c.id], is_vetted: vettedIds.has(c.id) }))
      .sort((a, b) => {
        if (a.is_vetted && !b.is_vetted) return -1;
        if (!a.is_vetted && b.is_vetted) return 1;
        return a.full_name.localeCompare(b.full_name);
      })
      .slice(0, 10);
    setCandidateResults(results);
  };

  // Load initial candidates when modal opens
  const loadInitialCandidates = async () => {
    const { data: cands, error } = await supabase
      .from('candidates')
      .select('id, full_name, title, status')
      .order('full_name', { ascending: true })
      .limit(10);
    
    if (error) {
      console.error('Load candidates error:', error);
      return;
    }
    
    if (!cands || cands.length === 0) { return; }
    
    // Fetch latest vetting expected_salary for these candidates
    const ids = cands.map((c) => c.id);
    const { data: vettings } = await supabase
      .from('vettings')
      .select('candidate_id, expected_salary')
      .in('candidate_id', ids)
      .order('vetted_at', { ascending: false });
    
    const salaryMap: Record<string, number> = {};
    const vettedIds = new Set<string>();
    (vettings || []).forEach((v) => {
      vettedIds.add(v.candidate_id);
      if (!(v.candidate_id in salaryMap) && v.expected_salary) {
        salaryMap[v.candidate_id] = v.expected_salary * 12; // monthly → annual
      }
    });
    
    const results = cands
      .map((c) => ({ ...c, current_salary: salaryMap[c.id], is_vetted: vettedIds.has(c.id) }))
      .sort((a, b) => {
        if (a.is_vetted && !b.is_vetted) return -1;
        if (!a.is_vetted && b.is_vetted) return 1;
        return a.full_name.localeCompare(b.full_name);
      });
    setCandidateResults(results);
  };

  // Load candidates when modal opens
  useEffect(() => {
    if (showAddMember) {
      loadInitialCandidates();
    } else {
      setCandidateResults([]);
      setCandidateSearch('');
      setSelectedCandidate(null);
    }
  }, [showAddMember]);

  // Add member
  const handleAddMember = async () => {
    if (!selectedCandidate || !projectTeam) return;
    setSaving(true);
    await supabase.from('team_members').insert({
      team_id: projectTeam.id, candidate_id: selectedCandidate.id,
      role_on_project: newMember.role, allocation_pct: newMember.allocationPct,
      outsourcing_salary_usd: newMember.outsourcingSalaryUsd,
      hours_per_month: newMember.hoursPerMonth ? parseInt(newMember.hoursPerMonth) : null,
    });
    setShowAddMember(false);
    setSelectedCandidate(null);
    setNewMember({ role: '', allocationPct: 100, outsourcingSalaryUsd: 0, hoursPerMonth: '' });
    setCandidateSearch('');
    setCandidateResults([]);
    setSaving(false);
    loadProjectDetail(selectedProjectId!);
  };

  // Remove member
  const handleRemoveMember = async (memberId: string) => {
    await supabase.from('team_members').delete().eq('id', memberId);
    loadProjectDetail(selectedProjectId!);
  };

  // Update project status
  const updateStatus = async (status: string) => {
    if (!selectedProject) return;
    await supabase.from('projects').update({ status }).eq('id', selectedProject.id);
    loadProjectDetail(selectedProjectId!);
    fetchProjects();
  };

  // Compute member costs
  const memberCosts: TeamMemberCost[] = useMemo(() => {
    if (!projectTeam) return [];
    return teamMembers.map((m) => {
      const calc = calculateMemberCost(m.outsourcing_salary_usd, m.allocation_pct, overhead, m.hours_per_month);
      return {
        candidateId: m.candidate_id, candidateName: m.candidate?.full_name || 'Unknown',
        role: m.role_on_project, allocationPct: m.allocation_pct,
        outsourcingSalaryUsd: m.outsourcing_salary_usd, hoursPerMonth: m.hours_per_month,
        costPerHour: calc.costPerHour, loadedCostPerHour: calc.loadedCostPerHour,
        monthlyHours: calc.monthlyHours, monthlyCost: calc.monthlyCost,
      };
    });
  }, [teamMembers, overhead, projectTeam]);

  const budgetSummary = useMemo(() => {
    if (!memberCosts.length) return null;
    return calculateTeamBudget(memberCosts, blendedRate, teamHours);
  }, [memberCosts, blendedRate, teamHours]);

  // Staffing validation
  const offering = selectedProject ? getOffering(selectedProject.offering_key) : null;
  const roleValidation = useMemo(() => {
    if (!offering || !offering.requiredRoles.length) return null;
    return offering.requiredRoles.map((req) => {
      const filled = teamMembers.filter((m) => m.role_on_project.toLowerCase() === req.role.toLowerCase()).length;
      return { role: req.role, required: req.count, filled, met: filled >= req.count };
    });
  }, [offering, teamMembers]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    let list = projects;
    if (statusFilter !== 'all') list = list.filter((p) => p.status === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => p.title.toLowerCase().includes(q) || (p.client as any)?.name?.toLowerCase().includes(q));
    }
    return list;
  }, [projects, statusFilter, searchQuery]);

  // Available offerings for new project type
  const availableOfferings = useMemo(() => getOfferingsForType(newProject.projectType), [newProject.projectType]);

  // ─── PROJECT DETAIL VIEW ───
  if (selectedProjectId && selectedProject) {
    const marginColor = budgetSummary
      ? budgetSummary.marginPct > 30 ? 'text-emerald-600' : budgetSummary.marginPct > 15 ? 'text-amber-600' : 'text-rose-600'
      : '';

    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Back + Header */}
        <button onClick={() => { setSelectedProjectId(null); setSelectedProject(null); setProjectTeam(null); setTeamMembers([]); }} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 mb-4 transition">
          <ChevronLeftIcon className="h-4 w-4" /> Back to Projects
        </button>
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">{selectedProject.title}</h1>
            <p className="text-sm text-zinc-500 mt-1">{(selectedProject.client as any)?.name || 'No client'} &middot; {PROJECT_TYPE_LABELS[selectedProject.project_type]} &middot; {offering?.name || selectedProject.offering_key}</p>
            {selectedProject.description && <p className="text-sm text-zinc-600 mt-2">{selectedProject.description}</p>}
          </div>
          <div className="flex items-center gap-2">
            <select value={selectedProject.status} onChange={(e) => updateStatus(e.target.value)} className="appearance-none text-xs font-medium px-3 py-1.5 rounded-full border cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-300" style={{ background: 'white' }}>
              {Object.keys(STATUS_COLORS).map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
        </div>

        {/* Staffing Validation */}
        {roleValidation && (
          <div className="mb-6 p-4 rounded-lg border border-zinc-200 bg-zinc-50">
            <h3 className="text-sm font-semibold text-zinc-700 mb-2">Team Composition ({offering?.teamComposition})</h3>
            <div className="flex flex-wrap gap-3">
              {roleValidation.map((rv) => (
                <div key={rv.role} className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${rv.met ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                  {rv.met ? <CheckCircleIcon className="h-3.5 w-3.5" /> : <ExclamationCircleIcon className="h-3.5 w-3.5" />}
                  {rv.role}: {rv.filled}/{rv.required}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Team Settings */}
        {projectTeam && (
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Overhead Multiplier</label>
              <input type="number" step="0.05" min="1" value={overhead} onChange={(e) => { const v = parseFloat(e.target.value) || 1; setOverhead(v); saveTeamSettings(v, blendedRate, teamHours); }} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Blended Sell Rate ($/hr)</label>
              <input type="number" step="5" min="0" value={blendedRate} onChange={(e) => { const v = parseFloat(e.target.value) || 0; setBlendedRate(v); saveTeamSettings(overhead, v, teamHours); }} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Team Hours/Month</label>
              <input type="number" step="10" min="0" value={teamHours} onChange={(e) => { const v = parseInt(e.target.value) || 160; setTeamHours(v); saveTeamSettings(overhead, blendedRate, v); }} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          </div>
        )}

        {/* Team Members Table */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-zinc-700">Team Members ({teamMembers.length})</h3>
            <button onClick={() => setShowAddMember(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition">
              <PlusIcon className="h-3.5 w-3.5" /> Add Member
            </button>
          </div>
          {teamMembers.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-zinc-200">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-zinc-600">Name</th>
                    <th className="text-left px-4 py-2.5 font-medium text-zinc-600">Role</th>
                    <th className="text-right px-4 py-2.5 font-medium text-zinc-600">Alloc %</th>
                    <th className="text-right px-4 py-2.5 font-medium text-zinc-600">Cost/hr</th>
                    <th className="text-right px-4 py-2.5 font-medium text-zinc-600">Loaded/hr</th>
                    <th className="text-right px-4 py-2.5 font-medium text-zinc-600">Hrs/mo</th>
                    <th className="text-right px-4 py-2.5 font-medium text-zinc-600">Mo. Cost</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {memberCosts.map((mc, i) => (
                    <tr key={teamMembers[i].id} className="border-b border-zinc-100 hover:bg-zinc-50 transition">
                      <td className="px-4 py-2.5 font-medium text-zinc-800">{mc.candidateName}</td>
                      <td className="px-4 py-2.5 text-zinc-600">{mc.role}</td>
                      <td className="px-4 py-2.5 text-right text-zinc-600">{mc.allocationPct}%</td>
                      <td className="px-4 py-2.5 text-right text-zinc-600">${mc.costPerHour.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right text-zinc-600">${mc.loadedCostPerHour.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right text-zinc-600">{mc.monthlyHours}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-zinc-800">${mc.monthlyCost.toFixed(0)}</td>
                      <td className="px-2 py-2.5">
                        <button onClick={() => handleRemoveMember(teamMembers[i].id)} className="text-zinc-400 hover:text-rose-500 transition">
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-10 text-zinc-400 border border-dashed border-zinc-200 rounded-lg">
              <UserGroupIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No team members yet. Add candidates to build your team.</p>
            </div>
          )}
        </div>

        {/* Budget Summary */}
        {budgetSummary && (
          <div className="mb-6 p-5 rounded-lg border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-zinc-700">Budget Summary</h3>
              <button onClick={() => exportBudgetCSV(selectedProject, projectTeam!, memberCosts, blendedRate)} className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 text-zinc-600 text-xs font-medium rounded-lg hover:bg-zinc-50 transition">
                <ArrowDownTrayIcon className="h-3.5 w-3.5" /> Export CSV
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-zinc-500">Monthly Cost</p>
                <p className="text-lg font-bold text-zinc-800">${budgetSummary.totalMonthlyCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Monthly Revenue</p>
                <p className="text-lg font-bold text-zinc-800">${budgetSummary.monthlyRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Margin ($)</p>
                <p className={`text-lg font-bold ${marginColor}`}>${budgetSummary.monthlyMargin.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Margin (%)</p>
                <p className={`text-lg font-bold ${marginColor}`}>{budgetSummary.marginPct.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        )}

        {/* Add Member Modal */}
        {showAddMember && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-zinc-800">Add Team Member</h3>
                <button onClick={() => { setShowAddMember(false); setSelectedCandidate(null); setCandidateSearch(''); setCandidateResults([]); }} className="text-zinc-400 hover:text-zinc-600"><XMarkIcon className="h-5 w-5" /></button>
              </div>
              {/* Search */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-zinc-500 mb-1">Search Candidate</label>
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                  <input type="text" value={candidateSearch} onChange={(e) => searchCandidates(e.target.value)} placeholder="Type name..." className="w-full pl-9 pr-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                {candidateResults.length > 0 && !selectedCandidate && (
                  <div className="mt-1 border border-zinc-200 rounded-lg max-h-40 overflow-y-auto">
                    {candidateResults.map((c) => (
                      <button key={c.id} onClick={() => { setSelectedCandidate(c); setCandidateResults([]); setCandidateSearch(c.full_name); if (c.current_salary) setNewMember((prev) => ({ ...prev, outsourcingSalaryUsd: c.current_salary! })); }} className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition flex justify-between items-center">
                        <span className="flex items-center gap-1.5">
                          <span className="font-medium text-zinc-800">{c.full_name}</span>
                          {c.is_vetted && <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Vetted</span>}
                        </span>
                        <span className="text-zinc-400 text-xs">{c.title || ''}</span>
                      </button>
                    ))}
                  </div>
                )}
                {selectedCandidate && (
                  <p className="mt-1 text-xs text-emerald-600">Selected: {selectedCandidate.full_name} {selectedCandidate.current_salary ? `(vetting salary: $${selectedCandidate.current_salary.toLocaleString()})` : ''}</p>
                )}
              </div>
              {/* Role + fields */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Role on Project</label>
                  <select value={newMember.role} onChange={(e) => setNewMember((p) => ({ ...p, role: e.target.value }))} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 appearance-none">
                    <option value="">Select role...</option>
                    {(offering?.requiredRoles || []).map((r) => <option key={r.role} value={r.role}>{r.role}</option>)}
                    <option value="Developer">Developer</option>
                    <option value="QA">QA</option>
                    <option value="Architect">Architect</option>
                    <option value="CTO">CTO</option>
                    <option value="LNKD Lead">LNKD Lead</option>
                    <option value="Designer">Designer</option>
                    <option value="DevOps">DevOps</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Allocation %</label>
                  <input type="number" min="1" max="100" value={newMember.allocationPct} onChange={(e) => setNewMember((p) => ({ ...p, allocationPct: parseInt(e.target.value) || 100 }))} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Outsourcing Salary (USD/yr)</label>
                  <input type="number" min="0" step="1000" value={newMember.outsourcingSalaryUsd} onChange={(e) => setNewMember((p) => ({ ...p, outsourcingSalaryUsd: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Hours/Month (leave empty for auto from allocation)</label>
                  <input type="number" min="0" value={newMember.hoursPerMonth} onChange={(e) => setNewMember((p) => ({ ...p, hoursPerMonth: e.target.value }))} placeholder="Auto-calculated" className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
              </div>
              <button onClick={handleAddMember} disabled={!selectedCandidate || !newMember.role || saving} className="w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
                {saving ? 'Adding...' : 'Add to Team'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── PROJECTS LIST VIEW ───
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Team Staffing</h1>
        <button onClick={() => setShowCreateProject(true)} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition">
          <PlusIcon className="h-4 w-4" /> New Project
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search projects or clients..." className="w-full pl-9 pr-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="appearance-none px-4 py-2 border border-zinc-200 rounded-lg text-sm text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer">
          <option value="all">All Statuses</option>
          {Object.keys(STATUS_COLORS).map((s) => <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}
        </select>
      </div>

      {/* Project Cards */}
      {loading ? (
        <div className="text-center py-16 text-zinc-400"><p>Loading...</p></div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-16 text-zinc-400 border border-dashed border-zinc-200 rounded-lg">
          <UserGroupIcon className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No projects found. Create your first project to start staffing.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredProjects.map((p) => {
            const off = getOffering(p.offering_key);
            return (
              <button key={p.id} onClick={() => setSelectedProjectId(p.id)} className="w-full text-left p-4 bg-white border border-zinc-200 rounded-lg hover:border-indigo-200 hover:shadow-sm transition group">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-zinc-800 group-hover:text-indigo-700 transition">{p.title}</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">{(p.client as any)?.name || 'No client'} &middot; {PROJECT_TYPE_LABELS[p.project_type]} &middot; {off?.name || p.offering_key}</p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS[p.status] || 'bg-zinc-100 text-zinc-600 border-zinc-200'}`}>
                    {p.status.replace('_', ' ')}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateProject && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-zinc-800">New Project</h3>
              <button onClick={() => setShowCreateProject(false)} className="text-zinc-400 hover:text-zinc-600"><XMarkIcon className="h-5 w-5" /></button>
            </div>
            {/* Client */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-zinc-500 mb-1">Client</label>
              <select value={newProject.clientId} onChange={(e) => setNewProject((p) => ({ ...p, clientId: e.target.value, newClientName: '' }))} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 appearance-none">
                <option value="">— Select existing client —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {!newProject.clientId && (
                <input type="text" value={newProject.newClientName} onChange={(e) => setNewProject((p) => ({ ...p, newClientName: e.target.value }))} placeholder="Or type new client name..." className="w-full mt-2 px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              )}
            </div>
            {/* Title + Description */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-zinc-500 mb-1">Project Title</label>
              <input type="text" value={newProject.title} onChange={(e) => setNewProject((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. Mobile App Rebuild" className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-zinc-500 mb-1">Description (optional)</label>
              <textarea value={newProject.description} onChange={(e) => setNewProject((p) => ({ ...p, description: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
            </div>
            {/* Project Type */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-zinc-500 mb-1">Project Type</label>
              <div className="flex gap-2">
                {(['feature', 'module', 'full_solution'] as ProjectType[]).map((t) => (
                  <button key={t} onClick={() => setNewProject((p) => ({ ...p, projectType: t, offeringKey: '' }))} className={`flex-1 py-2 text-xs font-medium rounded-lg border transition ${newProject.projectType === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-zinc-600 border-zinc-200 hover:border-indigo-300'}`}>
                    {PROJECT_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
            {/* Offering Selection */}
            <div className="mb-6">
              <label className="block text-xs font-medium text-zinc-500 mb-1">Team Offering</label>
              <div className="space-y-2">
                {availableOfferings.map((o) => (
                  <button key={o.key} onClick={() => setNewProject((p) => ({ ...p, offeringKey: o.key }))} className={`w-full text-left p-3 rounded-lg border transition ${newProject.offeringKey === o.key ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-200' : 'border-zinc-200 hover:border-indigo-200'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-zinc-800">{o.name}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{o.teamComposition} &middot; {o.deliveryNotes}</p>
                      </div>
                      <span className="text-xs font-semibold text-indigo-600 whitespace-nowrap ml-3">{o.priceRange}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <button onClick={handleCreateProject} disabled={!newProject.title.trim() || !newProject.offeringKey || saving} className="w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
              {saving ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
