import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveWorkout, NewWorkoutInput } from './workouts';

const QUEUE_KEY = 'lifter_app_offline_workout_queue';

async function readQueue(): Promise<NewWorkoutInput[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function writeQueue(queue: NewWorkoutInput[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueueWorkout(input: NewWorkoutInput): Promise<void> {
  const queue = await readQueue();
  queue.push(input);
  await writeQueue(queue);
}

export async function getQueueLength(): Promise<number> {
  return (await readQueue()).length;
}

export async function flushQueue(): Promise<{ succeeded: number; failed: number }> {
  const queue = await readQueue();
  const remaining: NewWorkoutInput[] = [];
  let succeeded = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      await saveWorkout(item);
      succeeded++;
    } catch {
      failed++;
      remaining.push(item);
    }
  }

  await writeQueue(remaining);
  return { succeeded, failed };
}
