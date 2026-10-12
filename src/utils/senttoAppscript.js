import html2canvas from 'html2canvas';
import Swal from 'sweetalert2';
import { uploadFileToStorage } from '../services/storageSeam';
import supabase from '../supabaseClient';

export const RECEIPT_GAS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbyHS14sBd_n87T-mfnQ5fDl0wtc4zsaFn0NWw7coSjXD8xHErlGRvCCbqbPu2IHkkTt3g/exec';

/**
 * Converts receipt DOM element to crisp A4 image using html2canvas,
 * uploads to Firebase Storage (`receipts_img/`),
 * forwards to Google Apps Script Webhook to post to LINE group,
 * and updates `pdf_link` in Supabase transaction and Interest_chart records.
 * 
 * @param {React.RefObject} receiptRef - Reference to the 794px A4 receipt DOM container
 * @param {Object} paymentData - Payment transaction metadata
 * @returns {Promise<Object>} Result object with imageUrl and success status
 */
export const sendReceiptToGoogleAppsScript = async (receiptRef, paymentData = {}) => {
  if (!receiptRef || !receiptRef.current) {
    console.warn('sendReceiptToGoogleAppsScript: receiptRef is not provided or empty');
    return null;
  }

  try {
    // 1. Wait for web fonts (Sarabun, etc.) to be ready
    if (typeof document !== 'undefined' && document.fonts) {
      await document.fonts.ready;
    }

    // 2. Render container to Canvas with scale: 2 (crisp A4 print resolution)
    const canvas = await html2canvas(receiptRef.current, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
    });

    if (Swal.isVisible()) {
      Swal.update({ title: 'กำลังสร้างรูปภาพใบเสร็จมาตรฐาน...' });
    }

    // 3. Convert Canvas to JPEG Blob
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));

    // 4. Generate unique file name matching my-app - Copy convention
    const invoiceNum = paymentData.invoiceID 
      ? String(paymentData.invoiceID).replace(/[/]/g, '-') 
      : 'unknown_receipt';
    const fileName = `receipts_img/${invoiceNum}_${Date.now()}.jpg`;

    if (Swal.isVisible()) {
      Swal.update({ title: 'กำลังอัปโหลดรูปภาพใบเสร็จ...' });
    }
    console.log('Uploading receipt image to Firebase Storage:', fileName);

    // 5. Upload to Firebase Storage
    const imageUrl = await uploadFileToStorage(blob, fileName);

    if (!imageUrl) {
      throw new Error('อัปโหลดรูปภาพลง Firebase Storage ไม่สำเร็จ');
    }
    console.log('Receipt upload success. URL:', imageUrl);

    // 6. Update pdf_link in Supabase transaction and Interest_chart
    if (paymentData.invoiceID) {
      try {
        await Promise.all([
          supabase
            .from('transaction')
            .update({ pdf_link: imageUrl })
            .eq('Invoice', paymentData.invoiceID),
          supabase
            .from('Interest_chart')
            .update({ pdf_link: imageUrl })
            .eq('reference', paymentData.invoiceID),
        ]);
        console.log('Updated pdf_link in Supabase for Invoice:', paymentData.invoiceID);
      } catch (dbErr) {
        console.warn('Failed to update pdf_link in Supabase:', dbErr);
      }
    }

    // 7. Post payload to Google Apps Script Webhook
    if (Swal.isVisible()) {
      Swal.update({ title: 'กำลังส่งใบเสร็จเข้ากลุ่ม LINE...' });
    }

    const payload = {
      imageUrl: imageUrl,
      paymentData: {
        ...paymentData,
        imageUrl: imageUrl,
      },
    };

    const response = await fetch(RECEIPT_GAS_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Google Apps Script HTTP Error: ${response.status}`);
    }

    const result = await response.json().catch(() => ({ success: true }));
    console.log('Result from Google Apps Script:', result);

    return {
      success: true,
      imageUrl: imageUrl,
      url: imageUrl,
      gasResult: result,
    };

  } catch (error) {
    console.error('Error in sendReceiptToGoogleAppsScript:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};
