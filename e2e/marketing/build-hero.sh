#!/usr/bin/env bash
# Records the mobile scan → job result hero flow and transcodes it into the
# hero assets expected by the armory-works marketing site:
#   hero-scan-job-start.mp4   (H.264 portrait, ≤2 MB target)
#   hero-scan-job-start.webm  (VP9 sibling)
#   hero-scan-job-start.jpg   (portrait 440×956 poster — fully-loaded scan page)
#   hero-og.jpg               (1200×630 OpenGraph — letterboxed from portrait)
#
# The Playwright spec records at 440×956 (mobile portrait). The first ~1.5s of
# the capture is navigation + DOM setup (blank/loading frames) — we trim that
# off every derivative so the hero starts on the fully-loaded scan page with
# the stub barcode visible.
#
# Requires: ffmpeg on PATH (or FFMPEG env var pointing at the binary),
# Playwright installed under qb-engineer-ui, and the Docker stack running
# with seeded data.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UI_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
OUTPUT_DIR_RAW="${SCRIPT_DIR}/output"
DEST_DIR="${HERO_DEST_DIR:-E:/dev/armory-works/armory-works-ui/public}"
BASENAME="${HERO_BASENAME:-hero-scan-job-start}"
FFMPEG_BIN="${FFMPEG:-ffmpeg}"

# Seconds to trim from the head of the raw webm so the hero starts on the
# fully-loaded scan page. The spec spends ~3.4s on goto + waitForSelector +
# stub injection + route-loading overlay fade before the first frame is fully
# clean (dark theme applied, stub barcode visible, caption fading in). 3.6s
# gives a consistent first frame across runs.
LEAD_TRIM="${HERO_LEAD_TRIM:-3.6}"

# Seconds into the TRIMMED video to grab the poster/OG still. 0.3s lands on
# a clean frame with Step 1 caption visible — matches the hero poster intent.
POSTER_OFFSET="${HERO_POSTER_OFFSET:-0.3}"

if ! command -v "${FFMPEG_BIN}" >/dev/null 2>&1; then
  # Try the Windows winget install path as a fallback
  FALLBACK="/c/Users/${USER:-${USERNAME:-}}/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1-full_build/bin/ffmpeg.exe"
  if [ -x "${FALLBACK}" ]; then
    FFMPEG_BIN="${FALLBACK}"
  else
    echo "ffmpeg not found — set FFMPEG env var or add it to PATH" >&2
    exit 1
  fi
fi

mkdir -p "${OUTPUT_DIR_RAW}" "${DEST_DIR}"

echo "▶ Recording hero video with Playwright…"
(
  cd "${UI_DIR}"
  HERO_VIDEO_DIR="${OUTPUT_DIR_RAW}" \
    npx playwright test \
      --config "${SCRIPT_DIR}/playwright.config.ts" \
      "${SCRIPT_DIR}/scan-job-start.spec.ts"
)

SRC_WEBM="${OUTPUT_DIR_RAW}/scan-job-start.webm"
if [ ! -f "${SRC_WEBM}" ]; then
  echo "Expected ${SRC_WEBM} but the spec did not produce it" >&2
  exit 1
fi

# Poster seek is relative to the trimmed stream.
POSTER_SS=$(awk -v a="${LEAD_TRIM}" -v b="${POSTER_OFFSET}" 'BEGIN { printf "%.2f", a + b }')

echo "▶ Encoding MP4 (H.264, trim ${LEAD_TRIM}s lead)…"
# -ss AFTER -i does a frame-accurate seek (decodes + discards frames until the
# exact target). Slower than keyframe seek but required here — earlier fast-
# seek kept landing on keyframes BEFORE the trim point, leaving "Camera
# Unavailable" visible in the first MP4 frame. CRF 26 slow preset is visually
# clean at portrait 440×956 while staying well under 2 MB for the ~12 s scene.
"${FFMPEG_BIN}" -y -i "${SRC_WEBM}" -ss "${LEAD_TRIM}" \
  -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p \
  -movflags +faststart \
  -an \
  "${DEST_DIR}/${BASENAME}.mp4"

echo "▶ Encoding WebM (VP9, trim ${LEAD_TRIM}s lead)…"
"${FFMPEG_BIN}" -y -i "${SRC_WEBM}" -ss "${LEAD_TRIM}" \
  -c:v libvpx-vp9 -crf 34 -b:v 0 -row-mt 1 \
  -pix_fmt yuv420p -an \
  "${DEST_DIR}/${BASENAME}.webm"

echo "▶ Extracting portrait poster (seek ${POSTER_SS}s into source)…"
# Frame-accurate seek (-ss AFTER -i) guarantees the scan page is fully laid
# out — keyframe seek would land on an earlier spinner frame.
"${FFMPEG_BIN}" -y -i "${SRC_WEBM}" -ss "${POSTER_SS}" \
  -frames:v 1 -q:v 3 -update 1 \
  "${DEST_DIR}/${BASENAME}.jpg"

echo "▶ Building OpenGraph image (1200×630 letterboxed)…"
# Portrait 440×956 → scale to 630 height (preserves aspect, yields ~290×630),
# then pad onto 1200×630 canvas centred, matching the stub's dark navy bg so
# the letterbox blends into the scanner viewport aesthetic.
"${FFMPEG_BIN}" -y -i "${SRC_WEBM}" -ss "${POSTER_SS}" \
  -frames:v 1 -update 1 \
  -vf "scale=-2:630,pad=1200:630:(ow-iw)/2:0:color=0x0e1420" \
  -q:v 3 \
  "${DEST_DIR}/hero-og.jpg"

echo ""
echo "✔ Hero assets written to ${DEST_DIR}:"
ls -lh "${DEST_DIR}/${BASENAME}".{mp4,webm,jpg} "${DEST_DIR}/hero-og.jpg" 2>/dev/null \
  | awk '{printf "    %s  %s\n", $5, $NF}'
