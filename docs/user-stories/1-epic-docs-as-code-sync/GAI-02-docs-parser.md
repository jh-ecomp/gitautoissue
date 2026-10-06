---
code: "GAI-02"
title: "Declarative Agile Documentation & Metadata Parser (docs/)"
epic: "EP-01"
sprint: 1
priority: "P0"
size: "M"
estimate: 5
platform: "backend"
---

# GAI-02: Declarative Agile Documentation & Metadata Parser (docs/)

## As a
Product Owner or Tech Lead writing specifications in Markdown...

## I want
The tool to automatically parse files in the `docs/` folder, extracting metadata from YAML frontmatter and roadmap/sprint calendars...

## So that
Markdown documentation serves as the single source of truth (*Docs-as-Code*), eliminating manually maintained metadata maps in code.

## Acceptance Criteria
- [ ] Parses sprint schedule files (`sprints.yml` / JSON / Markdown) and indexes start and end dates by sprint number.
- [ ] Parses epic documents and extracts metadata (`code`, `name`, `priority`, `size`, `estimate`, `startDate`, `targetDate`).
- [ ] Traverses epic directories to parse individual story documents with YAML frontmatter (`code`, `epic`, `sprint`, `priority`, `size`, `estimate`).
- [ ] Robust fallback: if frontmatter is missing, extracts story code and title from the leading `# CODE: Title` heading.
- [ ] Ignores auxiliary documents (e.g., `README.md`, `PROGRESS.md`).
- [ ] Validates document integrity before making API calls (e.g., warns if a story references an undefined epic).
