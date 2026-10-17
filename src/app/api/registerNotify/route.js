import { NextResponse } from 'next/server';
import supabase from '../../../supabaseClient';

const DEFAULT_ACCESS_TOKEN = 'mRsrBA3T/9E+Hd94RSrgTJxLKG5/VGjztcTh8fVdgVpOl/4qLm1RD1tSGTPiRZAOcqQuNWcBtiPIO1V1Cv5BH3ryLcqVDDsVjuXJeLpMnVXQptwYhBjYZhEbZh6TYtoryG5RlYyttN4X6lSPXewnbQdB04t89/1O/w1cDnyilFU=';
const DEFAULT_STAFF_GROUP_ID = 'C51acfdf712c41e846ac368c1838c4a9d';

/**
 * ฟังก์ชันเปรียบเทียบชื่อ (ตัดคำนำหน้าและตรวจเช็คคำแรก)
 */
export function compareNames(inputName, dbName) {
  if (!inputName || !dbName) return { isMatch: false };

  const cleanStr = (str) => {
    return String(str)
      .replace(/^(นาย|นางสาว|นาง|คุณ|ด\.ช\.|ด\.ญ\.)/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  };

  const cleanInput = cleanStr(inputName);
  const cleanDb = cleanStr(dbName);

  const firstWordInput = cleanInput.split(' ')[0];
  const firstWordDb = cleanDb.split(' ')[0];

  const isMatch = (firstWordInput && cleanDb.includes(firstWordInput)) ||
                  (firstWordDb && cleanInput.includes(firstWordDb));

  return { isMatch };
}

/**
 * ดึง Host / Base URL สำหรับสร้างลิงก์ให้สั้นและถูกต้อง
 */
function getBaseUrl(request) {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, '');
  }
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || (host && host.includes('localhost') ? 'http' : 'https');
  if (host) {
    return `${proto}://${host}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'https://subsumran-customer-service.vercel.app';
}

/**
 * ส่งข้อความผ่าน LINE Messaging API Push Endpoint
 */
async function sendLinePushMessage(targetId, messages, customToken) {
  const token = customToken || process.env.LINE_NOTIFY_ACCESS_TOKEN || DEFAULT_ACCESS_TOKEN;
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: targetId,
        messages: messages,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('LINE Push API error:', res.status, errText);
      return { success: false, error: errText };
    }
    return { success: true };
  } catch (error) {
    console.error('Error sending LINE push message:', error);
    return { success: false, error: error.message };
  }
}

/**
 * POST /api/registerNotify
 * รับคำขอสมัครแจ้งเตือนจาก React LIFF App, บันทึกฐานข้อมูล และส่งลิงก์สั้นเข้ากลุ่ม LINE เจ้าหน้าที่
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const borrowerName = (body.borrowerName || '').trim();
    const contractNo = (body.contractNo || '').trim();
    const userId = (body.userId || 'N/A').trim();

    if (!borrowerName || !contractNo) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุชื่อผู้กู้และเลขที่สัญญา' },
        { status: 400 }
      );
    }

    // 1. ดึงข้อมูลสัญญาจริงจาก Supabase
    const { data: contract, error: contractErr } = await supabase
      .from('contact')
      .select('*')
      .eq('ID_contact', contractNo)
      .maybeSingle();

    if (contractErr) {
      console.warn('Error querying contact from Supabase:', contractErr);
    }

    const dbName = contract?.Name_loan || contract?.name || contract?.customer_name || null;
    const nameMatch = compareNames(borrowerName, dbName);

    // 2. สร้าง Short ID ที่กระชับ ไม่ต้องใส่ query params ยาวๆ
    // ตัวอย่าง: rg_7x9k2m14
    const shortId = 'rg_' + Math.random().toString(36).substring(2, 10);

    // 3. บันทึกคำขอลงตาราง notification_registrations ใน Supabase
    const { error: insertErr } = await supabase
      .from('notification_registrations')
      .insert([{
        id: shortId,
        contract_no: contractNo,
        borrower_name: borrowerName,
        line_user_id: userId,
        db_borrower_name: dbName,
        db_contract_found: !!contract,
        status: 'pending',
      }]);

    if (insertErr) {
      console.error('Error inserting notification registration:', insertErr);
      return NextResponse.json(
        { success: false, error: 'เกิดข้อผิดพลาดในการบันทึกคำขอ: ' + insertErr.message },
        { status: 500 }
      );
    }

    // 4. สร้างลิงก์ย่อสั้นและกระชับ (Short Link)
    const baseUrl = getBaseUrl(request);
    const reviewUrl = `${baseUrl}/r/${shortId}`;
    const directReviewUrl = `${baseUrl}/ReviewRegister?id=${shortId}`;

    const staffGroupId = process.env.LINE_NOTIFY_GROUP_ID || DEFAULT_STAFF_GROUP_ID;
    const lineAccessToken = process.env.LINE_NOTIFY_ACCESS_TOKEN || DEFAULT_ACCESS_TOKEN;

    // 5. สร้าง Flex Message ที่สวยงามและอ่านง่าย
    const isContractFound = !!contract;
    const isMatch = nameMatch.isMatch;

    let badgeText = '✅ ชื่อตรงกับในสัญญา';
    let badgeBg = '#dcfce7';
    let badgeColor = '#15803d';

    if (!isContractFound) {
      badgeText = '⚠️ ไม่พบเลขสัญญาในระบบ';
      badgeBg = '#fee2e2';
      badgeColor = '#b91c1c';
    } else if (!isMatch) {
      badgeText = '⚠️ ชื่อที่พิมพ์ไม่ตรงกับในระบบ';
      badgeBg = '#fef9c3';
      badgeColor = '#a16207';
    }

    const bubble = {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#1e293b',
        paddingAll: '16px',
        contents: [
          {
            type: 'text',
            text: '📌 คำขอสมัครรับแจ้งเตือนทางไลน์',
            weight: 'bold',
            color: '#ffffff',
            size: 'md',
          },
          {
            type: 'text',
            text: 'บริษัท ทรัพย์สำราญ พิโก จำกัด',
            color: '#94a3b8',
            size: 'xs',
            margin: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          // Match Badge
          {
            type: 'box',
            layout: 'horizontal',
            backgroundColor: badgeBg,
            cornerRadius: '6px',
            paddingAll: '8px',
            contents: [
              {
                type: 'text',
                text: badgeText,
                size: 'xs',
                weight: 'bold',
                color: badgeColor,
                align: 'center',
              },
            ],
          },
          {
            type: 'separator',
          },
          // ข้อมูลจากลูกค้า
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'xs',
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: 'ชื่อที่พิมพ์:', size: 'xs', color: '#64748b', flex: 3 },
                  { type: 'text', text: borrowerName, size: 'xs', weight: 'bold', color: '#0f172a', flex: 5 },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: 'เลขที่สัญญา:', size: 'xs', color: '#64748b', flex: 3 },
                  { type: 'text', text: contractNo, size: 'xs', weight: 'bold', color: '#0284c7', flex: 5 },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: 'LINE User ID:', size: 'xs', color: '#64748b', flex: 3 },
                  { type: 'text', text: userId, size: 'xxs', color: '#334155', flex: 5, wrap: true },
                ],
              },
            ],
          },
          ...(isContractFound ? [
            {
              type: 'separator',
            },
            {
              type: 'box',
              layout: 'vertical',
              spacing: 'xs',
              contents: [
                {
                  type: 'box',
                  layout: 'horizontal',
                  contents: [
                    { type: 'text', text: 'ชื่อในระบบ:', size: 'xs', color: '#64748b', flex: 3 },
                    { type: 'text', text: dbName || '-', size: 'xs', weight: 'bold', color: isMatch ? '#15803d' : '#b91c1c', flex: 5 },
                  ],
                },
                {
                  type: 'box',
                  layout: 'horizontal',
                  contents: [
                    { type: 'text', text: 'ค่างวด/เดือน:', size: 'xs', color: '#64748b', flex: 3 },
                    { type: 'text', text: contract.paypermonth ? `${Number(contract.paypermonth).toLocaleString()} บาท` : '-', size: 'xs', weight: 'bold', color: '#0f172a', flex: 5 },
                  ],
                },
              ],
            },
          ] : []),
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#06C755',
            height: 'sm',
            action: {
              type: 'uri',
              label: '⚡ ตรวจสอบและอนุมัติ (1-Click)',
              uri: reviewUrl,
            },
          },
          {
            type: 'text',
            text: `🔗 ${reviewUrl}`,
            size: 'xxs',
            color: '#64748b',
            align: 'center',
            action: {
              type: 'uri',
              uri: reviewUrl,
            },
          },
        ],
      },
    };

    const altText = `📌 [คำขอสมัครรับแจ้งเตือนทางไลน์]\nผู้กู้: ${borrowerName}\nสัญญา: ${contractNo}\n👉 ตรวจสอบ: ${reviewUrl}`;

    // ส่งเข้ากลุ่ม LINE ของเจ้าหน้าที่
    await sendLinePushMessage(staffGroupId, [
      {
        type: 'flex',
        altText: altText,
        contents: bubble,
      },
    ], lineAccessToken);

    return NextResponse.json({
      success: true,
      message: 'ส่งข้อมูลสมัครแจ้งเตือนสำเร็จ',
      id: shortId,
      reviewUrl: reviewUrl,
      directUrl: directReviewUrl,
    });

  } catch (error) {
    console.error('Error in POST /api/registerNotify:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/registerNotify
 * ดึงข้อมูลคำขอสมัครแจ้งเตือนตาม id สำหรับหน้าจอตรวจสอบของเจ้าหน้าที่
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing registration ID' },
        { status: 400 }
      );
    }

    // 1. ดึงข้อมูลคำขอจาก notification_registrations
    const { data: record, error: recErr } = await supabase
      .from('notification_registrations')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (recErr || !record) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบข้อมูลคำขอนี้ในระบบ' },
        { status: 404 }
      );
    }

    // 2. ดึงข้อมูลสัญญาปัจจุบันจาก contact
    let contract = null;
    if (record.contract_no) {
      const { data: cData } = await supabase
        .from('contact')
        .select('*')
        .eq('ID_contact', record.contract_no)
        .maybeSingle();
      contract = cData;
    }

    const dbName = contract?.Name_loan || contract?.name || contract?.customer_name || null;
    const nameMatch = compareNames(record.borrower_name, dbName);

    return NextResponse.json({
      success: true,
      registration: record,
      contract: contract,
      nameMatch: nameMatch,
    });

  } catch (error) {
    console.error('Error in GET /api/registerNotify:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/registerNotify
 * สำหรับการอนุมัติ (approve) หรือปฏิเสธ (reject) คำขอ
 */
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { id, action, rejectReason } = body;

    if (!id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid parameters' },
        { status: 400 }
      );
    }

    // 1. ตรวจสอบว่ามีรายการนี้อยู่หรือไม่
    const { data: record, error: recErr } = await supabase
      .from('notification_registrations')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (recErr || !record) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบรายการคำขอนี้ในระบบ' },
        { status: 404 }
      );
    }

    if (record.status !== 'pending') {
      const statusText = record.status === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว';
      return NextResponse.json(
        { success: false, error: `รายการนี้ได้ทำการ${statusText}ไปแล้ว ไม่สามารถดำเนินการซ้ำได้` },
        { status: 400 }
      );
    }

    const staffGroupId = process.env.LINE_NOTIFY_GROUP_ID || DEFAULT_STAFF_GROUP_ID;
    const lineAccessToken = process.env.LINE_NOTIFY_ACCESS_TOKEN || DEFAULT_ACCESS_TOKEN;

    // 2. กรณีเจ้าหน้าที่กด "อนุมัติ" (Approve)
    if (action === 'approve') {
      // 2.1 อัปเดตตาราง contact ใน Supabase ให้ผูก userID
      const { error: updateContactErr } = await supabase
        .from('contact')
        .update({ userID: record.line_user_id })
        .eq('ID_contact', record.contract_no);

      if (updateContactErr) {
        console.error('Error updating contract userID:', updateContactErr);
        return NextResponse.json(
          { success: false, error: 'เกิดข้อผิดพลาดในการอัปเดตสัญญาใน Supabase: ' + updateContactErr.message },
          { status: 500 }
        );
      }

      // 2.2 อัปเดตสถานะใน notification_registrations เป็น approved
      await supabase
        .from('notification_registrations')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: 'เจ้าหน้าที่',
        })
        .eq('id', id);

      // 2.3 ส่งข้อความยืนยันเข้ากลุ่ม LINE เจ้าหน้าที่
      await sendLinePushMessage(staffGroupId, [
        {
          type: 'text',
          text: `✅ เจ้าหน้าที่อนุมัติผูกสัญญาเลขที่ ${record.contract_no} (ชื่อ: ${record.borrower_name}) เข้ากับ LINE User ID เรียบร้อยแล้ว`,
        },
      ], lineAccessToken);

      // 2.4 (แถม) ส่งข้อความแจ้งผู้กู้โดยตรง หากมี LINE User ID ที่ถูกต้อง
      if (record.line_user_id && record.line_user_id.startsWith('U')) {
        try {
          await sendLinePushMessage(record.line_user_id, [
            {
              type: 'text',
              text: `🎉 บริษัท ทรัพย์สำราญ พิโก จำกัด\nสัญญาเลขที่ ${record.contract_no} (${record.borrower_name}) ได้รับการอนุมัติผูกบัญชี LINE เรียบร้อยแล้ว!\n\nท่านจะได้รับการแจ้งเตือนและสามารถตรวจสอบยอดค่างวดผ่านระบบได้ทันที ขอบคุณครับ`,
            },
          ], lineAccessToken);
        } catch (pushErr) {
          console.warn('Could not notify customer:', pushErr);
        }
      }

      return NextResponse.json({
        success: true,
        message: 'อนุมัติและผูกสัญญาสำเร็จ',
      });
    }

    // 3. กรณีเจ้าหน้าที่กด "ปฏิเสธ" (Reject)
    if (action === 'reject') {
      await supabase
        .from('notification_registrations')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: 'เจ้าหน้าที่',
          reject_reason: rejectReason || 'เจ้าหน้าที่ปฏิเสธคำขอ',
        })
        .eq('id', id);

      const reasonText = rejectReason ? ` (เหตุผล: ${rejectReason})` : '';
      await sendLinePushMessage(staffGroupId, [
        {
          type: 'text',
          text: `❌ เจ้าหน้าที่ปฏิเสธคำขอสมัครแจ้งเตือนของสัญญาเลขที่ ${record.contract_no} (${record.borrower_name})${reasonText}`,
        },
      ], lineAccessToken);

      return NextResponse.json({
        success: true,
        message: 'ปฏิเสธคำขอเรียบร้อยแล้ว',
      });
    }

  } catch (error) {
    console.error('Error in PATCH /api/registerNotify:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
