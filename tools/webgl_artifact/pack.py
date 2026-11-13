"""Pack a Unity WebGL build (Gzip + decompression fallback) for the claude.ai artifact host.
The host serves text files only, so the gzip'd wasm/data are shipped as base64 text parts and
index.html decodes + gunzips them in the browser (DecompressionStream, iPadOS 16.4+).
usage: python3 pack.py <Builds/WebGL> <outdir>   (then update PARTS in index.html if part counts change)"""
import base64, gzip, os, shutil, sys
src, out = sys.argv[1], sys.argv[2]
B = os.path.join(src, "Build"); os.makedirs(os.path.join(out, "Build"), exist_ok=True)
shutil.copy(os.path.join(B, "WebGL.loader.js"), os.path.join(out, "Build"))
open(os.path.join(out, "Build/framework.js"), "wb").write(gzip.decompress(open(os.path.join(B, "WebGL.framework.js.unityweb"), "rb").read()))
CH = 6_000_000
for name, f in (("code", "WebGL.wasm.unityweb"), ("data", "WebGL.data.unityweb")):
    s = base64.b64encode(open(os.path.join(B, f), "rb").read()).decode()
    parts = [s[i:i + CH] for i in range(0, len(s), CH)]
    for i, p in enumerate(parts): open(os.path.join(out, f"Build/{name}_{i}.txt"), "w").write(p)
    print(name, len(parts), "parts")
shutil.copy(os.path.join(os.path.dirname(__file__), "index.html"), out)
