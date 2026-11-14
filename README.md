# skyshift
See the sky move: SPHEREx time-lapse viewer (NASA Space Apps 2026)

## WiseView vs SkyShift

| | WiseView (our inspiration; Caselden et al. 2018) | SkyShift |
|---|---|---|
| Data | NASA WISE/NEOWISE time-resolved unWISE coadds, 2 infrared bands (3.4 and 4.6 µm) | NASA SPHEREx, 102 infrared bands from 0.75 to 5 µm |
| Time baseline | Many years of WISE and NEOWISE sky passes | About one year so far (SPHEREx began its survey in 2025): slow movers shift only a pixel or two |
| How you get there | Type coordinates (also in the URL) | Type coordinates or a name, click anywhere on a sky map, or follow a guided tour |
| Animation | Blinks images from different epochs; tunable stretch, frame rate and field of view | Time-lapse of every SPHEREx visit, with play, pause and a date slider |
| Wavelength | Choose W1, W2 or both | Compares only images of similar wavelength (±2%), read pixel by pixel from the WCS-WAVE layer |
| Faint objects | Each ~6-month sky pass is already stacked (coadds) | Same idea applied to SPHEREx: stacks all images of each visit (reveals WISE 0855, S/N ~18) |
| Difference image | Not listed in its description | Last visit minus first: still sources cancel out, movers leave a before/after pair |
| Measurements | Visual inspection | Position and brightness per image and per visit, with error bars, compared with the catalogue proper motion |
| Spectrum | No | Infrared spectrum of the test objects from all six SPHEREx detectors |
| Quality | Not listed in its description | SPHEREx quality flags shown for every image |
| Limits shown | Not listed in its description | Says when a star saturates the detector; results presented as candidates |
