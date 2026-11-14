// NERVE RUNNER - STAR-01, the player character: a cute, glowing, puffy yellow five-pointed
// star (no car, no kart, no humanoid). Built from a procedural mesh + primitives; animation is
// plain Transform maths (hover bob, lean, drift yaw, jump flip, boost wobble, expressions).
//
// 2.0 upgrade (visual only - the RunnerSim movement is untouched, and the original lean / drift
// yaw / jump flip / bob values are kept exactly):
//   * cartoon two-tone + rim-light body shader (NRMats.Toon, falls back to URP/Lit)
//   * surface-hugging expression shapes: ^ ^ joy, > < crash, sparkle eyes, brows, tear, mouths
//   * 9 expressions incl. Correct / Wrong, readable from the chase camera
//   * squash & stretch (jump, landing, hit), acceleration lean, hit flash + shake, victory dance
//   * StarFx: halo, contact shadow, electric trails, lightning, drift sparks, bursts
using System.Collections.Generic;
using NeonRacer;
using UnityEngine;

namespace NerveRunner
{
    public enum Expression { Normal, Focus, Joy, Surprise, Hurt, Heal, Clear, Correct, Wrong }

    public class StarVisual : MonoBehaviour
    {
        public static readonly Color StarYellow = Pal.Hex(0xFFD34D);
        const float BODY_SCALE = 1.25f;                 // 1.0: 1.15 - a little bigger on screen

        Transform body, face, orbit, orbit2;
        Transform eyeL, eyeR, hiL, hiR, hi2L, hi2R, cheekL, cheekR;
        // decal expression parts
        GameObject happyL, happyR, closedL, closedR, crossL, crossR, sparkL, sparkR, tear;
        GameObject browL, browR, mouthSmile, mouthOpen, mouthTongue, mouthO, mouthFlat, mouthWave;
        Mesh browNeutralL, browNeutralR, browAngryL, browAngryR, browSadL, browSadR, browUpL, browUpR;
        MeshFilter browLF, browRF;
        Light glow;
        Material bodyMat, bodyBoostMat, bodyFlashMat;
        MeshRenderer bodyRenderer;
        StarFx fx;

        Expression expr = Expression.Normal, baseExpr = Expression.Focus;
        float exprTimer, blinkTimer = 2f, blinkT;
        float spin, spinVel;      // jump flip / showcase spin (degrees)
        float t;
        // squash & stretch spring (positive = tall/stretched, negative = squashed)
        float squash, squashVel;
        float flashT, shakeT, accelLean, lastSpeed01 = -1f;
        bool wasGrounded = true, victory;

        public Expression Current { get { return expr; } }
        public StarFx Fx { get { return fx; } }

        public static StarVisual Create(Transform parent, Color? tint = null)
        {
            var go = new GameObject("STAR-01");
            go.transform.SetParent(parent, false);
            var sv = go.AddComponent<StarVisual>();
            sv.Build(tint ?? StarYellow);
            return sv;
        }

