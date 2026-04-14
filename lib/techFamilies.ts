/**
 * techFamilies.ts — shared tech/discipline family map
 *
 * Used by the internal matching engine to score candidates on tech overlap
 * even when exact terms don't match (e.g. PyTorch ↔ TensorFlow = same family).
 *
 * Scoring:
 *   Exact hit  = 1.0
 *   Family hit = 0.5
 *   No hit     = 0.0
 *
 * To add a new family or term: edit TECH_FAMILIES below.
 * Import anywhere with: import { getTechFamilyScore, TECH_FAMILIES } from '@/lib/techFamilies';
 */

export const TECH_FAMILIES: Record<string, string[]> = {
  // ── Engineering / Infrastructure ────────────────────────────────────────
  languages: [
    'Python', 'Go', 'Rust', 'Java', 'C++', 'C#', 'TypeScript', 'JavaScript',
    'PHP', 'Ruby', 'Scala', 'Kotlin', 'Swift', 'Bash', 'Shell',
  ],
  ml_frameworks: [
    'PyTorch', 'TensorFlow', 'JAX', 'Keras', 'scikit-learn',
    'Hugging Face', 'ONNX', 'XGBoost', 'LightGBM',
  ],
  hpc: [
    'CUDA', 'NCCL', 'MPI', 'OpenMPI', 'Slurm', 'InfiniBand',
    'NVLink', 'MLPerf', 'DCGM', 'HPC', 'GPU',
  ],
  cloud: [
    'AWS', 'GCP', 'Azure', 'DigitalOcean', 'Oracle Cloud',
    'EC2', 'S3', 'Lambda', 'GKE', 'EKS', 'AKS',
  ],
  containers: [
    'Docker', 'Kubernetes', 'Helm', 'Argo', 'Rancher',
    'OpenShift', 'Podman', 'containerd',
  ],
  devops: [
    'GitLab', 'GitHub', 'Jenkins', 'Terraform', 'Ansible',
    'CI/CD', 'ArgoCD', 'Flux', 'Packer', 'Vault', 'Puppet', 'Chef',
  ],
  observability: [
    'Prometheus', 'Grafana', 'OpenTelemetry', 'Datadog', 'New Relic',
    'ELK', 'Kibana', 'Elasticsearch', 'Jaeger', 'Zipkin', 'Splunk',
    'PagerDuty', 'VictoriaMetrics', 'Loki',
  ],
  databases: [
    'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Cassandra',
    'DynamoDB', 'SQLite', 'MariaDB', 'CockroachDB', 'Supabase', 'Firebase',
  ],
  messaging: [
    'Kafka', 'RabbitMQ', 'Celery', 'SQS', 'Pub/Sub',
    'NATS', 'ActiveMQ', 'ZeroMQ',
  ],
  data_pipeline: [
    'Spark', 'Flink', 'Airflow', 'dbt', 'Hadoop',
    'Hive', 'Snowflake', 'BigQuery', 'Redshift', 'Databricks',
  ],
  frontend: [
    'React', 'Next.js', 'Vue', 'Angular', 'Svelte',
    'Tailwind', 'CSS', 'HTML', 'Webpack', 'Vite',
  ],
  backend: [
    'Node.js', 'Django', 'FastAPI', 'Flask', 'Spring',
    'Laravel', 'Rails', 'Express', 'NestJS', 'GraphQL', 'REST', 'gRPC',
  ],
  mobile: [
    'React Native', 'Flutter', 'Swift', 'Kotlin', 'iOS', 'Android',
    'Expo', 'Capacitor',
  ],
  data_science: [
    'Pandas', 'NumPy', 'Matplotlib', 'Jupyter', 'R', 'SPSS',
    'Tableau', 'Power BI', 'Looker', 'Seaborn', 'Plotly',
  ],
  security: [
    'DevSecOps', 'Vault', 'SAST', 'DAST', 'Penetration Testing',
    'OAuth', 'JWT', 'RBAC', 'Zero Trust', 'IAM',
  ],

  // ── Creative / Design ───────────────────────────────────────────────────
  graphic_design: [
    'Photoshop', 'Illustrator', 'InDesign', 'CorelDRAW', 'GIMP',
    'Affinity Designer', 'Affinity Photo',
  ],
  motion_graphics: [
    'After Effects', 'Premiere Pro', 'Cinema 4D', 'Blender',
    'DaVinci Resolve', 'Lottie', 'Motion', 'Nuke', 'Mocha',
  ],
  ui_ux: [
    'Figma', 'Sketch', 'Adobe XD', 'InVision', 'Zeplin',
    'Protopie', 'Framer', 'Maze', 'Hotjar', 'UX Research',
  ],
  branding: [
    'Brand Identity', 'Brand Guidelines', 'Logo Design',
    'Typography', 'Visual Identity', 'Brand Strategy', 'Art Direction',
  ],
  social_media_design: [
    'Social Media', 'Content Creation', 'Instagram', 'Campaigns',
    'Reels', 'Stories', 'TikTok', 'Facebook Ads', 'Digital Marketing',
  ],
  three_d_design: [
    'Cinema 4D', 'Blender', '3ds Max', 'Maya', 'ZBrush',
    'KeyShot', 'Octane', 'Arnold', 'Redshift', 'Houdini',
  ],
  video_production: [
    'Premiere Pro', 'DaVinci Resolve', 'Final Cut', 'Lightroom',
    'Color Grading', 'Video Editing', 'Color Correction',
  ],
  photography: [
    'Lightroom', 'Capture One', 'Studio Photography',
    'Product Photography', 'Retouching', 'Photo Editing',
  ],
};

