// NERVE RUNNER - CH.7 "대뇌 도시" scenery (concept art ⑥): a city on the folded cortex.
// Each lobe district has its own colour and landmark that hints at its function:
//   frontal  (orange)  planning towers + command dome   -> motor planning, speech production
//   parietal (teal)    sensor dishes / antenna arrays    -> body sensation, spatial awareness
//   temporal (purple)  sound-wave bars + memory archive  -> hearing, language comprehension, memory
//   occipital (blue)   giant lenses / screens            -> vision
// Rounded purple ridges (gyri) form the ground under the elevated neon roads. View-only, static-batched.
using NeonRacer;
using NerveRunner.Core;
using UnityEngine;

namespace NerveRunner
{
    public static class CerebrumCityView
    {
        public static bool IsDistrict(string theme)
        {
            return theme == "frontal" || theme == "parietal" || theme == "temporal" || theme == "occipital";
        }

        public static Color DistrictColor(string theme)
        {
            switch (theme)
            {
                case "frontal": return Pal.Hex(0xFF9A3D);
                case "parietal": return Pal.Hex(0x2EE6D6);
                case "temporal": return Pal.Hex(0xB46BFF);
                case "occipital": return Pal.Hex(0x4D8DFF);
                default: return Pal.Cyan;
            }
        }

        public static void Build(TrackSegment seg, Transform root, int seed)
        {
            if (!IsDistrict(seg.theme)) return;
            var props = new GameObject("CityProps").transform;
            props.SetParent(root, false);
            root = props;
            var rnd = new System.Random(seed);
            Color c = DistrictColor(seg.theme);
            var gyrusMat = NRMats.Toon(Pal.Hex(0x8A4FD0), Pal.Hex(0x3A1F78), Pal.Hex(0xF0B0FF), 2.2f, Pal.Hex(0x2A1050));
            var bodyMat = NRMats.Toon(Pal.Hex(0x2A2260), Pal.Hex(0x120E36), c, 2f, c * 0.15f);
            var glowMat = Mats.Emissive(c * 0.6f, c * 1.8f);
            var whiteGlow = Mats.Emissive(Color.white, c * 1.2f);

            for (float s = 20f; s < seg.length - 10f; s += 34f)
            {
                Vector3 t = seg.TangentAt(s);
                Quaternion q = Quaternion.LookRotation(t, Vector3.up);
                foreach (float side in new[] { -1f, 1f })
                {
                    // gyrus ridge (brain surface) well below and beside the road
                    var gy = MeshKit.Prim(PrimitiveType.Capsule, root, Vector3.zero, new Vector3(16f, 26f, 12f), gyrusMat, "Gyrus");
                    gy.transform.position = seg.WorldPos(s, side * (seg.halfWidth + 22f + (float)rnd.NextDouble() * 10f), -16f - (float)rnd.NextDouble() * 4f);
                    gy.transform.rotation = q * Quaternion.Euler(90f, (float)rnd.NextDouble() * 30f - 15f, 0f);

                    if (rnd.NextDouble() < 0.35) continue;
                    Vector3 basePos = seg.WorldPos(s + (float)rnd.NextDouble() * 10f, side * (seg.halfWidth + 12f + (float)rnd.NextDouble() * 14f), -4f);
                    var lm = new GameObject("Landmark_" + seg.theme).transform;
                    lm.SetParent(root, false);
                    lm.position = basePos;
                    lm.rotation = q;
                    switch (seg.theme)
                    {
                        case "frontal":   Tower(lm, rnd, bodyMat, glowMat); break;
                        case "parietal":  Dish(lm, rnd, bodyMat, glowMat, whiteGlow); break;
                        case "temporal":  SoundBars(lm, rnd, bodyMat, glowMat); break;
                        default:          Lens(lm, rnd, bodyMat, glowMat, whiteGlow); break;
                    }
                }
            }
            NeuralBackdrop.SetLayer(props, Gfx.PropsLayer);   // PERF: distance-culled
        }

