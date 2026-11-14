"""
SkyShift data pipeline: fetch SPHEREx cutouts for one target, keep the
images taken at a similar wavelength, align them on a common sky grid and
export PNG frames plus a manifest.json for the web viewer.

Usage (from the repository root):
    python pipeline/fetch_object.py --name "Barnard's Star" --slug barnard --band D2

Data:
    - NASA SPHEREx spectral images, via the NASA/IPAC Infrared Science Archive (IRSA).
    - Target position, proper motion and parallax from SIMBAD (CDS, Strasbourg).

Based on the IRSA tutorial "Download a collection of SPHEREx Spectral Image
cutouts" (Caltech/IPAC-IRSA): https://caltech-ipac.github.io/irsa-tutorials/spherex-cutouts

AI disclosure: this script was written by the SkyShift team with the help of
Claude (Anthropic), an AI assistant. See docs/AI_USAGE.md.
License: MIT (see LICENSE).
"""

import argparse
import concurrent.futures
import http.client
import json
import time
import urllib.error
from pathlib import Path

import astropy.units as u
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from astropy.coordinates import Distance, SkyCoord  # noqa: E402
from astropy.io import fits  # noqa: E402
from astropy.time import Time  # noqa: E402
from astropy.utils.data import conf  # noqa: E402
from astropy.wcs import WCS  # noqa: E402
from reproject import reproject_interp  # noqa: E402

# SPHEREx files can take longer than astropy's default timeout to arrive.
conf.remote_timeout = 120

# Hide astropy's repeated, harmless notice about SIP keywords in SPHEREx headers.
from astropy import log  # noqa: E402

log.setLevel("WARNING")

PIXEL_SCALE_ARCSEC = 6.15  # approximate SPHEREx pixel size
TRANSIENT_ERRORS = (
    TimeoutError,
    urllib.error.HTTPError,
    urllib.error.URLError,
    http.client.IncompleteRead,
    http.client.RemoteDisconnected,
    ConnectionError,
)


# --------------------------------------------------------------------------
# 1. Where is the target? (SIMBAD, with proper motion)
# --------------------------------------------------------------------------
def _from_simbad(name):
    """Plan A: astroquery's SIMBAD client."""
    from astroquery.simbad import Simbad

    simbad = Simbad()
    simbad.add_votable_fields("pmra", "pmdec", "plx_value")
    table = simbad.query_object(name)
    if table is None or len(table) == 0:
        raise LookupError(f"SIMBAD does not know the object '{name}'.")
    row = table[0]
    cols = {c.lower(): c for c in table.colnames}

    def value(key):
        v = row[cols[key]]
        return None if np.ma.is_masked(v) else float(v)

    return (str(row[cols["main_id"]]), value("ra"), value("dec"),
            value("pmra"), value("pmdec"), value("plx_value"), "SIMBAD (CDS, Strasbourg)")


def _from_sesame(name):
    """Plan B: CDS Sesame name resolver (returns SIMBAD values, different service)."""
    import urllib.parse
    import xml.etree.ElementTree as ET

    import requests

    url = "https://cds.unistra.fr/cgi-bin/nph-sesame/-oxp/S?" + urllib.parse.quote(name)
    root = ET.fromstring(requests.get(url, timeout=60).content)
    resolver = root.find(".//Resolver")
    if resolver is None or resolver.find("jradeg") is None:
        raise LookupError(f"Sesame does not know the object '{name}'.")

    def value(path):
        node = resolver.find(path)
        try:
            return float(node.text) if node is not None and node.text else None
        except ValueError:
            return None

    main_id = resolver.findtext("oname") or name
    return (main_id, value("jradeg"), value("jdedeg"), value(".//pmRA"), value(".//pmDE"),
            value(".//plx/v"), "SIMBAD via CDS Sesame")


