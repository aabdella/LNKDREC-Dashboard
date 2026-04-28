'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

// ── Types ──────────────────────────────────────────────────────────────────────
type Tab = 'search' | 'history' | 'qualified' | 'outreach';
type JobBoard = { slug: string; name: string };
type JobResult = {
  board: string;
  job_title: string;
  company: string;
  location: string;
  salary?: string;
  url: string;
};
type SearchStatus = 'idle' | 'running' | 'complete' | 'error';
type SortKey = 'board' | 'job_title' | 'company' | 'location' | 'salary';
type SortDirection = 'asc' | 'desc';

type LeadStatus = 'new' | 'enriched' | 'emailed' | 'replied';
type LeadContact = {
  id: string;
  name: string | null;
  title: string | null;
  email: string | null;
  linkedin_url: string | null;
  source: string;
};
type QualifiedLead = {
  id: string;
  company_name: string;
  job_title: string;
  job_url: string | null;
  board_slug: string | null;
  status: LeadStatus;
  enriched_at: string | null;
  contacted_at: string | null;
  created_at: string;
  lead_contacts: LeadContact[];
};

type HistoryResult = {
  id: string;
  board_slug: string;
  job_title: string;
  company_name: string | null;
  location: string | null;
  salary: string | null;
  job_url: string | null;
  created_at: string;
};

type SearchHistoryItem = {
  id: string;
  country_code: string;
  job_title: string;
  status: SearchStatus;
  total_results: number;
  boards_searched: string[];
  created_at: string;
  completed_at: string | null;
  leads_results: HistoryResult[];
};

// ── Constants ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 25;
const DEFAULT_COUNTRY = 'GB';
const DEFAULT_SORT_KEY: SortKey = 'job_title';
const DEFAULT_SORT_DIRECTION: SortDirection = 'asc';

