# Candidates

## Description
The Candidates page is the main operating surface for reviewing, filtering, vetting, assigning, and managing candidate records.

## Available Features

### Feature: Candidate list view modes
- The page supports both **grid** and **list** style browsing.
- View mode affects how candidates are scanned and selected, but not the underlying data.

### Feature: Search
- Search is used to narrow the candidate set.
- It is intended to help operators quickly find people by relevant visible attributes.
- Search behavior should be treated as part of the main working flow, not a secondary utility.

### Feature: Filtering
- The page includes status-based filtering for candidate review.
- Filtering changes which candidates are visible without changing their stored record.

### Feature: Bulk selection
- Candidates can be selected in bulk from list-oriented workflows.
- Bulk selection is used to apply actions to multiple records in one step.

### Feature: Bulk pipeline move
- Selected candidates can be moved into a chosen pipeline stage.
- This updates pipeline state for all selected records together.

### Feature: Delete selected candidates
- The page supports destructive bulk deletion.
- A confirmation step is required before deletion proceeds.

### Feature: Candidate details modal
- Candidate details open in a modal for deeper review.
- This modal is a key interaction point for reading and editing candidate information.

### Feature: Vetting / assignment / CV actions
- The page supports vetting workflows, assignment-related actions, and CV-related actions through dedicated modal flows.
- These actions are part of the operational lifecycle of a candidate.

## How features behave

### Candidate list view modes
- Grid mode is optimized for scanning cards.
- List mode is optimized for bulk operations and denser review.
- Switching view should not reset the underlying candidate state.

### Search
- Search updates the visible working set.
- It is expected to be used frequently while triaging candidates.
- Search should feel responsive and safe for repeated narrowing.

### Filtering
- Filters operate on the loaded candidate set and help segment work by operational status.
- Filters should be interpreted as workflow lenses, not permanent changes.

### Bulk selection
- Bulk selection is tied to the currently visible candidate set.
- Selecting all applies to the currently filtered results.
- Clearing or changing filters may change which candidates are included in the visible selection context.

### Bulk pipeline move
- Moving selected candidates updates `pipeline_stage` and refreshes the page state afterward.
- The behavior is intended for operational throughput, especially when processing sourced or reviewed groups.

### Delete selected candidates
- Deletion is permanent from the app’s perspective.
- Because this is destructive, the confirmation step is an important protection.

### Candidate details modal
- The modal acts as the main deep-dive interface.
- It is used when summary cards are not enough and full record review is needed.

### Vetting / assignment / CV actions
- These actions represent operational transitions, not just cosmetic edits.
- They should be treated as workflow steps with downstream effects on how a candidate appears elsewhere in the platform.

## Notes
- This page is one of the highest-value documentation targets because it is heavily used and contains multiple overlapping workflows.
- Future documentation should add exact field behavior, status rules, and cross-page dependencies.
