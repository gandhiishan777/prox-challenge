# OmniPro 220 Assistant — build checklist

## Phase 0 — repo, materials, scaffold, spikes
- [x] Clone fork, adopt its three source PDFs, verify `.env` gitignored before any commit
- [x] Characterize the corpus before building anything (`00_inspect.py`)
- [x] Next 16 / React 19 / Tailwind scaffold
- [x] Spike A: artifact sandbox renders hand-written fixtures (verified in real Chrome)
- [x] Spike B: SDK → SSE → browser (folded into phases 2–3; verified by curl and in browser)

## Phase 1 — knowledge pack
- [x] Render 51 pages at 150 DPI + thumbnails + hi-res crops source
- [x] Vision-transcribe every page (51/51, zero unreadable markers)
- [x] Sectionize with page markers so citations survive
- [x] Crop 26 figures via curated `crop_spec.json`
- [x] Curate specs / duty cycle / troubleshooting / settings / parts as JSON with page citations
- [x] QA gate: every curated number traced to its cited page (0 failures, 0 warnings)

## Phase 2 — agent core
- [x] Pure lookup layer + 22 unit tests
- [x] 8 in-process MCP tools
- [x] System prompt: grounding, clarification, modality, artifact contract
- [x] CLI harness (`npm run ask`) showing tool traces
- [x] All three challenge questions correct

## Phase 3 — artifact runtime + frontend
- [x] Streaming artifact parser + byte-offset invariance tests
- [x] SSE relay, image route with traversal guard
- [x] Chat UI: transcript, markdown, figures, option chips, tool activity, composer
- [x] Artifact panel: versions, preview/code, download, error card + Fix it
- [x] Verified end to end in real Chrome incl. generated calculator

## Phase 4 — eval
- [x] Gold set (18 cases) with programmatic gates + LLM judge
- [x] Harness verified
- [x] Full run: 15/18, all 3 failures investigated (1 real fix, 2 corrected assertions), re-verified 3/3

## Phase 5 — ship
- [x] README with architecture and design decisions
- [x] DECISIONS.md, PHASE_LOG.md, REVIEW_BRIEF.md
- [x] Dockerfile + .dockerignore
- [x] Clean-clone timer test: 11s from GitHub clone to installed
- [ ] Deploy (needs the user's hosting account)
- [ ] Video walkthrough (needs the user)
