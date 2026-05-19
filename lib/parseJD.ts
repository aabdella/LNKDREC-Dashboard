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

export type SearchHints = {
  niche_terms: string[];      // Rare/specific tools that strongly discriminate candidates
  role_concept: string;       // Compact role label for compound queries e.g. "Fintech Backend Engineer"
  must_include: string[];     // Terms that MUST appear in strong-match queries
  company_targets: string[];  // Company names extracted from JD (e.g. "at Company X", "experience with Y")
};

export type ParsedJD = {
  role_title: string;           // Best extracted role title
  seniority: 'junior' | 'mid' | 'senior' | 'lead';
  seniority_prefix: string;     // e.g. "Senior", "Lead", "Head of"
  must_have_skills: string[];   // Top skills ranked by rarity/specificity
  ranked_skills: RankedSkill[]; // All matched skills with rarity scores
  skill_aliases: string[];      // Expanded synonyms for must_have_skills
  industry: string | null;      // e.g. "fintech", "healthtech", null — only set if score >= 2
  location: string;             // e.g. "Egypt", "UAE", "" (empty = undetected, don't default)
  title_variants: string[];     // 3-4 equivalent role title phrasings
  search_hints: SearchHints;    // Ready-made query building blocks
};

export type RankedSkill = {
  skill: string;
  rarity: 'niche' | 'domain' | 'common';
  score: number;  // 3 = niche, 2 = domain-specific, 1 = common/generic
};

// ─── Skill Rarity Tiers ───────────────────────────────────────────────────────
// niche   (score 3): platform-specific tools, rare frameworks — very few people have these
// domain  (score 2): domain-specific but broadly known (e.g. Kafka, dbt, Airflow)
// common  (score 1): every engineer knows these (Python, AWS, Docker, React, etc.)

export const SKILL_RARITY: Record<string, 3 | 2 | 1> = {
  // ── Niche: platform-specific, media analytics, very specific tools ──────
  'Talkwalker': 3, 'Brandwatch': 3, 'Sprinklr': 3, 'Meltwater': 3,
  'JAX': 3, 'NCCL': 3, 'MPI': 3, 'Slurm': 3, 'HPC': 3,
  'CUDA': 3, 'OpenTelemetry': 3, 'Pulumi': 3, 'ArgoCD': 3,
  'LangChain': 3, 'LlamaIndex': 3, 'Stable Diffusion': 3, 'ONNX': 3,
  'MLflow': 3, 'dbt': 3, 'Flink': 3, 'ClickHouse': 3, 'CockroachDB': 3,
  'VictoriaMetrics': 3, 'Loki': 3, 'Jaeger': 3,
  'Cinema 4D': 3, 'Blender': 3, 'Databricks': 3,
  'Snowflake': 3, 'Redshift': 3, 'BigQuery': 3,
  'Elixir': 3, 'Erlang': 3, 'Rust': 3, 'Scala': 3,
  'gRPC': 3, 'SDET': 3, 'Expo': 3,
  'SendGrid': 3, 'Twilio': 3, 'Segment': 3, 'Stripe': 3,

  // ── Domain-specific: widely known in their domain ────────────────────────
  'Kafka': 2, 'Spark': 2, 'Airflow': 2, 'Hadoop': 2,
  'Terraform': 2, 'Ansible': 2, 'Helm': 2,
  'Kubernetes': 2, 'K8s': 2,
  'PyTorch': 2, 'TensorFlow': 2, 'Keras': 2, 'scikit-learn': 2,
  'XGBoost': 2, 'LightGBM': 2, 'Hugging Face': 2, 'OpenAI': 2,
  'Prometheus': 2, 'Grafana': 2, 'Datadog': 2, 'Elasticsearch': 2,
  'Cassandra': 2, 'DynamoDB': 2, 'MongoDB': 2,
  'GraphQL': 2, 'NestJS': 2, 'FastAPI': 2, 'Django': 2,
  'Flutter': 2, 'React Native': 2,
  'Figma': 2, 'After Effects': 2, 'Illustrator': 2, 'Sketch': 2,
  'Looker': 2, 'Tableau': 2, 'Power BI': 2, 'Metabase': 2,
  'Kotlin': 2, 'Swift': 2, 'Go': 2, 'Golang': 2,
  'Redis': 2, 'PostgreSQL': 2,
  'CircleCI': 2, 'Jenkins': 2, 'GitLab CI': 2, 'GitHub Actions': 2,
  'New Relic': 2, 'Splunk': 2, 'PagerDuty': 2,

  // ── Common: ubiquitous — weak discriminators ──────────────────────────────
  'Python': 1, 'JavaScript': 1, 'TypeScript': 1, 'Java': 1,
  'AWS': 1, 'GCP': 1, 'Azure': 1,
  'Docker': 1, 'React': 1, 'Node.js': 1, 'MySQL': 1,
  'PHP': 1, 'Ruby': 1, 'C#': 1, 'C++': 1,
  'Bash': 1, 'Shell': 1, 'R': 1,
  'REST': 1, 'Agile': 1, 'Scrum': 1, 'Jira': 1, 'Git': 1,
  'Next.js': 1, 'Vue': 1, 'Angular': 1, 'Svelte': 1,
  'Tailwind': 1, 'Vite': 1, 'Webpack': 1,
  'Firebase': 1, 'Supabase': 1,
  'iOS': 1, 'Android': 1,
  'Photoshop': 1, 'InDesign': 1, 'Premiere Pro': 1, 'Adobe XD': 1,
  'Notion': 1, 'Linear': 1,
  'EC2': 1, 'S3': 1, 'Lambda': 1, 'GKE': 1, 'EKS': 1, 'AKS': 1,
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
  if (lower.includes('egypt') || lower.includes('cairo') || lower.includes('alexandria') || lower.includes('giza') || lower.includes('maadi') || lower.includes('heliopolis') || lower.includes('new cairo') || lower.includes('sheikh zayed')) return 'Egypt';
  if (lower.includes('jordan') || lower.includes('amman')) return 'Jordan';
  if (lower.includes('lebanon') || lower.includes('beirut')) return 'Lebanon';
  if (lower.includes('uk') || lower.includes('london') || lower.includes('united kingdom')) return 'UK';
  // Return empty string — callers should default to 'Egypt' only when needed
  return '';
}

