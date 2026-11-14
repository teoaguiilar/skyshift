"""
SkyShift: "Filtering" - keep only the long-wavelength part of a SPHEREx spectrum.

Why (idea of Benjamín, SkyShift Murcia team): WISE 0855-0714 is a very cold
brown dwarf, so it gives off almost all its light at long infrared wavelengths
(around 4-5 microns) and almost nothing at short ones. In SPHEREx images a hot
background star sits right next to it, inside the same measuring circle. That
star is bright at short wavelengths and fades towards long ones. So at short
wavelengths the measured light is mostly the background star (contamination),
while at long wavelengths the brown dwarf dominates. Filtering keeps only the
wavelengths where the object we want is the one we measure.

This script does not download anything: it reads the spectrum already measured
by spectrum.py (data/<slug>/spectrum.json), keeps the single measurements inside
the chosen wavelength range, bins them again and writes:

  data/<slug>/spectrum_filtered.json   measurements kept + binned spectrum + why
  data/<slug>/spectrum_filtered.png    quick-look plot
  science/csv/<slug>-spectrum-filtered.csv

Usage (from the repository root):
    python pipeline/filter_spectrum.py --slug wise-0855 --min-wl 3.8

Written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team.
See AI_USAGE.md. Data: NASA SPHEREx via NASA/IPAC IRSA. License: MIT.
"""
import argparse
import csv
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

from spectrum import binned  # noqa: E402  (same folder)


def median_flux(spec, lo, hi):
    vals = [b["flux_ujy"] for b in spec if lo <= b["wavelength_um"] < hi]
    return round(float(np.median(vals)), 1) if vals else None


def plot(result, path):
    points, spec = result["points"], result["binned"]
    fig, ax = plt.subplots(figsize=(8, 4.5), dpi=120)
    ax.errorbar([p["wavelength_um"] for p in points], [p["flux_ujy"] for p in points],
                yerr=[p["flux_err_ujy"] for p in points], fmt=".", color="0.75", ms=3, lw=0.5,
                label="single SPHEREx images")
    ax.plot([b["wavelength_um"] for b in spec], [b["flux_ujy"] for b in spec], "o-", color="C3", ms=4,
            label="binned (median)")
    vals = np.array([b["flux_ujy"] for b in spec])
    lo, hi = np.percentile(vals, [2, 98])
    pad = 0.25 * (hi - lo if hi > lo else abs(hi) + 1)
    ax.set_ylim(min(0, lo - pad), hi + pad)
    lo_wl, hi_wl = result["filter"]["range_um"]
    ax.set_xlim(lo_wl - 0.05, hi_wl + 0.05)
    ax.set_xlabel("Wavelength (microns)")
    ax.set_ylabel("Flux density (microjansky, approx.)")
    ax.set_title(f"{result['name']}: SPHEREx spectrum, filtered to {lo_wl}-{hi_wl} microns (SkyShift)", fontsize=10)
    ax.legend(frameon=False)
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def main():
    parser = argparse.ArgumentParser(description="SkyShift: keep only the long-wavelength part of a spectrum")
    parser.add_argument("--slug", required=True, help="Folder in data/ with spectrum.json")
    parser.add_argument("--min-wl", type=float, default=3.8, help="Shortest wavelength kept, microns (default 3.8)")
    parser.add_argument("--max-wl", type=float, default=5.1, help="Longest wavelength kept, microns (default 5.1)")
    args = parser.parse_args()

    folder = Path("data") / args.slug
    full = json.loads((folder / "spectrum.json").read_text())
    kept = [p for p in full["points"] if args.min_wl <= p["wavelength_um"] <= args.max_wl]
    if not kept:
        raise SystemExit("No measurements in that wavelength range.")
    spec = binned(kept)
    bands = sorted({p["band"] for p in kept})

    result = {
        "object": full["object"],
        "name": full["name"],
        "filter": {
            "range_um": [args.min_wl, min(args.max_wl, 5.0)],
            "detectors": bands,
            "kept_images": len(kept),
            "left_out_images": len(full["points"]) - len(kept),
            "why": "Filtering (idea of Benjamín): only the long infrared wavelengths are kept. A hot background star "
                   "sits next to this object inside the measuring circle; it dominates at short wavelengths, while "
                   "this very cold brown dwarf gives off its light mostly around 4-5 microns. Keeping only the long "
                   "wavelengths reduces the contamination from the background star. It does not remove it "
                   "completely: the background star still adds some light at these wavelengths too.",
            "median_flux_ujy": {
                "3.8-4.05_um": median_flux(spec, 3.8, 4.05),
                "4.15-4.65_um": median_flux(spec, 4.15, 4.65),
            },
        },
        "method": full["method"],
        "units": full["units"],
        "binned": spec,
        "points": kept,
        "data_credit": full["data_credit"],
    }
    (folder / "spectrum_filtered.json").write_text(json.dumps(result, indent=2))
    plot(result, folder / "spectrum_filtered.png")

    csv_dir = Path("science") / "csv"
    csv_dir.mkdir(parents=True, exist_ok=True)
    with open(csv_dir / f"{args.slug}-spectrum-filtered.csv", "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["band", "mjd", "wavelength_um", "flux_ujy", "flux_err_ujy"])
        for p in kept:
            w.writerow([p["band"], p["mjd"], p["wavelength_um"], p["flux_ujy"], p["flux_err_ujy"]])

    m = result["filter"]["median_flux_ujy"]
    print(f"Done: {folder}/spectrum_filtered.png ({len(kept)} images, detectors {', '.join(bands)}). "
          f"Median flux 3.8-4.05 um: {m['3.8-4.05_um']} uJy; 4.15-4.65 um: {m['4.15-4.65_um']} uJy")


if __name__ == "__main__":
    main()
