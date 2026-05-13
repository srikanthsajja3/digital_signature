import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from '../utils/supabase';
import { getShareableLink } from '../utils/links';

export default function DocumentList() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (id: string, status: string) => {
    const fileName = status === 'signed' ? `signed_${id}.pdf` : `unsigned_${id}.pdf`;
    
    // We use createSignedUrl which works even if the bucket is PRIVATE
    const { data, error } = await supabase.storage
      .from('pdfs')
      .createSignedUrl(fileName, 3600); // URL valid for 1 hour
    
    if (error) {
      console.error('Download Error:', error.message);
      Alert.alert('Error', 'File not found. The PDF may have failed to generate.');
      return;
    }

    if (data?.signedUrl) {
      Linking.openURL(data.signedUrl);
    }
  };

  const copyToClipboard = (id: string) => {
    const link = getShareableLink(id);
    if (Platform.OS === 'web' && navigator.clipboard) {
      navigator.clipboard.writeText(link);
    }
    // In React Native Web/Native, we use Alert for now
    Alert.alert('Link Copied', link);
  };

  const renderItem = ({ item }: { item: any }) => {
    const isSigned = item.status === 'signed';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.headerText}>
            <Text style={styles.customerName}>{item.customer_name}</Text>
            <Text style={styles.customerEmail}>{item.customer_email}</Text>
            <Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString()}</Text>
          </View>
          <Text style={[styles.status, isSigned ? styles.signed : styles.pending]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
        
        <View style={styles.cardFooter}>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: '#28a745' }]}
            onPress={() => copyToClipboard(item.id)}
          >
            <Text style={styles.actionButtonText}>Copy Link</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: '#007bff' }]}
            onPress={() => handleDownload(item.id, item.status)}
          >
            <Text style={styles.actionButtonText}>Download PDF</Text>
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
      <Text style={styles.title}>Recent Applications</Text>
      <FlatList
        data={documents}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  list: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: '#eee',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerText: {
    flex: 1,
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  customerEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  dateText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  status: {
    fontWeight: 'bold',
    fontSize: 11,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  pending: {
    backgroundColor: '#fff3cd',
    color: '#856404',
  },
  signed: {
    backgroundColor: '#d4edda',
    color: '#155724',
  },
  cardFooter: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
});

