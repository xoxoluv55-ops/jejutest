using System.Collections.Generic;
using UnityEngine;

namespace MuscleBattle
{
    /// <summary>
    /// Builds the vertical slice arena: "Futuristic Sports Rehabilitation Arena" (§59).
    /// Polished neon floor + centre emblem, anatomy hologram displays, banners, light shafts,
    /// ring-out line, crowd LED wall. Bright key light so fighters read clearly (§32).
    /// Stage reacts to big hits (floor pulse, hologram flicker) (§33).
    /// </summary>
    public sealed class StageManager : MonoBehaviour
    {
        public static StageManager Instance { get; private set; }
        public const string StageNameKo = "스포츠 재활 아레나";
        public const string StageNameEn = "SPORTS REHAB ARENA";

        Material _floorMat;
        readonly List<Material> _holoMats = new List<Material>();
        readonly List<Transform> _spinners = new List<Transform>();
        float _pulse;
        float _holoGlitch;
        Light _key;

        public Light KeyLight => _key;

        void Awake() { Instance = this; }

        public void Build()
        {
            var q = QualityProfile.Current;
            int tex = q.ProceduralTextureSize;

            // ---- lighting ----
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.46f, 0.43f, 0.72f);
            RenderSettings.ambientEquatorColor = new Color(0.3f, 0.27f, 0.52f);
            RenderSettings.ambientGroundColor = new Color(0.12f, 0.1f, 0.22f);
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Exponential;
            RenderSettings.fogColor = new Color(0.07f, 0.04f, 0.16f);
            RenderSettings.fogDensity = 0.018f;

            var keyGo = new GameObject("Key Light");
            keyGo.transform.SetParent(transform, false);
            keyGo.transform.rotation = Quaternion.Euler(48, -30, 0);
            _key = keyGo.AddComponent<Light>();
            _key.type = LightType.Directional;
            _key.color = new Color(1f, 0.96f, 0.92f);
            _key.intensity = 1.25f;

            // fill + back rim light, evaluated in the character shader (no extra pixel-light passes on iPad)
            Shader.SetGlobalVector("_MB_FillDir", new Vector4(-0.55f, 0.35f, -0.75f, 0));
            Shader.SetGlobalColor("_MB_FillColor", new Color(0.22f, 0.27f, 0.42f));
            Shader.SetGlobalVector("_MB_RimDir", new Vector4(0.15f, 0.45f, 1f, 0));
            Shader.SetGlobalColor("_MB_RimLight", new Color(0.62f, 0.45f, 1f));
            _key.shadows = q.SoftShadows ? LightShadows.Soft : LightShadows.Hard;
            _key.shadowStrength = 0.7f;

            // ---- floor ----
            var floor = GameObject.CreatePrimitive(PrimitiveType.Plane);
            Destroy(floor.GetComponent<Collider>());
            floor.name = "Floor";
            floor.transform.SetParent(transform, false);
            floor.transform.localScale = new Vector3(2.8f, 1, 2.8f); // 28m
            _floorMat = new Material(MBAssets.Floor) { mainTexture = ProceduralTextures.Floor(tex) };
            _floorMat.SetColor("_BaseColor", new Color(0.24f, 0.22f, 0.42f)); // brighter polished floor
            _floorMat.SetColor("_GlowColor", Palette.StageNeonA);
            _floorMat.SetColor("_GlowColor2", Palette.StageNeonB);
            _floorMat.SetFloat("_GlowBoost", 1.4f);
            _floorMat.SetFloat("_Sheen", 1.1f);
            floor.GetComponent<Renderer>().sharedMaterial = _floorMat;
            floor.GetComponent<Renderer>().receiveShadows = true;
            floor.AddComponent<PlanarReflection>().Strength = q.Tier == QualityTier.PcHigh ? 0.4f : 0.3f;

