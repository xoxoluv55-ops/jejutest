// NERVE RUNNER 2.3 - STAR-01 speaks: reads story lines, questions, explanations and hints aloud
// with the device's own Korean text-to-speech (no audio files, no network):
//   iOS / iPadOS : AVSpeechSynthesizer (Plugins/iOS/NRSpeech.mm), ko-KR voice, raised pitch
//   Windows      : System.Speech via ONE background PowerShell process (stays open, low latency)
//   macOS        : the built-in `say` command (Korean voice "Yuna")
//   others       : silent (text is still shown on screen)
// Text is cleaned for speech (rich-text tags removed, "Na+" -> "나트륨 이온", roman cranial-nerve
// numbers -> "6번", arrows -> commas). New speech always interrupts the previous one.
using System;
using System.Diagnostics;
using System.Text;
using System.Text.RegularExpressions;
using UnityEngine;
#if UNITY_IOS && !UNITY_EDITOR
using System.Runtime.InteropServices;
#endif

namespace NerveRunner
{
    public static class StarVoice
    {
        public static bool Enabled = true;
        /// Rough "is talking" window for mouth animation and music ducking.
        public static float TalkingUntil;
        public static bool Talking { get { return Time.unscaledTime < TalkingUntil; } }
        static bool lastIsStar;
        /// STAR-01 itself is speaking (mouth animation); narrator lines don't move its mouth.
        public static bool StarTalking { get { return Talking && lastIsStar; } }

#if UNITY_IOS && !UNITY_EDITOR
        [DllImport("__Internal")] static extern void NRSpeech_Speak(string text, float rate, float pitch);
        [DllImport("__Internal")] static extern void NRSpeech_Stop();
#endif

#if UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN
        static Process ps;
        static bool psFailed;
#endif
#if UNITY_STANDALONE_OSX || UNITY_EDITOR_OSX
        static Process say;
#endif

        /// isStar: STAR-01's own lines (higher, cuter pitch); otherwise narrator/system.
        public static void Say(string text, bool isStar = true)
        {
            if (!Enabled || string.IsNullOrEmpty(text)) return;
            string s = Clean(text);
            if (s.Length == 0) return;
            lastIsStar = isStar;
            TalkingUntil = Time.unscaledTime + Mathf.Clamp(0.4f + s.Length * 0.09f, 0.8f, 14f);
            try
            {
#if UNITY_IOS && !UNITY_EDITOR
                NRSpeech_Speak(s, 0.52f, isStar ? 1.35f : 1.05f);
#elif UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN
                WinSay(s, isStar);
#elif UNITY_STANDALONE_OSX || UNITY_EDITOR_OSX
                MacSay(s, isStar);
#endif
            }
            catch (Exception e) { UnityEngine.Debug.LogWarning("[NerveRunner] voice unavailable: " + e.Message); Enabled = false; }
        }

        public static void Stop()
        {
            TalkingUntil = 0f;
            try
            {
#if UNITY_IOS && !UNITY_EDITOR
                NRSpeech_Stop();
#elif UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN
                if (ps != null && !ps.HasExited) ps.StandardInput.WriteLine("#STOP");
#elif UNITY_STANDALONE_OSX || UNITY_EDITOR_OSX
                if (say != null && !say.HasExited) say.Kill();
#endif
            }
            catch (Exception) { }
        }

