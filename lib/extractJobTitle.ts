/**
 * extractJobTitle — shared JD title extractor
 *
 * Strategy (5-pass):
 *  Pass 1:   Explicit label line: "Job Title:", "Position:", "Role:", "Title:"
 *  Pass 1.5: Natural-language seeking pattern: "seeking a Senior Graphic Designer"
 *  Pass 2:   Short ALL-CAPS or Title-Case role-like line (≤70 chars, ≥2 words)
 *  Pass 3:   First non-boilerplate line (≤80 chars, ≥2 words)
 *  Pass 4:   Full-body frequency scan — most-mentioned [Seniority?] + RoleNoun combo
 *
 * Returns:
 *   title          — extracted role title, empty string if nothing found
 *   extractedFrom  — which pass fired
 *   titleFrequency — how many times the title appeared in Pass 4 (0 for other passes)
 *   techFallback   — top tech/tool terms extracted from JD (used when title = '')
 */

const HEADER_BLOCKLIST = new Set([
  'role summary', 'about us', 'about the role', 'about the company',
  'job summary', 'job overview', 'overview', 'summary', 'responsibilities',
  'requirements', 'qualifications', 'duties', 'purpose', 'what you will do',
  'what we are looking for', 'who we are', 'who you are', 'the role',
  'key responsibilities', 'your role', 'what you need', 'skills required',
  'nice to have', 'benefits', 'compensation',
]);

// Seniority prefixes
const SENIORITY = [
  'Senior', 'Junior', 'Lead', 'Principal', 'Staff', 'Head of',
  'Associate', 'Mid-Level', 'Entry-Level', 'Chief', 'Director of',
];

// Core role nouns — the "anchor" words that define a job family
const ROLE_NOUNS = [
  'Engineer', 'Developer', 'Designer', 'Manager', 'Analyst', 'Architect',
  'Scientist', 'Consultant', 'Specialist', 'Coordinator', 'Director',
  'Officer', 'Executive', 'Recruiter', 'Researcher', 'Administrator',
  'Technician', 'Strategist', 'Producer', 'Writer', 'Editor', 'Lead',
  'Artist', 'Animator', 'Illustrator', 'Photographer', 'Videographer',
];

// Known tech/tool terms for fallback extraction when title is empty
const KNOWN_TECH_TERMS = [
  'Python', 'JavaScript', 'TypeScript', 'Java', 'Go', 'Rust', 'C\\+\\+', 'C#',
  'React', 'Next\\.js', 'Vue', 'Angular', 'Node\\.js', 'Django', 'FastAPI', 'Flask', 'Spring',
  'Docker', 'Kubernetes', 'Terraform', 'Ansible', 'Helm',
  'AWS', 'GCP', 'Azure',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch',
  'Kafka', 'Spark', 'Flink', 'Airflow', 'dbt',
  'PyTorch', 'TensorFlow', 'JAX', 'scikit-learn', 'Pandas', 'NumPy',
  'CUDA', 'GPU', 'NCCL', 'MPI', 'Slurm', 'InfiniBand', 'MLPerf', 'DCGM', 'Nsight',
  'Prometheus', 'Grafana', 'OpenTelemetry', 'Datadog', 'New Relic',
  'Figma', 'Photoshop', 'Illustrator', 'InDesign', 'After Effects', 'Premiere',
  'Sketch', 'Adobe XD',
  'Git', 'GitLab', 'GitHub', 'CI/CD', 'Jenkins',
  'Linux', 'Bash', 'REST', 'GraphQL', 'gRPC',
  'Agile', 'Scrum', 'Jira',
];

export type ExtractedTitle = {
  title: string;
  extractedFrom: 'label' | 'seeking-pattern' | 'title-case-line' | 'fallback-line' | 'frequency-scan' | 'none';
  titleFrequency: number;
  techFallback: string[];
};

