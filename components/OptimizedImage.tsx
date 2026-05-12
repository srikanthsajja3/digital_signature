import React, { useState } from 'react';
import { Image, StyleSheet, View, ActivityIndicator, ImageStyle, StyleProp } from 'react-native';
import { getOptimizedImageUrl, getPlaceholderUrl } from '../utils/images';

interface OptimizedImageProps {
  bucket: string;
  path: string;
  width?: number;
  height?: number;
  quality?: number;
  style?: StyleProp<ImageStyle>;
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  bucket,
  path,
  width = 200,
  height = 200,
  quality = 80,
  style,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const imageUrl = error 
    ? getPlaceholderUrl() 
    : getOptimizedImageUrl(bucket, path, { width, height, quality });

  return (
    <View style={[styles.container, { width, height }, style]}>
      <Image
        source={{ uri: imageUrl }}
        style={[styles.image, { width, height }]}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          setError(true);
          setLoading(false);
        }}
        // Enable native lazy loading on web
        // @ts-ignore
        loading="lazy"
      />
      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator color="#007bff" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    resizeMode: 'cover',
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(240, 240, 240, 0.5)',
  },
});

export default OptimizedImage;
