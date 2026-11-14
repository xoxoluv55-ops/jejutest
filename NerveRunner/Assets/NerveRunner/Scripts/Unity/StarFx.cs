// NERVE RUNNER 2.0 - STAR-01 effects: soft halo, contact shadow, electric trails, lightning arcs
// (boost), drift sparks (colour = mini-turbo tier), speed rays, and one-shot bursts (hit, correct,
// wrong, land, repair, turbo, victory). Particle counts scale with the Low/Medium/High setting.
// Every effect needs the NerveRunner/FX shader; if it is unavailable the effect is skipped.
using UnityEngine;

namespace NerveRunner
{
    public enum FxBurst { Hit, Correct, Wrong, Land, Repair, Turbo1, Turbo2, Turbo3, Node }

    public struct StarPose
    {
        public Vector3 pos, ground, forward, right;
        public float lateralVel, vy, speed01;
        public bool drifting, boosting, grounded, rush;
        public int driftDir, driftTier;
    }

    public class StarFx : MonoBehaviour
    {
        public static readonly Color[] TierColor =
        {
            new Color(0.6f, 0.9f, 1f), new Color(0.35f, 0.6f, 1f), new Color(1f, 0.62f, 0.2f), new Color(1f, 0.4f, 0.95f)
        };

        Transform halo, shadow;
        ParticleSystem sparks, bursts, twinkles, rays;
        TrailRenderer mainTrail;
        TrailRenderer[] sideTrails = new TrailRenderer[2];
        LineRenderer[] arcs = new LineRenderer[2];
        float sparkAcc, twinkleAcc, rayAcc, arcTimer, haloPulse, victoryAcc;
        bool victory;
        Camera cam;

        public void Build(Transform starRoot, Color starColor)
        {
            bool fx = NRMats.FxOK;

            // ---- main trail (vertex-colour gradient), fallback = old opaque trail ----
            mainTrail = starRoot.gameObject.AddComponent<TrailRenderer>();
            mainTrail.minVertexDistance = 0.35f;
            mainTrail.widthCurve = new AnimationCurve(new Keyframe(0f, 1.1f), new Keyframe(1f, 0f));
            mainTrail.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            mainTrail.receiveShadows = false;
            if (fx)
            {
                mainTrail.sharedMaterial = NRMats.Additive(Color.white, NRMats.Dot);
                mainTrail.colorGradient = Grad(new Color(1f, 0.9f, 0.45f), new Color(1f, 0.45f, 0.15f), 0.9f);
                mainTrail.textureMode = LineTextureMode.Stretch;
            }
            else mainTrail.sharedMaterial = NeonRacer.Mats.Unlit(Pal.Hex(0xFFE27A));

            if (!fx) return;

            // ---- halo (billboard) + contact shadow ----
            halo = MeshKit.Prim(PrimitiveType.Quad, starRoot, Vector3.zero, Vector3.one * 4.4f,
                                NRMats.Additive(new Color(1f, 0.78f, 0.3f, 0.55f), NRMats.Glow), "Halo").transform;
            shadow = MeshKit.Prim(PrimitiveType.Quad, transform, Vector3.zero, Vector3.one * 2.6f,
                                  NRMats.AlphaBlend(new Color(0.02f, 0f, 0.08f, 0.6f), NRMats.Shadow), "ContactShadow").transform;

            // ---- electric side trails from the two lower arms ----
            for (int i = 0; i < 2; i++)
            {
                var g = new GameObject("ElectricTrail" + i);
                g.transform.SetParent(starRoot, false);
                g.transform.localPosition = new Vector3(i == 0 ? -0.75f : 0.75f, -0.45f, -0.2f);
                var tr = g.AddComponent<TrailRenderer>();
                tr.sharedMaterial = NRMats.Additive(Color.white, NRMats.Dot);
                tr.colorGradient = Grad(new Color(0.55f, 1f, 1f), new Color(0.3f, 0.5f, 1f), 0.8f);
                tr.widthCurve = new AnimationCurve(new Keyframe(0f, 0.22f), new Keyframe(1f, 0f));
                tr.time = 0.28f; tr.minVertexDistance = 0.3f; tr.emitting = false;
                tr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                sideTrails[i] = tr;
            }

            // ---- lightning arcs (boost) ----
            for (int i = 0; i < 2; i++)
            {
                var g = new GameObject("Arc" + i);
                g.transform.SetParent(starRoot, false);
                var lr = g.AddComponent<LineRenderer>();
                lr.sharedMaterial = NRMats.Additive(new Color(0.7f, 0.95f, 1f), NRMats.Dot);
                lr.positionCount = 9; lr.useWorldSpace = true; lr.widthMultiplier = 0.07f;
                lr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                lr.enabled = false;
                arcs[i] = lr;
            }

            // ---- particle systems (manual emission via Emit) ----
            int scale = Mathf.Max(1, Mathf.RoundToInt(Gfx.Particles * 10f));
            sparks = PS("DriftSparks", NRMats.Additive(Color.white, NRMats.Dot), 40 * scale / 10 + 20, ParticleSystemRenderMode.Stretch, 1.4f);
            bursts = PS("Bursts", NRMats.Additive(Color.white, NRMats.Dot), 60 * scale / 10 + 20, ParticleSystemRenderMode.Billboard, 0.4f);
            twinkles = PS("Twinkles", NRMats.Additive(Color.white, NRMats.Sparkle), 30 * scale / 10 + 10, ParticleSystemRenderMode.Billboard, 0f);
            rays = PS("SpeedRays", NRMats.Additive(new Color(0.8f, 0.9f, 1f, 0.8f), NRMats.Dot), 50 * scale / 10 + 10, ParticleSystemRenderMode.Stretch, 0f);
        }

