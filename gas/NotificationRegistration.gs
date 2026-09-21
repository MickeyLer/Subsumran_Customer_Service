/**
 * ==============================================================================
 * Google Apps Script (GAS) - ระบบสมัครและอนุมัติรับแจ้งเตือนทางไลน์ (เวอร์ชันตรวจเช็คชื่อและสัญญา)
 * Company: บริษัท ทรัพย์สำราญ พีโก จำกัด
 * ==============================================================================
 * 
 * คุณสมบัติใหม่:
 * 1. ตรวจสอบเลขที่สัญญาใน Supabase อัตโนมัติ (หากไม่มีเลขสัญญานี้จะขึ้นแจ้งเตือน)
 * 2. ตรวจสอบชื่อผู้กู้ที่พิมพ์เข้ามา เปรียบเทียบกับชื่อในสัญญาใน Supabase (ยืดหยุ่นเช็คเฉพาะชื่อ)
 * 3. แสดงหน้าจอทบทวนข้อมูล (Preview Page) ให้เจ้าหน้าที่ยืนยัน/ปฏิเสธก่อนผูกบัญชีจริง
 * 4. SAFETY SWITCH: TEST_MODE = true ป้องกันการอัปเดตข้อมูล Supabase ในระหว่างทดสอบ
 */

// --- CONFIGURATION ---
const TEST_MODE = true; // ⚠️ ตั้งค่าเป็น true เพื่อทดสอบ (ไม่แก้ไข Supabase จริง)

const SUPABASE_URL = 'https://armxdoywlbofufiqjibx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFybXhkb3l3bGJvZnVmaXFqaWJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MjkwMjEsImV4cCI6MjA5MTQwNTAyMX0.B3_pE67EX17Wf1LNxW9kT6XGeacZQpz3oRDOd7DHwN8';

// LINE Messaging API Credentials
const CHANNEL_ACCESS_TOKEN = 'mRsrBA3T/9E+Hd94RSrgTJxLKG5/VGjztcTh8fVdgVpOl/4qLm1RD1tSGTPiRZAOcqQuNWcBtiPIO1V1Cv5BH3ryLcqVDDsVjuXJeLpMnVXQptwYhBjYZhEbZh6TYtoryG5RlYyttN4X6lSPXewnbQdB04t89/1O/w1cDnyilFU=';
const STAFF_GROUP_ID = 'C51acfdf712c41e846ac368c1838c4a9d'; // LINE Group ID สำหรับเจ้าหน้าที่

/**
 * HTTP POST Handler - รับข้อมูลการสมัครจาก React LIFF App
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const borrowerName = (data.borrowerName || '').trim();
    const contractNo = (data.contractNo || '').trim();
    const userId = (data.userId || '').trim();

    // ดึง URL ของ Web App สำหรับทำลิงก์ตรวจสอบและอนุมัติ
    const scriptUrl = ScriptApp.getService().getUrl();
    const reviewUrl = scriptUrl + '?action=preview&contractNo=' + encodeURIComponent(contractNo) + '&userId=' + encodeURIComponent(userId) + '&borrowerName=' + encodeURIComponent(borrowerName);

    // ข้อความส่งเข้า LINE Group เจ้าหน้าที่
    const messageText = 
      '📌 [คำขอสมัครรับแจ้งเตือนทางไลน์]\n' +
      '----------------------------------\n' +
      '👤 ชื่อผู้กู้: ' + borrowerName + '\n' +
      '📄 เลขที่สัญญา: ' + contractNo + '\n' +
      '🆔 LINE User ID: ' + userId + '\n' +
      (TEST_MODE ? '⚠️ (โหมดทดสอบ - ไม่แก้ไข DB จริง)\n' : '') +
      '----------------------------------\n' +
      '👉 กดลิงก์ด้านล่างเพื่อตรวจสอบข้อมูลและกดอนุมัติ:\n' + reviewUrl;

    // ส่งข้อความเข้ากลุ่มเจ้าหน้าที่
    sendLineMessageToGroup(STAFF_GROUP_ID, messageText);

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'ส่งข้อมูลสมัครแจ้งเตือนสำเร็จ'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log('Error in doPost: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * HTTP GET Handler - แสดงหน้าจอทบทวนข้อมูลสำหรับเจ้าหน้าที่ และประมวลผลการอนุมัติ/ปฏิเสธ
 */