def resolve_target(name, manual=None):
    """Return a SkyCoord at epoch J2000 with proper motion (and distance if known).
    manual = (ra, dec, pmra, pmdec, plx, source) skips the online lookup."""
    if manual is not None:
        main_id = name
        ra, dec, pmra, pmdec, plx, source = manual
    else:
        try:
            main_id, ra, dec, pmra, pmdec, plx, source = _from_simbad(name)
        except LookupError:
            raise
        except Exception as error:  # SIMBAD service problems
            print(f"    SIMBAD failed ({type(error).__name__}); trying CDS Sesame...")
            try:
                main_id, ra, dec, pmra, pmdec, plx, source = _from_sesame(name)
            except Exception as error2:
                raise SystemExit(
                    f"Could not look up '{name}' online ({type(error2).__name__}). "
                    "Pass the values by hand: --ra --dec --pmra --pmdec [--plx] --source"
                )
    kwargs = dict(ra=ra * u.deg, dec=dec * u.deg, frame="icrs", obstime=Time("J2000"))
    if pmra is not None and pmdec is not None:
        kwargs.update(pm_ra_cosdec=pmra * u.mas / u.yr, pm_dec=pmdec * u.mas / u.yr)
        if plx is not None and plx > 0:
            kwargs["distance"] = Distance(parallax=plx * u.mas)
        else:
            kwargs["distance"] = 1 * u.kpc  # only to let astropy move the star
    info = {
        "simbad_id": main_id,
        "ra_j2000_deg": ra,
        "dec_j2000_deg": dec,
        "pmra_mas_yr": pmra,
        "pmdec_mas_yr": pmdec,
        "parallax_mas": plx,
        "source": source,
    }
    return SkyCoord(**kwargs), info


def position_at(coord, mjd):
    """Position of the target on a given date (MJD), applying proper motion."""
    if coord.pm_ra_cosdec is None or getattr(coord, "distance", None) is None:
        return SkyCoord(coord.ra, coord.dec, frame="icrs")
    moved = coord.apply_space_motion(new_obstime=Time(mjd, format="mjd"))
    return SkyCoord(moved.ra, moved.dec, frame="icrs")


# --------------------------------------------------------------------------
# 2. Which SPHEREx images cover the target? (IRSA TAP query)
# --------------------------------------------------------------------------
def query_images(center, band, size_deg):
    from astroquery.ipac.irsa import Irsa

    query = f"""
    SELECT
        'https://irsa.ipac.caltech.edu/' || a.uri || '?center={center.ra.deg},{center.dec.deg}d&size={size_deg}' AS uri,
        p.time_bounds_lower
    FROM spherex.artifact a
    JOIN spherex.plane p ON a.planeid = p.planeid
    WHERE 1 = CONTAINS(POINT('ICRS', {center.ra.deg}, {center.dec.deg}), p.poly)
      AND p.energy_bandpassname = 'SPHEREx-{band}'
    ORDER BY p.time_bounds_lower
    """
    return Irsa.query_tap(query).to_table()


# --------------------------------------------------------------------------
# 3. Download one cutout (with retries) and read what we need
# --------------------------------------------------------------------------
def read_cutout(uri, mjd, coord, retries=3):
    for attempt in range(1, retries + 1):
        try:
            with fits.open(uri, cache=True) as hdul:
                header = hdul["IMAGE"].header
                image = hdul["IMAGE"].data.astype(float)
                flags = hdul["FLAGS"].data
                zodi = hdul["ZODI"].data.astype(float) if "ZODI" in hdul else 0.0

                target = position_at(coord, mjd)
                spatial_wcs = WCS(header)
                x, y = spatial_wcs.world_to_pixel(target)

                # Wavelength seen by the detector at the target position.
                spectral_wcs = WCS(header, fobj=hdul, key="W")
                spectral_wcs.sip = None
                wavelength, _ = spectral_wcs.pixel_to_world(x, y)

                ix, iy = int(round(float(x))), int(round(float(y)))
                box = flags[max(iy - 1, 0): iy + 2, max(ix - 1, 0): ix + 2]
                flag_value = int(np.bitwise_or.reduce(box.ravel())) if box.size else -1

                return {
                    "uri": uri,
                    "mjd": float(mjd),
                    "wavelength_um": float(wavelength.to(u.micrometer).value),
                    "flag_value": flag_value,
                    "image": image - zodi,  # remove the zodiacal light background
                    "wcs": spatial_wcs,
                    "version": hdul[0].header.get("VERSION", ""),
                }
        except TRANSIENT_ERRORS:
            if attempt == retries:
                return None
            time.sleep(2 * attempt)
        except (KeyError, ValueError, OSError):
            return None


# --------------------------------------------------------------------------
# 4. Keep only images at a similar wavelength
# --------------------------------------------------------------------------
def choose_wavelength(frames, wl=None, tol=0.02):
    """Return (center, frames) where every frame is within +-tol (fraction) of center.
    If wl is not given, pick the window that contains the most images."""
    if wl is None:
        best = None
        for f in frames:
            c = f["wavelength_um"]
            n = sum(abs(g["wavelength_um"] - c) <= tol * c for g in frames)
            if best is None or n > best[1]:
                best = (c, n)
        wl = best[0]
    keep = [f for f in frames if abs(f["wavelength_um"] - wl) <= tol * wl]
    return wl, sorted(keep, key=lambda f: f["mjd"])


