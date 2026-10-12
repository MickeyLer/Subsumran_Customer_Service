import supabase from '../supabaseClient';
import { notifyAdminViaGAS } from './gasHelpers';

// ===== 🏦 ข้อมูลบริษัทหลัก =====
export const COMPANY_BANK_INFO = {
  bankName: 'ธนาคารไทยพาณิชย์ (SCB)',
  accountNumber: '426-047180-9',
  accountName: 'บริษัท ทรัพย์สำราญ พิโก จำกัด',
  accountNameVariations: ['ทรัพย์สำราญ', 'ทรัพย์สำราญ พิโก', 'บริษัท ทรัพย์สำราญ', 'SUB SUM RAN']
};

export const PROMPTPAY_NUMBER = '0845155435'; // เบอร์พร้อมเพย์บริษัท

// ===== Configuration API Keys =====
const DEFAULT_GEMINI_API_KEYS = [
  'AIzaSyBH8MFeMaMoxrvGRBqliCol55dv8OYhblk',
  'AIzaSyBMLhu79_L1o34FiWkTv00Ebkqd4uvvnC0'
];

const rawKeys = (typeof process !== 'undefined' && process.env && (process.env.NEXT_PUBLIC_GEMINI_API_KEYS || process.env.REACT_APP_GEMINI_API_KEYS || process.env.NEXT_PUBLIC_GEMINI_API_KEY)) || '';
const envKeys = rawKeys ? rawKeys.split(',').map((k) => k.trim()).filter(Boolean) : [];
const GEMINI_API_KEYS = envKeys.length > 0 ? envKeys : DEFAULT_GEMINI_API_KEYS;

// ===== API Key Manager =====
class APIKeyManager {
  constructor(keys) {
    this.keys = keys;
    this.currentIndex = Math.floor(Math.random() * keys.length);
    this.keyStatus = new Map();

    keys.forEach((key, index) => {
      this.keyStatus.set(key, {
        index: index,
        failures: 0,
        lastError: null,
        isBlocked: false,
        blockUntil: null
      });
    });
  }

  getCurrentKey() {
    for (let i = 0; i < this.keys.length; i++) {
      const actualIndex = (this.currentIndex + i) % this.keys.length;
      const key = this.keys[actualIndex];
      const status = this.keyStatus.get(key);

      if (status.isBlocked) {
        if (status.blockUntil && Date.now() > status.blockUntil) {
          status.isBlocked = false;
          status.failures = 0;
        } else {
          continue;
        }
      }

      this.currentIndex = actualIndex;
      return key;
    }

    // Fallback if all blocked: pick current
    return this.keys[this.currentIndex];
  }

  reportError(key, error) {
    const status = this.keyStatus.get(key);
    if (!status) return;
    status.failures++;
    status.lastError = error.message;

    if (status.failures >= 3) {
      status.isBlocked = true;
      status.blockUntil = Date.now() + (3 * 60 * 1000);
      this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    }
  }

  reportSuccess(key) {
    const status = this.keyStatus.get(key);
    if (status) {
      status.failures = 0;
      status.lastError = null;
    }
  }
}

const apiKeyManager = new APIKeyManager(GEMINI_API_KEYS);

// ===== Duplicate Slip Tracking =====
let usedQRCodes = new Map();

export const initializeUsedQRCodes = () => {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('usedQRCodes');
      if (stored) {
        usedQRCodes = new Map(Object.entries(JSON.parse(stored)));
      }
    }
  } catch (error) {
    console.error('Error loading QR codes:', error);
  }
};

