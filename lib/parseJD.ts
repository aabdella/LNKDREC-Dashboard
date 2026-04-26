/**
 * parseJD.ts — Pure TypeScript JD parser. Zero API calls, <5ms runtime.
 *
 * Returns a structured ParsedJD object used by both quick-source and deep-search
 * to build smarter, more varied search queries.
 *
 * Usage:
 *   import { parseJD } from '@/lib/parseJD';
 *   const parsed = parseJD(jdText);
 */

import { TECH_FAMILIES } from '@/lib/techFamilies';

// ─── Output Type ──────────────────────────────────────────────────────────────

export type ParsedJD = {
  role_title: string;           // Best extracted role title
  seniority: 'junior' | 'mid' | 'senior' | 'lead';
  seniority_prefix: string;     // e.g. "Senior", "Lead", "Head of"
  must_have_skills: string[];   // Matched skills from flat skills list
  skill_aliases: string[];      // Expanded synonyms for must_have_skills
  industry: string | null;      // e.g. "fintech", "healthtech", null
  location: string;             // e.g. "Egypt", "UAE", ""
  title_variants: string[];     // 3-4 equivalent role title phrasings
};

// ─── Role Taxonomy ────────────────────────────────────────────────────────────
// ~200 common roles — ordered from most specific to most generic so the first
// match wins. Lowercase for case-insensitive scan.

const ROLE_TAXONOMY: string[] = [
  // Engineering — Infra / Platform
  'site reliability engineer', 'sre',
  'platform engineer', 'infrastructure engineer',
  'devops engineer', 'cloud engineer', 'systems engineer',
  'network engineer', 'security engineer', 'devsecops engineer',
  // Engineering — Data
  'machine learning engineer', 'ml engineer', 'ai engineer',
  'data engineer', 'analytics engineer', 'data platform engineer',
  'data scientist', 'data analyst', 'business intelligence engineer',
  'bi developer', 'bi engineer', 'etl developer',
  // Engineering — Software
  'full stack engineer', 'full stack developer', 'fullstack engineer',
  'frontend engineer', 'front-end engineer', 'frontend developer', 'front-end developer',
  'backend engineer', 'back-end engineer', 'backend developer', 'back-end developer',
  'software engineer', 'software developer', 'software architect',
  'solutions architect', 'enterprise architect', 'technical architect',
  'principal engineer', 'staff engineer',
  'embedded engineer', 'firmware engineer', 'systems programmer',
  // Engineering — Mobile
  'ios engineer', 'ios developer', 'android engineer', 'android developer',
  'mobile engineer', 'mobile developer', 'react native developer',
  'flutter developer',
  // Engineering — QA / Test
  'qa engineer', 'quality assurance engineer', 'test engineer',
  'automation engineer', 'sdet',
  // Engineering — AI / Research
  'research engineer', 'applied scientist', 'research scientist',
  'nlp engineer', 'computer vision engineer', 'llm engineer',
  // Product & Design
  'product manager', 'senior product manager', 'product owner',
  'technical product manager', 'growth product manager',
  'ui/ux designer', 'ux designer', 'ui designer', 'product designer',
  'graphic designer', 'visual designer', 'brand designer',
  'motion designer', 'motion graphics designer',
  'art director', 'creative director', 'design lead',
  // Data / Analytics
  'growth analyst', 'marketing analyst', 'financial analyst',
  'product analyst', 'risk analyst', 'operations analyst',
  // Management & Leadership
  'engineering manager', 'vp of engineering', 'cto',
  'head of engineering', 'head of product', 'head of design',
  'head of data', 'head of ai', 'head of platform',
  'director of engineering', 'director of product',
  'tech lead', 'technical lead', 'team lead',
  // Marketing / Growth
  'performance marketing manager', 'growth marketer', 'seo specialist',
  'content marketer', 'digital marketer', 'social media manager',
  'brand manager', 'marketing manager',
  // Operations / Finance
  'operations manager', 'project manager', 'program manager',
  'scrum master', 'agile coach',
  'finance manager', 'financial controller', 'accountant',
  'hr manager', 'talent acquisition specialist', 'recruiter',
  // Sales / BD
  'account executive', 'sales manager', 'business development manager',
  'customer success manager', 'solutions engineer', 'pre-sales engineer',
];

// ─── Flat Skills List (extends TECH_FAMILIES with aliases & extras) ───────────

