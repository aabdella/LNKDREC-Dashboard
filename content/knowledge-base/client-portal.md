# Client Portal

## Description
The Client Portal represents the client-facing review layer of the platform, where candidate visibility and movement should be controlled more deliberately than in internal recruiter workflows.

## Available Features

### Feature: Client-side candidate review
- The portal is intended to expose candidate records for client review.
- It acts as a controlled presentation layer rather than a sourcing workspace.

### Feature: Candidate progression visibility
- Clients should be able to understand where a candidate sits in the process.
- This feature is about transparency and shared workflow alignment.

### Feature: Review and decision handoff
- The portal is expected to support client input or decisions on candidates.
- This helps bridge internal evaluation and client-side progression.

### Feature: Controlled access to records
- The portal should expose only the right records, not the entire internal system.
- Access boundaries are a core part of the page’s purpose.

## How features behave

### Client-side candidate review
- Candidate review in the portal should feel curated.
- The portal is not meant to mirror every internal-only field or internal operational tool.

### Candidate progression visibility
- Status visibility should help clients understand process state without exposing unnecessary operational noise.
- This feature becomes more useful as internal-to-client workflow mapping becomes clearer.

### Review and decision handoff
- Client decisions should be interpreted as structured workflow input, not informal comments floating outside the system.
- The portal becomes most valuable when those decisions connect directly to downstream recruiter actions.

### Controlled access to records
- The portal should always be more restrictive than internal pages.
- Its behavior should be shaped by privacy, role boundaries, and presentation quality.

## Notes
- The client portal is still a strategic area with unresolved product decisions.
- Future documentation should define exactly which candidate subsets appear here, whether clients can change stages, and what the white-label / account model should be.