function doGet(e) {
  const action = e.parameter.action;
  const contractNo = e.parameter.contractNo;
  const userId = e.parameter.userId;
  const borrowerName = e.parameter.borrowerName || '';
  const scriptUrl = ScriptApp.getService().getUrl();

  // ----------------------------------------------------
  // ACTION: CONFIRM APPROVE (เจ้าหน้าที่กดปุ่ม "ยืนยันผูกบัญชี")
  // ----------------------------------------------------
  if (action === 'confirm_approve' && contractNo && userId) {
    if (TEST_MODE) {
      Logger.log('[TEST MODE] Confirmed linking contract ' + contractNo + ' with LINE User ID ' + userId);
      return renderResultHtml(
        '🧪 [โหมดทดสอบ] ยืนยันข้อมูลสำเร็จ',
        `ระบบได้จำลองการผูกสัญญาเลขที่ <b>${contractNo}</b> กับ LINE User ID <b>${userId}</b> เรียบร้อยแล้ว`,
        '#eab308',
        '⚠️ ในโหมดทดสอบนี้ จะไม่มีการแก้ไขข้อมูลใน Supabase จริง สามารถปิดหน้านี้ได้ทันที'
      );
    } else {
      const updateResult = updateSupabaseUserID(contractNo, userId);
      if (updateResult.success) {
        sendLineMessageToGroup(STAFF_GROUP_ID, '✅ เจ้าหน้าที่อนุมัติผูกสัญญาเลขที่ ' + contractNo + ' (ชื่อ: ' + borrowerName + ') เข้ากับ LINE User ID เรียบร้อยแล้ว');
        return renderResultHtml(
          '✅ ยืนยันผูกสัญญาสำเร็จ!',
          `ระบบได้ทำการบันทึก LINE User ID <b>${userId}</b> เข้าสู่สัญญาเลขที่ <b>${contractNo}</b> ใน Supabase เรียบร้อยแล้ว`,
          '#06C755',
          ''
        );
      } else {
        return renderResultHtml('❌ เกิดข้อผิดพลาดในการอัปเดต', updateResult.error, '#ef4444', '');
      }
    }
  }

  // ----------------------------------------------------
  // ACTION: REJECT (เจ้าหน้าที่กดปุ่ม "ปฏิเสธคำขอ")
  // ----------------------------------------------------
  if (action === 'reject' && contractNo) {
    sendLineMessageToGroup(STAFF_GROUP_ID, '❌ เจ้าหน้าที่ปฏิเสธคำขอสมัครแจ้งเตือนของสัญญาเลขที่ ' + contractNo + ' (' + borrowerName + ')');
    return renderResultHtml(
      '🚫 ปฏิเสธคำขอเรียบร้อยแล้ว',
      `คำขอผูกสัญญาเลขที่ <b>${contractNo}</b> ถูกปฏิเสธแล้ว ระบบไม่ได้ทำการแก้ไขข้อมูลใดๆ`,
      '#64748b',
      ''
    );
  }

  // ----------------------------------------------------
  // ACTION: PREVIEW (หน้าจอทบทวนและตรวจสอบข้อมูลสำหรับเจ้าหน้าที่)
  // ----------------------------------------------------
  if ((action === 'preview' || action === 'approve') && contractNo && userId) {
    // 1. ดึงข้อมูลสัญญาจาก Supabase
    const dbContract = getSupabaseContract(contractNo);

    if (!dbContract) {
      // ไม่พบเลขสัญญาในระบบ
      return renderResultHtml(
        '⚠️ ไม่พบเลขที่สัญญานี้ในระบบ',
        `ไม่พบสัญญาเลขที่ <b>${contractNo}</b> ในฐานข้อมูล Supabase กรุณาตรวจสอบเลขที่สัญญากับผู้กู้ใหม่อีกครั้ง`,
        '#ef4444',
        'คำขอสมัครนี้อาจระบุเลขที่สัญญาผิด'
      );
    }

    // 2. ดึงชื่อผู้กู้ในฐานข้อมูล (รองรับชื่อคอลัมน์ชื่อผู้กู้)
    const dbName = dbContract.name || dbContract.customer_name || dbContract.borrower_name || dbContract.Name || 'ไม่ระบุชื่อในระบบ';

    // 3. ตรวจสอบเปรียบเทียบชื่อ (ยืดหยุ่นเช็คเฉพาะชื่อ)
    const nameMatch = compareNames(borrowerName, dbName);

    // ลิงก์สำหรับการอนุมัติและปฏิเสธ
    const confirmUrl = scriptUrl + '?action=confirm_approve&contractNo=' + encodeURIComponent(contractNo) + '&userId=' + encodeURIComponent(userId) + '&borrowerName=' + encodeURIComponent(borrowerName);
    const rejectUrl = scriptUrl + '?action=reject&contractNo=' + encodeURIComponent(contractNo) + '&userId=' + encodeURIComponent(userId) + '&borrowerName=' + encodeURIComponent(borrowerName);

    const htmlOutput = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>ตรวจสอบข้อมูลการสมัครแจ้งเตือน</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: 'Sukhumvit Set', -apple-system, sans-serif; background: #f1f5f9; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; padding: 15px; }
            .card { background: white; border-radius: 18px; padding: 25px; max-width: 480px; width: 100%; box-shadow: 0 10px 30px rgba(0,0,0,0.08); }
            .header { text-align: center; border-b: 1px solid #e2e8f0; pb-15px; margin-bottom: 20px; }
            .header h3 { margin: 0; color: #1e293b; font-size: 19px; }
            .header p { color: #64748b; font-size: 13px; margin-top: 5px; }
            
            .section-title { font-size: 12px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 8px; }
            
            .box { border-radius: 12px; padding: 14px; margin-bottom: 15px; font-size: 13px; line-height: 1.6; }
            .box-client { background: #f8fafc; border: 1px solid #cbd5e1; }
            .box-db { background: #f0fdf4; border: 1px solid #bbf7d0; }
            
            .match-badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 12px; margin-bottom: 12px; }
            .match-success { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
            .match-warning { background: #fef9c3; color: #a16207; border: 1px solid #fde047; }
            
            .row { display: flex; justify-content: space-between; margin-bottom: 6px; }
            .label { color: #64748b; }
            .val { font-weight: bold; color: #0f172a; }
            
            .btn-group { display: flex; gap: 10px; margin-top: 25px; }
            .btn { flex: 1; padding: 13px; border-radius: 10px; font-weight: bold; font-size: 14px; border: none; cursor: pointer; text-decoration: none; text-align: center; }
            .btn-confirm { background: #06C755; color: white; }
            .btn-confirm:hover { background: #05b34c; }
            .btn-reject { background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; }
            .btn-reject:hover { background: #e2e8f0; color: #334155; }
            
            .test-note { background: #fefce8; border: 1px solid #fef08a; color: #854d0e; padding: 10px; border-radius: 8px; font-size: 12px; text-align: center; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <h3>🔍 ตรวจสอบข้อมูลก่อนอนุมัติ</h3>
              <p>เปรียบเทียบข้อมูลที่ผู้กู้ระบุ กับฐานข้อมูล Supabase</p>
            </div>

            <!-- สถานะการตรวจสอบชื่อ -->
            <div style="text-align: center;">
              ${nameMatch.isMatch 
                ? '<span class="match-badge match-success">✅ ตรวจสอบแล้ว: ชื่อตรงกับในระบบ</span>' 
                : '<span class="match-badge match-warning">⚠️ คำเตือน: ชื่อที่พิมพ์ไม่ตรงกับในระบบ</span>'}
            </div>

            <!-- ข้อมูลจากลูกค้า -->
            <div class="section-title">📥 ข้อมูลที่ระบุมาจาก LINE:</div>
            <div class="box box-client">
              <div class="row"><span class="label">ชื่อผู้กู้ที่พิมพ์:</span> <span class="val">${borrowerName}</span></div>
              <div class="row"><span class="label">เลขที่สัญญา:</span> <span class="val">${contractNo}</span></div>
              <div class="row"><span class="label">LINE User ID:</span> <span class="val" style="font-family: monospace; font-size: 11px;">${userId}</span></div>
            </div>

            <!-- ข้อมูลใน Supabase -->
            <div class="section-title">🏛️ ข้อมูลจริงในตารางสัญญา (Supabase):</div>
            <div class="box box-db">
              <div class="row"><span class="label">เลขที่สัญญาในระบบ:</span> <span class="val">${dbContract.ID_contact || contractNo}</span></div>
              <div class="row"><span class="label">ชื่อผู้กู้ในระบบ:</span> <span class="val" style="color: ${nameMatch.isMatch ? '#15803d' : '#b91c1c'};">${dbName}</span></div>
              <div class="row"><span class="label">ยอดค่างวดผ่อน:</span> <span class="val">${dbContract.paypermonth ? Number(dbContract.paypermonth).toLocaleString() + ' บาท' : 'ไม่มีข้อมูล'}</span></div>
            </div>

            ${TEST_MODE ? '<div class="test-note">🧪 <b>โหมดทดสอบ (TEST_MODE)</b>: เมื่อกดอนุมัติ ระบบจะจำลองผลการอนุมัติโดยไม่แก้ไข Supabase จริง</div>' : ''}

            <!-- ปุ่มดำเนินการ -->
            <div class="btn-group">
              <a href="${rejectUrl}" class="btn btn-reject">❌ ปฏิเสธคำขอ</a>
              <a href="${confirmUrl}" class="btn btn-confirm">✅ ยืนยันผูกสัญญา</a>
            </div>
          </div>
        </body>
      </html>
    `;
    return HtmlService.createHtmlOutput(htmlOutput);
  }

  return HtmlService.createHtmlOutput('<h3>LINE Notification Registration Endpoint Active</h3>');
}

/**
 * ดึงข้อมูลสัญญาจาก Supabase ตามเลขที่สัญญา
 */
function getSupabaseContract(contractNo) {
  const url = SUPABASE_URL + '/rest/v1/contact?ID_contact=eq.' + encodeURIComponent(contractNo) + '&select=*';
  const options = {
    method: 'get',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY
    },
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());
    if (Array.isArray(data) && data.length > 0) {
      return data[0];
    }
    return null;
  } catch (e) {
    Logger.log("Error fetching contract from Supabase: " + e.toString());
    return null;
  }
}

/**
 * ฟังก์ชันเปรียบเทียบชื่อ (ยืดหยุ่นเช็คเฉพาะชื่อแรก)
 */
function compareNames(inputName, dbName) {
  if (!inputName || !dbName) return { isMatch: false };

  // ตัดคำนำหน้าชื่อออก เช่น นาย, นาง, นางสาว, คุณ
  const cleanStr = (str) => {
    return str
      .replace(/^(นาย|นางสาว|นาง|คุณ|ด\.ช\.|ด\.ญ\.)/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  };

  const cleanInput = cleanStr(inputName);
  const cleanDb = cleanStr(dbName);

  // ดึงเฉพาะคำแรก (ชื่อแรก) มาเปรียบเทียบ
  const firstWordInput = cleanInput.split(' ')[0];

  // ถ้าชื่อแรกที่ลูกค้าพิมพ์มา มีอยู่ในชื่อใน DB ให้ถือว่าตรงกัน
  const isMatch = cleanDb.includes(firstWordInput) || cleanInput.includes(cleanDb.split(' ')[0]);

  return {
    isMatch: isMatch
  };
}

/**
 * ฟังก์ชันสร้างหน้าตอบกลับ HTML
 */
function renderResultHtml(title, message, themeColor, note) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${title}</title>
        <style>
          body { font-family: 'Sukhumvit Set', -apple-system, sans-serif; background: #f8fafc; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; padding: 20px; }
          .card { background: white; border-radius: 16px; padding: 30px; max-width: 440px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.08); text-align: center; border-top: 6px solid ${themeColor}; }
          h2 { color: ${themeColor}; margin-top: 0; font-size: 20px; }
          p { color: #475569; font-size: 14px; line-height: 1.6; }
          .note { font-size: 12px; color: #94a3b8; margin-top: 20px; border-t: 1px solid #f1f5f9; pt-10px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>${title}</h2>
          <p>${message}</p>
          ${note ? `<div class="note">${note}</div>` : ''}
        </div>
      </body>
    </html>
  `;
  return HtmlService.createHtmlOutput(html);
}

/**
 * ฟังก์ชันส่งข้อความผ่าน LINE Push Message API
 */
function sendLineMessageToGroup(targetId, messageText) {
  const url = "https://api.line.me/v2/bot/message/push";
  const payload = {
    to: targetId,
    messages: [
      {
        type: "text",
        text: messageText
      }
    ]
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + CHANNEL_ACCESS_TOKEN
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    Logger.log("LINE Push Response: " + response.getContentText());
  } catch (error) {
    Logger.log("Error sending LINE Push: " + error.toString());
  }
}

/**
 * ฟังก์ชันอัปเดต userID ลงในตาราง contact ของ Supabase
 */
function updateSupabaseUserID(contractNo, userId) {
  const url = SUPABASE_URL + '/rest/v1/contact?ID_contact=eq.' + encodeURIComponent(contractNo);
  const options = {
    method: 'PATCH',
    contentType: 'application/json',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Prefer': 'return=representation'
    },
    payload: JSON.stringify({
      userID: userId
    }),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    if (code >= 200 && code < 300) {
      return { success: true, data: JSON.parse(response.getContentText()) };
    } else {
      return { success: false, error: 'HTTP Code ' + code + ': ' + response.getContentText() };
    }
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}