        void Build(Color col)
        {
            body = new GameObject("Body").transform;
            body.SetParent(transform, false);
            body.localScale = Vector3.one * BODY_SCALE;

            // warm two-tone yellow, peach shade, soft cream rim (concept: "jelly star")
            bodyMat = NRMats.Toon(col, Pal.Hex(0xF29B38), Pal.Hex(0xFFF3C4), 2.4f, col * 0.18f);
            bodyBoostMat = NRMats.Toon(Color.Lerp(col, Color.white, 0.25f), Pal.Hex(0xFFB24A), Pal.Hex(0xB8F6FF), 1.8f, col * 0.55f);
            bodyFlashMat = NRMats.Toon(Color.white, Pal.Hex(0xFFD0D8), Color.white, 1.5f, Color.white * 0.6f);
            var star = MeshKit.MeshObject(body, "StarMesh", MeshKit.PuffyStar(1f, StarFace.R_IN, StarFace.THICK, 140, 12), bodyMat);
            bodyRenderer = star.GetComponent<MeshRenderer>();

            BuildFace();

            // ---- back: glowing nerve "veins" from the centre to each tip (3-view sheet, back) ----
            var veinMat = Mats.Emissive(Pal.Cyan, Pal.Cyan * 1.4f);
            for (int i = 0; i < 5; i++)
            {
                float a = Mathf.PI * 0.5f + i * Mathf.PI * 2f / 5f;
                Vector3 dir = new Vector3(Mathf.Cos(a), Mathf.Sin(a), 0f);
                for (int k = 1; k <= 5; k++)
                {
                    float f = 0.13f * k;
                    float z = -StarFace.THICK * Mathf.Sqrt(Mathf.Max(0f, 1f - Mathf.Pow(f, 2.4f))) - 0.008f;
                    var v = MeshKit.Prim(PrimitiveType.Cube, body, dir * f + new Vector3(0f, 0f, z), new Vector3(0.035f, 0.13f, 0.025f), veinMat, "Vein");
                    v.transform.localRotation = Quaternion.Euler(0f, 0f, a * Mathf.Rad2Deg - 90f);
                }
            }

            // ---- energy rings: main ring with three pearls + a thin counter-rotating ring ----
            orbit = new GameObject("Orbit").transform;
            orbit.SetParent(transform, false);
            orbit.localRotation = Quaternion.Euler(104f, 0f, -10f);   // near edge dips BELOW the mouth (2.0 preview fix)
            orbit.localPosition = new Vector3(0f, -0.5f, 0f);
            var ringMat = Mats.Emissive(Pal.Hex(0xC9A8FF), Pal.Hex(0xB98CFF) * 1.4f);
            MeshKit.MeshObject(orbit, "Ring", MeshKit.Torus(1.75f, 0.035f, 56, 6), ringMat);
            var pearlMat = NRMats.Toon(Pal.Hex(0xFFF0B0), Pal.Hex(0xFFC24A), Color.white, 2f, Pal.Hex(0xFFD34D) * 0.8f);
            for (int i = 0; i < 3; i++)
            {
                float a = i * Mathf.PI * 2f / 3f;
                MeshKit.Prim(PrimitiveType.Sphere, orbit, new Vector3(Mathf.Cos(a), Mathf.Sin(a), 0f) * 1.75f, Vector3.one * 0.18f, pearlMat, "Pearl");
            }
            orbit2 = new GameObject("Orbit2").transform;
            orbit2.SetParent(transform, false);
            orbit2.localRotation = Quaternion.Euler(114f, -20f, 15f);
            orbit2.localPosition = new Vector3(0f, -0.4f, 0f);
            MeshKit.MeshObject(orbit2, "ThinRing", MeshKit.Torus(1.95f, 0.012f, 56, 4), Mats.Emissive(Pal.Cyan * 0.5f, Pal.Cyan * 1.2f));

            // ---- light ----
            var lg = new GameObject("Glow");
            lg.transform.SetParent(transform, false);
            glow = lg.AddComponent<Light>();
            glow.type = LightType.Point; glow.color = col; glow.range = 9f; glow.intensity = 2.2f;
            glow.shadows = LightShadows.None;
            glow.enabled = Gfx.Level != GfxLevel.Low;   // PERF: per-object light off on Low

            // ---- effects (trail, halo, shadow, sparks...) ----
            var fxGo = new GameObject("StarFx");
            fxGo.transform.SetParent(transform, false);
            fx = fxGo.AddComponent<StarFx>();
            fx.Build(transform, col);

            SetExpression(Expression.Normal, 0f);
            ApplyFace(1f);
        }

        //================== FACE ==================\\
        static readonly Vector2 EyeLC = new Vector2(-0.25f, 0.16f), EyeRC = new Vector2(0.25f, 0.16f);

        GameObject Decal(string name, Mesh m, Material mat)
        {
            var g = MeshKit.MeshObject(face, name, m, mat);
            return g;
        }

