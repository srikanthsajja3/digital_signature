import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, TouchableOpacity, Linking, Platform, Modal } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '../../utils/supabase';
import SignaturePad from '../../components/SignaturePad';
import { generateUnsignedPDF, addSignatureToPDF } from '../../utils/pdf';

export default function SigningPage() {
  const { id } = useLocalSearchParams();
  const [document, setDocument] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
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
          
          console.log('Uploading regenerated PDF back to storage...');
          const { error: reUploadError } = await supabase.storage
            .from('pdfs')
            .upload(unsignedFileName, pdfData, { contentType: 'application/pdf', upsert: true });
          
          if (reUploadError) {
            console.error('Failed to re-upload regenerated PDF:', reUploadError.message);
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

      // 4. Update Document Status & Clean up Unsigned PDF concurrently
      console.log('Updating status & cleaning up temporary files...');
      const [updateRes] = await Promise.all([
        supabase.from('documents').update({ status: 'signed' }).eq('id', id),
        supabase.storage.from('pdfs').remove([unsignedFileName]).catch(err => console.warn('Remove failed:', err)),
      ]);

      if (updateRes.error) {
        console.error('Status update failed:', updateRes.error);
        throw updateRes.error;
      }
      console.log('Database status updated successfully.');

      // 6. Get Public URL for the signed document
      const { data: urlData } = supabase.storage
        .from('pdfs')
        .getPublicUrl(signedFileName);

      setSignedUrl(urlData.publicUrl);
      console.log('Process complete. Signed URL:', urlData.publicUrl);
      
      // Close loading modal and show success modal
      setSigning(false);
      setShowSuccessModal(true);
      fetchDocument(); 
    } catch (error: any) {
      console.error('CRITICAL handleSignature Error:', error);
      setSigning(false);
      Alert.alert('Error', error.message || 'Failed to sign document.');
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={{ marginTop: 10 }}>Loading Document...</Text>
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

      {/* 1. ROTATING LOADING POPUP MODAL */}
      <Modal
        visible={signing}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ActivityIndicator size="large" color="#007bff" style={{ transform: [{ scale: 1.4 }], marginVertical: 15 }} />
            <Text style={styles.modalTitle}>Processing Signature...</Text>
            <Text style={styles.modalSubtitle}>Please wait while your document is being digitally signed and secured.</Text>
          </View>
        </View>
      </Modal>

      {/* 2. SUCCESS POPUP MODAL */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.successBadge}>
              <Text style={styles.checkmarkIcon}>✓</Text>
            </View>
            <Text style={styles.modalTitle}>Signed Successfully!</Text>
            <Text style={styles.modalSubtitle}>Your signature has been embedded and the application is officially completed.</Text>
            
            {signedUrl ? (
              <TouchableOpacity 
                style={[styles.downloadButton, { marginTop: 15 }]}
                onPress={handleDownload}
              >
                <Text style={styles.downloadButtonText}>Download Signed PDF</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity 
              style={styles.closeModalButton}
              onPress={() => setShowSuccessModal(false)}
            >
              <Text style={styles.closeModalButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}:</Text>
      <Text style={styles.detailValue}>{value || 'N/A'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: '#1C1209',
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1C1209',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 24,
    textAlign: 'center',
    color: '#D4AF37',
    letterSpacing: 0.5,
  },
  infoCard: {
    backgroundColor: '#2A1D11',
    padding: 24,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#4A3520',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: '#D4AF37',
    letterSpacing: 1.2,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#4A3520',
    paddingBottom: 6,
    textTransform: 'uppercase',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
  },
  detailLabel: {
    fontSize: 14,
    color: '#A39282',
    flex: 1,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
    flex: 1.5,
    textAlign: 'right',
  },
  benefitBox: {
    backgroundColor: '#3D2B1A',
    padding: 14,
    borderRadius: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#5C4428',
  },
  benefitText: {
    fontSize: 13,
    color: '#F3E5AB',
    fontWeight: '500',
    lineHeight: 19,
  },
  statusContainer: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#3D2B1A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    fontWeight: '700',
    color: '#D4AF37',
    marginRight: 10,
    fontSize: 15,
  },
  status: {
    fontWeight: '800',
    fontSize: 13,
    paddingVertical: 5,
    paddingHorizontal: 12,
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
  instruction: {
    fontSize: 16,
    color: '#E5D3B3',
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  successContainer: {
    alignItems: 'center',
    marginTop: 12,
  },
  successText: {
    fontSize: 20,
    color: '#4CAF50',
    fontWeight: '800',
    marginBottom: 20,
  },
  downloadButton: {
    backgroundColor: '#D4AF37',
    paddingVertical: 16,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  downloadButtonText: {
    color: '#1C1209',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#2A1D11',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4A3520',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#D4AF37',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#CCCCCC',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  successBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  checkmarkIcon: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
  },
  closeModalButton: {
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: '#3D2B1A',
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4A3520',
  },
  closeModalButtonText: {
    color: '#D4AF37',
    fontSize: 15,
    fontWeight: '700',
  },
});
