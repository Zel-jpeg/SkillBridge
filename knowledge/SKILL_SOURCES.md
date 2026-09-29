# Skill Sources and Demonstration Guide

Prepared on September 29, 2026. This project contains six skills: two original
SkillBridge workflows and four complete downloaded skill folders. The supporting
`AGENTS.md` and knowledge files are separate from the minimum four-skill requirement.

## Authorship and provenance

| Skill | Author / origin | Local entry point | License |
| --- | --- | --- | --- |
| skillbridge-assessment-review | Original SkillBridge project workflow, generated with Codex assistance | [SKILL.md](../.agents/skills/skillbridge-assessment-review/SKILL.md) | No separate license assigned in this setup |
| skillbridge-recommendation-audit | Original SkillBridge project workflow, generated with Codex assistance | [SKILL.md](../.agents/skills/skillbridge-recommendation-audit/SKILL.md) | No separate license assigned in this setup |
| vercel-react-best-practices | Vercel Engineering / Vercel Labs | [SKILL.md](../.agents/skills/vercel-react-best-practices/SKILL.md) | MIT, as declared in upstream skill frontmatter |
| webapp-testing | Anthropic | [SKILL.md](../.agents/skills/webapp-testing/SKILL.md) | Apache 2.0; retained [LICENSE.txt](../.agents/skills/webapp-testing/LICENSE.txt) |
| frontend-design | Anthropic | [SKILL.md](../.agents/skills/frontend-design/SKILL.md) | Apache 2.0; retained [LICENSE.txt](../.agents/skills/frontend-design/LICENSE.txt) |
| design-taste-frontend | Leonxlnx / Taste Skill community project | [SKILL.md](../.agents/skills/design-taste-frontend/SKILL.md) | MIT; retained repository-root [LICENSE](../.agents/skills/design-taste-frontend/LICENSE) |

### Vercel React Best Practices

