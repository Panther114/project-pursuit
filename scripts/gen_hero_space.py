"""Generate a restrained dark starfield loop for the landing wallpaper."""
from __future__ import annotations

import os
import random
import shutil
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "hero-space.mp4")
W, H = 1920, 1080
FPS = 24
SECONDS = 16
N = FPS * SECONDS
random.seed(7)


def main() -> None:
    out_mp4 = os.path.abspath(OUT)
    os.makedirs(os.path.dirname(out_mp4), exist_ok=True)

    stars: list[tuple[float, float, float, int]] = []
    for _ in range(420):
        stars.append(
            (
                random.random() * W,
                random.random() * H,
                random.uniform(0.35, 1.0),
                random.choice([1, 1, 1, 2, 2, 3]),
            )
        )
    for _ in range(28):
        stars.append(
            (
                random.random() * W,
                random.random() * H,
                random.uniform(0.75, 1.0),
                random.choice([2, 3]),
            )
        )

    neb = Image.new("RGB", (W, H), (4, 4, 7))
    blobs = [
        (int(W * 0.72), int(H * 0.32), 520, (18, 16, 28, 40)),
        (int(W * 0.55), int(H * 0.48), 380, (12, 14, 24, 32)),
        (int(W * 0.78), int(H * 0.55), 300, (16, 12, 22, 28)),
        (int(W * 0.35), int(H * 0.7), 260, (10, 12, 20, 22)),
    ]
    for cx, cy, r, col in blobs:
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        for i in range(8, 0, -1):
            rr = int(r * i / 8)
            a = int(col[3] * (i / 8) * 0.45)
            ld.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), fill=(col[0], col[1], col[2], a))
        layer = layer.filter(ImageFilter.GaussianBlur(radius=48))
        neb = Image.alpha_composite(neb.convert("RGBA"), layer).convert("RGB")
    neb = ImageEnhance.Brightness(neb).enhance(0.85)
    neb = ImageEnhance.Contrast(neb).enhance(1.05)

    tmpdir = tempfile.mkdtemp(prefix="hero_space_")
    print("frames dir", tmpdir)

    for fi in range(N):
        dx = (fi / N) * 28
        dy = (fi / N) * 12
        frame = neb.copy()
        draw = ImageDraw.Draw(frame)
        for x, y, b, s in stars:
            px = (x + dx * (0.4 + b * 0.6)) % W
            py = (y + dy * (0.3 + b * 0.5)) % H
            v = int(28 + b * 95)
            if s <= 1:
                draw.point((px, py), fill=(v, v, int(v * 0.98)))
            else:
                r = s - 1
                col = (v, v, int(v * 0.97))
                draw.ellipse((px - r, py - r, px + r, py + r), fill=col)
                if s >= 3 and b > 0.85:
                    hv = int(v * 0.35)
                    draw.ellipse((px - r - 1, py - r - 1, px + r + 1, py + r + 1), outline=(hv, hv, hv))

        vig = Image.new("L", (W, H), 0)
        vd = ImageDraw.Draw(vig)
        vd.ellipse((-W * 0.15, -H * 0.2, W * 1.15, H * 1.2), fill=255)
        vig = vig.filter(ImageFilter.GaussianBlur(90))
        dark = Image.new("RGB", (W, H), (2, 2, 4))
        frame = Image.composite(frame, dark, vig)
        frame = ImageEnhance.Brightness(frame).enhance(0.88)
        frame.save(os.path.join(tmpdir, f"f{fi:04d}.png"), optimize=True)
        if fi % 24 == 0:
            print("frame", fi)

    cmd = [
        "ffmpeg",
        "-y",
        "-framerate",
        str(FPS),
        "-i",
        os.path.join(tmpdir, "f%04d.png"),
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-crf",
        "22",
        "-preset",
        "medium",
        "-movflags",
        "+faststart",
        "-an",
        out_mp4,
    ]
    print("encoding...")
    subprocess.check_call(cmd)
    shutil.rmtree(tmpdir, ignore_errors=True)
    print("wrote", out_mp4, os.path.getsize(out_mp4))


if __name__ == "__main__":
    main()
