// Synthesized via Web Audio API rather than shipping an audio asset — a
// short, soft two-tone chime. Fails silently if the browser blocks/lacks
// AudioContext (e.g. autoplay policy before any user interaction).
export function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return

    const ctx = new AudioContextClass()
    const now = ctx.currentTime

    const playTone = (frequency: number, start: number, duration: number) => {
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.type = "sine"
      oscillator.frequency.setValueAtTime(frequency, now + start)
      gain.gain.setValueAtTime(0.0001, now + start)
      gain.gain.exponentialRampToValueAtTime(0.12, now + start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration)
      oscillator.connect(gain)
      gain.connect(ctx.destination)
      oscillator.start(now + start)
      oscillator.stop(now + start + duration)
    }

    playTone(880, 0, 0.18) // A5
    playTone(1108.73, 0.12, 0.22) // C#6

    setTimeout(() => ctx.close(), 500)
  } catch {
    // Non-critical nicety — never let this break the caller.
  }
}
