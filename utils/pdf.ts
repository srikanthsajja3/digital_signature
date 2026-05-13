import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { supabase } from './supabase';

export async function generateUnsignedPDF(customerName: string, customerEmail: string, details: any) {
  try {
    // 1. Download the template from Supabase
    // We try createSignedUrl first as it's more robust for private buckets
    const { data: signedData, error: signedError } = await supabase.storage
      .from('pdfs')
      .createSignedUrl('template.pdf', 60);

    let templateData;
    if (signedData?.signedUrl) {
      const response = await fetch(signedData.signedUrl);
      if (!response.ok) throw new Error(`Template fetch failed: ${response.statusText}`);
      templateData = await response.blob();
    } else {
      // Fallback to direct download
      const { data, error } = await supabase.storage
        .from('pdfs')
        .download('template.pdf');
      if (error) throw error;
      templateData = data;
    }

    if (!templateData) {
      throw new Error('Template file not accessible in Supabase Storage.');
    }

    // 2. Load the existing PDF
    const arrayBuffer = await templateData.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const sanitizeText = (text: string) => {
      if (!text) return '';
      return String(text).replace(/₹/g, 'INR');
    };

    const drawText = (text: string, x: number, y: number, size = 10, isBold = false) => {
      if (!text) return;
      firstPage.drawText(sanitizeText(text), {
        x,
        y: height - y,
        size,
        font: isBold ? fontBold : font,
        color: rgb(0, 0, 0),
      });
    };

    // Applicant Details Overlay
    drawText(customerName, 160, 200, 11, true); 
    drawText(details.dob, 178, 228);
    drawText(details.mobile, 380, 228);
    drawText(customerEmail, 140, 250); 
    drawText(details.address, 140, 275, 9);
    drawText(details.idProofNumber, 380, 300);

    // Scheme Details Overlay
    drawText(`INR ${details.monthlyInstallment}`, 310, 380, 11, true);
    drawText(details.schemeDuration, 240, 430);

    // Payment Details
    drawText(details.firstInstallmentDate, 260, 605);
    drawText(details.preferredPaymentDate, 380, 630);

    // Nominee
    if (details.nominee?.name) {
      drawText(details.nominee.name, 110, 710);
      drawText(details.nominee.relationship, 160, 732);
      drawText(details.nominee.contact, 360, 732);
    }

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
  } catch (err: any) {
    console.warn('Falling back to basic PDF generation:', err.message);
    return generateBasicPDF(customerName, customerEmail, details, err.message);
  }
}

async function generateBasicPDF(customerName: string, customerEmail: string, details: any, errorMessage?: string) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([600, 850]);
  const { height } = page.getSize();

  const sanitizeText = (text: string) => {
    if (!text) return '';
    return String(text).replace(/₹/g, 'INR');
  };

  page.drawText('MOKSHA APPLICATION FORM (Draft)', { x: 50, y: height - 50, size: 20, font: fontBold });
  
  if (errorMessage) {
    page.drawText(`Template Error: ${sanitizeText(errorMessage)}`, { x: 50, y: height - 80, size: 10, font, color: rgb(1, 0, 0) });
  }

  page.drawText(`Full Name: ${sanitizeText(customerName)}`, { x: 50, y: height - 120, size: 12, font });
  page.drawText(`Email: ${sanitizeText(customerEmail)}`, { x: 50, y: height - 140, size: 12, font });
  page.drawText(`Installment: INR ${sanitizeText(details.monthlyInstallment)}`, { x: 50, y: height - 160, size: 12, font });
  page.drawText(`Mobile: ${sanitizeText(details.mobile)}`, { x: 50, y: height - 180, size: 12, font });

  return await pdfDoc.save();
}

export async function addSignatureToPDF(pdfBytes: Uint8Array, signatureBase64: string) {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  const { width } = firstPage.getSize();

  // Strip the "data:image/png;base64," prefix if it exists
  const base64Data = signatureBase64.includes(',') ? signatureBase64.split(',')[1] : signatureBase64;
  const signatureImage = await pdfDoc.embedPng(base64Data);
  
  // Significantly reduced size to be much smaller
  const sigWidth = 100;
  const sigHeight = 30;

  // Draw signature at the bottom right, closer to the corner
  firstPage.drawImage(signatureImage, {
    x: width - sigWidth - 100, // Increased from 80 to 100 to move it 20 units LEFT
    y: 80,                     // Decreased from 90 to 80 to move it 10 units DOWN
    width: sigWidth,
    height: sigHeight,
  });

  return await pdfDoc.save();
}



