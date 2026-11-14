# SkyShift data pipeline

`fetch_object.py` turns NASA SPHEREx images of one patch of sky into a short "flip book" that the web app can play: aligned PNG frames sorted by date, plus a `manifest.json` with dates, wavelengths, quality flags and measured positions.

All data comes from the NASA/IPAC Infrared Science Archive (IRSA). The script asks IRSA every time it runs, so new SPHEREx data releases are picked up automatically.

## What it does

1. **Find the target.** Looks up the position and proper motion (SIMBAD, through the CDS Sesame resolver) and works out where the object should be on each date.
2. **Ask IRSA.** Lists every SPHEREx image of one detector array (D1 to D6) that covers the target.
3. **Download cutouts.** IRSA cuts a small square around the target; downloads run in parallel with retries.
4. **Pick one wavelength.** SPHEREx sees a different wavelength in each part of its detector, so the script reads the wavelength at the target from the `WCS-WAVE` layer and keeps only images within ±2 % of a common wavelength. Comparing like with like avoids false changes.
5. **Clean and align.** Subtracts the zodiacal light (`ZODI` layer) and reprojects every image onto the same sky grid (north up, east left), so only real changes move.
6. **Measure.** Finds the centre of light of the target in each frame (position) and sums its light (relative brightness). For saturated stars it uses the ring around the empty core and reports no brightness.
7. **Check quality.** Decodes the SPHEREx `FLAGS` bits around the target (SPHEREx Explanatory Supplement, Table 16). A frame is marked bad only for flags the Supplement describes as unusable for science.
8. **Write the output.** `data/<slug>/frame_NNN.png` (each sky pixel enlarged 10×) and `data/<slug>/manifest.json`.

## Faint objects: stacking each visit

SPHEREx passes over each patch of sky in visits about six months apart and takes several images in each visit. `stack_epochs.py` adds together (median) all images of one visit in one detector array, as the challenge suggests, so faint objects stand out from the noise. It reports the signal-to-noise ratio (S/N) of the target in each visit and marks it as detected at S/N 5 or more.

```bash
python pipeline/stack_epochs.py --name "WISE J085510.83-071442.5" --slug wise-0855-stacked --band D6
```

WISE 0855, the coldest known brown dwarf, cannot be seen in single SPHEREx images. Stacking the 21 images of each visit in detector D6 (4.4 to 5.0 microns) shows it clearly (S/N about 18 in November 2025 and April 2026), at the position predicted by the catalogue. This is a *candidate detection*.

## How to run it

```bash
python pipeline/fetch_object.py --name "Barnard's Star" --slug barnard --band D2
```

| Option | Meaning |
|---|---|
| `--name` | Object name (any name SIMBAD knows) |
| `--slug` | Folder name inside `data/` |
| `--band` | SPHEREx detector array, `D1` to `D6` |
| `--wl` | Wavelength in microns to keep (default: the one with most images) |
| `--tol` | Wavelength tolerance (default `0.02`, that is ±2 %) |
| `--size` | Cutout size in degrees (default `0.06`) |
| `--ra --dec --pmra --pmdec --plx --source` | Give the position and motion by hand instead of looking them up |

Needs Python 3 with `numpy`, `astropy`, `astroquery`, `reproject` and `matplotlib`.

## Objects in `data/`

| Folder | Object | Detector | Why it is there |
|---|---|---|---|
| `barnard` | Barnard's Star | D2 | Challenge test object: fastest-moving star |
| `eps-indi-b` | Epsilon Indi B | D2 | Challenge test object: nearby brown dwarf pair |
| `wise-0855` | WISE 0855−0714 | D6 | Challenge test object: coldest known brown dwarf (single images, too faint) |
| `wise-0855-stacked` | WISE 0855−0714 | D6 | Same object, one stacked frame per visit: visible |
| `rw-aurigae` | RW Aurigae | D2 | Challenge test object: variable star |
| `r-draconis` | R Draconis | D2 | Challenge test object: variable star |
| `ux-orionis` | UX Orionis | D2 | Extra variable star chosen by the team |

## Known limits

- SPHEREx pixels are about 6 arcseconds wide, so in about a year even Barnard's Star moves only about two pixels. Results are shown as *candidates*, not discoveries.
- Barnard's Star and R Draconis saturate the detector: their positions are measured from the ring around the core, and no brightness is given.
- WISE 0855 is too faint to see in single SPHEREx images; it shows up only when each visit is stacked, and the first visit (3 images) is not enough.
- The parallax wobble of nearby stars is not yet included in the predicted positions.

## Credits

Based on the IRSA tutorial "SPHEREx cutouts" (Caltech/IPAC). Written with help from Claude (Anthropic) and reviewed by the SkyShift Murcia team; see `AI_USAGE.md`. All sources are listed in `SOURCES.md`.

This research has made use of the NASA/IPAC Infrared Science Archive, which is funded by the National Aeronautics and Space Administration and operated by the California Institute of Technology.
