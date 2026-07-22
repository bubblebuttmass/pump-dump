import React, { useEffect, useState } from 'react';
import { View, TextInput, Text, Pressable, Image, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../../lib/auth';
import { getOwnProfile, updateProfile } from '../../../lib/profile';
import { uploadAvatar } from '../../../lib/storage';
import { showAlert } from '../../../lib/alert';

export default function EditProfile() {
  const { session } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [newAvatarUri, setNewAvatarUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session?.user) return;
    getOwnProfile(session.user.id).then((profile) => {
      setDisplayName(profile.display_name);
      setBio(profile.bio ?? '');
      setAvatarUrl(profile.avatar_url);
      setLoading(false);
    });
  }, [session]);

  async function pickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled) setNewAvatarUri(result.assets[0].uri);
  }

  async function handleSave() {
    if (!session?.user) return;
    if (displayName.trim().length === 0) {
      showAlert('Display name required');
      return;
    }
    setSaving(true);
    try {
      const uploadedAvatarUrl = newAvatarUri ? await uploadAvatar(session.user.id, newAvatarUri) : undefined;
      await updateProfile(session.user.id, { displayName, bio, avatarUrl: uploadedAvatarUrl });
      router.back();
    } catch (e: any) {
      showAlert('Could not save profile', e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <Pressable onPress={pickAvatar} style={styles.avatarPicker}>
        {newAvatarUri || avatarUrl ? (
          <Image source={{ uri: newAvatarUri ?? avatarUrl! }} style={styles.avatar} />
        ) : (
          <Text>Choose photo</Text>
        )}
      </Pressable>
      <Text style={styles.label}>Display name</Text>
      <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} />
      <Text style={styles.label}>Bio</Text>
      <TextInput
        style={[styles.input, styles.bioInput]}
        value={bio}
        onChangeText={setBio}
        placeholder="Tell other lifters about yourself"
        multiline
        maxLength={200}
      />
      <Pressable style={styles.button} onPress={handleSave} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  avatarPicker: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#eee',
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  label: { fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 16 },
  bioInput: { minHeight: 80, textAlignVertical: 'top' },
  button: { backgroundColor: '#111', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