- Repository: [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills).
- Upstream folder: `skills/react-best-practices`.
- Downloaded commit: `063bee94c3f4df8453406c830b0a7df0f2860278`.
- Pinned source: [complete skill folder](https://github.com/vercel-labs/agent-skills/tree/063bee94c3f4df8453406c830b0a7df0f2860278/skills/react-best-practices).
- Upstream metadata version: `1.0.0`; the commit is the precise revision identifier.
- Local folder is named `vercel-react-best-practices` to match its frontmatter name. Folder contents are unmodified.
- Preserve the compiled [AGENTS.md](../.agents/skills/vercel-react-best-practices/AGENTS.md), [README.md](../.agents/skills/vercel-react-best-practices/README.md), [metadata.json](../.agents/skills/vercel-react-best-practices/metadata.json) and `rules/` resources together.
- The pinned repository root and skill folder do not supply a standalone license file. The original `license: MIT` declaration is retained; no replacement copyright notice or license text was invented.

### Anthropic Web App Testing

- Repository: [anthropics/skills](https://github.com/anthropics/skills).
- Upstream folder: `skills/webapp-testing`.
- Downloaded commit: `8a1541c4a3ffa5a20a5a91de0dcf3f0bab1d1ef4`.
- Pinned source: [complete skill folder](https://github.com/anthropics/skills/tree/8a1541c4a3ffa5a20a5a91de0dcf3f0bab1d1ef4/skills/webapp-testing).
- Folder contents are unmodified, including `LICENSE.txt`, `scripts/with_server.py` and the three Python examples.
- Downloading the skill does not install Python Playwright or browser binaries. Install those into an appropriate development environment when browser testing is needed.

### Anthropic Frontend Design

- Repository: [anthropics/skills](https://github.com/anthropics/skills).
- Upstream folder: `skills/frontend-design`.
- Downloaded commit: `8a1541c4a3ffa5a20a5a91de0dcf3f0bab1d1ef4`.
- Pinned source: [complete skill folder](https://github.com/anthropics/skills/tree/8a1541c4a3ffa5a20a5a91de0dcf3f0bab1d1ef4/skills/frontend-design).
- Installed as an additional fifth skill; the original four remain available.
- Complete upstream contents are retained without modifications. Raw files at the pinned commit preserve original bytes after sparse Git checkout on Windows.
- Provides visual design guidance for new and existing interfaces. Installing it does not redesign the application or change UI code.

### Taste Skill

- Repository: [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill), linked by the project's [documentation](https://www.tasteskill.dev/docs).
- Upstream folder: `skills/taste-skill`; frontmatter name: `design-taste-frontend`.
- Downloaded commit: `ce26fc25c0e5e8cab638f883de62d9a86ee5e45b`.
- Pinned source: [complete skill folder](https://github.com/Leonxlnx/taste-skill/tree/ce26fc25c0e5e8cab638f883de62d9a86ee5e45b/skills/taste-skill).
- The core skill is v2 experimental. It is community-authored, separate from Anthropic's official skills.
- The upstream folder contains only `SKILL.md`. The complete file is retained without changes, with the repository-root MIT license copied alongside it. The proposed block library is described as future work in the skill; no block files are supplied at this revision.
- Scope: landing pages, portfolios and visual redesigns. Upstream explicitly excludes dashboards, data tables, admin panels and multi-step product UI. Prefer the existing `frontend-design` skill for authenticated SkillBridge screens.
- Apply contextual guidance while preserving the user's brief, current React/Vite architecture, shared icon source and dependency constraints. Next.js, extra icon libraries and animation packages are not requirements for SkillBridge.
- Installation adds instruction files only; it does not modify the application, install frontend packages, deploy or change data.

## Example prompts and expected outputs

These are demonstration scenarios, not claims that browser or database tests have
already been performed.

### 1. Original assessment review

**Prompt:** "Use $skillbridge-assessment-review to review an assessment with 10 MCQ
questions in one category. Seven answers are correct and three questions are
omitted. Compare the expected full-assessment score with the actual submission
path, then inspect duplicate question IDs and approved retakes. Do not change code."

**Expected output:** An expected-versus-actual table comparing the intended 7/10
= 70% with the implementation's denominator, source references, confirmed or
unverified findings, and the checks used. The skill must not assume missing
answers are counted correctly without tracing the payload and grading code.

### 2. Original recommendation audit

**Prompt:** "Use $skillbridge-recommendation-audit to explain a synthetic position
with category similarity 80%, NLP similarity 60% and location similarity 50%.
Calculate the weighted score from current code and explain the completion and
evidence checks before display. Do not write to the database."

**Expected output:** With current 60/25/15 weights, 48 + 15 + 7.5 = 70.5%; an
explanation of active-batch, required-completion and finalized/current evidence
checks, separately from placement approval. Do not invent actual student records
or a rank without competing candidates.

### 3. Downloaded Vercel skill

**Prompt:** "Use $vercel-react-best-practices to review
skillbridge-frontend/src/App.jsx and the relevant components it imports for
unnecessary rerenders, sequential independent requests and oversized imports.
Apply guidance relevant to React with Vite. Report findings without editing files."

**Expected output:** Relevant performance findings with source locations,
applicable upstream rules and suggested changes; omit Next.js-specific advice
that does not apply. State when no issue is confirmed.

### 4. Downloaded Anthropic skill

**Prompt:** "Use $webapp-testing to test a local SkillBridge assessment workflow
with a synthetic enrolled student. Check start, answer selection, submission and
result display. Capture screenshots and browser errors, and report any blocked
prerequisites. Use the existing test environment."

**Expected output:** A pass/fail/blocked summary with reproducible actions,
expected versus actual UI behavior, screenshot locations and relevant console
errors. Never present an unexecuted flow as passing. Use local fixtures and test
credentials rather than production records.

### 5. Downloaded Anthropic frontend design skill

**Prompt:** "Use $frontend-design to update SkillBridge's student dashboard as a
professional college OJT portal. Preserve existing functionality and branding.
Improve typography, spacing, navigation and information hierarchy. Avoid
decorative gradients, repetitive card grids, excessive rounded corners and
unnecessary animations."

**Expected output:** An intentional visual direction tied to the OJT workflow,
followed by responsive UI changes that preserve existing behavior, with visual
review and accessibility checks. Follow the user's brief rather than imposing a
generic dashboard template. This prompt authorizes UI work only when submitted
as a separate task; the skill installation itself does not perform it.

### 6. Downloaded Taste Skill

**Prompt:** "Use $design-taste-frontend to review SkillBridge's public landing
page. Keep the DNSC audience, green branding and current React/Vite stack.
Suggest focused improvements to typography, spacing and visual hierarchy. Keep
motion restrained, reuse existing icons and do not add dependencies or edit code."

**Expected output:** A brief design read and a prioritized visual review grounded
in the public page. Respect the existing functionality and provide recommendations
only. This skill does not replace product UX research or authorize changes to
authenticated dashboards.

## How the downloads were made

Both sources were resolved to commit IDs and installed with Codex's
`skill-installer/scripts/install-skill-from-github.py`, using `--repo`, `--path`,
`--ref` and project-local `--dest .agents/skills`. Vercel used archive download;
Anthropic used sparse Git checkout after an interrupted archive connection. The
installer copies each full selected skill folder and does not copy a nested Git
repository into the project. Git's Windows line-ending conversion was then
removed by fetching Anthropic's six files from raw URLs at the same pinned commit,
so the final copies retain the exact upstream bytes.

The additional `frontend-design` skill also used the installer with sparse Git
checkout, followed by raw downloads at its pinned commit to preserve exact bytes.

Taste Skill used the same installer with archive download, the pinned commit above,
`--name design-taste-frontend` and project-local `--dest .agents/skills`. Its root
MIT license was downloaded from the same commit. No upstream installer scripts,
`npx` commands or application package installs were executed.

For a manual download:

1. Open a pinned source folder link above and navigate to its repository at that commit.
2. Download the repository ZIP, or download the commit archive through GitHub.
3. Extract it outside the project and copy the entire selected `skills/<folder>` into `.agents/skills/`.
4. Keep the Vercel local folder name `vercel-react-best-practices`; keep Anthropic's `webapp-testing` name.
5. Preserve supporting files and supplied licenses. Update this record with the new commit if replacing a download.

## Verification scope

Completed checks:

- All four entry points passed the skill-creator frontmatter validator in UTF-8 mode.
- Vercel's 76 files and Anthropic's six files matched the pinned upstream inventories and Git blob hashes byte for byte.
- All 46 local Markdown links in the new project documentation and original skills resolved.
- Referenced Vercel rules and Anthropic helper, examples and license were present.
- Anthropic's `scripts/with_server.py --help` command succeeded.
- The additional `frontend-design` entry point passed the same validator; both supplied files matched the pinned Git blob hashes byte for byte.
- After adding the fifth skill, all five entry points were present and all 32 links in `AGENTS.md` and the knowledge documents resolved.
- After adding Taste Skill, its frontmatter name and description, two-file inventory and MIT license were checked. Its `SKILL.md` and license matched the pinned upstream Git blob hashes exactly, and all 34 local links across `AGENTS.md`, `PROJECT_OVERVIEW.md` and this source guide resolved.

The validator's PyYAML dependency was installed in a temporary folder, without
changing application dependencies. Repeat resource and provenance checks when
updating either external skill.

Skill installation leaves application code unchanged. Example prompts document how to demonstrate the
skills; runtime assessment and browser demonstrations are separate work.
