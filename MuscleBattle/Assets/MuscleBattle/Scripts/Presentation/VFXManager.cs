using System.Collections.Generic;
using UnityEngine;

namespace MuscleBattle
{
    /// <summary>
    /// Pooled particle effects (§66). Every effect is a ParticleSystem prototype configured in code,
    /// instanced into a small pool and re-used. Burst counts scale with QualityProfile, but every
    /// key hit effect exists on every platform (§3: iPad must not look cheap).
    /// </summary>
    public sealed class VFXManager : MonoBehaviour
    {
        public static VFXManager Instance { get; private set; }

        sealed class Pool
        {
            public readonly List<ParticleSystem> Items = new List<ParticleSystem>();
            public int Next;
        }

        readonly Dictionary<string, Pool> _pools = new Dictionary<string, Pool>();
        readonly Dictionary<FighterController, ParticleSystem> _auras = new Dictionary<FighterController, ParticleSystem>();
        QualityProfile Q => QualityProfile.Current;

        void Awake()
        {
            Instance = this;
            // prototypes ---------------------------------------------------------
            Register("spark", 6, () => Sparks("spark"));
            Register("fiber", 6, () => FiberBurst());
            Register("flare", 6, () => FlareFlash());
            Register("ring", 6, () => RingWave());
            Register("guard", 4, () => GuardHex());
            Register("dust", 4, () => DustPuff());
            Register("ko", 2, () => KoExplosion());
            Register("charge", 2, () => ChargeIn());
            Register("confetti", 2, () => VictoryRain());
        }

        // ------------------------------------------------------------------
        // Public effects
        // ------------------------------------------------------------------
        public void HitSpark(Vector3 pos, Vector3 dir, Color color, ImpactTier tier)
        {
            switch (tier)
            {
                case ImpactTier.Light:
                    // light: small, quick spark
                    Emit("flare", pos, dir, Color.Lerp(color, Color.white, 0.6f), 0, 0.7f);
                    Emit("spark", pos, dir, Color.Lerp(color, Palette.MuscleHot, 0.3f), Mathf.RoundToInt(8 * Q.ParticleScale), 0.7f);
                    break;
                case ImpactTier.Medium:
                    Emit("flare", pos, dir, Color.Lerp(color, Color.white, 0.55f), 0, 1.3f);
                    Emit("spark", pos, dir, Color.Lerp(color, Palette.MuscleHot, 0.3f), Mathf.RoundToInt(18 * Q.ParticleScale), 1.05f);
                    Emit("fiber", pos, dir, color, Mathf.RoundToInt(8 * Q.ParticleScale), 1f);
                    break;
                default:
                    // heavy / ultimate: big impact - flare, shockwave ring, fibre burst, debris sparks, screen pop
                    float big = tier == ImpactTier.Ultimate ? 1.35f : 1f;
                    Emit("flare", pos, dir, Color.Lerp(color, Color.white, 0.5f), 0, 2.6f * big);
                    Emit("ring", pos, dir, Color.Lerp(color, Color.white, 0.3f), 1, 1.9f * big);
                    Emit("spark", pos, dir, Color.Lerp(color, Palette.MuscleHot, 0.3f), Mathf.RoundToInt(34 * Q.ParticleScale * big), 1.5f);
                    Emit("fiber", pos, dir, color, Mathf.RoundToInt(20 * Q.ParticleScale * big), 1.5f);
                    ScreenFlash(Color.Lerp(color, Color.white, 0.6f), 0.12f * big);
                    break;
            }
        }

        public void GuardSpark(Vector3 pos, Vector3 facing, bool perfect)
        {
            // guard = blue shield flash (perfect guard = gold rim on top)
            Emit("guard", pos, facing, Palette.Nerve, 1, perfect ? 1.9f : 1.5f);
            Emit("flare", pos, facing, Color.Lerp(Palette.Nerve, Color.white, 0.4f), 0, perfect ? 1.8f : 1.1f);
            Emit("spark", pos, facing, Palette.Nerve, Mathf.RoundToInt((perfect ? 22 : 10) * Q.ParticleScale), 0.8f);
            if (perfect)
            {
                Emit("ring", pos, facing, Palette.Gold, 1, 1.4f);
                ScreenFlash(Palette.Nerve, 0.15f);
            }
        }

