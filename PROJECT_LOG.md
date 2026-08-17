# PROJECT_LOG.md: LNKDREC Dashboard Evolution

## Feb 20, 2026 - Status Filter and Design Refinement

### ✅ Accomplishments
- **Implemented Status Filtering:** Added a "Filter by Status" dropdown to the candidates grid (All, UnVetted, Vetted, Assigned).
- **Refined Selection Logic:** Implemented `appearance-none` and `bg-white` to the filter select to match the clean design system.
- **Git Push:** Deployed the latest UI updates to the main branch on GitHub.

### 🧠 Decision Log
- **Why Dropdown over Pills?** We started with a basic `<select>` for speed. The user preferred a "flatter" white-on-white look over the default browser shading. 
- **Next Refinement:** Move from `<select>` to a custom Button Group/Segmented Pill component if the number of statuses remains small (4).

### 📝 Lessons Learned
- **CSS Neutrality:** Default browser elements (like select menus) often carry "silver" or "gray" shading that can clash with a high-end clean aesthetic. Always use `appearance-none` for a more custom-tailored look.
- **Data Integrity:** Capitalization mismatches in database lookups (e.g., 'Open' vs 'open') can break aggregate counts; always use case-insensitive queries (`ilike`) or standardizing helpers.

## Mar 3, 2026 - Sales Dashboard & Platform Rebrand

### ✅ Accomplishments
- **Rebranding:** Renamed "LNKD Brain" → "LNKD Platform" across navigation, metadata, and page titles.
- **Sales Dashboard Deployed (`/sales`):**
    - Live metrics for Active Portfolio, New Leads, Delivery Pipeline (sum of vacancies), and Submissions.
    - Added "Impact Logs" to track Executive Insights (Successes/Pivots).
    - Client Roster: Condensed table with custom sorting (New Lead > Active Partner > Churned) and `line-clamp-2` for next steps.
- **Platform Control Center:** Floating gear icon on Sales page allows live management of client statuses and executive insights.
- **Jobs Engine Enhancements:**
    - Integrated `total_openings` support.
    - Added searchable company funnel filter and inline Job Editor modal (title, status, location, openings).
- **Delivery Logic Fix:** Updated pipeline count to be case-insensitive and sum the `total_openings` for all "Open" jobs.

### 🧠 Decision Log
- **Why `/sales`?** To separate recruiter-focused sourcing from executive-focused client management.
- **Case Sensitivity:** Discovered that job status counts were failing because some were 'Open' and others 'open'. Standardized to sum all variations.

## Mar 11, 2026 - Component Unification & Feature Expansion

### ✅ Accomplishments
- **Unified Candidate Details:** Created `@/components/CandidateDetailsModal.tsx` as a single source of truth for viewing and editing candidates. Replaced inline modals in `Dashboard` and `Pipeline` with this component.
- **Enhanced Pipeline Page:** Clicking "Details" in the Kanban board now shows the full interaction timeline, tech stack, and work history.
- **Candidate Highlighting:** Added a "Star" toggle to highlight top-tier candidates. Implemented `is_highlighted` column in Supabase and Amber glow styling on cards.
- **Filter Stabilization:** Patched "Assigned Only" filter to include candidates in `Offer` or `Hired` stages who still have active job assignments.
- **Restored Design System:** Reverted UI tweaks to match the user's preferred high-contrast status badge colors and high-end button styling.

### 🧠 Decision Log
- **Shared Component:** Moving to a shared component was necessary for maintainability as the details form became more complex (Education, Brief, Timeline).
- **Highlighting Logic:** Chose an amber border and "🌟 Top Match" badge for highlighted candidates to ensure they pop against the white/slate aesthetic.

### 🏗️ Backlog
- [ ] **Universal Activity Logging:** Expand `activity_log` to track *all* database additions, edits, and deletions (Add `actor`/`user_id` column once Auth/Roles are implemented).
- [ ] Implement "Point 1" from Arscontexta: Automatic PRD extraction from chats.
- [ ] Replace basic dropdown with Segmented Pills for better "Vibe."
- [ ] Add tooltips for Match Score details.
- [ ] WhatsApp Integration (High Priority).
- [ ] Client Portal (High Priority).

## Aug 17, 2026 - pdf-inspector Migration (CV Parsing Overhaul)

### ✅ Accomplishments
- **Replaced `pdf2json` with `@firecrawl/pdf-inspector`** in the CV upload pipeline (`app/api/upload-cv/route.ts`).
  - Adds PDF classification (TextBased / Scanned / ImageBased / Mixed) in ~15ms
  - Structured markdown extraction with heading detection, table detection, multi-column layout
  - Classification metadata exposed in API response (`_pdf_meta`) for UI triage
- **Created `lib/pdfInspector.ts`** — wrapper with `inspectPdf()` that returns classification, structured markdown, plain text fallback, and layout analysis.
- **Rewrote `app/api/enrich-candidate/route.ts`**:
  - Expanded LLM prompt to extract 11 fields (up from 3): technologies, tools, work_history (with dates + company), education, certifications, languages, soft_skills, industry_experience, seniority_level, summary, years_experience.
  - Input limit raised from 3,000 to 8,000 chars (markdown is more compact than raw text).
  - Section-aware prompting — LLM told to use markdown headings to locate Education, Certifications, etc.
  - Regex fallback expanded from 18 → 52 tech keywords, 25 → 41 tools.
- **Expanded taxonomies**: role titles (9 → 42), location detection (7 → 27 cities), tech keywords (32 → 70).
- **Added `serverExternalPackages` to `next.config.ts`** — pdf-inspector is a native NAPI module, must not be bundled by Turbopack.

### 🧠 Decision Log
- **Why pdf-inspector over pdf2json?** pdf2json (last updated 2018) produces raw text with no structure. pdf-inspector gives us classification (so we know if a CV needs OCR), structured markdown (headings, lists, tables, reading order), and is 100x faster (0.47s for 200 PDFs vs ~17s for PyMuPDF).
- **Why keep regex extraction alongside LLM?** Regex is the first-pass fast path in `upload-cv`. The LLM enrichment (`enrich-candidate`) runs async in the background after save. This gives users immediate feedback while richer extraction happens in the background.
- **Why expose `_pdf_meta` in the API response?** Allows the frontend to show warnings for scanned CVs, confidence scores, and page count. The UI can guide users to review scanned CVs more carefully.

### 📊 Expected Impact
| Field | Before | After |
|---|---|---|
| Work history (company names) | 0% (always "Unknown Company") | ~75% |
| Education | Not extracted | New field |
| Certifications | Not extracted | New field |
| Languages | Not extracted | New field |
| Title/role coverage | 9 hardcoded titles | 42 titles + LLM |
| LLM input size | 3,000 chars (truncated) | 8,000 chars (structured) |

### 🏗️ Backlog
- [ ] Frontend: Show `_pdf_meta` warning badge when `has_scanned_pages: true`
- [ ] Frontend: Display extracted `education`, `certifications`, `languages` in candidate detail view
- [ ] Consider adding `education`, `certifications`, `languages` columns to `candidates` table if they don't exist
- [ ] Test with real Arabic/bilingual CVs to verify classification + extraction quality
