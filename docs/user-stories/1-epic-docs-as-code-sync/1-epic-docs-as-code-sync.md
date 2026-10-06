---
code: "EP-01"
name: "Docs-as-Code Sync Engine for GitHub Projects v2"
priority: "P0"
size: "XL"
estimate: 13
startDate: "2026-10-06"
targetDate: "2026-10-20"
milestone: "v1.0.0 - MVP"
---

# Epic 01 - Docs-as-Code Sync Engine for GitHub Projects v2

## 1. Overview
Build a modular, declarative, open-source Node.js command-line interface (CLI) that ingests agile Markdown documentation from a repository's `docs/` directory and synchronizes Epics, User Stories, Sub-issues, and GitHub Projects v2 fields automatically.

In an **Inception / Dogfooding** approach, this epic tracks the engineering and operational workflow of `gitautoissue` itself.

## 2. Technical & Business Goals
- Eliminate hardcoded IDs and repository-specific configuration in source code (*zero hardcoded IDs*).
- Enable engineering teams worldwide to adopt the tool in under 2 minutes using only a `config.json` and a `docs/` folder.
- Guarantee 100% idempotent synchronization without duplicate issues or board pollution.
- Provide a safe simulation mode (`--dry-run`) to inspect the execution plan before writing to GitHub.
- Transparently monitor and recover from GitHub API rate limits.

## 3. Scope of Work (Linked User Stories)
- **GAI-01**: Dynamic Field and ID Discovery for GitHub Projects v2.
- **GAI-02**: Declarative Agile Documentation & Metadata Parser (`docs/`).
- **GAI-03**: Idempotent Issue Creation & Sub-issue Linking Engine.
- **GAI-04**: CLI Interface with Dry-Run Mode and Rate Limit Resilience.
