#!/usr/bin/env python3
"""Generate ETHGlobal 2026 Agent Economy demo MP4 — continuous English VO + rich visuals."""

from __future__ import annotations

import json
import math
import shutil
import subprocess
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "demo-output"
ASSETS = OUT / "assets"
W, H = 1920, 1080

BG = (5, 11, 9)
PANEL = (16, 28, 22)
PANEL2 = (12, 22, 18)
TEXT = (238, 247, 241)
MUTED = (142, 170, 154)
ACCENT = (62, 207, 142)
ETH = (165, 166, 255)
WARN = (255, 210, 122)
LINE = (40, 58, 48)


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def font(size: int, bold: bool = False):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Helvetica.ttc",
    ]
    for path in candidates:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size=size)
            except Exception:
                continue
    return ImageFont.load_default()


def rounded_rect(draw: ImageDraw.ImageDraw, xy, radius, fill, outline=None, width=2):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def chrome(draw: ImageDraw.ImageDraw):
    draw.rectangle((0, 0, W, 108), fill=(9, 16, 14))
    draw.rectangle((0, H - 100, W, H), fill=(8, 14, 12))
    draw.text((72, 28), "ETHGlobal 2026", fill=ETH, font=font(26, True))
    draw.text((310, 28), "Agent Economy", fill=TEXT, font=font(26, True))
    draw.text((72, 64), "DEMO MODE — NO REAL FUNDS", fill=WARN, font=font(22, True))
    draw.text(
        (72, H - 58),
        "Agent → Agent    ·    Mock USDC    ·    Payment Proof    ·    Service Delivery",
        fill=ACCENT,
        font=font(22),
    )


def base_img() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    # soft vignette-ish side panels
    draw.rectangle((0, 108, 28, H - 100), fill=(8, 14, 12))
    draw.rectangle((W - 28, 108, W, H - 100), fill=(8, 14, 12))
    chrome(draw)
    return img, draw


def wrap_draw(draw, text, xy, max_chars, fill, fnt, line_gap=8):
    x, y = xy
    for line in textwrap.wrap(text, width=max_chars):
        draw.text((x, y), line, fill=fill, font=fnt)
        bbox = draw.textbbox((0, 0), line, font=fnt)
        y += (bbox[3] - bbox[1]) + line_gap
    return y


def chip(draw, x, y, label, active=False):
    f = font(24, True)
    bbox = draw.textbbox((0, 0), label, font=f)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    pad_x, pad_y = 22, 14
    w, h = tw + pad_x * 2, th + pad_y * 2
    rounded_rect(
        draw,
        (x, y, x + w, y + h),
        24,
        fill=ACCENT if active else PANEL,
        outline=ACCENT if active else LINE,
    )
    draw.text((x + pad_x, y + pad_y - 2), label, fill=(4, 20, 12) if active else MUTED, font=f)
    return w + 12


# ---------- Opening visual sequence (under one continuous VO) ----------

def visual_hero(path: Path):
    img, draw = base_img()
    y = wrap_draw(draw, "What is Agent Economy?", (72, 160), 28, TEXT, font(64, True), 10)
    y = wrap_draw(
        draw,
        "An ETHGlobal 2026 demo of autonomous agent-to-agent commerce.",
        (72, y + 16),
        52,
        MUTED,
        font(34),
    )
    # big feature cards
    cards = [
        ("Buyer Agent", "Discovers services\nCompares prices\nPays within policy"),
        ("Seller Agent", "Quotes a price\nVerifies payment\nDelivers the service"),
        ("Trust Layer", "Mock USDC settlement\nSigned payment proof\nNo real funds"),
    ]
    x0 = 72
    for i, (title, body) in enumerate(cards):
        x = x0 + i * 600
        rounded_rect(draw, (x, 430, x + 560, 820), 28, PANEL, LINE)
        draw.text((x + 36, 460), title, fill=ACCENT, font=font(36, True))
        wrap_draw(draw, body, (x + 36, 530), 28, TEXT, font(30), 14)
    img.save(path)


