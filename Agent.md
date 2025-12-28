# Agent.md — AI PR Review (Requirement-grounded) + ElevenLabs Voice

## 0) One-liner
Build a web app that reviews a Pull Request (or diff) against a sprint requirement document, produces structured findings (PASS/FAIL/CLARIFY) with evidence, and runs a voice-driven human-in-the-loop approval flow using ElevenLabs before generating/posting a GitHub comment.

## 1) Non-negotiable constraints (Hackathon & Product)
- Must use **Google Cloud** services (Cloud Run + Vertex AI Gemini) and **ElevenLabs** (Partner).
- No other AI tools besides Google Cloud AI tools (Gemini via Vertex AI) + ElevenLabs AI features.
- Must run on **web** and provide a **hosted URL** (deploy on GCP).
- Human-in-the-loop: do NOT auto-post to GitHub without user approval.

## 2) MVP scope (1-day deliverable)
### Inputs
- Upload requirement document: PDF/MD/TXT (MVP: accept plain text extraction; PDF optional).
- Provide PR diff:
  - MVP option A: user uploads `.diff` / `.patch` file (recommended for speed)
  - Optional: user pastes GitHub PR URL (read-only fetch for public PR)

### Outputs
- Structured findings list with:
  - requirement criterion reference
  - evidence: file path + line ranges
  - reason/suggestion (for FAIL/CLARIFY)
  - confidence score
- Diff viewer that auto-scrolls and highlights evidence lines for selected finding.
- Voice UX: ElevenLabs TTS reads the current finding and asks for decision:
  - Approve / Dismiss / Edit wording
- Generate final comment text from approved findings:
  - MVP: **Copy comment**
  - Optional: Post to GitHub PR (requires token)

## 3) Tech stack (recommended)
### Frontend (web)
- React.js + TypeScript
- Tailwind + shadcn/ui (or minimal components)
- Diff viewer: `react-diff-viewer` OR `diff2html` (choose one)

### Backend (Google Cloud)
- Cloud Run (Node.js/TypeScript) — single API service
- Vertex AI Gemini (LLM)
- Cloud Storage (store uploaded docs + artifacts) — optional but strongly recommended
- Secret Manager (store ElevenLabs key, GitHub token, Vertex config)

### Partner
- ElevenLabs TTS (minimum) for spoken review
- Optional: ElevenLabs STT / Agent for voice input; MVP can use buttons + text input

## 4) Repo structure (create this)
ai-pr-voice-review/
  web/                      # React.js UI
  api/                      # Cloud Run API (Hono)
  README.md
  agent.md

## 5) Environment variables
### api
- GOOGLE_CLOUD_PROJECT=...
- GOOGLE_CLOUD_LOCATION=us-central1
- VERTEX_MODEL=gemini-2.5-flash (or allowed model)
- ELEVENLABS_API_KEY=...
- ELEVENLABS_VOICE_ID=... (optional)
- GCS_BUCKET=... (optional)
- GITHUB_TOKEN=... (optional, only if posting comments)

### web
- NEXT_PUBLIC_API_BASE_URL=https://<cloud-run-url>

### RequirementSpec
- docTitle: string
- stories: [{ id, title, acceptanceCriteria: [{id, text}] }]

### Finding
- id: "F1"
- storyId, criteriaId
- status: PASS | FAIL | CLARIFY
- summary: short 1-sentence
- reason?: string (fail/clarify)
- suggestion?: string
- evidence: [{ filePath, startLine, endLine }]
- confidence: number 0..1
- proposedComment: string (short bullet for GitHub)
- userDecision?: APPROVED | DISMISSED | EDITED
- userNote?: string

### ReviewResult
- requirement: RequirementSpec
- findings: Finding[]
- talkScript: string (<= 30 seconds spoken)
- draftComment: string (from approved findings)

## 7) Backend API endpoints (Cloud Run)
### POST /api/review
Accept multipart form-data:
- requirementFile (file) OR requirementText (string)
- diffFile (file) OR diffText (string)
- optional prUrl (string) — not required MVP

Return: ReviewResult JSON

### POST /api/tts
Input: { text: string }
Return: audio/mpeg (or base64)
Use ElevenLabs TTS.

### (Optional) POST /api/github/comment
Input: { prUrl, commentBody }
Action: post PR comment (requires GITHUB_TOKEN)
Only called after user approved.

## 8) Prompts (Gemini via Vertex AI)
### Prompt A — Extract acceptance criteria from requirement
Goal: produce RequirementSpec JSON only.
Rules:
- Output must match schema exactly.
- Keep acceptance criteria short and testable.
- If doc is unclear, create minimal stories and include CLARIFY notes inside criteria text (or omit).

### Prompt B — Evaluate diff against criteria
Input:
- RequirementSpec JSON
- unified diff text
Output:
- Findings array JSON only
Rules:
- Evidence must reference actual file names and plausible line ranges.
- If cannot locate evidence, use CLARIFY with reason.
- No hallucinations: do not claim PASS/FAIL without evidence.
- Include `proposedComment` in GitHub-friendly tone.

### Prompt C — Generate talk script
Input:
- Findings JSON
Output:
- spoken script <= 30 seconds; short sentences; ask for decision.
- mention file + line briefly; do not read long code.

## 9) Frontend UX requirements (must implement)
### Screen 1: Upload
- requirement upload area + small preview text snippet
- diff upload area OR paste diff text
- Submit -> calls /api/review
- Show progress states: extracting criteria, analyzing diff, generating voice

### Screen 2: Review
- Top: Voice bubble + Play button + Mic(optional)
- Panel: Findings list (PASS/FAIL/CLARIFY)
- When selecting a finding:
  - highlight evidence in diff viewer
  - auto-scroll to evidence
- Actions per finding:
  - Approve, Dismiss, Edit (text box)
- Draft comment panel:
  - auto-updates from approved findings
  - Copy button
  - Optional Post-to-GitHub button (disabled unless token configured)

## 10) Implementation order (do in this sequence)
1) Scaffold repo + shared types (Zod)
2) Backend /api/review (hardcode test requirement+diff first)
3) Integrate Vertex AI Gemini prompts A+B
4) Build UI to display findings + diff highlight
5) Add /api/tts + play audio in UI
6) Implement approve/dismiss/edit -> regenerate draft comment locally
7) Deploy Cloud Run + set env vars
8) Record demo video (<= 3 min) + write Devpost story

## 11) Guardrails (must follow)
- Never post GitHub comments automatically.
- Never include secrets in logs or UI.
- Always return JSON that matches Zod schema; otherwise fail fast with readable error.
- Keep prompts deterministic; prefer structured outputs.
- Keep costs low: do NOT send entire PDF if already extracted; prefer extracted text + top sections.

## 12) Acceptance criteria (Definition of Done)
MVP is done when:
- User can upload requirement text + diff and receive findings in < 30s.
- UI shows findings list + diff highlight.
- ElevenLabs reads a spoken summary and asks for decision.
- User can approve/dismiss findings and copy a final GitHub comment.
- App is deployed on Google Cloud with a hosted URL.

## 13) Notes for future upgrades (after MVP)
- Add Vertex AI RAG Engine for multi-doc corpora (coding standards, ADR, sprint docs).
- Add GitHub PR URL fetch and comment posting via token/app.
- Add ElevenLabs STT for fully voice-driven decisions.
- Add evaluation + telemetry (Cloud Logging/Monitoring).
