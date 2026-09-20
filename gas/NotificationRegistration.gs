/**
 * ==============================================================================
 * Google Apps Script (GAS) - ระบบสมัครและอนุมัติรับแจ้งเตือนทางไลน์
 * Company: บริษัท ทรัพย์สำราญ พีโก จำกัด
 * ==============================================================================
 * 
 * วิธีการนำไปใช้งาน:
 * 1. คัดลอกโค้ดนี้ทั้งหมดไปวางใน Google Apps Script Editor (https://script.google.com)
 * 2. กด "การทำให้ใช้งานได้" (Deploy) > "การทำให้ใช้งานได้รายการใหม่" (New deployment)
 * 3. เลือกประเภท: Web App (เว็บแอป)
 * 4. ตั้งค่า Execute as: Me (ฉัน)
 * 5. ตั้งค่า Who has access: Anyone (ทุกคน)
 * 6. คัดลอก URL ของ Web App ที่ได้ ไปใส่ในฝั่ง React LIFF Application
 * 
 * SAFETY SWITCH:
 * - TEST_MODE = true : สำหรับทดสอบระบบ เมื่อเจ้าหน้าที่กดลิงก์อนุมัติ จะไม่มีการแก้ไข Supabase จริง
 * - TEST_MODE = false: สำหรับใช้งานจริง ระบบจะอัปเดต userID ลง Supabase ตาราง contact ทันที
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
    const borrowerName = data.borrowerName || 'ไม่ระบุชื่อ';
    const contractNo = data.contractNo || 'ไม่ระบุเลขที่สัญญา';
    const userId = data.userId || 'ไม่พบ LINE User ID';

    // ดึง URL ของ Web App สำหรับทำลิงก์อนุมัติ
    const scriptUrl = ScriptApp.getService().getUrl();
    const approveUrl = scriptUrl + '?action=approve&contractNo=' + encodeURIComponent(contractNo) + '&userId=' + encodeURIComponent(userId) + '&borrowerName=' + encodeURIComponent(borrowerName);

    // ข้อความส่งเข้า LINE Group เจ้าหน้าที่
    const messageText = 
      '📌 [แจ้งเตือน] คำขอสมัครรับแจ้งเตือนทางไลน์\n' +
      '----------------------------------\n' +
      '👤 ชื่อผู้กู้: ' + borrowerName + '\n' +
      '📄 เลขที่สัญญา: ' + contractNo + '\n' +
      '🆔 LINE User ID: ' + userId + '\n' +
      (TEST_MODE ? '⚠️ (โหมดทดสอบ - ไม่แก้ไข DB จริง)\n' : '') +
      '----------------------------------\n' +
      '👉 กดลิงก์ด้านล่างเพื่อยืนยันอนุมัติผูกบัญชี:\n' + approveUrl;

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
 * HTTP GET Handler - รองรับการกดลิงก์อนุมัติของเจ้าหน้าที่
 */
function doGet(e) {
  const action = e.parameter.action;
  const contractNo = e.parameter.contractNo;
  const userId = e.parameter.userId;
  const borrowerName = e.parameter.borrowerName || '';

  if (action === 'approve' && contractNo && userId) {
    if (TEST_MODE) {
      // ----------------------------------------------------
      // MODE: TEST_MODE (ไม่แก้ไข Supabase จริง)
      // ----------------------------------------------------
      Logger.log('[TEST MODE] Approved linking contract ' + contractNo + ' with LINE User ID ' + userId);

      const htmlOutput = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>ยืนยันข้อมูลสำเร็จ (โหมดทดสอบ)</title>
            <style>
              body { font-family: 'Sukhumvit Set', -apple-system, sans-serif; background: #f4f6f8; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; padding: 20px; }
              .card { background: white; border-radius: 16px; padding: 30px; max-width: 450px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.08); text-align: center; border-top: 6px solid #eab308; }
              .icon { font-size: 50px; margin-bottom: 10px; }
              h2 { color: #854d0e; margin-top: 0; font-size: 20px; }
              p { color: #475569; font-size: 14px; line-height: 1.6; }
              .info-box { background: #fefce8; border: 1px solid #fef08a; padding: 15px; border-radius: 10px; margin: 20px 0; text-align: left; font-size: 13px; }
              .info-item { margin-bottom: 8px; }
              .badge { background: #eab308; color: white; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="icon">🧪</div>
              <h2>[โหมดทดสอบ] ยืนยันข้อมูลเรียบร้อย</h2>
              <p>ระบบทำการจำลองการอนุมัติผูก LINE User ID เข้ากับสัญญาสำเร็จ</p>
              <div class="info-box">
                <div class="info-item"><b>สถานะ:</b> <span class="badge">TEST_MODE (จำลองระบบ)</span></div>
                <div class="info-item"><b>ชื่อผู้กู้:</b> ${borrowerName}</div>
                <div class="info-item"><b>เลขที่สัญญา:</b> ${contractNo}</div>
                <div class="info-item"><b>LINE User ID:</b> ${userId}</div>
              </div>
              <p style="font-size: 12px; color: #94a3b8;">⚠️ ในโหมดนี้ จะไม่มีการแก้ไขข้อมูลใดๆ ใน Supabase จริง สามารถปิดหน้านี้ได้ทันที</p>
            </div>
          </body>
        </html>
      `;
      return HtmlService.createHtmlOutput(htmlOutput);

    } else {
      // ----------------------------------------------------
      // MODE: PRODUCTION MODE (อัปเดต Supabase จริง)
      // ----------------------------------------------------
      const updateResult = updateSupabaseUserID(contractNo, userId);
      
      let htmlOutput = '';
      if (updateResult.success) {
        // ส่งข้อความยืนยันเข้ากลุ่ม
        sendLineMessageToGroup(STAFF_GROUP_ID, '✅ เจ้าหน้าที่ได้ยืนยันผูกสัญญาเลขที่ ' + contractNo + ' เข้ากับ LINE User ID เรียบร้อยแล้ว');

        htmlOutput = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <title>ยืนยันข้อมูลสำเร็จ</title>
              <style>
                body { font-family: sans-serif; background: #f4f6f8; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; padding: 20px; }
                .card { background: white; border-radius: 16px; padding: 30px; max-width: 450px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.08); text-align: center; border-top: 6px solid #06C755; }
                .icon { font-size: 50px; margin-bottom: 10px; }
                h2 { color: #06C755; margin-top: 0; }
                p { color: #475569; font-size: 14px; }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="icon">✅</div>
                <h2>อนุมัติผูกบัญชีสำเร็จ!</h2>
                <p>ระบบได้ทำการบันทึก LINE User ID <b>${userId}</b> เข้าสู่สัญญาเลขที่ <b>${contractNo}</b> ในระบบ Supabase เรียบร้อยแล้ว</p>
              </div>
            </body>
          </html>
        `;
      } else {
        htmlOutput = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <title>เกิดข้อผิดพลาด</title>
            </head>
            <body>
              <h2>❌ เกิดข้อผิดพลาดในการอัปเดตข้อมูล</h2>
              <p>${updateResult.error}</p>
            </body>
          </html>
        `;
      }
      return HtmlService.createHtmlOutput(htmlOutput);
    }
  }

  return HtmlService.createHtmlOutput('<h3>LINE Notification Registration Endpoint Active</h3>');
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
