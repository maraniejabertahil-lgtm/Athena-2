// Video sampling limits. Set VIDEO_MAX_FRAMES and VIDEO_MAX_SECONDS in .env to change them.
export function videoSettings(env = process.env) {
  const clamp = (value, min, max, fallback) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.round(n)));
  };
  const frames = clamp(env.VIDEO_MAX_FRAMES, 1, 24, 8);
  const seconds = clamp(env.VIDEO_MAX_SECONDS, 3, 120, 24);
  return { frames, seconds, intervalSeconds: Number((seconds / frames).toFixed(1)) };
}