export const addUsedQRCode = async (qrHash, qrContent = '', additionalData = {}) => {
  if (!qrHash) return false;
  try {
    const qrData = {
      hash: qrHash,
      content: qrContent,
      timestamp: new Date().toISOString(),
      ...additionalData
    };

    // 1. Save to memory & localStorage cache
    usedQRCodes.set(qrHash, qrData);
    if (typeof localStorage !== 'undefined') {
      const obj = Object.fromEntries(usedQRCodes);
      localStorage.setItem('usedQRCodes', JSON.stringify(obj));
    }

    // 2. Save centrally to Supabase `used_slips` table
    try {
      await supabase
        .from('used_slips')
        .insert([{
          hash: qrHash,
          contract_id: additionalData.contractId || null,
          user_name: additionalData.userName || null,
          amount: additionalData.amount || null,
          slip_url: additionalData.slipUrl || null,
        }]);
      console.log('🔒 Saved used slip hash to Supabase:', qrHash);
    } catch (dbErr) {
      console.warn('Failed to insert into Supabase used_slips:', dbErr);
    }

    return true;
  } catch (error) {
    console.error('Error saving QR code:', error);
    return false;
  }
};

export const isQRCodeUsed = async (qrHash) => {
  if (!qrHash) return false;

  // 1. Fast check in memory & localStorage
  if (usedQRCodes.size === 0) initializeUsedQRCodes();
  if (usedQRCodes.has(qrHash)) return true;

  // 2. Centralized check in Supabase `used_slips`
  try {
    const { data, error } = await supabase
      .from('used_slips')
      .select('id, hash, created_at')
      .eq('hash', qrHash)
      .maybeSingle();

    if (!error && data) {
      usedQRCodes.set(qrHash, { hash: qrHash, timestamp: data.created_at });
      return true;
    }
  } catch (err) {
    console.warn('Supabase used_slips query error (falling back to local):', err);
  }

  return false;
};

// ===== Hash Image (SHA-256) =====
const hashImageBlob = async (blob) => {
  if (!blob) return '0';
  try {
    const buffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    console.error('Error hashing image blob:', err);
    return String(Date.now());
  }
};

// ===== Resize Image =====
export const resizeImage = (file, maxWidth = 1024) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (!file.type.match(/image.*/)) {
        reject(new Error("ไฟล์ที่เลือกไม่ใช่รูปภาพ"));
        return;
      }

      if (typeof window !== 'undefined' && window.createImageBitmap) {
        createImageBitmap(file)
          .then(imgBitmap => {
            let width = imgBitmap.width;
            let height = imgBitmap.height;

            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(imgBitmap, 0, 0, width, height);
            imgBitmap.close();

            canvas.toBlob((blob) => {
              canvas.width = 0;
              canvas.height = 0;
              resolve(blob);
            }, 'image/jpeg', 0.85);
          })
          .catch(() => fallbackResize(file, maxWidth, resolve));
      } else {
        fallbackResize(file, maxWidth, resolve);
      }
    }, 50);
  });
};

const fallbackResize = (file, maxWidth, resolve) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = (event) => {
    const img = new Image();
    img.src = event.target.result;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height *= maxWidth / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        canvas.width = 0;
        canvas.height = 0;
        resolve(blob);
      }, 'image/jpeg', 0.85);
    };
  };
};

// ===== Detect QR / Hash =====
export const detectQRCode = async (imageFile) => {
  try {
    const resizedBlob = await resizeImage(imageFile, 800);
    const qrHash = await hashImageBlob(resizedBlob);
    const isUsed = await isQRCodeUsed(qrHash);
    return {
      found: true,
      hash: qrHash,
      isUsed: isUsed
    };
  } catch (err) {
    console.error('QR Detect error:', err);
    return { found: false, hash: null, isUsed: false };
  }
};

// ===== Thai Month Mapping & OCR Resolution =====
const THAI_MONTH_SHORT = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