def visual_problem(path: Path):
    img, draw = base_img()
    wrap_draw(draw, "The real problem in the agent economy", (72, 160), 28, TEXT, font(54, True))
    wrap_draw(
        draw,
        "Calling an API is easy. Completing a commercial loop between agents is hard.",
        (72, 280),
        55,
        MUTED,
        font(32),
    )
    items = [
        ("01", "Discover", "Find the right seller agent"),
        ("02", "Agree", "Quote a fair price"),
        ("03", "Govern", "Respect spending limits"),
        ("04", "Prove", "Show payment happened"),
        ("05", "Deliver", "Unlock the service safely"),
    ]
    for i, (num, title, desc) in enumerate(items):
        y = 400 + i * 100
        rounded_rect(draw, (72, y, 1848, y + 88), 20, PANEL2, LINE)
        draw.text((100, y + 24), num, fill=ETH, font=font(28, True))
        draw.text((200, y + 18), title, fill=TEXT, font=font(34, True))
        draw.text((420, y + 24), desc, fill=MUTED, font=font(28))
    img.save(path)


def visual_flow(path: Path):
    img, draw = base_img()
    wrap_draw(draw, "The full commercial loop", (72, 160), 30, TEXT, font(56, True))
    wrap_draw(
        draw,
        "One click from a human. Agents execute every step after that.",
        (72, 270),
        55,
        MUTED,
        font(32),
    )
    steps = ["Discover", "Compare", "Quote", "Policy", "Pay", "Proof", "Deliver"]
    x, y = 72, 420
    for i, label in enumerate(steps):
        w = chip(draw, x, y, label, active=True)
        x += w
        if i < len(steps) - 1:
            draw.text((x, y + 18), "→", fill=MUTED, font=font(30, True))
            x += 48
        if x > 1700:
            x = 72
            y += 100

    # two agent panels connected
    rounded_rect(draw, (72, 620, 860, 900), 28, PANEL, ACCENT)
    draw.text((110, 660), "Research Agent", fill=TEXT, font=font(36, True))
    draw.text((110, 720), "BUYER", fill=ACCENT, font=font(24, True))
    draw.text((110, 770), "Balance  10.00 USDC", fill=MUTED, font=font(28))
    draw.text((110, 820), "Policy-aware purchasing", fill=MUTED, font=font(28))

    draw.text((920, 740), "⟶   mock USDC + proof   ⟶", fill=ETH, font=font(28, True))

    rounded_rect(draw, (1060, 620, 1848, 900), 28, PANEL, ACCENT)
    draw.text((1100, 660), "Weather Data Agent", fill=TEXT, font=font(36, True))
    draw.text((1100, 720), "SELLER", fill=ACCENT, font=font(24, True))
    draw.text((1100, 770), "Quote · Verify · Deliver", fill=MUTED, font=font(28))
    draw.text((1100, 820), "Service unlocked after proof", fill=MUTED, font=font(28))
    img.save(path)


def visual_loop_detail(path: Path):
    img, draw = base_img()
    wrap_draw(draw, "What the Buyer Agent does", (72, 150), 30, TEXT, font(54, True))
    cards = [
        ("Find sellers", "Public discovery of agent\ncapabilities and prices"),
        ("Pick best offer", "Deterministic decision\nengine selects cheapest"),
        ("Check policy", "Max tx · daily limit ·\nallowed token"),
        ("Pay & prove", "Simulated USDC + signed\npayment proof"),
        ("Receive result", "Service delivered only\nafter verification"),
    ]
    for i, (title, body) in enumerate(cards):
        col = i % 3
        row = i // 3
        x = 72 + col * 600
        y = 300 + row * 320
        rounded_rect(draw, (x, y, x + 560, y + 280), 28, PANEL, LINE)
        draw.ellipse((x + 36, y + 36, x + 76, y + 76), fill=ACCENT)
        draw.text((x + 48, y + 42), str(i + 1), fill=(4, 20, 12), font=font(24, True))
        draw.text((x + 100, y + 42), title, fill=TEXT, font=font(32, True))
        wrap_draw(draw, body, (x + 36, y + 120), 28, MUTED, font(28), 10)
    img.save(path)