// ─── Company Target Extraction ────────────────────────────────────────────────
// Extracts company names from patterns like "experience with X", "worked at X", "from X"

function extractCompanyTargets(jd: string): string[] {
  const companies: string[] = [];
  // Known brand names worth targeting as search anchors
  const KNOWN_BRANDS = [
    'Vodafone', 'Orange', 'Etisalat', 'Telecom Egypt', 'CIB', 'NBE', 'QNB',
    'Majid Al Futtaim', 'Emaar', 'Chalhoub', 'Carrefour', 'Amazon', 'Google', 'Microsoft',
    'McKinsey', 'BCG', 'Deloitte', 'PwC', 'KPMG', 'EY',
    'Talkwalker', 'Brandwatch', 'Sprinklr', 'Meltwater',
    'Jumia', 'OLX', 'Noon', 'Talabat', 'Careem', 'Uber',
    'Instabug', 'Swvl', 'Paymob', 'Fawry', 'ValU',
    'IBM', 'Oracle', 'SAP', 'Salesforce', 'HubSpot',
  ];
  const jdLower = jd.toLowerCase();
  for (const brand of KNOWN_BRANDS) {
    if (jdLower.includes(brand.toLowerCase())) {
      companies.push(brand);
    }
  }
  return [...new Set(companies)].slice(0, 3);
}

// ─── Search Hints Builder ─────────────────────────────────────────────────────