        void BuildFace()
        {
            face = new GameObject("Face").transform;
            face.SetParent(body, false);
            var eyeMat = Mats.Lit(Pal.Hex(0x1A1033), 0.1f, 0.9f);
            var lineMat = Mats.Lit(Pal.Hex(0x2A1640), 0.05f, 0.5f);
            var whiteMat = Mats.Emissive(Color.white, Color.white * 0.9f);
            var cheekMat = NRMats.Toon(Pal.Hex(0xFF9CC0), Pal.Hex(0xFF6FA0), Pal.Hex(0xFFD6E6), 3f, Pal.Hex(0xFF5C9A) * 0.25f);
            var mouthMat = Mats.Lit(Pal.Hex(0x7A1838), 0.05f, 0.6f);
            var tongueMat = Mats.Emissive(Pal.Hex(0xFF7A9C), Pal.Hex(0xFF5C80) * 0.3f);
            var sparkMat = Mats.Emissive(Color.white, Pal.Hex(0xFFF4B0) * 1.6f);
            var tearMat = Mats.Emissive(Pal.Hex(0x9EE6FF), Pal.Hex(0x5CC8FF) * 0.9f);

            float Z(Vector2 p) { return StarFace.SurfaceZ(p.x, p.y); }

            // open eyes: glossy flattened spheres + two highlights (classic cartoon eye)
            eyeL = MeshKit.Prim(PrimitiveType.Sphere, face, new Vector3(EyeLC.x, EyeLC.y, Z(EyeLC)), Vector3.one, eyeMat, "EyeL").transform;
            eyeR = MeshKit.Prim(PrimitiveType.Sphere, face, new Vector3(EyeRC.x, EyeRC.y, Z(EyeRC)), Vector3.one, eyeMat, "EyeR").transform;
            hiL = MeshKit.Prim(PrimitiveType.Sphere, face, Vector3.zero, Vector3.one * 0.07f, whiteMat, "HiL").transform;
            hiR = MeshKit.Prim(PrimitiveType.Sphere, face, Vector3.zero, Vector3.one * 0.07f, whiteMat, "HiR").transform;
            hi2L = MeshKit.Prim(PrimitiveType.Sphere, face, Vector3.zero, Vector3.one * 0.035f, whiteMat, "Hi2L").transform;
            hi2R = MeshKit.Prim(PrimitiveType.Sphere, face, Vector3.zero, Vector3.one * 0.035f, whiteMat, "Hi2R").transform;
            cheekL = MeshKit.Prim(PrimitiveType.Sphere, face, new Vector3(-0.44f, -0.1f, Z(new Vector2(-0.44f, -0.1f)) - 0.02f), new Vector3(0.2f, 0.11f, 0.05f), cheekMat, "CheekL").transform;
            cheekR = MeshKit.Prim(PrimitiveType.Sphere, face, new Vector3(0.44f, -0.1f, Z(new Vector2(0.44f, -0.1f)) - 0.02f), new Vector3(0.2f, 0.11f, 0.05f), cheekMat, "CheekR").transform;

            // decal eyes
            happyL = Decal("HappyL", StarFace.Stroke(StarFace.Arc(EyeLC + new Vector2(0f, -0.04f), 0.11f, 0.1f, 20f, 160f), 0.05f), lineMat);
            happyR = Decal("HappyR", StarFace.Stroke(StarFace.Arc(EyeRC + new Vector2(0f, -0.04f), 0.11f, 0.1f, 20f, 160f), 0.05f), lineMat);
            closedL = Decal("ClosedL", StarFace.Stroke(StarFace.Arc(EyeLC + new Vector2(0f, 0.05f), 0.1f, 0.07f, 200f, 340f), 0.045f), lineMat);
            closedR = Decal("ClosedR", StarFace.Stroke(StarFace.Arc(EyeRC + new Vector2(0f, 0.05f), 0.1f, 0.07f, 200f, 340f), 0.045f), lineMat);
            crossL = Decal("CrashL", StarFace.Stroke(StarFace.Line(EyeLC + new Vector2(-0.08f, 0.08f), EyeLC + new Vector2(0.07f, 0f), EyeLC + new Vector2(-0.08f, -0.08f)), 0.05f), lineMat);
            crossR = Decal("CrashR", StarFace.Stroke(StarFace.Line(EyeRC + new Vector2(0.08f, 0.08f), EyeRC + new Vector2(-0.07f, 0f), EyeRC + new Vector2(0.08f, -0.08f)), 0.05f), lineMat);
            sparkL = Decal("SparkL", StarFace.Fill(StarFace.Twinkle(EyeLC + new Vector2(0.025f, 0.035f), 0.085f, 0.026f), 0.07f), sparkMat);
            sparkR = Decal("SparkR", StarFace.Fill(StarFace.Twinkle(EyeRC + new Vector2(0.025f, 0.035f), 0.085f, 0.026f), 0.07f), sparkMat);
            tear = Decal("Tear", StarFace.Fill(StarFace.Tear(EyeLC + new Vector2(-0.07f, -0.12f), 0.05f), 0.02f), tearMat);

            // brows (several angles, swapped per expression)
            browNeutralL = StarFace.Stroke(StarFace.Arc(EyeLC + new Vector2(0f, 0.12f), 0.09f, 0.03f, 30f, 150f), 0.035f);
            browNeutralR = StarFace.Stroke(StarFace.Arc(EyeRC + new Vector2(0f, 0.12f), 0.09f, 0.03f, 30f, 150f), 0.035f);
            browUpL = StarFace.Stroke(StarFace.Arc(EyeLC + new Vector2(0f, 0.2f), 0.09f, 0.04f, 30f, 150f), 0.035f);
            browUpR = StarFace.Stroke(StarFace.Arc(EyeRC + new Vector2(0f, 0.2f), 0.09f, 0.04f, 30f, 150f), 0.035f);
            // determined: inner ends DOWN
            browAngryL = StarFace.Stroke(StarFace.Line(EyeLC + new Vector2(-0.1f, 0.2f), EyeLC + new Vector2(0.09f, 0.13f)), 0.04f);
            browAngryR = StarFace.Stroke(StarFace.Line(EyeRC + new Vector2(0.1f, 0.2f), EyeRC + new Vector2(-0.09f, 0.13f)), 0.04f);
            // worried: inner ends UP
            browSadL = StarFace.Stroke(StarFace.Line(EyeLC + new Vector2(-0.1f, 0.14f), EyeLC + new Vector2(0.09f, 0.2f)), 0.035f);
            browSadR = StarFace.Stroke(StarFace.Line(EyeRC + new Vector2(0.1f, 0.14f), EyeRC + new Vector2(-0.09f, 0.2f)), 0.035f);
            browL = Decal("BrowL", browNeutralL, lineMat); browLF = browL.GetComponent<MeshFilter>();
            browR = Decal("BrowR", browNeutralR, lineMat); browRF = browR.GetComponent<MeshFilter>();

            // mouths
            Vector2 mc = new Vector2(0f, -0.13f);
            mouthSmile = Decal("MouthSmile", StarFace.Stroke(StarFace.Arc(mc + new Vector2(0f, 0.04f), 0.085f, 0.07f, 200f, 340f), 0.04f), lineMat);
            mouthOpen = Decal("MouthOpen", StarFace.Fill(StarFace.OpenMouth(mc + new Vector2(0f, 0.02f), 0.12f, 0.12f), 0.012f), mouthMat);
            mouthTongue = Decal("Tongue", StarFace.Fill(StarFace.Circle(mc + new Vector2(0f, -0.065f), 0.06f, 0.03f), 0.02f), tongueMat);
            mouthO = Decal("MouthO", StarFace.Fill(StarFace.Circle(mc, 0.05f, 0.06f), 0.012f), mouthMat);
            mouthFlat = Decal("MouthFlat", StarFace.Stroke(StarFace.Line(mc + new Vector2(-0.06f, 0f), mc + new Vector2(0.06f, 0f)), 0.035f), lineMat);
            mouthWave = Decal("MouthWave", StarFace.Stroke(StarFace.Wave(mc, 0.085f, 0.018f), 0.032f), lineMat);
        }

