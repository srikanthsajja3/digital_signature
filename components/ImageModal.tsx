import React from 'react';
import { Modal, View, Image, StyleSheet, TouchableOpacity, Text, Dimensions } from 'react-native';
import { getOptimizedImageUrl } from '../utils/images';

interface ImageModalProps {
  visible: boolean;
  onClose: () => void;
  bucket: string;
  path: string;
  title?: string;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const ImageModal: React.FC<ImageModalProps> = ({ visible, onClose, bucket, path, title }) => {
  // For the full screen view, we request a higher quality and larger image
  const fullImageUrl = getOptimizedImageUrl(bucket, path, {
    width: 1200,
    quality: 90,
    format: 'origin', // Use origin for maximum detail in full view
  });

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>{title || 'Image Preview'}</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: fullImageUrl }}
            style={styles.fullImage}
            resizeMode="contain"
          />
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.downloadButton} onPress={onClose}>
            <Text style={styles.buttonText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  closeButton: {
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: screenWidth,
    height: screenHeight * 0.7,
  },
  footer: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  downloadButton: {
    backgroundColor: '#007bff',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ImageModal;
