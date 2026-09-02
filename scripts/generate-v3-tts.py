#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SCRIPT = ROOT / "submission" / "video-narration-v2.json"


def synthesize(*, api_key: str, model: str, voice: str, instructions: str, text: str) -> bytes:
    payload = json.dumps(
        {
            "model": model,
            "voice": voice,
            "input": text,
            "instructions": instructions,
            "response_format": "wav",
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        "https://api.openai.com/v1/audio/speech",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            return response.read()
    except urllib.error.HTTPError as error:
        public_message = error.read().decode("utf-8", errors="replace")[:1000]
        raise RuntimeError(f"Speech generation failed ({error.code}): {public_message}") from error


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--script", type=Path, default=DEFAULT_SCRIPT)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--voices", nargs="+", default=["cedar"])
    parser.add_argument("--scenes", nargs="+")
    args = parser.parse_args()

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise SystemExit("OPENAI_API_KEY is required")

    data = json.loads(args.script.read_text(encoding="utf-8"))
    requested_scenes = set(args.scenes or [scene["id"] for scene in data["scenes"]])
    scenes = [scene for scene in data["scenes"] if scene["id"] in requested_scenes]
    missing = requested_scenes - {scene["id"] for scene in scenes}
    if missing:
        raise SystemExit(f"Unknown scene IDs: {', '.join(sorted(missing))}")

    args.output.mkdir(parents=True, exist_ok=True)
    manifest = {"model": data["model"], "files": []}
    for voice in args.voices:
        for scene in scenes:
            audio = synthesize(
                api_key=api_key,
                model=data["model"],
                voice=voice,
                instructions=data["voiceInstructions"],
                text=scene["narration"],
            )
            output_path = args.output / f"{voice}-{scene['id']}.wav"
            output_path.write_bytes(audio)
            manifest["files"].append(
                {"voice": voice, "scene": scene["id"], "path": output_path.name}
            )
            print(f"Generated {output_path.name}")

    (args.output / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