const STATUS_STYLES: Record<LeadStatus, string> = {
  new: 'bg-slate-100 text-slate-600',
  enriched: 'bg-blue-100 text-blue-700',
  emailed: 'bg-amber-100 text-amber-700',
  replied: 'bg-green-100 text-green-700',
};
const STATUS_NEXT: Record<LeadStatus, LeadStatus | null> = {
  new: 'enriched',
  enriched: 'emailed',
  emailed: 'replied',
  replied: null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function normalizeValue(value?: string) {
  return (value || '').trim().toLowerCase();
}

function getSortedResults(results: JobResult[], sortKey: SortKey, sortDirection: SortDirection) {
  const sorted = [...results].sort((a, b) => {
    const av = normalizeValue(a[sortKey]);
    const bv = normalizeValue(b[sortKey]);
    if (av === bv) return normalizeValue(a.job_title).localeCompare(normalizeValue(b.job_title));
    return av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
  });
  return sortDirection === 'desc' ? sorted.reverse() : sorted;
}

function getVisiblePages(currentPage: number, totalPages: number) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  return Array.from(pages).filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function LeadsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Tab
  const [activeTab, setActiveTab] = useState<Tab>('search');

  // Search tab state
  const [selectedCountry, setSelectedCountry] = useState(DEFAULT_COUNTRY);
  const [selectedBoards, setSelectedBoards] = useState<string[]>([]);
  const [jobTitle, setJobTitle] = useState('');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [searchId, setSearchId] = useState<string | null>(null);
  const [results, setResults] = useState<JobResult[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>(DEFAULT_SORT_KEY);
  const [sortDirection, setSortDirection] = useState<SortDirection>(DEFAULT_SORT_DIRECTION);
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>('idle');
  const [availableBoards, setAvailableBoards] = useState<JobBoard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isHydratedFromUrl, setIsHydratedFromUrl] = useState(false);

  // Selection for qualified leads
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [markingLeads, setMarkingLeads] = useState(false);

  // Qualified leads tab state
  const [qualifiedLeads, setQualifiedLeads] = useState<QualifiedLead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [enrichingId, setEnrichingId] = useState<{ id: string; provider: string } | null>(null);
  const [historyItems, setHistoryItems] = useState<SearchHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // ── URL hydration ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (isHydratedFromUrl) return;
    const country = searchParams.get('country') || DEFAULT_COUNTRY;
    const title = searchParams.get('title') || '';
    const boards = (searchParams.get('boards') || '').split(',').map((v) => v.trim()).filter(Boolean);
    const page = Number.parseInt(searchParams.get('page') || '1', 10);
    const sk = searchParams.get('sortKey');
    const sd = searchParams.get('sortDirection');
    const sid = searchParams.get('searchId');
    const tab = searchParams.get('tab') as Tab | null;
    setSelectedCountry(country);
    setJobTitle(title);
    setSelectedBoards(boards);
    setCurrentPage(Number.isNaN(page) || page < 1 ? 1 : page);
    setSortKey(sk === 'board' || sk === 'company' || sk === 'location' || sk === 'salary' || sk === 'job_title' ? sk : DEFAULT_SORT_KEY);
    setSortDirection(sd === 'desc' ? 'desc' : DEFAULT_SORT_DIRECTION);
    if (sid) { setSearchId(sid); setSearchStatus('complete'); }
    if (tab) setActiveTab(tab);
    setIsHydratedFromUrl(true);
  }, [isHydratedFromUrl, searchParams]);

  useEffect(() => {
    if (!isHydratedFromUrl) return;
    const params = new URLSearchParams();
    if (selectedCountry !== DEFAULT_COUNTRY) params.set('country', selectedCountry);
    if (jobTitle.trim()) params.set('title', jobTitle.trim());
    if (selectedBoards.length > 0) params.set('boards', selectedBoards.join(','));
    if (currentPage > 1) params.set('page', String(currentPage));
    if (sortKey !== DEFAULT_SORT_KEY) params.set('sortKey', sortKey);
    if (sortDirection !== DEFAULT_SORT_DIRECTION) params.set('sortDirection', sortDirection);
    if (searchId) params.set('searchId', searchId);
    if (activeTab !== 'search') params.set('tab', activeTab);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [activeTab, currentPage, isHydratedFromUrl, jobTitle, pathname, router, searchId, selectedBoards, selectedCountry, sortDirection, sortKey]);

  // ── Boards fetch ───────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchBoards() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/leads/boards?country=${selectedCountry}`);
        const data = await res.json();
        if (data.success && data.boards) {
          const nextBoards = data.boards.map((b: { board_slug: string; board_name: string }) => ({ slug: b.board_slug, name: b.board_name }));
          setAvailableBoards(nextBoards);
          setSelectedBoards((prev) => prev.filter((slug) => nextBoards.some((b: JobBoard) => b.slug === slug)));
        }
      } catch (e) { console.error('Error fetching boards:', e); }
      finally { setIsLoading(false); }
    }
    fetchBoards();
  }, [selectedCountry]);

  // ── Qualified leads fetch ──────────────────────────────────────────────────
  const fetchQualifiedLeads = useCallback(async () => {
    setLeadsLoading(true);
    try {
      const res = await fetch('/api/leads/qualified');
      const data = await res.json();
      if (data.success) setQualifiedLeads(data.leads);
    } catch (e) { console.error('Error fetching qualified leads:', e); }
    finally { setLeadsLoading(false); }
  }, []);

  const fetchSearchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/leads/history?limit=20');
      const data = await res.json();
      if (data.success) setHistoryItems(data.searches || []);
    } catch (e) { console.error('Error fetching search history:', e); }
    finally { setHistoryLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === 'qualified' || activeTab === 'outreach') fetchQualifiedLeads();
    if (activeTab === 'history') fetchSearchHistory();
  }, [activeTab, fetchQualifiedLeads, fetchSearchHistory]);

  // ── Results pagination ─────────────────────────────────────────────────────
  async function fetchResultsPage(id: string, page: number, pageLoading = true) {
    if (pageLoading) setIsPageLoading(true);
    try {
      const offset = (page - 1) * PAGE_SIZE;
      const res = await fetch(`/api/leads/results?search_id=${id}&limit=${PAGE_SIZE}&offset=${offset}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load results.');
      setResults(data.results || []);
      setTotalResults(data.total || 0);
      setCurrentPage(page);
      setError(null);
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load results.');
      throw e;
    } finally {
      if (pageLoading) setIsPageLoading(false);
    }
  }

  useEffect(() => {
    if (!searchId || searchStatus !== 'running') return;
    const poll = setInterval(async () => {
      try {
        const data = await fetchResultsPage(searchId, 1, false);
        if (data.status === 'complete') { setSearchStatus('complete'); clearInterval(poll); }
        else if (data.status === 'failed') { setSearchStatus('error'); setError(data.error || 'Search failed.'); clearInterval(poll); }
      } catch (e) { console.error('Poll error:', e); }
    }, 2000);
    return () => clearInterval(poll);
  }, [searchId, searchStatus]);

  useEffect(() => {
    if (!searchId || searchStatus !== 'complete') return;
    fetchResultsPage(searchId, currentPage).catch(console.error);
  }, [currentPage, searchId, searchStatus]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  async function handleSearch() {
    if (!jobTitle.trim() || selectedBoards.length === 0) return;
    setSearchStatus('running');
    setSearchId(null);
    setResults([]);
    setTotalResults(0);
    setCurrentPage(1);
    setError(null);
    setSelectedRows(new Set());
    setIsLoading(true);
    try {
      const res = await fetch('/api/leads/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country_code: selectedCountry, board_slugs: selectedBoards, job_title: jobTitle.trim(), remote_only: remoteOnly }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setSearchStatus('error'); setError(data.error || 'Search failed.'); }
      else setSearchId(data.search_id);
    } catch (e) { setSearchStatus('error'); setError('Network error.'); }
    finally { setIsLoading(false); }
  }

  function toggleBoard(slug: string) {
    setSelectedBoards((prev) => prev.includes(slug) ? prev.filter((b) => b !== slug) : [...prev, slug]);
    setCurrentPage(1);
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) { setSortDirection((d) => d === 'asc' ? 'desc' : 'asc'); return; }
    setSortKey(key);
    setSortDirection('asc');
  }

  function toggleRow(idx: number) {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  function toggleAllRows() {
    if (selectedRows.size === sortedResults.length) setSelectedRows(new Set());
    else setSelectedRows(new Set(sortedResults.map((_, i) => i)));
  }

  async function markAsQualified() {
    const items = Array.from(selectedRows).map((i) => ({
      company_name: sortedResults[i].company || 'Unknown',
      job_title: sortedResults[i].job_title,
      job_url: sortedResults[i].url,
      board_slug: sortedResults[i].board,
    }));
    setMarkingLeads(true);
    try {
      const res = await fetch('/api/leads/qualified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedRows(new Set());
        setActiveTab('qualified');
      }
    } catch (e) { console.error('Mark as qualified error:', e); }
    finally { setMarkingLeads(false); }
  }

  async function enrichLead(leadId: string, provider: 'hunter' | 'prospeo' | 'pdl') {
    setEnrichingId({ id: leadId, provider });
    try {
      const res = await fetch('/api/leads/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, provider }),
      });
      const data = await res.json();
      if (data.success) await fetchQualifiedLeads();
      else alert(data.error || 'Enrichment failed');
    } catch (e) { console.error('Enrich error:', e); }
    finally { setEnrichingId(null); }
  }

  async function updateLeadStatus(leadId: string, status: LeadStatus) {
    await fetch('/api/leads/qualified', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: leadId, status }),
    });
    await fetchQualifiedLeads();
  }

  async function removeLead(leadId: string) {
    await fetch(`/api/leads/qualified?id=${leadId}`, { method: 'DELETE' });
    await fetchQualifiedLeads();
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const sortedResults = useMemo(() => getSortedResults(results, sortKey, sortDirection), [results, sortDirection, sortKey]);
  const isSearchDisabled = !jobTitle.trim() || selectedBoards.length === 0 || searchStatus === 'running';
  const totalPages = Math.max(1, Math.ceil(totalResults / PAGE_SIZE));
  const rangeStart = totalResults === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, totalResults);
  const visiblePages = getVisiblePages(currentPage, totalPages);
  const outreachLeads = qualifiedLeads.filter((l) => l.status !== 'new');

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <span className="text-xl">🔍</span>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Leads</h1>
            <p className="text-sm text-slate-500">Discover job listings and manage your outreach pipeline</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex gap-0" aria-label="Tabs">
            {([
              { id: 'search', label: '🔍 Search', count: null },
              { id: 'history', label: '🕘 Search History', count: historyItems.length || null },
              { id: 'qualified', label: '⭐ Qualified Leads', count: qualifiedLeads.length || null },
              { id: 'outreach', label: '📤 Outreach', count: outreachLeads.length || null },
            ] as { id: Tab; label: string; count: number | null }[]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                {tab.label}
                {tab.count ? (
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                    {tab.count}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6">

        {/* ── TAB 1: SEARCH ──────────────────────────────────────────────── */}
        {activeTab === 'search' && (
          <>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Country</label>
                  <select
                    value={selectedCountry}
                    onChange={(e) => setSelectedCountry(e.target.value)}
                    className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="GB">🇬🇧 United Kingdom</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Job Title</label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g. Senior Software Engineer"
                    className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    onKeyDown={(e) => e.key === 'Enter' && !isSearchDisabled && handleSearch()}
                  />
                </div>
              </div>

              <div className="mb-5 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Job Boards</label>
                  {availableBoards.filter((b) => b.slug !== 'career-crawler').length === 0 && !isLoading ? (
                    <p className="text-sm text-slate-400 italic">No boards available</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {availableBoards.filter((b) => b.slug !== 'career-crawler').map((board) => (
                        <button
                          key={board.slug}
                          onClick={() => toggleBoard(board.slug)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                            selectedBoards.includes(board.slug)
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                          }`}
                        >{board.name}</button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Companies (Direct Crawl)</label>
                  <div className="flex flex-wrap gap-2">
                    {availableBoards.filter((b) => b.slug === 'career-crawler').map((board) => (
                      <button
                        key={board.slug}
                        onClick={() => toggleBoard(board.slug)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                          selectedBoards.includes(board.slug)
                            ? 'bg-green-600 border-green-600 text-white shadow-sm'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-green-300 hover:text-green-600'
                        }`}
                      >🚀 {board.name}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleSearch}
                    disabled={isSearchDisabled}
                    className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold text-sm px-5 py-2 rounded-lg transition-colors"
                  >
                    {searchStatus === 'running' ? (
                      <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Searching...</>
                    ) : <>🔍 Search</>}
                  </button>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <div
                      onClick={() => setRemoteOnly(v => !v)}
                      className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${remoteOnly ? 'bg-green-500' : 'bg-slate-200'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${remoteOnly ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                    <span className="text-sm font-medium text-slate-700">Remote only</span>
                  </label>
                </div>
                <div className="text-sm text-slate-500">
                  {selectedBoards.length > 0 ? `${selectedBoards.length} source${selectedBoards.length > 1 ? 's' : ''} selected` : 'Choose at least one source'}
                </div>
              </div>
              {error && <p className="mt-3 text-sm text-red-600 font-medium">{error}</p>}
            </div>

            {/* Bulk action bar */}
            {searchStatus === 'complete' && selectedRows.size > 0 && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-3 mb-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-indigo-700">{selectedRows.size} result{selectedRows.size > 1 ? 's' : ''} selected</span>
                <button
                  onClick={markAsQualified}
                  disabled={markingLeads}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
                >
                  {markingLeads ? 'Saving...' : '⭐ Mark as Qualified Lead'}
                </button>
              </div>
            )}

            {/* Results table */}
            {searchStatus === 'complete' && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                      Results
                      <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full">{totalResults}</span>
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">Showing {rangeStart}–{rangeEnd} of {totalResults}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>Sorted by {sortKey.replace('_', ' ')}</span>
                    {isPageLoading && <span className="font-medium text-indigo-600">Loading...</span>}
                  </div>
                </div>

                {sortedResults.length === 0 ? (
                  <div className="p-12 text-center">
                    <p className="text-slate-500 text-sm">No jobs found. Try different sources or job title.</p>
                  </div>
                ) : (
                  <>
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="px-4 py-3 w-10">
                              <input
                                type="checkbox"
                                checked={selectedRows.size === sortedResults.length && sortedResults.length > 0}
                                onChange={toggleAllRows}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              />
                            </th>
                            {[
                              { key: 'board', label: 'Source' },
                              { key: 'job_title', label: 'Job Title' },
                              { key: 'company', label: 'Company' },
                              { key: 'location', label: 'Location' },
                              { key: 'salary', label: 'Salary' },
                            ].map((col) => (
                              <th key={col.key} className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">
                                <button type="button" onClick={() => handleSort(col.key as SortKey)} className={`inline-flex items-center gap-1 transition-colors ${sortKey === col.key ? 'text-indigo-600' : 'hover:text-indigo-600'}`}>
                                  {col.label} <span>{sortKey === col.key ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
                                </button>
                              </th>
                            ))}
                            <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Link</th>
                          </tr>
                        </thead>
                        <tbody className={isPageLoading ? 'opacity-60' : ''}>
                          {sortedResults.map((job, idx) => (
                            <tr key={`${job.url}-${idx}`} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${selectedRows.has(idx) ? 'bg-indigo-50' : ''}`}>
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={selectedRows.has(idx)}
                                  onChange={() => toggleRow(idx)}
                                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wide">{job.board}</span>
                              </td>
                              <td className="px-4 py-3 font-medium text-slate-900">{job.job_title}</td>
                              <td className="px-4 py-3 text-slate-600">{job.company || '—'}</td>
                              <td className="px-4 py-3 text-slate-600">{job.location || '—'}</td>
                              <td className="px-4 py-3 text-slate-600">{job.salary || '—'}</td>
                              <td className="px-4 py-3">
                                {job.url ? (
                                  <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 font-medium">View →</a>
                                ) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="grid gap-3 p-4 md:hidden">
                      {sortedResults.map((job, idx) => (
                        <article key={`${job.url}-${idx}`} className={`rounded-xl border p-4 shadow-sm ${selectedRows.has(idx) ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-slate-50'}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <input type="checkbox" checked={selectedRows.has(idx)} onChange={() => toggleRow(idx)} className="rounded border-slate-300 text-indigo-600" />
                              <span className="bg-white text-slate-600 text-[11px] font-bold px-2 py-1 rounded uppercase tracking-wide border border-slate-200">{job.board}</span>
                            </div>
                            {job.url && <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-semibold text-sm">View</a>}
                          </div>
                          <h3 className="mt-3 text-sm font-semibold text-slate-900">{job.job_title}</h3>
                          <div className="mt-2 grid gap-1 text-sm text-slate-600">
                            <p><span className="font-medium text-slate-900">Company:</span> {job.company || '—'}</p>
                            <p><span className="font-medium text-slate-900">Location:</span> {job.location || '—'}</p>
                            {job.salary && <p><span className="font-medium text-slate-900">Salary:</span> {job.salary}</p>}
                          </div>
                        </article>
                      ))}
                    </div>

                    {totalPages > 1 && (
                      <div className="flex flex-col gap-4 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-slate-500">Page {currentPage} of {totalPages}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <button type="button" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1 || isPageLoading} className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
                          {visiblePages.map((page, index) => {
                            const prev = visiblePages[index - 1];
                            return (
                              <div key={page} className="flex items-center gap-2">
                                {prev && page - prev > 1 && <span className="px-1 text-slate-400">…</span>}
                                <button type="button" onClick={() => setCurrentPage(page)} disabled={isPageLoading} className={`inline-flex h-10 min-w-10 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors ${currentPage === page ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 text-slate-600 hover:border-indigo-300'} disabled:opacity-50`}>{page}</button>
                              </div>
                            );
                          })}
                          <button type="button" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || isPageLoading} className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* ── TAB 2: HISTORY ─────────────────────────────────────────────── */}
        {activeTab === 'history' && (
          <div>
            {historyLoading ? (
              <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Loading search history...</div>
            ) : historyItems.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
                <p className="text-4xl mb-3">🕘</p>
                <p className="text-slate-700 font-semibold mb-1">No search history yet</p>
                <p className="text-sm text-slate-500">Run a search and it will be saved here for later review.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {historyItems.map((item) => {
                  const isExpanded = expandedHistoryId === item.id;
                  return (
                    <div key={item.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setExpandedHistoryId(isExpanded ? null : item.id)}
                        className="w-full px-5 py-4 text-left hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="flex items-center gap-3 flex-wrap">
                              <h3 className="font-bold text-slate-900 text-base">{item.job_title}</h3>
                              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">{item.status}</span>
                              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{item.total_results} results</span>
                            </div>
                            <p className="text-sm text-slate-500 mt-0.5">
                              {new Date(item.created_at).toLocaleString()} · {item.boards_searched.join(', ') || 'No boards'}
                            </p>
                          </div>
                          <span className="text-sm font-medium text-indigo-600">{isExpanded ? 'Hide' : 'View'} {isExpanded ? '↑' : '↓'}</span>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-slate-100 px-5 py-4">
                          {item.leads_results.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">No saved results for this search.</p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-slate-50 border-b border-slate-100 text-xs uppercase tracking-wide text-slate-600">
                                    <th className="text-left px-4 py-3 font-semibold">Source</th>
                                    <th className="text-left px-4 py-3 font-semibold">Job Title</th>
                                    <th className="text-left px-4 py-3 font-semibold">Company</th>
                                    <th className="text-left px-4 py-3 font-semibold">Location</th>
                                    <th className="text-left px-4 py-3 font-semibold">Salary</th>
                                    <th className="text-left px-4 py-3 font-semibold">Link</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {item.leads_results.map((result) => (
                                    <tr key={result.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                      <td className="px-4 py-3"><span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wide">{result.board_slug}</span></td>
                                      <td className="px-4 py-3 font-medium text-slate-900">{result.job_title}</td>
                                      <td className="px-4 py-3 text-slate-600">{result.company_name || '—'}</td>
                                      <td className="px-4 py-3 text-slate-600">{result.location || '—'}</td>
                                      <td className="px-4 py-3 text-slate-600">{result.salary || '—'}</td>
                                      <td className="px-4 py-3">
                                        {result.job_url ? (
                                          <a href={result.job_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 font-medium">View →</a>
                                        ) : '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: QUALIFIED LEADS ─────────────────────────────────────── */}
        {activeTab === 'qualified' && (
          <div>
            {leadsLoading ? (
              <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Loading qualified leads...</div>
            ) : qualifiedLeads.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
                <p className="text-4xl mb-3">⭐</p>
                <p className="text-slate-700 font-semibold mb-1">No qualified leads yet</p>
                <p className="text-sm text-slate-500">Go to the Search tab, select results, and click <strong>Mark as Qualified Lead</strong>.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {qualifiedLeads.map((lead) => (
                  <div key={lead.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    {/* Lead header */}
                    <div className="px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="font-bold text-slate-900 text-base">{lead.company_name}</h3>
                          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full capitalize ${STATUS_STYLES[lead.status]}`}>{lead.status}</span>
                        </div>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {lead.job_title}
                          {lead.job_url && <> · <a href={lead.job_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">View Job →</a></>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {(['hunter', 'prospeo', 'pdl'] as const).map((prov) => {
                          const provConfig = {
                            hunter:  { label: '🔵 Hunter.io', className: 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300' },
                            prospeo: { label: '🟣 Prospeo',  className: 'bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300' },
                            pdl:     { label: '🟢 PDL',      className: 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300' },
                          }[prov];
                          const isEnriching = enrichingId?.id === lead.id && enrichingId?.provider === prov;
                          return (
                            <button
                              key={prov}
                              onClick={() => enrichLead(lead.id, prov)}
                              disabled={isEnriching || (enrichingId?.id === lead.id && enrichingId?.provider !== prov)}
                              className={`inline-flex items-center gap-1.5 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${provConfig.className}`}
                            >
                              {isEnriching ? (
                                <><svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Enriching...</>
                              ) : provConfig.label}
                            </button>
                          );
                        })}
                        <span title="Apollo people search requires a paid plan" className="inline-flex items-center gap-1.5 text-slate-400 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 cursor-not-allowed select-none">⚫ Apollo (paid only)</span>
                        {STATUS_NEXT[lead.status] && (
                          <button
                            onClick={() => updateLeadStatus(lead.id, STATUS_NEXT[lead.status]!)}
                            className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Mark as {STATUS_NEXT[lead.status]} →
                          </button>
                        )}
                        <button onClick={() => removeLead(lead.id)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors">Remove</button>
                      </div>
                    </div>

                    {/* Contacts */}
                    {lead.lead_contacts && lead.lead_contacts.length > 0 && (
                      <div className="border-t border-slate-100 px-5 py-4">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Talent & People Contacts ({lead.lead_contacts.length})</p>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {lead.lead_contacts.map((contact) => (
                            <div key={contact.id} className="bg-slate-50 rounded-lg border border-slate-200 p-3">
                              <p className="font-semibold text-slate-900 text-sm">{contact.name || 'Unknown'}</p>
                              <p className="text-xs text-slate-500 mb-2">{contact.title || '—'}</p>
                              <div className="flex flex-wrap gap-2">
                                {contact.email && (
                                  <button
                                    onClick={() => navigator.clipboard.writeText(contact.email!)}
                                    className="inline-flex items-center gap-1 text-xs bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 px-2 py-1 rounded-md transition-colors"
                                  >
                                    📋 {contact.email}
                                  </button>
                                )}
                                {contact.linkedin_url && (
                                  <a
                                    href={contact.linkedin_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs bg-white border border-slate-200 text-blue-600 hover:border-blue-300 px-2 py-1 rounded-md transition-colors"
                                  >
                                    🔗 LinkedIn
                                  </a>
                                )}
                                {!contact.email && !contact.linkedin_url && (
                                  <span className="text-xs text-slate-400 italic">No contact info found</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {lead.status === 'enriched' && lead.lead_contacts.length === 0 && (
                      <div className="border-t border-slate-100 px-5 py-3">
                        <p className="text-xs text-slate-400 italic">No contacts found. Try a different enrichment provider.</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: OUTREACH ───────────────────────────────────────────── */}
        {activeTab === 'outreach' && (
          <div>
            {leadsLoading ? (
              <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Loading...</div>
            ) : outreachLeads.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
                <p className="text-4xl mb-3">📤</p>
                <p className="text-slate-700 font-semibold mb-1">No outreach activity yet</p>
                <p className="text-sm text-slate-500">Enrich your qualified leads and start reaching out.</p>
              </div>
            ) : (
              <div>
                {/* Pipeline summary */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {(['enriched', 'emailed', 'replied'] as LeadStatus[]).map((s) => {
                    const count = qualifiedLeads.filter((l) => l.status === s).length;
                    return (
                      <div key={s} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-center">
                        <p className="text-2xl font-bold text-slate-900">{count}</p>
                        <p className={`text-xs font-bold mt-1 capitalize px-2 py-0.5 rounded-full inline-block ${STATUS_STYLES[s]}`}>{s}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Outreach table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100">
                    <h2 className="font-semibold text-slate-900">Outreach Pipeline</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-xs uppercase tracking-wide text-slate-600">
                          <th className="text-left px-4 py-3 font-semibold">Company</th>
                          <th className="text-left px-4 py-3 font-semibold">Role</th>
                          <th className="text-left px-4 py-3 font-semibold">Contacts</th>
                          <th className="text-left px-4 py-3 font-semibold">Status</th>
                          <th className="text-left px-4 py-3 font-semibold">Enriched</th>
                          <th className="text-left px-4 py-3 font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {outreachLeads.map((lead) => (
                          <tr key={lead.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 font-semibold text-slate-900">{lead.company_name}</td>
                            <td className="px-4 py-3 text-slate-600">{lead.job_title}</td>
                            <td className="px-4 py-3">
                              {lead.lead_contacts.length > 0 ? (
                                <div className="flex flex-col gap-1">
                                  {lead.lead_contacts.slice(0, 2).map((c) => (
                                    <div key={c.id} className="flex items-center gap-2">
                                      <span className="text-slate-700 text-xs">{c.name}</span>
                                      {c.email && (
                                        <button onClick={() => navigator.clipboard.writeText(c.email!)} className="text-xs text-indigo-600 hover:underline">📋 Copy email</button>
                                      )}
                                      {c.linkedin_url && (
                                        <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">🔗 LinkedIn</a>
                                      )}
                                    </div>
                                  ))}
                                  {lead.lead_contacts.length > 2 && (
                                    <span className="text-xs text-slate-400">+{lead.lead_contacts.length - 2} more</span>
                                  )}
                                </div>
                              ) : <span className="text-slate-400 text-xs">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full capitalize ${STATUS_STYLES[lead.status]}`}>{lead.status}</span>
                            </td>
                            <td className="px-4 py-3 text-slate-500 text-xs">
                              {lead.enriched_at ? new Date(lead.enriched_at).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-4 py-3">
                              {STATUS_NEXT[lead.status] && (
                                <button
                                  onClick={() => updateLeadStatus(lead.id, STATUS_NEXT[lead.status]!)}
                                  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-lg transition-colors capitalize"
                                >
                                  → {STATUS_NEXT[lead.status]}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
