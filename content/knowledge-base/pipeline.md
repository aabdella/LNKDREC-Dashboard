# Pipeline

## Description
The Pipeline page is the stage-based workflow view for moving candidates through the recruiting process.

## Available Features

### Feature: Kanban stage columns
- Candidates are grouped into stage columns.
- Each column represents a meaningful workflow state.

### Feature: Drag and drop
- Candidates can be dragged between stages.
- This is the primary workflow mechanism on the page.

### Feature: Stage aging visibility
- The page shows how long a candidate has been in a stage.
- This helps identify stalled candidates.

### Feature: Candidate cards
- Each candidate appears as a compact card with key operating signals.
- Cards are optimized for quick progression decisions.

### Feature: Details access
- A candidate card can open a fuller details view.
- This allows review without leaving the pipeline context.

### Feature: Remove from pipeline
- Candidates can be removed from pipeline tracking.
- This is a direct workflow reset action.

## How features behave

### Kanban stage columns
- Columns reflect the recruiting funnel rather than a raw database list.
- The page translates candidate state into a board that is easier to operate.

### Drag and drop
- Moving a candidate updates their workflow stage.
- Stage moves are not just visual; they represent a real state transition.
- The page should refresh and preserve the new ordering/state after a move.

### Stage aging visibility
- Aging is derived from stage timing references.
- It is used to highlight candidates who may need action or follow-up.

### Candidate cards
- Cards are intentionally compact.
- They surface identity, score/context, and quick external links where available.
- The card design is meant for scan speed more than deep editing.

### Details access
- Opening details is the escape hatch from lightweight pipeline scanning into deeper review.
- The operator should be able to review a candidate without losing pipeline context.

### Remove from pipeline
- Removing from pipeline should be treated carefully because it changes how the candidate is tracked operationally.
- This action is best understood as taking a person out of the current funnel view.

## Notes
- The pipeline page is where workflow state becomes most visible.
- Future docs should capture exact stage mapping rules and status synchronization behavior.
