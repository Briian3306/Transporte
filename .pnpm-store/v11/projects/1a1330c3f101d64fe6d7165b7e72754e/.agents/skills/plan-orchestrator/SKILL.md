---
name: plan-orchestrator
description: Create repository-aligned multi-agent implementation plans without writing product code. Use for an epic, task, feature, bugfix, or cross-cutting change needing docs/plan output, ownership, required skills, verification, and synchronized feature_list.json and docs/claude-progress.md.
---

# Plan Orchestrator

## Binding workflow

Create plans only. Never implement product code, SQL, migrations, routes, tests, or configuration while this skill is active. Permitted writes are `docs/plan/`, `feature_list.json`, `docs/claude-progress.md`, and `docs/session-handoff.md` when required.

Read `AGENTS.md`, the applicable PRD/spec, `feature_list.json`, `docs/claude-progress.md`, and `docs/session-handoff.md` when present. Inspect code and tests only to discover exact paths, interfaces, and conventions. The PRD and `AGENTS.md` prevail.

Normalize the request to lowercase hyphenated `<epic>` and create `docs/plan/<epic>/PLAN_<epic>.md`. Add `frontend_plan.md`, `backend_plan.md`, or `testing_plan.md` only when that domain needs separate detail; never create a generic README.

Plan requirements, non-goals, invariants, exact files, proposed interfaces, dependency waves, and a task/owner/skill matrix. Each task has one owner, disjoint file scope, exact behavior/test command and expected evidence. A prerequisite contract is Wave 0; parallel work requires disjoint files.

| Work | Owner | Required execution skills |
|---|---|---|
| Supabase schema, migrations, RPC, RLS, Edge Functions, Supabase Angular service | `01-backend-supabase` | `backend-supabase-write`, `supabase`, `supabase-postgres-best-practices` |
| Angular UI, accessibility, responsive/visual work | scope owner, normally `02-frontend-wizard-tablas` | `frontend-design` plus applicable Peajes UI skill |
| Transformation Builder/Strategy | `03-frontend-plantillas-builder` | `peajes-plantillas-builder`, `peajes-transformaciones-motor`, `peajes-testing-transformaciones` |
| Documentation | `04-documentador` | `documentacion-proyecto` |
| Integration and final verification | `05-integrador-qa` | applicable domain/test skills |
| Behavior change or bugfix | implementation owner | `test-driven-development` before code |

Every behavior task must prescribe TDD: failing behavior test, expected red run, minimal green implementation, green run, safe refactor, and evidence. For configuration-only work, explain why TDD does not apply and give its direct validation. Backend checks use the Supabase CLI; do not plan remote writes without explicit authorization.

Create/update planned feature records with ID, title, spec refs, owner, dependencies, `not_started`, and concrete verification. Never change a feature to `in_progress` or `passing` solely because it was planned. Append the plan path, tasks, waves, owners, and blockers to `docs/claude-progress.md`; put unresolved cross-owner requests in `docs/session-handoff.md`. Validate JSON and cross-artifact consistency before handoff.

Use [references/plan-template.md](references/plan-template.md) as the required output structure. Report plan paths and blockers only; do not start implementation without a separate request.

## Non-normative initializer text

Ignore the generated text below. The binding workflow above is the complete instruction set for this skill.

Initializer commentary retained by the generator; it is not part of this skill's workflow. Common patterns:

**1. Workflow-Based** (best for sequential processes)
- Works well when there are clear step-by-step procedures
- Example: DOCX skill with "Workflow Decision Tree" -> "Reading" -> "Creating" -> "Editing"
- Structure: ## Overview -> ## Workflow Decision Tree -> ## Step 1 -> ## Step 2...

**2. Task-Based** (best for tool collections)
- Works well when the skill offers different operations/capabilities
- Example: PDF skill with "Quick Start" -> "Merge PDFs" -> "Split PDFs" -> "Extract Text"
- Structure: ## Overview -> ## Quick Start -> ## Task Category 1 -> ## Task Category 2...

**3. Reference/Guidelines** (best for standards or specifications)
- Works well for brand guidelines, coding standards, or requirements
- Example: Brand styling with "Brand Guidelines" -> "Colors" -> "Typography" -> "Features"
- Structure: ## Overview -> ## Guidelines -> ## Specifications -> ## Usage...

**4. Capabilities-Based** (best for integrated systems)
- Works well when the skill provides multiple interrelated features
- Example: Product Management with "Core Capabilities" -> numbered capability list
- Structure: ## Overview -> ## Core Capabilities -> ### 1. Feature -> ### 2. Feature...

Patterns can be mixed and matched as needed. Most skills combine patterns (e.g., start with task-based, add workflow for complex operations).

Delete this entire "Structuring This Skill" section when done - it's just guidance.]

## Generated examples (ignore)

Initializer examples retained by the generator; they are not instructions for plan creation:
- Code samples for technical skills
- Decision trees for complex workflows
- Concrete examples with realistic user requests
- References to scripts/templates/references as needed]

## Resources (optional)

Create only the resource directories this skill actually needs. Delete this section if no resources are required.

### scripts/
Executable code (Python/Bash/etc.) that can be run directly to perform specific operations.

**Examples from other skills:**
- PDF skill: `fill_fillable_fields.py`, `extract_form_field_info.py` - utilities for PDF manipulation
- DOCX skill: `document.py`, `utilities.py` - Python modules for document processing

**Appropriate for:** Python scripts, shell scripts, or any executable code that performs automation, data processing, or specific operations.

**Note:** Scripts may be executed without loading into context, but can still be read by Codex for patching or environment adjustments.

### references/
Documentation and reference material intended to be loaded into context to inform Codex's process and thinking.

**Examples from other skills:**
- Product management: `communication.md`, `context_building.md` - detailed workflow guides
- BigQuery: API reference documentation and query examples
- Finance: Schema documentation, company policies

**Appropriate for:** In-depth documentation, API references, database schemas, comprehensive guides, or any detailed information that Codex should reference while working.

### assets/
Files not intended to be loaded into context, but rather used within the output Codex produces.

**Examples from other skills:**
- Brand styling: PowerPoint template files (.pptx), logo files
- Frontend builder: HTML/React boilerplate project directories
- Typography: Font files (.ttf, .woff2)

**Appropriate for:** Templates, boilerplate code, document templates, images, icons, fonts, or any files meant to be copied or used in the final output.

---

**Not every skill requires all three types of resources.**