def visual_demo_honesty(path: Path):
    img, draw = base_img()
    wrap_draw(draw, "Demo mode — crystal clear", (72, 160), 28, TEXT, font(56, True))
    wrap_draw(
        draw,
        "We keep the architecture honest so judges can focus on the agent payment design.",
        (72, 270),
        55,
        MUTED,
        font(30),
    )
    cards = [
        ("Mock wallets", "Balances are app state only"),
        ("Simulated USDC", "No banks · no mainnet"),
        ("0xmock hashes", "Deterministic demo IDs"),
        ("No private keys", "Nothing custodial here"),
        ("No paid AI API", "Rules-based decisions"),
        ("Upgrade path", "Swap in real rails later"),
    ]
    for i, (t, d) in enumerate(cards):
        col, row = i % 3, i // 3
        x, y = 72 + col * 600, 400 + row * 260
        rounded_rect(draw, (x, y, x + 560, y + 220), 28, PANEL, WARN if i < 2 else LINE)
        draw.text((x + 36, y + 40), t, fill=WARN if i < 2 else ACCENT, font=font(34, True))
        wrap_draw(draw, d, (x + 36, y + 110), 28, TEXT, font(28))
    img.save(path)


OPENING = {
    "id": "01_open",
    "voice": (
        "Let's start with what this project actually is. "
        "Agent Economy is an ETH Global twenty twenty-six hackathon demo of autonomous agent-to-agent commerce. "
        "In the agent economy, software agents will buy and sell digital services from each other — "
        "data, compute, research, and more. "
        "The hard problem is not simply calling an API. "
        "It is letting one agent discover another, agree on a price, respect spending limits, "
        "prove that payment happened, and only then unlock delivery — "
        "without a human coordinating every step in the middle. "
        "That is exactly what this system demonstrates, end to end. "
        "A Buyer Agent finds Seller Agents, compares offers, requests a quote, "
        "checks its own spending policy, executes a simulated USDC payment, "
        "generates a verifiable payment proof, and receives the service result. "
        "You press start once. The agents complete the commercial loop. "
        "And before we go further: this is demo mode. "
        "No real funds move, there is no custody, and there is no mainnet settlement — "
        "so we can focus clearly on the trust and payment architecture between agents."
    ),
    "visuals": [
        ("hero", visual_hero, 0.18),
        ("problem", visual_problem, 0.20),
        ("flow", visual_flow, 0.22),
        ("loop", visual_loop_detail, 0.22),
        ("honesty", visual_demo_honesty, 0.18),
    ],
}

