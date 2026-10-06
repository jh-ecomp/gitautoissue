---
code: "GAI-01"
title: "Dynamic Field and ID Discovery for GitHub Projects v2"
epic: "EP-01"
sprint: 1
priority: "P0"
size: "M"
estimate: 5
platform: "backend"
---

# GAI-01: Dynamic Field and ID Discovery for GitHub Projects v2

## As a
Developer configuring GitAutoIssue for my repository...

## I want
The script to query the GitHub GraphQL API to automatically resolve internal project IDs, custom field IDs (`Status`, `Priority`, `Size`, `Estimate`, `Dates`), and single-select option IDs...

## So that
I don't have to manually inspect network payloads or hardcode cryptographic IDs (`PVT_...`, `PVTSSF_...`) into the source code.

## Acceptance Criteria
- [ ] Resolves the project's node ID using `projectOwner` and `projectNumber` specified in `config.json`.
- [ ] Dynamically maps custom field names to internal field IDs.
- [ ] Maps single-select options (`P0`, `P1`, `P2`, `Backlog`, etc.) to internal option IDs at runtime.
- [ ] Displays a helpful error message if a mapped field is missing from the GitHub Project v2 board.
- [ ] Caches discovered schema during the execution cycle to prevent redundant API queries.
