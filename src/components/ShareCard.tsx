import React, { forwardRef } from 'react';
import { View, Text, StyleSheet, Image as RNImage } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { radius, spacing } from '../lib/theme';

interface ShareCardProps {
  photoUri: string;
  muscleGroup: string;
  gymName?: string | null;
  date: string;
  width: number;
  /** Fires once the background photo has actually painted. Capturing this
   *  view before then (view-shot has no way to know the async image load
   *  hasn't finished) would grab a blank frame instead of the photo. */
  onImageReady?: () => void;
}

// Fixed portrait shape (Instagram feed's 4:5 -- the same clamp PhotoCarousel
// already uses at its tall end) regardless of the source photo's own aspect
// ratio. A shareable card needs one predictable shape to look right dropped
// into another app, so this crops to fill rather than adapting per-photo the
// way the in-feed carousel does.
export const SHARE_CARD_ASPECT_RATIO = 4 / 5;

// Deliberately NOT theme-aware (no useThemeColors): this renders to a flat
// image that gets posted outside the app entirely, so it must look the same
// regardless of the poster's light/dark setting -- colors here are fixed on
// purpose, not a missed theme hookup.
//
// forwardRef so the share screen can pass this straight to view-shot's
// captureRef instead of needing an extra wrapper View around it.
export const ShareCard = forwardRef<View, ShareCardProps>(function ShareCard(
  { photoUri, muscleGroup, gymName, date, width, onImageReady },
  ref
) {
  const height = width / SHARE_CARD_ASPECT_RATIO;
  return (
    <View ref={ref} collapsable={false} style={[styles.card, { width, height }]}>
      <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFillObject} contentFit="cover" onLoadEnd={onImageReady} />
      {/* Scrim guarantees the footer text stays legible over any photo --
          brightness of the source image is unpredictable, this isn't. */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0.8)']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.footer}>
        <View style={styles.statBlock}>
          <Text style={styles.muscleGroup} numberOfLines={1}>
            {muscleGroup.toUpperCase()}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {gymName ? `${gymName} · ${date}` : date}
          </Text>
        </View>
        <View style={styles.watermark}>
          <RNImage source={require('../../assets/images/android-icon-monochrome.png')} style={styles.watermarkIcon} />
          <Text style={styles.watermarkText}>Pump Dump</Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    padding: spacing.lg,
  },
  statBlock: { flex: 1, marginRight: spacing.sm },
  muscleGroup: { color: '#ffffff', fontSize: 30, fontWeight: '800', letterSpacing: 0.5 },
  meta: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600', marginTop: 4 },
  watermark: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  watermarkIcon: { width: 16, height: 16 },
  watermarkText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
});
