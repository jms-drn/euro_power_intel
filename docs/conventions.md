# European Power Intel – Conventions

## Project
- Repo: jms-drn/euro_power_intel (renamed Nov 2026), served via GitHub Pages
- Development happens in the work Copilot account; API registrations are work-approved
- The public site uses open data only

## How we work
- Small batches only: long replies fail
- One step at a time; wait for my result before moving on unless I ask for several items together
- Start each session by pasting the current file from GitHub Raw
- Always give complete replacement files inline in code blocks
- Never attachments, never partial snippets, never "edit this section"

## Code rules
- Dates: always use .strftime(), never format specs inside f-strings
  (they get stripped when pasted in chat and have broken scripts twice)
- File naming: [CONFIRM: underscores or dashes] for .js and .py files, used consistently
- Secrets: referenced by name only (ENTSOE_API_KEY); never in code or chat

## Design rules
- Minimal and professional; muted colours, nothing bright or gaudy
- Homepage: site title, byline, market cards, simple footer; no sidebar or top bar
- Subtle hover effects and clean page transitions

## Accuracy
- Don't invent data, column names, file paths or quotes; ask if unsure
