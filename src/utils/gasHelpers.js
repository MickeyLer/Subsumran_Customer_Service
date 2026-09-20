
// Google Apps Script Web App URL
export const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwHiaegkDmGVUTg27tgjHVTOSd7LRa0jiARLSVr0Fb5ceG84QT0J7XsgWrJsWKG3ysK/exec';

/**
 * Uploads an image to Google Drive via Google Apps Script.
 * @param {File} imageFile The image file to upload.
 * @param {string} userId The user ID associated with the image.
 * @param {string} folderType The type of folder ('deposit' or 'withdraw'). Default is 'deposit'.
 * @returns {Promise<Object>} The result object containing file URLs and ID.
 */
export const uploadImageToGoogleDrive = async (imageFile, userId, folderType = 'deposit') => {
    try {
        // แปลงไฟล์เป็น base64
        const base64Image = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(imageFile);
        });

        // สร้างชื่อไฟล์ที่ unique
        const timestamp = new Date().getTime();
        const prefix = folderType === 'withdraw' ? 'withdrawal_slip' : 'deposit_slip';
        const fileName = `${prefix}_${userId}_${timestamp}.${imageFile.name.split('.').pop()}`;

        // ส่งข้อมูลไป Google Apps Script
        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify({
                imageBlob: base64Image,
                fileName: fileName,
                userId: userId,
                folderType: folderType // 'deposit' or 'withdraw'
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            return {
                success: true,
                fileId: result.fileId,
                fileName: result.fileName,
                fileUrl: result.fileUrl,
                driveUrl: result.driveUrl,
                downloadUrl: result.downloadUrl
            };
        } else {
            throw new Error(result.error || 'Unknown error occurred');
        }

    } catch (error) {
        console.error('Error uploading image:', error);
        // Enhance error message for "load failed"
        if (error.message === 'Load failed') {
            throw new Error('อัปโหลดรูปภาพล้มเหลว (Network Error) - กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
        }
        throw error;
    }
};

/**
 * Sends a notification to Admin via Line (through GAS).
 * @param {Object} data The notification data (action, adminId, amount, userName, imageUrl, etc.).
 * @returns {Promise<void>}
 */
export const notifyAdminViaGAS = async (data) => {
    try {
        // ใช้ Standard CORS fetch แบบเดียวกับ uploadImageToGoogleDrive
        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        });

        // Check response if needed, mainly for debugging
        if (!response.ok) {
            console.warn('GAS Notification response not OK:', response.status);
        } else {
            console.log('📨 Notification sent to GAS successfully');
        }
    } catch (error) {
        console.error('Error sending notification to GAS:', error);
    }
};