const FLAT_SKILLS: string[] = [
  // Languages
  'Python', 'Go', 'Golang', 'Rust', 'Java', 'C++', 'C#', 'TypeScript', 'JavaScript',
  'PHP', 'Ruby', 'Scala', 'Kotlin', 'Swift', 'Bash', 'Shell', 'R', 'Elixir', 'Erlang',
  // ML / AI
  'PyTorch', 'TensorFlow', 'JAX', 'Keras', 'scikit-learn', 'XGBoost', 'LightGBM',
  'Hugging Face', 'ONNX', 'MLflow', 'LangChain', 'LlamaIndex', 'OpenAI', 'Stable Diffusion',
  'CUDA', 'GPU', 'NCCL', 'MPI', 'Slurm', 'HPC',
  // Cloud
  'AWS', 'GCP', 'Azure', 'EC2', 'S3', 'Lambda', 'GKE', 'EKS', 'AKS', 'Cloudflare',
  // Containers / Infra
  'Docker', 'Kubernetes', 'K8s', 'Helm', 'Terraform', 'Ansible', 'Pulumi',
  'ArgoCD', 'GitLab CI', 'GitHub Actions', 'Jenkins', 'CircleCI',
  // Observability
  'Prometheus', 'Grafana', 'Datadog', 'New Relic', 'Elasticsearch', 'Kibana',
  'OpenTelemetry', 'Splunk', 'PagerDuty', 'Sentry',
  // Databases
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Cassandra', 'DynamoDB',
  'Snowflake', 'BigQuery', 'Redshift', 'Supabase', 'Firebase', 'ClickHouse',
  // Data / Pipelines
  'Spark', 'Flink', 'Airflow', 'dbt', 'Kafka', 'Hadoop', 'Databricks',
  'Hive', 'Looker', 'Tableau', 'Power BI', 'Metabase',
  // Frontend
  'React', 'Next.js', 'Vue', 'Angular', 'Svelte', 'Tailwind', 'Vite', 'Webpack',
  // Backend
  'Node.js', 'Django', 'FastAPI', 'Flask', 'Spring', 'Laravel', 'Rails',
  'Express', 'NestJS', 'GraphQL', 'REST', 'gRPC',
  // Mobile
  'React Native', 'Flutter', 'iOS', 'Android', 'Expo',
  // Design
  'Figma', 'Sketch', 'Adobe XD', 'Photoshop', 'Illustrator', 'InDesign',
  'After Effects', 'Premiere Pro', 'Blender', 'Cinema 4D',
  // Other
  'Agile', 'Scrum', 'Jira', 'Notion', 'Linear',
  'Stripe', 'Twilio', 'SendGrid', 'Segment',
  'Talkwalker', 'Brandwatch', 'Sprinklr', 'Meltwater',
];

// ─── Synonym / Alias Map ──────────────────────────────────────────────────────
// key = lowercase skill name → value = aliases to also search

const SKILL_ALIASES: Record<string, string[]> = {
  'kubernetes':          ['K8s', 'container orchestration'],
  'k8s':                 ['Kubernetes', 'container orchestration'],
  'react':               ['React.js', 'ReactJS'],
  'next.js':             ['NextJS', 'Next JS'],
  'node.js':             ['NodeJS', 'Node JS'],
  'postgresql':          ['Postgres', 'pg'],
  'mongodb':             ['Mongo', 'NoSQL'],
  'elasticsearch':       ['ES', 'Elastic', 'OpenSearch'],
  'ci/cd':               ['GitHub Actions', 'GitLab CI', 'Jenkins', 'CircleCI'],
  'github actions':      ['CI/CD', 'GitLab CI'],
  'gitlab ci':           ['CI/CD', 'GitHub Actions'],
  'aws':                 ['Amazon Web Services', 'EC2', 'Lambda', 'S3'],
  'gcp':                 ['Google Cloud', 'BigQuery', 'GKE'],
  'azure':               ['Microsoft Azure', 'AKS'],
  'machine learning':    ['ML', 'AI/ML', 'deep learning'],
  'ml':                  ['machine learning', 'AI/ML'],
  'pytorch':             ['deep learning', 'ML framework'],
  'tensorflow':          ['deep learning', 'ML framework'],
  'docker':              ['containerization', 'containers'],
  'terraform':           ['infrastructure as code', 'IaC'],
  'airflow':             ['workflow orchestration', 'data pipelines'],
  'dbt':                 ['data transformation', 'analytics engineering'],
  'kafka':               ['event streaming', 'message queue'],
  'spark':               ['distributed computing', 'big data'],
  'figma':               ['UI design', 'product design', 'prototyping'],
  'photoshop':           ['Adobe Creative Suite', 'image editing'],
  'illustrator':         ['Adobe Creative Suite', 'vector design'],
  'after effects':       ['motion graphics', 'Adobe Creative Suite'],
  'react native':        ['cross-platform mobile', 'mobile development'],
  'flutter':             ['cross-platform mobile', 'Dart'],
  'python':              ['py'],
  'golang':              ['Go'],
  'typescript':          ['TS', 'JavaScript'],
  'graphql':             ['API', 'query language'],
  'rest':                ['RESTful', 'REST API'],
  'talkwalker':          ['social listening', 'media monitoring'],
  'brandwatch':          ['social listening', 'media analytics'],
  'sprinklr':            ['social media management', 'media analytics'],
};

