import { NextResponse } from 'next/server';
import supabase from '../../../supabaseClient';

const DEFAULT_LINE_ACCESS_TOKEN = '2h0WKLYiR96mdUqi9etB1tgUK4D56CtWUDUZasfA6o1HkP4wIh9f4GwNxN5kRgJ8Mhosc1BQj8DNNZwIMF51fg7DjGIMSVdkgm6gXNmcj7Nyb3ORuknNDV+OPLP5GXVTstamuVF9gwBddRUM22iYBAdB04t89/1O/w1cDnyilFU=';
const DEFAULT_LINE_GROUP_ID = 'Ce8dbb937a3e3c06617709435adfe487a';

/**
 * Sends a message via LINE Messaging API Push Endpoint
 */
async function sendLinePush(groupId, messages, token) {
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: groupId,
        messages: messages,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[LINE Push] Failed to send to ${groupId} (status ${res.status}): ${errText}`);
      return { success: false, error: errText };
    }
    return { success: true };
  } catch (err) {
    console.error(`[LINE Push] Network error to ${groupId}:`, err);
    return { success: false, error: err.message };
  }
}

/**
 * POST /api/loanInquiry
 * Receives loan calculation & customer inquiry, records into Supabase and sends LINE Push alert to staff/admin group.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      customerName,
      phone,
      collateral = 'ไม่ระบุ',
      collateralDetail = '',
      loanAmount = 0,
      months = 12,
      interestRate = 36,
      monthlyInstallment = 0,
      totalPayment = 0,
      lineUserId = '',
      lineDisplayName = '',
      linePictureUrl = '',
      notes = ''
    } = body;

    const trimmedName = (customerName || '').trim();
    const trimmedPhone = (phone || '').trim();

    if (!trimmedName || !trimmedPhone) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุชื่อ-นามสกุล และเบอร์โทรศัพท์ที่ติดต่อได้' },
        { status: 400 }
      );
    }

    if (!loanAmount || Number(loanAmount) <= 0) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุยอดเงินที่ต้องการกู้' },
        { status: 400 }
      );
    }

    const numAmount = Number(loanAmount) || 0;
    const numMonths = Math.max(1, Number(months) || 1);
    const numRate = Number(interestRate) || 36;

    // Calculate PMT on server if not provided or <= 0
    let numMonthly = Number(monthlyInstallment) || 0;
    if (numMonthly <= 0 && numAmount > 0) {
      const r = (numRate / 100) / 12;
      if (r === 0) {
        numMonthly = Math.round(numAmount / numMonths);
      } else {
        const factor = Math.pow(1 + r, numMonths);
        numMonthly = Math.round((numAmount * r * factor) / (factor - 1));
      }
    }

    const numTotal = Number(totalPayment) > 0 ? Number(totalPayment) : (numMonthly * numMonths);

    // 1. Insert into Supabase table `loan_inquiries`
    let insertedInquiry = null;
    try {
      const { data, error } = await supabase
        .from('loan_inquiries')
        .insert([{
          customer_name: trimmedName,
          phone: trimmedPhone,
          collateral: collateral || 'ไม่ระบุ',
          collateral_detail: collateralDetail || null,
          loan_amount: numAmount,
          months: numMonths,
          interest_rate: Number(interestRate) || 36,
          monthly_installment: numMonthly,
          total_payment: numTotal,
          line_user_id: lineUserId || null,
          line_display_name: lineDisplayName || null,
          line_picture_url: linePictureUrl || null,
          status: 'pending',
          notes: notes || null,
        }])
        .select()
        .maybeSingle();

      if (error) {
        console.warn('Could not insert to loan_inquiries table in Supabase:', error.message);
      } else {
        insertedInquiry = data;
      }
    } catch (dbErr) {
      console.warn('Supabase DB error on loan_inquiries insert:', dbErr);
    }

    // 2. Format Thai Date & Time
    const nowTh = new Date().toLocaleString('th-TH', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const formattedAmount = numAmount.toLocaleString('th-TH', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

    const formattedMonthly = numMonthly.toLocaleString('th-TH', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

    const formattedTotal = numTotal.toLocaleString('th-TH', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

    // 3. Build LINE Flex Message Bubble
    const flexBubble = {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#d83a78',
        paddingAll: '16px',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: '🔔 สนใจยื่นขอสินเชื่อใหม่',
                weight: 'bold',
                color: '#ffffff',
                size: 'md',
                flex: 1,
              },
            ],
          },
          {
            type: 'text',
            text: 'ระบบคำนวณเงิน ทรัพย์สำราญ พิโก (PICO FINANCE)',
            color: '#ffd9e4',
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
          // Amount & Installment highlight
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#fff0f4',
            cornerRadius: '8px',
            paddingAll: '12px',
            spacing: 'xs',
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: 'ยอดเงินกู้ที่สนใจ:',
                    size: 'sm',
                    color: '#634250',
                    flex: 4,
                  },
                  {
                    type: 'text',
                    text: `${formattedAmount} บาท`,
                    size: 'lg',
                    weight: 'bold',
                    color: '#d83a78',
                    align: 'end',
                    flex: 6,
                  },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: 'ค่างวดประมาณการ:',
                    size: 'xs',
                    color: '#634250',
                    flex: 4,
                  },
                  {
                    type: 'text',
                    text: `${formattedMonthly} บาท / เดือน`,
                    size: 'sm',
                    weight: 'bold',
                    color: '#8b6f20',
                    align: 'end',
                    flex: 6,
                  },
                ],
              },
            ],
          },
          {
            type: 'separator',
          },
          // Customer & Loan Details
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'xs',
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '👤 ชื่อลูกค้า:', size: 'xs', color: '#64748b', flex: 3 },
                  { type: 'text', text: trimmedName, size: 'xs', weight: 'bold', color: '#0f172a', flex: 6, wrap: true },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '📞 เบอร์โทรศัพท์:', size: 'xs', color: '#64748b', flex: 3 },
                  { type: 'text', text: trimmedPhone, size: 'xs', weight: 'bold', color: '#0284c7', flex: 6 },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '💬 บัญชี LINE:', size: 'xs', color: '#64748b', flex: 3 },
                  { type: 'text', text: lineDisplayName || 'ไม่ได้ระบุ', size: 'xs', weight: 'bold', color: '#059669', flex: 6, wrap: true },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '⏱️ จำนวนงวด:', size: 'xs', color: '#64748b', flex: 3 },
                  { type: 'text', text: `${numMonths} งวด (${numMonths} เดือน)`, size: 'xs', weight: 'bold', color: '#0f172a', flex: 6 },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '📈 อัตราดอกเบี้ย:', size: 'xs', color: '#64748b', flex: 3 },
                  { type: 'text', text: `${interestRate}% ต่อปี (ลดต้นลดดอก)`, size: 'xs', color: '#0f172a', flex: 6 },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '💵 รวมจ่ายทั้งสิ้น:', size: 'xs', color: '#64748b', flex: 3 },
                  { type: 'text', text: `${formattedTotal} บาท`, size: 'xs', color: '#64748b', flex: 6 },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '🛡️ สิ่งค้ำประกัน:', size: 'xs', color: '#64748b', flex: 3 },
                  { type: 'text', text: collateral || 'ไม่ระบุ', size: 'xs', weight: 'bold', color: '#b45309', flex: 6, wrap: true },
                ],
              },
              ...(collateralDetail ? [
                {
                  type: 'box',
                  layout: 'horizontal',
                  contents: [
                    { type: 'text', text: '📝 รายละเอียด:', size: 'xs', color: '#64748b', flex: 3 },
                    { type: 'text', text: collateralDetail, size: 'xs', color: '#334155', flex: 6, wrap: true },
                  ],
                }
              ] : []),
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '🕒 เวลาที่ส่ง:', size: 'xs', color: '#94a3b8', flex: 3 },
                  { type: 'text', text: nowTh, size: 'xxs', color: '#94a3b8', flex: 6 },
                ],
              },
              ...(lineUserId ? [
                {
                  type: 'box',
                  layout: 'horizontal',
                  contents: [
                    { type: 'text', text: '🆔 LINE User ID:', size: 'xs', color: '#94a3b8', flex: 3 },
                    { type: 'text', text: lineUserId, size: 'xxs', color: '#94a3b8', flex: 6, wrap: true },
                  ],
                }
              ] : []),
            ],
          },
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
            color: '#16a34a',
            height: 'sm',
            action: {
              type: 'uri',
              label: `📞 โทรหาลูกค้า (${trimmedPhone})`,
              uri: `tel:${trimmedPhone.replace(/[^0-9+]/g, '')}`,
            },
          },
        ],
      },
    };

    const altText = `🔔 สนใจยื่นกู้เงิน: ${trimmedName} (${formattedAmount} บ. / ${numMonths} งวด) โทร: ${trimmedPhone}`;

    const lineMessages = [
      {
        type: 'flex',
        altText: altText,
        contents: flexBubble,
      },
    ];

    // Fallback plain text message if flex has any renderer issue in older LINE clients
    const fallbackTextMessage = {
      type: 'text',
      text: `🔔 [มีลูกค้าสนใจยื่นกู้เงินใหม่]\n----------------------------------\n👤 ชื่อลูกค้า: ${trimmedName}\n📞 โทร: ${trimmedPhone}\n💬 LINE: ${lineDisplayName || 'ไม่ระบุ'}\n💰 ยอดเงินกู้ที่สนใจ: ${formattedAmount} บาท\n⏱️ จำนวนงวด: ${numMonths} งวด\n📈 ดอกเบี้ย: ${interestRate}% ต่อปี\n💳 ค่างวดประมาณการ: ${formattedMonthly} บาท/เดือน\n🛡️ สิ่งค้ำประกัน: ${collateral} ${collateralDetail ? `(${collateralDetail})` : ''}\n🕒 เวลาที่ส่ง: ${nowTh}\n----------------------------------`,
    };

    // 4. Send to LINE Group: บริษัททรัพย์สำราญ 3
    const adminGroupId = process.env.LINE_ADMIN_GROUP_ID || DEFAULT_LINE_GROUP_ID;
    const adminToken = process.env.LINE_CHANNEL_ACCESS_TOKEN || DEFAULT_LINE_ACCESS_TOKEN;

    let sentSuccess = false;

    // Send to บริษัททรัพย์สำราญ 3 Group
    if (adminGroupId && adminToken) {
      const res = await sendLinePush(adminGroupId, lineMessages, adminToken);
      if (res.success) {
        sentSuccess = true;
      } else {
        // Retry with plain text message if flex fails
        const textRes = await sendLinePush(adminGroupId, [fallbackTextMessage], adminToken);
        if (textRes.success) sentSuccess = true;
      }
    }

    return NextResponse.json({
      success: true,
      sentToLine: sentSuccess,
      inquiryId: insertedInquiry?.id || null,
      message: 'ส่งข้อมูลให้เจ้าหน้าที่ตรวจสอบเรียบร้อยแล้ว',
    });

  } catch (error) {
    console.error('Error handling loan inquiry:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'เกิดข้อผิดพลาดในการประมวลผล' },
      { status: 500 }
    );
  }
}