            // outer floor (darker) so the arena edge does not end abruptly
            var outer = GameObject.CreatePrimitive(PrimitiveType.Plane);
            Destroy(outer.GetComponent<Collider>());
            outer.name = "OuterFloor";
            outer.transform.SetParent(transform, false);
            outer.transform.localPosition = new Vector3(0, -0.01f, 0);
            outer.transform.localScale = new Vector3(9, 1, 9);
            outer.GetComponent<Renderer>().sharedMaterial = MBAssets.ToonMaterial(new Color(0.07f, 0.06f, 0.14f), new Color(0, 0, 0, 0), 4, 0.6f);

            // ---- ring-out neon line ----
            NeonCircle(FighterController.ArenaRadius + 0.6f, 0.02f, Palette.StageNeonB, 0.08f);
            NeonCircle(FighterController.ArenaRadius + 0.9f, 0.02f, Palette.StageNeonA, 0.05f);

            // ---- surrounding wall ----
            var wall = BuildCylinderWall(26f, 14f, 48);
            wall.transform.SetParent(transform, false);
            var wallMat = MBAssets.ToonMaterial(Color.white, new Color(0, 0, 0, 0), 4, 0f, new Color(0.15f, 0.12f, 0.28f));
            wallMat.mainTexture = ProceduralTextures.Wall(tex);
            wallMat.mainTextureScale = new Vector2(3, 1);
            wallMat.SetColor("_Color", new Color(1.05f, 1.05f, 1.2f)); // background never brighter than the fighters
            wall.GetComponent<Renderer>().sharedMaterial = wallMat;
            wall.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;

            // ---- neon pillars + ceiling rigs ----
            var pillarMat = MBAssets.ToonMaterial(new Color(0.12f, 0.11f, 0.2f), Palette.StageNeonA.WithAlpha(0.6f), 3f, 0.6f);
            for (int i = 0; i < 10; i++)
            {
                float a = i / 10f * Mathf.PI * 2f + 0.3f;
                var p = new Vector3(Mathf.Cos(a) * 17f, 0, Mathf.Sin(a) * 17f);
                var pillar = Block(PrimitiveType.Cube, p + Vector3.up * 5f, new Vector3(0.8f, 10f, 0.8f), pillarMat);
                pillar.LookAt(new Vector3(0, pillar.position.y, 0));
                var strip = Block(PrimitiveType.Cube, p + Vector3.up * 5f - p.normalized * 0.42f, new Vector3(0.12f, 9.5f, 0.05f),
                    MBAssets.AdditiveMaterial(ProceduralTextures.White, i % 2 == 0 ? Palette.StageNeonA : Palette.StageNeonB, 1.4f));
                strip.LookAt(new Vector3(0, strip.position.y, 0));
            }
            for (int i = 0; i < 4; i++)
            {
                // overhead light bars (concept images: strong ceiling strips)
                var bar = Block(PrimitiveType.Cube, new Vector3(-6f + i * 4f, 11f, 0), new Vector3(0.25f, 0.08f, 16f),
                    MBAssets.AdditiveMaterial(ProceduralTextures.White, new Color(0.85f, 0.9f, 1f), 1.6f));
                bar.name = "CeilingLight";
            }

            // ---- anatomy hologram displays (background, §32) ----
            Hologram(new Vector3(-7.5f, 3.6f, 11.5f), new Vector2(4.2f, 4.2f), ProceduralTextures.AnatomyDisplay(tex, 1), Palette.Nerve, -18f);
            Hologram(new Vector3(7.5f, 3.6f, 11.5f), new Vector2(4.2f, 4.2f), ProceduralTextures.AnatomyDisplay(tex, 0), Palette.Nerve, 18f);
            Hologram(new Vector3(0f, 4.6f, 14.5f), new Vector2(6f, 6f), ProceduralTextures.AnatomyDisplay(tex, 0), Palette.StageNeonA, 0f);
            Hologram(new Vector3(-7.5f, 3.6f, -11.5f), new Vector2(4.2f, 4.2f), ProceduralTextures.AnatomyDisplay(tex, 0), Palette.Nerve, 180 + 18f);
            Hologram(new Vector3(7.5f, 3.6f, -11.5f), new Vector2(4.2f, 4.2f), ProceduralTextures.AnatomyDisplay(tex, 1), Palette.Nerve, 180 - 18f);