        public static void Shutdown()
        {
            Stop();
#if UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN
            try { if (ps != null && !ps.HasExited) { ps.StandardInput.WriteLine("#EXIT"); ps.Kill(); } } catch (Exception) { }
            ps = null;
#endif
        }

#if UNITY_STANDALONE_WIN || UNITY_EDITOR_WIN
        // One hidden PowerShell process with a SpeechSynthesizer; lines arrive base64(UTF-8) on stdin.
        const string PS_SCRIPT =
            "Add-Type -AssemblyName System.Speech;" +
            "$s=New-Object System.Speech.Synthesis.SpeechSynthesizer;" +
            "try{$s.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female,[System.Speech.Synthesis.VoiceAge]::Adult,0,[Globalization.CultureInfo]'ko-KR')}catch{};" +
            "$s.Rate=1;" +
            "while($true){$l=[Console]::In.ReadLine();if($l -eq $null -or $l -eq '#EXIT'){break};" +
            "$s.SpeakAsyncCancelAll();if($l -eq '#STOP'){continue};" +
            "$p=$l.Split('|');$t=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($p[1]));" +
            "$b=New-Object System.Speech.Synthesis.PromptBuilder;$st=New-Object System.Speech.Synthesis.PromptStyle;" +
            "if($p[0] -eq 'S'){$st.Rate=[System.Speech.Synthesis.PromptRate]::Medium};$b.StartStyle($st);$b.AppendText($t);$b.EndStyle();" +
            "$s.SpeakAsync($b)|Out-Null}";

        static void WinSay(string s, bool isStar)
        {
            if (psFailed) return;
            if (ps == null || ps.HasExited)
            {
                var si = new ProcessStartInfo("powershell.exe", "-NoProfile -NoLogo -ExecutionPolicy Bypass -Command \"" + PS_SCRIPT.Replace("\"", "\\\"") + "\"")
                {
                    UseShellExecute = false, RedirectStandardInput = true, CreateNoWindow = true,
                    WindowStyle = ProcessWindowStyle.Hidden,
                };
                try { ps = Process.Start(si); }
                catch (Exception e) { psFailed = true; UnityEngine.Debug.LogWarning("[NerveRunner] Windows TTS unavailable: " + e.Message); return; }
            }
            ps.StandardInput.WriteLine((isStar ? "S" : "N") + "|" + Convert.ToBase64String(Encoding.UTF8.GetBytes(s)));
            ps.StandardInput.Flush();
        }
#endif

#if UNITY_STANDALONE_OSX || UNITY_EDITOR_OSX
        static void MacSay(string s, bool isStar)
        {
            if (say != null && !say.HasExited) { try { say.Kill(); } catch (Exception) { } }
            var si = new ProcessStartInfo("/usr/bin/say", "-v Yuna -r " + (isStar ? "210" : "190") + " \"" + s.Replace("\"", "") + "\"")
            { UseShellExecute = false, CreateNoWindow = true };
            say = Process.Start(si);
        }
#endif

        //================== TEXT CLEANING FOR SPEECH ==================\\
        static readonly Regex Tags = new Regex("<[^>]+>");
        static readonly Regex Roman = new Regex(@"(?<![A-Za-z])(XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)(?=\s?[가-힣])");
        static readonly string[] RomanNames = { "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII" };

        public static string Clean(string text)
        {
            string s = Tags.Replace(text, "");
            s = s.Replace("Na+-K+", "나트륨 칼륨").Replace("3Na+", "나트륨 이온 3개").Replace("2K+", "칼륨 이온 2개")
                 .Replace("Na+", "나트륨 이온").Replace("K+", "칼륨 이온").Replace("Ca2+", "칼슘 이온").Replace("Cl-", "염화 이온")
                 .Replace("-70mV", "마이너스 70 밀리볼트").Replace("-55mV", "마이너스 55 밀리볼트").Replace("+30mV", "플러스 30 밀리볼트")
                 .Replace("mV", " 밀리볼트").Replace("μm", " 마이크로미터").Replace("mm", " 밀리미터")
                 .Replace("→", ", ").Replace("·", ", ").Replace("/", ", ").Replace("~", "에서 ")
                 .Replace("(", ", ").Replace(")", ", ").Replace("\n", ". ").Replace("  ", " ");
            s = Roman.Replace(s, m => (Array.IndexOf(RomanNames, m.Value) + 1) + "번 ");
            return s.Trim();
        }
    }
}
