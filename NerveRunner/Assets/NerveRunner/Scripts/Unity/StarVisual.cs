// NERVE RUNNER - STAR-01, the player character: a cute, glowing, puffy yellow five-pointed
// star (no car, no kart, no humanoid). Built from a procedural mesh + primitives; animation is
// plain Transform maths (hover bob, lean, drift yaw, jump flip, boost wobble, expressions).
using NeonRacer;
using UnityEngine;

namespace NerveRunner
{
    public enum Expression { Normal, Focus, Joy, Surprise, Hurt, Heal, Clear }

    public class StarVisual : MonoBehaviour
    {
        public static readonly Color StarYellow = Pal.Hex(0xFFD34D);

        Transform body, face, orbit;
        Transform eyeL, eyeR, hiL, hiR, mouth, cheekL, cheekR;
        Light glow;
        TrailRenderer trail;
        Material bodyMat, bodyBoostMat;
        MeshRenderer bodyRenderer;

        Expression expr = Expression.Normal, baseExpr = Expression.Focus;
        float exprTimer, blinkTimer = 2f, blinkT;
        float spin, spinVel;      // jump flip / showcase spin (degrees)
        float t;

        public Expression Current { get { return expr; } }

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
            body.localScale = Vector3.one * 1.15f;

            bodyMat = Mats.Emissive(col, col * 0.55f);
            bodyBoostMat = Mats.Emissive(Color.Lerp(col, Color.white, 0.35f), col * 1.6f);
            var star = MeshKit.MeshObject(body, "StarMesh", MeshKit.PuffyStar(), bodyMat);
            bodyRenderer = star.GetComponent<MeshRenderer>();

            // ---- face on the front (+Z, direction of travel) ----
            face = new GameObject("Face").transform;
            face.SetParent(body, false);
            var eyeMat = Mats.Lit(Pal.Hex(0x1A1033), 0.1f, 0.85f);
            var whiteMat = Mats.Emissive(Color.white, Color.white * 0.8f);
            var cheekMat = Mats.Emissive(Pal.Hex(0xFF8FB8), Pal.Hex(0xFF5C9A) * 0.35f);
            var mouthMat = Mats.Lit(Pal.Hex(0x7A1838), 0.05f, 0.6f);
            const float Z = 0.44f;   // front surface of the puffy mesh near the centre
            eyeL = MeshKit.Prim(PrimitiveType.Sphere, face, new Vector3(-0.25f, 0.14f, Z), Vector3.one, eyeMat, "EyeL").transform;
            eyeR = MeshKit.Prim(PrimitiveType.Sphere, face, new Vector3(0.25f, 0.14f, Z), Vector3.one, eyeMat, "EyeR").transform;
            hiL = MeshKit.Prim(PrimitiveType.Sphere, face, new Vector3(-0.23f, 0.19f, Z + 0.05f), Vector3.one * 0.06f, whiteMat, "HiL").transform;
            hiR = MeshKit.Prim(PrimitiveType.Sphere, face, new Vector3(0.31f, 0.19f, Z + 0.05f), Vector3.one * 0.06f, whiteMat, "HiR").transform;
            mouth = MeshKit.Prim(PrimitiveType.Sphere, face, new Vector3(0f, -0.15f, Z + 0.01f), Vector3.one, mouthMat, "Mouth").transform;
            cheekL = MeshKit.Prim(PrimitiveType.Sphere, face, new Vector3(-0.44f, -0.1f, Z - 0.1f), new Vector3(0.2f, 0.11f, 0.05f), cheekMat, "CheekL").transform;
            cheekR = MeshKit.Prim(PrimitiveType.Sphere, face, new Vector3(0.44f, -0.1f, Z - 0.1f), new Vector3(0.2f, 0.11f, 0.05f), cheekMat, "CheekR").transform;

            // ---- back: glowing nerve "veins" from the centre to each tip (3-view sheet, back) ----
            var veinMat = Mats.Emissive(Pal.Cyan, Pal.Cyan * 1.4f);
            for (int i = 0; i < 5; i++)
            {
                float a = Mathf.PI * 0.5f + i * Mathf.PI * 2f / 5f;
                Vector3 dir = new Vector3(Mathf.Cos(a), Mathf.Sin(a), 0f);
                for (int k = 1; k <= 5; k++)
                {
                    float f = 0.13f * k;   // fraction of the arm length (tip radius = 1)
                    float z = -0.46f * Mathf.Sqrt(Mathf.Max(0f, 1f - Mathf.Pow(f, 2.4f))) - 0.008f;   // on the back surface
                    var v = MeshKit.Prim(PrimitiveType.Cube, body, dir * f + new Vector3(0f, 0f, z), new Vector3(0.035f, 0.13f, 0.025f), veinMat, "Vein");
                    v.transform.localRotation = Quaternion.Euler(0f, 0f, a * Mathf.Rad2Deg - 90f);
                }
            }

