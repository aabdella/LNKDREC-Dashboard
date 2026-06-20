# Sourcing

## Description
The Sourcing page is used to source new candidates, compare them against job requirements, and manage the sourced queue before downstream review.

## Available Features

### Feature: JD input
- A job description can be entered or loaded into the page.
- The JD is the core input for matching and sourcing logic.

### Feature: Job selection
- Open jobs can be selected from a list.
- Selecting a job can populate the sourcing context automatically.

### Feature: Internal matching
- The page can match internal candidates against the active JD.
- This helps determine whether the platform already has strong fits before sourcing outward.

### Feature: Sourced queue
- Newly sourced candidates are shown in a dedicated queue.
- This queue is part of the pre-review sourcing workflow.

### Feature: Quick source
- The page supports sourcing candidates quickly from the active job context.
- This is intended for fast discovery passes.

### Feature: Deep search / deep crawl
- The page supports deeper sourcing workflows for broader or harder searches.
- This is used when quick sourcing is not enough.

### Feature: Candidate review modal
- Sourced or matched candidates can be opened for closer inspection.
- This enables decision-making before downstream movement.

## How features behave

### JD input
- The job description drives matching logic and sourcing interpretation.
- Changing the JD changes the operating context of the page.

### Job selection
- Selecting a saved open job is a convenience layer over manual JD entry.
- It reduces repeated copy/paste and keeps sourcing tied to real jobs.

### Internal matching
- Internal matching acts as a first-pass check against existing supply.
- This is useful before investing effort in external discovery.

### Sourced queue
- The sourced queue is a holding area, not the final workflow destination.
- Candidates here still need review and downstream handling.

### Quick source
- Quick source is optimized for speed.
- It should be used when the goal is rapid idea generation and candidate discovery.

### Deep search / deep crawl
- Deep sourcing is heavier and should be used when broader coverage is needed.
- It is better suited to difficult roles, thin markets, or low-yield initial runs.

### Candidate review modal
- The modal allows source quality to be checked before records move further into the system.
- This helps prevent low-quality or irrelevant candidates from polluting later stages.

## Notes
- This page is central to front-end sourcing operations.
- Future docs should spell out the exact unvetted queue flow and matching/scoring behavior.
