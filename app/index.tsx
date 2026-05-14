import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { supabase } from '../utils/supabase';
import * as Linking from 'expo-linking';

import { generateUnsignedPDF } from '../utils/pdf';
import DocumentList from '../components/DocumentList';
import { getShareableLink, shareToWhatsApp } from '../utils/links';

export default function AdminDashboard() {
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [idProofType, setIdProofType] = useState('Aadhaar');
  const [idProofNumber, setIdProofNumber] = useState('');
  
  const [monthlyInstallment, setMonthlyInstallment] = useState('');
  const [firstInstallmentDate, setFirstInstallmentDate] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [modeOfPayment, setModeOfPayment] = useState('CASH');

  const [nomineeName, setNomineeName] = useState('');
  const [nomineeRelation, setNomineeRelation] = useState('');
  const [nomineeContact, setNomineeContact] = useState('');

  const [loading, setLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');

  const duration = 11;
  const monthlyVal = monthlyInstallment ? parseInt(monthlyInstallment) : 0;
  // Logic: 10 months at full price + 1st month at 25% discount (75% of price)
  const calculatedTotal = monthlyVal > 0 ? (monthlyVal * 10) + (monthlyVal * 0.75) : 0;
  const totalContribution = calculatedTotal.toString();

  const handleCreateDocument = async () => {
    if (!name || !email || !mobile || !monthlyInstallment) {
      Alert.alert('Error', 'Please fill in all mandatory fields (Name, Email, Mobile, Installment).');
      return;
    }

    setLoading(true);
    try {
      const detailsObj = {
        dob, mobile, address, idProofType, idProofNumber,
        monthlyInstallment, schemeDuration: `${duration} Months`,
        totalContribution: `₹ ${totalContribution}`,
        specialBenefit: 'ENJOY AN EXCLUSIVE 25% DISCOUNT ON YOUR FIRST MONTH INSTALLMENT AT THE TIME OF MATURITY, WITH YOUR 11TH MONTH INSTALLMENT FULLY COVERED BY MOKSHA.',
        modeOfPayment, firstInstallmentDate, preferredPaymentDate: preferredDate,
        nominee: { name: nomineeName, relationship: nomineeRelation, contact: nomineeContact }
      };

      // 1. Insert into Supabase
      const { data, error: dbError } = await supabase
        .from('documents')
        .insert([{ 
          customer_name: name, 
          customer_email: email, 
          details: detailsObj, 
          status: 'pending' 
        }])
        .select().single();

      if (dbError) throw new Error(`Database Error: ${dbError.message}`);

      // 2. Generate PDF
      let pdfBytes;
      try {
        pdfBytes = await generateUnsignedPDF(name, email, detailsObj);
      } catch (pdfErr: any) {
        throw new Error(`PDF Generation Error: ${pdfErr.message}`);
      }

      // 3. Upload to Storage
      const fileName = `unsigned_${data.id}.pdf`;
      console.log('Uploading PDF:', fileName, 'Size:', pdfBytes.length);
      
      // On Web, it's often more reliable to upload a Blob than a Uint8Array
      const uploadData = Platform.OS === 'web' ? new Blob([pdfBytes], { type: 'application/pdf' }) : pdfBytes;

      const { data: uploadRes, error: uploadError } = await supabase.storage
        .from('pdfs')
        .upload(fileName, uploadData, { 
          contentType: 'application/pdf', 
          upsert: true 
        });

      if (uploadError) {
        console.error('Full Upload Error Object:', JSON.stringify(uploadError, null, 2));
        throw new Error(`Upload Error: ${uploadError.message}`);
      }

      console.log('Upload successful:', uploadRes);

      // 4. Generate the shareable link
      const link = getShareableLink(data.id);

      setGeneratedLink(link);
      
      Alert.alert('Success', 'Document generated successfully!', [
        { text: 'Share WhatsApp', onPress: () => shareToWhatsApp(mobile, name, link) },
        { text: 'OK' }
      ]);
    } catch (error: any) {
      console.error(error);
      Alert.alert('Process Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderDropdown = (label: string, value: string, setValue: (val: string) => void, options: string[]) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.pickerContainer}>
        {options.map((opt) => (
          <TouchableOpacity 
            key={opt} 
            style={[styles.chip, value === opt && styles.chipSelected]} 
            onPress={() => setValue(opt)}
          >
            <Text style={[styles.chipText, value === opt && styles.chipTextSelected]}>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Moksha - New Application</Text>
      
      <View style={styles.form}>
        <Text style={styles.sectionTitle}>Applicant Details</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Full Name *" />
        <TextInput style={styles.input} value={dob} onChangeText={setDob} placeholder="Date of Birth (DD/MM/YYYY)" />
        <TextInput style={styles.input} value={mobile} onChangeText={setMobile} placeholder="Mobile Number *" keyboardType="phone-pad" />
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email ID *" keyboardType="email-address" />
        <TextInput style={[styles.input, { height: 60 }]} value={address} onChangeText={setAddress} placeholder="Address" multiline />
        
        {renderDropdown('ID Proof Type', idProofType, setIdProofType, ['Aadhaar', 'PAN', 'Passport', 'Driving License'])}
        <TextInput style={styles.input} value={idProofNumber} onChangeText={setIdProofNumber} placeholder="ID Proof Number" />

        <Text style={styles.sectionTitle}>Scheme Details</Text>
        <TextInput style={styles.input} value={monthlyInstallment} onChangeText={setMonthlyInstallment} placeholder="Monthly Installment Amount *" keyboardType="numeric" />
        <Text style={styles.readOnlyText}>Duration: 11 Months (Default)</Text>
        <Text style={styles.readOnlyText}>Total Contribution: ₹ {totalContribution}</Text>
        <View style={styles.benefitBox}>
          <Text style={styles.benefitText}>Benefit: 25% discount on 1st month at maturity + 11th month covered by Moksha.</Text>
        </View>

        <Text style={styles.sectionTitle}>Payment Details</Text>
        {renderDropdown('Mode of Payment', modeOfPayment, setModeOfPayment, ['CASH', 'UPI', 'CARD', 'BANK TRANSFER'])}
        <TextInput style={styles.input} value={firstInstallmentDate} onChangeText={setFirstInstallmentDate} placeholder="First Installment Date" />
        <TextInput style={styles.input} value={preferredDate} onChangeText={setPreferredDate} placeholder="Preferred Monthly Payment Date (e.g. 5th)" />

        <Text style={styles.sectionTitle}>Nominee Details (Optional)</Text>
        <TextInput style={styles.input} value={nomineeName} onChangeText={setNomineeName} placeholder="Nominee Name" />
        <TextInput style={styles.input} value={nomineeRelation} onChangeText={setNomineeRelation} placeholder="Relationship" />
        <TextInput style={styles.input} value={nomineeContact} onChangeText={setNomineeContact} placeholder="Contact Number" keyboardType="phone-pad" />

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
          <View style={styles.linkButtons}>
            <TouchableOpacity 
              style={[styles.copyButton, { flex: 1, marginRight: 10, backgroundColor: '#25D366' }]}
              onPress={() => shareToWhatsApp(mobile, name, generatedLink)}
            >
              <Text style={styles.copyButtonText}>WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.copyButton, { flex: 1 }]}
              onPress={() => {
                if (Platform.OS === 'web' && navigator.clipboard) {
                  navigator.clipboard.writeText(generatedLink);
                }
                Alert.alert('Copied', 'Link copied to clipboard!');
              }}
            >
              <Text style={styles.copyButtonText}>Copy Link</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}


      <View style={{ marginTop: 30 }}>
        <DocumentList />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#f5f5f5', flexGrow: 1 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: '#333', textAlign: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 15, marginBottom: 10, color: '#007bff', borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 5 },
  form: { backgroundColor: '#fff', padding: 20, borderRadius: 10, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  label: { fontSize: 14, marginBottom: 5, color: '#666' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 5, padding: 10, marginBottom: 12, fontSize: 16 },
  readOnlyText: { fontSize: 16, marginBottom: 10, color: '#333', fontWeight: '500' },
  benefitBox: { backgroundColor: '#e7f3ff', padding: 10, borderRadius: 5, marginBottom: 15 },
  benefitText: { fontSize: 13, color: '#0056b3', fontStyle: 'italic' },
  fieldContainer: { marginBottom: 15 },
  pickerContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#007bff', backgroundColor: '#fff' },
  chipSelected: { backgroundColor: '#007bff' },
  chipText: { color: '#007bff', fontSize: 12 },
  chipTextSelected: { color: '#fff' },
  button: { backgroundColor: '#007bff', padding: 15, borderRadius: 5, alignItems: 'center', marginTop: 10 },
  buttonDisabled: { backgroundColor: '#ccc' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  linkContainer: { marginTop: 30, padding: 20, backgroundColor: '#e9ecef', borderRadius: 10 },
  linkLabel: { fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  linkText: { backgroundColor: '#fff', padding: 10, borderRadius: 5, color: '#007bff' },
  linkButtons: {
    flexDirection: 'row',
    marginTop: 10,
  },
  copyButton: {
    backgroundColor: '#28a745',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
  },
  copyButtonText: { color: '#fff', fontWeight: 'bold' },
});