// ─── Seniority Patterns ────────────────────────────────────────────────────────

type Seniority = 'junior' | 'mid' | 'senior' | 'lead';

const SENIORITY_RULES: Array<{ patterns: RegExp[]; level: Seniority; prefix: string }> = [
  {
    patterns: [/head\s+of/i, /vp\s+of/i, /director\s+of/i, /chief\s+/i, /cto\b/i],
    level: 'lead', prefix: 'Head of',
  },
  {
    patterns: [/\blead\b/i, /\bstaff\b/i, /\bprincipal\b/i, /tech\s+lead/i, /technical\s+lead/i],
    level: 'lead', prefix: 'Lead',
  },
  {
    patterns: [/\bsenior\b/i, /\bsr\b/i, /5\s*\+\s*years?/i, /6\s*\+\s*years?/i, /7\s*\+\s*years?/i, /8\s*\+\s*years?/i, /10\s*\+\s*years?/i],
    level: 'senior', prefix: 'Senior',
  },
  {
    patterns: [/\bjunior\b/i, /\bjr\b/i, /\bentry.level\b/i, /\bfresh.grad/i, /\btrainee\b/i, /\bintern\b/i, /0.?2\s*years?/i, /1.?2\s*years?/i],
    level: 'junior', prefix: 'Junior',
  },
  {
    patterns: [/3.?5\s*years?/i, /2.?4\s*years?/i, /\bmid.level\b/i, /\bintermediate\b/i],
    level: 'mid', prefix: '',
  },
];

// ─── Industry Buckets ─────────────────────────────────────────────────────────

const INDUSTRY_BUCKETS: Record<string, string[]> = {
  fintech:    ['payment', 'banking', 'wallet', 'kyc', 'aml', 'lending', 'neobank', 'fintech', 'financial services', 'remittance', 'open banking', 'card issuing'],
  healthtech: ['emr', 'ehr', 'clinical', 'hipaa', 'patient', 'telemedicine', 'pharma', 'healthtech', 'medical', 'hospital', 'diagnostics', 'biotech'],
  ecommerce:  ['marketplace', 'checkout', 'cart', 'sku', 'fulfillment', 'shopify', 'inventory', 'e-commerce', 'ecommerce', 'retail tech', 'last-mile'],
  media:      ['streaming', 'content', 'cms', 'editorial', 'broadcast', 'ott', 'publishing', 'media', 'newsroom', 'podcast', 'subscription'],
  logistics:  ['fleet', 'routing', 'last-mile', 'warehouse', 'dispatch', 'tracking', 'freight', 'logistics', 'supply chain', 'shipment', '3pl'],
  adtech:     ['dsp', 'ssp', 'rtb', 'programmatic', 'impression', 'cpm', 'attribution', 'adtech', 'ad tech', 'demand side', 'supply side'],
  edtech:     ['lms', 'curriculum', 'e-learning', 'elearning', 'student', 'course', 'assessment', 'tutoring', 'edtech', 'school', 'university', 'academy'],
  proptech:   ['real estate', 'property', 'proptech', 'listing', 'mortgage', 'rent', 'lease', 'tenant', 'landlord'],
  traveltech: ['booking', 'hotel', 'flight', 'travel', 'tourism', 'reservation', 'hospitality', 'gds', 'pms'],
  hrtech:     ['hrms', 'hris', 'payroll', 'recruitment', 'ats', 'onboarding', 'performance review', 'hrtech', 'workforce'],
  mediaanalytics: ['social listening', 'media monitoring', 'talkwalker', 'brandwatch', 'sprinklr', 'meltwater', 'mention', 'media analytics', 'sentiment analysis', 'earned media'],
  gaming:     ['game engine', 'unity', 'unreal', 'gaming', 'multiplayer', 'matchmaking', 'game server', 'liveops'],
  cybersecurity: ['penetration testing', 'pentest', 'soc', 'siem', 'threat intelligence', 'zero trust', 'iam', 'cybersecurity', 'vulnerability', 'red team'],
};

