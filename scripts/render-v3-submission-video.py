#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SUBMISSION = ROOT / "submission"
GENERATED = SUBMISSION / "generated"
DEFAULT_NARRATION = SUBMISSION / "video-narration.json"


def run(*args: str) -> None:
    subprocess.run(args, check=True)


def duration(path: Path) -> float:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(result.stdout.strip())


def timestamp(seconds: float) -> str:
    milliseconds = round(seconds * 1000)
    hours, milliseconds = divmod(milliseconds, 3_600_000)
    minutes, milliseconds = divmod(milliseconds, 60_000)
    secs, milliseconds = divmod(milliseconds, 1000)
    return f"{hours:02}:{minutes:02}:{secs:02},{milliseconds:03}"


def chunks(text: str, maximum_words: int = 10) -> list[str]:
    words = text.split()
    result: list[str] = []
    while words:
        take = min(maximum_words, len(words))
        if len(words) > maximum_words and take > 5:
            for index in range(take - 1, 4, -1):
                if words[index - 1].endswith((".", ",", ";", ":")):
                    take = index
                    break
        result.append(" ".join(words[:take]))
        words = words[take:]
    return result


def prepare_audio(narration_path: Path) -> None:
    GENERATED.mkdir(parents=True, exist_ok=True)
    data = json.loads(narration_path.read_text())
    manifest = {"scenes": []}
    for scene in data["scenes"]:
        aiff = GENERATED / f"{scene['id']}.aiff"
        wav = GENERATED / f"{scene['id']}.wav"
        run(
            "say",
            "-v",
            data.get("voice", "Samantha"),
            "-r",
            str(data.get("rate", 175)),
            "-o",
            str(aiff),
            scene["narration"],
        )
        run(
            "ffmpeg",
            "-y",
            "-i",
            str(aiff),
            "-ar",
            "48000",
            "-ac",
            "2",
            str(wav),
        )
        audio_seconds = duration(wav)
        manifest["scenes"].append(
            {
                **scene,
                "audioPath": str(wav),
                "audioSeconds": audio_seconds,
                "renderSeconds": max(
                    float(scene["minimumSeconds"]), math.ceil(audio_seconds + 1.0)
                ),
            }
        )
    (GENERATED / "audio-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n"
    )


def prepare_neural_audio(narration_path: Path, audio_dir: Path) -> None:
    GENERATED.mkdir(parents=True, exist_ok=True)
    data = json.loads(narration_path.read_text())
    voice = data.get("voice", "cedar")
    manifest = {"scenes": []}
    for scene in data["scenes"]:
        wav = audio_dir / f"{voice}-{scene['id']}.wav"
        if not wav.is_file():
            raise FileNotFoundError(f"Missing generated narration: {wav}")
        audio_seconds = duration(wav)
        manifest["scenes"].append(
            {
                **scene,
                "audioPath": str(wav.resolve()),
                "audioSeconds": audio_seconds,
                "renderSeconds": max(
                    float(scene["minimumSeconds"]), math.ceil(audio_seconds + 1.0)
                ),
            }
        )
    (GENERATED / "audio-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n"
    )