            // rotating hologram body above the arena
            var body = new GameObject("HoloFigure").transform;
            body.SetParent(transform, false);
            body.localPosition = new Vector3(0, 7.2f, 9f);
            var holoMat = MBAssets.HologramMaterial(Palette.StageNeonB, 0.55f, null, 40f);
            _holoMats.Add(holoMat);
            HoloFigure(body, holoMat);
            _spinners.Add(body);

            // ---- banners ----
            var bannerMat = MBAssets.ToonMaterial(Color.white, new Color(0, 0, 0, 0), 4, 0, new Color(0.25f, 0.05f, 0.15f));
            bannerMat.mainTexture = ProceduralTextures.Banner(tex);
            for (int i = -1; i <= 1; i += 2)
            {
                var banner = GameObject.CreatePrimitive(PrimitiveType.Quad);
                Destroy(banner.GetComponent<Collider>());
                banner.name = "Banner";
                banner.transform.SetParent(transform, false);
                banner.transform.position = new Vector3(i * 12.5f, 6f, 8f);
                banner.transform.rotation = Quaternion.LookRotation(new Vector3(i * 12.5f, 0, 8f).normalized * 1f);
                banner.transform.localScale = new Vector3(2.4f, 4.8f, 1);
                banner.GetComponent<Renderer>().sharedMaterial = bannerMat;
            }

            // ---- signage ----
            Sign("MUSCLE BATTLE", new Vector3(0, 9.3f, 15.5f), 1.0f, Palette.Bone);
            Sign("스포츠 재활센터  ·  SPORTS REHAB CENTER", new Vector3(0, 1.9f, 16.5f), 0.45f, Palette.Nerve);

            // ---- light shafts ----
            if (q.StageLightShafts)
            {
                var shaft = MBAssets.AdditiveMaterial(ProceduralTextures.GradientV, new Color(0.6f, 0.5f, 1f, 0.12f), 1f);
                for (int i = 0; i < 6; i++)
                {
                    var s = GameObject.CreatePrimitive(PrimitiveType.Quad);
                    Destroy(s.GetComponent<Collider>());
                    s.name = "LightShaft";
                    s.transform.SetParent(transform, false);
                    s.transform.position = new Vector3(-10f + i * 4f, 5.5f, 6f + (i % 2) * 2f);
                    s.transform.rotation = Quaternion.Euler(0, 0, (i - 2.5f) * 6f);
                    s.transform.localScale = new Vector3(1.6f, 11f, 1);
                    var r = s.GetComponent<Renderer>();
                    r.sharedMaterial = shaft;
                    r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                }
            }

            // ---- depth layers: rehab equipment silhouettes, backlit crowd, LED ticker ----
            BuildEquipment();
            BuildCrowd(tex);
            BuildTicker();

            // ---- ambient motes ----
            Motes(q.AmbientMotes);
        }

        public void ImpactPulse(ImpactTier tier)
        {
            _pulse = Mathf.Max(_pulse, tier switch { ImpactTier.Light => 0.2f, ImpactTier.Medium => 0.5f, ImpactTier.Heavy => 1.2f, _ => 2.4f });
            if (tier >= ImpactTier.Heavy) _holoGlitch = 0.25f;
        }

        void Update()
        {
            float dt = Time.unscaledDeltaTime;
            _pulse = Mathf.MoveTowards(_pulse, 0, dt * 3f);
            if (_floorMat != null) _floorMat.SetFloat("_Pulse", _pulse);
            _holoGlitch = Mathf.Max(0, _holoGlitch - dt);
            foreach (var m in _holoMats) m.SetFloat("_Flicker", _holoGlitch > 0 ? 0.9f : 0.1f);
            foreach (var s in _spinners) s.Rotate(0, 20f * dt, 0, Space.World);
            if (_tickerMat != null) _tickerMat.mainTextureOffset = new Vector2(Time.unscaledTime * 0.03f, 0);
        }

        // ------------------------------------------------------------------
        // Background set dressing (dark silhouettes with neon rim so they read as depth, not clutter)
        // ------------------------------------------------------------------
        Material _tickerMat;

