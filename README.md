# SkyShift

**See the sky move.** SkyShift is a free website where anyone can see what moves or changes brightness in the sky, using NASA SPHEREx infrared images of the same spot taken months apart.

**Try it:** https://skyshift-roan.vercel.app · **Demo video (30 s):** https://youtu.be/pNHKTIQ7-fM
NASA Space Apps Challenge 2026 · Challenge: *Planet X and SPHEREx* · Team **SkyShift Murcia** (Murcia, Spain)

### Try it in two minutes

- WISE 0855, the coldest known brown dwarf: invisible in single SPHEREx images, it appears when each visit is stacked. https://skyshift-roan.vercel.app/?object=wise-0855-stacked
- Barnard's Star, the fastest-moving star in our sky: press "Watch it move", then compare its motion with Gaia DR3. https://skyshift-roan.vercel.app/?object=barnard
- Epsilon Indi B in Science mode: the Difference view leaves only the mover, and the Bands tab shows the same motion in four detectors. https://skyshift-roan.vercel.app/?mode=science&object=eps-indi-b
- UX Orionis: a young star whose brightness changes between visits. https://skyshift-roan.vercel.app/?object=ux-orionis

If NASA's IRSA archive is down (it was for most of the hackathon weekend), the guided tour still works, because its data are stored in our repository.

## What it is

NASA's SPHEREx telescope photographs the whole sky in 102 infrared colours, coming back to every spot about every six months. Its archive is built for experts. SkyShift opens it to anyone: move around the sky, search a name or click any point, and SkyShift fetches every SPHEREx image of that spot, keeps the ones taken at the same wavelength, aligns them and plays them in order. Things that move, jump out. Things that change brightness, flicker.

In short, the challenge asks for a public tool where you enter a position (RA and Dec) and see the SPHEREx images as a video, to spot what moves, tested on Barnard's Star, Epsilon Indi B, WISE 0855, RW Aurigae and R Draconis. SkyShift does exactly that, and more.

Everything SkyShift flags is a **candidate**, never a discovery: SPHEREx pixels are about 6 arcseconds wide and we have about a year and a half of data so far (May 2025 to October 2026).

## Why it matters for science

- *A new use for SPHEREx data.* SPHEREx was built to map the infrared spectrum of the whole sky, not to hunt moving objects. SkyShift shows that its repeated visits can also measure motion: for Barnard's Star we get 11.5 ± 1.1″/yr, against 10.4″/yr from ESA's Gaia DR3, within the precision that 6″ pixels allow.
- *Built-in checks against false alarms.* A real mover shifts the same way in every SPHEREx detector (Bands tab), leaves a before/after pair in the Difference view and does not sit on flagged pixels. Every candidate comes with that evidence attached.
- *Faint, cold objects.* Stacking each visit reveals objects too faint for a single image, such as the brown dwarf WISE 0855 (signal-to-noise 17.7). Its spectrum rises between 4 and 5 µm, the signature of a very cold object: the kind of nearby, cold neighbour of the Sun that infrared surveys are best at finding.
- *Better with every release.* The pipeline is open (MIT) and reruns with one command, and the web asks IRSA live, so each new SPHEREx visit lengthens the time baseline and makes the motion measurements more precise.

## Open to everyone, checked by people who know

Think of SkyShift as a Wikipedia of moving stars, but stricter. Anyone can explore every object and propose a candidate, but nobody can write directly onto the map. A proposal must include its coordinates, dates, wavelength and a source for every number. The team reviews it in public on GitHub, and only approved proposals appear on the map, always labelled as candidates, never as discoveries.

## What you can do

