import { NextResponse } from 'next/server';

// Primary: open.er-api.com — free, no key, daily updates
const ER_API_URL = 'https://open.er-api.com/v6/latest/USD';

// Fallback: fawazahmed0 currency-api via jsDelivr CDN — free, no key
const FAWAZ_API_URL =
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json';

// Simple in-process cache: revalidate at most once per hour server-side
let serverCache: { rate: number; date: string; fetchedAt: number; source: string } | null = null;
const SERVER_TTL_MS = 60 * 60 * 1000; // 1 hour

async function fetchErApi(
  now: number
): Promise<{ rate: number; date: string; fetchedAt: number; source: string }> {
  const res = await fetch(ER_API_URL, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`open.er-api.com fetch failed: ${res.status}`);

  const data = await res.json();
  const rate = data?.rates?.EGP;
  if (!rate || typeof rate !== 'number' || rate < 10)
    throw new Error('open.er-api.com: invalid EGP rate');

  const date: string =
    data.time_last_update_utc
      ? new Date(data.time_last_update_utc).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

  return { rate, date, fetchedAt: now, source: 'ExchangeRate-API' };
}

async function fetchFawaz(
  now: number
): Promise<{ rate: number; date: string; fetchedAt: number; source: string }> {
  const res = await fetch(FAWAZ_API_URL);
  if (!res.ok) throw new Error(`fawazahmed0 fetch failed: ${res.status}`);

  const data = await res.json();
  const rate = data?.usd?.egp;
  if (!rate || typeof rate !== 'number' || rate < 10)
    throw new Error('fawazahmed0: invalid EGP rate');

  const date: string = data.date ?? new Date().toISOString().split('T')[0];

  return { rate, date, fetchedAt: now, source: 'ExchangeRate-API (CDN)' };
}

export async function GET() {
  const now = Date.now();

  // Serve from in-process cache if still fresh
  if (serverCache && now - serverCache.fetchedAt < SERVER_TTL_MS) {
    return NextResponse.json(serverCache);
  }

  const sourceErrors: string[] = [];
  let result: { rate: number; date: string; fetchedAt: number; source: string } | null = null;

  // Try primary source
  try {
    result = await fetchErApi(now);
  } catch (err) {
    sourceErrors.push(`primary: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Try fallback if primary failed
  if (!result) {
    try {
      result = await fetchFawaz(now);
    } catch (err) {
      sourceErrors.push(`fallback: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Both failed — serve stale cache rather than erroring
  if (!result) {
    if (serverCache) {
      console.warn('[egp-rate] All sources failed, serving stale cache:', sourceErrors);
      return NextResponse.json({ ...serverCache, stale: true, sourceErrors });
    }
    console.error('[egp-rate] All sources failed, no cache available:', sourceErrors);
    return NextResponse.json(
      { error: 'Failed to fetch exchange rate', detail: sourceErrors },
      { status: 502 }
    );
  }

  serverCache = result;
  return NextResponse.json(result);
}
