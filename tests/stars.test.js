import { calculateStars } from '../js/app/logic.js';

describe('calculateStars', () => {
  test('returns 1 star when hint was used', () => {
    const result = calculateStars({
      optimalMoves: 3,
      actualMoves: 3,
      elapsedSeconds: 5,
      hintUsed: true,
    });
    expect(result).toBe(1);
  });

  test('returns 3 stars for optimal moves within time target', () => {
    const result = calculateStars({
      optimalMoves: 4,
      actualMoves: 5,   // 5 <= 4 * 1.5 = 6
      elapsedSeconds: 15, // 15 <= 4 * 5 = 20
      hintUsed: false,
    });
    expect(result).toBe(3);
  });

  test('returns 3 stars for exactly optimal moves', () => {
    const result = calculateStars({
      optimalMoves: 3,
      actualMoves: 3,
      elapsedSeconds: 10,
      hintUsed: false,
    });
    expect(result).toBe(3);
  });

  test('returns 2 stars when moves within 2x but over 1.5x', () => {
    const result = calculateStars({
      optimalMoves: 4,
      actualMoves: 7,   // 7 <= 4 * 2 = 8, but 7 > 4 * 1.5 = 6
      elapsedSeconds: 10,
      hintUsed: false,
    });
    expect(result).toBe(2);
  });

  test('returns 2 stars when time exceeds target but moves are good', () => {
    const result = calculateStars({
      optimalMoves: 4,
      actualMoves: 5,   // 5 <= 6 (good)
      elapsedSeconds: 25, // 25 > 20 (over time)
      hintUsed: false,
    });
    expect(result).toBe(2);
  });

  test('returns 1 star when moves exceed 2x optimal', () => {
    const result = calculateStars({
      optimalMoves: 3,
      actualMoves: 7,   // 7 > 3 * 2 = 6
      elapsedSeconds: 10,
      hintUsed: false,
    });
    expect(result).toBe(1);
  });

  test('handles edge case where optimalMoves is 1', () => {
    const result = calculateStars({
      optimalMoves: 1,
      actualMoves: 1,
      elapsedSeconds: 3,
      hintUsed: false,
    });
    expect(result).toBe(3);
  });

  test('returns 1 star for null optimalMoves (unsolvable level fallback)', () => {
    const result = calculateStars({
      optimalMoves: null,
      actualMoves: 5,
      elapsedSeconds: 10,
      hintUsed: false,
    });
    expect(result).toBe(1);
  });
});
