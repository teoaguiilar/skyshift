# Object cards

One file per guided-tour object, shown on the web under "About this object".
The web reads these files directly from GitHub, so a new or corrected card appears without redeploying.

File names (must match exactly):

| Object | File |
|---|---|
| Barnard's Star | `barnard.json` |
| Epsilon Indi B | `eps-indi-b.json` |
| WISE 0855−0714 | `wise-0855.json` |
| RW Aurigae | `rw-aurigae.json` |
| R Draconis | `r-draconis.json` |
| UX Orionis | `ux-orionis.json` |

How to write one:

1. Copy `_template.json` and rename it (table above).
2. Replace every `WRITE` with real content, in English.
3. **Every number needs a source** (`source` and `source_url`): Gaia DR3, SIMBAD, a paper, AAVSO VSX…
   Do not write a number you cannot cite. If a fact is unknown, delete that block.
4. Easy comparisons: stars in "x the Sun", brown dwarfs in "x Jupiter", distance in light-years.
5. `papers`: only real papers with a working link (ADS is best).
6. Remove any field you do not use. Leave no `WRITE` in the file.

Written by the SkyShift Murcia science team (Benjamín, Juan). Format prepared with help from Claude (Anthropic); see AI_USAGE.md.
