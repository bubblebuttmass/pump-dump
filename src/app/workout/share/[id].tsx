import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, useWindowDimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { useAuth } from '../../../lib/auth';
import { getWorkoutDetail, WorkoutDetail } from '../../../lib/social';
import { formatShortDate } from '../../../lib/time';
import { showAlert } from '../../../lib/alert';
import { AnimatedScreen } from '../../../components/AnimatedScreen';
import {
  ShareCard,
  SHARE_CARD_ASPECT_RATIO,
  SHARE_CARD_EXPORT_WIDTH,
  SHARE_CARD_EXPORT_HEIGHT,
} from '../../../components/ShareCard';
import { useThemeColors, radius, spacing, type as typeScale, ThemeColors } from '../../../lib/theme';

export default function ShareWorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [detail, setDetail] = useState<WorkoutDetail | null>(null);
  const [photoReady, setPhotoReady] = useState(false);
  const [busy, setBusy] = useState<'share' | 'save' | null>(null);
  const cardRef = useRef<View>(null);

  // A 9:16 card is much taller than it is wide, so sizing it off screen
  // *width* the way the old 4:5 version did would make it taller than the
  // screen has room for once the header/buttons are accounted for. Fit it
  // to whichever dimension is tighter instead -- height, on basically every
  // phone -- and derive width from that so the on-screen preview always
  // fits. The actual exported file isn't tied to this size at all (see
  // capture()), so shrinking the preview to fit never costs resolution.
  const maxPreviewHeight = screenHeight * 0.56;
  const maxPreviewWidthBound = (screenWidth - spacing.lg * 2) / SHARE_CARD_ASPECT_RATIO;
  const cardHeight = Math.min(maxPreviewHeight, maxPreviewWidthBound);
  const cardWidth = cardHeight * SHARE_CARD_ASPECT_RATIO;

  useEffect(() => {
    if (!session?.user || !id) return;
    getWorkoutDetail(id, session.user.id).then(setDetail);
  }, [id, session]);

  // The card is captured fresh each tap rather than cached after the first --
  // it's cheap (view-shot on an already-painted, static view), and caching
  // would mean carrying a stale tmpfile reference across the screen's
  // lifetime for no real benefit.
  const capture = useCallback(async () => {
    if (!cardRef.current) return null;
    // Fixed output size regardless of the preview's on-screen size (which
    // varies by device) -- this is the actual Story canvas resolution, so
    // the exported file always fills it edge-to-edge at full quality.
    return captureRef(cardRef, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
      width: SHARE_CARD_EXPORT_WIDTH,
      height: SHARE_CARD_EXPORT_HEIGHT,
    });
  }, []);

  async function handleShare() {
    setBusy('share');
    try {
      const uri = await capture();
      if (!uri) return;
      if (!(await Sharing.isAvailableAsync())) {
        showAlert('Sharing not available', "Your device doesn't support the share sheet.");
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your workout' });
    } catch (e: any) {
      showAlert('Could not share card', e.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleSave() {
    setBusy('save');
    try {
      // Write-only: saving a card into Photos never needs to read the
      // existing library, and the app.json plugin config only declares the
      // "add" permission string (no broad read-access one) to match.
      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      if (status !== 'granted') {
        showAlert('Photos access needed', 'Enable photo access in your device Settings to save this card.');
        return;
      }
      const uri = await capture();
      if (!uri) return;
      await MediaLibrary.saveToLibraryAsync(uri);
      showAlert('Saved', 'Your workout card was saved to Photos.');
    } catch (e: any) {
      showAlert('Could not save card', e.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  const photoUri = detail?.photos[0];

  return (
    <AnimatedScreen style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Share workout</Text>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
      </View>

      {!detail || !photoUri ? (
        <View style={styles.center}>
          {!detail ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.emptyText}>This post has no photo to share as a card.</Text>
          )}
        </View>
      ) : (
        <>
          <View style={styles.cardWrap}>
            {/* Rounded corners are cosmetic, for this on-screen preview only
                -- ShareCard itself (what cardRef points at, what actually
                gets captured) stays a plain full-bleed rectangle, or the
                exported PNG would have transparent corners. */}
            <View style={[styles.previewFrame, { width: cardWidth, height: cardHeight }]}>
              <ShareCard
                ref={cardRef}
                width={cardWidth}
                photoUri={photoUri}
                muscleGroup={detail.title ?? 'Workout'}
                gymName={detail.gymName}
                date={formatShortDate(detail.created_at)}
                onImageReady={() => setPhotoReady(true)}
              />
            </View>
            {!photoReady && (
              <View style={[styles.loadingOverlay, { width: cardWidth, height: cardHeight }]}>
                <ActivityIndicator color={colors.white} />
              </View>
            )}
          </View>

          <View style={styles.actions}>
            <Pressable
              style={[styles.actionButton, styles.secondaryButton]}
              onPress={handleSave}
              disabled={!photoReady || busy !== null}
              accessibilityRole="button"
              accessibilityLabel="Save to Photos"
            >
              {busy === 'save' ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <>
                  <Ionicons name="download-outline" size={18} color={colors.text} />
                  <Text style={styles.secondaryButtonText}>Save to Photos</Text>
                </>
              )}
            </Pressable>
            <Pressable
              style={[styles.actionButton, styles.primaryButton]}
              onPress={handleShare}
              disabled={!photoReady || busy !== null}
              accessibilityRole="button"
              accessibilityLabel="Share"
            >
              {busy === 'share' ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Ionicons name="share-outline" size={18} color={colors.white} />
                  <Text style={styles.primaryButtonText}>Share</Text>
                </>
              )}
            </Pressable>
          </View>
          {Platform.OS === 'android' && (
            <Text style={styles.hint}>Save it, then post it to Instagram from your gallery.</Text>
          )}
        </>
      )}
    </AnimatedScreen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
    },
    title: { ...typeScale.subtitle, color: colors.text },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    emptyText: { ...typeScale.body, color: colors.textFaint, textAlign: 'center' },
    cardWrap: { alignItems: 'center', marginTop: spacing.md },
    previewFrame: { borderRadius: radius.lg, overflow: 'hidden' },
    loadingOverlay: {
      position: 'absolute',
      top: 0,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actions: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.xl },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
    },
    secondaryButton: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border },
    secondaryButtonText: { ...typeScale.subtitle, color: colors.text },
    primaryButton: { backgroundColor: colors.primary },
    primaryButtonText: { ...typeScale.subtitle, color: colors.white },
    hint: { ...typeScale.caption, color: colors.textFaint, textAlign: 'center', marginTop: spacing.md, paddingHorizontal: spacing.xl },
  });
}
