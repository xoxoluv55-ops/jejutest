// NERVE RUNNER - STAR-01 voice on iPad/iOS: native AVSpeechSynthesizer (Korean ko-KR voice).
// Called from StarVoice.cs via [DllImport("__Internal")]. AVFoundation is already linked by
// Unity's iOS player. Speech is mixed with game audio (the game ducks its own music).
#import <AVFoundation/AVFoundation.h>

static AVSpeechSynthesizer* nr_synth = nil;

extern "C" {

void NRSpeech_Speak(const char* text, float rate, float pitch)
{
    if (text == NULL) return;
    if (nr_synth == nil) nr_synth = [[AVSpeechSynthesizer alloc] init];
    if (nr_synth.isSpeaking) [nr_synth stopSpeakingAtBoundary:AVSpeechBoundaryImmediate];
    NSString* s = [NSString stringWithUTF8String:text];
    if (s == nil || s.length == 0) return;
    AVSpeechUtterance* u = [AVSpeechUtterance speechUtteranceWithString:s];
    AVSpeechSynthesisVoice* v = [AVSpeechSynthesisVoice voiceWithLanguage:@"ko-KR"];
    if (v != nil) u.voice = v;
    u.rate = MAX(AVSpeechUtteranceMinimumSpeechRate, MIN(AVSpeechUtteranceMaximumSpeechRate, rate));
    u.pitchMultiplier = MAX(0.5f, MIN(2.0f, pitch));
    [nr_synth speakUtterance:u];
}

void NRSpeech_Stop()
{
    if (nr_synth != nil) [nr_synth stopSpeakingAtBoundary:AVSpeechBoundaryImmediate];
}

}
