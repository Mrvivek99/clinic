/**
 * QR Code generation utility
 * Generates base64 QR codes for appointment tokens
 */

async function generateQRCode(data) {
  try {
    // In production, install: npm install qrcode
    // const QRCode = require('qrcode');
    // return await QRCode.toDataURL(data);

    // Placeholder for now - returns a data URL indicator
    const encoded = Buffer.from(data).toString('base64');
    return `data:image/qr-placeholder;base64,${encoded}`;
  } catch (err) {
    console.error('QR Code generation error:', err);
    return null;
  }
}

module.exports = { generateQRCode };
