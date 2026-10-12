import { notifyAdminViaGAS } from './gasHelpers';

export const LINE_ADMIN_GROUP_ID = 'Ce8dbb937a3e3c06617709435adfe487a';
export const LINE_CHANNEL_ACCESS_TOKEN = '2h0WKLYiR96mdUqi9etB1tgUK4D56CtWUDUZasfA6o1HkP4wIh9f4GwNxN5kRgJ8Mhosc1BQj8DNNZwIMF51fg7DjGIMSVdkgm6gXNmcj7Nyb3ORuknNDV+OPLP5GXVTstamuVF9gwBddRUM22iYBAdB04t89/1O/w1cDnyilFU=';

/**
 * Sends a notification directly to the specified LINE Group.
 * @param {Object} data 
 * @param {number} data.amount
 * @param {string} data.userName
 * @param {string} data.contractId
 * @param {string} data.imageUrl
 * @param {string} data.confidence
 * @param {string} data.reason
 */
export const notifyLineGroup = async (data) => {
  try {
    const payload = {
      ...data,
      groupId: LINE_ADMIN_GROUP_ID,
      accessToken: LINE_CHANNEL_ACCESS_TOKEN,
    };

    console.log('📨 Sending slip alert to LINE Group:', LINE_ADMIN_GROUP_ID);

    // Call internal Next.js API route
    const response = await fetch('/api/notifyLine', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.warn('LINE Group notification via /api/notifyLine returned status:', response.status);
      // Fallback to GAS if API route fails
      await notifyAdminViaGAS({
        action: 'notify_admin',
        adminId: LINE_ADMIN_GROUP_ID,
        ...data,
      }).catch(err => console.error('Fallback GAS error:', err));
    } else {
      console.log('✅ LINE Group push notification sent successfully!');
    }
  } catch (error) {
    console.error('Error in notifyLineGroup:', error);
    // Fallback to GAS
    await notifyAdminViaGAS({
      action: 'notify_admin',
      adminId: LINE_ADMIN_GROUP_ID,
      ...data,
    }).catch(err => console.error('Fallback GAS error:', err));
  }
};
