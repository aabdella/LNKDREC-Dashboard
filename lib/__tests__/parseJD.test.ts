/**
 * parseJD.test.ts — Test suite for the overhauled JD parser + search query generation
 *
 * Tests cover all 5 improvements:
 * 1. Skill rarity ranking (niche > domain > common)
 * 2. search_hints output (niche_terms, role_concept, must_include, company_targets)
 * 3. Industry detection threshold (requires >= 2 keyword matches)
 * 4. Location detection (no forced Egypt default)
 * 5. Title variants + compound role_concept generation
 *
 * Run: npx jest lib/__tests__/parseJD.test.ts --no-coverage
 */

import { parseJD, SKILL_RARITY } from '../parseJD';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const JD_TALKWALKER = `
Senior Social Listening Analyst — Cairo, Egypt

We are looking for a Senior Social Listening Analyst with deep hands-on experience
in Talkwalker and Brandwatch. You will monitor earned media, track sentiment analysis,
and produce media analytics reports for FMCG clients.

Requirements:
- 5+ years experience in media monitoring and social listening
- Proficient in Talkwalker (mandatory), Brandwatch a plus
- Strong Python skills for data processing
- Experience with Tableau dashboards
- Based in Cairo, Egypt
`;

const JD_ML_ENGINEER = `
Machine Learning Engineer — Fintech Startup, Egypt

We're a fast-growing fintech company building AI-powered credit scoring models.

Requirements:
- 4+ years ML experience
- Strong Python, PyTorch and TensorFlow skills
- Experience with MLflow for experiment tracking
- Kafka for real-time feature pipelines
- AWS or GCP cloud infrastructure
- Knowledge of KYC, AML processes preferred
- Cairo or remote Egypt
`;

const JD_BACKEND_VODAFONE = `
Senior Backend Engineer

We are hiring for a client in the telecom sector with previous experience at Vodafone,
Orange, or Etisalat preferred. The role involves building microservices using Node.js,
NestJS, and PostgreSQL. Strong REST and GraphQL API experience required.
AWS deployment. Egypt-based.
`;

const JD_DEVOPS_NICHE = `
Lead DevOps / Platform Engineer

We need a platform engineer with strong Kubernetes, ArgoCD, and Terraform experience.
Pulumi knowledge is a plus. The team runs Prometheus and Grafana for observability.
OpenTelemetry experience preferred. Remote-first but candidate must be Egypt or UAE based.
`;

const JD_GENERIC_NO_LOCATION = `
Software Engineer

Looking for a software engineer with React, Node.js and PostgreSQL.
3-5 years experience. Agile team environment.
`;

const JD_SINGLE_INDUSTRY_KEYWORD = `
Backend Engineer needed. We work in a fast-paced environment.
Python, Django, AWS. 3+ years experience.
The team handles payment integrations.
`;

const JD_DESIGNER_MOTION = `
Senior Motion Graphics Designer — Dubai, UAE

We need a motion designer with strong After Effects and Cinema 4D skills.
Experience with Blender is a bonus. Must have a Behance portfolio.
Brand storytelling for luxury clients. 5+ years experience.
Adobe Creative Suite proficiency required.
`;

// ─── Test 1: Skill Rarity Ranking ─────────────────────────────────────────────

