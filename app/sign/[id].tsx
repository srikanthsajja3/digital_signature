import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, TouchableOpacity, Linking } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '../../utils/supabase';
import SignaturePad from '../../components/SignaturePad';
import { generateUnsignedPDF, addSignatureToPDF } from '../../utils/pdf';

export default function SigningPage() {
  const { id } = useLocalSearchParams();
  const [document, setDocument] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [signedUrl, setSignedUrl] = useState('');

  useEffect(() => {
    fetchDocument();
  }, [id]);

  const fetchDocument = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setDocument(data);

      // If already signed, fetch the URL
      if (data.status === 'signed') {
        const { data: urlData } = supabase.storage
          .from('pdfs')
          .getPublicUrl(`signed_${id}.pdf`);
        setSignedUrl(urlData.publicUrl);
      }
    } catch (error: any) {
      Alert.alert('Error', 'Could not find the document.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (signedUrl) {
      // For web, we can just open the URL in a new tab
      Linking.openURL(signedUrl);
    } else {
      Alert.alert('Error', 'Download link not available.');
    }
  };

  const handleSignature = async (signatureBase64: string) => {
    setSigning(true);
    try {
      // 1. Download the unsigned PDF from Supabase Storage
      const unsignedFileName = `unsigned_${id}.pdf`;
      const { data: pdfData, error: downloadError } = await supabase.storage
        .from('pdfs')
        .download(unsignedFileName);

      if (downloadError) throw downloadError;

      // Convert Blob to Uint8Array
      const arrayBuffer = await pdfData.arrayBuffer();
      const pdfBytes = new Uint8Array(arrayBuffer);

      // 2. Add signature to PDF
      const signedPdfBytes = await addSignatureToPDF(pdfBytes, signatureBase64);

      // 3. Upload Signed PDF to Supabase Storage
      const signedFileName = `signed_${id}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('pdfs')
        .upload(signedFileName, signedPdfBytes, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // 4. Update Document Status
      const { error: updateError } = await supabase
        .from('documents')
        .update({ status: 'signed' })
        .eq('id', id);

      if (updateError) throw updateError;

      // 5. Get Public URL for the signed document
      const { data: urlData } = supabase.storage
        .from('pdfs')
        .getPublicUrl(signedFileName);

      setSignedUrl(urlData.publicUrl);
      Alert.alert('Success', 'Document signed successfully!');
      fetchDocument(); 
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', error.message || 'Failed to sign document.');
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text>Loading Document...</Text>
      </View>
    );
  }

  if (!document) {
    return (
      <View style={styles.centered}>
        <Text>Document not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Review & Sign Document</Text>

      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>Customer Name:</Text>
        <Text style={styles.infoText}>{document.customer_name}</Text>

        <Text style={styles.infoLabel}>Email:</Text>
        <Text style={styles.infoText}>{document.customer_email}</Text>

        <Text style={styles.infoLabel}>Details:</Text>
        <Text style={styles.infoText}>{document.details.info}</Text>

        <Text style={styles.infoLabel}>Status:</Text>
        <Text style={[styles.status, document.status === 'signed' ? styles.signed : styles.pending]}>
          {document.status.toUpperCase()}
        </Text>
      </View>

      {document.status === 'pending' ? (
        <>
          <Text style={styles.instruction}>Please sign in the box below to complete the agreement.</Text>
          <SignaturePad onOK={handleSignature} />
          {signing && <ActivityIndicator style={{ marginTop: 10 }} />}
        </>
      ) : (
        <View style={styles.successContainer}>
          <Text style={styles.successText}>This document has already been signed.</Text>
          {signedUrl ? (
            <TouchableOpacity 
              style={styles.downloadButton}
              onPress={handleDownload}
            >
              <Text style={styles.downloadButtonText}>Download Signed PDF</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f8f9fa',
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#eee',
  },
  infoLabel: {
    fontWeight: 'bold',
    color: '#555',
    marginTop: 10,
  },
  infoText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 5,
  },
  status: {
    fontWeight: 'bold',
    fontSize: 16,
    marginTop: 5,
  },
  pending: {
    color: '#ffc107',
  },
  signed: {
    color: '#28a745',
  },
  instruction: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
    textAlign: 'center',
  },
  successContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  successText: {
    fontSize: 18,
    color: '#28a745',
    fontWeight: 'bold',
    marginBottom: 15,
  },
  downloadButton: {
    backgroundColor: '#007bff',
    padding: 15,
    borderRadius: 5,
    width: '100%',
    alignItems: 'center',
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
