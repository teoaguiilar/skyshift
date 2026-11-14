"""
SkyShift: quick-look plots of how each object changes with time.

  motion.png      position against time: where SPHEREx measures the object
                  (dots) and where the catalogue proper motion says it should be
                  (line), in arcseconds from its first position, for RA and Dec.
  lightcurve.png  relative brightness against time (only if not saturated).

Reads data/<object>/manifest.json and writes the plots in the same folder.

Usage (from the repository root):
    python pipeline/plot_time.py                 # all objects in data/
    python pipeline/plot_time.py barnard         # just one

Written with help from Claude (Anthropic), reviewed by the SkyShift Murcia team.
See AI_USAGE.md. License: MIT.
"""
import json
import math
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.dates as mdates  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402
from astropy.time import Time  # noqa: E402

DATA = Path("data")
MOVERS = {"barnard", "eps-indi-b", "wise-0855-stacked"}  # objects whose motion we show
SKIP = {"wise-0855"}  # too faint in single images: use wise-0855-stacked


def usable(frame):
    m = frame.get("measured")
    return m is not None and frame.get("detected", True)


def plot_motion(manifest, out):
    frames = [f for f in manifest["frames"] if usable(f)]
    if len(frames) < 2:
        return False
    ref = frames[0]["predicted"]
    cosd = math.cos(math.radians(ref["dec_deg"]))

    def offsets(pos):
        return ((pos["ra_deg"] - ref["ra_deg"]) * 3600 * cosd, (pos["dec_deg"] - ref["dec_deg"]) * 3600)

    dates = [Time(f["mjd"], format="mjd").datetime for f in frames]
    meas = [offsets(f["measured"]) for f in frames]
    pred = [offsets(f["predicted"]) for f in frames]

    fig, axes = plt.subplots(2, 1, figsize=(8, 5.5), dpi=120, sharex=True)
    for k, (ax, label) in enumerate(zip(axes, ["RA × cos(Dec)", "Dec"])):
        ax.plot(dates, [p[k] for p in pred], "-", color="C1", lw=2, label="catalogue proper motion")
        ax.plot(dates, [m[k] for m in meas], "o", color="C0", ms=6, label="measured with SPHEREx")
        ax.set_ylabel(f"{label} (arcsec)")
        ax.grid(alpha=0.3)
    axes[0].legend(frameon=False, fontsize=9)
    axes[1].xaxis.set_major_formatter(mdates.DateFormatter("%b %Y"))
    pixel = "1 SPHEREx pixel = 6.15 arcsec"
    axes[0].set_title(f"{manifest['name']}: position against time (SkyShift)\n{pixel}", fontsize=11)
    fig.tight_layout()
    fig.savefig(out)
    plt.close(fig)
    return True


def plot_lightcurve(manifest, out):
    frames = [f for f in manifest["frames"] if usable(f) and f["measured"].get("flux_rel") is not None]
    if len(frames) < 2:
        return False
    dates = [Time(f["mjd"], format="mjd").datetime for f in frames]
    flux = [f["measured"]["flux_rel"] for f in frames]
    fig, ax = plt.subplots(figsize=(8, 4), dpi=120)
    # Points only: SPHEREx visits are months apart, so we do not know what happens in between.
    ax.plot(dates, flux, "o", color="C0", ms=6)
    ax.set_ylabel("Relative brightness")
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b %Y"))
    ax.grid(alpha=0.3)
    wl = manifest.get("wavelength_um")
    ax.set_title(f"{manifest['name']}: brightness against time (SkyShift)\n"
                 f"SPHEREx, about {wl} microns · candidate variability · no line: visits are months apart", fontsize=11)
    fig.tight_layout()
    fig.savefig(out)
    plt.close(fig)
    return True


def main():
    names = sys.argv[1:] or [p.name for p in sorted(DATA.iterdir()) if (p / "manifest.json").exists()]
    for name in names:
        if name in SKIP:
            print(f"{name}: skipped (too faint in single images)")
            continue
        manifest = json.loads((DATA / name / "manifest.json").read_text())
        done = []
        if name in MOVERS and plot_motion(manifest, DATA / name / "motion.png"):
            done.append("motion.png")
        if name not in MOVERS and plot_lightcurve(manifest, DATA / name / "lightcurve.png"):
            done.append("lightcurve.png")
        print(f"{name}: {', '.join(done) if done else 'nothing to plot (saturated or not detected)'}")


if __name__ == "__main__":
    main()
