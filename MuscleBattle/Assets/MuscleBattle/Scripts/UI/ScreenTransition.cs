using System;
using System.Collections;
using UnityEngine;
using UnityEngine.UI;

namespace MuscleBattle
{
    /// <summary>
    /// MUSCLE BATTLE signature transition (§57): two slanted "muscle fibre" panels slash across,
    /// cover the screen, the callback swaps the screen, then they slide away.
    /// </summary>
    public sealed class ScreenTransition : MonoBehaviour
    {
        public static ScreenTransition Instance { get; private set; }
        RectTransform _a, _b;
        Image _fiberA, _fiberB;
        public bool Busy { get; private set; }

        public static ScreenTransition Create(Transform canvas)
        {
            var root = UIKit.Node("Transition", canvas);
            root.Stretch();
            var st = root.gameObject.AddComponent<ScreenTransition>();
            st._a = st.Panel(root, Palette.Muscle, out st._fiberA);
            st._b = st.Panel(root, Palette.Mastery, out st._fiberB);
            st._a.gameObject.SetActive(false);
            st._b.gameObject.SetActive(false);
            return st;
        }

        void Awake() { Instance = this; }

        RectTransform Panel(RectTransform root, Color c, out Image fiber)
        {
            var bg = UIKit.Img(root, "Slash", UIKit.Para, new Color(0.06f, 0.02f, 0.12f, 1f));
            bg.rectTransform.Place(new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(2600, 700));
            fiber = UIKit.Img(bg.rectTransform, "Fiber", MBAssets.SpriteFrom(ProceduralTextures.Fiber), c.WithAlpha(0.55f));
            fiber.rectTransform.Stretch(20);
            var edge = UIKit.Img(bg.rectTransform, "Edge", UIKit.ParaOutline, Color.Lerp(c, Color.white, 0.4f));
            edge.rectTransform.Stretch(-4);
            var logo = UIKit.Label(bg.rectTransform, "MUSCLE BATTLE", 90, Color.white.WithAlpha(0.12f), TextAnchor.MiddleCenter, true, false, true);
            logo.rectTransform.Stretch();
            bg.rectTransform.localRotation = Quaternion.Euler(0, 0, 8);
            return bg.rectTransform;
        }

        public IEnumerator Play(Action atMidpoint)
        {
            Busy = true;
            AudioManager.Instance?.PlaySfx("ui_transition", 0.8f);
            _a.gameObject.SetActive(true);
            _b.gameObject.SetActive(true);
            _a.SetAsLastSibling();
            _b.SetAsLastSibling();
            const float inT = 0.22f, outT = 0.25f;
            float t = 0;
            while (t < inT)
            {
                t += Time.unscaledDeltaTime;
                float k = Mathf.SmoothStep(0, 1, t / inT);
                _a.anchoredPosition = new Vector2(Mathf.Lerp(-2800, 0, k), 250);
                _b.anchoredPosition = new Vector2(Mathf.Lerp(2800, 0, k), -250);
                yield return null;
            }
            _a.anchoredPosition = new Vector2(0, 250);
            _b.anchoredPosition = new Vector2(0, -250);
            atMidpoint?.Invoke();
            yield return new WaitForSecondsRealtime(0.08f);
            t = 0;
            while (t < outT)
            {
                t += Time.unscaledDeltaTime;
                float k = Mathf.SmoothStep(0, 1, t / outT);
                _a.anchoredPosition = new Vector2(Mathf.Lerp(0, 2800, k), 250);
                _b.anchoredPosition = new Vector2(Mathf.Lerp(0, -2800, k), -250);
                yield return null;
            }
            _a.gameObject.SetActive(false);
            _b.gameObject.SetActive(false);
            Busy = false;
        }
    }
}