        static Gradient Grad(Color a, Color b, float alpha)
        {
            var g = new Gradient();
            g.SetKeys(new[] { new GradientColorKey(a, 0f), new GradientColorKey(b, 1f) },
                      new[] { new GradientAlphaKey(alpha, 0f), new GradientAlphaKey(0f, 1f) });
            return g;
        }

        ParticleSystem PS(string name, Material mat, int max, ParticleSystemRenderMode mode, float gravity)
        {
            var go = new GameObject(name);
            go.transform.SetParent(transform, false);
            var ps = go.AddComponent<ParticleSystem>();
            ps.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            var main = ps.main;
            main.playOnAwake = false;
            main.loop = true;
            main.maxParticles = max;
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            main.gravityModifier = gravity;
            main.startLifetime = 0.6f;
            main.startSpeed = 0f;
            var em = ps.emission; em.enabled = false;
            var shape = ps.shape; shape.enabled = false;
            var col = ps.colorOverLifetime; col.enabled = true;
            var fade = new Gradient();
            fade.SetKeys(new[] { new GradientColorKey(Color.white, 0f), new GradientColorKey(Color.white, 1f) },
                         new[] { new GradientAlphaKey(1f, 0f), new GradientAlphaKey(0f, 1f) });
            col.color = new ParticleSystem.MinMaxGradient(fade);
            var size = ps.sizeOverLifetime; size.enabled = true;
            size.size = new ParticleSystem.MinMaxCurve(1f, new AnimationCurve(new Keyframe(0f, 1f), new Keyframe(1f, 0.25f)));
            var r = go.GetComponent<ParticleSystemRenderer>();
            r.sharedMaterial = mat;
            r.renderMode = mode;
            if (mode == ParticleSystemRenderMode.Stretch) { r.velocityScale = 0.045f; r.lengthScale = 1.2f; }
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            r.receiveShadows = false;
            ps.Play();
            return ps;
        }

        static void Emit(ParticleSystem ps, Vector3 pos, Vector3 vel, Color c, float size, float life)
        {
            if (ps == null) return;
            var p = new ParticleSystem.EmitParams
            {
                position = pos, velocity = vel, startColor = c, startSize = size, startLifetime = life, applyShapeToPosition = false
            };
            ps.Emit(p, 1);
        }