        void BuildEquipment()
        {
            var body = MBAssets.ToonMaterial(new Color(0.1f, 0.09f, 0.18f), Palette.StageNeonB.WithAlpha(0.55f), 2.5f, 0.6f);
            var accent = MBAssets.ToonMaterial(new Color(0.16f, 0.14f, 0.3f), Palette.StageNeonA.WithAlpha(0.7f), 2f, 0.7f, Palette.StageNeonA * 0.12f);
            var ball = MBAssets.ToonMaterial(new Color(0.18f, 0.3f, 0.6f), Palette.StageNeonB.WithAlpha(0.6f), 2f, 0.8f);

            // place sets around the back and sides of the ring (radius 11-13), facing the centre
            Place(Treadmill(body, accent), 12.5f, 60f);
            Place(Treadmill(body, accent), 12.5f, 78f);
            Place(CableMachine(body, accent), 13f, 100f);
            Place(TreatmentTable(body, accent), 12f, 120f);
            Place(DumbbellRack(body, accent), 12.5f, 38f);
            Place(Bench(body, accent), 11.5f, 140f);
            Place(Ball(ball), 11.2f, 132f);
            Place(Ball(ball), 11.4f, 48f);
            Place(CableMachine(body, accent), 13f, 260f); // front side, mostly behind the camera
        }

        void Place(Transform t, float radius, float angleDeg)
        {
            float a = angleDeg * Mathf.Deg2Rad;
            t.SetParent(transform, false);
            t.position = new Vector3(Mathf.Cos(a) * radius, 0, Mathf.Sin(a) * radius);
            t.rotation = Quaternion.LookRotation(-new Vector3(t.position.x, 0, t.position.z).normalized);
        }

        Transform Group(string n) => new GameObject(n).transform;

        Transform Box(Transform parent, Vector3 pos, Vector3 size, Material m, PrimitiveType type = PrimitiveType.Cube)
        {
            var go = GameObject.CreatePrimitive(type);
            Destroy(go.GetComponent<Collider>());
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = size;
            var r = go.GetComponent<Renderer>();
            r.sharedMaterial = m;
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            return go.transform;
        }

        Transform Treadmill(Material b, Material a)
        {
            var g = Group("Treadmill");
            Box(g, new Vector3(0, 0.15f, 0), new Vector3(0.9f, 0.3f, 2f), b);
            Box(g, new Vector3(0, 0.31f, -0.05f), new Vector3(0.7f, 0.03f, 1.7f), a);
            Box(g, new Vector3(-0.4f, 0.75f, 0.85f), new Vector3(0.06f, 1.2f, 0.06f), b);
            Box(g, new Vector3(0.4f, 0.75f, 0.85f), new Vector3(0.06f, 1.2f, 0.06f), b);
            Box(g, new Vector3(0, 1.38f, 0.9f), new Vector3(0.9f, 0.3f, 0.12f), a).localRotation = Quaternion.Euler(-25, 0, 0);
            return g;
        }

        Transform CableMachine(Material b, Material a)
        {
            var g = Group("CableMachine");
            Box(g, new Vector3(-0.8f, 1.2f, 0), new Vector3(0.12f, 2.4f, 0.12f), b);
            Box(g, new Vector3(0.8f, 1.2f, 0), new Vector3(0.12f, 2.4f, 0.12f), b);
            Box(g, new Vector3(0, 2.4f, 0), new Vector3(1.75f, 0.12f, 0.2f), b);
            Box(g, new Vector3(0, 0.6f, -0.1f), new Vector3(0.45f, 1.1f, 0.25f), a);
            Box(g, new Vector3(-0.8f, 0.05f, 0), new Vector3(0.5f, 0.1f, 0.6f), b);
            Box(g, new Vector3(0.8f, 0.05f, 0), new Vector3(0.5f, 0.1f, 0.6f), b);
            return g;
        }

