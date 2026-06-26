export type ProjectType = 'feature' | 'module' | 'full_solution';

export interface Offering {
  key: string;
  name: string;
  projectType: ProjectType;
  teamComposition: string;
  priceRange: string;
  pricingModel: 'monthly' | 'fixed';
  duration?: string;
  paymentTerms?: string;
  deliveryNotes: string;
  requiredRoles: { role: string; count: number }[];
}

export const OFFERINGS: Offering[] = [
  // A) Feature-based
  {
    key: 'starter_squad',
    name: 'Starter Squad',
    projectType: 'feature',
    teamComposition: '2 devs + LNKD lead',
    priceRange: '€12,000–15,000/mo',
    pricingModel: 'monthly',
    deliveryNotes: 'Up to 2 workstreams, biweekly delivery',
    requiredRoles: [{ role: 'Developer', count: 2 }, { role: 'LNKD Lead', count: 1 }],
  },
  {
    key: 'growth_squad',
    name: 'Growth Squad',
    projectType: 'feature',
    teamComposition: '3 devs + QA + LNKD lead',
    priceRange: '€20,000–26,000/mo',
    pricingModel: 'monthly',
    deliveryNotes: 'Full sprint cycle, dedicated QA, weekly demos',
    requiredRoles: [{ role: 'Developer', count: 3 }, { role: 'QA', count: 1 }, { role: 'LNKD Lead', count: 1 }],
  },
  {
    key: 'scale_squad',
    name: 'Scale Squad',
    projectType: 'feature',
    teamComposition: '5 devs + QA + architect + LNKD lead',
    priceRange: '€35,000–45,000/mo',
    pricingModel: 'monthly',
    deliveryNotes: 'Multi-product, architecture ownership',
    requiredRoles: [
      { role: 'Developer', count: 5 },
      { role: 'QA', count: 1 },
      { role: 'Architect', count: 1 },
      { role: 'LNKD Lead', count: 1 },
    ],
  },
  // B) Module-based
  {
    key: 'feature_build',
    name: 'Feature Build (Single Module)',
    projectType: 'module',
    teamComposition: 'Scoped team',
    priceRange: '€12,000–25,000',
    pricingModel: 'fixed',
    duration: '4–8 weeks',
    paymentTerms: '30% start / 40% mid-delivery / 30% sign-off',
    deliveryNotes: 'Single module delivery',
    requiredRoles: [],
  },
  {
    key: 'product_mvp',
    name: 'Product MVP',
    projectType: 'module',
    teamComposition: 'Scoped team',
    priceRange: '€35,000–70,000',
    pricingModel: 'fixed',
    duration: '8–14 weeks',
    paymentTerms: '25% start / 25% phase 1 / 25% phase 2 / 25% delivery',
    deliveryNotes: 'Full MVP delivery',
    requiredRoles: [],
  },
  {
    key: 'platform_rebuild',
    name: 'Platform Rebuild / Migration',
    projectType: 'module',
    teamComposition: 'Scoped team',
    priceRange: '€60,000–150,000',
    pricingModel: 'fixed',
    duration: '12–20 weeks',
    paymentTerms: 'Monthly milestone payments',
    deliveryNotes: 'Platform-level rebuild or migration',
    requiredRoles: [],
  },
  {
    key: 'studio_retainer',
    name: 'Ongoing Studio Retainer',
    projectType: 'module',
    teamComposition: 'Retained team',
    priceRange: '€5,000–8,000/mo',
    pricingModel: 'monthly',
    paymentTerms: 'Monthly, cancel with 30 days notice',
    deliveryNotes: 'Post-project rolling retainer',
    requiredRoles: [],
  },
  // C) Full solution
  {
    key: 'fractional_cto_only',
    name: 'Fractional CTO Only',
    projectType: 'full_solution',
    teamComposition: '2 days/week tech leadership',
    priceRange: '€6,000–8,000/mo',
    pricingModel: 'monthly',
    deliveryNotes: 'Roadmap, architecture, vendor management',
    requiredRoles: [{ role: 'CTO', count: 1 }],
  },
  {
    key: 'fractional_cto_2dev',
    name: 'Fractional CTO + 2 Developers',
    projectType: 'full_solution',
    teamComposition: 'CTO + 2 devs',
    priceRange: '€18,000–22,000/mo',
    pricingModel: 'monthly',
    deliveryNotes: 'CTO directing execution',
    requiredRoles: [{ role: 'CTO', count: 1 }, { role: 'Developer', count: 2 }],
  },
  {
    key: 'fractional_cto_squad',
    name: 'Fractional CTO + 3–4 Devs + QA',
    projectType: 'full_solution',
    teamComposition: 'CTO + 3–4 devs + QA',
    priceRange: '€28,000–36,000/mo',
    pricingModel: 'monthly',
    deliveryNotes: 'Full squad under CTO',
    requiredRoles: [{ role: 'CTO', count: 1 }, { role: 'Developer', count: 3 }, { role: 'QA', count: 1 }],
  },
  {
    key: 'full_tech_leadership',
    name: 'Full Tech Leadership + 5+ Devs',
    projectType: 'full_solution',
    teamComposition: 'Full tech leadership + 5+ developers, multi-product',
    priceRange: '€45,000–65,000/mo',
    pricingModel: 'monthly',
    deliveryNotes: 'Enterprise-scale delivery',
    requiredRoles: [{ role: 'CTO', count: 1 }, { role: 'Developer', count: 5 }, { role: 'QA', count: 1 }],
  },
];

export function getOfferingsForType(type: ProjectType): Offering[] {
  return OFFERINGS.filter((o) => o.projectType === type);
}

export function getOffering(key: string): Offering | undefined {
  return OFFERINGS.find((o) => o.key === key);
}
