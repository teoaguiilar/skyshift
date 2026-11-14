"""
SkyShift: "Bands" - one summed picture per SPHEREx detector array and per visit,
plus where the object is in each of them (idea of Benjamín, SkyShift Murcia team).

SPHEREx has six detector arrays, D1 (shortest infrared) to D6 (longest). In each
visit (every ~6 months) every detector takes several images of the same field.
For each visit and each detector this script aligns all its images on the same
sky grid as the time-lapse frames and adds them together (median), which
improves the signal-to-noise, as the challenge suggests. The web can then:
  - show each detector separately, visit by visit (like splitting an RGB picture
    into its colours, but with six infrared "colours"),
  - add any set of detectors (D1 + D3, D2 + D4 + D5...) in the browser, in real time,
  - confirm a movement: a real moving object shifts the same way in every
    detector; a defect shows up in only one of them.

Output: data/<slug>/bands.json
  grid       size and orientation (same grid as the frames: north up, east left)
  visits[]   {visit, from, to, mjd, predicted {x, y}, bands {D1..D6: {images,
             wavelength_um [min, max], data, position}}}
             data = the summed picture as base64 Float32 little-endian, row by
             row starting from the BOTTOM row (y = 0), width x height values,
             NaN = no data or saturated core; units MJy/sr, background removed.
             position = where SkyShift measures the object in that picture
             {x, y, saturated} or null if it is too faint there.
  motion     per detector: measured shift between the first and the last visit
             where it was measured, and the shift the catalogue predicts (arcsec).

Usage (from the repository root; reuses the cutouts already downloaded):
    python pipeline/band_stacks.py --name "Barnard's Star" --slug barnard
    # if IRSA is down, reuse the images already downloaded for the spectrum:
    python pipeline/band_stacks.py --name "Barnard's Star" --slug barnard --from-spectrum barnard

Written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team.
See AI_USAGE.md. Data: NASA SPHEREx via NASA/IPAC IRSA. License: MIT.
"""
import argparse
import base64
import concurrent.futures
import json
import time
from pathlib import Path

import numpy as np
from astropy.time import Time
from reproject import reproject_interp

import fetch_object as fo  # same folder
from stack_epochs import group_visits

BANDS = ["D1", "D2", "D3", "D4", "D5", "D6"]


def query_with_retries(center, band, size, tries=5):
    """IRSA sometimes answers 502/503 for a while: wait and try again."""
    for attempt in range(1, tries + 1):
        try:
            return fo.query_images(center, band, size)
        except Exception as err:  # pyvo raises several kinds of errors for this
            if attempt == tries:
                raise SystemExit(f"IRSA is not answering ({err}). Try again in a few minutes.")
            wait = 20 * attempt
            print(f"    IRSA did not answer ({type(err).__name__}); trying again in {wait} s...")
            time.sleep(wait)


def encode(img):
    """Float32 little-endian, row by row from the bottom row, as base64 text."""
    return base64.b64encode(np.ascontiguousarray(img, dtype="<f4").tobytes()).decode("ascii")