            // ---- orbit ring with three pearls ----
            orbit = new GameObject("Orbit").transform;
            orbit.SetParent(transform, false);
            orbit.localRotation = Quaternion.Euler(76f, 0f, 10f);
            orbit.localPosition = new Vector3(0f, -0.45f, 0f);   // ring circles the lower body, clear of the face
            var ringMat = Mats.Emissive(Pal.Hex(0xC9A8FF), Pal.Hex(0xB98CFF) * 1.2f);
            MeshKit.MeshObject(orbit, "Ring", MeshKit.Torus(1.75f, 0.03f, 48, 6), ringMat);
            var pearlMat = Mats.Emissive(Pal.Hex(0xFFE9A0), Pal.Hex(0xFFD34D) * 1.5f);
            for (int i = 0; i < 3; i++)
            {
                float a = i * Mathf.PI * 2f / 3f;
                MeshKit.Prim(PrimitiveType.Sphere, orbit, new Vector3(Mathf.Cos(a), Mathf.Sin(a), 0f) * 1.75f, Vector3.one * 0.16f, pearlMat, "Pearl");
            }

            // ---- light + trail ----
            var lg = new GameObject("Glow");
            lg.transform.SetParent(transform, false);
            glow = lg.AddComponent<Light>();
            glow.type = LightType.Point; glow.color = col; glow.range = 9f; glow.intensity = 2.2f;
            glow.shadows = LightShadows.None;

            trail = gameObject.AddComponent<TrailRenderer>();
            trail.sharedMaterial = Mats.Unlit(Pal.Hex(0xFFE27A));
            trail.time = 0.22f;
            trail.minVertexDistance = 0.4f;
            trail.widthCurve = new AnimationCurve(new Keyframe(0f, 0.9f), new Keyframe(1f, 0f));
            trail.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            trail.receiveShadows = false;

            SetExpression(Expression.Normal, 0f);
            ApplyFace(1f);
        }

        //================== EXPRESSIONS ==================\\
        public void SetBase(Expression e) { baseExpr = e; if (exprTimer <= 0f) expr = e; }

        public void SetExpression(Expression e, float duration)
        {
            expr = e; exprTimer = duration;
        }

        /// eye (w,h), mouth (w,h), eye y offset, highlight scale
        void ApplyFace(float blink)
        {
            Vector2 eye, m; float eyeY = 0.12f, hi = 0.06f, cheek = 1f;
            switch (expr)
            {
                case Expression.Focus:    eye = new Vector2(0.17f, 0.13f); m = new Vector2(0.14f, 0.04f); break;
                case Expression.Joy:      eye = new Vector2(0.19f, 0.05f); m = new Vector2(0.24f, 0.17f); eyeY = 0.15f; cheek = 1.3f; break;
                case Expression.Surprise: eye = new Vector2(0.2f, 0.27f);  m = new Vector2(0.11f, 0.14f); hi = 0.08f; break;
                case Expression.Hurt:     eye = new Vector2(0.2f, 0.05f);  m = new Vector2(0.15f, 0.05f); eyeY = 0.1f; cheek = 0.5f; break;
                case Expression.Heal:     eye = new Vector2(0.18f, 0.04f); m = new Vector2(0.16f, 0.08f); eyeY = 0.13f; cheek = 1.2f; break;
                case Expression.Clear:    eye = new Vector2(0.2f, 0.24f);  m = new Vector2(0.22f, 0.15f); hi = 0.11f; cheek = 1.3f; break;
                default:                  eye = new Vector2(0.16f, 0.22f); m = new Vector2(0.17f, 0.1f); break;
            }
            eye *= 1.3f;                               // big, cute eyes (concept sheet)
            eyeY += 0.02f;
            float eh = Mathf.Max(0.02f, eye.y * blink);
            eyeL.localScale = new Vector3(eye.x, eh, 0.08f);
            eyeR.localScale = new Vector3(eye.x, eh, 0.08f);
            eyeL.localPosition = new Vector3(-0.25f, eyeY, 0.44f);
            eyeR.localPosition = new Vector3(0.25f, eyeY, 0.44f);
            bool showHi = eh > 0.13f;
            hiL.gameObject.SetActive(showHi); hiR.gameObject.SetActive(showHi);
            hiL.localScale = hiR.localScale = Vector3.one * hi * 1.2f;
            hiL.localPosition = new Vector3(-0.205f, eyeY + eh * 0.28f, 0.49f);
            hiR.localPosition = new Vector3(0.295f, eyeY + eh * 0.28f, 0.49f);
            mouth.localScale = new Vector3(m.x, m.y, 0.05f);
            cheekL.localScale = cheekR.localScale = new Vector3(0.2f, 0.11f, 0.05f) * cheek;
        }