        //================== PER FRAME ==================\\
        public void Tick(StarPose p, float dt)
        {
            if (cam == null) cam = Camera.main;
            if (mainTrail != null)
            {
                mainTrail.time = p.boosting ? 0.5f : 0.14f + 0.2f * p.speed01;
                mainTrail.widthMultiplier = p.boosting ? 1.5f : 1f;
            }
            if (halo == null) return;   // FX shader unavailable

            // halo faces the camera, pulses, flares on boost
            haloPulse += dt;
            if (cam != null) halo.rotation = cam.transform.rotation;
            float hs = 4.2f + Mathf.Sin(haloPulse * 4f) * 0.15f + (p.boosting ? 1.6f : 0f) + (p.rush ? 0.6f : 0f);
            halo.localScale = Vector3.one * hs;

            // contact shadow on the road, shrinking with height
            float h = Mathf.Max(0f, Vector3.Dot(p.pos - p.ground, Vector3.up));
            shadow.position = p.ground + Vector3.up * 0.07f;
            shadow.rotation = Quaternion.LookRotation(Vector3.down, p.forward);
            shadow.localScale = Vector3.one * Mathf.Lerp(2.6f, 1.2f, Mathf.Clamp01((h - 1.1f) / 3f));

            bool electric = p.boosting || (p.drifting && p.driftTier >= 1) || p.rush;
            foreach (var tr in sideTrails) if (tr != null) tr.emitting = electric;

            // lightning arcs while boosting
            bool arcsOn = p.boosting && Gfx.Fancy;
            arcTimer -= dt;
            for (int i = 0; i < arcs.Length; i++)
            {
                arcs[i].enabled = arcsOn;
                if (arcsOn && arcTimer <= 0f) Lightning(arcs[i], p.pos, p.forward);
            }
            if (arcTimer <= 0f) arcTimer = 0.06f;

            // drift sparks from the outer side, coloured by mini-turbo tier
            if (p.drifting && p.grounded)
            {
                sparkAcc += dt * 70f * Gfx.Particles;
                Color c = TierColor[Mathf.Clamp(p.driftTier, 0, 3)];
                while (sparkAcc >= 1f)
                {
                    sparkAcc -= 1f;
                    Vector3 o = p.ground + p.right * (-p.driftDir * Random.Range(0.3f, 0.9f)) - p.forward * 0.7f + Vector3.up * 0.15f;
                    Vector3 v = -p.forward * Random.Range(3f, 8f) + Vector3.up * Random.Range(1.5f, 4.5f) + p.right * (-p.driftDir * Random.Range(1f, 3.5f));
                    Emit(sparks, o, v, c, Random.Range(0.06f, 0.12f), Random.Range(0.25f, 0.45f));
                }
            }

            // ambient twinkles around the body
            twinkleAcc += dt * (p.boosting ? 14f : 5f) * Gfx.Particles;
            while (twinkleAcc >= 1f)
            {
                twinkleAcc -= 1f;
                Vector3 o = p.pos + Random.onUnitSphere * Random.Range(0.9f, 1.6f);
                Emit(twinkles, o, Random.insideUnitSphere * 0.6f - p.forward * 2f, Color.Lerp(new Color(1f, 0.9f, 0.5f), new Color(0.6f, 1f, 1f), Random.value), Random.Range(0.18f, 0.32f), 0.5f);
            }

            // speed rays rushing past the camera
            if (p.boosting || p.rush || p.speed01 > 0.92f)
            {
                rayAcc += dt * (p.boosting ? 55f : 25f) * Gfx.Particles;
                while (rayAcc >= 1f)
                {
                    rayAcc -= 1f;
                    Vector2 d = Random.insideUnitCircle.normalized * Random.Range(2.5f, 7f);
                    Vector3 o = p.pos + p.forward * Random.Range(14f, 26f) + p.right * d.x + Vector3.up * (d.y + 0.8f);
                    Emit(rays, o, -p.forward * Random.Range(55f, 80f), new Color(0.75f, 0.9f, 1f, 0.7f), Random.Range(0.05f, 0.09f), 0.4f);
                }
            }
            else rayAcc = 0f;

            if (victory)
            {
                victoryAcc += dt * 30f * Gfx.Particles;
                while (victoryAcc >= 1f)
                {
                    victoryAcc -= 1f;
                    Color c = Color.HSVToRGB(Random.value, 0.6f, 1f);
                    Emit(twinkles, p.pos + Vector3.up * 1.6f + Random.insideUnitSphere * 0.6f, Random.insideUnitSphere * 4f + Vector3.up * 4f, c, Random.Range(0.25f, 0.45f), 1.1f);
                }
            }
        }

