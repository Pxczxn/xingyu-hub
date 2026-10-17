/**
 * Critically damped approach (the classic SmoothDamp), in seconds.
 *
 * Starts from rest, never overshoots, and accepts a target that keeps moving —
 * which is what both the accordion height and the reading alignment need while
 * the surrounding layout is still animating. A single continuous follow is used
 * instead of restarting a native smooth scroll every frame.
 */
export function smoothDamp(current: number, target: number, velocity: number, smoothTime: number, dt: number) {
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (velocity + omega * change) * dt;
  return {
    value: target + (change + temp) * decay,
    velocity: (velocity - omega * temp) * decay,
  };
}