        public void CounterFlash(Vector3 pos)
        {
            Emit("flare", pos, Vector3.forward, Palette.Bone, 0, 3f);
            Emit("ring", pos, Vector3.forward, Palette.Gold, 1, 2.2f);
            Emit("spark", pos, Vector3.up, Palette.Gold, Mathf.RoundToInt(40 * Q.ParticleScale), 1.4f);
        }

        public void Shockwave(Vector3 pos, Color color)
        {
            Emit("ring", pos, Vector3.forward, color, 1, 1.6f);
        }

        public void KoBurst(Vector3 pos, Color color)
        {
            Emit("ko", pos, Vector3.up, color, Mathf.RoundToInt(80 * Q.ParticleScale), 1f);
            Emit("ring", pos, Vector3.forward, Palette.Bone, 1, 3f);
            Emit("flare", pos, Vector3.forward, Color.white, 0, 4f);
            Emit("fiber", pos, Vector3.up, Palette.Muscle, Mathf.RoundToInt(30 * Q.ParticleScale), 1.6f);
        }

        public void Dust(Vector3 groundPos)
        {
            Emit("dust", new Vector3(groundPos.x, 0.05f, groundPos.z), Vector3.up, new Color(0.75f, 0.7f, 1f, 0.5f), Mathf.RoundToInt(12 * Q.ParticleScale), 1f);
        }

        public void SuperFlash(FighterController f, Color color, bool ultimate)
        {
            var pos = f.ChestPosition;
            Emit("charge", pos, Vector3.up, color, Mathf.RoundToInt((ultimate ? 70 : 40) * Q.ParticleScale), ultimate ? 1.5f : 1f);
            Emit("ring", pos, Vector3.forward, color, 1, ultimate ? 2.8f : 1.8f);
            Emit("flare", pos, Vector3.forward, Color.Lerp(color, Color.white, 0.5f), 0, ultimate ? 3.5f : 2.2f);
            ScreenFlash(color, ultimate ? 0.45f : 0.25f);
        }

        public void CounterStance(FighterController f)
        {
            Emit("guard", f.ChestPosition + f.Facing * 0.4f, f.Facing, Palette.Gold, 1, 0.9f);
        }

        public void Afterimage(FighterController f)
        {
            Emit("fiber", f.ChestPosition, -f.Facing, f.Def.Energy, Mathf.RoundToInt(8 * Q.ParticleScale), 0.8f);
        }

        public void VictoryBurst(FighterController f)
        {
            Emit("confetti", f.Position + Vector3.up * 4f, Vector3.down, Palette.Gold, Mathf.RoundToInt(120 * Q.ParticleScale), 1f);
            Emit("charge", f.ChestPosition, Vector3.up, f.Def.Energy, Mathf.RoundToInt(50 * Q.ParticleScale), 1.3f);
        }

        /// <summary>
        /// Energy pulled from a muscle into the striking limb (Knowledge -> Muscle -> Attack, made visible):
        /// a glowing beam plus particles streaming along it, running on unscaled time (works in slow motion).
        /// </summary>
        public void EnergyFlow(Vector3 from, Transform to, Color color, float seconds)
        {
            if (to == null) return;
            StartCoroutine(EnergyFlowRoutine(from, to, color, seconds));
        }

        System.Collections.IEnumerator EnergyFlowRoutine(Vector3 from, Transform to, Color color, float seconds)
        {
            var go = new GameObject("EnergyFlow");
            go.transform.SetParent(transform, false);
            var lr = go.AddComponent<LineRenderer>();
            lr.positionCount = 2;
            lr.useWorldSpace = true;
            lr.material = MBAssets.SharedAdditive("fiber_line", ProceduralTextures.Fiber);
            lr.textureMode = LineTextureMode.Tile;
            lr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            lr.widthCurve = new AnimationCurve(new Keyframe(0, 0.16f), new Keyframe(1, 0.06f));
            var spark = _pools.TryGetValue("charge", out var pool) ? pool.Items[0] : null;
            float t = 0;
            while (t < seconds)
            {
                t += Time.unscaledDeltaTime;
                float k = t / seconds;
                var end = Vector3.Lerp(from, to.position, Mathf.SmoothStep(0, 1, Mathf.Min(1, k * 1.6f)));
                lr.SetPosition(0, from);
                lr.SetPosition(1, end);
                var c = Color.Lerp(Color.white, color, k);
                c.a = Mathf.Sin(Mathf.PI * k);
                lr.startColor = c;
                lr.endColor = c;
                if (spark != null && Random.value < 0.6f * Q.ParticleScale + 0.2f)
                {
                    var ep = new ParticleSystem.EmitParams
                    {
                        position = Vector3.Lerp(from, end, Random.value),
                        velocity = (to.position - from).normalized * 3f,
                        startColor = color,
                        startSize = 0.09f,
                        startLifetime = 0.25f,
                        applyShapeToPosition = false,
                    };
                    spark.Emit(ep, 1);
                }
                yield return null;
            }
            Emit("flare", to.position, Vector3.forward, Color.Lerp(color, Color.white, 0.4f), 0, 1.6f);
            Destroy(go);
        }