// ─── Title Variants ────────────────────────────────────────────────────────────
// Maps a canonical role fragment to a list of equivalent phrasings

const TITLE_VARIANT_MAP: Array<{ match: RegExp; variants: string[] }> = [
  { match: /data\s+engineer/i,          variants: ['Analytics Engineer', 'Data Platform Engineer', 'ETL Developer'] },
  { match: /machine\s+learning/i,       variants: ['ML Engineer', 'AI Engineer', 'Applied Scientist'] },
  { match: /software\s+engineer/i,      variants: ['Software Developer', 'Backend Engineer', 'Full Stack Engineer'] },
  { match: /frontend|front.end/i,       variants: ['Front End Developer', 'UI Engineer', 'React Developer'] },
  { match: /backend|back.end/i,         variants: ['Back End Developer', 'Server Side Engineer', 'API Engineer'] },
  { match: /full.?stack/i,              variants: ['Full Stack Developer', 'Frontend & Backend Engineer'] },
  { match: /devops/i,                   variants: ['Platform Engineer', 'Infrastructure Engineer', 'SRE'] },
  { match: /site.reliability|sre/i,     variants: ['DevOps Engineer', 'Platform Engineer', 'Infrastructure Engineer'] },
  { match: /product\s+manager/i,        variants: ['Product Owner', 'Technical Product Manager', 'PM'] },
  { match: /product\s+designer/i,       variants: ['UX Designer', 'UI/UX Designer', 'Interaction Designer'] },
  { match: /ux\s+designer/i,            variants: ['Product Designer', 'UI/UX Designer', 'UX Researcher'] },
  { match: /graphic\s+designer/i,       variants: ['Visual Designer', 'Brand Designer', 'Creative Designer'] },
  { match: /motion/i,                   variants: ['Motion Graphics Designer', 'After Effects Artist', 'Video Editor'] },
  { match: /data\s+scientist/i,         variants: ['ML Engineer', 'Research Scientist', 'Data Analyst'] },
  { match: /data\s+analyst/i,           variants: ['Business Analyst', 'Analytics Engineer', 'BI Analyst'] },
  { match: /cloud\s+engineer/i,         variants: ['Infrastructure Engineer', 'Platform Engineer', 'DevOps Engineer'] },
  { match: /mobile\s+(engineer|developer)/i, variants: ['iOS Developer', 'Android Developer', 'React Native Developer'] },
  { match: /ios\s+(engineer|developer)/i,    variants: ['Mobile Developer', 'Swift Developer'] },
  { match: /android\s+(engineer|developer)/i,variants: ['Mobile Developer', 'Kotlin Developer'] },
  { match: /security\s+engineer/i,      variants: ['DevSecOps Engineer', 'Cybersecurity Engineer', 'Penetration Tester'] },
  { match: /nlp\s+engineer/i,           variants: ['NLP Scientist', 'Computational Linguist', 'ML Engineer'] },
  { match: /engineering\s+manager/i,    variants: ['Tech Lead', 'Head of Engineering', 'Director of Engineering'] },
  { match: /social\s+media\s+manager/i, variants: ['Community Manager', 'Digital Marketing Manager'] },
  { match: /performance\s+marketing/i,  variants: ['Growth Marketer', 'Paid Media Specialist', 'Digital Marketing Manager'] },
];

// ─── Location Extraction ───────────────────────────────────────────────────────

function extractLocation(jd: string): string {
  const lower = jd.toLowerCase();
  if (lower.includes('saudi') || lower.includes('ksa') || lower.includes('riyadh') || lower.includes('jeddah')) return 'Saudi';
  if (lower.includes('gcc') || lower.includes('gulf')) return 'GCC';
  if (lower.includes('uae') || lower.includes('dubai') || lower.includes('abu dhabi') || lower.includes('emirates')) return 'UAE';
  if (lower.includes('egypt') || lower.includes('cairo') || lower.includes('alexandria') || lower.includes('giza')) return 'Egypt';
  if (lower.includes('jordan') || lower.includes('amman')) return 'Jordan';
  if (lower.includes('lebanon') || lower.includes('beirut')) return 'Lebanon';
  if (lower.includes('uk') || lower.includes('london') || lower.includes('united kingdom')) return 'UK';
  return '';
}

