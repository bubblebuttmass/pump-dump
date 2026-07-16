import { estimateOneRepMax, checkForPR } from '../lib/pr';

describe('estimateOneRepMax', () => {
  it('applies the Epley formula for multiple reps', () => {
    expect(estimateOneRepMax(200, 5)).toBeCloseTo(233.33, 1);
  });

  it('is close to the raw weight at 1 rep', () => {
    expect(estimateOneRepMax(225, 1)).toBeCloseTo(232.5, 1);
  });
});

describe('checkForPR', () => {
  it('flags a PR when the lifter has no prior best', () => {
    const result = checkForPR({ weight: 135, reps: 5 }, null);
    expect(result.isNewPR).toBe(true);
    expect(result.estimated1RM).toBeCloseTo(157.5, 1);
  });

  it('flags a PR when the new estimate beats the prior best', () => {
    const result = checkForPR({ weight: 225, reps: 5 }, 250);
    expect(result.isNewPR).toBe(true);
  });

  it('does not flag a PR when the new estimate is lower', () => {
    const result = checkForPR({ weight: 135, reps: 3 }, 250);
    expect(result.isNewPR).toBe(false);
  });
});
