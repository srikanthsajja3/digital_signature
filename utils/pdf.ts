import { PDFDocument, rgb, StandardFonts } from 'pdf-lib/es/index';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';

export async function generateUnsignedPDF(customerName: string, details: string) {
  // Create a new PDFDocument
  const pdfDoc = await PDFDocument.create();
  const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);

  // Add a blank page to the document
  const page = pdfDoc.addPage([600, 800]);
  const { width, height } = page.getSize();

  // Draw some text
  page.drawText('CUSTOMER AGREEMENT', {
    x: 50,
    y: height - 50,
    size: 24,
    font: timesRomanFont,
    color: rgb(0, 0.53, 0.71),
  });

  page.drawText(`Customer Name: ${customerName}`, {
    x: 50,
    y: height - 100,
    size: 16,
    font: timesRomanFont,
  });

  page.drawText('Agreement Details:', {
    x: 50,
    y: height - 150,
    size: 14,
    font: timesRomanFont,
  });

  page.drawText(details, {
    x: 50,
    y: height - 180,
    size: 12,
    font: timesRomanFont,
    lineHeight: 15,
    maxWidth: 500,
  });

  page.drawText('Signature:', {
    x: 50,
    y: 150,
    size: 14,
    font: timesRomanFont,
  });

  // Serialize the PDFDocument to bytes (a Uint8Array)
  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

export async function addSignatureToPDF(pdfBytes: Uint8Array, signatureBase64: string) {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];

  // Embed the signature image
  const signatureImage = await pdfDoc.embedPng(signatureBase64);
  const sigDims = signatureImage.scale(0.5);

  // Draw the signature image on the first page
  firstPage.drawImage(signatureImage, {
    x: 50,
    y: 50,
    width: sigDims.width,
    height: sigDims.height,
  });

  const signedPdfBytes = await pdfDoc.save();
  return signedPdfBytes;
}