# Remaining story beats (single visual each)
REST = [
    {
        "id": "02_actors",
        "title": "The agents in this demo",
        "subtitle": "A buyer with policy, sellers with prices",
        "layout": "actors",
        "voice": (
            "Now meet the cast. "
            "Our Buyer is Research Agent, starting with ten USDC and a strict spending policy: "
            "one USDC maximum per transaction, five USDC daily, and USDC only. "
            "On the supply side, three Weather Data Agents offer the same capability at different prices — "
            "ten cents, fifteen cents, and twenty cents. "
            "That price spread is intentional, so you can see autonomous selection in action."
        ),
    },
    {
        "id": "03_decision",
        "title": "Autonomous discovery & selection",
        "subtitle": "Request: weather data for Dubai",
        "layout": "decision",
        "voice": (
            "The buyer’s goal is simple: get weather data for Dubai. "
            "It discovers every seller advertising weather data, compares their prices, "
            "and selects the cheapest valid provider — Weather Data Agent A at ten cents USDC. "
            "This decision engine is deterministic on purpose, so the live demo stays stable for judges — "
            "no external model key, no randomness in the critical path."
        ),
    },
    {
        "id": "04_policy",
        "title": "Quote issued · Policy APPROVED",
        "subtitle": "Commercial agreement, then guardrails",
        "layout": "policy",
        "voice": (
            "With a provider chosen, the seller issues a quote: one hundred units for ten cents USDC. "
            "Before any value moves, the buyer evaluates its spending policy — "
            "is the amount under the per-transaction cap, inside the daily limit, and in the allowed token? "
            "All three pass, so the policy status is approved, and payment may proceed."
        ),
    },
    {
        "id": "05_payment",
        "title": "Simulated USDC settlement + proof",
        "subtitle": "Live path through the Agent Economy backend",
        "layout": "payment",
        "voice": (
            "Next, the system runs the autonomous transaction against the live backend. "
            "Simulated USDC is debited from the buyer and credited to the seller — "
            "ten dollars becomes nine ninety on the buyer side, and the seller receives ten cents. "
            "A mock transaction hash is recorded, and a signed payment proof is generated "
            "so the seller does not have to trust a bare notification."
        ),
    },
    {
        "id": "06_verify_deliver",
        "title": "Verify proof → deliver service",
        "subtitle": "No delivery without verification",
        "layout": "deliver",
        "voice": (
            "The seller now verifies the proof: payment must exist, the amount and currency must match, "
            "the receiver must be correct, and the signature must be valid. "
            "Only after Payment Verified does delivery unlock. "
            "In this demo, the seller returns mock weather for Dubai — thirty-one degrees and sunny — "
            "and the buyer receives the result, completing the commercial loop."
        ),
    },
    {
        "id": "07_close",
        "title": "AUTONOMOUS TRANSACTION COMPLETE",
        "subtitle": "ETHGlobal 2026 — Agent Economy",
        "layout": "close",
        "voice": (
            "So, to close for ETH Global: "
            "Agent Economy shows a Buyer Agent discovering a Seller Agent, agreeing on price, "
            "obeying spending policy, settling with simulated USDC, proving payment, and receiving a service — "
            "with no human coordinating the middle. "
            "It is a hackathon demonstration, not production finance. "
            "Thank you."
        ),
    },
]