        public void ScreenFlash(Color c, float strength)
        {
            Hud.Instance?.ScreenFlash(c, strength);
        }

        /// <summary>Persistent adrenaline aura (red fibre energy rising off the body).</summary>
        public void SetAura(FighterController f, bool on)
        {
            if (!_auras.TryGetValue(f, out var ps) || ps == null)
            {
                if (!on) return;
                ps = AuraSystem(f);
                _auras[f] = ps;
            }
            if (on) ps.Play(); else ps.Stop(true, ParticleSystemStopBehavior.StopEmitting);
        }

        // ------------------------------------------------------------------
        // Pool plumbing
        // ------------------------------------------------------------------
        void Register(string key, int count, System.Func<ParticleSystem> factory)
        {
            var pool = new Pool();
            for (int i = 0; i < count; i++)
            {
                var ps = factory();
                ps.transform.SetParent(transform, false);
                ps.gameObject.name = key + "_" + i;
                pool.Items.Add(ps);
            }
            _pools[key] = pool;
        }

        void Emit(string key, Vector3 pos, Vector3 dir, Color color, int count, float size)
        {
            if (!_pools.TryGetValue(key, out var pool)) return;
            var ps = pool.Items[pool.Next];
            pool.Next = (pool.Next + 1) % pool.Items.Count;
            ps.transform.position = pos;
            if (dir.sqrMagnitude > 0.001f) ps.transform.rotation = Quaternion.LookRotation(dir.normalized, Vector3.up);
            var main = ps.main;
            main.startColor = color;
            ps.transform.localScale = Vector3.one * size;
            ps.Clear(true);
            if (count <= 0)
            {
                ps.Play(true);
            }
            else
            {
                ps.Emit(count);
            }
        }

        // ------------------------------------------------------------------
        // Prototype builders
        // ------------------------------------------------------------------
        ParticleSystem NewSystem(string name, Texture tex, int max)
        {
            var go = new GameObject(name);
            var ps = go.AddComponent<ParticleSystem>();
            ps.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            var main = ps.main;
            main.playOnAwake = false;
            main.loop = false;
            main.maxParticles = Mathf.Min(max, Q.MaxParticlesPerSystem);
            main.scalingMode = ParticleSystemScalingMode.Hierarchy;
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            main.useUnscaledTime = false;
            var emission = ps.emission;
            emission.enabled = false;
            var r = go.GetComponent<ParticleSystemRenderer>();
            r.sharedMaterial = MBAssets.SharedAdditive(tex.name, tex);
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            r.receiveShadows = false;
            return ps;
        }

        static ParticleSystem.MinMaxGradient Fade(float startAlpha = 1f)
        {
            var g = new Gradient();
            g.SetKeys(new[] { new GradientColorKey(Color.white, 0), new GradientColorKey(Color.white, 1) },
                new[] { new GradientAlphaKey(startAlpha, 0), new GradientAlphaKey(startAlpha * 0.7f, 0.4f), new GradientAlphaKey(0, 1) });
            return new ParticleSystem.MinMaxGradient(g);
        }

        ParticleSystem Sparks(string name)
        {
            var ps = NewSystem(name, ProceduralTextures.Streak, 160);
            var m = ps.main;
            m.startLifetime = new ParticleSystem.MinMaxCurve(0.12f, 0.32f);
            m.startSpeed = new ParticleSystem.MinMaxCurve(5f, 14f);
            m.startSize = new ParticleSystem.MinMaxCurve(0.05f, 0.14f);
            m.gravityModifier = 0.6f;
            var shape = ps.shape;
            shape.shapeType = ParticleSystemShapeType.Cone;
            shape.angle = 55;
            shape.radius = 0.05f;
            var col = ps.colorOverLifetime;
            col.enabled = true;
            col.color = Fade();
            var r = ps.GetComponent<ParticleSystemRenderer>();
            r.renderMode = ParticleSystemRenderMode.Stretch;
            r.velocityScale = 0.06f;
            r.lengthScale = 2.5f;
            return ps;
        }

