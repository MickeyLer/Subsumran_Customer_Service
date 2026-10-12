import { NextResponse } from 'next/server';

const DEFAULT_ACCESS_TOKEN = '2h0WKLYiR96mdUqi9etB1tgUK4D56CtWUDUZasfA6o1HkP4wIh9f4GwNxN5kRgJ8Mhosc1BQj8DNNZwIMF51fg7DjGIMSVdkgm6gXNmcj7Nyb3ORuknNDV+OPLP5GXVTstamuVF9gwBddRUM22iYBAdB04t89/1O/w1cDnyilFU=';
const DEFAULT_GROUP_ID = 'Ce8dbb937a3e3c06617709435adfe487a';

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      amount,
      userName,
      contractId,
      imageUrl,
      confidence,
      reason,
      approvalUrl,
      isAutoApproved = false,
      invoiceId = '',
      invoiceUrl = '',
      groupId = process.env.LINE_ADMIN_GROUP_ID || DEFAULT_GROUP_ID,
      accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN || DEFAULT_ACCESS_TOKEN,
    } = body;

    const formattedAmount = Number(amount || 0).toLocaleString('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const nowTh = new Date().toLocaleString('th-TH', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const headerBg = isAutoApproved ? '#16a34a' : '#d97706';
    const headerTitle = isAutoApproved ? '✅ ชำระเงินสำเร็จ (AI อนุมัติอัตโนมัติ)' : '⚠️ แจ้งเตือนสลิปโอนเงิน (รอตรวจสอบ)';
    const statusNote = isAutoApproved
      ? `ออกใบเสร็จเลขที่ ${invoiceId || '-'} เรียบร้อยแล้ว`
      : (reason || confidence || 'AI ตรวจสอบไม่ผ่าน / ลูกค้าส่งตรวจด้วยตนเอง');

    // Build Flex Message Bubble
    const bubble = {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: headerBg,
        paddingAll: '16px',
        contents: [
          {
            type: 'text',
            text: headerTitle,
            weight: 'bold',
            color: '#ffffff',
            size: 'md',
          },
          {
            type: 'text',
            text: 'บริษัท ทรัพย์สำราญ พิโก จำกัด',
            color: '#fef3c7',
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
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: 'ยอดชำระ',
                size: 'sm',
                color: '#64748b',
                flex: 3,
              },
              {
                type: 'text',
                text: `${formattedAmount} บาท`,
                size: 'lg',
                weight: 'bold',
                color: isAutoApproved ? '#16a34a' : '#0284c7',
                align: 'end',
                flex: 5,
              },
            ],
          },
          {
            type: 'separator',
          },
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: 'ชื่อลูกค้า:',
                    size: 'xs',
                    color: '#64748b',
                    flex: 3,
                  },
                  {
                    type: 'text',
                    text: userName || 'ไม่ระบุชื่อ',
                    size: 'xs',
                    weight: 'bold',
                    color: '#1e293b',
                    flex: 5,
                  },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: 'เลขที่สัญญา:',
                    size: 'xs',
                    color: '#64748b',
                    flex: 3,
                  },
                  {
                    type: 'text',
                    text: contractId ? String(contractId) : '-',
                    size: 'xs',
                    weight: 'bold',
                    color: '#1e293b',
                    flex: 5,
                  },
                ],
              },
              ...(invoiceId ? [{
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: 'เลขที่ใบเสร็จ:',
                    size: 'xs',
                    color: '#64748b',
                    flex: 3,
                  },
                  {
                    type: 'text',
                    text: invoiceId,
                    size: 'xs',
                    weight: 'bold',
                    color: '#16a34a',
                    flex: 5,
                  },
                ],
              }] : []),
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: 'เวลาทำรายการ:',
                    size: 'xs',
                    color: '#64748b',
                    flex: 3,
                  },
                  {
                    type: 'text',
                    text: nowTh,
                    size: 'xs',
                    color: '#1e293b',
                    flex: 5,
                  },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: 'สถานะตรวจสอบ:',
                    size: 'xs',
                    color: isAutoApproved ? '#16a34a' : '#b45309',
                    weight: 'bold',
                    flex: 3,
                  },
                  {
                    type: 'text',
                    text: statusNote,
                    size: 'xs',
                    color: isAutoApproved ? '#16a34a' : '#b45309',
                    wrap: true,
                    flex: 5,
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    // If a valid HTTP/HTTPS image URL is present, add Hero image and open action
    const isHttpsImage = imageUrl && (imageUrl.startsWith('https://') || imageUrl.startsWith('http://'));
    if (isHttpsImage) {
      bubble.hero = {
        type: 'image',
        url: imageUrl,
        size: 'full',
        aspectRatio: '1:1.2',
        aspectMode: 'fit',
        backgroundColor: '#f1f5f9',
        action: {
          type: 'uri',
          uri: imageUrl,
        },
      };
    }

    // Build Footer Buttons (1-Click Approval, View Invoice, View Slip)
    const footerButtons = [];

    if (approvalUrl) {
      footerButtons.push({
        type: 'button',
        style: 'primary',
        color: '#16a34a',
        height: 'sm',
        action: {
          type: 'uri',
          label: '⚡ ตรวจสอบและอนุมัติ (1-Click)',
          uri: approvalUrl,
        },
      });
    }

    if (invoiceUrl) {
      footerButtons.push({
        type: 'button',
        style: 'primary',
        color: '#0284c7',
        height: 'sm',
        action: {
          type: 'uri',
          label: '📄 ดูใบเสร็จรับเงิน (Invoice)',
          uri: invoiceUrl,
        },
      });
    }

    if (isHttpsImage) {
      footerButtons.push({
        type: 'button',
        style: approvalUrl || invoiceUrl ? 'secondary' : 'primary',
        color: approvalUrl || invoiceUrl ? '#e2e8f0' : '#0284c7',
        height: 'sm',
        action: {
          type: 'uri',
          label: '🔎 ดูรูปสลิปขนาดเต็ม',
          uri: imageUrl,
        },
      });
    }

    if (footerButtons.length > 0) {
      bubble.footer = {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: footerButtons,
      };
    }

    const payload = {
      to: groupId,
      messages: [
        {
          type: 'flex',
          altText: isAutoApproved 
            ? `✅ ชำระเงินสำเร็จ ${formattedAmount} บาท (สัญญา: ${contractId || '-'})`
            : `⚠️ แจ้งเตือนสลิปโอนเงิน ${formattedAmount} บาท (สัญญา: ${contractId || '-'})`,
          contents: bubble,
        },
      ],
    };

    // Call LINE Messaging API push endpoint
    const lineResponse = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!lineResponse.ok) {
      const errText = await lineResponse.text();
      console.error('LINE Messaging API error:', lineResponse.status, errText);
      return NextResponse.json(
        { success: false, error: errText, status: lineResponse.status },
        { status: lineResponse.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Notification sent to LINE group successfully',
    });
  } catch (error) {
    console.error('Failed to send LINE notification:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