function buildSearchHints(
  role_title: string,
  seniority_prefix: string,
  ranked_skills: RankedSkill[],
  industry: string | null,
  location: string,
  jd: string
): SearchHints {
  // Niche terms: highest-rarity skills that would appear on a candidate's profile
  const niche_terms = ranked_skills
    .filter(s => s.rarity === 'niche')
    .map(s => s.skill)
    .slice(0, 4);

  // Role concept: combine role + industry for compound queries
  const baseTitle = seniority_prefix && !role_title.toLowerCase().startsWith(seniority_prefix.toLowerCase())
    ? `${seniority_prefix} ${role_title}`
    : role_title;

  const INDUSTRY_LABELS: Record<string, string> = {
    fintech: 'Fintech', healthtech: 'Healthtech', ecommerce: 'E-commerce',
    media: 'Media', logistics: 'Logistics', adtech: 'AdTech',
    edtech: 'EdTech', proptech: 'PropTech', traveltech: 'TravelTech',
    hrtech: 'HRTech', mediaanalytics: 'Media Analytics', gaming: 'Gaming',
    cybersecurity: 'Cybersecurity',
  };
  const industryLabel = industry ? INDUSTRY_LABELS[industry] : null;
  const role_concept = industryLabel ? `${industryLabel} ${baseTitle}` : baseTitle;

  // Must-include: top domain or niche skill(s) — these make queries specific
  const must_include = ranked_skills
    .filter(s => s.rarity === 'niche' || s.rarity === 'domain')
    .map(s => s.skill)
    .slice(0, 3);

  const company_targets = extractCompanyTargets(jd);

  return { niche_terms, role_concept, must_include, company_targets };
}

// ─── Core Parser ──────────────────────────────────────────────────────────────

export function parseJD(jd: string): ParsedJD {
  const jdLower = jd.toLowerCase();

  // ── 1. Role title — scan taxonomy for first match ─────────────────────
  let role_title = '';
  for (const role of ROLE_TAXONOMY) {
    const re = new RegExp(`\\b${role.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(jd)) {
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

  // ── 3. Skills — scan flat list + TECH_FAMILIES, then rank by rarity ──
  const rawMatched: string[] = [];
  for (const skill of FLAT_SKILLS) {
    const re = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (re.test(jd)) rawMatched.push(skill);
  }
  for (const terms of Object.values(TECH_FAMILIES)) {
    for (const term of terms) {
      if (!rawMatched.some(s => s.toLowerCase() === term.toLowerCase())) {
        const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}\\b`, 'i');
        if (re.test(jd)) rawMatched.push(term);
      }
    }
  }

  // Rank by rarity score (niche=3 > domain=2 > common=1 > unknown=1)
  const ranked_skills: RankedSkill[] = rawMatched.map(skill => {
    const score = SKILL_RARITY[skill] ?? 1;
    const rarity: RankedSkill['rarity'] = score === 3 ? 'niche' : score === 2 ? 'domain' : 'common';
    return { skill, rarity, score };
  }).sort((a, b) => b.score - a.score);

  // must_have_skills: top 12, ranked by rarity (niche first)
  const must_have_skills = ranked_skills.slice(0, 12).map(s => s.skill);

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

  // ── 5. Industry — require score >= 2 to avoid false positives ────────
  let industry: string | null = null;
  let industryScore = 0;
  for (const [name, keywords] of Object.entries(INDUSTRY_BUCKETS)) {
    const score = keywords.filter(kw => jdLower.includes(kw)).length;
    if (score > industryScore) {
      industryScore = score;
      industry = name;
    }
  }
  // Only accept industry if at least 2 keywords matched (reduces false positives)
  if (industryScore < 2) industry = null;

  // ── 6. Location — empty string = undetected (don't force Egypt) ──────
  const location = extractLocation(jd);

  // ── 7. Title variants ─────────────────────────────────────────────────
  const title_variants: string[] = [];
  const titleWithPrefix = seniority_prefix ? `${seniority_prefix} ${role_title}` : role_title;

  if (seniority_prefix && !role_title.toLowerCase().startsWith(seniority_prefix.toLowerCase())) {
    title_variants.push(titleWithPrefix);
  }

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

  // ── 8. Search hints ───────────────────────────────────────────────────
  const search_hints = buildSearchHints(
    role_title, seniority_prefix, ranked_skills, industry, location, jd
  );

  return {
    role_title,
    seniority,
    seniority_prefix,
    must_have_skills,
    ranked_skills: ranked_skills.slice(0, 20),
    skill_aliases: skill_aliases.slice(0, 10),
    industry,
    location,
    title_variants: title_variants.slice(0, 4),
    search_hints,
  };
}