        ParticleSystem FiberBurst()
        {
            // red/orange muscle fibre ribbons
            var ps = NewSystem("fiber", ProceduralTextures.Fiber, 120);
            var m = ps.main;
            m.startLifetime = new ParticleSystem.MinMaxCurve(0.18f, 0.4f);
            m.startSpeed = new ParticleSystem.MinMaxCurve(3f, 8f);
            m.startSize = new ParticleSystem.MinMaxCurve(0.15f, 0.4f);
            var shape = ps.shape;
            shape.shapeType = ParticleSystemShapeType.Cone;
            shape.angle = 35;
            var col = ps.colorOverLifetime;
            col.enabled = true;
            col.color = Fade();
            var r = ps.GetComponent<ParticleSystemRenderer>();
            r.renderMode = ParticleSystemRenderMode.Stretch;
            r.velocityScale = 0.05f;
            r.lengthScale = 3f;
            return ps;
        }

        ParticleSystem FlareFlash()
        {
            var ps = NewSystem("flare", ProceduralTextures.Flare, 4);
            var m = ps.main;
            m.startLifetime = 0.14f;
            m.startSpeed = 0;
            m.startSize = 1.1f;
            m.startRotation = new ParticleSystem.MinMaxCurve(-0.4f, 0.4f);
            var e = ps.emission;
            e.enabled = true;
            e.rateOverTime = 0;
            e.SetBursts(new[] { new ParticleSystem.Burst(0, 2) });
            var shape = ps.shape;
            shape.enabled = false;
            var size = ps.sizeOverLifetime;
            size.enabled = true;
            size.size = new ParticleSystem.MinMaxCurve(1f, new AnimationCurve(new Keyframe(0, 0.5f), new Keyframe(0.25f, 1.2f), new Keyframe(1, 0.2f)));
            var col = ps.colorOverLifetime;
            col.enabled = true;
            col.color = Fade();
            return ps;
        }

        ParticleSystem RingWave()
        {
            var ps = NewSystem("ring", ProceduralTextures.Ring, 2);
            var m = ps.main;
            m.startLifetime = 0.3f;
            m.startSpeed = 0;
            m.startSize = 1.5f;
            var e = ps.emission;
            e.enabled = false;
            var shape = ps.shape;
            shape.enabled = false;
            var size = ps.sizeOverLifetime;
            size.enabled = true;
            size.size = new ParticleSystem.MinMaxCurve(1f, new AnimationCurve(new Keyframe(0, 0.2f), new Keyframe(1, 1.6f)));
            var col = ps.colorOverLifetime;
            col.enabled = true;
            col.color = Fade();
            var r = ps.GetComponent<ParticleSystemRenderer>();
            r.renderMode = ParticleSystemRenderMode.Billboard;
            return ps;
        }

        ParticleSystem GuardHex()
        {
            var ps = NewSystem("guard", ProceduralTextures.CircleOutline, 3);
            var m = ps.main;
            m.startLifetime = 0.22f;
            m.startSpeed = 0;
            m.startSize = 1.0f;
            var shape = ps.shape;
            shape.enabled = false;
            var size = ps.sizeOverLifetime;
            size.enabled = true;
            size.size = new ParticleSystem.MinMaxCurve(1f, new AnimationCurve(new Keyframe(0, 0.6f), new Keyframe(1, 1.2f)));
            var col = ps.colorOverLifetime;
            col.enabled = true;
            col.color = Fade();
            var r = ps.GetComponent<ParticleSystemRenderer>();
            r.renderMode = ParticleSystemRenderMode.Billboard;
            return ps;
        }

        ParticleSystem DustPuff()
        {
            var ps = NewSystem("dust", ProceduralTextures.Smoke, 40);
            var m = ps.main;
            m.startLifetime = new ParticleSystem.MinMaxCurve(0.4f, 0.8f);
            m.startSpeed = new ParticleSystem.MinMaxCurve(1f, 3f);
            m.startSize = new ParticleSystem.MinMaxCurve(0.4f, 0.9f);
            var shape = ps.shape;
            shape.shapeType = ParticleSystemShapeType.Circle;
            shape.radius = 0.3f;
            shape.rotation = new Vector3(-90, 0, 0);
            var vel = ps.limitVelocityOverLifetime;
            vel.enabled = true;
            vel.dampen = 0.15f;
            vel.limit = 0.5f;
            var col = ps.colorOverLifetime;
            col.enabled = true;
            col.color = Fade(0.5f);
            var size = ps.sizeOverLifetime;
            size.enabled = true;
            size.size = new ParticleSystem.MinMaxCurve(1f, new AnimationCurve(new Keyframe(0, 0.6f), new Keyframe(1, 1.6f)));
            return ps;
        }