        public void SetBase(Expression e) { baseExpr = e; if (exprTimer <= 0f) expr = e; }

        public void SetExpression(Expression e, float duration) { expr = e; exprTimer = duration; }

        void ApplyFace(float blink)
        {
            // ---- per-expression configuration ----
            bool open = true, happy = false, closed = false, cross = false, sparkle = false, wet = false;
            Vector2 eye = new Vector2(0.21f, 0.29f);        // open eye size (w, h)
            int mouthKind = 0;                              // 0 smile 1 open 2 O 3 flat 4 wave
            int brow = -1;                                  // -1 none 0 neutral 1 up 2 angry 3 sad
            float cheek = 1f;
            switch (expr)
            {
                case Expression.Focus:    eye = new Vector2(0.22f, 0.19f); mouthKind = 3; brow = 2; break;
                case Expression.Joy:      open = false; happy = true; mouthKind = 1; cheek = 1.35f; break;
                case Expression.Surprise: eye = new Vector2(0.24f, 0.36f); mouthKind = 2; brow = 1; break;
                case Expression.Hurt:     open = false; cross = true; mouthKind = 4; cheek = 0.6f; break;
                case Expression.Heal:     open = false; closed = true; mouthKind = 0; cheek = 1.25f; break;
                case Expression.Correct:  eye = new Vector2(0.23f, 0.31f); sparkle = true; mouthKind = 1; cheek = 1.35f; brow = 1; break;
                case Expression.Wrong:    eye = new Vector2(0.19f, 0.24f); wet = true; mouthKind = 4; brow = 3; cheek = 0.8f; break;
                case Expression.Clear:    eye = new Vector2(0.23f, 0.31f); sparkle = true; mouthKind = 1; cheek = 1.45f; break;
            }
            if (victory) { open = false; happy = true; sparkle = false; mouthKind = 1; cheek = 1.45f; }

            float eh = Mathf.Max(0.02f, eye.y * blink);
            bool blinking = blink < 0.35f;
            SetActive(eyeL, open && !blinking); SetActive(eyeR, open && !blinking);
            if (open)
            {
                float zl = StarFace.SurfaceZ(EyeLC.x, EyeLC.y), zr = StarFace.SurfaceZ(EyeRC.x, EyeRC.y);
                eyeL.localScale = new Vector3(eye.x, eh, 0.09f);
                eyeR.localScale = new Vector3(eye.x, eh, 0.09f);
                eyeL.localPosition = new Vector3(EyeLC.x, EyeLC.y, zl);
                eyeR.localPosition = new Vector3(EyeRC.x, EyeRC.y, zr);
                bool showHi = open && !sparkle && !blinking && eh > 0.12f;
                SetActive(hiL, showHi); SetActive(hiR, showHi); SetActive(hi2L, showHi); SetActive(hi2R, showHi);
                hiL.localPosition = new Vector3(EyeLC.x + eye.x * 0.18f, EyeLC.y + eh * 0.2f, zl + 0.05f);
                hiR.localPosition = new Vector3(EyeRC.x + eye.x * 0.18f, EyeRC.y + eh * 0.2f, zr + 0.05f);
                hi2L.localPosition = new Vector3(EyeLC.x - eye.x * 0.18f, EyeLC.y - eh * 0.22f, zl + 0.045f);
                hi2R.localPosition = new Vector3(EyeRC.x - eye.x * 0.18f, EyeRC.y - eh * 0.22f, zr + 0.045f);
            }
            else { SetActive(hiL, false); SetActive(hiR, false); SetActive(hi2L, false); SetActive(hi2R, false); }

            Set(happyL, happy); Set(happyR, happy);
            bool closedNow = closed || (open && blinking);
            Set(closedL, closedNow); Set(closedR, closedNow);
            Set(crossL, cross); Set(crossR, cross);
            Set(sparkL, sparkle && !blinking); Set(sparkR, sparkle && !blinking);
            Set(tear, wet);

            Set(browL, brow >= 0); Set(browR, brow >= 0);
            if (brow >= 0)
            {
                var bl = brow == 1 ? browUpL : brow == 2 ? browAngryL : brow == 3 ? browSadL : browNeutralL;
                var br = brow == 1 ? browUpR : brow == 2 ? browAngryR : brow == 3 ? browSadR : browNeutralR;
                if (browLF.sharedMesh != bl) browLF.sharedMesh = bl;
                if (browRF.sharedMesh != br) browRF.sharedMesh = br;
            }

            Set(mouthSmile, mouthKind == 0);
            Set(mouthOpen, mouthKind == 1); Set(mouthTongue, mouthKind == 1);
            Set(mouthO, mouthKind == 2);
            Set(mouthFlat, mouthKind == 3);
            Set(mouthWave, mouthKind == 4);
            cheekL.localScale = cheekR.localScale = new Vector3(0.2f, 0.11f, 0.05f) * cheek;
        }