# --------------------------------------------------------------------------
# 5. Common sky grid, centroid, PNG export
# --------------------------------------------------------------------------
def make_grid(center, size_deg):
    n = int(round(size_deg * 3600 / PIXEL_SCALE_ARCSEC))
    n += (n + 1) % 2  # odd size, so the target sits on the central pixel
    w = WCS(naxis=2)
    w.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    w.wcs.crval = [center.ra.deg, center.dec.deg]
    w.wcs.crpix = [(n + 1) / 2, (n + 1) / 2]
    w.wcs.cdelt = [-PIXEL_SCALE_ARCSEC / 3600, PIXEL_SCALE_ARCSEC / 3600]
    return w, (n, n)


def centroid(image, x0, y0, half=3):
    """Centre of the star in a small box around (x0, y0).

    Uses the pixels above half of the peak plus the empty (NaN) pixels that a
    saturated star leaves in its core, without weights, so it also works for
    very bright stars such as Barnard's Star. Returns x, y, flux, saturated;
    flux is None when the star is saturated (brightness cannot be measured).
    """
    ix, iy = int(round(x0)), int(round(y0))
    y1, y2 = max(iy - half, 0), min(iy + half + 1, image.shape[0])
    x1, x2 = max(ix - half, 0), min(ix + half + 1, image.shape[1])
    box = image[y1:y2, x1:x2]
    if box.size == 0 or not np.isfinite(box).any():
        return None
    background = np.nanmedian(image)
    sub = box - background
    saturated = bool(np.isnan(box).any())
    peak = np.nanmax(sub)
    if not np.isfinite(peak) or peak <= 0:
        return None
    mask = np.isnan(box) | (sub > 0.5 * peak)
    yy, xx = np.mgrid[y1:y2, x1:x2]
    if saturated:
        cx, cy = float(xx[mask].mean()), float(yy[mask].mean())
    else:
        w = np.where(mask, sub, 0.0)
        cx, cy = float((w * xx).sum() / w.sum()), float((w * yy).sum() / w.sum())
    flux = None if saturated else float(np.clip(np.nan_to_num(sub), 0, None).sum())
    return cx, cy, flux, saturated


def to_display(img, vmin, vmax, star_xy=None, radius=4, upscale=10):
    """Image ready for the web: asinh stretch, saturated core shown white,
    empty borders black, enlarged with nearest-neighbour pixels."""
    out = np.array(img, dtype=float)
    nan = ~np.isfinite(out)
    if star_xy is not None:
        yy, xx = np.mgrid[0:out.shape[0], 0:out.shape[1]]
        near = (xx - star_xy[0]) ** 2 + (yy - star_xy[1]) ** 2 <= radius ** 2
        out[nan & near] = vmax  # saturated core
    out[~np.isfinite(out)] = vmin  # outside the image
    scaled = np.clip((out - vmin) / (vmax - vmin), 0, 1)
    scaled = np.arcsinh(10 * scaled) / np.arcsinh(10)
    return np.kron(scaled, np.ones((upscale, upscale)))


