/**
 * parseJD.test.mts — Test suite for overhauled JD parsing + search query generation
 *
 * Uses Node.js built-in test runner (no Jest dependency).
 * Run: npx tsx --test lib/__tests__/parseJD.test.mts
 *
 * Tests cover all 5 improvements:
 * 1. Skill rarity ranking (niche > domain > common)
 * 2. search_hints output (niche_terms, role_concept, must_include, company_targets)
 * 3. Industry detection threshold (requires >= 2 keyword matches)
 * 4. Location detection (no forced Egypt default)
 * 5. Role title, variants, and compound role_concept
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseJD, SKILL_RARITY } from '../parseJD.js';

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

const JD_SAUDI = `Senior Engineer needed in Riyadh, Saudi Arabia. Python, AWS, Docker. KYC and AML compliance required.`;

// ─── Test 1: Skill Rarity Ranking ─────────────────────────────────────────────

describe('1. Skill Rarity Ranking', () => {
  test('SKILL_RARITY export: niche tools have score 3', () => {
    assert.equal(SKILL_RARITY['Talkwalker'], 3);
    assert.equal(SKILL_RARITY['Brandwatch'], 3);
    assert.equal(SKILL_RARITY['MLflow'], 3);
    assert.equal(SKILL_RARITY['dbt'], 3);
    assert.equal(SKILL_RARITY['ArgoCD'], 3);
    assert.equal(SKILL_RARITY['Pulumi'], 3);
  });

  test('SKILL_RARITY export: common tools have score 1', () => {
    assert.equal(SKILL_RARITY['Python'], 1);
    assert.equal(SKILL_RARITY['AWS'], 1);
    assert.equal(SKILL_RARITY['Docker'], 1);
    assert.equal(SKILL_RARITY['React'], 1);
  });

  test('Talkwalker JD: Talkwalker ranks before Python in must_have_skills', () => {
    const parsed = parseJD(JD_TALKWALKER);
    const skills = parsed.must_have_skills;
    assert.ok(skills.includes('Talkwalker'), `Expected Talkwalker in skills: ${skills.join(', ')}`);
    assert.ok(skills.includes('Python'), `Expected Python in skills: ${skills.join(', ')}`);
    const twIdx = skills.indexOf('Talkwalker');
    const pyIdx = skills.indexOf('Python');
    assert.ok(twIdx < pyIdx, `Talkwalker(${twIdx}) should rank before Python(${pyIdx})`);
  });

  test('Talkwalker JD: Brandwatch ranks before Python', () => {
    const parsed = parseJD(JD_TALKWALKER);
    const skills = parsed.must_have_skills;
    assert.ok(skills.includes('Brandwatch'), `Missing Brandwatch in: ${skills.join(', ')}`);
    const bwIdx = skills.indexOf('Brandwatch');
    const pyIdx = skills.indexOf('Python');
    assert.ok(bwIdx < pyIdx, `Brandwatch(${bwIdx}) should rank before Python(${pyIdx})`);
  });

  test('ML JD: MLflow (niche=3) ranks before Python (common=1)', () => {
    const parsed = parseJD(JD_ML_ENGINEER);
    const skills = parsed.must_have_skills;
    assert.ok(skills.includes('MLflow'), `Missing MLflow in: ${skills.join(', ')}`);
    const mlIdx = skills.indexOf('MLflow');
    const pyIdx = skills.indexOf('Python');
    assert.ok(mlIdx < pyIdx, `MLflow(${mlIdx}) should rank before Python(${pyIdx})`);
  });

  test('ML JD: PyTorch (domain=2) ranks before AWS (common=1)', () => {
    const parsed = parseJD(JD_ML_ENGINEER);
    const skills = parsed.must_have_skills;
    const ptIdx = skills.indexOf('PyTorch');
    const awsIdx = skills.indexOf('AWS');
    assert.ok(ptIdx >= 0, 'Missing PyTorch');
    assert.ok(awsIdx >= 0, 'Missing AWS');
    assert.ok(ptIdx < awsIdx, `PyTorch(${ptIdx}) should rank before AWS(${awsIdx})`);
  });

  test('DevOps JD: ArgoCD (niche=3) ranks before Kubernetes (domain=2)', () => {
    const parsed = parseJD(JD_DEVOPS_NICHE);
    const skills = parsed.must_have_skills;
    const acIdx = skills.indexOf('ArgoCD');
    const k8sIdx = skills.indexOf('Kubernetes');
    assert.ok(acIdx >= 0, 'Missing ArgoCD');
    assert.ok(k8sIdx >= 0, 'Missing Kubernetes');
    assert.ok(acIdx < k8sIdx, `ArgoCD(${acIdx}) should rank before Kubernetes(${k8sIdx})`);
  });

  test('ranked_skills is sorted descending by score', () => {
    const parsed = parseJD(JD_TALKWALKER);
    const scores = parsed.ranked_skills.map(s => s.score);
    for (let i = 1; i < scores.length; i++) {
      assert.ok(
        scores[i] <= scores[i - 1],
        `ranked_skills not sorted: score[${i}]=${scores[i]} > score[${i-1}]=${scores[i-1]}`
      );
    }
  });

  test('ranked_skills entries have skill, rarity, score fields', () => {
    const { ranked_skills } = parseJD(JD_TALKWALKER);
    assert.ok(ranked_skills.length > 0, 'ranked_skills should not be empty');
    for (const s of ranked_skills) {
      assert.ok('skill' in s, 'Missing skill field');
      assert.ok('rarity' in s, 'Missing rarity field');
      assert.ok('score' in s, 'Missing score field');
      assert.ok(['niche', 'domain', 'common'].includes(s.rarity), `Unknown rarity: ${s.rarity}`);
    }
  });
});

// ─── Test 2: search_hints output ──────────────────────────────────────────────

describe('2. search_hints output', () => {
  test('All search_hint fields present on every parse', () => {
    const jds = [JD_TALKWALKER, JD_ML_ENGINEER, JD_BACKEND_VODAFONE, JD_GENERIC_NO_LOCATION];
    for (const jd of jds) {
      const { search_hints } = parseJD(jd);
      assert.ok(Array.isArray(search_hints.niche_terms), 'niche_terms must be array');
      assert.ok(Array.isArray(search_hints.must_include), 'must_include must be array');
      assert.ok(Array.isArray(search_hints.company_targets), 'company_targets must be array');
      assert.equal(typeof search_hints.role_concept, 'string', 'role_concept must be string');
      assert.ok(search_hints.role_concept.length > 0, 'role_concept must not be empty');
    }
  });

  test('Talkwalker JD: niche_terms contains Talkwalker and Brandwatch', () => {
    const { search_hints } = parseJD(JD_TALKWALKER);
    assert.ok(search_hints.niche_terms.includes('Talkwalker'), `niche_terms: ${search_hints.niche_terms.join(', ')}`);
    assert.ok(search_hints.niche_terms.includes('Brandwatch'), `niche_terms: ${search_hints.niche_terms.join(', ')}`);
  });

  test('niche_terms does NOT include Python or AWS', () => {
    const { search_hints } = parseJD(JD_ML_ENGINEER);
    assert.ok(!search_hints.niche_terms.includes('Python'), 'Python should not be in niche_terms');
    assert.ok(!search_hints.niche_terms.includes('AWS'), 'AWS should not be in niche_terms');
  });

  test('niche_terms capped at 4 entries', () => {
    const { search_hints } = parseJD(JD_DEVOPS_NICHE);
    assert.ok(search_hints.niche_terms.length <= 4, `niche_terms length ${search_hints.niche_terms.length} exceeds 4`);
  });

  test('role_concept includes "Fintech" when fintech industry detected', () => {
    const { search_hints, industry } = parseJD(JD_ML_ENGINEER);
    assert.equal(industry, 'fintech');
    assert.match(search_hints.role_concept, /fintech/i, `role_concept: "${search_hints.role_concept}"`);
  });

  test('role_concept falls back to plain title when no industry', () => {
    const { search_hints, industry } = parseJD(JD_GENERIC_NO_LOCATION);
    assert.equal(industry, null);
    assert.ok(search_hints.role_concept.length > 0, 'role_concept should still have a value');
  });

  test('company_targets extracts Vodafone and Orange from telecom JD', () => {
    const { search_hints } = parseJD(JD_BACKEND_VODAFONE);
    assert.ok(search_hints.company_targets.includes('Vodafone'), `targets: ${search_hints.company_targets.join(', ')}`);
    assert.ok(search_hints.company_targets.includes('Orange'), `targets: ${search_hints.company_targets.join(', ')}`);
  });

  test('company_targets is empty when no known brands mentioned', () => {
    const { search_hints } = parseJD(JD_GENERIC_NO_LOCATION);
    assert.equal(search_hints.company_targets.length, 0);
  });

  test('must_include contains at least one niche or domain skill when available', () => {
    const { search_hints } = parseJD(JD_TALKWALKER);
    const hasHighRarity = search_hints.must_include.some(s => (SKILL_RARITY[s] ?? 1) >= 2);
    assert.ok(hasHighRarity, `must_include should have domain/niche skill: ${search_hints.must_include.join(', ')}`);
  });
});

// ─── Test 3: Industry Detection Threshold ─────────────────────────────────────

describe('3. Industry detection (requires >= 2 keyword matches)', () => {
  test('Fintech JD with KYC + AML + fintech → fintech detected', () => {
    const { industry } = parseJD(JD_ML_ENGINEER);
    assert.equal(industry, 'fintech');
  });

  test('Talkwalker JD → mediaanalytics detected', () => {
    const { industry } = parseJD(JD_TALKWALKER);
    assert.equal(industry, 'mediaanalytics');
  });

  test('Single "payment" mention → industry null (score < 2)', () => {
    const { industry } = parseJD(JD_SINGLE_INDUSTRY_KEYWORD);
    assert.equal(industry, null, `Expected null, got "${industry}"`);
  });

  test('Generic engineer JD → industry null', () => {
    const { industry } = parseJD(JD_GENERIC_NO_LOCATION);
    assert.equal(industry, null);
  });

  test('DevOps JD has no strong industry signal → null', () => {
    const { industry } = parseJD(JD_DEVOPS_NICHE);
    assert.equal(industry, null);
  });
});

// ─── Test 4: Location Detection ───────────────────────────────────────────────

describe('4. Location detection (no forced Egypt default)', () => {
  test('Cairo mention → "Egypt"', () => {
    const { location } = parseJD(JD_TALKWALKER);
    assert.equal(location, 'Egypt');
  });

  test('Dubai / UAE mention → "UAE"', () => {
    const { location } = parseJD(JD_DESIGNER_MOTION);
    assert.equal(location, 'UAE');
  });

  test('No location in JD → empty string (not "Egypt")', () => {
    const { location } = parseJD(JD_GENERIC_NO_LOCATION);
    assert.equal(location, '', `Expected empty string, got "${location}"`);
  });

  test('JD with Egypt + UAE → Egypt (Egypt checked first)', () => {
    const { location } = parseJD(JD_DEVOPS_NICHE);
    assert.equal(location, 'Egypt');
  });

  test('Riyadh / Saudi mention → "Saudi"', () => {
    const { location } = parseJD(JD_SAUDI);
    assert.equal(location, 'Saudi');
  });

  test('Single payment keyword JD has no location → empty string', () => {
    const { location } = parseJD(JD_SINGLE_INDUSTRY_KEYWORD);
    assert.equal(location, '');
  });
});

// ─── Test 5: Role Title, Seniority & Variants ─────────────────────────────────

describe('5. Role title, seniority, and variants', () => {
  test('Extracts "Machine Learning Engineer" from ML JD', () => {
    const { role_title } = parseJD(JD_ML_ENGINEER);
    assert.match(role_title, /machine learning engineer/i, `Got: "${role_title}"`);
  });

  test('Extracts "Senior" seniority for 5+ years JD', () => {
    const { seniority, seniority_prefix } = parseJD(JD_TALKWALKER);
    assert.equal(seniority, 'senior');
    assert.equal(seniority_prefix, 'Senior');
  });

  test('Extracts "lead" seniority for Lead DevOps JD', () => {
    const { seniority } = parseJD(JD_DEVOPS_NICHE);
    assert.equal(seniority, 'lead');
  });

  test('title_variants is non-empty for known roles', () => {
    const { title_variants } = parseJD(JD_ML_ENGINEER);
    assert.ok(title_variants.length > 0, 'title_variants should not be empty');
  });

  test('title_variants do not duplicate role_title', () => {
    const { role_title, title_variants } = parseJD(JD_ML_ENGINEER);
    assert.ok(!title_variants.includes(role_title), `role_title "${role_title}" should not appear in title_variants`);
  });

  test('Motion designer role detected from designer JD', () => {
    const { role_title } = parseJD(JD_DESIGNER_MOTION);
    assert.match(role_title, /motion/i, `Got: "${role_title}"`);
  });

  test('role_concept = "Fintech Machine Learning Engineer" when fintech + ML', () => {
    const { search_hints } = parseJD(JD_ML_ENGINEER);
    assert.match(search_hints.role_concept, /fintech/i);
    assert.match(search_hints.role_concept, /machine learning/i);
  });

  test('title_variants capped at 4', () => {
    const { title_variants } = parseJD(JD_ML_ENGINEER);
    assert.ok(title_variants.length <= 4, `title_variants length ${title_variants.length} > 4`);
  });
});
