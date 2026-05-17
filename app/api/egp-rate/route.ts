import { NextResponse } from 'next/server';

const CBE_URL =
  'https://www.cbe.org.eg/en/economic-research/statistics/cbe-exchange-rates';

// Simple in-process cache: revalidate at most once per hour server-side
let serverCache: { rate: number; date: string; fetchedAt: number } | null = null;
const SERVER_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function GET() {
  const now = Date.now();

  if (serverCache && now - serverCache.fetchedAt < SERVER_TTL_MS) {
    return NextResponse.json(serverCache);
  }

  try {
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

    // Extract the "Rates for Date:" string
    const dateMatch = html.match(/Rates\s+for\s+Date:\s*([\d/]+)/i);
    const date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];

    serverCache = { rate: buy, date, fetchedAt: now };
    return NextResponse.json({ rate: buy, date, buy, sell });
  } catch (err) {
    // If cache exists but stale, still return it with a staleness flag rather than hard-failing
    if (serverCache) {
      return NextResponse.json({ ...serverCache, stale: true }, { status: 200 });
    }
    console.error('[egp-rate] CBE scrape failed:', err);
    return NextResponse.json(
      { error: 'Failed to fetch CBE rate', detail: String(err) },
      { status: 502 }
    );
  }
}
