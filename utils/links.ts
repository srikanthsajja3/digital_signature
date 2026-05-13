import * as Linking from 'expo-linking';
import { Platform, Alert } from 'react-native';

/**
 * Generates a shareable link for a document to be signed.
 */
export function getShareableLink(id: string): string {
  let link = Linking.createURL(`/sign/${id}`);
  
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const origin = window.location.origin;
    const base = origin.endsWith('/') ? origin.slice(0, -1) : origin;
    link = `${base}/sign/${id}`;
  }
  
  return link;
}

/**
 * Opens WhatsApp with a pre-filled message for the customer.
 */
export function shareToWhatsApp(phone: string, customerName: string, link: string) {
  const cleanedPhone = phone.replace(/\D/g, '');
  const finalPhone = cleanedPhone.length === 10 ? `91${cleanedPhone}` : cleanedPhone;
  const message = `Hello ${customerName},\n\nPlease review and sign your Moksha Application using this link:\n\n${link}`;
  const whatsappUrl = `https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`;
  
  Linking.openURL(whatsappUrl).catch(() => Alert.alert('Error', 'WhatsApp not found.'));
}
