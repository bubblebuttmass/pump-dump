import { supabase } from './supabase';

export interface Exercise {
  id: string;
  name: string;
  is_custom: boolean;
  created_by: string | null;
}

export async function searchExercises(query: string): Promise<Exercise[]> {
  let request = supabase.from('exercises').select('*').order('name');
  if (query.trim().length > 0) {
    request = request.ilike('name', `%${query.trim()}%`);
  }
  const { data, error } = await request.limit(50);
  if (error) throw error;
  return data;
}

export async function addCustomExercise(name: string, userId: string): Promise<Exercise> {
  const { data, error } = await supabase
    .from('exercises')
    .insert({ name: name.trim(), is_custom: true, created_by: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}
