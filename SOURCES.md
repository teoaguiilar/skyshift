# Sources

Every dataset, library, piece of code, image or text that is not our own. Add an entry the moment you use something.

| What | Used for | Link | License / credit |
|---|---|---|---|
| SPHEREx data (NASA), via NASA/IPAC Infrared Science Archive (IRSA) | Images of the test objects | https://irsa.ipac.caltech.edu/ | See acknowledgements below (SPHEREx-specific credit: to be checked) |
| Gaia DR3 (ESA) | Positions and proper motions of fast-moving stars | https://www.cosmos.esa.int/web/gaia/dr3 | See acknowledgements below |
| NASA Space Apps Challenge 2026: "Planet X and SPHEREx" | Challenge description and resources | https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/ | — |
| Aladin Lite v3 by CDS, Université de Strasbourg | Interactive sky map in the web app | https://aladin.cds.unistra.fr | LGPL-3.0-or-later. Aladin logo and link kept intact, as its terms ask |
| SPHEREx DR1 all-sky HiPS (NASA), served by NASA/IPAC IRSA | Infrared background map of the sky in the web app | https://irsa.ipac.caltech.edu/data/hips/SPHEREx/spherex_allsky_cube | See acknowledgements below |
| AllWISE colour HiPS (NASA WISE; NASA/JPL-Caltech/UCLA), ESA HiPS mirror | Fast base map for navigating the sky | https://skies.esac.esa.int/AllWISEColor | Data: NASA WISE/NEOWISE. Mirror: ESA ESDC |
| CDS Sesame name resolver | Turns object names into coordinates | https://cds.unistra.fr/cgi-bin/Sesame | Service of CDS, Université de Strasbourg |
| IRSA tutorial "SPHEREx cutouts" (Caltech/IPAC) | Basis of the data pipeline (query and cutouts) | https://caltech-ipac.github.io/irsa-tutorials/spherex-cutouts | BSD-3-Clause, Copyright (c) 2022-2026, California Institute of Technology |
| SPHEREx Explanatory Supplement (IRSA/Caltech-IPAC), Table 16 | Meaning of the FLAGS quality bits | https://irsa.ipac.caltech.edu/data/SPHEREx/docs/SPHEREx_Expsupp_QR.pdf | Public documentation |
| FITS WCS Paper III (Greisen et al. 2006, A&A 446, 747) | Reading SPHEREx wavelengths from the WCS-WAVE table | https://doi.org/10.1051/0004-6361:20053818 | Scientific paper, cited |
| SIMBAD (CDS), via Sesame | Positions and proper motions of the test objects | https://simbad.cds.unistra.fr | Wenger et al. 2000, A&AS 143, 9 |
| astropy, astroquery, reproject, numpy, matplotlib | Python libraries of the data pipeline | https://www.astropy.org | BSD-3-Clause (astropy, astroquery, reproject, numpy), matplotlib licence (PSF-based) |
| AAVSO International Variable Star Index (VSX) | Type, brightness range and period of RW Aur, R Dra and UX Ori | https://vsx.aavso.org | See acknowledgements below |
| Papers on RW Aur and UX Ori cited by Juan | Background of the variable stars | see science/variable-stars.md | Cited |
| Two Micron All Sky Survey (2MASS), via SIMBAD | J magnitudes of the variable stars | https://irsa.ipac.caltech.edu/Missions/2mass.html | See acknowledgements below |
| React and React DOM | Web app user interface | https://react.dev | MIT |
| Vite, @vitejs/plugin-react and oxlint | Build and lint tools of the web app | https://vite.dev | MIT |
| Vercel | Hosting of the web app and of the IRSA bridge function | https://vercel.com | Hosting service (free plan) |
| ESA Gaia DR3 — Gaia Collaboration (2022), Gaia DR3 v1.1, doi:10.5270/esa-qa4lep3 — via the ESA Gaia Archive TAP | Optional star layer on the map, positions moved to 2026.0 with their proper motion; distances of UX Ori and R Dra in the object cards (Gaia DR3 parallaxes, via SIMBAD) | https://gea.esac.esa.int/archive/ | Open and free to use with credit to "ESA/Gaia/DPAC" (https://www.cosmos.esa.int/web/gaia-users/license) |
| "SPHEREx: NASA's Near-Infrared Spectrophotometric All-Sky Survey" (arXiv:2404.11017), Table 2 | SPHEREx detector wavelength ranges (D1–D6) shown in the web | https://arxiv.org/abs/2404.11017 | arXiv paper (cited, values only) |
| ESA (1997), The Hipparcos and Tycho Catalogues, Vol. 1, Sect. 1.5.3 | ICRS to Galactic rotation matrix (galactic coordinates in the web) | https://www.cosmos.esa.int/web/hipparcos/catalogues | Cited (standard constants) |
| Michroma font, by Vernon Adams | Brand typography | https://fonts.google.com/specimen/Michroma | SIL Open Font License 1.1, served from Google Fonts |
| Archivo font, by Omnibus-Type | Brand typography | https://fonts.google.com/specimen/Archivo | SIL Open Font License 1.1, served from Google Fonts |

## Acknowledgements

This research has made use of the NASA/IPAC Infrared Science Archive, which is funded by the National Aeronautics and Space Administration and operated by the California Institute of Technology.

This work has made use of data from the European Space Agency (ESA) mission Gaia (https://www.cosmos.esa.int/gaia), processed by the Gaia Data Processing and Analysis Consortium (DPAC, https://www.cosmos.esa.int/web/gaia/dpac/consortium). Funding for the DPAC has been provided by national institutions, in particular the institutions participating in the Gaia Multilateral Agreement.

This research has made use of the International Variable Star Index (VSX) database, operated at AAVSO, Cambridge, Massachusetts, USA.

This publication makes use of data products from the Two Micron All Sky Survey, which is a joint project of the University of Massachusetts and the Infrared Processing and Analysis Center/California Institute of Technology, funded by the National Aeronautics and Space Administration and the National Science Foundation.
