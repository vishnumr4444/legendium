/**
 * Play a Three.js `Audio` instance from the beginning and resolve when finished.
 *
 * @param {THREE.Audio} audio
 * @returns {Promise<void>}
 */
export function AudioHandler(audio) {
  return new Promise((resolve, reject) => {
    audio.stop();
    audio.offset = 0;

    audio.play();

    const onEnded = () => {
      audio.source.removeEventListener("ended", onEnded);
      resolve();
    };
    audio.source.addEventListener("ended", onEnded);
  });
}

/**
 * Convenience helper to check if an audio object is currently playing.
 *
 * @param {THREE.Audio} audio
 * @returns {boolean}
 */
export function isAudioPlaying(audio) {
  if (!audio) return false;
  return audio.isPlaying === true;
}