        static void Set(GameObject g, bool on) { if (g.activeSelf != on) g.SetActive(on); }
        static void SetActive(Transform t, bool on) { if (t.gameObject.activeSelf != on) t.gameObject.SetActive(on); }

        //================== REACTIONS ==================\\
        /// Crash: white flash, shake, squash, red sparks.
        public void HitReaction()
        {
            flashT = 0.12f; shakeT = 0.25f; squashVel -= 6f;
            SetExpression(Expression.Hurt, 1.2f);
            fx.Burst(FxBurst.Hit, transform.position, transform.forward);
        }

        public void AnswerReaction(bool correct)
        {
            if (correct) { SetExpression(Expression.Correct, 1.6f); Twirl(600f); squashVel += 4f; fx.Burst(FxBurst.Correct, transform.position, transform.forward); }
            else { SetExpression(Expression.Wrong, 1.8f); shakeT = 0.2f; squashVel -= 3f; fx.Burst(FxBurst.Wrong, transform.position, transform.forward); }
        }

        public void TurboReaction(int tier)
        {
            if (tier <= 0) return;
            squashVel += 2f + tier;
            fx.Burst(tier == 1 ? FxBurst.Turbo1 : tier == 2 ? FxBurst.Turbo2 : FxBurst.Turbo3, transform.position, transform.forward);
        }

