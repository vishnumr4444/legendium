/**
 * ============================================
 * PLAYER ASSETS ENTRY MODULE
 * ============================================
 * Configuration for player-specific audio and sound assets.
 * Defines footstep sounds and other player-triggered audio.
 * 
 * Assets Defined:
 * - Walking: Footstep/grass movement sounds
 * 
 * Structure:
 * - name: Audio identifier used throughout the game
 * - path: Asset file location relative to public folder
 * - volume: Audio volume level (0.0 to 1.0)
 */

export const playerAssetsEntry = {
  audios: [
    {
      name: "walking",
      path: "/audios/walkingGrass.wav",
      volume: 0.8,
    },
  ],
};