def draw_rest_slide(scene: dict, path: Path):
    img, draw = base_img()
    layout = scene["layout"]
    wrap_draw(draw, scene["title"], (72, 150), 28, TEXT, font(52, True))
    wrap_draw(draw, scene["subtitle"], (72, 280), 55, MUTED, font(30))

    if layout == "actors":
        rounded_rect(draw, (72, 380, 920, 900), 28, PANEL, ACCENT)
        draw.text((110, 420), "Research Agent", fill=TEXT, font=font(40, True))
        draw.text((110, 480), "BUYER", fill=ACCENT, font=font(24, True))
        draw.text((110, 560), "10.00 USDC", fill=TEXT, font=font(48, True))
        draw.text((110, 640), "Max tx 1.00 · Daily 5.00", fill=MUTED, font=font(28))
        draw.text((110, 700), "Allowed token: USDC", fill=MUTED, font=font(28))
        draw.text((110, 780), "Policy-aware purchasing", fill=MUTED, font=font(28))

        for i, (name, price, sel) in enumerate(
            [("Agent A", "0.10", True), ("Agent B", "0.15", False), ("Agent C", "0.20", False)]
        ):
            y = 380 + i * 175
            rounded_rect(draw, (1000, y, 1848, y + 155), 24, PANEL, ACCENT if sel else LINE)
            draw.text((1040, y + 30), f"Weather Data {name}", fill=TEXT, font=font(32, True))
            draw.text((1040, y + 85), f"{price} USDC", fill=ACCENT if sel else MUTED, font=font(36, True))

    elif layout == "decision":
        for i, (name, price, sel) in enumerate(
            [("A · selected", "0.10", True), ("B", "0.15", False), ("C", "0.20", False)]
        ):
            x = 72 + i * 600
            rounded_rect(draw, (x, 400, x + 560, 820), 28, PANEL, ACCENT if sel else LINE)
            draw.text((x + 40, 450), f"Weather Agent {name}", fill=TEXT, font=font(32, True))
            draw.text((x + 40, 560), f"{price} USDC", fill=ACCENT if sel else MUTED, font=font(56, True))
            draw.text((x + 40, 680), "capability: weather-data", fill=MUTED, font=font(26))

    elif layout == "policy":
        rounded_rect(draw, (72, 400, 920, 880), 28, PANEL, ACCENT)
        draw.text((110, 450), "Seller quote", fill=TEXT, font=font(36, True))
        draw.text((110, 540), "0.10 USDC", fill=ACCENT, font=font(64, True))
        draw.text((110, 650), "100 units · 300s TTL", fill=MUTED, font=font(28))
        rounded_rect(draw, (1000, 400, 1848, 880), 28, PANEL, ACCENT)
        draw.text((1040, 450), "Spending policy", fill=TEXT, font=font(36, True))
        for i, t in enumerate(["amount ≤ maxTransaction", "daily budget OK", "token == USDC"]):
            draw.text((1040, 540 + i * 70), f"✓  {t}", fill=ACCENT, font=font(30))
        draw.text((1040, 780), "APPROVED", fill=ACCENT, font=font(48, True))

    elif layout == "payment":
        rounded_rect(draw, (72, 400, 920, 880), 28, PANEL, LINE)
        draw.text((110, 450), "Buyer wallet", fill=TEXT, font=font(34, True))
        draw.text((110, 540), "10.00  →  9.90 USDC", fill=ACCENT, font=font(40, True))
        draw.text((110, 640), "Seller wallet", fill=TEXT, font=font(34, True))
        draw.text((110, 720), "0.00  →  0.10 USDC", fill=ACCENT, font=font(40, True))
        rounded_rect(draw, (1000, 400, 1848, 880), 28, PANEL, ETH)
        draw.text((1040, 450), "Payment proof", fill=TEXT, font=font(34, True))
        draw.text((1040, 540), "Status: VERIFIED", fill=ACCENT, font=font(36, True))
        draw.text((1040, 620), "TX: 0xmock_…", fill=MUTED, font=font(30))
        draw.text((1040, 700), "Signed JWT proof", fill=MUTED, font=font(30))
        draw.text((1040, 780), "No real funds moved", fill=WARN, font=font(28, True))

    elif layout == "deliver":
        rounded_rect(draw, (72, 400, 900, 880), 28, PANEL, ACCENT)
        draw.text((110, 450), "Payment Verified ✓", fill=ACCENT, font=font(40, True))
        for i, t in enumerate(["payment exists", "amount matches", "receiver correct", "signature valid"]):
            draw.text((110, 540 + i * 70), f"✓  {t}", fill=TEXT, font=font(30))
        rounded_rect(draw, (980, 400, 1848, 880), 28, PANEL, LINE)
        draw.text((1020, 450), "Service result", fill=TEXT, font=font(34, True))
        code = '{\n  "city": "Dubai",\n  "temperature": 31,\n  "condition": "Sunny"\n}'
        draw.text((1020, 540), code, fill=MUTED, font=font(30))

    else:  # close
        wrap_draw(
            draw,
            "Agents traded end-to-end with verifiable mock settlement.",
            (72, 420),
            40,
            TEXT,
            font(40, True),
        )
        x = 72
        for label in ["ETHGlobal 2026", "Mock USDC only", "No custody", "Demo complete"]:
            x += chip(draw, x, 620, label, active=True)

    img.save(path)


