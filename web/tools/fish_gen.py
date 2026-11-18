# Generates assets/voice/<key>.mp3 for tools/voice_lines.json with fish.audio (model header s2.1-pro-free).
# The API key is injected by the session proxy; re-running skips clips that already exist.
import json, os, subprocess, sys, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
W = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOICE = os.environ.get("FISH_VOICE", "46939387dd944a45a399bd92b8de52cb")   # "20대 여지_내돈내산 쇼츠" (public library voice)
MODEL = os.environ.get("FISH_MODEL", "s2.1-pro-free")
OUT = os.path.join(W, "assets", "voice"); RAW = os.path.join(W, "..", ".voice_raw"); os.makedirs(OUT, exist_ok=True); os.makedirs(RAW, exist_ok=True)
lines = json.load(open(os.path.join(W, "tools", "voice_lines.json"), encoding="utf-8"))
def one(x):
    dst = os.path.join(OUT, x["key"] + ".mp3")
    if os.path.exists(dst): return "skip"
    raw = os.path.join(RAW, x["key"] + ".mp3")
    for attempt in range(6):
        try:
            req = urllib.request.Request("https://api.fish.audio/v1/tts", method="POST", data=json.dumps({"text": x["text"], "reference_id": VOICE, "format": "mp3", "latency": "normal"}).encode(), headers={"Content-Type": "application/json", "model": MODEL, "Authorization": "Bearer proxy-injected"})
            with urllib.request.urlopen(req, timeout=120) as r: open(raw, "wb").write(r.read())
            break
        except urllib.error.HTTPError as e:
            body = e.read()[:200]
            if e.code in (429, 500, 502, 503, 504): time.sleep(5 * (attempt + 1)); continue
            return f"HTTP {e.code} {body!r}"
        except Exception as e: time.sleep(5 * (attempt + 1))
    else: return "gave up"
    # trim leading/trailing silence, even loudness, small mono voice mp3
    r = subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", raw, "-af", "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm=I=-16:TP=-1.5:LRA=11", "-ac", "1", "-ar", "24000", "-b:a", "40k", dst], capture_output=True)
    return "ok" if r.returncode == 0 else "ffmpeg " + r.stderr.decode()[:120]
done = 0; bad = []
with ThreadPoolExecutor(3) as ex:
    for x, res in zip(lines, ex.map(one, lines)):
        done += 1
        if res not in ("ok", "skip"): bad.append((x["key"], x["text"][:30], res)); print("FAIL", x["key"], res, flush=True)
        if done % 25 == 0: print(f"{done}/{len(lines)}", flush=True)
print("done", done, "failed", len(bad)); json.dump(bad, open(os.path.join(RAW, "failed.json"), "w"), ensure_ascii=False)
