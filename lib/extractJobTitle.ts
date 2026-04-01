/**
 * extractJobTitle — shared JD title extractor
 *
 * Strategy (4-pass):
 *  Pass 1: Look for an explicit label line: "Job Title:", "Position:", "Role:", "Title:"
 *  Pass 1.5: Scan for natural-language role mentions: "seeking a Senior Graphic Designer"
 *  Pass 2: Look for a short, ALL-CAPS or Title-Case line that reads like a role
 *           (≥ 2 words, ≤ 70 chars, no trailing colon = not a section header)
 *  Pass 3: Fallback — first substantive line that is not a known boilerplate header
 *
 * Returns: { title: string, extractedFrom: 'label' | 'seeking-pattern' | 'title-case-line' | 'fallback-line' | 'none' }
 */

const HEADER_BLOCKLIST = new Set([
  'role summary', 'about us', 'about the role', 'about the company',
  'job summary', 'job overview', 'overview', 'summary', 'responsibilities',
  'requirements', 'qualifications', 'duties', 'purpose', 'what you will do',
  'what we are looking for', 'who we are', 'who you are', 'the role',
  'key responsibilities', 'your role', 'what you need', 'skills required',
  'nice to have', 'benefits', 'compensation',
]);

export function extractJobTitle(jd: string): { title: string; extractedFrom: 'label' | 'seeking-pattern' | 'title-case-line' | 'fallback-line' | 'none' } {
  const lines = jd
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  // ── Pass 1: explicit label ──────────────────────────────────────────────
  for (const line of lines) {
    const m = line.match(
      /^(?:job\s*title|position|role|title|vacancy|post(?:ing)?)\s*[:\-–|]+\s*(.+)/i
    );
    if (m && m[1].trim().length >= 3) {
      return { title: m[1].trim().replace(/\s+/g, ' '), extractedFrom: 'label' };
    }
  }

  // ── Pass 1.5: seeking/hiring pattern in body text ───────────────────────
  // Matches: "seeking a Senior Graphic Designer", "looking for a Senior Software Engineer", etc.
  // Extracts just the role name (2–5 consecutive Title-Case words after "a/an")
  const seekingPattern = /\b(?:seeking|looking for|hiring|need|join us as|as)\s+(?:a|an)\s+((?:[A-Z][a-z]+\s+){1,4}[A-Z][a-z]+)/g;
  let match: RegExpExecArray | null;
  while ((match = seekingPattern.exec(jd)) !== null) {
    const extracted = match[1].trim();
    // Validate: must be ≥2 words, ≤60 chars, not a sentence fragment
    const wordCount = extracted.split(/\s+/).length;
    if (wordCount >= 2 && extracted.length <= 60 && !extracted.includes(',')) {
      return { title: extracted.replace(/\s+/g, ' '), extractedFrom: 'seeking-pattern' };
    }
  }

  // ── Pass 2: short Title-Case / ALL-CAPS role-like line ──────────────────
  for (const line of lines) {
    const lower = line.toLowerCase().replace(/:$/, '').trim();

    // Skip known boilerplate headers
    if (HEADER_BLOCKLIST.has(lower)) continue;

    // Must not end with colon (section headers do)
    if (line.endsWith(':')) continue;

    // Must be short and multi-word
    const wordCount = line.split(/\s+/).length;
    if (wordCount < 2 || line.length > 70) continue;

    // Accept if: Title Case, ALL CAPS, or contains a known seniority/role keyword
    const isTitleCase = line === line.replace(/\b\w/g, c => c.toUpperCase()).replace(/\b\w+/g, w => w[0].toUpperCase() + w.slice(1));
    const isAllCaps   = line === line.toUpperCase() && /[A-Z]/.test(line);
    const hasRoleWord = /\b(engineer|developer|manager|designer|analyst|director|lead|architect|officer|specialist|consultant|coordinator|executive|head of|vp of|cto|cfo|coo)\b/i.test(line);

    if (isTitleCase || isAllCaps || hasRoleWord) {
      return { title: line.replace(/\s+/g, ' '), extractedFrom: 'title-case-line' };
    }
  }

  // ── Pass 3: first non-boilerplate, non-header line ──────────────────────
  for (const line of lines) {
    const lower = line.toLowerCase().replace(/:$/, '').trim();
    if (HEADER_BLOCKLIST.has(lower)) continue;
    if (line.endsWith(':')) continue;
    const wordCount = line.split(/\s+/).length;
    if (wordCount >= 2 && line.length <= 80) {
      return { title: line.replace(/\s+/g, ' '), extractedFrom: 'fallback-line' };
    }
  }

  return { title: '', extractedFrom: 'none' };
}