def main():
    parser = argparse.ArgumentParser(description="SkyShift: summed picture per detector and visit")
    parser.add_argument("--name", required=True, help="Object name SIMBAD understands")
    parser.add_argument("--slug", required=True, help="Folder in data/ where the result goes")
    parser.add_argument("--size", type=float, default=0.06, help="Cutout size in degrees (default 0.06, reuses the cache)")
    parser.add_argument("--gap", type=float, default=30, help="Days between visits (default 30)")
    parser.add_argument("--workers", type=int, default=10, help="Parallel downloads (default 10)")
    parser.add_argument("--from-spectrum", default=None, metavar="SLUG",
                        help="Do not ask IRSA which images exist: reuse the images listed in "
                             "data/SLUG/spectrum.json (already downloaded, read from the local cache)")
    args = parser.parse_args()

    out_dir = Path("data") / args.slug
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"1/3 Looking up {args.name}...")
    coord, _ = fo.resolve_target(args.name)
    center = fo.position_at(coord, Time("2025-12-01").mjd)  # same centre as the other scripts
    grid, shape = fo.make_grid(center, args.size)

    print("2/3 Reading the images of the six detector arrays...")
    listed = None
    if args.from_spectrum:
        spec = json.loads((Path("data") / args.from_spectrum / "spectrum.json").read_text())
        listed = spec["points"]
        print(f"    using the {len(listed)} images listed in data/{args.from_spectrum}/spectrum.json "
              "(saturated and bad-quality images were already left out there)")
    frames = []
    for band in BANDS:
        if listed is not None:
            rows = [(p["source_url"], float(p["mjd"])) for p in listed if p["band"] == band]
        else:
            table = query_with_retries(center, band, args.size)
            rows = [(str(r["uri"]), float(r["time_bounds_lower"])) for r in table]
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
            jobs = [pool.submit(fo.read_cutout, uri, mjd, coord) for uri, mjd in rows]
            got = [f for f in (j.result() for j in jobs) if f is not None]
        bad = 0
        for f in got:
            if set(fo.flag_names(f["flag_value"])) & fo.BAD_FLAGS:
                bad += 1
                continue
            f["band"] = band
            frames.append(f)
        print(f"    {band}: {len(got)} images ({bad} left out for bad quality flags)")
    if not frames:
        raise SystemExit("No usable images.")

    print("3/3 Adding up each detector in each visit...")
    visits_out = []
    for i, visit in enumerate(group_visits(frames, args.gap), start=1):
        mjd = float(np.mean([f["mjd"] for f in visit]))
        px, py = grid.world_to_pixel(fo.position_at(coord, mjd))
        entry = {"visit": i,
                 "from": Time(min(f["mjd"] for f in visit), format="mjd").iso[:10],
                 "to": Time(max(f["mjd"] for f in visit), format="mjd").iso[:10],
                 "mjd": round(mjd, 4),
                 "predicted": {"x": round(float(px), 3), "y": round(float(py), 3)},
                 "bands": {}}
        for band in BANDS:
            chosen = [f for f in visit if f["band"] == band]
            if not chosen:
                continue
            layers = []
            for f in chosen:
                data, _ = reproject_interp((f["image"], f["wcs"]), grid, shape_out=shape)
                layers.append(data - np.nanmedian(data))
            cube = np.array(layers)
            img = np.nanmedian(cube, axis=0) if len(layers) >= 3 else np.nanmean(cube, axis=0)
            c = fo.centroid(img, float(px), float(py))
            wls = [f["wavelength_um"] for f in chosen]
            entry["bands"][band] = {
                "images": len(chosen),
                "wavelength_um": [round(min(wls), 3), round(max(wls), 3)],
                "data": encode(img),
                "position": None if c is None else {"x": round(c[0], 3), "y": round(c[1], 3), "saturated": c[3]},
            }
        visits_out.append(entry)
        print(f"    visit {i} ({entry['from']}): " + ", ".join(f"{b} x{v['images']}" for b, v in entry["bands"].items()))

    # Motion check: shift between the first and last visit where each detector measured the object.
    scale = fo.PIXEL_SCALE_ARCSEC
    motion = {}
    for band in BANDS:
        seen = [v for v in visits_out if band in v["bands"] and v["bands"][band]["position"]]
        if len(seen) < 2:
            motion[band] = None
            continue
        a, b = seen[0], seen[-1]
        pa, pb = a["bands"][band]["position"], b["bands"][band]["position"]
        # North is up (+y) and east is left (-x) in the grid.
        meas = {"east": -(pb["x"] - pa["x"]) * scale, "north": (pb["y"] - pa["y"]) * scale}
        pred = {"east": -(b["predicted"]["x"] - a["predicted"]["x"]) * scale,
                "north": (b["predicted"]["y"] - a["predicted"]["y"]) * scale}
        motion[band] = {"from_visit": a["visit"], "to_visit": b["visit"],
                        "measured_arcsec": {k: round(v, 2) for k, v in meas.items()},
                        "predicted_arcsec": {k: round(v, 2) for k, v in pred.items()}}

    info = {
        "object": args.slug,
        "name": args.name,
        "grid": {"width": shape[1], "height": shape[0], "pixel_scale_arcsec": scale,
                 "orientation": "north up, east left; same grid as the time-lapse frames",
                 "data_layout": "base64 Float32 little-endian, rows from the bottom (y = 0) up; NaN = no data"},
        "units": "MJy/sr, zodiacal light and median background removed",
        "how_to_read": "Each detector array sees a different range of infrared wavelengths (D1 shortest, D6 longest). "
                       "A real moving object shifts the same way in every detector; a defect appears in only one.",
        "visits": visits_out,
        "motion": motion,
        "data_credit": "NASA SPHEREx via NASA/IPAC Infrared Science Archive (IRSA); target data from SIMBAD (CDS)",
    }
    (out_dir / "bands.json").write_text(json.dumps(info))
    print(f"Done: {out_dir}/bands.json")
    for band, m in motion.items():
        if m:
            print(f"    {band}: measured E {m['measured_arcsec']['east']:+.1f}\" N {m['measured_arcsec']['north']:+.1f}\"  "
                  f"(catalogue E {m['predicted_arcsec']['east']:+.1f}\" N {m['predicted_arcsec']['north']:+.1f}\")")


if __name__ == "__main__":
    main()