        public void RepairReaction() { SetExpression(Expression.Heal, 1.2f); fx.Burst(FxBurst.Repair, transform.position, transform.forward); }

        public void SetVictory(bool on)
        {
            victory = on;
            fx.SetVictory(on);
            if (on) { SetExpression(Expression.Clear, 99f); Twirl(900f); }
        }

        /// Clears transient state between races.
        public void ResetState()
        {
            victory = false; squash = squashVel = 0f; flashT = shakeT = 0f; spin = spinVel = 0f; lastSpeed01 = -1f; wasGrounded = true;
            fx.ClearTrails();
        }

        //================== DRIVE ==================\\
        /// Called every frame by the race controller.
        public void Pose(StarPose p, float dt)
        {
            t += dt;
            transform.position = p.pos;
            if (p.forward.sqrMagnitude > 1e-4f) transform.rotation = Quaternion.LookRotation(p.forward, Vector3.up);

            // 1.0 motion (kept): lean with lateral velocity, drift yaw, jump pitch, hover bob
            float roll = Mathf.Clamp(-p.lateralVel * 2.2f, -28f, 28f);
            float yaw = p.drifting ? p.driftDir * 28f : 0f;
            float pitch = Mathf.Clamp(-p.vy * 2f, -20f, 20f);
            float bob = p.grounded ? Mathf.Sin(t * 3.2f) * 0.09f : 0f;

            // 2.0: lean forward while accelerating
            if (lastSpeed01 < 0f) lastSpeed01 = p.speed01;
            float accel = (p.speed01 - lastSpeed01) / Mathf.Max(1e-4f, dt);
            lastSpeed01 = p.speed01;
            accelLean = Mathf.Lerp(accelLean, Mathf.Clamp(accel * 25f, -6f, 12f), 1f - Mathf.Exp(-6f * dt));
            pitch += accelLean;

            // jump flip: a full roll while airborne (1.0)
            if (!p.grounded) spin += 520f * dt;
            else spin = Mathf.MoveTowards(spin, Mathf.Round(spin / 360f) * 360f, 900f * dt);
            if (spinVel > 0f) { spin += spinVel * dt; spinVel = Mathf.Max(0f, spinVel - 700f * dt); }
            float wobble = p.boosting ? Mathf.Sin(t * 30f) * 4f : 0f;

            // 2.0: drift spin wobble (the star "skids" around its drift yaw)
            if (p.drifting) yaw += Mathf.Sin(t * 18f) * (3f + 2f * p.driftTier);

            // 2.0: squash & stretch (jump stretches, landing squashes)
            if (!p.grounded && wasGrounded) squashVel += 5f;
            if (p.grounded && !wasGrounded) { squashVel -= 7f; fx.Burst(FxBurst.Land, p.ground + Vector3.up * 0.2f, p.forward); }
            wasGrounded = p.grounded;
            float stretchBoost = p.boosting ? 0.06f : 0f;
            squashVel += (-squash * 160f - squashVel * 12f) * dt;          // damped spring
            squash += squashVel * dt;
            squash = Mathf.Clamp(squash, -0.35f, 0.35f);
            float sy = 1f + squash, sx = 1f - squash * 0.5f;
            body.localScale = new Vector3(sx, sy, 1f + stretchBoost) * BODY_SCALE;

            // 2.0: victory dance
            if (victory)
            {
                bob = Mathf.Abs(Mathf.Sin(t * 5f)) * 0.55f;
                roll += Mathf.Sin(t * 5f) * 12f;
            }

            Vector3 shake = Vector3.zero;
            if (shakeT > 0f) { shakeT -= dt; shake = Random.insideUnitSphere * 0.08f; }
            body.localPosition = new Vector3(0f, bob, 0f) + shake;
            body.localRotation = Quaternion.Euler(pitch, yaw, roll + spin + wobble);

            if (flashT > 0f) { flashT -= dt; bodyRenderer.sharedMaterial = bodyFlashMat; }
            else bodyRenderer.sharedMaterial = p.boosting ? bodyBoostMat : bodyMat;

            orbit.Rotate(0f, 0f, (60f + 240f * p.speed01) * dt, Space.Self);
            orbit2.Rotate(0f, 0f, -(40f + 160f * p.speed01) * dt, Space.Self);
            glow.intensity = p.boosting ? 4.5f : 2.2f + Mathf.Sin(t * 4f) * 0.3f;

            fx.Tick(p, dt);
            TickFace(dt, 2.5f + Mathf.PerlinNoise(t, 0.3f) * 2f);
        }

