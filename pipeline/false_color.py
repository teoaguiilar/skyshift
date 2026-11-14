"""
SkyShift: false-colour picture of an object from three SPHEREx infrared bands.

Our eyes cannot see infrared light, so we paint three infrared wavelength
ranges with the three colours a screen can show: the shortest SPHEREx band in
blue, a middle one in green and the longest one in red. Cool objects (brown
dwarfs) come out red, hot stars blue-white. These are NOT the colours the
object really has; they are a code, and the legend says which wavelength each
colour stands for. (Idea of Benjamín, SkyShift Murcia team.)

SPHEREx observes the same field with its six detector arrays at the same
time, so all three colours come from the same visit: moving objects do not
smear into coloured trails.

Output in data/<slug>/:
  false_color.png    RGB picture, same grid and orientation as the frames
  false_color.json   legend (which wavelengths each colour shows), visit date

Usage (from the repository root):
    python pipeline/false_color.py --name "eps Ind B" --slug eps-indi-b

Written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team.
See AI_USAGE.md. Data: NASA SPHEREx via NASA/IPAC IRSA. License: MIT.
"""
import argparse
import concurrent.futures
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from astropy.time import Time  # noqa: E402
from reproject import reproject_interp  # noqa: E402

import fetch_object as fo  # noqa: E402  (same folder)
from stack_epochs import group_visits  # noqa: E402

# Colour code: (screen colour, SPHEREx detector array)
CHANNELS = [("red", "D6"), ("green", "D3"), ("blue", "D1")]  # longest, middle, shortest detector arrays


def stretch(channels, hi_pct=99.7, soft=10):
    """Scale the three channels together (same factor for all, so colours compare
    brightness between wavelengths) with a gentle asinh stretch. The background
    of each image was already subtracted, so 0 is the sky level."""
    hi = max(np.percentile(c[np.isfinite(c)], hi_pct) for c in channels if np.isfinite(c).any())
    hi = hi if hi > 0 else 1
    ny, nx = channels[0].shape
    yy, xx = np.mgrid[0:ny, 0:nx]
    near_target = (xx - (nx - 1) / 2) ** 2 + (yy - (ny - 1) / 2) ** 2 <= 4 ** 2
    out = []
    for c in channels:
        # Empty pixels: near the target they are a saturated core (white); elsewhere they are
        # outside the images (black).
        c = np.where(np.isnan(c) & near_target, hi, c)
        x = np.clip(np.nan_to_num(c, nan=0.0) / hi, 0, 1)
        out.append(np.arcsinh(soft * x) / np.arcsinh(soft))
    return out


def main():
    parser = argparse.ArgumentParser(description="SkyShift: false-colour picture from 3 SPHEREx bands")
    parser.add_argument("--name", required=True, help="Object name SIMBAD understands")
    parser.add_argument("--slug", required=True, help="Folder in data/ where the result goes")
    parser.add_argument("--size", type=float, default=0.06, help="Cutout size in degrees (default 0.06)")
    parser.add_argument("--workers", type=int, default=10, help="Parallel downloads (default 10)")
    args = parser.parse_args()

    out_dir = Path("data") / args.slug
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"1/3 Looking up {args.name}...")
    coord, _ = fo.resolve_target(args.name)
    center = fo.position_at(coord, Time("2025-12-01").mjd)  # same as the other scripts: cached cutouts are reused

    print("2/3 Getting the images of three detector arrays...")
    frames = {}
    for colour, band in CHANNELS:
        table = fo.query_images(center, band, args.size)
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
            jobs = [pool.submit(fo.read_cutout, str(r["uri"]), float(r["time_bounds_lower"]), coord) for r in table]
            frames[band] = [f for f in (j.result() for j in jobs) if f is not None]
        print(f"    {band} ({colour}): {len(frames[band])} images")
        if not frames[band]:
            raise SystemExit(f"No usable {band} images.")

    # Pick the visit with the most images in the three bands together.
    visits = group_visits([f for b in frames for f in frames[b]], 30)
    best = max(visits, key=len)
    t0, t1 = min(f["mjd"] for f in best), max(f["mjd"] for f in best)
    print(f"3/3 Using the visit of {Time(t0, format='mjd').iso[:10]} ({len(best)} images) and writing the picture...")

    grid, shape = fo.make_grid(center, args.size)
    layers, legend = [], []
    for colour, band in CHANNELS:
        chosen = [f for f in frames[band] if t0 <= f["mjd"] <= t1]
        if not chosen:  # this band has no image in that visit: take its images closest in time
            mid = (t0 + t1) / 2
            chosen = sorted(frames[band], key=lambda f: abs(f["mjd"] - mid))[:5]
        stack = []
        for f in chosen:
            data, _ = reproject_interp((f["image"], f["wcs"]), grid, shape_out=shape)
            stack.append(data - np.nanmedian(data))
        img = np.nanmedian(np.array(stack), axis=0) if len(stack) >= 3 else np.nanmean(np.array(stack), axis=0)
        layers.append(img)
        wls = [f["wavelength_um"] for f in chosen]
        legend.append({"colour": colour, "detector": band, "images": len(chosen),
                       "wavelengths_used_um": [round(min(wls), 3), round(max(wls), 3)] if wls else None})

    rgb = np.dstack(stretch(layers))
    rgb = np.kron(rgb, np.ones((10, 10, 1)))  # each sky pixel = 10x10 PNG pixels, like the frames
    plt.imsave(out_dir / "false_color.png", rgb, origin="lower")

    info = {
        "object": args.slug,
        "name": args.name,
        "file": "false_color.png",
        "visit": {"from": Time(t0, format="mjd").iso[:10], "to": Time(t1, format="mjd").iso[:10]},
        "legend": legend,
        "note": "False colours: infrared light is invisible to the eye, so each colour stands for a range "
                "of infrared wavelengths (red = longest, blue = shortest). These are not the object's real colours.",
        "data_credit": "NASA SPHEREx via NASA/IPAC Infrared Science Archive (IRSA)",
    }
    (out_dir / "false_color.json").write_text(json.dumps(info, indent=2))
    key = ", ".join(f"{l['colour']} = {l['detector']} {l['wavelengths_used_um'][0]}-{l['wavelengths_used_um'][1]} um"
                    for l in legend if l["wavelengths_used_um"])
    print(f"Done: {out_dir}/false_color.png  ({key})")


if __name__ == "__main__":
    main()