def synthesize(uid: str, text: str) -> Path:
    aiff = ASSETS / f"{uid}.aiff"
    wav = ASSETS / f"{uid}.wav"
    run(["say", "-v", "Samantha", "-r", "158", "-o", str(aiff), text])
    run(["ffmpeg", "-y", "-i", str(aiff), str(wav)])
    return wav


def audio_duration(wav: Path) -> float:
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(wav)],
        text=True,
    )
    return float(json.loads(out)["format"]["duration"])


def video_from_image(png: Path, seconds: float, out: Path) -> Path:
    run(
        [
            "ffmpeg",
            "-y",
            "-loop",
            "1",
            "-i",
            str(png),
            "-c:v",
            "libx264",
            "-t",
            f"{seconds:.3f}",
            "-pix_fmt",
            "yuv420p",
            "-vf",
            "fade=t=in:st=0:d=0.35,fade=t=out:st={0}:d=0.35".format(max(0.1, seconds - 0.35)),
            str(out),
        ]
    )
    return out


def mux(video: Path, audio: Path, out: Path, seconds: float) -> Path:
    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(video),
            "-i",
            str(audio),
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-shortest",
            "-t",
            f"{seconds:.3f}",
            str(out),
        ]
    )
    return out


def concat(segments: list[Path], final: Path) -> Path:
    lst = ASSETS / "concat.txt"
    lst.write_text("".join(f"file '{p.resolve()}'\n" for p in segments))
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(final)])
    return final


def build_opening() -> Path:
    print("Rendering opening (continuous VO + visual sequence)…")
    wav = synthesize("01_open", OPENING["voice"])
    speech = audio_duration(wav)
    total = speech + 0.8

    silent_parts: list[Path] = []
    for name, fn, weight in OPENING["visuals"]:
        png = ASSETS / f"01_{name}.png"
        fn(png)
        sec = total * weight
        part = ASSETS / f"01_{name}_v.mp4"
        video_from_image(png, sec, part)
        silent_parts.append(part)

    silent = ASSETS / "01_open_silent.mp4"
    concat(silent_parts, silent)

    padded = ASSETS / "01_open_pad.wav"
    pad = max(0.4, total - speech)
    run(["ffmpeg", "-y", "-i", str(wav), "-af", f"apad=pad_dur={pad:.3f}", "-t", f"{total:.3f}", str(padded)])

    out = ASSETS / "01_open.mp4"
    mux(silent, padded, out, total)
    return out


def build_rest_scene(scene: dict) -> Path:
    print(f"Rendering {scene['id']}…")
    png = ASSETS / f"{scene['id']}.png"
    draw_rest_slide(scene, png)
    wav = synthesize(scene["id"], scene["voice"])
    speech = audio_duration(wav)
    total = speech + 0.7
    vid = ASSETS / f"{scene['id']}_v.mp4"
    video_from_image(png, total, vid)
    padded = ASSETS / f"{scene['id']}_pad.wav"
    pad = max(0.35, total - speech)
    run(["ffmpeg", "-y", "-i", str(wav), "-af", f"apad=pad_dur={pad:.3f}", "-t", f"{total:.3f}", str(padded)])
    out = ASSETS / f"{scene['id']}.mp4"
    mux(vid, padded, out, total)
    return out


def main() -> None:
    if ASSETS.exists():
        shutil.rmtree(ASSETS)
    ASSETS.mkdir(parents=True)

    segments = [build_opening()]
    for scene in REST:
        segments.append(build_rest_scene(scene))

    final = OUT / "Agent-Economy-ETHGlobal-2026-Demo.mp4"
    concat(segments, final)
    probe = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(final)],
        text=True,
    )
    seconds = float(json.loads(probe)["format"]["duration"])
    print(f"\nDONE: {final}")
    print(f"Duration: {seconds:.1f}s ({seconds/60:.2f} min)")
    print(f"Size: {final.stat().st_size / (1024 * 1024):.1f} MB")


if __name__ == "__main__":
    main()
