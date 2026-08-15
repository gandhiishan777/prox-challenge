#!/usr/bin/env bash
# Rebuild the whole knowledge pack from files/*.pdf.
#
# Evaluators never need to run this — knowledge/ is committed. It exists so the
# extraction is reproducible and auditable: given the same PDFs and the same
# crop_spec.json, it regenerates the pack byte for byte (except stage 3, which
# calls a vision model and needs ANTHROPIC_API_KEY).
#
# Usage:  ./scripts/run_pipeline.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> 0. inspect source PDFs"
python3 scripts/00_inspect.py

echo "==> 1. render pages"
python3 scripts/01_render_pages.py

echo "==> 2. dump text layer"
python3 scripts/02_extract_text.py

echo "==> 3. vision transcription (skips pages already transcribed)"
python3 scripts/03_transcribe.py

echo "==> 4. sectionize"
python3 scripts/04_sectionize.py

echo "==> 5. crop figures"
python3 scripts/05_extract_figures.py

echo "==> 6. parts list"
python3 scripts/06_build_parts.py

echo "==> 7. manifest"
python3 scripts/07_build_manifest.py

echo "==> 8. QA gate (numeric)"
python3 scripts/08_qa.py

echo "==> 9. semantic fact check"
python3 scripts/09_verify_facts.py

echo
echo "knowledge pack rebuilt."