def assemble(output: Path) -> None:
    from PIL import Image, ImageDraw, ImageFont

    data = json.loads((GENERATED / "audio-manifest.json").read_text())
    capture = json.loads((GENERATED / "capture-manifest.json").read_text())
    timing_by_id = {scene["id"]: scene for scene in capture["sceneTimings"]}
    video_path = Path(capture["videoPath"])
    video_seconds = duration(video_path)

    srt_lines: list[str] = []
    subtitle_index = 1
    inputs: list[str] = ["-i", str(video_path)]
    filters: list[str] = []
    audio_labels: list[str] = []
    captions: list[dict[str, float | str]] = []
    for index, scene in enumerate(data["scenes"], start=1):
        inputs.extend(["-i", scene["audioPath"]])
        start_seconds = timing_by_id[scene["id"]]["startMs"] / 1000
        delay = round(start_seconds * 1000)
        label = f"a{index}"
        filters.append(f"[{index}:a]adelay={delay}|{delay}[{label}]")
        audio_labels.append(f"[{label}]")

        caption_chunks = chunks(scene["narration"])
        word_counts = [len(chunk.split()) for chunk in caption_chunks]
        total_words = sum(word_counts)
        cursor = start_seconds
        for chunk, word_count in zip(caption_chunks, word_counts, strict=True):
            chunk_seconds = scene["audioSeconds"] * word_count / total_words
            srt_lines.extend(
                [
                    str(subtitle_index),
                    f"{timestamp(cursor)} --> {timestamp(cursor + chunk_seconds)}",
                    chunk,
                    "",
                ]
            )
            captions.append(
                {
                    "end": cursor + chunk_seconds,
                    "start": cursor,
                    "text": chunk,
                }
            )
            cursor += chunk_seconds
            subtitle_index += 1

    filters.append(
        f"anullsrc=r=48000:cl=stereo:d={video_seconds:.3f}[silence]"
    )
    filters.append(
        "[silence]"
        + "".join(audio_labels)
        + f"amix=inputs={len(audio_labels) + 1}:duration=longest:normalize=0,"
        + "loudnorm=I=-16:TP=-1.5:LRA=11[aout]"
    )
    srt = GENERATED / "serendipity-demo.srt"
    srt.write_text("\n".join(srt_lines))

    font_path = Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf")
    font = ImageFont.truetype(str(font_path), 44)
    disclosure_font = ImageFont.truetype(str(font_path), 22)
    for index, caption in enumerate(captions):
        canvas = Image.new("RGBA", (1920, 200), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        words = str(caption["text"]).split()
        lines: list[str] = []
        current = ""
        for word in words:
            candidate = f"{current} {word}".strip()
            if draw.textbbox((0, 0), candidate, font=font)[2] > 1550 and current:
                lines.append(current)
                current = word
            else:
                current = candidate
        if current:
            lines.append(current)
        lines = lines[:2]
        line_height = 54
        block_height = len(lines) * line_height + 30
        top = (200 - block_height) // 2
        widths = [draw.textbbox((0, 0), line, font=font)[2] for line in lines]
        box_width = min(1740, max(widths) + 72)
        left = (1920 - box_width) // 2
        draw.rounded_rectangle(
            (left, top, left + box_width, top + block_height),
            radius=20,
            fill=(17, 17, 17, 235),
            outline=(255, 255, 255, 235),
            width=2,
        )
        for line_index, (line, width) in enumerate(zip(lines, widths, strict=True)):
            draw.text(
                ((1920 - width) / 2, top + 13 + line_index * line_height),
                line,
                font=font,
                fill=(255, 255, 255, 255),
            )
        if float(caption["start"]) < 8:
            disclosure = "AI-generated narration"
            disclosure_box = draw.textbbox(
                (0, 0), disclosure, font=disclosure_font
            )
            disclosure_width = disclosure_box[2] - disclosure_box[0]
            draw.rounded_rectangle(
                (56, 158, 84 + disclosure_width, 194),
                radius=10,
                fill=(17, 17, 17, 220),
            )
            draw.text(
                (70, 163),
                disclosure,
                font=disclosure_font,
                fill=(255, 255, 255, 255),
            )
        image_path = GENERATED / f"caption-{index + 1:03}.png"
        canvas.save(image_path)

    transparent = GENERATED / "caption-transparent.png"
    Image.new("RGBA", (1920, 200), (0, 0, 0, 0)).save(transparent)
    timeline: list[tuple[Path, float]] = []
    timeline_cursor = 0.0
    for index, caption in enumerate(captions):
        start = float(caption["start"])
        end = float(caption["end"])
        if start > timeline_cursor:
            timeline.append((transparent, start - timeline_cursor))
        timeline.append((GENERATED / f"caption-{index + 1:03}.png", end - start))
        timeline_cursor = end
    if video_seconds > timeline_cursor:
        timeline.append((transparent, video_seconds - timeline_cursor))
    concat_lines = ["ffconcat version 1.0"]
    for image_path, image_seconds in timeline:
        concat_lines.append(f"file '{image_path}'")
        concat_lines.append(f"duration {image_seconds:.6f}")
    concat_lines.append(f"file '{timeline[-1][0]}'")
    caption_concat = GENERATED / "caption-timeline.ffconcat"
    caption_concat.write_text("\n".join(concat_lines) + "\n")
    caption_video = GENERATED / "caption-overlay.mov"
    run(
        "ffmpeg",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(caption_concat),
        "-vf",
        "fps=30",
        "-c:v",
        "qtrle",
        "-pix_fmt",
        "argb",
        str(caption_video),
    )
    inputs.extend(["-i", str(caption_video)])
    caption_input_index = 1 + len(data["scenes"])
    filters.append(f"[0:v][{caption_input_index}:v]overlay=0:760[vout]")

    output.parent.mkdir(parents=True, exist_ok=True)
    run(
        "ffmpeg",
        "-y",
        *inputs,
        "-filter_complex",
        ";".join(filters),
        "-map",
        "[vout]",
        "-map",
        "[aout]",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "20",
        "-pix_fmt",
        "yuv420p",
        "-r",
        "30",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-ar",
        "48000",
        "-movflags",
        "+faststart",
        "-t",
        f"{video_seconds:.3f}",
        str(output),
    )
    print(output)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "command", choices=["prepare-audio", "prepare-neural-audio", "assemble"]
    )
    parser.add_argument("--narration", type=Path, default=DEFAULT_NARRATION)
    parser.add_argument("--audio-dir", type=Path)
    parser.add_argument(
        "--output", type=Path, default=SUBMISSION / "serendipity-demo.mp4"
    )
    args = parser.parse_args()
    if args.command == "prepare-audio":
        prepare_audio(args.narration)
    elif args.command == "prepare-neural-audio":
        if args.audio_dir is None:
            parser.error("--audio-dir is required for prepare-neural-audio")
        prepare_neural_audio(args.narration, args.audio_dir)
    else:
        assemble(args.output)


if __name__ == "__main__":
    main()