const THAI_MONTH_NAMES = {
  1: ['มกราคม', 'ม.ค.', 'มค', 'jan', 'january'],
  2: ['กุมภาพันธ์', 'ก.พ.', 'กพ', 'feb', 'february'],
  3: ['มีนาคม', 'มี.ค.', 'มีค', 'mar', 'march'],
  4: ['เมษายน', 'เม.ย.', 'เมย', 'apr', 'april'],
  5: ['พฤษภาคม', 'พ.ค.', 'พค', 'may'],
  6: ['มิถุนายน', 'มิ.ย.', 'มิย', 'jun', 'june'],
  7: ['กรกฎาคม', 'ก.ค.', 'กค', 'jul', 'july'],
  8: ['สิงหาคม', 'ส.ค.', 'สค', 'aug', 'august'],
  9: ['กันยายน', 'ก.ย.', 'กย', 'sep', 'september'],
  10: ['ตุลาคม', 'ต.ค.', 'ตค', 'oct', 'october'],
  11: ['พฤศจิกายน', 'พ.ย.', 'พย', 'nov', 'november'],
  12: ['ธันวาคม', 'ธ.ค.', 'ธค', 'dec', 'december'],
};

// Common Thai OCR character misrecognitions for months
const OCR_MONTH_CONFUSIONS = {
  7: 10, // Jul (ก.ค.) often misread from Oct (ต.ค.)
  10: 7,
  5: 11, // May (พ.ค.) <-> Nov (พ.ย.)
  11: 5,
  3: 6,  // Mar (มี.ค.) <-> Jun (มิ.ย.)
  6: 3,
  1: 8,  // Jan (ม.ค.) <-> Aug (ส.ค.)
  8: 1
};

/**
 * Validate slip date with support for:
 * - Both A.D. (ค.ศ.) and B.E. (พ.ศ.)
 * - Flexible window: Today or Yesterday (not older than 24-48 hours)
 * - OCR blurred / ambiguous month resolution
 */