export function extractJobTitle(jd: string): ExtractedTitle {
  const lines = jd.split('\n').map(l => l.trim()).filter(Boolean);

  // ── Pass 1: explicit label ──────────────────────────────────────────────
  for (const line of lines) {
    const m = line.match(
      /^(?:job\s*title|position|role|title|vacancy|post(?:ing)?)\s*[:\-–|]+\s*(.+)/i
    );
    if (m && m[1].trim().length >= 3) {
      return { title: m[1].trim().replace(/\s+/g, ' '), extractedFrom: 'label', titleFrequency: 0, techFallback: [] };
    }
  }

  // ── Pass 1.5: seeking/hiring natural-language pattern ──────────────────
  const seekingPattern = /\b(?:seeking|looking for|hiring|need|join us as|as)\s+(?:a|an)\s+((?:[A-Z][a-z]+\s+){1,4}[A-Z][a-z]+)/g;
  let sm: RegExpExecArray | null;
  while ((sm = seekingPattern.exec(jd)) !== null) {
    const extracted = sm[1].trim();
    const wordCount = extracted.split(/\s+/).length;
    if (wordCount >= 2 && extracted.length <= 60 && !extracted.includes(',')) {
      return { title: extracted.replace(/\s+/g, ' '), extractedFrom: 'seeking-pattern', titleFrequency: 0, techFallback: [] };
    }
  }

  // ── Pass 2: short Title-Case / ALL-CAPS role-like line ──────────────────
  for (const line of lines) {
    const lower = line.toLowerCase().replace(/:$/, '').trim();
    if (HEADER_BLOCKLIST.has(lower)) continue;
    if (line.endsWith(':')) continue;
    const wordCount = line.split(/\s+/).length;
    if (wordCount < 2 || line.length > 70) continue;
    const isAllCaps  = line === line.toUpperCase() && /[A-Z]/.test(line);
    const hasRoleWord = /\b(engineer|developer|manager|designer|analyst|director|lead|architect|officer|specialist|consultant|coordinator|executive|head of|vp of|cto|cfo|coo)\b/i.test(line);
    if (isAllCaps || hasRoleWord) {
      return { title: line.replace(/\s+/g, ' '), extractedFrom: 'title-case-line', titleFrequency: 0, techFallback: [] };
    }
  }

  // ── Pass 3: first non-boilerplate line ─────────────────────────────────
  for (const line of lines) {
    const lower = line.toLowerCase().replace(/:$/, '').trim();
    if (HEADER_BLOCKLIST.has(lower)) continue;
    if (line.endsWith(':')) continue;
    if (line.split(/\s+/).length >= 2 && line.length <= 80) {
      return { title: line.replace(/\s+/g, ' '), extractedFrom: 'fallback-line', titleFrequency: 0, techFallback: [] };
    }
  }

  // ── Pass 4: full-body frequency scan ───────────────────────────────────
  // Build all [Seniority + RoleNoun] and [RoleNoun] patterns and count occurrences
  const freq: Record<string, number> = {};
  const jdText = jd;

  for (const roleNoun of ROLE_NOUNS) {
    // With seniority prefix
    for (const seniority of SENIORITY) {
      const phrase = `${seniority} ${roleNoun}`;
      const re = new RegExp(`\\b${phrase}\\b`, 'gi');
      const count = (jdText.match(re) || []).length;
      if (count > 0) freq[phrase] = (freq[phrase] || 0) + count;
    }
    // Without seniority prefix (bare role noun)
    const re = new RegExp(`\\b${roleNoun}\\b`, 'gi');
    const count = (jdText.match(re) || []).length;
    if (count > 0) freq[roleNoun] = (freq[roleNoun] || 0) + count;
  }

  // Pick the highest-frequency term — prefer seniority+role combos over bare nouns
  const sorted = Object.entries(freq)
    .sort((a, b) => {
      // Multi-word phrases win ties over single words
      if (b[1] === a[1]) return b[0].split(' ').length - a[0].split(' ').length;
      return b[1] - a[1];
    });

  // Extract tech fallback regardless (used if even Pass 4 fails)
  const techFallback: string[] = [];
  for (const term of KNOWN_TECH_TERMS) {
    const re = new RegExp(`\\b${term}\\b`, 'i');
    if (re.test(jdText)) techFallback.push(term.replace(/\\\+/g, '+').replace(/\\\./g, '.'));
  }

  if (sorted.length > 0) {
    const [bestTitle, count] = sorted[0];
    return {
      title: bestTitle,
      extractedFrom: 'frequency-scan',
      titleFrequency: count,
      techFallback,
    };
  }

  // ── All passes failed — return tech fallback only ──────────────────────
  return { title: '', extractedFrom: 'none', titleFrequency: 0, techFallback };
}
