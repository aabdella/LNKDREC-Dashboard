export interface TeamMemberCost {
  candidateId: string;
  candidateName: string;
  role: string;
  allocationPct: number;
  outsourcingSalaryUsd: number;
  hoursPerMonth: number | null; // null = full-time (use allocation)
  costPerHour: number;
  loadedCostPerHour: number;
  monthlyHours: number;
  monthlyCost: number;
}

export interface TeamBudgetSummary {
  members: TeamMemberCost[];
  totalMonthlyCost: number;
  totalMonthlyHours: number;
  blendedSellRate: number;
  monthlyRevenue: number;
  monthlyMargin: number;
  marginPct: number;
}

const WEEKS_PER_YEAR = 52;
const HOURS_PER_WEEK = 40;
export const HOURS_PER_MONTH = (WEEKS_PER_YEAR * HOURS_PER_WEEK) / 12; // ~173.33

export function calculateMemberCost(
  outsourcingSalaryUsd: number,
  allocationPct: number,
  overheadMultiplier: number,
  hoursPerMonth: number | null
): {
  costPerHour: number;
  loadedCostPerHour: number;
  monthlyHours: number;
  monthlyCost: number;
} {
  const costPerHour = outsourcingSalaryUsd / WEEKS_PER_YEAR / HOURS_PER_WEEK;
  const loadedCostPerHour = costPerHour * overheadMultiplier;

  // If explicit hours provided, use them; otherwise derive from allocation %
  const monthlyHours =
    hoursPerMonth ?? Math.round(HOURS_PER_MONTH * (allocationPct / 100));
  const monthlyCost = loadedCostPerHour * monthlyHours;

  return { costPerHour, loadedCostPerHour, monthlyHours, monthlyCost };
}

export function calculateTeamBudget(
  members: TeamMemberCost[],
  blendedSellRate: number,
  teamHoursPerMonth: number
): TeamBudgetSummary {
  const totalMonthlyCost = members.reduce((sum, m) => sum + m.monthlyCost, 0);
  const totalMonthlyHours = members.reduce((sum, m) => sum + m.monthlyHours, 0);
  const monthlyRevenue = blendedSellRate * teamHoursPerMonth;
  const monthlyMargin = monthlyRevenue - totalMonthlyCost;
  const marginPct =
    monthlyRevenue > 0 ? (monthlyMargin / monthlyRevenue) * 100 : 0;

  return {
    members,
    totalMonthlyCost,
    totalMonthlyHours,
    blendedSellRate,
    monthlyRevenue,
    monthlyMargin,
    marginPct,
  };
}
