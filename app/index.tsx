import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { supabase } from '../utils/supabase';
import * as Linking from 'expo-linking';

import { generateUnsignedPDF } from '../utils/pdf';
import DocumentList from '../components/DocumentList';

export default function AdminDashboard() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');

  const handleCreateDocument = async () => {
    if (!name || !email) {
      Alert.alert('Error', 'Please enter at least name and email.');
      return;
    }

    setLoading(true);
    try {
      // 1. Insert into Supabase 'documents' table
      const { data, error } = await supabase
        .from('documents')
        .insert([{ 
          customer_name: name, 
          customer_email: email, 
          details: { info: details }, 
          status: 'pending' 
        }])
        .select()
        .single();

      if (error) throw error;

      // 2. Generate the unsigned PDF
      const pdfBytes = await generateUnsignedPDF(name, details);

      // 3. Upload Unsigned PDF to Supabase Storage
      const fileName = `unsigned_${data.id}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('pdfs')
        .upload(fileName, pdfBytes, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // 4. Generate the shareable link
      // Use the actual URL if deployed, otherwise localhost/expo link
      const link = Linking.createURL(`/sign/${data.id}`);
      setGeneratedLink(link);
      
      Alert.alert('Success', 'Document entry created and link generated!');
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', error.message || 'Failed to create document.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Admin - Enter Customer Details</Text>
      
      <View style={styles.form}>
        <Text style={styles.label}>Customer Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. John Doe"
        />

        <Text style={styles.label}>Customer Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="e.g. john@example.com"
          keyboardType="email-address"
        />

        <Text style={styles.label}>Additional Details</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={details}
          onChangeText={setDetails}
          placeholder="Contract terms, etc."
          multiline
          numberOfLines={4}
        />

        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={handleCreateDocument}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Generating...' : 'Generate Signing Link'}</Text>
        </TouchableOpacity>
      </View>

      {generatedLink ? (
        <View style={styles.linkContainer}>
          <Text style={styles.linkLabel}>Share this link with the customer:</Text>
          <TextInput
            style={styles.linkText}
            value={generatedLink}
            editable={false}
          />
          <TouchableOpacity 
            style={styles.copyButton}
            onPress={() => Alert.alert('Copied', 'Link copied to clipboard! (Simulation)')}
          >
            <Text style={styles.copyButtonText}>Copy Link</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={{ marginTop: 30 }}>
        <DocumentList />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f5f5',
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
    textAlign: 'center',
  },
  form: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
    color: '#666',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#007bff',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  linkContainer: {
    marginTop: 30,
    padding: 20,
    backgroundColor: '#e9ecef',
    borderRadius: 10,
  },
  linkLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  linkText: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 5,
    color: '#007bff',
  },
  copyButton: {
    marginTop: 10,
    backgroundColor: '#28a745',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  copyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
