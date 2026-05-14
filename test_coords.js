const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function testCoordinates() {
  try {
    const templatePath = path.join(__dirname, 'assets', 'template.pdf');

    if (!fs.existsSync(templatePath)) {
      console.error('Error: assets/template.pdf not found.');
      return;
    }

    const templateBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const drawText = (text, x, y, size = 10, isBold = false) => {
      if (!text) return;
      firstPage.drawText(text, {
        x,
        y: height - y,
        size,
        font: isBold ? fontBold : font,
        color: rgb(0, 0, 0),
      });
    };

    // --- Sample Data ---
    const customerName = "SRIKANTH TEST";
    const details = {
      dob: "01/01/2000",
      mobile: "9876543210",
      email: "test@example.com",
      address: "123 Test Street, Sample City, 500001",
      idProofNumber: "ABCDE1234F",
      monthlyInstallment: "1000",
      totalContribution : "10750",
      schemeDuration: "11 Months",
      firstInstallmentDate: "15/05/2026",
      preferredPaymentDate: "05th of month",
      nominee: {
        name: "NOMINEE NAME",
        relationship: "Brother",
        contact: "9000000000"
      }
    };

    // Applicant Details Overlay (Finalized Coordinates)
    drawText(customerName, 155, 203, 12, true); 
    drawText(details.dob, 178, 228, 12, true);
    drawText(details.mobile, 370, 228, 12, true);
    drawText(details.email, 130, 252, 12, true); 
    drawText(details.address, 135, 277, 12, true);
    drawText(details.idProofNumber, 370, 302, 12, true);

    // Scheme Details Overlay
    drawText(`${details.monthlyInstallment}`, 299, 385, 15, true);
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
    fs.writeFileSync('test-output.pdf', pdfBytes);
    console.log('Successfully created test-output.pdf with standard Helvetica and Black color');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testCoordinates();
