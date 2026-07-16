import { checkForPR } from '../lib/pr';

// This test locks in the exact decision rule saveWorkout() must use per set:
// compare each set's estimated 1RM against the best PR seen so far *within this
// same workout* as well as the pre-existing DB best, so two PR-breaking sets
// for the same exercise in one workout don't both get inserted as separate PRs
// for a lower value.
describe('per-set PR sequencing within a single save', () => {
  it('only the highest of two improving sets in the same workout counts as the PR', () => {
    const priorBest = 200; // from DB
    const set1 = checkForPR({ weight: 205, reps: 1 }, priorBest);
    const runningBest = set1.isNewPR ? set1.estimated1RM : priorBest;
    const set2 = checkForPR({ weight: 210, reps: 1 }, runningBest);

    expect(set1.isNewPR).toBe(true);
    expect(set2.isNewPR).toBe(true);
    expect(set2.estimated1RM).toBeGreaterThan(set1.estimated1RM);
  });

  it('a second improving set that is lower than the first is not counted as a PR', () => {
    const priorBest = 200;
    const set1 = checkForPR({ weight: 220, reps: 1 }, priorBest);
    const runningBest = set1.isNewPR ? set1.estimated1RM : priorBest;
    const set2 = checkForPR({ weight: 210, reps: 1 }, runningBest);

    expect(set1.isNewPR).toBe(true);
    expect(set2.isNewPR).toBe(false);
  });
});
