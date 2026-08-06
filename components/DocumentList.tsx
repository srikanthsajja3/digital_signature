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
    Alert.alert('Link Copied', link);
  };

  const handleDeleteDocument = async (id: string, name: string) => {
    const executeDelete = async () => {
      try {
        // 1. Delete document row from Supabase database
        const { error } = await supabase
          .from('documents')
          .delete()
          .eq('id', id);

        if (error) throw error;

        // 2. Remove associated PDFs from storage
        await supabase.storage
          .from('pdfs')
          .remove([`unsigned_${id}.pdf`, `signed_${id}.pdf`]);

        // 3. Update local UI state
        setDocuments((prev) => prev.filter((item) => item.id !== id));
        Alert.alert('Success', `Application for "${name}" deleted.`);
      } catch (err: any) {
        console.error('Delete error:', err);
        Alert.alert('Error', err.message || 'Failed to delete application.');
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`Are you sure you want to delete the application for "${name}"?`)) {
        executeDelete();
      }
    } else {
      Alert.alert(
        'Confirm Delete',
        `Are you sure you want to delete the application for "${name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: executeDelete }
        ]
      );
    }
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
            style={[styles.actionButton, { backgroundColor: '#10B981' }]}
            onPress={() => copyToClipboard(item.id)}
          >
            <Text style={styles.actionButtonText}>Copy Link</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: '#3B82F6' }]}
            onPress={() => handleDownload(item.id, item.status)}
          >
            <Text style={styles.actionButtonText}>Download PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: '#EF4444' }]}
            onPress={() => handleDeleteDocument(item.id, item.customer_name)}
          >
            <Text style={styles.actionButtonText}>Delete</Text>
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
    paddingTop: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 16,
    color: '#D4AF37',
    letterSpacing: 0.3,
  },
  list: {
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#2A1D11',
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: '#4A3520',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  headerText: {
    flex: 1,
  },
  customerName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  customerEmail: {
    fontSize: 13,
    color: '#CCCCCC',
    marginTop: 3,
  },
  dateText: {
    fontSize: 12,
    color: '#A39282',
    marginTop: 4,
    fontWeight: '500',
  },
  status: {
    fontWeight: '800',
    fontSize: 11,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    letterSpacing: 0.5,
  },
  pending: {
    backgroundColor: '#3D2B1A',
    color: '#D4AF37',
    borderColor: '#5C4428',
  },
  signed: {
    backgroundColor: '#1B3B2B',
    color: '#4CAF50',
    borderColor: '#2E5C43',
  },
  cardFooter: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#3D2B1A',
    paddingTop: 14,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
});