        void TickFace(float dt, float nextBlink)
        {
            if (exprTimer > 0f) { exprTimer -= dt; if (exprTimer <= 0f) expr = baseExpr; }
            blinkTimer -= dt;
            float blink = 1f;
            if (blinkTimer < 0f)
            {
                blinkT += dt;
                blink = Mathf.Abs(Mathf.Cos(blinkT * Mathf.PI / 0.16f));
                if (blinkT > 0.16f) { blinkT = 0f; blinkTimer = nextBlink; }
            }
            ApplyFace(blink);
        }

        /// Showcase spin (start / correct answer / clear) so the player sees the face.
        public void Twirl(float degPerSec = 900f) { spinVel = degPerSec; }

        public void ClearTrail() { fx.ClearTrails(); }

        /// Idle menu animation (title screen).
        public void Idle(float dt)
        {
            t += dt;
            body.localScale = Vector3.one * BODY_SCALE;
            body.localPosition = new Vector3(0f, Mathf.Sin(t * 2f) * 0.12f, 0f);
            body.localRotation = Quaternion.Euler(0f, Mathf.Sin(t * 0.8f) * 18f, Mathf.Sin(t * 1.3f) * 6f);
            bodyRenderer.sharedMaterial = bodyMat;
            orbit.Rotate(0f, 0f, 70f * dt, Space.Self);
            orbit2.Rotate(0f, 0f, -45f * dt, Space.Self);
            fx.Tick(new StarPose
            {
                pos = transform.position, ground = transform.position - Vector3.up * 1.7f,
                forward = transform.forward, right = transform.right, grounded = true
            }, dt);
            TickFace(dt, 3f);
        }
    }
}
