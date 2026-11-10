/**
 * Statistical distributions utilizing an arbitrary uniform PRNG [0, 1).
 */

export function randomUniform(rng: () => number, min: number, max: number): number {
  if (min >= max) return min;
  return min + rng() * (max - min);
}

/**
 * Triangular distribution: min = a, mode = c, max = b
 * Where a <= c <= b
 */
export function randomTriangular(
  rng: () => number,
  a: number,
  c: number,
  b: number
): number {
  if (a >= b) return a;
  const clampedC = Math.max(a, Math.min(b, c));
  const u = rng();
  const fc = (clampedC - a) / (b - a);

  if (u < fc) {
    return a + Math.sqrt(u * (b - a) * (clampedC - a));
  } else {
    return b - Math.sqrt((1 - u) * (b - a) * (b - clampedC));
  }
}

/**
 * Poisson distribution with parameter lambda.
 * Generates non-negative integer count of events.
 */
export function randomPoisson(rng: () => number, lambda: number): number {
  if (lambda <= 0) return 0;

  // For small lambda, use Knuth's algorithm
  if (lambda < 30) {
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1.0;
    do {
      k++;
      p *= rng();
    } while (p > L);
    return Math.max(0, k - 1);
  }

  // For large lambda, use Gaussian approximation with continuity correction
  // Box-Muller transform for normal variate
  const u1 = Math.max(1e-12, rng());
  const u2 = rng();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  const sample = Math.round(lambda + Math.sqrt(lambda) * z);
  return Math.max(0, sample);
}