        //================== DRIVE ==================\\
        /// Called every frame by the race controller.
        public void Pose(Vector3 pos, Vector3 forward, float lateralVel, float vy, bool drifting, int driftDir,
                         bool boosting, float speed01, bool grounded, float dt)
        {
            t += dt;
            transform.position = pos;
            if (forward.sqrMagnitude > 1e-4f) transform.rotation = Quaternion.LookRotation(forward, Vector3.up);

            float roll = Mathf.Clamp(-lateralVel * 2.2f, -28f, 28f);
            float yaw = drifting ? driftDir * 28f : 0f;
            float pitch = Mathf.Clamp(-vy * 2f, -20f, 20f);
            float bob = grounded ? Mathf.Sin(t * 3.2f) * 0.09f : 0f;

            // jump flip: a full roll while airborne
            if (!grounded) spin += 520f * dt;
            else spin = Mathf.MoveTowards(spin, Mathf.Round(spin / 360f) * 360f, 900f * dt);
            if (spinVel > 0f) { spin += spinVel * dt; spinVel = Mathf.Max(0f, spinVel - 700f * dt); }
            float wobble = boosting ? Mathf.Sin(t * 30f) * 4f : 0f;

            body.localPosition = new Vector3(0f, bob, 0f);
            body.localRotation = Quaternion.Euler(pitch, yaw, roll + spin + wobble);
            bodyRenderer.sharedMaterial = boosting ? bodyBoostMat : bodyMat;

            orbit.Rotate(0f, 0f, (60f + 240f * speed01) * dt, Space.Self);
            glow.intensity = boosting ? 4.5f : 2.2f + Mathf.Sin(t * 4f) * 0.3f;
            trail.time = boosting ? 0.45f : 0.12f + 0.18f * speed01;
            trail.widthMultiplier = boosting ? 1.4f : 1f;

            // expressions + blink
            if (exprTimer > 0f) { exprTimer -= dt; if (exprTimer <= 0f) expr = baseExpr; }
            blinkTimer -= dt;
            float blink = 1f;
            if (blinkTimer < 0f)
            {
                blinkT += dt;
                blink = Mathf.Abs(Mathf.Cos(blinkT * Mathf.PI / 0.16f));
                if (blinkT > 0.16f) { blinkT = 0f; blinkTimer = 2.5f + Mathf.PerlinNoise(t, 0.3f) * 2f; }
            }
            ApplyFace(blink);
        }

        /// Showcase spin (start / correct answer / clear) so the player sees the face.
        public void Twirl(float degPerSec = 900f) { spinVel = degPerSec; }

        public void ClearTrail() { if (trail != null) trail.Clear(); }

        /// Idle menu animation (title screen).
        public void Idle(float dt)
        {
            t += dt;
            body.localPosition = new Vector3(0f, Mathf.Sin(t * 2f) * 0.12f, 0f);
            body.localRotation = Quaternion.Euler(0f, Mathf.Sin(t * 0.8f) * 18f, Mathf.Sin(t * 1.3f) * 6f);
            orbit.Rotate(0f, 0f, 70f * dt, Space.Self);
            if (exprTimer > 0f) { exprTimer -= dt; if (exprTimer <= 0f) expr = baseExpr; }
            blinkTimer -= dt;
            float blink = 1f;
            if (blinkTimer < 0f)
            {
                blinkT += dt;
                blink = Mathf.Abs(Mathf.Cos(blinkT * Mathf.PI / 0.16f));
                if (blinkT > 0.16f) { blinkT = 0f; blinkTimer = 3f; }
            }
            ApplyFace(blink);
        }
    }
}
