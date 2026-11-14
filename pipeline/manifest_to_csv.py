"""
SkyShift: export the measurements in data/<object>/manifest.json to CSV files,
so the science team can open them in a spreadsheet or in Python.

Usage (from the repository root):
    python pipeline/manifest_to_csv.py

Writes science/csv/<object>.csv (one per object) and science/csv/all_objects.csv.

Columns:
    object, date, mjd, wavelength_um, quality_ok, flags,
    predicted_ra_deg, predicted_dec_deg      position expected from the catalogue proper motion
    measured_ra_deg, measured_dec_deg        position measured in the SPHEREx image
    offset_ra_arcsec, offset_dec_arcsec      measured minus predicted (RA multiplied by cos Dec)
    shift_ra_arcsec, shift_dec_arcsec        measured position relative to the first frame (RA multiplied by cos Dec)
    flux_rel, saturated                      relative brightness (empty when the star saturates)
    file, source_url

Written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team.
See AI_USAGE.md. License: MIT.
"""
import csv
import json
import math
from pathlib import Path

DATA = Path("data")
OUT = Path("science") / "csv"

COLUMNS = [
    "object", "date", "mjd", "wavelength_um", "quality_ok", "flags",
    "predicted_ra_deg", "predicted_dec_deg", "measured_ra_deg", "measured_dec_deg",
    "offset_ra_arcsec", "offset_dec_arcsec", "shift_ra_arcsec", "shift_dec_arcsec",
    "flux_rel", "saturated", "file", "source_url",
]


def rows_for(manifest):
    rows = []
    first = None
    for f in manifest["frames"]:
        p = f.get("predicted") or {}
        m = f.get("measured") or {}
        row = {
            "object": manifest.get("object"),
            "date": f.get("date"),
            "mjd": f.get("mjd"),
            "wavelength_um": f.get("wavelength_um"),
            "quality_ok": f.get("quality_ok"),
            "flags": " ".join(f.get("flags", [])),
            "predicted_ra_deg": p.get("ra_deg"),
            "predicted_dec_deg": p.get("dec_deg"),
            "measured_ra_deg": m.get("ra_deg"),
            "measured_dec_deg": m.get("dec_deg"),
            "flux_rel": m.get("flux_rel"),
            "saturated": m.get("saturated"),
            "file": f.get("file"),
            "source_url": f.get("source_url"),
        }
        if m.get("ra_deg") is not None:
            cosd = math.cos(math.radians(m["dec_deg"]))
            if p.get("ra_deg") is not None:
                row["offset_ra_arcsec"] = round((m["ra_deg"] - p["ra_deg"]) * 3600 * cosd, 3)
                row["offset_dec_arcsec"] = round((m["dec_deg"] - p["dec_deg"]) * 3600, 3)
            if first is None:
                first = m
            row["shift_ra_arcsec"] = round((m["ra_deg"] - first["ra_deg"]) * 3600 * cosd, 3)
            row["shift_dec_arcsec"] = round((m["dec_deg"] - first["dec_deg"]) * 3600, 3)
        rows.append(row)
    return rows


def write(path, rows):
    with open(path, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(rows)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    everything = []
    for manifest_path in sorted(DATA.glob("*/manifest.json")):
        manifest = json.loads(manifest_path.read_text())
        rows = rows_for(manifest)
        write(OUT / f"{manifest_path.parent.name}.csv", rows)
        everything += rows
        print(f"{manifest_path.parent.name}: {len(rows)} rows")
    write(OUT / "all_objects.csv", everything)
    print(f"Done: {len(everything)} rows in {OUT}/")


if __name__ == "__main__":
    main()
