import { describe, it, expect } from 'vitest';
import { createMulberry32 } from '../../src/engine/prng.ts';
import { randomUniform, randomTriangular, randomPoisson } from '../../src/engine/distributions.ts';

describe('PRNG & Distributions', () => {
  it('Mulberry32 produces identical sequence for same seed (reproducibility)', () => {
    const seed = 12345;
    const rng1 = createMulberry32(seed);
    const rng2 = createMulberry32(seed);

    const seq1 = Array.from({ length: 50 }, () => rng1());
    const seq2 = Array.from({ length: 50 }, () => rng2());

    expect(seq1).toEqual(seq2);
  });

  it('Mulberry32 produces different sequences for different seeds', () => {
    const rng1 = createMulberry32(11111);
    const rng2 = createMulberry32(22222);

    const val1 = rng1();
    const val2 = rng2();

    expect(val1).not.toEqual(val2);
  });

  it('randomUniform stays within specified bounds [min, max)', () => {
    const rng = createMulberry32(42);
    for (let i = 0; i < 100; i++) {
      const u = randomUniform(rng, 10, 20);
      expect(u).toBeGreaterThanOrEqual(10);
      expect(u).toBeLessThan(20);
    }
  });

  it('randomTriangular generates values within [a, b]', () => {
    const rng = createMulberry32(42);
    for (let i = 0; i < 100; i++) {
      const val = randomTriangular(rng, 0.01, 0.03, 0.05);
      expect(val).toBeGreaterThanOrEqual(0.01);
      expect(val).toBeLessThanOrEqual(0.05);
    }
  });

  it('randomTriangular handles degenerate case where a = b', () => {
    const rng = createMulberry32(42);
    const val = randomTriangular(rng, 0.05, 0.05, 0.05);
    expect(val).toBe(0.05);
  });

  it('randomPoisson generates non-negative integers centered near lambda', () => {
    const rng = createMulberry32(99);
    const lambda = 4.0;
    const samples = Array.from({ length: 1000 }, () => randomPoisson(rng, lambda));

    for (const s of samples) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(s)).toBe(true);
    }

    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    expect(mean).toBeGreaterThan(3.5);
    expect(mean).toBeLessThan(4.5);
  });

  it('randomPoisson handles zero lambda', () => {
    const rng = createMulberry32(42);
    expect(randomPoisson(rng, 0)).toBe(0);
  });
});

