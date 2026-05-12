import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Linking, Alert } from 'react-native';
import { supabase } from '../utils/supabase';
import OptimizedImage from '../components/OptimizedImage';
import ImageModal from './ImageModal';

export default function DocumentList() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<{ bucket: string; path: string; title: string } | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isSigned = item.status === 'signed';
    const fileName = isSigned ? `signed_${item.id}.pdf` : `unsigned_${item.id}.pdf`;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <TouchableOpacity onPress={() => setSelectedImage({
            bucket: 'pdfs',
            path: fileName,
            title: `Preview: ${item.customer_name}`
          })}>
            <OptimizedImage 
              bucket="pdfs" 
              path={fileName} 
              width={60}
              height={60}
              style={styles.thumbnail}
            />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.customerName}>{item.customer_name}</Text>
            <Text style={styles.customerEmail}>{item.customer_email}</Text>
          </View>
        </View>
        
        <View style={styles.cardFooter}>
          <Text style={[styles.status, isSigned ? styles.signed : styles.pending]}>
            {item.status.toUpperCase()}
          </Text>
          <TouchableOpacity 
            style={styles.viewButton}
            onPress={() => {
              const link = Linking.createURL(`/sign/${item.id}`);
              Alert.alert('Link', link);
            }}
          >
            <Text style={styles.viewButtonText}>View Link</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>All Documents</Text>
      <FlatList
        data={documents}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        initialNumToRender={10}
        windowSize={5}
      />

      {selectedImage && (
        <ImageModal
          visible={!!selectedImage}
          onClose={() => setSelectedImage(null)}
          bucket={selectedImage.bucket}
          path={selectedImage.path}
          title={selectedImage.title}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  list: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  thumbnail: {
    borderRadius: 5,
    marginRight: 15,
  },
  headerText: {
    flex: 1,
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  customerEmail: {
    fontSize: 14,
    color: '#666',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
  },
  status: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  pending: {
    color: '#ffc107',
  },
  signed: {
    color: '#28a745',
  },
  viewButton: {
    backgroundColor: '#007bff',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 5,
  },
  viewButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
