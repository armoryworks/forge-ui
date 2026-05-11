# App sample-screenshot batch — run summary

Generated 2026-05-08T06:12:23.790Z

## Captured (PNG; convert to WebP at ~80% quality before shipping)

- a-l2c/f1-capture.png
- a-l2c/f2-communicate.png
- a-l2c/f3-convert.png
- a-l2c/f4-commit.png
- a-l2c/f5-make-it.png
- a-l2c/f6-close-it.png
- b-config/f1-interview.png
- b-config/f2-refine.png
- b-config/f3-recommend.png
- b-config/f4-apply.png
- b-config/closer-default-on.png
- b-config/closer-your-install.png
- c-floor-kiosk/f1-signin.png
- c-floor-kiosk/f2-queue.png
- c-floor-kiosk/f3-detail.png
- c-floor-kiosk/f4-advance.png
- c-floor-closer/office.png
- c-floor-closer/floor.png
- c-floor-mobile/f1-signin.png
- c-floor-mobile/f2-queue.png
- c-floor-mobile/f3-scan.png
- c-floor-mobile/f4-advance.png

## Skipped / needs manual re-shoot

(none)

## Known caveats (not blockers — these still capture, with notes)

- **Mobile camera viewfinder** (`c-floor-mobile/f3-scan.png`):
  Chromium's `--use-fake-device-for-media-stream` launch arg is set
  + the context grants the camera permission, but `html5-qrcode`
  requests `facingMode: "environment"` which the synthetic device
  does not satisfy — viewfinder still shows "Camera Unavailable".
  The frame captures the rest of the scan UI honestly (manual entry,
  bottom nav, header). For a fully-realized "camera as scanner"
  marketing frame, screenshot on a real phone.

- **Operator setup pre-flight**: the spec sets the operator
  (`akim@qbengineer.local`) up with PIN `1234` and barcode
  `MKT-AKIM-1` so both kiosk auth paths (badge+PIN and tap+password)
  work end-to-end. Helpers are idempotent — re-runs are safe.

## Drop-in convention

Convert PNGs to WebP and replace `.png` with `.webp` in the filenames before
updating `armory-works-ui/src/app/pages/{home,work}/*.html` placeholders.

On Windows: `magick mogrify -format webp -quality 80 *.png` in each story
subfolder, or use `cwebp -q 80 input.png -o input.webp` per file.

PowerShell one-liner for all five subfolders:

```powershell
cd e:\dev\armory-works\armory-works-ui\public\stories
foreach ($d in 'a-l2c','b-config','c-floor-kiosk','c-floor-mobile','c-floor-closer') {
  cd $d; magick mogrify -format webp -quality 80 *.png; del *.png; cd ..
}
```
