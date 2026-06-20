# Jobs

## Description
The Jobs page manages companies, open roles, and job-level recruiting demand inside the platform.

## Available Features

### Feature: Job list
- The page lists jobs with company context and opening information.
- It acts as the structured source of job demand for other parts of the app.

### Feature: Client filter
- Jobs can be filtered by client/company.
- This helps operators focus on one account at a time.

### Feature: Create client
- New client records can be created from the page.
- This supports onboarding new demand sources directly in workflow.

### Feature: Create job
- New job records can be created with title, location, description, status, and openings.
- This is a core data-entry function of the page.

### Feature: Edit job
- Existing jobs can be edited in-place through modal flows.
- This keeps demand records current as hiring needs evolve.

### Feature: Assigned candidates view
- A job can show assigned candidates.
- This connects demand with current delivery progress.

## How features behave

### Job list
- The list is not just descriptive; it powers downstream sourcing and recruiting workflows.
- Open jobs are especially important because they feed sourcing and matching contexts.

### Client filter
- Filtering by client helps reduce noise in multi-client operations.
- It is mainly a workflow convenience layer over the same underlying jobs dataset.

### Create client
- Client creation is foundational because jobs depend on company ownership context.
- It allows the platform to stay structured rather than storing jobs without account linkage.

### Create job
- Job creation establishes a real operating target for sourcing and delivery.
- The role description and openings count are especially important inputs elsewhere.

### Edit job
- Editing keeps job records aligned with the latest reality.
- Since demand changes, this function is operationally important rather than optional.

### Assigned candidates view
- Assigned candidate visibility helps explain delivery status from the job side.
- It gives job owners a direct read on active fulfillment.

## Notes
- This page is the demand-side backbone of the platform.
- Future docs should add exact remaining openings logic, status rules, and job-to-sourcing dependencies.
