import {
  calculateXpForLevel,
  getRankForXp,
  getXpThresholdForRank,
  getRankProgress,
} from '../js/app/player.js';

describe('getXpThresholdForRank', () => {
  test('rank 1 requires 0 cumulative XP', () => {
    expect(getXpThresholdForRank(1)).toBe(0);
  });

  test('rank 2 requires 500 XP', () => {
    expect(getXpThresholdForRank(2)).toBe(500);
  });

  test('rank 5 requires sum of ranks 1-4 XP', () => {
    // rank 1→2: 500*1*1=500, rank 2→3: 500*2*1=1000, rank 3→4: 500*3*1=1500, rank 4→5: 500*4*1=2000
    expect(getXpThresholdForRank(5)).toBe(5000);
  });

  test('rank 6 has higher scaling (crosses floor(5/5)=1 bracket)', () => {
    // rank 5→6: 500*5*(1+1*0.5) = 500*5*1.5 = 3750
    expect(getXpThresholdForRank(6)).toBe(5000 + 3750);
  });
});

describe('getRankForXp', () => {
  test('0 XP is rank 1', () => {
    expect(getRankForXp(0)).toBe(1);
  });

  test('499 XP is still rank 1', () => {
    expect(getRankForXp(499)).toBe(1);
  });

  test('500 XP is rank 2', () => {
    expect(getRankForXp(500)).toBe(2);
  });

  test('large XP gives high rank', () => {
    const rank = getRankForXp(110000);
    expect(rank).toBeGreaterThan(15);
  });
});

describe('getRankProgress', () => {
  test('returns 0 progress at rank threshold', () => {
    const progress = getRankProgress(500); // exactly rank 2
    expect(progress.rank).toBe(2);
    expect(progress.currentXpInRank).toBe(0);
    expect(progress.xpNeededForNext).toBe(1000); // 500*2*1 to go from rank 2→3
    expect(progress.fraction).toBe(0);
  });

  test('returns partial progress within rank', () => {
    const progress = getRankProgress(750); // rank 2, 250 into it
    expect(progress.rank).toBe(2);
    expect(progress.currentXpInRank).toBe(250);
    expect(progress.fraction).toBeCloseTo(0.25);
  });
});

describe('calculateXpForLevel', () => {
  test('base XP with 1 star, no bonuses', () => {
    const xp = calculateXpForLevel({
      stars: 1,
      complexity: 1.3,
      isFirstClear: false,
      streakDays: 0,
    });
    // 100 * 1 * 1.3 = 130
    expect(xp).toBe(130);
  });

  test('3 star multiplier applies', () => {
    const xp = calculateXpForLevel({
      stars: 3,
      complexity: 1.0,
      isFirstClear: false,
      streakDays: 0,
    });
    // 100 * 2 * 1.0 = 200
    expect(xp).toBe(200);
  });

  test('first clear bonus adds 50%', () => {
    const xp = calculateXpForLevel({
      stars: 1,
      complexity: 1.0,
      isFirstClear: true,
      streakDays: 0,
    });
    // 100 * 1 * 1.0 * 1.5 = 150
    expect(xp).toBe(150);
  });

  test('streak bonus adds 10% per day, capped at 50%', () => {
    const xp = calculateXpForLevel({
      stars: 1,
      complexity: 1.0,
      isFirstClear: false,
      streakDays: 7,
    });
    // 100 * 1 * 1.0 * 1.5 (capped) = 150
    expect(xp).toBe(150);
  });

  test('all bonuses stack multiplicatively', () => {
    const xp = calculateXpForLevel({
      stars: 3,
      complexity: 1.5,
      isFirstClear: true,
      streakDays: 3,
    });
    // base: 100 * 2 * 1.5 = 300
    // first clear: 300 * 1.5 = 450
    // streak (3 days = +30%): 450 * 1.3 = 585
    expect(xp).toBe(585);
  });
});