        Transform TreatmentTable(Material b, Material a)
        {
            var g = Group("TreatmentTable");
            Box(g, new Vector3(0, 0.72f, 0), new Vector3(0.75f, 0.12f, 2f), a);
            Box(g, new Vector3(0, 0.82f, -0.85f), new Vector3(0.6f, 0.08f, 0.3f), b);
            foreach (var x in new[] { -0.3f, 0.3f })
                foreach (var z in new[] { -0.85f, 0.85f })
                    Box(g, new Vector3(x, 0.35f, z), new Vector3(0.06f, 0.7f, 0.06f), b);
            return g;
        }

        Transform DumbbellRack(Material b, Material a)
        {
            var g = Group("DumbbellRack");
            Box(g, new Vector3(0, 0.45f, 0), new Vector3(2.2f, 0.08f, 0.5f), b);
            Box(g, new Vector3(0, 0.85f, -0.1f), new Vector3(2.2f, 0.08f, 0.4f), b);
            Box(g, new Vector3(-1.05f, 0.45f, 0), new Vector3(0.08f, 0.9f, 0.5f), b);
            Box(g, new Vector3(1.05f, 0.45f, 0), new Vector3(0.08f, 0.9f, 0.5f), b);
            for (int i = 0; i < 6; i++)
            {
                float x = -0.85f + i * 0.34f;
                for (int row = 0; row < 2; row++)
                {
                    float y = row == 0 ? 0.56f : 0.96f;
                    Box(g, new Vector3(x, y, row == 0 ? 0 : -0.1f), new Vector3(0.05f, 0.12f, 0.05f), b, PrimitiveType.Cylinder).localRotation = Quaternion.Euler(90, 0, 0);
                    Box(g, new Vector3(x, y, (row == 0 ? 0 : -0.1f) - 0.13f), Vector3.one * 0.13f, a, PrimitiveType.Sphere);
                    Box(g, new Vector3(x, y, (row == 0 ? 0 : -0.1f) + 0.13f), Vector3.one * 0.13f, a, PrimitiveType.Sphere);
                }
            }
            return g;
        }

        Transform Bench(Material b, Material a)
        {
            var g = Group("Bench");
            Box(g, new Vector3(0, 0.45f, 0), new Vector3(0.35f, 0.1f, 1.3f), a);
            Box(g, new Vector3(0, 0.22f, -0.5f), new Vector3(0.08f, 0.45f, 0.08f), b);
            Box(g, new Vector3(0, 0.22f, 0.5f), new Vector3(0.08f, 0.45f, 0.08f), b);
            return g;
        }

        Transform Ball(Material m)
        {
            var g = Group("ExerciseBall");
            Box(g, new Vector3(0, 0.34f, 0), Vector3.one * 0.68f, m, PrimitiveType.Sphere);
            return g;
        }

        void BuildCrowd(int tex)
        {
            // backlit crowd silhouettes between the equipment and the LED wall
            var wall = BuildCylinderWall(19.5f, 3.2f, 64);
            wall.name = "Crowd";
            wall.transform.SetParent(transform, false);
            wall.transform.position = new Vector3(0, 0.2f, 0);
            var mat = MBAssets.ToonMaterial(Color.white, new Color(0, 0, 0, 0), 4, 0f, new Color(0.05f, 0.03f, 0.1f));
            mat.mainTexture = ProceduralTextures.Crowd(tex);
            mat.mainTextureScale = new Vector2(10, 1);
            wall.GetComponent<Renderer>().sharedMaterial = mat;
            wall.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        }

        void BuildTicker()
        {
            var band = BuildCylinderWall(19.4f, 0.45f, 64);
            band.name = "LedTicker";
            band.transform.SetParent(transform, false);
            band.transform.position = new Vector3(0, 3.55f, 0);
            _tickerMat = MBAssets.AdditiveMaterial(ProceduralTextures.LedBand, Color.white, 1.2f);
            _tickerMat.mainTextureScale = new Vector2(12, 1);
            var r = band.GetComponent<Renderer>();
            r.sharedMaterial = _tickerMat;
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        }

        // ------------------------------------------------------------------
        Transform Block(PrimitiveType t, Vector3 pos, Vector3 scale, Material m)
        {
            var go = GameObject.CreatePrimitive(t);
            Destroy(go.GetComponent<Collider>());
            go.transform.SetParent(transform, false);
            go.transform.position = pos;
            go.transform.localScale = scale;
            var r = go.GetComponent<Renderer>();
            r.sharedMaterial = m;
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            return go.transform;
        }