- **Explore freely.** A sky map you can drag and zoom (Aladin Lite), with search by name or coordinates. The view is saved in the URL.
- **Click anywhere.** SkyShift asks NASA's archive (IRSA) for every SPHEREx image of that spot, keeps images of similar wavelength (±2 %), aligns them and plays the time-lapse. You choose the detector (D1 to D6) and the size (2′, 4′ or 8′).
- **Spectrum on the fly.** For any point you click, SkyShift measures its brightness in every SPHEREx image and draws its infrared spectrum.
- **Guided tour.** The six test objects (Barnard's Star, Epsilon Indi B, WISE 0855, RW Aurigae, R Draconis and UX Orionis), each with a fact card written and checked by the team, with its sources.
- **Difference view.** Last visit minus first: everything that stays still cancels out, and a moving object leaves a before/after pair.
- **Bands.** In Science mode, each SPHEREx detector (D1 to D6) on its own or added together, with the motion measured in each one.
- **Stacking.** Adds up all images of each visit, so faint objects appear. WISE 0855, the coldest known brown dwarf, is invisible in single images and shows up at S/N 17.7 when stacked.
- **Measurements.** Position and brightness against time, per image and per visit with error bars, compared with the catalogue motion.
- **False colour, Gaia and sky date.** Three infrared bands as red, green and blue; an ESA Gaia DR3 layer with colours and a card for each star; and a sky date control that moves stars to any SPHEREx date.
- **Honest by design.** SPHEREx quality flags are shown for every image, and SkyShift says when a star is too bright and saturates the detector.
- **Two modes.** *Explore* for everyone, *Science* for people who want spectra, flags and charts. English and Spanish.

## ⭐ Report a candidate: the sky needs more eyes

Projects like Backyard Worlds have shown that curious people find real brown dwarfs. SkyShift brings that to SPHEREx: if you see something move or flicker, **Report a candidate** turns it into a proposal in the same format as our fact cards (coordinates, dates, wavelength and evidence), checks it for sources and personal data, and sends it as a GitHub Issue. The team reviews it in public, and approved candidates appear on the map.

**Discuss it together:** every object and candidate has a **Discuss** button that opens a GitHub Discussions thread, where amateurs and scientists can talk it through.

## How SkyShift answers the challenge

| The challenge asks for | How SkyShift does it |
|---|---|
| A tool to find moving and changing objects in SPHEREx data | Time-lapse of every SPHEREx visit for any point of the sky, with difference and stacking views |
| Test it on Barnard's Star, Epsilon Indi B, WISE 0855, RW Aurigae and R Draconis | All five are in the guided tour, plus UX Orionis as an extra variable star. R Draconis saturates the detector, and SkyShift says so |
| Easy to update with new data | The web asks IRSA live on every search, so new SPHEREx releases appear by themselves; the `pipeline/` scripts rerun with one command |
| Show the 102 bands in a creative way; **extra kudos: spectra on the fly** | **Spectrum on the fly for any clicked point**, spectra of the test objects from all six detectors, false colour from three bands, wavelength read pixel by pixel from the `WCS-WAVE` layer, Bands tab with each detector D1 to D6 alone or added |
| Add or subtract images from different dates | Stacking per visit (reveals WISE 0855) and last-minus-first difference |
| Choose the field of view | 2′, 4′ or 8′ for any point, plus the map zoom |
| Overlay Gaia or WISE | ESA Gaia DR3 layer and AllWISE background |
| Coordinates in the URL | `?ra=&dec=&fov=`, `?object=`, plus detector and size |
| Use metadata such as contamination flags | SPHEREx `FLAGS` decoded for every image |
| Use public tools (Astropy, Aladin) | Astropy, astroquery, reproject and Aladin Lite |
| Involve the public in discovery | **Report a candidate**, reviewed in public on GitHub, and a **Discuss** thread for every object and candidate |

## What we measured with SkyShift

| Object | Measured from SPHEREx images | Catalogue value |
|---|---|---|
| Barnard's Star, proper motion (8 images, Aug 2025 to Sep 2026) | −0.56 ± 0.59 ″/yr (RA·cos Dec), +11.51 ± 1.08 ″/yr (Dec) | −0.80, +10.36 ″/yr |
| Epsilon Indi B, proper motion (14 images, Apr 2025 to Oct 2026) | +2.87 ± 0.45 ″/yr (RA·cos Dec), −2.71 ± 0.45 ″/yr (Dec) | +3.98, −2.47 ″/yr |
| WISE 0855, proper motion (3 stacked visits, detector D6) | −10.9 ± 2.0 ″/yr (RA·cos Dec), +1.6 ± 1.1 ″/yr (Dec) | −8.12, +0.67 ″/yr |
| WISE 0855, detection | Invisible in single images; signal-to-noise 17.7 when each visit is stacked | |
| WISE 0855, brightness at 4.0–5.0 µm (67 images, detectors D5 and D6) | 535 ± 27 µJy, about 14 % above the clean NEOWISE value because of a background star next to it | W2 = 13.91 → about 469 µJy (Wright & Foley 2025) |
| WISE 0855, spectrum filtered to 3.8–5 µm | About 270 µJy at 3.8–4.05 µm rising to about 640 µJy at 4.15–4.65 µm: the 4–5 µm bump of a very cold brown dwarf, partly contaminated by a background star next to it | |
| UX Orionis, brightness per visit | Relative flux about 320 ± 12, then about 500, then 365 ± 32 over three visits | Irregular variable (UXor type) |

How to read it: Barnard's Star and WISE 0855 agree with the catalogue within about 1 to 1.5 standard errors. Epsilon Indi B moves the same way in four detectors. Its Dec motion agrees, but the RA motion is about 2.5 standard errors lower. Possible causes are the short baseline (about a year and a half), the large pixels (6.15″) and the two brown dwarfs being blended into one point. We report it instead of hiding it. For WISE 0855 the fit uses only three visits and does not remove its yearly parallax wobble (0.44″). For its brightness we compare with the clean NEOWISE W2 of Wright & Foley 2025 (arXiv:2505.12105), not the AllWISE value (14.016), because that paper shows the 2010 observations are contaminated by a background source. Catalogue values: SIMBAD (CDS).

## NASA data and how SkyShift uses it

*NASA SPHEREx (the core of SkyShift).* Calibrated SPHEREx spectral images (level 2) from the NASA/IPAC Infrared Science Archive (IRSA), Data Release 1, from May 2025 to October 2026.

- *Finding the images:* IRSA's TAP service (tables spherex.artifact and spherex.plane) tells us which images cover a point and with which detector array (D1 to D6, from 0.75 to 5 µm).
- *Downloading only what we need:* IRSA's cutout service returns a small piece of each image around the point, with all its layers: IMAGE, FLAGS (quality), VARIANCE, ZODI (zodiacal light) and WCS-WAVE.
- *Wavelength:* each part of a SPHEREx detector sees a different wavelength, so we read it pixel by pixel from the WCS-WAVE lookup table (FITS WCS Paper III). The time-lapse only compares images taken at the same wavelength (±2 %).
- *Cleaning and aligning:* we subtract the ZODI layer, put every image on one north-up grid with reproject, and decode the FLAGS bits (SPHEREx Explanatory Supplement) so images with bad pixels on the target are marked.
- *Visits and stacking:* SPHEREx returns to each spot about every six months. Images less than 30 days apart form one visit; their median beats down the noise and reveals faint objects such as WISE 0855.
- *Measurements:* position from the centre of light; brightness by aperture photometry (2-pixel radius, background from a 4 to 7-pixel ring), converted to microjanskys with the pixel solid angle (6.15″ pixels). Each image gives one point of the spectrum at its own wavelength.
- *All-sky map:* the SPHEREx all-sky HiPS map (IRSA) is the background when you zoom in.

*NASA WISE (AllWISE).* Colour sky map as the background for moving around the sky.

*Space agency partner data: ESA Gaia DR3.* Positions, proper motions, parallaxes and colours of stars, shown as an optional layer and used to check our measurements.

*Other references.* SIMBAD and Sesame (CDS) for object names and catalogue motions; 2MASS and AAVSO VSX for the variable stars; the published papers cited in each fact card.

Full list with links and licences: [SOURCES.md](SOURCES.md).

## How it works

- **`pipeline/`** (Python): finds the target and its catalogue motion, asks IRSA for every SPHEREx image, keeps one wavelength, subtracts the zodiacal light, aligns everything north-up on one grid, measures position and brightness, decodes the quality flags, and writes aligned PNG frames plus a `manifest.json`. It also stacks visits, measures spectra and makes the difference images. Details: [pipeline/README.md](pipeline/README.md).
- **`web/`** (React and Vite, deployed on Vercel): the sky map, time-lapse player, charts, fact cards and Report a candidate. Small serverless functions in `web/api/` talk to IRSA and Gaia, because IRSA does not allow requests straight from the browser.
- **`data/`**: ready-made results for the guided tour. **`science/`**: fact cards, CSV tables and notes from the team's scientists.

Run it yourself:

```bash
# data for one object
pip install astropy astroquery reproject numpy matplotlib
python pipeline/fetch_object.py --name "Barnard's Star" --slug barnard --band D2

# web app
cd web
npm install
npm run dev
```

## Known limits

- SPHEREx pixels are about 6″ wide and we have about a year and a half of visits, so slow objects move only a pixel or two. Results are candidates.
- Epsilon Indi B is a pair of brown dwarfs; SPHEREx sees them as a single blended point.
- Very bright stars saturate the detector: no brightness is measured for them (Barnard's Star, R Draconis).
- "Click anywhere" and the spectrum on the fly depend on IRSA being online; the guided tour works without it. Within 1′ of a guided-tour object, the spectrum shown is precomputed from the same SPHEREx images, and the web says so.
- If NASA's IRSA archive is down, clicking a new point of the sky cannot load images; the guided tour and the precomputed spectra keep working because their data are stored in this repository.

## Team SkyShift Murcia

Teo (data and pipeline) · Pedro (web) · Antonio (presentation and submission) · Benjamín (science of motion) · Juan (science of brightness and quality checks)

## Use of AI

We used AI assistants (Claude by Anthropic) to help write code, organise the work and translate texts. The demo video uses an AI-generated voiceover (ElevenLabs) from the team's script and five AI-generated cartoon presenters (Higgsfield, GPT Image), labelled "AI-generated characters" on screen. The idea, the decisions and every scientific statement are the team's, and the team reviewed everything. Drawings inside the web app ("Up close") are drawn in code and labelled as such. Details, file by file: [AI_USAGE.md](AI_USAGE.md).

## Licence

MIT, see [LICENSE](LICENSE). Data and third-party code keep their own licences, listed in [SOURCES.md](SOURCES.md).

## SkyShift and WiseView

SkyShift was inspired by WiseView, the tool that Backyard Worlds volunteers use to blink WISE images.

| | WiseView (our inspiration; Caselden et al. 2018) | SkyShift |
|---|---|---|
| Data | NASA WISE/NEOWISE time-resolved unWISE coadds, 2 infrared bands (3.4 and 4.6 µm) | NASA SPHEREx, 102 infrared bands from 0.75 to 5 µm |
| Time baseline | Many years of WISE and NEOWISE sky passes | About a year and a half so far (SPHEREx began its survey in 2025): slow movers shift only a pixel or two |
| How you get there | Type coordinates (also in the URL) | Type coordinates or a name, click anywhere on a sky map, or follow a guided tour |
| Animation | Blinks images from different epochs; tunable stretch, frame rate and field of view | Time-lapse of every SPHEREx visit, with play, pause and a date slider |
| Wavelength | Choose W1, W2 or both | Compares only images of similar wavelength (±2%), read pixel by pixel from the WCS-WAVE layer |
| Faint objects | Each ~6-month sky pass is already stacked (coadds) | Same idea applied to SPHEREx: stacks all images of each visit (reveals WISE 0855, S/N 17.7) |
| Difference image | Not listed in its description | Last visit minus first: still sources cancel out, movers leave a before/after pair |
| Measurements | Visual inspection | Position and brightness per image and per visit, with error bars, compared with the catalogue proper motion |
| Spectrum | No | Infrared spectrum of the test objects from all six SPHEREx detectors |
| Quality | Not listed in its description | SPHEREx quality flags shown for every image |
| Limits shown | Not listed in its description | Says when a star saturates the detector; results presented as candidates |
