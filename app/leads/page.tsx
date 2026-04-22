'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

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
type SortKey = 'board' | 'job_title' | 'company' | 'location' | 'salary';
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE = 25;
const DEFAULT_COUNTRY = 'GB';
const DEFAULT_SORT_KEY: SortKey = 'job_title';
const DEFAULT_SORT_DIRECTION: SortDirection = 'asc';

function normalizeValue(value?: string) {
  return (value || '').trim().toLowerCase();
}

function getSortedResults(results: JobResult[], sortKey: SortKey, sortDirection: SortDirection) {
  const sorted = [...results].sort((left, right) => {
    const leftValue = normalizeValue(left[sortKey]);
    const rightValue = normalizeValue(right[sortKey]);

    if (leftValue === rightValue) {
      return normalizeValue(left.job_title).localeCompare(normalizeValue(right.job_title));
    }

    return leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: 'base' });
  });

  return sortDirection === 'desc' ? sorted.reverse() : sorted;
}

function getVisiblePages(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  return Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
}

export default function LeadsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedCountry, setSelectedCountry] = useState(DEFAULT_COUNTRY);
  const [selectedBoards, setSelectedBoards] = useState<string[]>([]);
  const [jobTitle, setJobTitle] = useState('');
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

  useEffect(() => {
    if (isHydratedFromUrl) return;

    const country = searchParams.get('country') || DEFAULT_COUNTRY;
    const title = searchParams.get('title') || '';
    const boards = (searchParams.get('boards') || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const page = Number.parseInt(searchParams.get('page') || '1', 10);
    const nextSortKey = searchParams.get('sortKey');
    const nextSortDirection = searchParams.get('sortDirection');
    const nextSearchId = searchParams.get('searchId');

    setSelectedCountry(country);
    setJobTitle(title);
    setSelectedBoards(boards);
    setCurrentPage(Number.isNaN(page) || page < 1 ? 1 : page);
    setSortKey(nextSortKey === 'board' || nextSortKey === 'company' || nextSortKey === 'location' || nextSortKey === 'salary' || nextSortKey === 'job_title' ? nextSortKey : DEFAULT_SORT_KEY);
    setSortDirection(nextSortDirection === 'desc' ? 'desc' : DEFAULT_SORT_DIRECTION);

    if (nextSearchId) {
      setSearchId(nextSearchId);
      setSearchStatus('complete');
    }

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

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [currentPage, isHydratedFromUrl, jobTitle, pathname, router, searchId, selectedBoards, selectedCountry, sortDirection, sortKey]);

  useEffect(() => {
    async function fetchBoards() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/leads/boards?country=${selectedCountry}`);
        const data = await res.json();
        if (data.success && data.boards) {
          const nextBoards = data.boards.map((board: { board_slug: string; board_name: string }) => ({
            slug: board.board_slug,
            name: board.board_name,
          }));
          setAvailableBoards(nextBoards);
          setSelectedBoards((prev) => prev.filter((slug) => nextBoards.some((board: JobBoard) => board.slug === slug)));
        } else {
          setAvailableBoards([]);
          setSelectedBoards([]);
        }
      } catch (fetchError) {
        console.error('Error fetching boards:', fetchError);
      } finally {
        setIsLoading(false);
      }
    }

    fetchBoards();
  }, [selectedCountry]);

  async function fetchResultsPage(id: string, page: number, pageLoading = true) {
    if (pageLoading) {
      setIsPageLoading(true);
    }

    try {
      const offset = (page - 1) * PAGE_SIZE;
      const res = await fetch(`/api/leads/results?search_id=${id}&limit=${PAGE_SIZE}&offset=${offset}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load results.');
      }

      setResults(data.results || []);
      setTotalResults(data.total || 0);
      setCurrentPage(page);
      setError(null);
      return data;
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load results.');
      throw fetchError;
    } finally {
      if (pageLoading) {
        setIsPageLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!searchId || searchStatus !== 'running') return;

    const pollInterval = setInterval(async () => {
      try {
        const data = await fetchResultsPage(searchId, 1, false);

        if (data.status === 'complete') {
          setSearchStatus('complete');
          clearInterval(pollInterval);
        } else if (data.status === 'failed') {
          setSearchStatus('error');
          setError(data.error || 'Search failed.');
          clearInterval(pollInterval);
        }
      } catch (pollError) {
        console.error('Poll error:', pollError);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [searchId, searchStatus]);

  useEffect(() => {
    if (!searchId || searchStatus !== 'complete') return;

    fetchResultsPage(searchId, currentPage).catch((fetchError) => {
      console.error('Pagination error:', fetchError);
    });
  }, [currentPage, searchId, searchStatus]);

  async function handleSearch() {
    if (!jobTitle.trim() || selectedBoards.length === 0) return;

    setSearchStatus('running');
    setSearchId(null);
    setResults([]);
    setTotalResults(0);
    setCurrentPage(1);
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
    } catch (searchError) {
      setSearchStatus('error');
      setError('Network error.');
      console.error('Search error:', searchError);
    } finally {
      setIsLoading(false);
    }
  }

  function toggleBoard(slug: string) {
    setSelectedBoards((prev) =>
      prev.includes(slug) ? prev.filter((board) => board !== slug) : [...prev, slug]
    );
    setCurrentPage(1);
  }

  function handleSort(nextSortKey: SortKey) {
    if (sortKey === nextSortKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(nextSortKey);
    setSortDirection('asc');
  }

  const sortedResults = useMemo(
    () => getSortedResults(results, sortKey, sortDirection),
    [results, sortDirection, sortKey]
  );

  const isSearchDisabled = !jobTitle.trim() || selectedBoards.length === 0 || searchStatus === 'running';
  const totalPages = Math.max(1, Math.ceil(totalResults / PAGE_SIZE));
  const rangeStart = totalResults === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, totalResults);
  const visiblePages = getVisiblePages(currentPage, totalPages);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <span className="text-xl">🔍</span>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Leads</h1>
            <p className="text-sm text-slate-500">Discover job listings across multiple boards</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Country</label>
              <select
                value={selectedCountry}
                onChange={(event) => setSelectedCountry(event.target.value)}
                className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="GB">🇬🇧 United Kingdom</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Job Title</label>
              <input
                type="text"
                value={jobTitle}
                onChange={(event) => setJobTitle(event.target.value)}
                placeholder="e.g. Senior Software Engineer"
                className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                onKeyDown={(event) => event.key === 'Enter' && !isSearchDisabled && handleSearch()}
              />
            </div>
          </div>

          <div className="mb-5">
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Job Boards</label>
              {availableBoards.length === 0 && !isLoading ? (
                <p className="text-sm text-slate-400 italic">No boards available</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableBoards.filter(b => b.slug !== 'career-crawler').map((board) => (
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

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Companies (Direct Crawl)</label>
              <div className="flex flex-wrap gap-2">
                {availableBoards.filter(b => b.slug === 'career-crawler').map((board) => (
                  <button
                    key={board.slug}
                    onClick={() => toggleBoard(board.slug)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                      selectedBoards.includes(board.slug)
                        ? 'bg-green-600 border-green-600 text-white shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-green-300 hover:text-green-600'
                    }`}
                  >
                    🚀 {board.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              onClick={handleSearch}
              disabled={isSearchDisabled}
              className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold text-sm px-5 py-2 rounded-lg transition-colors"
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

            <div className="text-sm text-slate-500">
              {selectedBoards.length > 0 ? `${selectedBoards.length} board${selectedBoards.length > 1 ? 's' : ''} selected` : 'Choose at least one board'}
            </div>
          </div>

          {error && <p className="mt-3 text-sm text-red-600 font-medium">{error}</p>}
        </div>

        {searchStatus === 'complete' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                  Results
                  <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full">
                    {totalResults}
                  </span>
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Showing {rangeStart}-{rangeEnd} of {totalResults}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span>Sorted by {sortKey.replace('_', ' ')}</span>
                {isPageLoading && <span className="font-medium text-indigo-600">Loading page...</span>}
              </div>
            </div>

            {sortedResults.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-slate-500 text-sm">No jobs found. Try different boards or job title.</p>
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        {[
                          { key: 'board', label: 'Board' },
                          { key: 'job_title', label: 'Job Title' },
                          { key: 'company', label: 'Company' },
                          { key: 'location', label: 'Location' },
                          { key: 'salary', label: 'Salary' },
                        ].map((column) => {
                          const isActive = sortKey === column.key;
                          return (
                            <th key={column.key} className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">
                              <button
                                type="button"
                                onClick={() => handleSort(column.key as SortKey)}
                                className={`inline-flex items-center gap-1 transition-colors ${isActive ? 'text-indigo-600' : 'hover:text-indigo-600'}`}
                              >
                                <span>{column.label}</span>
                                <span>{isActive ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
                              </button>
                            </th>
                          );
                        })}
                        <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">URL</th>
                      </tr>
                    </thead>
                    <tbody className={isPageLoading ? 'opacity-60' : ''}>
                      {sortedResults.map((job, idx) => (
                        <tr key={`${job.url}-${idx}`} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
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

                <div className="grid gap-3 p-4 md:hidden">
                  {sortedResults.map((job, idx) => (
                    <article key={`${job.url}-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <span className="bg-white text-slate-600 text-[11px] font-bold px-2 py-1 rounded uppercase tracking-wide border border-slate-200">
                          {job.board}
                        </span>
                        {job.url && (
                          <a
                            href={job.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-800 font-semibold text-sm"
                          >
                            View
                          </a>
                        )}
                      </div>
                      <h3 className="mt-3 text-sm font-semibold text-slate-900 leading-5">{job.job_title}</h3>
                      <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-600">
                        <p><span className="font-medium text-slate-900">Company:</span> {job.company || '—'}</p>
                        <p><span className="font-medium text-slate-900">Location:</span> {job.location || '—'}</p>
                        <p><span className="font-medium text-slate-900">Salary:</span> {job.salary || '—'}</p>
                      </div>
                    </article>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex flex-col gap-4 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-500">
                      Page {currentPage} of {totalPages}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                        disabled={currentPage === 1 || isPageLoading}
                        className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Previous
                      </button>

                      {visiblePages.map((page, index) => {
                        const previousPage = visiblePages[index - 1];
                        const showGap = previousPage && page - previousPage > 1;
                        return (
                          <div key={page} className="flex items-center gap-2">
                            {showGap && <span className="px-1 text-slate-400">…</span>}
                            <button
                              type="button"
                              onClick={() => setCurrentPage(page)}
                              disabled={isPageLoading}
                              className={`inline-flex h-10 min-w-10 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors ${
                                currentPage === page
                                  ? 'border-indigo-600 bg-indigo-600 text-white'
                                  : 'border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                              } disabled:cursor-not-allowed disabled:opacity-50`}
                            >
                              {page}
                            </button>
                          </div>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                        disabled={currentPage === totalPages || isPageLoading}
                        className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