        void Lightning(LineRenderer lr, Vector3 center, Vector3 fwd)
        {
            Vector3 a = center + Random.onUnitSphere * 0.5f;
            Vector3 b = center + Random.onUnitSphere * 1.8f - fwd * 1.2f;
            for (int k = 0; k < lr.positionCount; k++)
            {
                float u = k / (float)(lr.positionCount - 1);
                Vector3 q = Vector3.Lerp(a, b, u);
                if (k > 0 && k < lr.positionCount - 1) q += Random.insideUnitSphere * 0.28f;
                lr.SetPosition(k, q);
            }
        }

        public void SetVictory(bool on) { victory = on; }

        public void Burst(FxBurst kind, Vector3 pos, Vector3 fwd)
        {
            if (bursts == null) return;
            int n; Color a, b; float speed, up, size = 0.18f, life = 0.6f;
            ParticleSystem ps = bursts;
            switch (kind)
            {
                case FxBurst.Hit:     n = 26; a = new Color(1f, 0.25f, 0.35f); b = Color.white; speed = 9f; up = 2f; break;
                case FxBurst.Correct: n = 22; a = Pal.Cyan; b = Pal.Yellow; speed = 5f; up = 6f; ps = twinkles; size = 0.35f; life = 0.9f; break;
                case FxBurst.Wrong:   n = 16; a = Pal.Red; b = new Color(0.4f, 0f, 0.15f); speed = 4f; up = 1f; break;
                case FxBurst.Land:    n = 12; a = Pal.Cyan; b = Color.white; speed = 6f; up = 0.3f; size = 0.12f; life = 0.35f; break;
                case FxBurst.Repair:  n = 20; a = Pal.Green; b = Color.white; speed = 3f; up = 6f; ps = twinkles; size = 0.3f; break;
                case FxBurst.Node:    n = 10; a = Pal.Cyan; b = Color.white; speed = 7f; up = 1f; size = 0.14f; life = 0.4f; break;
                case FxBurst.Turbo1:  n = 14; a = TierColor[1]; b = Color.white; speed = 7f; up = 1f; break;
                case FxBurst.Turbo2:  n = 18; a = TierColor[2]; b = Color.white; speed = 8f; up = 1f; break;
                default:              n = 24; a = TierColor[3]; b = Color.white; speed = 9f; up = 1.5f; break;
            }
            n = Mathf.Max(3, Mathf.RoundToInt(n * Gfx.Particles));
            for (int i = 0; i < n; i++)
            {
                Vector3 dir = Random.onUnitSphere;
                if (kind == FxBurst.Land) { dir.y = 0f; dir.Normalize(); }
                if (kind >= FxBurst.Turbo1 && kind <= FxBurst.Turbo3) dir = (dir * 0.5f - fwd).normalized;
                Emit(ps, pos + dir * 0.4f, dir * speed * Random.Range(0.5f, 1f) + Vector3.up * up * Random.value,
                     Color.Lerp(a, b, Random.value * 0.6f), size * Random.Range(0.7f, 1.3f), life * Random.Range(0.7f, 1.2f));
            }
        }

        public void ClearTrails()
        {
            if (mainTrail != null) mainTrail.Clear();
            foreach (var t in sideTrails) if (t != null) t.Clear();
            if (sparks != null) sparks.Clear();
            if (bursts != null) bursts.Clear();
            if (twinkles != null) twinkles.Clear();
            if (rays != null) rays.Clear();
            victory = false;
        }
    }
}
