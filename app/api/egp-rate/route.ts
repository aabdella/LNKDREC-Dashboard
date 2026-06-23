import { NextResponse } from 'next/server';

const CBE_URL =
  'https://www.cbe.org.eg/en/economic-research/statistics/cbe-exchange-rates';
const YAHOO_URL =
  'https://query1.finance.yahoo.com/v7/finance/quote?symbols=USDEGP%3DX';

// Simple in-process cache: revalidate at most once per hour server-side
let serverCache: { rate: number; date: string; fetchedAt: number; source?: string } | null = null;
const SERVER_TTL_MS = 60 * 60 * 1000; // 1 hour

async function fetchCBE(now: number): Promise<{ rate: number; date: string; fetchedAt: number; source: string }> {
  const res = await fetch(CBE_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LNKDREC/1.0)' },
    next: { revalidate: 3600 },
  });

  if (!res.ok) throw new Error(`CBE fetch failed: ${res.status}`);

  const html = await res.text();

  // CBE page lists currencies in a table; find the USD row.
  // Pattern: "US Dollar" followed by buy and sell numbers in the markup.
  const usdMatch = html.match(
    /US\s+Dollar[\s\S]{0,300}?([\d]+\.[\d]{4})[\s\S]{0,100}?([\d]+\.[\d]{4})/i
  );

  if (!usdMatch) throw new Error('USD row not found in CBE page');

  const buy = parseFloat(usdMatch[1]);
  const sell = parseFloat(usdMatch[2]);

  if (isNaN(sell) || sell < 10) throw new Error('Parsed sell rate looks invalid');
  if (isNaN(buy) || buy < 10) throw new Error('Parsed buy rate looks invalid');

  // Extract the "Rates for Date:" string
  const dateMatch = html.match(/Rates\s+for\s+Date:\s*([\d/]+)/i);
  const date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];

  // Use sell rate — correct for EGP→USD salary conversions
  return { rate: sell, date, fetchedAt: now, source: 'CBE' };
}

async function fetchYahoo(now: number): Promise<{ rate: number; date: string; fetchedAt: number; source: string }> {
  const res = await fetch(YAHOO_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LNKDREC/1.0)' },
  });

  if (!res.ok) throw new Error(`Yahoo fetch failed: ${res.status}`);

  const data = await res.json();
  const quote = data?.quoteResponse?.result?.[0];

  if (!quote?.regularMarketPrice) throw new Error('Yahoo response invalid');

  const rate = quote.regularMarketPrice;
  if (isNaN(rate) || rate < 10) throw new Error('Parsed Yahoo rate looks invalid');

  const date = quote.regularMarketTime
    ? new Date(quote.regularMarketTime * 1000).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  return { rate, date, fetchedAt: now, source: 'Yahoo Finance' };
}

export async function GET() {
  const now = Date.now();

  if (serverCache && now - serverCache.fetchedAt < SERVER_TTL_MS) {
    return NextResponse.json(serverCache);
  }

  let result: { rate: number; date: string; fetchedAt: number; source?: string };
  let sourceErrors: string[] = [];

  // Try CBE first
  try {
    result = await fetchCBE(now);
  } catch (err) {
    sourceErrors.push(`CBE: ${err instanceof Error ? err.message : String(err)}`);

    // Fall back to Yahoo
    try {
      result = await fetchYahoo(now);
    } catch (yahooErr) {
      sourceErrors.push(`Yahoo: ${yahooErr instanceof Error ? yahooErr.message : String(yahooErr)}`);

      // Both failed - use stale cache if available
      if (serverCache) {
        return NextResponse.json({ ...serverCache, stale: true, sourceErrors }, { status: 200 });
      }

      console.error('[egp-rate] All sources failed:', sourceErrors);
      return NextResponse.json(
        { error: 'Failed to fetch exchange rate from all sources', detail: sourceErrors },
        { status: 502 }
      );
    }
  }

  serverCache = result;
  return NextResponse.json(result);
}
