"""
SkyShift: difference image between the first and the last SPHEREx visit.

Subtracting an early image of the sky from a late one makes everything that
stays still disappear (it cancels out), while anything that moved leaves a
dark spot where it was and a bright spot where it is now. That pair is the
signature of a moving object, and it is much easier to see than in the images
themselves. The challenge suggests this ("add together or subtract images
taken at different times").

For each visit the script aligns all images on a common sky grid and takes
their median; then it subtracts the first visit from the last one.

Output in data/<slug>/:
  difference.png    the difference image (bright = now, dark = before)
  difference.json   which visits were used, how many images, and where the
                    catalogue says the object was in each visit (pixels)

Usage (from the repository root):
    python pipeline/difference.py --name "Barnard's Star" --slug barnard --band D2
    python pipeline/difference.py --name "WISE J085510.83-071442.5" --slug wise-0855-stacked --band D6 --all-wavelengths

Written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team.
See AI_USAGE.md. Data: NASA SPHEREx via NASA/IPAC IRSA. License: MIT.
"""
import argparse
import concurrent.futures
import json
import time
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from astropy.time import Time  # noqa: E402
from reproject import reproject_interp  # noqa: E402

import fetch_object as fo  # noqa: E402  (same folder)
from stack_epochs import group_visits  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description="SkyShift: last visit minus first visit")
    parser.add_argument("--name", required=True, help="Object name SIMBAD understands")
    parser.add_argument("--slug", required=True, help="Folder in data/ where the result goes")
    parser.add_argument("--band", default="D2", help="SPHEREx detector D1..D6 (default D2)")
    parser.add_argument("--size", type=float, default=0.06, help="Cutout size in degrees (default 0.06)")
    parser.add_argument("--wl", type=float, default=None, help="Wavelength in microns (default: most images)")
    parser.add_argument("--tol", type=float, default=0.02, help="Wavelength tolerance (default 0.02 = 2%%)")
    parser.add_argument("--all-wavelengths", action="store_true",
                        help="Use every image of the detector array (for faint objects)")
    parser.add_argument("--gap", type=float, default=30, help="Days between visits (default 30)")
    parser.add_argument("--workers", type=int, default=10, help="Parallel downloads (default 10)")
    args = parser.parse_args()

    out_dir = Path("data") / args.slug
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"1/4 Looking up {args.name}...")
    coord, _ = fo.resolve_target(args.name)
    center = fo.position_at(coord, Time("2025-12-01").mjd)  # same as fetch_object.py: cached cutouts are reused

    print(f"2/4 Asking IRSA for SPHEREx {args.band} images and downloading them...")
    table = fo.query_images(center, args.band, args.size)
    t0 = time.time()
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        jobs = [pool.submit(fo.read_cutout, str(r["uri"]), float(r["time_bounds_lower"]), coord) for r in table]
        frames = [j.result() for j in jobs]
    frames = [f for f in frames if f is not None]
    print(f"    {len(frames)} images ok, {(time.time() - t0) / 60:.1f} min")
    if not args.all_wavelengths:
        wl, frames = fo.choose_wavelength(frames, args.wl, args.tol)
        print(f"    keeping {len(frames)} images around {wl:.3f} um")
    visits = group_visits(frames, args.gap)
    if len(visits) < 2:
        raise SystemExit("Only one visit: nothing to subtract yet.")
    first, last = visits[0], visits[-1]
    # A visit with very few images is noisy: prefer the earliest/latest visit with at least 3.
    rich = [v for v in visits if len(v) >= 3]
    if len(rich) >= 2:
        first, last = rich[0], rich[-1]

    print(f"3/4 Stacking and subtracting: {len(first)} images ({Time(first[0]['mjd'], format='mjd').iso[:10]}) "
          f"from {len(last)} images ({Time(last[0]['mjd'], format='mjd').iso[:10]})...")
    grid, shape = fo.make_grid(center, args.size)

    def stack(visit):
        layers = []
        for f in visit:
            data, _ = reproject_interp((f["image"], f["wcs"]), grid, shape_out=shape)
            layers.append(data - np.nanmedian(data))
        cube = np.array(layers)
        return np.nanmedian(cube, axis=0) if len(layers) >= 3 else np.nanmean(cube, axis=0)

    diff = stack(last) - stack(first)

    print("4/4 Writing difference.png and difference.json...")
    finite = diff[np.isfinite(diff)]
    lim = np.percentile(np.abs(finite), 99.5) if finite.size else 1
    big = np.kron(np.nan_to_num(diff), np.ones((10, 10)))  # each sky pixel = 10x10 PNG pixels, like the frames
    plt.imsave(out_dir / "difference.png", big, cmap="RdBu_r", vmin=-lim, vmax=lim, origin="lower")

    marks = []
    for label, visit in (("first", first), ("last", last)):
        mjd = float(np.mean([f["mjd"] for f in visit]))
        x, y = grid.world_to_pixel(fo.position_at(coord, mjd))
        marks.append({"visit": label, "date": Time(mjd, format="mjd").iso[:10], "mjd": mjd,
                      "images": len(visit), "predicted_pixel": {"x": float(x), "y": float(y)}})
    info = {
        "object": args.slug,
        "name": args.name,
        "band": args.band,
        "all_wavelengths": args.all_wavelengths,
        "file": "difference.png",
        "how_to_read": "Last visit minus first visit. Red = brighter now, blue = brighter before. "
                       "Objects that did not move cancel out; a moving object leaves a blue spot "
                       "(where it was) next to a red spot (where it is now).",
        "pixel_note": "Pixel (0,0) is the bottom-left sky pixel; each sky pixel is 10x10 PNG pixels; "
                      "north is up and east is left, as in the frames.",
        "visits": marks,
        "data_credit": "NASA SPHEREx via NASA/IPAC Infrared Science Archive (IRSA)",
    }
    (out_dir / "difference.json").write_text(json.dumps(info, indent=2))
    shift = np.hypot(marks[1]["predicted_pixel"]["x"] - marks[0]["predicted_pixel"]["x"],
                     marks[1]["predicted_pixel"]["y"] - marks[0]["predicted_pixel"]["y"])
    print(f"Done: {out_dir}/difference.png (catalogue motion between the two visits: {shift:.1f} pixels)")


if __name__ == "__main__":
    main()
