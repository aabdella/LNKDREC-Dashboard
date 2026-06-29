# Team Staffing & Project Quoting

## Overview

The Team Staffing module lets you package candidates into teams and quote those teams to clients as a unit. It's an internal tool (not client-facing yet) that gives full cost/margin visibility when building project proposals.

The flow: **choose/add a client → define a project → pick a project type → select a team offering → assign candidates → review budget → export or propose.**

---

## Project Types

Every project must be one of three types. Each type has a fixed set of team offerings to choose from.

### A) Feature-Based Projects
Small-scope work delivered in sprints. Three team options:

| Offering | Team Composition | Monthly Cost | Delivery |
|----------|-----------------|-------------|----------|
| **Starter Squad** | 2 devs + LNKD lead | €12,000–15,000/mo | Up to 2 workstreams, biweekly delivery |
| **Growth Squad** | 3 devs + QA + LNKD lead | €20,000–26,000/mo | Full sprint cycle, dedicated QA, weekly demos |
| **Scale Squad** | 5 devs + QA + architect + LNKD lead | €35,000–45,000/mo | Multi-product, architecture ownership |

### B) Module-Based Projects
Mid-to-large scoped work with milestone payments. Four options:

| Offering | Scope | Price Range | Duration | Payment |
|----------|-------|-------------|----------|---------|
| **Feature Build** | Single module | €12,000–25,000 | 4–8 weeks | 30% start / 40% mid / 30% sign-off |
| **Product MVP** | Full product | €35,000–70,000 | 8–14 weeks | 25% start / 25% phase 1 / 25% phase 2 / 25% delivery |
| **Platform Rebuild / Migration** | Large-scale | €60,000–150,000 | 12–20 weeks | Monthly milestones |
| **Ongoing Studio Retainer** | Post-project support | €5,000–8,000/mo | Rolling | Monthly, cancel with 30 days notice |

### C) End-to-End Full Solution Projects
Full tech leadership + execution. Four options:

| Offering | Team | Monthly Cost |
|----------|------|-------------|
| **Fractional CTO Only** | CTO (2 days/week) + Starter Squad | €6,000–8,000/mo |
| **Fractional CTO + 2 Devs** | CTO + Growth Squad | €18,000–22,000/mo |
| **Fractional CTO + 3–4 Devs + QA** | CTO + Scale Squad | €28,000–36,000/mo |
| **Full Leadership + 5+ Devs** | CTO + multi-product team | €45,000–65,000/mo |

---

## Database Schema

### `projects`
| Column | Description |
|--------|-------------|
| id | UUID |
| title | Project name |
| client_name | Client |
| description | Scope summary |
| status | `draft → proposed → active → on_hold → completed → lost` |
| start_date, end_date | Timeline |
| created_at | Timestamp |

### `project_teams`
| Column | Description |
|--------|-------------|
| id | UUID |
| project_id | FK → projects |
| name | Team name |
| overhead_multiplier | e.g. 1.30 = 30% overhead |
| blended_sell_rate | $/hr — set manually per team |
| hours_per_month | Total team hours |
| notes | Free text |
| created_at | Timestamp |

### `team_members`
| Column | Description |
|--------|-------------|
| id | UUID |
| team_id | FK → project_teams |
| candidate_id | FK → candidates |
| role_on_project | Dev, QA, Architect, Lead, etc. |
| allocation_pct | % of their time on this project |
| outsourcing_salary_usd | Annual salary for cost calc (set per assignment, independent of vetting salary) |

---

## Rate Calculation

All currency in **USD**. Work week = **40 hours fixed**.

```
cost/hr        = outsourcing_salary / 52 / 40
loaded cost/hr = cost/hr × overhead_multiplier
blended sell/hr = set manually at team level
margin         = (sell_rate × total_hours) − Σ(loaded_cost × hours_per_member)
```

**Key rules:**
- Overhead multiplier is set once per team (not per member)
- Sell rate is blended (one rate for the whole team)
- Outsourcing salary is set at assignment time — independent from the candidate's vetting salary
- Vetting salary is shown as a reference hint when assigning, but doesn't drive cost

---

## Validation & Staffing Logic

When a user selects a team offering, the system must:

1. **Cross-check** assigned candidates against the required team composition for that offering
2. **Validate** the correct number and roles of candidates are assigned (e.g., Growth Squad needs 3 devs + 1 QA + 1 lead)
3. **Calculate** each member's monthly cost based on their outsourcing salary and allocation %
4. **Flag** incomplete teams (missing roles or headcount)

### Part-Time Calculation
If a candidate is assigned at less than 100% allocation:
```
monthly cost = (outsourcing_salary / 12) × (allocation_pct / 100)
```

---

## Outputs

- **Excel Export** — full cost breakdown per member + team totals + margin
- **Proposal Button** — generates client-facing proposal (future feature)

---

## What's Built

1. ✅ Projects page — CRUD + status tracking
2. ✅ Team builder — add/remove members, set role, allocation %, outsourcing salary
3. ✅ Budget table — per-member breakdown + totals (cost, revenue, margin)
4. ✅ Excel export
5. ✅ Offering validation — cross-checks team composition against selected offering

---

## Notes

- A candidate can be assigned to **multiple projects** simultaneously
- The module is currently **internal only** — not exposed to clients
- All figures and rates are configurable — the catalog above is the default starting point
