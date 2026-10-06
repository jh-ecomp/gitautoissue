---
code: "GAI-04"
title: "CLI Interface with Dry-Run Mode and Rate Limit Resilience"
epic: "EP-01"
sprint: 1
priority: "P1"
size: "M"
estimate: 5
platform: "backend"
---

# GAI-04: CLI Interface with Dry-Run Mode and Rate Limit Resilience

## As a
Developer or CI runner executing GitAutoIssue...

## I want
A flexible command-line interface with a dry-run preview mode (`--dry-run`), epic filters (`--epic=...`), configurable path flags, and automatic rate-limit cooldown...

## So that
I can safely review changes before applying them and run batch imports without worrying about network aborts.

## Acceptance Criteria
- [ ] `--dry-run` flag: prints an execution plan (issues to create, update, link, and project field mappings) without making write calls.
- [ ] `--epic=CODE` flag: filters sync execution to a single designated epic and its child stories.
- [ ] `--config=PATH` flag: supports custom configuration file paths.
- [ ] Automatically detects GitHub rate-limiting responses, parses the `x-ratelimit-reset` header, and logs an ETA countdown.
- [ ] Resumes execution seamlessly once rate-limiting resets.
- [ ] Displays a clean summary table upon completion (total epics, stories created/updated, project items mapped).
