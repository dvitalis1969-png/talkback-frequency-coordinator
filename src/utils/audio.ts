export const isNotificationsMuted = () => {
  return localStorage.getItem('notificationsMuted') === 'true';
};

export const toggleNotificationsMute = () => {
  const current = isNotificationsMuted();
  localStorage.setItem('notificationsMuted', (!current).toString());
  return !current;
};

let audioCtx: AudioContext | null = null;

export const initAudio = () => {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
  } catch (e) {
    console.error("Audio init failed", e);
  }
};

export const playNotificationSound = () => {
  if (isNotificationsMuted()) return;

  try {
    if (!audioCtx) {
      initAudio();
    }
    if (!audioCtx) return;

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    
    // Play C6
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1046.50, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.3, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Play E6
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1318.51, now + 0.1);
    gain2.gain.setValueAtTime(0, now + 0.1);
    gain2.gain.linearRampToValueAtTime(0.3, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.35);

  } catch (e) {
    console.error("Audio playback failed", e);
  }
};

// Unlock audio on first user interaction
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    initAudio();
    if (audioCtx?.state === 'running') {
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('touchend', unlockAudio);
    }
  };
  document.addEventListener('click', unlockAudio);
  document.addEventListener('touchstart', unlockAudio, { passive: true });
  document.addEventListener('touchend', unlockAudio, { passive: true });
}
