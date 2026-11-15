#!/usr/bin/env python3
"""Bundle the NERVE RUNNER web port into single HTML files.
  dist/nerve_runner.html  - artifact body (no doctype/html/head/body wrapper)
  index.html              - standalone page (open locally or host anywhere)
Content JSON is embedded from the Unity project's Resources folder (single source of truth)."""
import json, pathlib
W = pathlib.Path(__file__).resolve().parent
RES = W.parent / "NerveRunner/Assets/NerveRunner/Resources/NerveRunner"
q, cx, st = [], [], {}
for i in range(1, 10):
    q += json.loads((RES / f"questions_ch{i}.json").read_text(encoding="utf-8"))["questions"]
    cx += json.loads((RES / f"codex_ch{i}.json").read_text(encoding="utf-8"))["entries"]
    for b in json.loads((RES / f"story_ch{i}.json").read_text(encoding="utf-8"))["beats"]:
        st[b["id"]] = b["lines"]
content = json.dumps({"questions": q, "codex": cx, "story": st}, ensure_ascii=False, separators=(",", ":"))
src = lambda n: (W / "src" / n).read_text(encoding="utf-8")
THREE = "https://cdn.jsdelivr.net/npm/three@0.160.0/"
head = f"""<title>NERVE RUNNER</title>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#0B0A24">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Jua&display=swap" rel="stylesheet">
<style>
{src("style.css")}
</style>"""
body = f"""{src("body.html")}
<script>window.NR_CONTENT={content.replace("</", "<\\/")};</script>
<script>
{src("core.js")}
</script>
<script>
{src("star.js")}
</script>
<script>
{src("fx.js")}
</script>
<script>
{src("world.js")}
</script>
<script>
{src("app.js")}
</script>
<script type="importmap">{{"imports":{{"three":"{THREE}build/three.module.js","three/addons/":"{THREE}examples/jsm/"}}}}</script>
<script type="module">
import * as THREE from "three";
import {{ EffectComposer }} from "three/addons/postprocessing/EffectComposer.js";
import {{ RenderPass }} from "three/addons/postprocessing/RenderPass.js";
import {{ UnrealBloomPass }} from "three/addons/postprocessing/UnrealBloomPass.js";
import {{ OutputPass }} from "three/addons/postprocessing/OutputPass.js";
window.THREE = THREE;
window.THREE_PP = {{ EffectComposer, RenderPass, UnrealBloomPass, OutputPass }};
window.NRW_INIT();
window.NR_MAIN();
</script>
<script>setTimeout(function(){{if(!window.THREE){{var l=document.getElementById("loading");if(l)l.textContent="3D 엔진을 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.";}}}},15000);</script>"""
(W / "dist").mkdir(exist_ok=True)
(W / "dist/nerve_runner.html").write_text(head + "\n" + body, encoding="utf-8")
(W / "index.html").write_text(f"<!doctype html>\n<html lang=\"ko\">\n<head>\n{head}\n</head>\n<body>\n{body}\n</body>\n</html>\n", encoding="utf-8")
print("questions", len(q), "codex", len(cx), "story beats", len(st), "bytes", (W / "index.html").stat().st_size)
