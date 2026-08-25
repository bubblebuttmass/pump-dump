import React, { useMemo, useState } from 'react';
import { View, FlatList, StyleSheet, useWindowDimensions, StyleProp, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { useThemeColors, radius, spacing, ThemeColors } from '../lib/theme';

interface PhotoCarouselProps {
  photos: string[];
  height: number;
  style?: StyleProp<ViewStyle>;
  /** Horizontal space (in px) between the screen edge and the carousel on each side. */
  edgeInset?: number;
}

export function PhotoCarousel({ photos, height, style, edgeInset = spacing.md }: PhotoCarouselProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width: screenWidth } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const itemWidth = screenWidth - edgeInset * 2;

  if (photos.length <= 1) {
    return photos[0] ? (
      <Image
        source={{ uri: photos[0] }}
        style={[{ width: '100%', height, borderRadius: radius.md }, style] as any}
        contentFit="cover"
        transition={200}
        cachePolicy="memory-disk"
      />
    ) : null;
  }

  return (
    <View style={style}>
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
