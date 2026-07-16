export function estimateOneRepMax(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

export interface SetInput {
  weight: number;
  reps: number;
}

export interface PRCheckResult {
  isNewPR: boolean;
  estimated1RM: number;
}

export function checkForPR(newSet: SetInput, currentBest1RM: number | null): PRCheckResult {
  const estimated1RM = estimateOneRepMax(newSet.weight, newSet.reps);
  const isNewPR = currentBest1RM === null || estimated1RM > currentBest1RM;
  return { isNewPR, estimated1RM };
}
