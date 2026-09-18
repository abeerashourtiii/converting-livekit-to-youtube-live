// ↔ MUSIC_TRACKS in app-viewer.html. On web these were generated at
// runtime with the WebAudio API (oscillator + gain envelope per note) —
// there's no native equivalent to WebAudio's AudioContext without pulling
// in an extra native module, and these are a small FIXED set of 5 tracks,
// so instead of shipping a soft-synth we pre-rendered each one exactly
// once (same note frequencies, tempo, waveform, and attack/decay envelope
// as startReelMusic()) into a real looping track bundled as an asset.
// Same sound, zero runtime synthesis cost, works with plain expo-av.
//
// ↔ perf audit fix #4: originally shipped as uncompressed .wav
// (~5.6MB total across the 5 tracks). Re-encoded to AAC .m4a at 128kbps
// (~1.05MB total, ~81% smaller) — same duration and perceptually
// transparent quality for background loop music, meaningfully smaller
// app download/install size.
//
// Keys match property.music strings exactly (that's what the mock data /
// publish flow already stores), so lookups need no renaming elsewhere.
export const MUSIC_TRACK_ASSETS: Record<string, number> = {
  "Uplifting Corporate": require("../assets/music/uplifting-corporate.m4a"),
  "Chill Lounge": require("../assets/music/chill-lounge.m4a"),
  "Acoustic Morning": require("../assets/music/acoustic-morning.m4a"),
  "Oriental Vibes": require("../assets/music/oriental-vibes.m4a"),
  "Modern Beat": require("../assets/music/modern-beat.m4a"),
};

export function getMusicAsset(trackName: string | null | undefined): number | null {
  if (!trackName) return null;
  return MUSIC_TRACK_ASSETS[trackName] ?? MUSIC_TRACK_ASSETS["Uplifting Corporate"];
}
