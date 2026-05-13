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
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  // Initialize URL once or when bucket/path changes
  React.useEffect(() => {
    setCurrentUrl(getOptimizedImageUrl(bucket, path, { width, height, quality }));
    setFailed(false);
    setLoading(true);
  }, [bucket, path, width, height, quality]);

  const handleError = () => {
    if (!failed) {
      setFailed(true);
      setCurrentUrl(getPlaceholderUrl());
      setLoading(false);
    }
  };

  if (!currentUrl) return <View style={[{ width, height }, style]} />;

  return (
    <View style={[styles.container, { width, height }, style]}>
      <Image
        source={{ uri: currentUrl }}
        style={[styles.image, { width, height }]}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={handleError}
        // @ts-ignore
        loading="lazy"
      />
      {loading && !failed && (
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
