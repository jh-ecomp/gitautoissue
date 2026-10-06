---
code: "GAI-03"
title: "Idempotent Issue Creation & Sub-issue Linking Engine"
epic: "EP-01"
sprint: 1
priority: "P0"
size: "L"
estimate: 8
platform: "backend"
---

# GAI-03: Idempotent Issue Creation & Sub-issue Linking Engine

## As a
Team lead managing the project backlog on GitHub...

## I want
To run the sync script repeatedly without generating duplicate issues, ensuring existing issues are updated where necessary and user stories are properly nested under parent Epics as Sub-issues...

## So that
The GitHub Projects board accurately reflects the hierarchical project scope reliably and cleanly.

## Acceptance Criteria
- [ ] Loads all open and closed repository issues into an in-memory index by code (`GAI-01`, `EP-01`) and sanitized title.
- [ ] Reuses existing issues if already registered on GitHub (only updates description when `--update-bodies` is specified).
- [ ] Creates missing issues with title, body extracted from Markdown, configured labels, and target milestone.
- [ ] Links user stories as Sub-issues under their parent Epic using the GitHub GraphQL `addSubIssue` mutation.
- [ ] Handles the `already a sub-issue` GraphQL response gracefully as an idempotent no-op.
- [ ] Adds created issues to GitHub Project v2 and sets custom field values (*Status*, *Priority*, *Size*, *Estimate*, *Start date*, *Target date*).
