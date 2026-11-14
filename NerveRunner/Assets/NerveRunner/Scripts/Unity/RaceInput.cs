// NERVE RUNNER - input: on-screen touch buttons (iPad) OR keyboard (editor / desktop testing).
// Keyboard goes through the New Input System (Neon Racer's project runs Active Input Handling
// = Both, which this project keeps). Touch buttons are UGUI HoldButtons (multi-touch safe).
using NerveRunner.Core;
using UnityEngine;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
#endif

namespace NerveRunner
{
    public class RaceInput
    {
        public HoldButton left, right, jump, drift, boost;
        float steerSmoothed;

        public bool PausePressed()
        {
#if ENABLE_INPUT_SYSTEM
            var k = Keyboard.current;
            if (k != null && (k.escapeKey.wasPressedThisFrame || k.pKey.wasPressedThisFrame)) return true;
#endif
            return false;
        }

        public RunnerInput Read(float dt)
        {
            float steer = 0f;
            bool j = false, d = false, b = false;
            if (left != null && left.Held) steer -= 1f;
            if (right != null && right.Held) steer += 1f;
            if (jump != null && jump.ConsumePress()) j = true;
            if (drift != null && drift.Held) d = true;
            if (boost != null && boost.Held) b = true;
#if ENABLE_INPUT_SYSTEM
            var k = Keyboard.current;
            if (k != null)
            {
                if (k.leftArrowKey.isPressed || k.aKey.isPressed) steer -= 1f;
                if (k.rightArrowKey.isPressed || k.dKey.isPressed) steer += 1f;
                if (k.spaceKey.wasPressedThisFrame || k.upArrowKey.wasPressedThisFrame || k.wKey.wasPressedThisFrame) j = true;
                if (k.zKey.isPressed || k.leftCtrlKey.isPressed || k.downArrowKey.isPressed || k.sKey.isPressed) d = true;
                if (k.leftShiftKey.isPressed || k.xKey.isPressed) b = true;
            }
#endif
            steer = Mathf.Clamp(steer, -1f, 1f);
            // digital buttons -> short analogue ramp, so a tap is a nudge, a hold is full lock
            steerSmoothed = Mathf.MoveTowards(steerSmoothed, steer, dt * (steer == 0f ? 10f : 6f));
            return new RunnerInput { steer = steerSmoothed, jump = j, drift = d, boost = b };
        }

        public void Reset() { steerSmoothed = 0f; }
    }
}
