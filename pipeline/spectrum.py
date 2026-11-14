"""
SkyShift: low-resolution infrared spectrum of one object from SPHEREx images.

SPHEREx sees a slightly different wavelength in each part of its detectors, so
every image of an object measures its brightness at one wavelength between
0.75 and 5 microns. Measuring the object in all images of all six detector
arrays gives its spectrum: how bright it is at each wavelength.

For each image the script measures the light inside a small circle around the
object (aperture photometry, radius 2 pixels), subtracts the local background
(ring of 4 to 7 pixels) and converts it to flux density in microjanskys using
the pixel size. There is no aperture correction, so the absolute level is
approximate; the shape of the spectrum is what matters. Saturated images and
images with bad quality flags are left out.

Output:
  data/<slug>/spectrum.json   every measurement + a binned spectrum
  data/<slug>/spectrum.png    quick-look plot
  science/csv/<slug>-spectrum.csv

Usage (from the repository root):
    python pipeline/spectrum.py --name "eps Ind B" --slug eps-indi-b

Note: variable stars change between visits, so their spectrum mixes dates.
Each point keeps its date (mjd) so it can be split by visit.

Written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team.
See AI_USAGE.md. Data: NASA SPHEREx via NASA/IPAC IRSA. License: MIT.
"""
import argparse
import concurrent.futures
import csv
import json
import time
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

import fetch_object as fo  # noqa: E402  (same folder)

BANDS = ["D1", "D2", "D3", "D4", "D5", "D6"]
SR_PER_PIXEL = (fo.PIXEL_SCALE_ARCSEC / 206264.806) ** 2  # pixel solid angle
R_AP, R_IN, R_OUT = 2.0, 4.0, 7.0  # pixels


def photometry(frame, coord):
    """Flux density (microjansky) and error of the target in one image, or None."""
    img = frame["image"]
    target = fo.position_at(coord, frame["mjd"])
    x, y = frame["wcs"].world_to_pixel(target)
    x, y = float(x), float(y)
    yy, xx = np.mgrid[0:img.shape[0], 0:img.shape[1]]
    r2 = (xx - x) ** 2 + (yy - y) ** 2
    ap = r2 <= R_AP ** 2
    ring = (r2 >= R_IN ** 2) & (r2 <= R_OUT ** 2) & np.isfinite(img)
    if ap.sum() == 0 or ring.sum() < 15:
        return None
    if not np.all(np.isfinite(img[ap])):
        return {"saturated": True}
    sky = img[ring]
    bkg = np.median(sky)
    sigma = 1.4826 * np.median(np.abs(sky - bkg))
    signal = np.sum(img[ap] - bkg)  # MJy/sr summed over pixels
    to_ujy = SR_PER_PIXEL * 1e6 * 1e6  # MJy -> Jy -> microJy
    return {
        "saturated": False,
        "flux_ujy": float(signal * to_ujy),
        "flux_err_ujy": float(sigma * np.sqrt(ap.sum()) * to_ujy),
    }


def binned(points, step=0.02):
    """Median flux in wavelength bins of constant width in log(wavelength)."""
    wl = np.array([p["wavelength_um"] for p in points])
    fl = np.array([p["flux_ujy"] for p in points])
    edges = np.exp(np.arange(np.log(0.7), np.log(5.1), step))
    out = []
    for lo, hi in zip(edges[:-1], edges[1:]):
        sel = (wl >= lo) & (wl < hi)
        if sel.sum() == 0:
            continue
        vals = fl[sel]
        # Robust error of the median: uses the median absolute deviation, so one odd
        # image (e.g. a cosmic ray) does not blow up the error bar of its bin.
        mad = np.median(np.abs(vals - np.median(vals)))
        err = 1.2533 * 1.4826 * mad / np.sqrt(sel.sum()) if sel.sum() > 1 else None
        out.append({"wavelength_um": round(float(np.median(wl[sel])), 4),
                    "flux_ujy": round(float(np.median(vals)), 2),
                    "flux_err_ujy": None if err is None else round(float(err), 2),
                    "n": int(sel.sum())})
    return out


