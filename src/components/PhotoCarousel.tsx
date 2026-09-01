import React, { useEffect, useMemo, useState } from 'react';
import { View, FlatList, StyleSheet, useWindowDimensions, StyleProp, ViewStyle, Image as RNImage } from 'react-native';
import { Image } from 'expo-image';
import { useThemeColors, radius, spacing, ThemeColors } from '../lib/theme';

// A "normal" post keeps its photo's natural aspect ratio instead of being
// force-cropped into a fixed box -- but an extreme outlier (a panorama, a
// tall screenshot) would otherwise blow up the feed. Clamp to the same
// 4:5 (tall) .. 1.91:1 (wide) range Instagram uses for the same reason.
const MIN_ASPECT_RATIO = 4 / 5;
const MAX_ASPECT_RATIO = 1.91;

// Image.getSize (not expo-image, which has no equivalent static) works for
// both remote https URLs and local file:// URIs, so this covers a post
// that's already uploaded and one still being composed. Only the first
// photo's ratio is used -- see PhotoCarousel's comment for why.
function useAspectRatio(uri: string | undefined, fallback: number): number {
  const [ratio, setRatio] = useState(fallback);

  useEffect(() => {
    if (!uri) return;
    let cancelled = false;
    RNImage.getSize(
      uri,
      (width, height) => {
        if (cancelled || !width || !height) return;
        setRatio(Math.min(MAX_ASPECT_RATIO, Math.max(MIN_ASPECT_RATIO, width / height)));
      },
      () => {
        // Couldn't read dimensions (e.g. a since-evicted local file cache) --
        // keep the fallback rather than leaving the post with no height.
      }
    );
    return () => {
      cancelled = true;
    };
  }, [uri]);

  return ratio;
}

interface PhotoCarouselProps {
  photos: string[];
  style?: StyleProp<ViewStyle>;
  /** Horizontal space (in px) between the screen edge and the carousel on each side. */
  edgeInset?: number;
}

// All photos in a multi-photo post share one height, driven by the first
// photo's aspect ratio, so swiping between them doesn't jump-resize the
// card -- matches how Instagram carousels behave.
export function PhotoCarousel({ photos, style, edgeInset = spacing.md }: PhotoCarouselProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width: screenWidth } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const itemWidth = screenWidth - edgeInset * 2;
  const aspectRatio = useAspectRatio(photos[0], 1);
  const height = itemWidth / aspectRatio;

  if (photos.length <= 1) {
    return photos[0] ? (
      <Image
        source={{ uri: photos[0] }}
        // style, not [{...defaults}, style] -- the caller's margin/etc.
        // should apply, but our aspectRatio must always win over any
        // leftover fixed-height style a caller still has lying around.
        style={[style, { width: '100%', aspectRatio, borderRadius: radius.md }] as any}
        contentFit="cover"
        transition={200}
        cachePolicy="memory-disk"
      />
    ) : null;
  }

  return (
    <View style={[style, { height }]}>
      <FlatList
        data={photos}
        keyExtractor={(uri, i) => `${uri}-${i}`}
        horizontal
        pagingEnabled
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / itemWidth))}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item }}
            style={{ width: itemWidth, height, borderRadius: radius.md }}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        )}
      />
      <View style={styles.dots}>
        {photos.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: spacing.xs },
    dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.border },
    dotActive: { backgroundColor: colors.primary, width: 14 },
  });
}
