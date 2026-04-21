'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import styles from './page.module.css';

type JobBoard = {
  slug: string;
  name: string;
};

type JobResult = {
  board: string;
  job_title: string;
  company: string;
  location: string;
  salary?: string;
  url: string;
};

type SearchStatus = 'idle' | 'running' | 'complete' | 'error';

export default function LeadsPage() {
  const [selectedCountry, setSelectedCountry] = useState('GB');
  const [selectedBoards, setSelectedBoards] = useState<string[]>([]);
  const [jobTitle, setJobTitle] = useState('');
  const [searchId, setSearchId] = useState<string | null>(null);
  const [results, setResults] = useState<JobResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>('idle');
  const [availableBoards, setAvailableBoards] = useState<JobBoard[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load boards when country changes
  useEffect(() => {
    async function fetchBoards() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/leads/boards?country=${selectedCountry}`);
        const data = await res.json();
        if (data.success && data.boards) {
          setAvailableBoards(
            data.boards.map((b: any) => ({ slug: b.board_slug, name: b.board_name }))
          );
        } else {
          setAvailableBoards([]);
        }
      } catch (e) {
        console.error('Error fetching boards:', e);
      } finally {
        setIsLoading(false);
      }
    }
    fetchBoards();
  }, [selectedCountry]);

  // Poll for search completion
  useEffect(() => {
    if (!searchId) return;
    if (searchStatus !== 'running') return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/leads/results?search_id=${searchId}`);
        const data = await res.json();

        if (data.status === 'complete') {
          setSearchStatus('complete');
          setResults(data.results || []);
          setSearchId(null);
          clearInterval(pollInterval);
        } else if (data.status === 'error') {
          setSearchStatus('error');
          setError(data.message || 'Search failed.');
          setSearchId(null);
          clearInterval(pollInterval);
        }
      } catch (e) {
        console.error('Poll error:', e);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [searchId, searchStatus]);

  async function handleSearch() {
    if (!jobTitle.trim() || selectedBoards.length === 0) return;

    setSearchStatus('running');
    setResults([]);
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/leads/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country_code: selectedCountry,
          board_slugs: selectedBoards,
          job_title: jobTitle.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setSearchStatus('error');
        setError(data.error || 'Search failed.');
      } else {
        setSearchId(data.search_id);
      }
    } catch (e) {
      setSearchStatus('error');
      setError('Network error.');
    } finally {
      setIsLoading(false);
    }
  }

  function toggleBoard(slug: string) {
    setSelectedBoards((prev) =>
      prev.includes(slug) ? prev.filter((b) => b !== slug) : [...prev, slug]
    );
  }

  const isSearchDisabled = !jobTitle.trim() || selectedBoards.length === 0 || searchStatus === 'running';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <span className="text-xl">🔍</span>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Leads</h1>
            <p className="text-sm text-slate-500">Discover job listings across multiple boards</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Search Controls */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
            {/* Country */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Country</label>
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="GB">🇬🇧 United Kingdom</option>
              </select>
            </div>

            {/* Job Title */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Job Title</label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Senior Software Engineer"
                className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                onKeyDown={(e) => e.key === 'Enter' && !isSearchDisabled && handleSearch()}
              />
            </div>
          </div>

          {/* Board Selection */}
          <div className="mb-5">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Job Boards</label>
            {availableBoards.length === 0 && !isLoading ? (
              <p className="text-sm text-slate-400 italic">No boards available</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableBoards.map((board) => (
                  <button
                    key={board.slug}
                    onClick={() => toggleBoard(board.slug)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                      selectedBoards.includes(board.slug)
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                    }`}
                  >
                    {board.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Search Button */}
          <button
            onClick={handleSearch}
            disabled={isSearchDisabled}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold text-sm px-5 py-2 rounded-lg transition-colors"
          >
            {searchStatus === 'running' ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Searching...
              </>
            ) : (
              <>🔍 Search</>
            )}
          </button>

          {error && (
            <p className="mt-3 text-sm text-red-600 font-medium">{error}</p>
          )}
        </div>

        {/* Results */}
        {searchStatus === 'complete' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                Results
                <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full">
                  {results.length}
                </span>
              </h2>
            </div>

            {results.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-slate-500 text-sm">No jobs found. Try different boards or job title.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Board</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Job Title</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Company</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Location</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Salary</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">URL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((job, idx) => (
                      <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wide">
                            {job.board}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">{job.job_title}</td>
                        <td className="px-4 py-3 text-slate-600">{job.company || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{job.location || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{job.salary || '—'}</td>
                        <td className="px-4 py-3">
                          {job.url ? (
                            <a
                              href={job.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 hover:text-indigo-800 font-medium text-sm"
                            >
                              View →
                            </a>
                          ) : (
                            '—'
                          )}
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
    </div>
  );
}
