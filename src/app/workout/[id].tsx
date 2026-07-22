import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TextInput, Pressable, Image, StyleSheet } from 'react-native';
import { useLocalSearchParams, useFocusEffect, Stack } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { getWorkoutDetail, WorkoutDetail, toggleLike, getComments, addComment, Comment } from '../../lib/social';

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [detail, setDetail] = useState<WorkoutDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');

  const load = useCallback(async () => {
    if (!session?.user || !id) return;
    setDetail(await getWorkoutDetail(id, session.user.id));
    setComments(await getComments(id));
  }, [id, session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleToggleLike() {
    if (!session?.user || !detail) return;
    await toggleLike(session.user.id, detail.id, detail.likedByMe);
    setDetail({
      ...detail,
      likedByMe: !detail.likedByMe,
      likeCount: detail.likedByMe ? detail.likeCount - 1 : detail.likeCount + 1,
    });
  }

  async function handleAddComment() {
    if (!session?.user || !detail || commentText.trim().length === 0) return;
    const created = await addComment(session.user.id, detail.id, commentText.trim());
    setComments((prev) => [...prev, created]);
    setCommentText('');
  }

  if (!detail) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: detail.display_name }} />
      <FlatList
        data={detail.sets}
        keyExtractor={(_, i) => String(i)}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={styles.name}>{detail.display_name}</Text>
              <Pressable onPress={handleToggleLike}>
                <Text style={styles.like}>{detail.likedByMe ? '♥' : '♡'} {detail.likeCount}</Text>
              </Pressable>
            </View>
            {detail.title && (
              <View style={styles.groupPill}>
                <Text style={styles.groupPillText}>{detail.title}</Text>
              </View>
            )}
            {detail.photo_url && <Image source={{ uri: detail.photo_url }} style={styles.photo} />}
            {detail.caption && <Text style={styles.caption}>{detail.caption}</Text>}
            {detail.sets.length > 0 && <Text style={styles.liftsHeading}>Lifts</Text>}
          </View>
        }
        renderItem={({ item }) => (
          <Text style={styles.setLine}>
            {item.exercise_name}: {item.weight}
            {item.unit} x {item.reps} {item.isPR ? ' — New PR!' : ''}
          </Text>
        )}
        ListFooterComponent={
          <View style={styles.comments}>
            <Text style={styles.commentsTitle}>Comments</Text>
            {comments.map((c) => (
              <Text key={c.id} style={styles.comment}>
                <Text style={styles.commentAuthor}>{c.display_name}: </Text>
                {c.body}
              </Text>
            ))}
            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment..."
                value={commentText}
                onChangeText={setCommentText}
              />
              <Pressable onPress={handleAddComment}>
                <Text style={styles.postButton}>Post</Text>
              </Pressable>
            </View>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  name: { fontSize: 20, fontWeight: '700' },
  like: { fontSize: 16 },
  groupPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginBottom: 8,
  },
  groupPillText: { fontSize: 11, fontWeight: '600', color: '#555' },
  photo: { width: '100%', height: 280, borderRadius: 8, marginBottom: 12 },
  caption: { color: '#111', marginBottom: 12 },
  liftsHeading: { fontWeight: '700', marginBottom: 4 },
  setLine: { paddingVertical: 6, borderBottomWidth: 1, borderColor: '#eee' },
  comments: { marginTop: 24 },
  commentsTitle: { fontWeight: '700', marginBottom: 8 },
  comment: { paddingVertical: 4 },
  commentAuthor: { fontWeight: '600' },
  commentInputRow: { flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' },
  commentInput: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
  postButton: { color: '#0066cc', fontWeight: '600' },
});