def main():
    parser = argparse.ArgumentParser(description="SkyShift: SPHEREx frames for one target")
    parser.add_argument("--name", required=True, help="Object name SIMBAD understands")
    parser.add_argument("--slug", required=True, help="Folder name in data/, e.g. barnard")
    parser.add_argument("--band", default="D2", help="SPHEREx detector D1..D6 (default D2)")
    parser.add_argument("--wl", type=float, default=None, help="Wavelength in micrometres (default: automatic)")
    parser.add_argument("--tol", type=float, default=0.02, help="Wavelength tolerance as a fraction (default 0.02)")
    parser.add_argument("--size", type=float, default=0.06, help="Cutout size in degrees (default 0.06)")
    parser.add_argument("--workers", type=int, default=10, help="Parallel downloads (default 10)")
    manual = parser.add_argument_group("manual target values (J2000, skip the online lookup)")
    manual.add_argument("--ra", type=float, help="RA in degrees, epoch J2000")
    manual.add_argument("--dec", type=float, help="Dec in degrees, epoch J2000")
    manual.add_argument("--pmra", type=float, help="Proper motion in RA*cos(Dec), mas/yr")
    manual.add_argument("--pmdec", type=float, help="Proper motion in Dec, mas/yr")
    manual.add_argument("--plx", type=float, default=None, help="Parallax in mas (optional)")
    manual.add_argument("--source", default="manual entry", help="Where the values come from")
    args = parser.parse_args()

    out_dir = Path("data") / args.slug
    out_dir.mkdir(parents=True, exist_ok=True)

    manual_values = None
    if args.ra is not None and args.dec is not None:
        manual_values = (args.ra, args.dec, args.pmra, args.pmdec, args.plx, args.source)

    print(f"1/5 Looking up {args.name}...")
    coord, target_info = resolve_target(args.name, manual_values)
    center = position_at(coord, Time("2025-12-01").mjd)
    print(f"    {target_info['simbad_id']}  pm=({target_info['pmra_mas_yr']}, {target_info['pmdec_mas_yr']}) mas/yr")

    print(f"2/5 Asking IRSA for SPHEREx {args.band} images...")
    table = query_images(center, args.band, args.size)
    print(f"    {len(table)} images found")
    if len(table) == 0:
        raise SystemExit("No SPHEREx images for this position and detector.")

    print(f"3/5 Downloading cutouts ({args.workers} at a time, up to 3 tries each)...")
    t0 = time.time()
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        jobs = [pool.submit(read_cutout, str(r["uri"]), float(r["time_bounds_lower"]), coord) for r in table]
        frames = [j.result() for j in jobs]
    failed = sum(f is None for f in frames)
    frames = [f for f in frames if f is not None]
    print(f"    {len(frames)} ok, {failed} failed, {(time.time() - t0) / 60:.1f} min")
    if not frames:
        raise SystemExit("All downloads failed. Try again in a few minutes.")

    wl, frames = choose_wavelength(frames, args.wl, args.tol)
    print(f"4/5 Keeping {len(frames)} images around {wl:.3f} um (+-{args.tol * 100:.0f}%)")

    grid, shape = make_grid(center, args.size)
    aligned = []
    for f in frames:
        data, _ = reproject_interp((f["image"], f["wcs"]), grid, shape_out=shape)
        aligned.append(data)
    stack = np.array(aligned)
    vmin, vmax = np.nanpercentile(stack, [1, 99.7])

    print("5/5 Writing PNG frames and manifest.json...")
    manifest_frames = []
    for i, (f, img) in enumerate(zip(frames, aligned), start=1):
        name = f"frame_{i:03d}.png"
        predicted = position_at(coord, f["mjd"])
        px, py = grid.world_to_pixel(predicted)
        plt.imsave(out_dir / name, to_display(img, vmin, vmax, (float(px), float(py))),
                   cmap="gray", vmin=0, vmax=1, origin="lower")
        c = centroid(img, float(px), float(py))
        measured = None
        if c is not None:
            m = grid.pixel_to_world(c[0], c[1])
            measured = {"ra_deg": float(m.ra.deg), "dec_deg": float(m.dec.deg),
                        "flux_rel": c[2], "saturated": c[3]}
        manifest_frames.append({
            "file": name,
            "date": Time(f["mjd"], format="mjd").to_value("iso", subfmt="date"),
            "mjd": f["mjd"],
            "wavelength_um": round(f["wavelength_um"], 4),
            "quality_ok": f["flag_value"] == 0,
            "flag_value": f["flag_value"],
            "predicted": {"ra_deg": float(predicted.ra.deg), "dec_deg": float(predicted.dec.deg)},
            "measured": measured,
            "processing_version": f["version"],
            "source_url": f["uri"],
        })

    manifest = {
        "object": args.slug,
        "name": args.name,
        "target": target_info,
        "band": args.band,
        "wavelength_um": round(wl, 4),
        "wavelength_tolerance": args.tol,
        "grid": {
            "center_ra_deg": float(center.ra.deg),
            "center_dec_deg": float(center.dec.deg),
            "pixel_scale_arcsec": PIXEL_SCALE_ARCSEC,
            "width": shape[1],
            "height": shape[0],
            "png_upscale": 10,
            "note": "In the PNG files north is up and east is left; each sky pixel is 10x10 PNG pixels",
        },
        "data_credit": "NASA SPHEREx via NASA/IPAC Infrared Science Archive (IRSA); target data from SIMBAD (CDS)",
        "frames": manifest_frames,
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(f"Done: {len(manifest_frames)} frames in {out_dir}/")


if __name__ == "__main__":
    main()
