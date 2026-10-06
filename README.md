# GitAutoIssue 🚀

A lightweight, powerful Node.js utility to transform agile Markdown documentation (`docs/`) into **GitHub Epics**, **User Stories**, **Sub-issues**, and **GitHub Projects v2 items** in a fully automated, idempotent way.

---

## 🎯 Why GitAutoIssue?

Managing projects with **Docs-as-Code** keeps your product backlog, architecture decisions, and user stories versioned alongside your code in Git. However, manually synchronizing dozens of Markdown files into GitHub Issues and Projects v2 boards is tedious and prone to human error.

**GitAutoIssue** bridges this gap:
- 📖 **Reads structured Markdown** files and YAML frontmatter from your `docs/` directory.
- 🔍 **Strict Idempotency**: Automatically detects existing issues and updates them without creating annoying duplicates.
- 🌳 **Native Sub-issues Support**: Links user stories directly to parent Epics using GitHub's GraphQL Sub-issues API.
- 📊 **GitHub Projects v2 Integration**: Populates custom fields (*Status*, *Priority*, *Size*, *Estimate*, *Start date*, *Target date*) with zero manual clicking.
- 🛡️ **Rate-Limit Resilience**: Transparently monitors GitHub API rate limits, pausing with a countdown and resuming smoothly when quotas reset.
- 🧪 **Safe `--dry-run`**: Inspect planned mutations before making changes to your repository.

---

## 📋 Prerequisites

1. **Node.js** (version 18 or higher).
2. **GitHub CLI (`gh`)** installed and authenticated with `repo` and `project` scopes:
   ```bash
   gh auth login -s repo,project
   ```
   Verify authentication:
   ```bash
   gh auth status
   ```
3. A **GitHub Project v2** created under your personal account or organization with your desired fields.

---

## 🗂️ Expected Directory Structure

GitAutoIssue parses standard agile documentation conventions. Here is the recommended structure inside your repository:

```
my-project/
├── config.json                     # Project & repository configuration
├── sync-stories.mjs                # Sync script
└── docs/
    ├── sprints.yml                 # Sprint schedule & dates
    └── user-stories/               # Root folder for epics and stories
        ├── 1-epic-authentication/
        │   ├── 1-epic-authentication.md   # Epic document
        │   ├── AUTH-01-login.md           # User Story 1
        │   └── AUTH-02-password-reset.md  # User Story 2
        └── 2-epic-catalog/
            ├── 2-epic-catalog.md          # Epic document
            ├── CAT-01-list-items.md       # User Story 1
            └── CAT-02-item-details.md     # User Story 2
```

---

## 📄 File Specifications

### 1. Sprints / Roadmap File (`docs/sprints.yml`)
Defines the iteration timeline used to automatically populate *Start date* and *Target date* for user stories in GitHub Projects.

```yaml
sprints:
  1:
    name: "Sprint 1 - Foundation & Core Features"
    start: "2026-10-06"
    end: "2026-10-20"
  2:
    name: "Sprint 2 - Advanced Features & Polish"
    start: "2026-10-21"
    end: "2026-11-04"
```

---

### 2. Epic Files (`<epic-folder>/<epic-name>.md`)
Defines the macro scope of the Epic. Add metadata at the top of the Markdown file using YAML frontmatter (`---`):

```markdown
---
code: "EP-01"
name: "User Authentication & Authorization"
priority: "P0"
size: "XL"
estimate: 13
startDate: "2026-10-06"
targetDate: "2026-10-20"
milestone: "v1.0.0 - MVP"
---

# Epic 01 - User Authentication & Authorization

## 1. Overview
This epic covers end-to-end user authentication, password recovery, session handling,
and role-based authorization for the platform.

## 2. Business Goals
- Secure platform access according to industry standards.
- Centralize identity and permission management.
```

#### Epic Fields:
* **`code`**: Unique identifier (e.g., `EP-01`).
* **`name` / `# Heading`**: Issue title on GitHub.
* **`priority`**: Project priority level (`P0`, `P1`, `P2`).
* **`size`**: T-shirt size (`XS`, `S`, `M`, `L`, `XL`).
* **`estimate`**: Numeric story points or effort estimate.
* **`startDate` / `targetDate`**: Date strings in `YYYY-MM-DD` format.

