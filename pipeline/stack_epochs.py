"""
SkyShift: stack SPHEREx images taken in the same visit, to see faint objects.

SPHEREx passes over each patch of sky in "visits" about six months apart, and
takes several images in each visit. One image may be too noisy to show a faint
object such as WISE 0855, but adding together all the images of one visit (from
one detector array, as the challenge suggests) beats down the noise.

For each visit the script:
  1. downloads all images of the chosen detector array (any wavelength in it),
  2. removes the zodiacal light and the remaining background of each image,
  3. aligns them on a common sky grid and takes the median (robust to cosmic rays),
  4. measures the object near where the catalogue says it should be that day,
     and estimates how clearly it stands out from the noise (signal-to-noise).

Output: data/<slug>/visit_NN.png and data/<slug>/manifest.json, in the same
format as fetch_object.py (plus "stacked_images", "snr" and "detected"), so the
web app can play it like any other object.

Usage (from the repository root):
    python pipeline/stack_epochs.py --name "WISE J085510.83-071442.5" --slug wise-0855-stacked --band D6

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

SNR_DETECTED = 5.0  # below this the object is not considered clearly seen


def group_visits(frames, gap_days):
    """Split frames (sorted by date) into visits separated by more than gap_days."""
    frames = sorted(frames, key=lambda f: f["mjd"])
    visits, current = [], [frames[0]]
    for f in frames[1:]:
        if f["mjd"] - current[-1]["mjd"] > gap_days:
            visits.append(current)
            current = []
        current.append(f)
    visits.append(current)
    return visits


def bad_count(visit):
    """Number of images in a visit with flags the Supplement calls unusable."""
    return sum(bool(set(fo.flag_names(f["flag_value"])) & (fo.BAD_FLAGS | {"UNKNOWN"})) for f in visit)


def signal_to_noise(image, x, y, radius=1.5):
    """Rough signal-to-noise of a point source at (x, y) in a background-subtracted image."""
    yy, xx = np.mgrid[0:image.shape[0], 0:image.shape[1]]
    r2 = (xx - x) ** 2 + (yy - y) ** 2
    aperture = (r2 <= radius ** 2) & np.isfinite(image)
    sky = (r2 >= 4 ** 2) & np.isfinite(image)
    if aperture.sum() == 0 or sky.sum() < 20:
        return None
    sky_values = image[sky]
    sigma = 1.4826 * np.nanmedian(np.abs(sky_values - np.nanmedian(sky_values)))
    if not np.isfinite(sigma) or sigma <= 0:
        return None
    signal = np.nansum(image[aperture] - np.nanmedian(sky_values))
    return float(signal / (sigma * np.sqrt(aperture.sum())))


def main():
    parser = argparse.ArgumentParser(description="SkyShift: stack SPHEREx images per visit")
    parser.add_argument("--name", required=True, help="Object name SIMBAD understands")
    parser.add_argument("--slug", required=True, help="Folder name in data/, e.g. wise-0855-stacked")
    parser.add_argument("--band", default="D6", help="SPHEREx detector D1..D6 (default D6)")
    parser.add_argument("--size", type=float, default=0.06, help="Cutout size in degrees (default 0.06)")
    parser.add_argument("--gap", type=float, default=30, help="Days between visits (default 30)")
    parser.add_argument("--workers", type=int, default=10, help="Parallel downloads (default 10)")
    args = parser.parse_args()

    out_dir = Path("data") / args.slug
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"1/5 Looking up {args.name}...")
    coord, target_info = fo.resolve_target(args.name)
    center = fo.position_at(coord, Time("2025-12-01").mjd)

    print(f"2/5 Asking IRSA for SPHEREx {args.band} images...")
    table = fo.query_images(center, args.band, args.size)
    print(f"    {len(table)} images found")
    if len(table) == 0:
        raise SystemExit("No SPHEREx images for this position and detector.")

    print(f"3/5 Downloading cutouts ({args.workers} at a time, up to 3 tries each)...")
    t0 = time.time()
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        jobs = [pool.submit(fo.read_cutout, str(r["uri"]), float(r["time_bounds_lower"]), coord) for r in table]
        frames = [j.result() for j in jobs]
    failed = sum(f is None for f in frames)
    frames = [f for f in frames if f is not None]
    print(f"    {len(frames)} ok, {failed} failed, {(time.time() - t0) / 60:.1f} min")
    if not frames:
        raise SystemExit("All downloads failed. Try again in a few minutes.")

    visits = group_visits(frames, args.gap)
    print(f"4/5 Stacking {len(frames)} images in {len(visits)} visits...")
    grid, shape = fo.make_grid(center, args.size)
    stacks = []
    for visit in visits:
        layers = []
        for f in visit:
            data, _ = reproject_interp((f["image"], f["wcs"]), grid, shape_out=shape)
            data = data - np.nanmedian(data)  # remaining background of this image
            layers.append(data)
        cube = np.array(layers)
        stacked = np.nanmedian(cube, axis=0) if len(layers) >= 3 else np.nanmean(cube, axis=0)
        stacks.append((visit, stacked))

    allpix = np.concatenate([s[np.isfinite(s)] for _, s in stacks])
    vmin, vmax = np.percentile(allpix, [1, 99.7])

    print("5/5 Writing PNG frames and manifest.json...")
    for old in list(out_dir.glob("frame_*.png")) + list(out_dir.glob("visit_*.png")):
        old.unlink()
    manifest_frames = []
    for i, (visit, img) in enumerate(stacks, start=1):
        mjd = float(np.mean([f["mjd"] for f in visit]))
        name = f"visit_{i:02d}.png"
        predicted = fo.position_at(coord, mjd)
        px, py = grid.world_to_pixel(predicted)
        plt.imsave(out_dir / name, fo.to_display(img, vmin, vmax), cmap="gray", vmin=0, vmax=1, origin="lower")
        c = fo.centroid(img, float(px), float(py))
        snr = None
        measured = None
        if c is not None:
            snr = signal_to_noise(img, c[0], c[1])
            m = grid.pixel_to_world(c[0], c[1])
            measured = {"ra_deg": float(m.ra.deg), "dec_deg": float(m.dec.deg),
                        "flux_rel": c[2], "saturated": c[3]}
        detected = snr is not None and snr >= SNR_DETECTED
        flag_list = sorted({n for f in visit for n in fo.flag_names(f["flag_value"])})
        wls = [f["wavelength_um"] for f in visit]
        manifest_frames.append({
            "file": name,
            "date": Time(mjd, format="mjd").to_value("iso", subfmt="date"),
            "mjd": mjd,
            "mjd_range": [min(f["mjd"] for f in visit), max(f["mjd"] for f in visit)],
            "wavelength_um": round(float(np.mean(wls)), 4),
            "wavelength_range_um": [round(min(wls), 4), round(max(wls), 4)],
            "stacked_images": len(visit),
            # The median of many images is robust to a few flagged ones: the visit is OK
            # when at least half of its images are OK.
            "quality_ok": bad_count(visit) <= len(visit) / 2,
            "flagged_images": bad_count(visit),
            "flags": flag_list,
            "predicted": {"ra_deg": float(predicted.ra.deg), "dec_deg": float(predicted.dec.deg)},
            "measured": measured,
            "snr": None if snr is None else round(snr, 1),
            "detected": bool(detected),
            "source_urls": [f["uri"] for f in visit],
        })
        state = f"S/N {snr:.1f}" if snr is not None else "no measurement"
        print(f"    visit {i}: {manifest_frames[-1]['date']}, {len(visit)} images, {state}"
              f"{'' if detected else ' (not clearly detected)'}")

    manifest = {
        "object": args.slug,
        "name": args.name,
        "target": target_info,
        "band": args.band,
        "stacked": True,
        "note": "Each frame is the median of all SPHEREx images of one visit in this detector array "
                "(all wavelengths of the array), to beat down the noise for faint objects.",
        "wavelength_um": round(float(np.mean([f["wavelength_um"] for f in frames])), 4),
        "grid": {
            "center_ra_deg": float(center.ra.deg),
            "center_dec_deg": float(center.dec.deg),
            "pixel_scale_arcsec": fo.PIXEL_SCALE_ARCSEC,
            "width": shape[1],
            "height": shape[0],
            "png_upscale": 10,
            "note": "In the PNG files north is up and east is left; each sky pixel is 10x10 PNG pixels",
        },
        "data_credit": "NASA SPHEREx via NASA/IPAC Infrared Science Archive (IRSA); target data from SIMBAD (CDS)",
        "frames": manifest_frames,
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(f"Done: {len(manifest_frames)} visits in {out_dir}/")


if __name__ == "__main__":
    main()