def plot(result, path):
    """Quick-look plot. The y range follows the binned spectrum, so a few wild
    single measurements do not squash the curve."""
    points, spec = result["points"], result["binned"]
    fig, ax = plt.subplots(figsize=(8, 4.5), dpi=120)
    ax.errorbar([p["wavelength_um"] for p in points], [p["flux_ujy"] for p in points],
                yerr=[p["flux_err_ujy"] for p in points], fmt=".", color="0.75", ms=3, lw=0.5,
                label="single SPHEREx images")
    # Do not draw the line across wavelength ranges with no data (e.g. saturated detectors).
    xs, ys = [], []
    for i, b in enumerate(spec):
        if i and b["wavelength_um"] - spec[i - 1]["wavelength_um"] > 0.25:
            xs.append(np.nan)
            ys.append(np.nan)
        xs.append(b["wavelength_um"])
        ys.append(b["flux_ujy"])
    ax.plot(xs, ys, "o-", color="C0", ms=4, label="binned (median)")
    vals = np.array([b["flux_ujy"] for b in spec])
    lo, hi = np.percentile(vals, [2, 98])
    pad = 0.25 * (hi - lo if hi > lo else abs(hi) + 1)
    ax.set_ylim(min(0, lo - pad), hi + pad)
    ax.set_xlabel("Wavelength (microns)")
    ax.set_ylabel("Flux density (microjansky, approx.)")
    title = f"{result['name']}: SPHEREx spectrum (SkyShift)"
    if result.get("saturated_images_skipped"):
        title += f"\n{result['saturated_images_skipped']} saturated images left out"
    ax.set_title(title, fontsize=11)
    ax.set_xlim(0.7, 5.1)
    ax.legend(frameon=False)
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def main():
    parser = argparse.ArgumentParser(description="SkyShift: SPHEREx spectrum of one object")
    parser.add_argument("--name", required=True, help="Object name SIMBAD understands")
    parser.add_argument("--slug", required=True, help="Folder name in data/")
    parser.add_argument("--size", type=float, default=0.06, help="Cutout size in degrees (default 0.06, same as fetch_object.py so cached cutouts are reused)")
    parser.add_argument("--workers", type=int, default=10, help="Parallel downloads (default 10)")
    parser.add_argument("--replot", action="store_true", help="Only redraw spectrum.png from spectrum.json")
    parser.add_argument("--rebin", action="store_true",
                        help="Recompute the binned spectrum from the points in spectrum.json (no download), then redraw")
    args = parser.parse_args()

    out_dir = Path("data") / args.slug
    out_dir.mkdir(parents=True, exist_ok=True)
    if args.rebin:
        result = json.loads((out_dir / "spectrum.json").read_text())
        result["binned"] = binned([p for p in result["points"] if not p.get("saturated")])
        (out_dir / "spectrum.json").write_text(json.dumps(result, indent=2))
        args.replot = True
    if args.replot:
        plot(json.loads((out_dir / "spectrum.json").read_text()), out_dir / "spectrum.png")
        print(f"Redrawn {out_dir}/spectrum.png")
        return

    print(f"1/4 Looking up {args.name}...")
    coord, target_info = fo.resolve_target(args.name)
    center = fo.position_at(coord, fo.Time("2025-12-01").mjd)

    print("2/4 Asking IRSA for SPHEREx images in all six detectors...")
    rows = []
    for band in BANDS:
        table = fo.query_images(center, band, args.size)
        rows += [(band, str(r["uri"]), float(r["time_bounds_lower"])) for r in table]
        print(f"    {band}: {len(table)} images")

    print(f"3/4 Downloading and measuring {len(rows)} cutouts ({args.workers} at a time)...")
    t0 = time.time()

    def work(row):
        band, uri, mjd = row
        f = fo.read_cutout(uri, mjd, coord)
        if f is None:
            return None
        ph = photometry(f, coord)
        return band, f, ph

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        results = list(pool.map(work, rows))
    failed = sum(r is None for r in results)
    points, saturated, bad = [], 0, 0
    for r in results:
        if r is None or r[2] is None:
            continue
        band, f, ph = r
        if ph["saturated"]:
            saturated += 1
            continue
        ok = not (set(fo.flag_names(f["flag_value"])) & (fo.BAD_FLAGS | {"UNKNOWN"}))
        if not ok:
            bad += 1
            continue
        points.append({"band": band, "mjd": f["mjd"], "wavelength_um": round(f["wavelength_um"], 4),
                       "flux_ujy": round(ph["flux_ujy"], 2), "flux_err_ujy": round(ph["flux_err_ujy"], 2),
                       "flags": fo.flag_names(f["flag_value"]), "source_url": f["uri"]})
    points.sort(key=lambda p: p["wavelength_um"])
    print(f"    {len(points)} measurements, {saturated} saturated, {bad} bad quality, "
          f"{failed} failed downloads, {(time.time() - t0) / 60:.1f} min")
    if not points:
        raise SystemExit("No usable measurements (saturated or too faint?).")

    print("4/4 Writing spectrum.json, spectrum.png and the CSV...")
    spec = binned(points)
    result = {
        "object": args.slug,
        "name": args.name,
        "target": target_info,
        "method": "Aperture photometry (radius 2 px = 12.3 arcsec, background ring 4-7 px) on every SPHEREx "
                  "image of all six detector arrays; no aperture correction, so absolute fluxes are approximate.",
        "units": {"wavelength": "micrometre", "flux": "microjansky"},
        "saturated_images_skipped": saturated,
        "bad_quality_images_skipped": bad,
        "binned": spec,
        "points": points,
        "data_credit": "NASA SPHEREx via NASA/IPAC Infrared Science Archive (IRSA)",
    }
    (out_dir / "spectrum.json").write_text(json.dumps(result, indent=2))

    plot(result, out_dir / "spectrum.png")

    csv_dir = Path("science") / "csv"
    csv_dir.mkdir(parents=True, exist_ok=True)
    with open(csv_dir / f"{args.slug}-spectrum.csv", "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["band", "mjd", "wavelength_um", "flux_ujy", "flux_err_ujy", "flags", "source_url"])
        for p in points:
            w.writerow([p["band"], p["mjd"], p["wavelength_um"], p["flux_ujy"], p["flux_err_ujy"],
                        " ".join(p["flags"]), p["source_url"]])
    print(f"Done: {len(points)} measurements, {len(spec)} wavelength bins in {out_dir}/spectrum.json")


if __name__ == "__main__":
    main()
