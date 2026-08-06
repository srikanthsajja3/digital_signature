import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { supabase } from './supabase';

let cachedTemplateBuffer: ArrayBuffer | null = null;

export async function generateUnsignedPDF(customerName: string, customerEmail: string, details: any) {
  try {
    let arrayBuffer: ArrayBuffer;

    if (cachedTemplateBuffer) {
      console.log('Using in-memory cached template.pdf');
      arrayBuffer = cachedTemplateBuffer.slice(0);
    } else {
      console.log('Attempting to load local template.pdf from assets...');
      try {
        // Try local asset first for instant load
        const localTemplate = require('../assets/template.pdf');
        const assetUrl = typeof localTemplate === 'string' ? localTemplate : (localTemplate.default || localTemplate.uri || localTemplate);
        
        const response = await fetch(assetUrl);
        if (response.ok) {
          arrayBuffer = await response.arrayBuffer();
          cachedTemplateBuffer = arrayBuffer;
          console.log('Successfully loaded template.pdf from local assets instantly!');
        } else {
          throw new Error('Local asset fetch returned non-ok status');
        }
      } catch (localErr: any) {
        console.log('Local asset fetch skipped, downloading from Supabase storage:', localErr.message);
        
        // Download fallback from Supabase Storage
        const { data: signedData } = await supabase.storage
          .from('pdfs')
          .createSignedUrl('template.pdf', 60);

        let templateData;
        if (signedData?.signedUrl) {
          const response = await fetch(signedData.signedUrl);
          if (!response.ok) throw new Error(`Template fetch failed: ${response.statusText}`);
          templateData = await response.blob();
        } else {
          const { data, error } = await supabase.storage
            .from('pdfs')
            .download('template.pdf');
          if (error) throw error;
          templateData = data;
        }

        if (!templateData) {
          throw new Error('Template file not accessible in Supabase Storage.');
        }

        arrayBuffer = await templateData.arrayBuffer();
        cachedTemplateBuffer = arrayBuffer;
      }
    }

    // 2. Load the existing PDF
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

    // Applicant Details Overlay (Finalized Coordinates)
    drawText(customerName, 155, 203, 12, true); 
    drawText(details.dob, 178, 228, 12, true);
    drawText(details.mobile, 370, 228, 12, true);
    drawText(customerEmail, 130, 252, 12, true); 
    drawText(details.address, 135, 277, 12, true);
    drawText(details.idProofNumber, 370, 302, 12, true);

    // Scheme Details Overlay
    drawText(`${details.monthlyInstallment}`, 297, 385, 15, true);
    drawText(details.totalContribution, 230, 433, 15, true);

    // Payment Details
    drawText(details.firstInstallmentDate, 245, 608, 14, true);
    drawText(details.preferredPaymentDate, 375, 633, 12, true);

    // Nominee
    if (details.nominee?.name) {
      drawText(details.nominee.name, 110, 710, 12, true);
      drawText(details.nominee.relationship, 160, 732, 12, true);
      drawText(details.nominee.contact, 362, 732, 12, true);
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
  
  // Strip the "data:image/png;base64," prefix if it exists
  const base64Data = signatureBase64.includes(',') ? signatureBase64.split(',')[1] : signatureBase64;
  const signatureImage = await pdfDoc.embedPng(base64Data);
  
  // Significantly reduced size to be much smaller
  const sigWidth = 100;
  const sigHeight = 30;

  // Draw signature on EVERY page at the bottom right
  pages.forEach((page) => {
    const { width } = page.getSize();
    page.drawImage(signatureImage, {
      x: width - sigWidth - 100, // Position verified previously
      y: 80,                     
      width: sigWidth,
      height: sigHeight,
    });
  });

  return await pdfDoc.save();
}
