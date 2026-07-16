import AsyncStorage from '@react-native-async-storage/async-storage';
import { enqueueWorkout, getQueueLength, flushQueue } from '../lib/offlineQueue';
import { saveWorkout } from '../lib/workouts';

jest.mock('../lib/workouts', () => ({
  saveWorkout: jest.fn(),
}));

const sampleInput = {
  userId: 'user-1',
  sets: [{ exerciseId: 'ex-1', weight: 100, reps: 5, unit: 'lb' as const }],
};

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('offline workout queue', () => {
  it('starts empty', async () => {
    expect(await getQueueLength()).toBe(0);
  });

  it('enqueues a workout for later sync', async () => {
    await enqueueWorkout(sampleInput);
    expect(await getQueueLength()).toBe(1);
  });

  it('flushes queued workouts through saveWorkout and clears them on success', async () => {
    (saveWorkout as jest.Mock).mockResolvedValue({ workoutId: 'w-1', newPRs: [] });
    await enqueueWorkout(sampleInput);

    const result = await flushQueue();

    expect(result).toEqual({ succeeded: 1, failed: 0 });
    expect(saveWorkout).toHaveBeenCalledWith(sampleInput);
    expect(await getQueueLength()).toBe(0);
  });

  it('keeps a workout queued if saveWorkout fails', async () => {
    (saveWorkout as jest.Mock).mockRejectedValue(new Error('network down'));
    await enqueueWorkout(sampleInput);

    const result = await flushQueue();

    expect(result).toEqual({ succeeded: 0, failed: 1 });
    expect(await getQueueLength()).toBe(1);
  });
});
