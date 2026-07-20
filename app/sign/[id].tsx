import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, TouchableOpacity, Linking, Platform } from 'react-native';
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
    console.log('Fetching document with ID:', id);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Database fetch error:', error);
        throw error;
      }
      console.log('Document fetched successfully:', data.customer_name);
      setDocument(data);

      // If already signed, fetch the URL
      if (data.status === 'signed') {
        const { data: urlData } = supabase.storage
          .from('pdfs')
          .getPublicUrl(`signed_${id}.pdf`);
        console.log('Document already signed, public URL:', urlData.publicUrl);
        setSignedUrl(urlData.publicUrl);
      }
    } catch (error: any) {
      console.error('fetchDocument failed:', error);
      Alert.alert('Error', 'Could not find the document in database.');
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
    console.log('Starting handleSignature process...');
    setSigning(true);
    try {
      const unsignedFileName = `unsigned_${id}.pdf`;
      console.log('Attempting to retrieve PDF:', unsignedFileName);
      
      let pdfData: Blob | null = null;

      // Try direct download first as it's more standard
      console.log('Calling supabase.storage.download...');
      const { data: downloadedData, error: downloadError } = await supabase.storage
        .from('pdfs')
        .download(unsignedFileName);
      
      if (downloadError) {
        console.warn('Initial download attempt failed:', downloadError.message);
        
        // Try createSignedUrl as a second attempt
        console.log('Calling supabase.storage.createSignedUrl as fallback...');
        const { data: signedData, error: signedError } = await supabase.storage
          .from('pdfs')
          .createSignedUrl(unsignedFileName, 60);

        if (signedData?.signedUrl) {
          console.log('Signed URL obtained, fetching...');
          const response = await fetch(signedData.signedUrl);
          if (response.ok) {
            pdfData = await response.blob();
            console.log('PDF data fetched via signed URL, size:', pdfData.size);
          } else {
            console.warn('Fetch from signed URL failed with status:', response.status);
          }
        } else {
          console.warn('createSignedUrl also failed:', signedError?.message);
        }
      } else {
        pdfData = downloadedData;
        console.log('PDF data downloaded directly, size:', pdfData.size);
      }
      
      // Fallback: If still no PDF data, REGENERATE it!
      if (!pdfData) {
        console.log('PDF missing from storage, attempting to regenerate on the fly...');
        try {
          const regeneratedPdfBytes = await generateUnsignedPDF(document.customer_name, document.customer_email, document.details);
          pdfData = new Blob([regeneratedPdfBytes as any], { type: 'application/pdf' });
          console.log('PDF regenerated successfully, size:', pdfData.size);
          
          // Optionally upload it back so it's there next time
          console.log('Uploading regenerated PDF back to storage...');
          const { error: reUploadError } = await supabase.storage
            .from('pdfs')
            .upload(unsignedFileName, pdfData, { contentType: 'application/pdf', upsert: true });
          
          if (reUploadError) {
            console.error('Failed to re-upload regenerated PDF:', reUploadError.message);
            // We continue anyway since we have the data in memory
          } else {
            console.log('Regenerated PDF uploaded back successfully.');
          }
        } catch (regenError: any) {
          console.error('Regeneration critical failure:', regenError);
          throw new Error(`PDF could not be retrieved or regenerated: ${regenError.message}`);
        }
      }

      if (!pdfData) throw new Error('Could not retrieve or generate PDF data.');

      console.log('Processing PDF data for signing...');
      // Convert Blob to Uint8Array
      const arrayBuffer = await pdfData.arrayBuffer();
      const pdfBytes = new Uint8Array(arrayBuffer);

      // 2. Add signature to PDF
      console.log('Adding signature to PDF...');
      const signedPdfBytes = await addSignatureToPDF(pdfBytes, signatureBase64);
      console.log('Signature added, signed PDF size:', signedPdfBytes.length);

      // 3. Upload Signed PDF to Supabase Storage
      const signedFileName = `signed_${id}.pdf`;
      const uploadData = Platform.OS === 'web' ? new Blob([signedPdfBytes as any], { type: 'application/pdf' }) : signedPdfBytes;
      
      console.log('Uploading signed PDF:', signedFileName);
      const { error: uploadError } = await supabase.storage
        .from('pdfs')
        .upload(signedFileName, uploadData, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) {
        console.error('Signed PDF upload failed:', uploadError);
        throw uploadError;
      }
      console.log('Signed PDF uploaded successfully.');

      // 4. Update Document Status
      console.log('Updating document status to "signed" in database...');
      const { error: updateError } = await supabase
        .from('documents')
        .update({ status: 'signed' })
        .eq('id', id);

      if (updateError) {
        console.error('Status update failed:', updateError);
        throw updateError;
      }
      console.log('Database status updated successfully.');

      // 5. Delete the unsigned PDF to save storage space
      try {
        console.log('Deleting unsigned PDF:', unsignedFileName);
        await supabase.storage
          .from('pdfs')
          .remove([unsignedFileName]);
      } catch (err) {
        console.warn('Failed to delete unsigned PDF:', err);
      }

      // 6. Get Public URL for the signed document
      const { data: urlData } = supabase.storage
        .from('pdfs')
        .getPublicUrl(signedFileName);

      setSignedUrl(urlData.publicUrl);
      console.log('Process complete. Signed URL:', urlData.publicUrl);
      Alert.alert('Success', 'Document signed successfully!');
      fetchDocument(); 
    } catch (error: any) {
      console.error('CRITICAL handleSignature Error:', error);
      Alert.alert('Error', error.message || 'Failed to sign document.');
    } finally {
      setSigning(false);
      console.log('handleSignature process finished.');
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
      <Text style={styles.title}>Review & Sign Application</Text>

      <View style={styles.infoCard}>
        <Text style={styles.sectionHeader}>APPLICANT DETAILS</Text>
        <DetailRow label="Full Name" value={document.customer_name} />
        <DetailRow label="Date of Birth" value={document.details.dob} />
        <DetailRow label="Mobile Number" value={document.details.mobile} />
        <DetailRow label="Email ID" value={document.customer_email} />
        <DetailRow label="Address" value={document.details.address} />
        <DetailRow label="ID Proof" value={`${document.details.idProofType} - ${document.details.idProofNumber}`} />

        <Text style={[styles.sectionHeader, { marginTop: 20 }]}>SCHEME DETAILS</Text>
        <DetailRow label="Monthly Installment" value={`₹ ${document.details.monthlyInstallment}`} />
        <DetailRow label="Duration" value={document.details.schemeDuration} />
        <DetailRow label="Total Contribution" value={document.details.totalContribution} />
        <View style={styles.benefitBox}>
          <Text style={styles.benefitText}>{document.details.specialBenefit}</Text>
        </View>

        <Text style={[styles.sectionHeader, { marginTop: 20 }]}>PAYMENT DETAILS</Text>
        <DetailRow label="Mode of Payment" value={document.details.modeOfPayment} />
        <DetailRow label="First Installment" value={document.details.firstInstallmentDate} />
        <DetailRow label="Preferred Date" value={document.details.preferredPaymentDate} />

        {document.details.nominee?.name ? (
          <>
            <Text style={[styles.sectionHeader, { marginTop: 20 }]}>NOMINEE DETAILS</Text>
            <DetailRow label="Name" value={document.details.nominee.name} />
            <DetailRow label="Relationship" value={document.details.nominee.relationship} />
            <DetailRow label="Contact" value={document.details.nominee.contact} />
          </>
        ) : null}

        <View style={styles.statusContainer}>
          <Text style={styles.infoLabel}>Status:</Text>
          <Text style={[styles.status, document.status === 'signed' ? styles.signed : styles.pending]}>
            {document.status.toUpperCase()}
          </Text>
        </View>
      </View>

      {document.status === 'pending' ? (
        <>
          <Text style={styles.instruction}>Please sign in the box below to complete the application.</Text>
          <SignaturePad onOK={handleSignature} />
          {signing && <ActivityIndicator style={{ marginTop: 10 }} />}
        </>
      ) : (
        <View style={styles.successContainer}>
          <Text style={styles.successText}>Application successfully signed.</Text>
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}:</Text>
      <Text style={styles.detailValue}>{value || 'N/A'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f0f2f5',
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#1a1a1a',
  },
  infoCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#e1e4e8',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#007bff',
    letterSpacing: 1,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f2f5',
    paddingBottom: 5,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '500',
    flex: 1.5,
    textAlign: 'right',
  },
  benefitBox: {
    backgroundColor: '#fff9e6',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#ffeeba',
  },
  benefitText: {
    fontSize: 12,
    color: '#856404',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  statusContainer: {
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#f0f2f5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    fontWeight: 'bold',
    color: '#555',
    marginRight: 10,
  },
  status: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  pending: {
    color: '#fd7e14',
  },
  signed: {
    color: '#28a745',
  },
  instruction: {
    fontSize: 16,
    color: '#495057',
    marginBottom: 15,
    textAlign: 'center',
    fontWeight: '500',
  },
  successContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  successText: {
    fontSize: 18,
    color: '#28a745',
    fontWeight: 'bold',
    marginBottom: 20,
  },
  downloadButton: {
    backgroundColor: '#007bff',
    padding: 18,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
