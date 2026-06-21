import { NextResponse } from 'next/server';

export async function GET() {
  const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID || '';
  const CF_API_TOKEN  = process.env.CF_API_TOKEN  || '';

  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
    return NextResponse.json({
      ok: false,
      error: 'CF_ACCOUNT_ID or CF_API_TOKEN env var is missing',
      CF_ACCOUNT_ID: CF_ACCOUNT_ID ? `${CF_ACCOUNT_ID.slice(0,6)}...` : '(empty)',
      CF_API_TOKEN:  CF_API_TOKEN  ? `${CF_API_TOKEN.slice(0,6)}...`  : '(empty)',
    });
  }

  // Hit a simple public page to test the CF Browser Rendering API
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/browser-rendering/json`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: 'https://example.com',
      prompt: 'What is the title of this page? Return JSON: { "title": "..." }',
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'test', properties: { title: { type: 'string' } } },
      },
    }),
  });

  const data = await res.json();
  return NextResponse.json({
    http_status: res.status,
    cf_success: data.success,
    cf_errors: data.errors,
    cf_result: data.result,
    CF_ACCOUNT_ID: `${CF_ACCOUNT_ID.slice(0,6)}...`,
    CF_API_TOKEN:  `${CF_API_TOKEN.slice(0,6)}...`,
  });
}