---

### 3. User Story Files (`<epic-folder>/*.md`)
Each user story resides in its own Markdown file inside its parent epic's folder. The file content serves as the issue body.

```markdown
---
code: "AUTH-01"
title: "User Login with Email and Password"
epic: "EP-01"
sprint: 1
priority: "P0"
size: "M"
estimate: 5
platform: "backend"
---

# AUTH-01: User Login with Email and Password

## As a
Registered platform user...

## I want
To sign in using my email and password...

## So that
I can access my personal dashboard securely.

## Acceptance Criteria
- [ ] Validates email format and password strength.
- [ ] Returns a valid JWT upon successful login.
- [ ] Locks account for 15 minutes after 5 consecutive failed attempts.
```

#### User Story Fields:
* **`code`**: Unique story identifier (e.g., `AUTH-01`, `CAT-02`).
* **`epic`**: Parent epic code for Sub-issue linkage.
* **`sprint`**: Target sprint number matching `sprints.yml`.
* **`priority`**: Priority (`P0`, `P1`, `P2`).
* **`size`**: Size (`XS`, `S`, `M`, `L`, `XL`).
* **`estimate`**: Story points (e.g., `1`, `2`, `3`, `5`, `8`).
* **Acceptance Criteria**: Checklist markdown items (`- [ ]`) rendered as interactive checkboxes in GitHub.

---

### 4. Configuration File (`config.json`)
Specifies repository target and custom field mappings:

```json
{
  "repository": "your-username/your-repository",
  "projectNumber": 1,
  "projectOwner": "your-username",
  "defaultMilestone": "v1.0.0 - MVP",
  "docsDir": "./docs/user-stories",
  "sprintsFile": "./docs/sprints.yml",
  "labels": {
    "epic": "Epic",
    "story": "User Story"
  },
  "fieldMappings": {
    "status": "Status",
    "priority": "Priority",
    "size": "Size",
    "estimate": "Estimate",
    "startDate": "Start date",
    "targetDate": "Target date"
  }
}
```

---

## ⚙️ GitHub Project v2 Setup

Ensure your **GitHub Project (v2)** has the following columns and fields configured:

| Field Name | GitHub Field Type | Recommended Options |
|---|---|---|
| **Status** | Single select | `Backlog`, `Ready`, `In progress`, `In review`, `Done` |
| **Priority** | Single select | `P0`, `P1`, `P2` |
| **Size** | Single select | `XS`, `S`, `M`, `L`, `XL` |
| **Estimate** | Number | Numeric value |
| **Start date** | Date | Calendar date |
| **Target date** | Date | Calendar date |

> 💡 **Dynamic Discovery**: GitAutoIssue automatically queries GraphQL introspections to discover field IDs and option IDs dynamically. No hardcoded hashes or crypto strings required!

---

## 🚀 Usage

### 1. Dry Run Simulation (Recommended First Step)
Simulate the synchronization process without modifying anything on GitHub:

```bash
node sync-stories.mjs --dry-run
```

### 2. Synchronize a Specific Epic
Sync only a single epic and its related stories:

```bash
node sync-stories.mjs --epic=EP-01
```

### 3. Full Synchronization
Process all epics, stories, and sprint assignments found in `docs/`:

```bash
node sync-stories.mjs
```

### 4. Update Existing Issue Descriptions
Refresh issue descriptions on GitHub if local Markdown files have been edited:

```bash
node sync-stories.mjs --update-bodies
```

---

## ❓ FAQ & Troubleshooting

### ⚠️ What happens during GitHub Rate Limiting?
GitAutoIssue automatically detects `403/429` rate limit responses and reads the `x-ratelimit-reset` header. It logs the exact target reset time, waits automatically, and resumes without losing execution state.

### ⚠️ Will running the script multiple times duplicate issues?
No. GitAutoIssue indexes all existing issues by title and story code (`AUTH-01`, `EP-01`). If an issue already exists, it reuses the issue number and only updates project fields or body content if explicitly instructed.

### ⚠️ Where can I read the full engineering design?
Check [`spec.md`](./spec.md) for the complete architecture RFC, data schemas, and the 5-loop software development plan.
