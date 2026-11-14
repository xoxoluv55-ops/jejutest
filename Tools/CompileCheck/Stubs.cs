// Compile-check stand-ins for package types not available as reference DLLs here.
// Member names were checked against the real package sources (Input System 1.x Keyboard.cs,
// ButtonControl.cs, InputSystemUIInputModule.cs; URP 17 types used by Neon Racer's code).
namespace UnityEngine.InputSystem.Controls
{
    public class ButtonControl { public bool isPressed => false; public bool wasPressedThisFrame => false; }
    public class KeyControl : ButtonControl { }
}
namespace UnityEngine.InputSystem
{
    using UnityEngine.InputSystem.Controls;
    public class Keyboard
    {
        public static Keyboard current { get; private set; }
        public KeyControl leftArrowKey, rightArrowKey, upArrowKey, downArrowKey, aKey, dKey, sKey, wKey, xKey, zKey, pKey,
                          spaceKey, leftCtrlKey, leftShiftKey, escapeKey, f2Key;
    }
}
namespace UnityEngine.InputSystem.UI
{
    public class InputSystemUIInputModule : UnityEngine.EventSystems.BaseInputModule { public override void Process() { } }
}
namespace UnityEngine.Rendering
{
    public class VolumeParameter<T> { public void Override(T v) { } }
    public class ClampedFloatParameter : VolumeParameter<float> { }
    public class MinFloatParameter : VolumeParameter<float> { }
    public abstract class VolumeComponent : ScriptableObject { }
    public class VolumeProfile : ScriptableObject { public T Add<T>(bool overrides = false) where T : VolumeComponent => null; }
    public class Volume : MonoBehaviour { public bool isGlobal; public float priority; public VolumeProfile profile; }
}
namespace UnityEngine.Rendering.Universal
{
    public enum AntialiasingMode { None, FastApproximateAntialiasing, SubpixelMorphologicalAntiAliasing }
    public enum AntialiasingQuality { Low, Medium, High }
    public class UniversalAdditionalCameraData : MonoBehaviour
    { public AntialiasingMode antialiasing; public AntialiasingQuality antialiasingQuality; public bool renderPostProcessing; }
    public static class CameraExtensions { public static UniversalAdditionalCameraData GetUniversalAdditionalCameraData(this Camera c) => null; }
    public class UniversalRenderPipelineAsset : RenderPipelineAsset
    {
        public float shadowDistance { get; set; } public float renderScale { get; set; }
        public override RenderPipeline CreatePipeline() => null;
    }
    public class Bloom : VolumeComponent { public MinFloatParameter threshold, intensity; public ClampedFloatParameter scatter; }
    public class Vignette : VolumeComponent { public ClampedFloatParameter intensity, smoothness; }
}
