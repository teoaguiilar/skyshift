# Variable stars: what they are and what SPHEREx shows

Research by Juan Torres (SkyShift Murcia), 14 November 2026. English translation of his notes, for the object panels of the web app. The "What SPHEREx shows" lines are the team's own measurements from `data/` and `science/csv/`.

Magnitudes are in the visible V band. Bigger magnitude means fainter. SPHEREx sees infrared light (around 1.2 to 1.5 microns for these stars), where the changes are usually smaller than in visible light, so the two ranges cannot be compared directly.

## RW Aurigae (RW Aur)

- **Type:** classical T Tauri star, a young star.
- **Brightness range (V):** 9.2 (brightest) to 13.6 (faintest), a difference of 4.4 magnitudes.
- **Period:** 2.64 days.
- **Periodic or irregular?** Both. It varies periodically with its rotation (2.64 days), and it also has irregular dimming episodes, such as the one in 2010–2011 that lasted about 180 days. These episodes follow no known period.
- **Why does its brightness change?** As the star rotates, spots on its surface come in and out of view. On top of that, dust in the disc around the star sometimes blocks its visible light as seen from Earth.
- **What we expect from SPHEREx:** changes in brightness caused by the dust disc or by the rotation. SPHEREx observes the same patch of sky every few months, so it cannot follow the 2.64-day rotation cycle or tell, on its own, which cause is behind each change.
- **What SPHEREx shows:** 7 images at 1.44 microns, September 2025 to September 2026. Relative brightness rises from about 260 to about 460. *Candidate* variability. The star is close to the detector's limit (OVERFLOW and BLOOM quality flags), so the highest values may be a little low.

## R Draconis (R Dra)

- **Type:** Mira variable, a pulsating red giant.
- **Brightness range (V):** 6.7 (brightest) to 13.2 (faintest), a difference of 6.5 magnitudes.
- **Period:** 246.12 days.
- **Periodic or irregular?** Periodic.
- **Why does its brightness change?** The giant star pulsates: it swells and shrinks.
- **What SPHEREx shows:** the star is so bright in the infrared that it saturates the SPHEREx detector in all 10 images, so its brightness cannot be measured with this method. Its image is shown, but not a brightness curve.

## UX Orionis (UX Ori)

*Extra object chosen by the team, not one of the five challenge test objects.*

- **Type:** UXor, a young star with a dusty disc.
- **Brightness range (V):** 9.4 (brightest) to 12.7 (faintest), a difference of 3.3 magnitudes.
- **Period:** none known.
- **Periodic or irregular?** Irregular.
- **Why does its brightness change?** The star is surrounded by a disc of gas and dust whose structure changes, which can block its visible light for a while.
- **What we expect from SPHEREx:** irregular changes in brightness.
- **What SPHEREx shows:** 9 images at 1.20 microns, August 2025 to September 2026, none saturated. Relative brightness goes from about 290 (September 2025) to about 500 (February and March 2026) and back down in September 2026. Two images taken on the same day differ by about 15 %, so only larger changes count. *Candidate* variability.

## Sources

- AAVSO International Variable Star Index (VSX), RW Aur: https://vsx.aavso.org/index.php?view=detail.top&oid=3777
- RW Aur dimming episode: https://iopscience.iop.org/article/10.1088/0004-6256/146/5/112/pdf
- AAVSO VSX, R Dra: https://vsx.aavso.org/index.php?view=detail.top&oid=13673
- AAVSO, Mira variables and period changes: https://archive.aavso.org/mira-variables-period-changes
- AAVSO VSX, UX Ori: https://vsx.aavso.org/index.php?view=detail.top&oid=23100
- UX Ori: https://iopscience.iop.org/article/10.1086/378400/pdf

Translation from Spanish written with help from Claude (Anthropic) and checked by Juan. See `AI_USAGE.md`.
