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
          country: selectedCountry,
          boards: selectedBoards,
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
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.emoji}>🔍</span>
          <h1 className={styles.title}>LEADS</h1>
        </div>
        <p className={styles.subtitle}>Discover job listings across multiple boards</p>
      </div>

      {/* Search Controls */}
      <div className={styles.controlsCard}>
        <div className={styles.controlsGrid}>
          {/* Country */}
          <div className={styles.controlGroup}>
            <label className={styles.label}>Country</label>
            <div className={styles.selectWrapper}>
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className={styles.select}
              >
                <option value="GB">🇬🇧 United Kingdom</option>
              </select>
              <svg className={styles.selectIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Job Title */}
          <div className={styles.controlGroup}>
            <label className={styles.label}>Job Title</label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Senior Software Engineer"
              className={styles.input}
              onKeyDown={(e) => e.key === 'Enter' && !isSearchDisabled && handleSearch()}
            />
          </div>
        </div>

        {/* Board Selection */}
        <div className={styles.controlGroup}>
          <label className={styles.label}>Job Boards</label>
          <div className={styles.boardPills}>
            {availableBoards.length === 0 && !isLoading ? (
              <span className={styles.noBoards}>No boards available</span>
            ) : (
              availableBoards.map((board) => (
                <button
                  key={board.slug}
                  onClick={() => toggleBoard(board.slug)}
                  className={`${styles.pill} ${selectedBoards.includes(board.slug) ? styles.pillActive : ''}`}
                >
                  {board.name}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Search Button */}
        <button
          onClick={handleSearch}
          disabled={isSearchDisabled}
          className={styles.searchBtn}
        >
          {searchStatus === 'running' ? (
            <>
              <span className={styles.spinner} />
              Searching...
            </>
          ) : (
            'Search'
          )}
        </button>

        {error && <p className={styles.errorMsg}>{error}</p>}
      </div>

      {/* Results */}
      {searchStatus === 'complete' && (
        <div className={styles.resultsCard}>
          <div className={styles.resultsHeader}>
            <h2 className={styles.resultsTitle}>
              Results
              <span className={styles.resultsCount}>{results.length}</span>
            </h2>
          </div>

          {results.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyEmoji}>📭</span>
              <p>No jobs found. Try different boards or job title.</p>
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr className={styles.theadRow}>
                    <th className={styles.th}>Board</th>
                    <th className={styles.th}>Job Title</th>
                    <th className={styles.th}>Company</th>
                    <th className={styles.th}>Location</th>
                    <th className={styles.th}>Salary</th>
                    <th className={styles.th}>URL</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((job, idx) => (
                    <tr key={idx} className={styles.tbodyRow}>
                      <td className={styles.td}>
                        <span className={styles.boardBadge}>{job.board}</span>
                      </td>
                      <td className={`${styles.td} ${styles.tdBold}`}>{job.job_title}</td>
                      <td className={styles.td}>{job.company || '—'}</td>
                      <td className={styles.td}>{job.location || '—'}</td>
                      <td className={styles.td}>{job.salary || '—'}</td>
                      <td className={styles.td}>
                        {job.url ? (
                          <a
                            href={job.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.urlLink}
                          >
                            View
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
  );
}
