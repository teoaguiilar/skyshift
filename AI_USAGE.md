# Use of AI (Super Intelligence)

Every AI tool we use, what for and in which parts. Images and videos generated with AI carry a visible watermark saying so. AI-generated code is marked in the file header. The team decided what to build and how to present it.

| Date | Tool | Who | What for | Parts affected |
|---|---|---|---|---|
| Before 2026-11-14 | Claude (Anthropic) | Whole team | Learning the IRSA/SPHEREx tutorials and organising the team plan | No project code or content |
| 2026-11-14 | Claude (Anthropic) | Antonio | Drafting the templates of SOURCES.md and AI_USAGE.md and keeping them up to date in the repository | Documentation |
| 2026-11-14 | — | Benjamín and Juan | Team idea (not AI): free navigation of the sky map so non-experts can explore anywhere, with the five test objects as guided tours | Product design |
| 2026-11-14 | Claude (Anthropic) | Pedro | Writing the web sky map code: Aladin Lite map with the SPHEREx all-sky HiPS as background, name/coordinate search, guided-tour buttons, click-to-select, coordinates in the URL and a smooth fly-to animation. Ideas from the team: free navigation and guided tour (Benjamín and Juan), Stellarium-like smooth motion (Benjamín). Reviewed and tested by Pedro | web/src/App.jsx, App.css, index.css |
| 2026-11-14 | Claude (Anthropic) | Teo | Writing the data pipeline script (IRSA query, parallel downloads, wavelength selection, zodiacal light subtraction, alignment, PNG frames, manifest.json, position and brightness measurement) | pipeline/fetch_object.py, data/ |
| 2026-11-14 | Claude (Anthropic) | Teo | Decoding the SPHEREx FLAGS bits from the Explanatory Supplement and writing the quality check | pipeline/fetch_object.py (quality_ok, flags) |
| 2026-11-14 | Claude (Anthropic) | Teo | Writing the IRSA bridge (search and IMAGE-only cutouts with wavelength), tested by the team against a real SPHEREx cutout | web/api/irsa.js |
| 2026-11-14 | Claude (Anthropic) | Teo | Organising the challenge requirements, the Navigator's advice and our data results into a checklist for the team brainstorm. Ideas and decisions were made by the team | No code |
| 2026-11-14 | Claude (Anthropic) | Teo | Writing the data pipeline documentation | pipeline/README.md |
| 2026-11-14 | Claude (Anthropic) | Teo | Writing the CSV export of the measurements for the science team | pipeline/manifest_to_csv.py, science/csv/ |
| 2026-11-14 | Claude (Anthropic) | Teo | Translating Juan's variable star research into English for the web (checked by Juan) | science/variable-stars.md |
| 2026-11-14 | Claude (Anthropic) | Pedro | Web: time-lapse for any clicked spot. Downloads cutouts through Teo's bridge, keeps similar wavelengths (±2 %), aligns them with each image's WCS (TAN-SIP) in the browser | web/src/spherexSpot.js, SpotLapse.jsx |
