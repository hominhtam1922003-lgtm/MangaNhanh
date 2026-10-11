"""
Backend tự phụ đề tiếng Trung cho ShortVideo.

Luồng: tải video (link trực tiếp) -> ffmpeg tách âm thanh 16kHz mono -> faster-whisper
nhận dạng tiếng Trung (có timestamp) -> (tuỳ chọn) dịch sang tiếng Việt qua LibreTranslate
-> lưu cache JSON. Frontend hỏi trạng thái job bằng GET /api/subtitles/{id}.

Chạy:  uvicorn main:app --host 127.0.0.1 --port 8787
Biến môi trường:
  WHISPER_MODEL   tiny | base | small | medium | large-v3   (mặc định: small)
  WHISPER_DEVICE  cpu | cuda                                 (mặc định: cpu)
  WHISPER_COMPUTE int8 | float16 | int8_float16               (mặc định: int8)
  LIBRETRANSLATE_URL      vd: http://127.0.0.1:5000  (bỏ trống = không dịch)
  LIBRETRANSLATE_API_KEY  (tuỳ chọn)
  SV_CACHE        thư mục cache (mặc định ./cache)
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import tempfile
import threading
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

CACHE = Path(os.environ.get("SV_CACHE", Path(__file__).parent / "cache"))
CACHE.mkdir(parents=True, exist_ok=True)
MODEL_NAME = os.environ.get("WHISPER_MODEL", "small")
DEVICE = os.environ.get("WHISPER_DEVICE", "cpu")
COMPUTE = os.environ.get("WHISPER_COMPUTE", "int8")
LT_URL = os.environ.get("LIBRETRANSLATE_URL", "").rstrip("/")
LT_KEY = os.environ.get("LIBRETRANSLATE_API_KEY", "")
PEXELS_KEY = os.environ.get("PEXELS_API_KEY", "")  # miễn phí tại https://www.pexels.com/api/
MAX_BYTES = int(os.environ.get("SV_MAX_BYTES", str(1024 * 1024 * 1024)))  # 1 GB

app = FastAPI(title="ShortVideo subtitle service")
jobs: dict[str, dict] = {}
lock = threading.Lock()
_model = None
_model_lock = threading.Lock()


class SubtitleRequest(BaseModel):
    url: str
    translate: bool = True


def get_model():
    global _model
    with _model_lock:
        if _model is None:
            from faster_whisper import WhisperModel  # import lười để server khởi động nhanh

            _model = WhisperModel(MODEL_NAME, device=DEVICE, compute_type=COMPUTE)
    return _model


def job_id_for(url: str, translate: bool) -> str:
    raw = f"{url}|{translate}|{MODEL_NAME}|{LT_URL if translate else ''}"
    return hashlib.sha1(raw.encode()).hexdigest()[:24]


def cache_file(jid: str) -> Path:
    return CACHE / f"{jid}.json"


def set_job(jid: str, **kw):
    with lock:
        jobs[jid].update(kw)


def translate_cues(cues: list[dict]) -> None:
    """Dịch từng câu zh -> vi bằng LibreTranslate. Lỗi thì giữ nguyên, không làm hỏng job."""
    with httpx.Client(timeout=30) as client:
        for c in cues:
            payload = {"q": c["zh"], "source": "zh", "target": "vi", "format": "text"}
            if LT_KEY:
                payload["api_key"] = LT_KEY
            try:
                r = client.post(f"{LT_URL}/translate", json=payload)
                r.raise_for_status()
                c["vi"] = r.json()["translatedText"]
            except Exception:
                pass


def run_job(jid: str, url: str, translate: bool) -> None:
    try:
        with tempfile.TemporaryDirectory() as td:
            video = Path(td) / "video.bin"
            wav = Path(td) / "audio.wav"

            set_job(jid, status="running", message="Đang tải video")
            total = 0
            with httpx.stream("GET", url, follow_redirects=True, timeout=120) as r:
                r.raise_for_status()
                with open(video, "wb") as f:
                    for chunk in r.iter_bytes(1 << 20):
                        total += len(chunk)
                        if total > MAX_BYTES:
                            raise RuntimeError("Video vượt quá giới hạn dung lượng")
                        f.write(chunk)

            set_job(jid, message="Đang tách âm thanh")
            subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error", "-i", str(video),
                 "-vn", "-ac", "1", "-ar", "16000", str(wav)],
                check=True,
            )

            set_job(jid, message="Đang nhận dạng tiếng Trung")
            segments, _info = get_model().transcribe(
                str(wav), language="zh", vad_filter=True, beam_size=5
            )
            cues = [
                {"start": round(s.start, 3), "end": round(s.end, 3), "zh": s.text.strip()}
                for s in segments
                if s.text.strip()
            ]

            if translate and LT_URL and cues:
                set_job(jid, message="Đang dịch sang tiếng Việt")
                translate_cues(cues)

        cache_file(jid).write_text(json.dumps(cues, ensure_ascii=False), encoding="utf-8")
        set_job(jid, status="done", message="Xong", cues=cues)
    except FileNotFoundError as e:
        set_job(jid, status="error", message=f"Thiếu công cụ hệ thống: {e.filename}. Cần cài ffmpeg.")
    except Exception as e:  # noqa: BLE001 - trả lỗi cho UI
        set_job(jid, status="error", message=str(e)[:300] or e.__class__.__name__)


@app.get("/api/health")
def health():
    return {"ok": True, "model": MODEL_NAME, "translate": bool(LT_URL)}


@app.post("/api/subtitles")
def create_job(req: SubtitleRequest):
    if not req.url.startswith(("http://", "https://")):
        raise HTTPException(400, "url phải là link http(s) trực tiếp tới file video")
    jid = job_id_for(req.url, req.translate)

    cf = cache_file(jid)
    if cf.exists():
        cues = json.loads(cf.read_text(encoding="utf-8"))
        return {"id": jid, "status": "done", "message": "Lấy từ cache", "cues": cues}

    with lock:
        existing = jobs.get(jid)
        if existing and existing["status"] in ("queued", "running"):
            return {"id": jid, "status": existing["status"], "message": existing.get("message", "")}
        jobs[jid] = {"status": "queued", "message": "Đang xếp hàng"}

    threading.Thread(target=run_job, args=(jid, req.url, req.translate), daemon=True).start()
    return {"id": jid, "status": "queued", "message": "Đang xếp hàng"}


@app.get("/api/subtitles/{jid}")
def job_status(jid: str):
    cf = cache_file(jid)
    if cf.exists():
        return {"id": jid, "status": "done", "message": "Xong",
                "cues": json.loads(cf.read_text(encoding="utf-8"))}
    with lock:
        j = jobs.get(jid)
        if not j:
            raise HTTPException(404, "Không tìm thấy job")
        return {"id": jid, **{k: v for k, v in j.items() if k != "cues"}}


@app.get("/api/search")
def search_videos(q: str, limit: int = 12):
    """Tìm video dọc miễn phí trên Pexels (giấy phép Pexels: dùng miễn phí, có thể ghi công)."""
    if not PEXELS_KEY:
        raise HTTPException(503, "Chưa cấu hình PEXELS_API_KEY ở backend (đăng ký miễn phí tại pexels.com/api)")
    q = q.strip()[:100]
    if not q:
        raise HTTPException(400, "Thiếu từ khoá")
    try:
        r = httpx.get(
            "https://api.pexels.com/videos/search",
            params={"query": q, "per_page": max(1, min(limit, 30)), "orientation": "portrait"},
            headers={"Authorization": PEXELS_KEY},
            timeout=20,
        )
        r.raise_for_status()
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Pexels lỗi: {e}")
    out = []
    for v in r.json().get("videos", []):
        files = [f for f in v.get("video_files", []) if f.get("file_type") == "video/mp4" and f.get("link")]
        if not files:
            continue
        # chọn độ phân giải cao nhất nhưng không quá 1280px chiều cao (đỡ nặng trên điện thoại)
        files.sort(key=lambda f: f.get("height") or 0)
        small = [f for f in files if (f.get("height") or 0) <= 1280] or files
        best = small[-1]
        author = (v.get("user") or {}).get("name", "Pexels")
        out.append({
            "id": f"pexels-{v['id']}",
            "title": f"{q} · {author}",
            "url": best["link"],
            "thumb": v.get("image"),
            "tags": ["Pexels", q],
            "credit": f"Video: {author} trên Pexels",
        })
    return {"items": out}


GOOGLE_CSE_KEY = os.environ.get("GOOGLE_CSE_KEY", "")  # Google Programmable Search API key
GOOGLE_CSE_CX = os.environ.get("GOOGLE_CSE_CX", "")    # Search engine ID (cx)


@app.get("/api/web-search")
def web_search(q: str, start: int = 1):
    """Tìm web qua Google Programmable Search (API chính thức). Cần GOOGLE_CSE_KEY + GOOGLE_CSE_CX."""
    if not (GOOGLE_CSE_KEY and GOOGLE_CSE_CX):
        raise HTTPException(503, "Chưa cấu hình GOOGLE_CSE_KEY / GOOGLE_CSE_CX ở backend")
    q = q.strip()[:200]
    if not q:
        raise HTTPException(400, "Thiếu từ khoá")
    try:
        r = httpx.get(
            "https://www.googleapis.com/customsearch/v1",
            params={"key": GOOGLE_CSE_KEY, "cx": GOOGLE_CSE_CX, "q": q,
                    "num": 10, "start": max(1, min(start, 91))},
            timeout=20,
        )
        r.raise_for_status()
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Google Search lỗi: {e}")
    out = []
    for it in r.json().get("items", []):
        pm = it.get("pagemap") or {}
        thumb = next(iter(pm.get("cse_thumbnail", [])), {}).get("src") or \
            next(iter(pm.get("cse_image", [])), {}).get("src")
        out.append({
            "id": "web-" + hashlib.sha1(it["link"].encode()).hexdigest()[:12],
            "title": it.get("title", ""),
            "url": it["link"],
            "snippet": it.get("snippet", ""),
            "thumb": thumb,
            "host": it.get("displayLink", ""),
        })
    return {"items": out}
