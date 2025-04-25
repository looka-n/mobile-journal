import React from 'react';
import { Image, Dimensions } from 'react-native';
import Carousel from 'react-native-reanimated-carousel';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function ImageCarousel({ images }: { images: string[] }) {
  if (!images || images.length === 0) return null;

  return (
    <Carousel
      loop
      width={SCREEN_WIDTH}
      data={images}
      scrollAnimationDuration={400}
      renderItem={({ item }) => (
        <Image
          source={{ uri: item }}
          style={{ width: '100%', height: '100%', resizeMode: 'stretch' }}
        />
      )}
    />
  );
}