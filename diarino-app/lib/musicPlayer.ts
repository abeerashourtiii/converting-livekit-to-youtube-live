import { Audio } from "expo-av";
import { getMusicAsset } from "../data/music-tracks";

// ↔ `let currentReelMusic = null` + startReelMusic()/stopReelMusic() in
// app-viewer.html — there's only ever one reel's music playing at a time
// (switching reels stops the previous track), same as the original global.
// Kept as a plain module singleton rather than a hook since multiple
// ReelCards need to share and preempt the same playback slot.

let currentSound: Audio.Sound | null = null;
let currentReelId: string | null = null;
// ↔ #4 (قايمة خيارات الريل — صوت الخلفية): بيتقرا وقت أي startReelMusic
// جديدة عشان الموسيقى تبدأ مكتومة لو المستخدم كاتم الصوت أصلاً، وبيتحدّث
// فوريًا لو المستخدم بدّل الكتم وهي شغالة (شوف setReelMusicMuted تحت).
let musicMuted = false;

export async function startReelMusic(reelId: string, trackName: string | null | undefined) {
  if (currentReelId === reelId && currentSound) return; // already playing for this reel
  await stopReelMusic();

  const asset = getMusicAsset(trackName);
  if (!asset) return;

  try {
    const { sound } = await Audio.Sound.createAsync(asset, {
      isLooping: true,
      volume: musicMuted ? 0 : 1, // WAV was already rendered at the original's 0.06 master gain, no extra attenuation needed
      shouldPlay: true,
    });
    currentSound = sound;
    currentReelId = reelId;
  } catch {
    // ignore playback failures (e.g. silent mode edge cases) — non-critical background audio
  }
}

// ↔ #4: بيغيّر مستوى الصوت للموسيقى الشغالة حاليًا فورًا (من غير ما
// يوقفها ويشغّلها تانى)، وبيسجّل الحالة عشان أي موسيقى تبدأ بعد كده
// (لريل تانى) تاخد نفس حالة الكتم على طول.
export function setReelMusicMuted(muted: boolean) {
  musicMuted = muted;
  currentSound?.setStatusAsync({ volume: muted ? 0 : 1 }).catch(() => {});
}

export async function stopReelMusic() {
  if (!currentSound) return;
  const sound = currentSound;
  currentSound = null;
  currentReelId = null;
  try {
    // ↔ the 0.12s linear ramp-to-zero before disconnecting in stopReelMusic()
    await fadeOutAndStop(sound);
  } catch {
    // ignore
  }
}

async function fadeOutAndStop(sound: Audio.Sound) {
  const steps = 4;
  const stepMs = 30; // ~120ms total, matching the original's ramp duration
  for (let i = steps; i >= 0; i--) {
    try {
      await sound.setStatusAsync({ volume: i / steps });
    } catch {
      break;
    }
    await new Promise((r) => setTimeout(r, stepMs));
  }
  await sound.stopAsync().catch(() => {});
  await sound.unloadAsync().catch(() => {});
}
