"""
Media fetcher using yt-dlp for URL-based audio/video download.
Supports YouTube, direct audio/video URLs, and 500+ other sites.
"""
import asyncio
import logging
import tempfile
from pathlib import Path
from typing import Tuple

logger = logging.getLogger(__name__)


def _download_sync(url: str, opts: dict) -> None:
    """Run yt-dlp download synchronously (called in thread pool)."""
    import yt_dlp
    with yt_dlp.YoutubeDL(opts) as ydl:
        ydl.download([url])


async def fetch_audio_from_url(url: str) -> Tuple[Path, str]:
    """
    Download audio from URL using yt-dlp.

    Supports YouTube, direct audio/video links, and 500+ sites.
    Returns (temp_file_path, file_extension).
    The caller is responsible for cleaning up the temp file and directory.
    """
    tmp_dir = Path(tempfile.mkdtemp(prefix="bacon-url-"))
    output_template = str(tmp_dir / "%(id)s.%(ext)s")

    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": output_template,
        "quiet": True,
        "no_warnings": True,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "128",
            }
        ],
    }

    loop = asyncio.get_event_loop()
    try:
        await loop.run_in_executor(None, _download_sync, url, ydl_opts)
    except Exception as e:
        logger.error("yt-dlp download failed for %s: %s", url, e)
        raise ValueError(f"Failed to download from URL: {e}") from e

    # Find the output file (yt-dlp may rename it)
    files = [f for f in tmp_dir.iterdir() if f.is_file()]
    if not files:
        raise ValueError("yt-dlp produced no output file")

    output_file = files[0]
    ext = output_file.suffix.lstrip(".")
    return output_file, ext