        ParticleSystem KoExplosion()
        {
            var ps = NewSystem("ko", ProceduralTextures.Streak, 200);
            var m = ps.main;
            m.startLifetime = new ParticleSystem.MinMaxCurve(0.4f, 1.2f);
            m.startSpeed = new ParticleSystem.MinMaxCurve(6f, 20f);
            m.startSize = new ParticleSystem.MinMaxCurve(0.08f, 0.25f);
            m.gravityModifier = 0.4f;
            m.useUnscaledTime = true; // keeps flying during KO slow motion
            var shape = ps.shape;
            shape.shapeType = ParticleSystemShapeType.Sphere;
            shape.radius = 0.2f;
            var col = ps.colorOverLifetime;
            col.enabled = true;
            col.color = Fade();
            var r = ps.GetComponent<ParticleSystemRenderer>();
            r.renderMode = ParticleSystemRenderMode.Stretch;
            r.velocityScale = 0.05f;
            r.lengthScale = 3f;
            return ps;
        }

        ParticleSystem ChargeIn()
        {
            // energy converging on the body (special / ultimate start-up)
            var ps = NewSystem("charge", ProceduralTextures.Streak, 120);
            var m = ps.main;
            m.startLifetime = 0.35f;
            m.startSpeed = new ParticleSystem.MinMaxCurve(-9f, -5f);
            m.startSize = new ParticleSystem.MinMaxCurve(0.06f, 0.16f);
            m.useUnscaledTime = true;
            var shape = ps.shape;
            shape.shapeType = ParticleSystemShapeType.Sphere;
            shape.radius = 2.2f;
            var col = ps.colorOverLifetime;
            col.enabled = true;
            col.color = Fade();
            var r = ps.GetComponent<ParticleSystemRenderer>();
            r.renderMode = ParticleSystemRenderMode.Stretch;
            r.velocityScale = 0.06f;
            r.lengthScale = 2f;
            return ps;
        }

        ParticleSystem VictoryRain()
        {
            var ps = NewSystem("confetti", ProceduralTextures.Flare, 200);
            var m = ps.main;
            m.startLifetime = new ParticleSystem.MinMaxCurve(1.5f, 3f);
            m.startSpeed = new ParticleSystem.MinMaxCurve(0.5f, 2f);
            m.startSize = new ParticleSystem.MinMaxCurve(0.08f, 0.22f);
            m.gravityModifier = 0.15f;
            m.useUnscaledTime = true;
            var shape = ps.shape;
            shape.shapeType = ParticleSystemShapeType.Box;
            shape.scale = new Vector3(6, 0.5f, 3);
            var col = ps.colorOverLifetime;
            col.enabled = true;
            col.color = Fade();
            return ps;
        }

        ParticleSystem AuraSystem(FighterController f)
        {
            var ps = NewSystem("aura_" + f.Side, ProceduralTextures.Fiber, 80);
            ps.transform.SetParent(f.transform, false);
            ps.transform.localPosition = new Vector3(0, 0.2f, 0);
            ps.transform.localRotation = Quaternion.Euler(-90, 0, 0);
            var m = ps.main;
            m.loop = true;
            m.startLifetime = new ParticleSystem.MinMaxCurve(0.5f, 0.9f);
            m.startSpeed = new ParticleSystem.MinMaxCurve(1.2f, 2.6f);
            m.startSize = new ParticleSystem.MinMaxCurve(0.2f, 0.45f);
            m.startColor = new ParticleSystem.MinMaxGradient(Palette.Muscle, Palette.MuscleHot);
            m.simulationSpace = ParticleSystemSimulationSpace.World;
            var e = ps.emission;
            e.enabled = true;
            e.rateOverTime = 26 * Q.ParticleScale;
            var shape = ps.shape;
            shape.shapeType = ParticleSystemShapeType.Circle;
            shape.radius = 0.45f;
            var col = ps.colorOverLifetime;
            col.enabled = true;
            col.color = Fade(0.8f);
            var r = ps.GetComponent<ParticleSystemRenderer>();
            r.renderMode = ParticleSystemRenderMode.Stretch;
            r.velocityScale = 0.15f;
            r.lengthScale = 2f;
            return ps;
        }
    }
}