        // frontal: stacked planning towers with glowing window bands
        static void Tower(Transform p, System.Random rnd, Material body, Material glow)
        {
            float h = 14f + (float)rnd.NextDouble() * 18f;
            MeshKit.Prim(PrimitiveType.Cube, p, new Vector3(0f, h * 0.5f, 0f), new Vector3(3.2f, h, 3.2f), body, "Tower");
            for (float y = 3f; y < h; y += 3.2f)
                MeshKit.Prim(PrimitiveType.Cube, p, new Vector3(0f, y, 0f), new Vector3(3.4f, 0.35f, 3.4f), glow, "Window");
            MeshKit.Prim(PrimitiveType.Cylinder, p, new Vector3(0f, h + 2f, 0f), new Vector3(0.3f, 2f, 0.3f), glow, "Spire");
            if (rnd.NextDouble() < 0.5)
                MeshKit.Prim(PrimitiveType.Sphere, p, new Vector3(5f, 2f, 0f), new Vector3(7f, 5f, 7f), body, "CommandDome");
        }

        // parietal: sensor dishes on poles (sensation)
        static void Dish(Transform p, System.Random rnd, Material body, Material glow, Material white)
        {
            float h = 8f + (float)rnd.NextDouble() * 8f;
            MeshKit.Prim(PrimitiveType.Cylinder, p, new Vector3(0f, h * 0.5f, 0f), new Vector3(0.6f, h * 0.5f, 0.6f), body, "Pole");
            var d = MeshKit.Prim(PrimitiveType.Sphere, p, new Vector3(0f, h + 1f, 0f), new Vector3(6f, 1.2f, 6f), glow, "Dish");
            d.transform.localRotation = Quaternion.Euler(-35f + (float)rnd.NextDouble() * 20f, (float)rnd.NextDouble() * 360f, 0f);
            MeshKit.Prim(PrimitiveType.Sphere, p, new Vector3(0f, h + 2.4f, 0f), Vector3.one * 0.7f, white, "Receiver");
        }

        // temporal: equalizer-like sound-wave bars + archive dome (hearing & memory)
        static void SoundBars(Transform p, System.Random rnd, Material body, Material glow)
        {
            for (int i = 0; i < 7; i++)
            {
                float h = 2f + Mathf.Abs(Mathf.Sin(i * 0.9f + (float)rnd.NextDouble())) * 9f;
                MeshKit.Prim(PrimitiveType.Cube, p, new Vector3((i - 3) * 1.4f, h * 0.5f, 0f), new Vector3(0.9f, h, 0.9f), glow, "SoundBar");
            }
            if (rnd.NextDouble() < 0.6)
                MeshKit.Prim(PrimitiveType.Sphere, p, new Vector3(0f, 1f, 6f), new Vector3(9f, 6f, 9f), body, "MemoryArchive");
        }

        // occipital: giant lenses / screens (vision)
        static void Lens(Transform p, System.Random rnd, Material body, Material glow, Material white)
        {
            float h = 8f + (float)rnd.NextDouble() * 6f;
            MeshKit.Prim(PrimitiveType.Cylinder, p, new Vector3(0f, h * 0.5f, 0f), new Vector3(0.8f, h * 0.5f, 0.8f), body, "Stand");
            var ring = MeshKit.MeshObject(p, "LensRing", MeshKit.Torus(3.6f, 0.45f, 32, 6), glow);
            ring.transform.localPosition = new Vector3(0f, h + 3.6f, 0f);
            ring.transform.localRotation = Quaternion.Euler(0f, 90f, 0f);
            var lens = MeshKit.Prim(PrimitiveType.Sphere, p, new Vector3(0f, h + 3.6f, 0f), new Vector3(1.2f, 6.6f, 6.6f), white, "Lens");
            lens.transform.localRotation = Quaternion.identity;
        }
    }
}