export const validateSlipDate = (extractedDate, rawDateText, refDate = new Date()) => {
  let year = null, month = null, day = null, hour = 12, minute = 0;

  if (extractedDate && typeof extractedDate === 'string') {
    const parts = extractedDate.match(/(\d{2,4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (parts) {
      if (parts[1].length === 4 || parseInt(parts[1], 10) > 31) {
        year = parseInt(parts[1], 10);
        month = parseInt(parts[2], 10);
        day = parseInt(parts[3], 10);
      } else {
        day = parseInt(parts[1], 10);
        month = parseInt(parts[2], 10);
        year = parseInt(parts[3], 10);
      }
    }
  }

  const raw = String(rawDateText || '');
  const timeMatch = raw.match(/(\d{1,2})[:.](\d{2})/);
  if (timeMatch) {
    hour = parseInt(timeMatch[1], 10);
    minute = parseInt(timeMatch[2], 10);
  }

  // Detect day from raw text if missing
  if (!day && raw) {
    const dMatch = raw.match(/(?:วันที่\s*|โอน\s*|^|\s)(\d{1,2})\s*(?:ม\.?ค|ก\.?พ|มี\.?ค|เม\.?ย|พ\.?ค|มิ\.?ย|ก\.?ค|ส\.?ค|ก\.?ย|ต\.?ค|พ\.?ย|ธ\.?ค)/i);
    if (dMatch) day = parseInt(dMatch[1], 10);
  }

  // Raw text month detection if month not extracted or needs verification
  let detectedRawMonth = null;
  if (raw) {
    for (let m = 1; m <= 12; m++) {
      for (const alias of THAI_MONTH_NAMES[m]) {
        if (raw.toLowerCase().includes(alias)) {
          detectedRawMonth = m;
          break;
        }
      }
      if (detectedRawMonth) break;
    }
  }
  if (detectedRawMonth) {
    month = detectedRawMonth;
  }

  // Convert Buddhist Era (พ.ศ.) to Christian Era (ค.ศ.)
  if (year && year > 2400) {
    year -= 543;
  } else if (year && year >= 50 && year < 100) {
    year = 2500 + year - 543; // e.g. '69 -> 2569 -> 2026
  } else if (year && year >= 0 && year < 50) {
    year = 2000 + year;       // e.g. '26 -> 2026
  }

  // If year is missing from extracted, try raw text
  if (!year && raw) {
    const yMatch = raw.match(/(?:25\d{2}|20\d{2})/);
    if (yMatch) {
      let yVal = parseInt(yMatch[0], 10);
      year = yVal > 2400 ? yVal - 543 : yVal;
    }
  }

  // Handle OCR month confusion if day & year match today or yesterday
  const refYear = refDate.getFullYear();
  const refMonth = refDate.getMonth() + 1;
  const refDay = refDate.getDate();

  const isDayMatch = (day === refDay || day === refDay - 1);
  const isYearMatch = (year === refYear);
  if (isDayMatch && isYearMatch && month && month !== refMonth) {
    if (OCR_MONTH_CONFUSIONS[month] === refMonth) {
      month = refMonth;
    }
  }

  if (!year || !month || !day) {
    return {
      isValid: false,
      reason: 'AI ไม่สามารถระบุวันที่โอนในสลิปได้ชัดเจน',
      formattedDate: rawDateText || extractedDate || 'ไม่พบวันที่ในสลิป'
    };
  }

  const slipDate = new Date(year, month - 1, day, hour, minute);
  const diffMs = refDate.getTime() - slipDate.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  const startOfToday = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
  const startOfSlipDay = new Date(year, month - 1, day);

  const isToday = startOfSlipDay.getTime() === startOfToday.getTime();
  const isYesterday = startOfSlipDay.getTime() === startOfYesterday.getTime();

  // Flexible window: today, yesterday, or within 48 hours (allow small -4h clock skew for timezone)
  const isWithinWindow = (isToday || isYesterday || (diffHours >= -4 && diffHours <= 48));

  const formattedThai = `${day} ${THAI_MONTH_SHORT[month] || month} ${year + 543}${timeMatch ? ' ' + timeMatch[0] + ' น.' : ''}`;

  if (!isWithinWindow) {
    if (diffHours < -4) {
      return {
        isValid: false,
        isToday: false,
        isYesterday: false,
        hoursDiff: Math.round(diffHours),
        reason: `วันที่ในสลิปเป็นวันที่ในอนาคต (${formattedThai})`,
        formattedDate: formattedThai,
        slipDate
      };
    }
    return {
      isValid: false,
      isToday: false,
      isYesterday: false,
      hoursDiff: Math.round(diffHours),
      reason: `สลิปโอนเกินกว่า 48 ชั่วโมง (${formattedThai}) - ระบบรับเฉพาะสลิปวันนี้หรือเมื่อวาน`,
      formattedDate: formattedThai,
      slipDate
    };
  }

  return {
    isValid: true,
    isToday,
    isYesterday,
    hoursDiff: Math.round(diffHours),
    reason: isToday ? 'โอนวันนี้' : isYesterday ? 'โอนเมื่อวานนี้' : 'โอนภายใน 48 ชั่วโมง',
    formattedDate: formattedThai + (isToday ? ' (วันนี้)' : isYesterday ? ' (เมื่อวาน)' : ''),
    slipDate
  };
};

// ===== Gemini Verification =====
export const verifySlipWithGemini = async (imageFile, expectedAmount, onProgress = null) => {
  let lastError = null;
  const today = new Date();
  const todayThai = today.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
  const todayYearCE = today.getFullYear();
  const todayYearBE = todayYearCE + 543;
  const todayISO = today.toISOString().split('T')[0];

  for (let attempt = 0; attempt < GEMINI_API_KEYS.length; attempt++) {
    try {
      const apiKey = apiKeyManager.getCurrentKey();
      if (onProgress) onProgress(20);

      const qrResult = await detectQRCode(imageFile);
      if (qrResult.isUsed) {
        return {
          isValid: false,
          confidence: 0,
          error: 'สลิปนี้ถูกใช้ไปแล้ว ไม่สามารถส่งซ้ำได้',
          qrCodeInfo: qrResult
        };
      }

      if (onProgress) onProgress(40);

      const resizedBlob = await resizeImage(imageFile, 1024);
      const base64Image = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(resizedBlob);
      });

      if (onProgress) onProgress(60);

      const textPrompt = `วิเคราะห์สลิปการโอนเงินจากธนาคารไทย และตอบกลับในรูปแบบ JSON เท่านั้น
บริบทวันที่ปัจจุบัน: วันนี้คือ "${todayThai}" (ค.ศ. ${todayISO} / พ.ศ. ${todayYearBE})
หมายเหตุสำคัญ: สลิปโอนเงินที่ถูกต้องจะต้องเป็นสลิปที่โอนวันนี้หรือเมื่อวานนี้ (ไม่เกิน 24-48 ชั่วโมง)

ข้อมูลที่ต้องการ:
{
  "recipient_name": "ชื่อผู้รับเงิน (ภาษาไทย)",
  "account_number": "เลขบัญชีผู้รับ (ตัวเลขอย่างเดียว)",
  "amount": "จำนวนเงิน (ตัวเลขอย่างเดียว)",
  "transfer_date": "วันที่โอน (รูปแบบ YYYY-MM-DD แปลงเป็น ค.ศ. เสมอ)",
  "raw_date_text": "ข้อความวันที่และเวลาเดิมที่ปรากฏบนสลิป (เช่น '12 ต.ค. 2569 14:35 น.' หรือ '12 Oct 2026')",
  "bank_name": "ชื่อธนาคาร"
}

กฎการอ่านวันที่และปี:
- สลิปไทยมักแสดงปีเป็น พ.ศ. (เช่น 2569, 2568, '69) หรือ ค.ศ. (เช่น 2026, '26) ให้แปลง transfer_date เป็น ค.ศ. (YYYY-MM-DD) เสมอ (เช่น พ.ศ. 2569 -> ค.ศ. 2026)
- ข้อควรระวังเรื่องเดือน: ตัวอักษรภาษาไทยในสลิปอาจเลือนราง ระวังความสับสน เช่น 'ต.ค.' (ตุลาคม) กับ 'ก.ค.' (กรกฎาคม), 'พ.ย.' (พฤศจิกายน) กับ 'พ.ค.' (พฤษภาคม) ให้วิเคราะห์เทียบกับบริบทวันที่ปัจจุบัน
- ตอบเฉพาะ JSON object เท่านั้น ห้ามมีข้อความอื่นหรือ markdown`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey.trim()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: textPrompt },
                  { inline_data: { mime_type: "image/jpeg", data: base64Image } }
                ]
              }
            ],
            generationConfig: { response_mime_type: "application/json", temperature: 0.1 }
          })
        }
      );

      if (onProgress) onProgress(80);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API Error (${response.status}): ${errText}`);
      }

      const resData = await response.json();
      const rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      let extractedData = {};
      try {
        extractedData = JSON.parse(rawText.replace(/```json|```/g, '').trim());
      } catch (e) {
        console.warn('JSON Parse Error, fallback raw:', rawText);
      }

      // 1. Check amount
      const extractedAmount = parseFloat(extractedData.amount || 0);
      const isAmountValid = !isNaN(extractedAmount) && extractedAmount > 0 && Math.abs(extractedAmount - expectedAmount) < 1.0;

      // 2. Check recipient name match
      const recName = (extractedData.recipient_name || '').toLowerCase();
      const isNameValid = COMPANY_BANK_INFO.accountNameVariations.some(v => recName.includes(v.toLowerCase()));

      // 3. Check recipient account number (handle full or masked numbers)
      const cleanAcc = String(extractedData.account_number || '').replace(/[^0-9]/g, '');
      const targetAccClean = COMPANY_BANK_INFO.accountNumber.replace(/[^0-9]/g, '');
      const isAccountValid = Boolean(
        cleanAcc.includes(targetAccClean) ||
        (extractedData.account_number && (
          extractedData.account_number.includes('4260471809') ||
          extractedData.account_number.includes('426-047180-9')
        )) ||
        (cleanAcc.length >= 4 && targetAccClean.endsWith(cleanAcc)) ||
        (cleanAcc.endsWith('1809') && cleanAcc.startsWith('426'))
      );

      // 4. Check transfer date (Today or Yesterday / within 48h with BE/CE and OCR month handling)
      const dateValidation = validateSlipDate(extractedData.transfer_date, extractedData.raw_date_text, today);
      const isDateValid = dateValidation.isValid;

      // Overall validity: Amount match + Recipient match + Date match (within 48h)
      const isValid = isAmountValid && (isNameValid || isAccountValid) && isDateValid;
      const confidence = isValid ? 0.95 : (isAmountValid && (isNameValid || isAccountValid) ? 0.65 : 0.40);

      let validationError = null;
      if (!isValid) {
        if (!isAmountValid) {
          validationError = `ยอดเงินในสลิป (${extractedAmount.toLocaleString()} บาท) ไม่ตรงกับยอดที่ระบบต้องการ (${Number(expectedAmount).toLocaleString()} บาท)`;
        } else if (!isNameValid && !isAccountValid) {
          validationError = 'บัญชีปลายทางไม่ตรงกับ บริษัท ทรัพย์สำราญ พิโก จำกัด (SCB 426-047180-9)';
        } else if (!isDateValid) {
          validationError = dateValidation.reason || 'วันที่ในสลิปไม่อยู่ในช่วงเวลาที่กำหนด (รับเฉพาะสลิปวันนี้หรือเมื่อวาน)';
        } else {
          validationError = 'ข้อมูลในสลิปไม่ตรงกับเงื่อนไขที่กำหนด';
        }
      }

      apiKeyManager.reportSuccess(apiKey);
      if (onProgress) onProgress(100);

      return {
        isValid,
        confidence,
        extractedData: {
          ...extractedData,
          amount: extractedAmount,
          transfer_date: dateValidation.formattedDate || extractedData.transfer_date || ''
        },
        comparison: {
          amount: {
            expected: expectedAmount,
            actual: extractedAmount,
            isValid: isAmountValid
          },
          account: {
            expected: `${COMPANY_BANK_INFO.bankName} ${COMPANY_BANK_INFO.accountNumber}`,
            expectedNumber: COMPANY_BANK_INFO.accountNumber,
            actual: extractedData.account_number || (extractedData.bank_name ? `${extractedData.bank_name}` : 'ไม่พบเลขบัญชีในสลิป'),
            isValid: isAccountValid
          },
          name: {
            expected: COMPANY_BANK_INFO.accountName,
            actual: extractedData.recipient_name || 'ไม่พบชื่อบัญชีในสลิป',
            isValid: isNameValid
          },
          date: {
            expected: 'โอนวันนี้ หรือเมื่อวาน (ไม่เกิน 48 ชม.)',
            actual: dateValidation.formattedDate || extractedData.transfer_date || 'ไม่พบวันที่',
            isValid: isDateValid,
            isToday: dateValidation.isToday,
            isYesterday: dateValidation.isYesterday,
            reason: dateValidation.reason,
            rawText: extractedData.raw_date_text || ''
          },
          transferDate: {
            actual: dateValidation.formattedDate || extractedData.transfer_date || 'ไม่ระบุ'
          }
        },
        qrCodeInfo: qrResult,
        error: validationError,
        message: isValid ? 'ตรวจสอบสลิปถูกต้อง' : validationError
      };

    } catch (err) {
      console.warn(`Gemini verification attempt ${attempt + 1} failed:`, err);
      lastError = err;
    }
  }

  if (onProgress) onProgress(100);
  return {
    isValid: false,
    confidence: 0,
    error: lastError?.message || 'ไม่สามารถตรวจสอบสลิปด้วย AI ได้',
    needsManualReview: true
  };
};
