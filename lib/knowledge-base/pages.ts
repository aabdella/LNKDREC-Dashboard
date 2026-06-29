export type KnowledgeBasePage = {
  slug: string;
  title: string;
  summary?: string;
};

export const knowledgeBasePages: KnowledgeBasePage[] = [
  { slug: 'home', title: 'Home', summary: 'Overview and how to use the Knowledge Base' },
  { slug: 'candidates', title: 'Candidates', summary: 'Candidate review, filtering, vetting, assignment, and bulk actions' },
  { slug: 'pipeline', title: 'Pipeline', summary: 'Stage-based candidate workflow and progression management' },
  { slug: 'sourcing', title: 'Sourcing', summary: 'JD-driven sourcing, matching, and sourced queue operations' },
  { slug: 'leads', title: 'Leads', summary: 'Demand discovery, qualified leads, enrichment, and outreach preparation' },
  { slug: 'jobs', title: 'Jobs', summary: 'Companies, roles, openings, and demand-side recruiting records' },
  { slug: 'client-portal', title: 'Client Portal', summary: 'Client-facing review layer and controlled candidate visibility' },
  { slug: 'settings', title: 'Settings', summary: 'Configuration, preferences, and administrative control surfaces' },
  { slug: 'analytics', title: 'Analytics', summary: 'Performance visibility, funnel analysis, and reporting' },
  { slug: 'team-staffing', title: 'Team Staffing', summary: 'Project-based team building, cost/margin calculation, and client quoting' },
];

export function getKnowledgeBasePageBySlug(slug: string) {
  return knowledgeBasePages.find((page) => page.slug === slug) ?? null;
}
