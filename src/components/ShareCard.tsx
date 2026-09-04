import React, { forwardRef, useMemo } from 'react';
import { View, Text, StyleSheet, Image as RNImage } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

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

// Instagram/Snapchat Story canvas (1080x1920), not the 4:5 feed crop this
// used to use. "Add to Story" drops the shared image in as a full-bleed
// background on that 9:16 canvas -- a 4:5 image gets letterboxed, leaving
// the platform's own default background visible top and bottom. This is
// also why ShareCard has no rounded corners: rounding would leave the four
// corners transparent in the exported PNG, showing through the same way.
export const SHARE_CARD_ASPECT_RATIO = 9 / 16;

// Export resolution independent of whatever the on-screen preview happens
// to be sized at (see share/[id].tsx, which fits the preview to the
// device's screen and asks view-shot to resize the capture up to this).
export const SHARE_CARD_EXPORT_WIDTH = 1080;
export const SHARE_CARD_EXPORT_HEIGHT = 1920;

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
  // Every size below is a fraction of `width` rather than a fixed point
  // value -- the on-screen preview and the final export are the same view
  // at different scales (view-shot just resizes the raster), so proportions
  // have to hold regardless of what width the preview happens to render at.
  const styles = useMemo(() => createStyles(width), [width]);
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

function createStyles(width: number) {
  return StyleSheet.create({
    // No borderRadius/overflow here on purpose -- see the aspect-ratio
    // comment above. Rounded-corner treatment for the in-app preview lives
    // in a wrapper View in the share screen instead, outside what gets
    // captured.
    card: { backgroundColor: '#000' },
    footer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      padding: width * 0.045,
    },
    statBlock: { flex: 1, marginRight: width * 0.023 },
    muscleGroup: { color: '#ffffff', fontSize: width * 0.086, fontWeight: '800', letterSpacing: 0.3 },
    meta: { color: 'rgba(255,255,255,0.85)', fontSize: width * 0.04, fontWeight: '600', marginTop: width * 0.011 },
    watermark: { flexDirection: 'row', alignItems: 'center', gap: width * 0.017 },
    watermarkIcon: { width: width * 0.046, height: width * 0.046 },
    watermarkText: { color: '#ffffff', fontSize: width * 0.037, fontWeight: '700' },
  });
}