// ─── Core Parser ──────────────────────────────────────────────────────────────

export function parseJD(jd: string): ParsedJD {
  const jdLower = jd.toLowerCase();

  // ── 1. Role title — scan taxonomy for first match ─────────────────────
  let role_title = '';
  for (const role of ROLE_TAXONOMY) {
    // Use word-boundary matching to avoid partial hits
    const re = new RegExp(`\\b${role.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(jd)) {
      // Preserve original casing from JD if possible, otherwise title-case
      const match = jd.match(re);
      role_title = match ? match[0] : role.replace(/\b\w/g, c => c.toUpperCase());
      break;
    }
  }
  // Fallback: first non-empty line > 4 chars that isn't a section header
  if (!role_title) {
    const lines = jd.split('\n').map(l => l.trim()).filter(l => l.length > 4);
    role_title = lines[0] || 'Professional';
  }

  // ── 2. Seniority ──────────────────────────────────────────────────────
  let seniority: Seniority = 'mid';
  let seniority_prefix = '';
  for (const rule of SENIORITY_RULES) {
    if (rule.patterns.some(p => p.test(jd))) {
      seniority = rule.level;
      seniority_prefix = rule.prefix;
      break;
    }
  }

  // ── 3. Skills — scan flat skills list ────────────────────────────────
  const must_have_skills: string[] = [];
  for (const skill of FLAT_SKILLS) {
    const re = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (re.test(jd)) {
      must_have_skills.push(skill);
    }
  }
  // Also pull from TECH_FAMILIES for broader coverage
  for (const terms of Object.values(TECH_FAMILIES)) {
    for (const term of terms) {
      if (!must_have_skills.some(s => s.toLowerCase() === term.toLowerCase())) {
        const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}\\b`, 'i');
        if (re.test(jd)) must_have_skills.push(term);
      }
    }
  }

  // ── 4. Skill aliases ─────────────────────────────────────────────────
  const skill_aliases: string[] = [];
  for (const skill of must_have_skills) {
    const aliases = SKILL_ALIASES[skill.toLowerCase()];
    if (aliases) {
      for (const alias of aliases) {
        if (!skill_aliases.includes(alias) && !must_have_skills.includes(alias)) {
          skill_aliases.push(alias);
        }
      }
    }
  }

  // ── 5. Industry ───────────────────────────────────────────────────────
  let industry: string | null = null;
  let industryScore = 0;
  for (const [name, keywords] of Object.entries(INDUSTRY_BUCKETS)) {
    const score = keywords.filter(kw => jdLower.includes(kw)).length;
    if (score > industryScore) {
      industryScore = score;
      industry = name;
    }
  }
  if (industryScore === 0) industry = null;

  // ── 6. Location ───────────────────────────────────────────────────────
  const location = extractLocation(jd);

  // ── 7. Title variants ─────────────────────────────────────────────────
  const title_variants: string[] = [];
  const titleWithPrefix = seniority_prefix ? `${seniority_prefix} ${role_title}` : role_title;

  // Add seniority-prefixed version if not already present
  if (seniority_prefix && !role_title.toLowerCase().startsWith(seniority_prefix.toLowerCase())) {
    title_variants.push(titleWithPrefix);
  }

  // Add known variant phrasings
  for (const entry of TITLE_VARIANT_MAP) {
    if (entry.match.test(role_title) || entry.match.test(jd)) {
      for (const variant of entry.variants) {
        const full = seniority_prefix ? `${seniority_prefix} ${variant}` : variant;
        if (!title_variants.includes(full) && full !== role_title) {
          title_variants.push(full);
        }
        if (title_variants.length >= 4) break;
      }
      if (title_variants.length >= 4) break;
    }
  }

  return {
    role_title,
    seniority,
    seniority_prefix,
    must_have_skills: must_have_skills.slice(0, 12),
    skill_aliases: skill_aliases.slice(0, 10),
    industry,
    location,
    title_variants: title_variants.slice(0, 4),
  };
}