        void Hologram(Vector3 pos, Vector2 size, Texture tex, Color color, float yaw)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Quad);
            Destroy(go.GetComponent<Collider>());
            go.name = "HoloDisplay";
            go.transform.SetParent(transform, false);
            go.transform.position = pos;
            go.transform.rotation = Quaternion.Euler(0, yaw, 0);
            go.transform.localScale = new Vector3(size.x, size.y, 1);
            var mat = MBAssets.HologramMaterial(color, 0.95f, tex, 70f);
            mat.SetFloat("_Fresnel", 0.2f);
            _holoMats.Add(mat);
            var r = go.GetComponent<Renderer>();
            r.sharedMaterial = mat;
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            // back panel glow
            var glow = Block(PrimitiveType.Quad, pos + go.transform.forward * 0.05f, new Vector3(size.x * 1.15f, size.y * 1.15f, 1),
                MBAssets.AdditiveMaterial(ProceduralTextures.SoftGlow, color.WithAlpha(0.18f), 1f));
            glow.rotation = go.transform.rotation;
        }

        void HoloFigure(Transform root, Material mat)
        {
            void P(PrimitiveType t, Vector3 p, Vector3 s)
            {
                var go = GameObject.CreatePrimitive(t);
                Destroy(go.GetComponent<Collider>());
                go.transform.SetParent(root, false);
                go.transform.localPosition = p;
                go.transform.localScale = s;
                var r = go.GetComponent<Renderer>();
                r.sharedMaterial = mat;
                r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            }
            float k = 1.6f;
            P(PrimitiveType.Sphere, new Vector3(0, 1.62f, 0) * k, new Vector3(0.22f, 0.27f, 0.24f) * k);
            P(PrimitiveType.Sphere, new Vector3(0, 1.25f, 0) * k, new Vector3(0.5f, 0.36f, 0.3f) * k);
            P(PrimitiveType.Capsule, new Vector3(0, 0.98f, 0) * k, new Vector3(0.32f, 0.22f, 0.22f) * k);
            P(PrimitiveType.Capsule, new Vector3(-0.38f, 1.42f, 0) * k, new Vector3(0.12f, 0.2f, 0.12f) * k);
            P(PrimitiveType.Capsule, new Vector3(0.38f, 1.42f, 0) * k, new Vector3(0.12f, 0.2f, 0.12f) * k);
            P(PrimitiveType.Capsule, new Vector3(-0.42f, 1.75f, 0) * k, new Vector3(0.1f, 0.18f, 0.1f) * k);
            P(PrimitiveType.Capsule, new Vector3(0.42f, 1.75f, 0) * k, new Vector3(0.1f, 0.18f, 0.1f) * k);
            P(PrimitiveType.Capsule, new Vector3(-0.13f, 0.45f, 0) * k, new Vector3(0.16f, 0.45f, 0.16f) * k);
            P(PrimitiveType.Capsule, new Vector3(0.13f, 0.45f, 0) * k, new Vector3(0.16f, 0.45f, 0.16f) * k);
        }

        void NeonCircle(float radius, float y, Color color, float width)
        {
            var go = new GameObject("NeonRing");
            go.transform.SetParent(transform, false);
            var lr = go.AddComponent<LineRenderer>();
            const int seg = 96;
            lr.positionCount = seg;
            lr.loop = true;
            lr.useWorldSpace = false;
            lr.widthMultiplier = width;
            lr.alignment = LineAlignment.TransformZ;
            go.transform.rotation = Quaternion.Euler(90, 0, 0);
            go.transform.position = new Vector3(0, y, 0);
            // positions are in XZ; with TransformZ alignment the ribbon lies flat on the floor
            for (int i = 0; i < seg; i++)
            {
                float a = i / (float)seg * Mathf.PI * 2f;
                lr.SetPosition(i, new Vector3(Mathf.Cos(a) * radius, Mathf.Sin(a) * radius, 0));
            }
            lr.material = MBAssets.AdditiveMaterial(ProceduralTextures.Streak, color, 2f);
            lr.textureMode = LineTextureMode.Stretch;
            lr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        }

        void Sign(string text, Vector3 pos, float size, Color color)
        {
            var go = new GameObject("Sign");
            go.transform.SetParent(transform, false);
            go.transform.position = pos;
            go.transform.rotation = Quaternion.LookRotation(new Vector3(pos.x, 0, pos.z).normalized);
            var tm = go.AddComponent<TextMesh>();
            tm.font = MBAssets.FontHeavy;
            tm.text = text;
            tm.fontSize = 96;
            tm.characterSize = size * 0.1f;
            tm.anchor = TextAnchor.MiddleCenter;
            tm.color = color;
            go.GetComponent<MeshRenderer>().sharedMaterial = MBAssets.Text3D(tm.font);
            // soft glow behind the sign
            var glow = Block(PrimitiveType.Quad, pos + go.transform.forward * 0.1f, new Vector3(text.Length * size * 0.75f, size * 2.5f, 1),
                MBAssets.AdditiveMaterial(ProceduralTextures.SoftGlow, color.WithAlpha(0.25f), 1f));
            glow.rotation = go.transform.rotation;
        }

        void Motes(int count)
        {
            if (count <= 0) return;
            var go = new GameObject("Motes");
            go.transform.SetParent(transform, false);
            go.transform.position = new Vector3(0, 3f, 0);
            var ps = go.AddComponent<ParticleSystem>();
            ps.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            var m = ps.main;
            m.loop = true;
            m.prewarm = true;
            m.startLifetime = 8f;
            m.startSpeed = 0.15f;
            m.startSize = new ParticleSystem.MinMaxCurve(0.03f, 0.09f);
            m.maxParticles = count;
            m.startColor = new ParticleSystem.MinMaxGradient(Palette.StageNeonB.WithAlpha(0.6f), Palette.StageNeonA.WithAlpha(0.6f));
            var e = ps.emission;
            e.rateOverTime = count / 8f;
            var sh = ps.shape;
            sh.shapeType = ParticleSystemShapeType.Box;
            sh.scale = new Vector3(22, 6, 22);
            var r = go.GetComponent<ParticleSystemRenderer>();
            r.sharedMaterial = MBAssets.SharedAdditive("glow", ProceduralTextures.SoftGlow);
            ps.Play();
        }

        static GameObject BuildCylinderWall(float radius, float height, int segments)
        {
            var go = new GameObject("ArenaWall");
            var mf = go.AddComponent<MeshFilter>();
            go.AddComponent<MeshRenderer>();
            var mesh = new Mesh { name = "ArenaWall" };
            var verts = new Vector3[(segments + 1) * 2];
            var uvs = new Vector2[verts.Length];
            var norms = new Vector3[verts.Length];
            var tris = new int[segments * 6];
            for (int i = 0; i <= segments; i++)
            {
                float a = i / (float)segments * Mathf.PI * 2f;
                var dir = new Vector3(Mathf.Cos(a), 0, Mathf.Sin(a));
                verts[i * 2] = dir * radius;
                verts[i * 2 + 1] = dir * radius + Vector3.up * height;
                uvs[i * 2] = new Vector2(i / (float)segments, 0);
                uvs[i * 2 + 1] = new Vector2(i / (float)segments, 1);
                norms[i * 2] = norms[i * 2 + 1] = -dir;
            }
            for (int i = 0; i < segments; i++)
            {
                int v = i * 2, t = i * 6;
                // clockwise when seen from the arena centre => faces inward
                tris[t] = v; tris[t + 1] = v + 2; tris[t + 2] = v + 1;
                tris[t + 3] = v + 2; tris[t + 4] = v + 3; tris[t + 5] = v + 1;
            }
            mesh.vertices = verts;
            mesh.uv = uvs;
            mesh.normals = norms;
            mesh.triangles = tris;
            mesh.RecalculateBounds();
            mf.sharedMesh = mesh;
            return go;
        }
    }
}