// ── Build reverse lookup: term (lowercase) → family name ─────────────────
const TERM_TO_FAMILY: Record<string, string> = {};
for (const [family, terms] of Object.entries(TECH_FAMILIES)) {
  for (const term of terms) {
    TERM_TO_FAMILY[term.toLowerCase()] = family;
  }
}

// ── Build family → Set<term (lowercase)> for fast candidate lookup ────────
const FAMILY_TERMS: Record<string, Set<string>> = {};
for (const [family, terms] of Object.entries(TECH_FAMILIES)) {
  FAMILY_TERMS[family] = new Set(terms.map(t => t.toLowerCase()));
}

export type TechFamilyResult = {
  score: number;           // 0–100 normalized
  exactHits: string[];     // JD terms found exactly in candidate text
  familyHits: string[];    // JD terms whose family matched (but not exact)
  missedTerms: string[];   // JD terms with no hit at all
  familiesMatched: string[]; // which family buckets fired
};

/**
 * getTechFamilyScore
 *
 * @param jdTerms       — tech terms extracted from the JD (from extractJobTitle techFallback
 *                        or any other source)
 * @param candidateText — concatenated free-text from candidate profile fields
 * @returns TechFamilyResult
 */
export function getTechFamilyScore(jdTerms: string[], candidateText: string): TechFamilyResult {
  if (jdTerms.length === 0) {
    return { score: 0, exactHits: [], familyHits: [], missedTerms: [], familiesMatched: [] };
  }

  const candidateLower = candidateText.toLowerCase();

  // Pre-compute which families the candidate belongs to
  // (any term from a family found in candidate text → that family is "active")
  const candidateFamilies = new Set<string>();
  for (const [family, termSet] of Object.entries(FAMILY_TERMS)) {
    for (const term of termSet) {
      // Use word-boundary style match (simple includes is fine for multi-word terms)
      if (candidateLower.includes(term)) {
        candidateFamilies.add(family);
        break;
      }
    }
  }

  const exactHits: string[] = [];
  const familyHits: string[] = [];
  const missedTerms: string[] = [];
  const familiesMatchedSet = new Set<string>();
  let weightedScore = 0;

  for (const term of jdTerms) {
    const termLower = term.toLowerCase();
    const termFamily = TERM_TO_FAMILY[termLower];

    if (candidateLower.includes(termLower)) {
      // Exact hit
      exactHits.push(term);
      weightedScore += 1.0;
      if (termFamily) familiesMatchedSet.add(termFamily);
    } else if (termFamily && candidateFamilies.has(termFamily)) {
      // Same-family hit (partial credit)
      familyHits.push(term);
      weightedScore += 0.5;
      familiesMatchedSet.add(termFamily);
    } else {
      missedTerms.push(term);
    }
  }

  const score = Math.round((weightedScore / jdTerms.length) * 100);

  return {
    score,
    exactHits,
    familyHits,
    missedTerms,
    familiesMatched: [...familiesMatchedSet],
  };
}