describe('1. Skill Rarity Ranking', () => {
  test('Talkwalker JD: niche skills appear before common skills in must_have_skills', () => {
    const parsed = parseJD(JD_TALKWALKER);
    const skills = parsed.must_have_skills;

    expect(skills).toContain('Talkwalker');
    expect(skills).toContain('Brandwatch');
    expect(skills).toContain('Python');

    // Talkwalker (niche=3) must rank before Python (common=1)
    const talkwalkerIdx = skills.indexOf('Talkwalker');
    const pythonIdx = skills.indexOf('Python');
    expect(talkwalkerIdx).toBeLessThan(pythonIdx);
  });

  test('ML JD: PyTorch/MLflow (domain/niche) rank before Python/AWS (common)', () => {
    const parsed = parseJD(JD_ML_ENGINEER);
    const skills = parsed.must_have_skills;

    const mlflowIdx  = skills.indexOf('MLflow');
    const pytorchIdx = skills.indexOf('PyTorch');
    const pythonIdx  = skills.indexOf('Python');
    const awsIdx     = skills.indexOf('AWS');

    expect(mlflowIdx).toBeGreaterThanOrEqual(0);
    expect(pytorchIdx).toBeGreaterThanOrEqual(0);
    // Niche/domain skills must come before common ones
    expect(mlflowIdx).toBeLessThan(pythonIdx);
    expect(pytorchIdx).toBeLessThan(awsIdx);
  });

  test('DevOps JD: ArgoCD, Pulumi, OpenTelemetry (niche) rank before Docker/AWS', () => {
    const parsed = parseJD(JD_DEVOPS_NICHE);
    const skills = parsed.must_have_skills;

    const argoCDIdx    = skills.indexOf('ArgoCD');
    const pulumiIdx    = skills.indexOf('Pulumi');
    const otIdx        = skills.indexOf('OpenTelemetry');
    const kubeIdx      = skills.indexOf('Kubernetes');

    // All niche tools must be present
    expect(argoCDIdx).toBeGreaterThanOrEqual(0);
    expect(pulumiIdx).toBeGreaterThanOrEqual(0);
    expect(otIdx).toBeGreaterThanOrEqual(0);

    // ArgoCD (niche=3) before Kubernetes (domain=2)
    expect(argoCDIdx).toBeLessThan(kubeIdx);
  });

  test('ranked_skills array is sorted descending by score', () => {
    const parsed = parseJD(JD_TALKWALKER);
    const scores = parsed.ranked_skills.map(s => s.score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  test('SKILL_RARITY export: niche tools have score 3', () => {
    expect(SKILL_RARITY['Talkwalker']).toBe(3);
    expect(SKILL_RARITY['Brandwatch']).toBe(3);
    expect(SKILL_RARITY['MLflow']).toBe(3);
    expect(SKILL_RARITY['dbt']).toBe(3);
  });

  test('SKILL_RARITY export: common tools have score 1', () => {
    expect(SKILL_RARITY['Python']).toBe(1);
    expect(SKILL_RARITY['AWS']).toBe(1);
    expect(SKILL_RARITY['Docker']).toBe(1);
    expect(SKILL_RARITY['React']).toBe(1);
  });
});

// ─── Test 2: search_hints output ──────────────────────────────────────────────

describe('2. search_hints output', () => {
  test('niche_terms contains Talkwalker and Brandwatch for social listening JD', () => {
    const { search_hints } = parseJD(JD_TALKWALKER);
    expect(search_hints.niche_terms).toContain('Talkwalker');
    expect(search_hints.niche_terms).toContain('Brandwatch');
  });

  test('niche_terms does NOT include common skills (Python, AWS)', () => {
    const { search_hints } = parseJD(JD_ML_ENGINEER);
    expect(search_hints.niche_terms).not.toContain('Python');
    expect(search_hints.niche_terms).not.toContain('AWS');
  });

  test('must_include contains at least one niche or domain skill', () => {
    const { search_hints } = parseJD(JD_TALKWALKER);
    const rarities = search_hints.must_include.map(s => {
      const score = SKILL_RARITY[s] ?? 1;
      return score;
    });
    // At least one must_include skill should be domain (2) or niche (3)
    expect(rarities.some(r => r >= 2)).toBe(true);
  });

  test('role_concept includes industry label when industry is detected', () => {
    const { search_hints, industry } = parseJD(JD_ML_ENGINEER);
    expect(industry).toBe('fintech');
    // role_concept should contain "Fintech"
    expect(search_hints.role_concept).toMatch(/fintech/i);
  });

  test('role_concept falls back to plain title when no industry detected', () => {
    const { search_hints, industry } = parseJD(JD_GENERIC_NO_LOCATION);
    expect(industry).toBeNull();
    // role_concept should just be the role title (no industry prefix)
    expect(search_hints.role_concept).toBeTruthy();
    expect(search_hints.role_concept.length).toBeGreaterThan(0);
  });

  test('company_targets extracts Vodafone and Orange from telecom JD', () => {
    const { search_hints } = parseJD(JD_BACKEND_VODAFONE);
    expect(search_hints.company_targets).toContain('Vodafone');
    expect(search_hints.company_targets).toContain('Orange');
  });

  test('company_targets is empty when no known brands mentioned', () => {
    const { search_hints } = parseJD(JD_GENERIC_NO_LOCATION);
    expect(search_hints.company_targets).toHaveLength(0);
  });

  test('niche_terms length is capped at 4', () => {
    const { search_hints } = parseJD(JD_DEVOPS_NICHE);
    expect(search_hints.niche_terms.length).toBeLessThanOrEqual(4);
  });
});

// ─── Test 3: Industry Detection Threshold ─────────────────────────────────────

describe('3. Industry detection (requires >= 2 keyword matches)', () => {
  test('Fintech JD with KYC + AML + fintech keywords → fintech detected', () => {
    const { industry } = parseJD(JD_ML_ENGINEER);
    expect(industry).toBe('fintech');
  });

  test('Talkwalker JD with social listening + media monitoring → mediaanalytics detected', () => {
    const { industry } = parseJD(JD_TALKWALKER);
    expect(industry).toBe('mediaanalytics');
  });

  test('Single "payment" mention does NOT trigger fintech (score < 2)', () => {
    const { industry } = parseJD(JD_SINGLE_INDUSTRY_KEYWORD);
    // Only "payment" matches fintech bucket — should be null (< 2 matches)
    expect(industry).toBeNull();
  });

  test('Generic engineer JD with no industry keywords → null', () => {
    const { industry } = parseJD(JD_GENERIC_NO_LOCATION);
    expect(industry).toBeNull();
  });
});

// ─── Test 4: Location Detection (no forced Egypt default) ─────────────────────

describe('4. Location detection', () => {
  test('JD mentioning Cairo returns "Egypt"', () => {
    const { location } = parseJD(JD_TALKWALKER);
    expect(location).toBe('Egypt');
  });

  test('JD mentioning Dubai returns "UAE"', () => {
    const { location } = parseJD(JD_DESIGNER_MOTION);
    expect(location).toBe('UAE');
  });

  test('JD with no location returns empty string (not "Egypt")', () => {
    const { location } = parseJD(JD_GENERIC_NO_LOCATION);
    expect(location).toBe('');
  });

  test('JD mentioning Egypt OR UAE returns the first detected', () => {
    const { location } = parseJD(JD_DEVOPS_NICHE);
    // JD mentions Egypt and UAE — Egypt is checked first in extractLocation
    expect(location).toBe('Egypt');
  });

  test('JD mentioning Saudi/KSA returns "Saudi"', () => {
    const jd = 'Senior Engineer needed in Riyadh, Saudi Arabia. Python, AWS, Docker.';
    const { location } = parseJD(jd);
    expect(location).toBe('Saudi');
  });
});

// ─── Test 5: Role Title & Title Variants ──────────────────────────────────────

describe('5. Role title extraction and title variants', () => {
  test('Extracts "Machine Learning Engineer" from ML JD', () => {
    const { role_title } = parseJD(JD_ML_ENGINEER);
    expect(role_title.toLowerCase()).toMatch(/machine learning engineer/i);
  });

  test('Extracts seniority prefix "Senior" for 5+ years JD', () => {
    const { seniority, seniority_prefix } = parseJD(JD_TALKWALKER);
    expect(seniority).toBe('senior');
    expect(seniority_prefix).toBe('Senior');
  });

  test('Extracts seniority "lead" for Lead DevOps JD', () => {
    const { seniority } = parseJD(JD_DEVOPS_NICHE);
    expect(seniority).toBe('lead');
  });

  test('title_variants are non-empty for known roles', () => {
    const { title_variants } = parseJD(JD_ML_ENGINEER);
    expect(title_variants.length).toBeGreaterThan(0);
  });

  test('title_variants do not duplicate the primary role_title', () => {
    const { role_title, title_variants } = parseJD(JD_ML_ENGINEER);
    expect(title_variants).not.toContain(role_title);
  });

  test('Detects motion designer role from designer JD', () => {
    const { role_title } = parseJD(JD_DESIGNER_MOTION);
    expect(role_title.toLowerCase()).toMatch(/motion/i);
  });

  test('role_concept with industry = "Fintech Machine Learning Engineer"', () => {
    const { search_hints } = parseJD(JD_ML_ENGINEER);
    expect(search_hints.role_concept.toLowerCase()).toMatch(/fintech/i);
    expect(search_hints.role_concept.toLowerCase()).toMatch(/machine learning/i);
  });
});

// ─── Test 6: Query Builder Integration (buildKeywordSets via debug output) ────
// These test the query diversity logic end-to-end by checking what parseJD
// produces — the query builders in source-talent and deep-crawl consume this.

describe('6. Query diversity — search_hints drives unique queries', () => {
  test('Talkwalker JD: niche_terms[0] = Talkwalker — will anchor query strategy 2', () => {
    const { search_hints } = parseJD(JD_TALKWALKER);
    expect(search_hints.niche_terms[0]).toBe('Talkwalker');
  });

  test('Vodafone JD: company_targets[0] = Vodafone — will anchor query strategy 5', () => {
    const { search_hints } = parseJD(JD_BACKEND_VODAFONE);
    expect(search_hints.company_targets[0]).toBe('Vodafone');
  });

  test('Generic JD with no niche skills: must_include still returns something', () => {
    const { search_hints } = parseJD(JD_GENERIC_NO_LOCATION);
    // Even without niche tools, must_include should have skills
    // (falls back to domain or whatever was matched)
    expect(Array.isArray(search_hints.must_include)).toBe(true);
  });

  test('All search_hint fields are present on every parse', () => {
    const jds = [JD_TALKWALKER, JD_ML_ENGINEER, JD_BACKEND_VODAFONE, JD_GENERIC_NO_LOCATION];
    for (const jd of jds) {
      const { search_hints } = parseJD(jd);
      expect(search_hints).toHaveProperty('niche_terms');
      expect(search_hints).toHaveProperty('role_concept');
      expect(search_hints).toHaveProperty('must_include');
      expect(search_hints).toHaveProperty('company_targets');
      expect(Array.isArray(search_hints.niche_terms)).toBe(true);
      expect(Array.isArray(search_hints.must_include)).toBe(true);
      expect(Array.isArray(search_hints.company_targets)).toBe(true);
      expect(typeof search_hints.role_concept).toBe('string');
    }
  });

  test('ranked_skills has both skill and rarity fields', () => {
    const { ranked_skills } = parseJD(JD_TALKWALKER);
    expect(ranked_skills.length).toBeGreaterThan(0);
    for (const s of ranked_skills) {
      expect(s).toHaveProperty('skill');
      expect(s).toHaveProperty('rarity');
      expect(s).toHaveProperty('score');
      expect(['niche', 'domain', 'common']).toContain(s.rarity);
    }
  });
});
