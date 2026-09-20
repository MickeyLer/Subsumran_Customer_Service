import supabase from '../supabaseClient';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';

// Re-export settings API (ย้ายไปไฟล์แยกแล้ว — backward compatible)
export { getCompanySettings, updateCompanySettings } from './settingsApi';

// ─────────────────────────────────────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────────────────────────────────────
const handleResponse = (data, error, context = '') => {
    if (error) {
        console.error(`Supabase Error [${context}]:`, error);
        throw error;
    }
    console.debug(`Supabase OK [${context}]`);
    return data;
};

// ==========================================
// CUSTOMER APIs
// ==========================================

export const fetchCustomers = async () => {
    const PAGE_SIZE = 1000;
    let allData = [];
    let from = 0;
    let hasMore = true;
    
    while (hasMore) {
        const { data: page, error } = await supabase
            .from('Customer')
            .select('*')
            .range(from, from + PAGE_SIZE - 1);
            
        if (error) {
            console.error('Supabase Error [fetchCustomers]:', error);
            throw error;
        }
        allData = allData.concat(page);
        hasMore = page.length === PAGE_SIZE;
        from += PAGE_SIZE;
    }
    console.debug(`Supabase OK [fetchCustomers] - total ${allData.length} records`);
    return allData;
};

export const addCustomer = async (customerData) => {
    console.log("Sending data to Supabase (Add Customer):", customerData);
    const { data, error } = await supabase
        .from('Customer')
        .insert([customerData]);
    return handleResponse(data, error, 'addCustomer');
};

export const updateCustomer = async (id, updatedData) => {
    console.log(`Updating data in Supabase (Customer ID: ${id}):`, updatedData);
    const { data, error } = await supabase
        .from('Customer')
        .update(updatedData)
        .eq('ID', id);
    return handleResponse(data, error, 'updateCustomer');
};

export const deleteCustomer = async (id) => {
    // 1. Delete from Supabase
    const { data, error } = await supabase
        .from('Customer')
        .delete()
        .eq('ID', id);
    
    const result = handleResponse(data, error, 'deleteCustomer');

    // 2. Cleanup Storage (Best effort - don't block if storage fails)
    try {
        console.log(`Cleaning up Firebase Storage for Customer ID: ${id}`);
        await deleteFolderFromFirebase(`customer_photos/${id}/`);
    } catch (storageError) {
        console.error('Non-critical error cleaning up Firebase Storage:', storageError);
    }

    return result;
};

// ==========================================
// FIREBASE STORAGE APIs (IMAGE UPLOADS)
// ==========================================

/**
 * Generic file upload to Firebase Storage.
 * @param {File} file 
 * @param {string} path - Storage path (e.g. 'profiles/userid/photo.jpg')
 */
export const uploadFileToFirebase = async (file, path) => {
    if (!file) return null;
    try {
        const storageRef = ref(storage, path);
        const snapshot = await uploadBytes(storageRef, file);
        return await getDownloadURL(snapshot.ref);
    } catch (error) {
        console.error('Error uploading file to Firebase:', error);
        throw error;
    }
};

/**
 * Uploads a customer photo to Firebase Storage and returns the Download URL.
 * Also cleans up any existing photos in the customer's folder.
 * @param {File} file - The file object from input
 * @param {string} customerId - The unique ID of the customer
 * @returns {Promise<string>} - The public download URL
 */
export const uploadCustomerPhotoToFirebase = async (file, customerId) => {
    // 1. Clear existing photos to prevent orphans
    try {
        await deleteFolderFromFirebase(`customer_photos/${customerId}/`);
    } catch (e) {
        console.log('No existing folder to clear or error clearing folder', e.message);
    }

    // 2. Upload new photo
    return uploadFileToFirebase(file, `customer_photos/${customerId}/${file.name}`);
};

/**
 * Deletes a specific file from Firebase Storage.
 * @param {string} path - Storage path (e.g. 'profiles/userid/photo.jpg')
 */
export const deleteFileFromFirebase = async (path) => {
    try {
        const storageRef = ref(storage, path);
        await deleteObject(storageRef);
        console.log(`Firebase Storage: Deleted file at ${path}`);
    } catch (error) {
        if (error.code === 'storage/object-not-found') {
            console.log(`Firebase Storage: File not found at ${path}, skipping deletion.`);
        } else {
            console.error('Error deleting file from Firebase:', error);
            throw error;
        }
    }
};

/**
 * Deletes an entire "folder" (prefix) from Firebase Storage.
 * @param {string} folderPath - Path of the folder (e.g. 'customer_photos/123/')
 */
export const deleteFolderFromFirebase = async (folderPath) => {
    try {
        // Ensure path ends with / for safety
        const path = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;
        const folderRef = ref(storage, path);
        const listResult = await listAll(folderRef);

        const deletePromises = listResult.items.map((item) => deleteObject(item));
        const subFolderPromises = listResult.prefixes.map((subFolder) => deleteFolderFromFirebase(subFolder.fullPath));

        await Promise.all([...deletePromises, ...subFolderPromises]);
        console.log(`Firebase Storage: Cleared folder at ${path}`);
    } catch (error) {
        console.error('Error clearing folder from Firebase:', error);
        // We don't throw if it's just a "not found" error
        if (error.code !== 'storage/object-not-found') {
            throw error;
        }
    }
};

export const updateCustomerPhotoInFirebase = async (file, customerId) => {
    // Logic is essentially the same as add for now
    return uploadCustomerPhotoToFirebase(file, customerId);
};

/**
 * Uploads a profile photo to Firebase Storage and returns the Download URL.
 * Also cleans up any existing photos in the user's profile folder.
 * @param {File} file - The file object from input
 * @param {string} userId - The unique ID of the user (from Firebase Auth)
 * @returns {Promise<string>} - The public download URL
 */
export const uploadProfilePhotoToFirebase = async (file, userId) => {
    if (!file) return null;
    // 1. Clear existing photos to prevent orphans
    try {
        await deleteFolderFromFirebase(`profile_photos/${userId}/`);
    } catch (e) {
        console.log('No existing folder to clear or error clearing folder', e.message);
    }

    // 2. Upload new photo
    return uploadFileToFirebase(file, `profile_photos/${userId}/${file.name}`);
};

/**
 * Uploads the company logo to Firebase Storage
 * @param {File} file - The file object from input
 * @returns {Promise<string>} - The public download URL
 */
export const uploadCompanyLogoToFirebase = async (file) => {
    if (!file) return null;
    try {
        await deleteFolderFromFirebase(`company/logo/`);
    } catch (e) {
        console.log('No existing logo folder to clear', e.message);
    }
    return uploadFileToFirebase(file, `company/logo/${file.name}`);
};

/**
 * Uploads a generated PDF contract to Firebase Storage
 * @param {Blob} pdfBlob - The generated PDF Blob
 * @param {string} path - The specific path (e.g., 'contracts_pdf/18-2569/loan_contract.pdf')
 * @returns {Promise<string>} - The public download URL
 */
export const uploadContractPDFToFirebase = async (pdfBlob, path) => {
    if (!pdfBlob) return null;
    return uploadFileToFirebase(pdfBlob, path);
};

/**
 * Fetches the download URL for a generated PDF contract from Firebase Storage.
 * @param {string} contractId - The unique ID of the contract (ID_contact)
 * @param {string} fileName - The PDF file name (e.g., 'loan_contract.pdf')
 * @returns {Promise<string|null>} - The public download URL, or null if not found
 */
export const fetchContractPDFUrl = async (contractId, fileName) => {
    try {
        const path = `contracts_pdf/${contractId.replace(/\//g, '-')}/${fileName}`;
        const storageRef = ref(storage, path);
        return await getDownloadURL(storageRef);
    } catch (error) {
        if (error.code === 'storage/object-not-found') {
            return null; // Not found, return null gracefuly
        }
        console.error('Error fetching PDF from Firebase:', error);
        return null;
    }
};


// ==========================================
// CONTACT APIs
// ==========================================


export const fetchContacts = async () => {
    const PAGE_SIZE = 1000;
    let allData = [];
    let from = 0;
    let hasMore = true;
    
    while (hasMore) {
        const { data: page, error } = await supabase
            .from('contact')
            .select('*')
            .range(from, from + PAGE_SIZE - 1);
            
        if (error) {
            console.error('Supabase Error [fetchContacts]:', error);
            throw error;
        }
        allData = allData.concat(page);
        hasMore = page.length === PAGE_SIZE;
        from += PAGE_SIZE;
    }
    console.debug(`Supabase OK [fetchContacts] - total ${allData.length} records`);
    return allData;
};

export const updateContact = async (id, updatedData) => {
    console.log(`Updating data in Supabase (Contact ID: ${id}):`, updatedData);
    const { data, error } = await supabase
        .from('contact')
        .update(updatedData)
        .eq('ID', id);
    return handleResponse(data, error, 'updateContact');
};

export const deleteContact = async (idContact) => {
    // 1. Delete from Firebase Storage (contracts_pdf)
    const safeIdContact = idContact.replace(/\//g, '-');
    await deleteFolderFromFirebase(`contracts_pdf/${safeIdContact}`);

    // 2. Try to delete related records if they exist
    await supabase.from('Interest_chart').delete().eq('Id_contact', idContact);
    await supabase.from('transaction').delete().eq('ID_contact', idContact);

    // 3. Delete from contact table
    const { data: contactData, error: contactError } = await supabase
        .from('contact')
        .delete()
        .eq('ID_contact', idContact);
        
    handleResponse(contactData, contactError);

    return true;
};

// ==========================================
// TRANSACTION APIs
// ==========================================

export const fetchTransactionsByContact = async (idContact) => {
    const { data, error } = await supabase
        .from('transaction')
        .select('*')
        .eq('ID_contact', idContact)
        .order('Timestamp', { ascending: true });
    return handleResponse(data, error, 'fetchTransactionsByContact');
};

export const fetchInterestByContact = async (idContact) => {
    const { data, error } = await supabase
        .from('Interest_chart')
        .select('*')
        .eq('Id_contact', idContact)
        .order('ID', { ascending: true });
    return handleResponse(data, error, 'fetchInterestByContact');
};

export const fetchAllInterest = async () => {
    const PAGE_SIZE = 1000;
    let allData = [];
    let from = 0;
    let hasMore = true;
    while (hasMore) {
        const { data: page, error } = await supabase
            .from('Interest_chart')
            .select('*')
            .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        allData = allData.concat(page);
        hasMore = page.length === PAGE_SIZE;
        from += PAGE_SIZE;
    }
    return allData;
};

export const fetchTransactionsByYear = async (year) => {
    // Get transactions for a specific year.
    // Since Timestamp is a text column with mixed formats (e.g. "3/3/2026" or "Sat Sep 14 2024"),
    // we use ILIKE to search for the year string (supporting both AD and BE).
    const yearAD = year.toString();
    const yearBE = (parseInt(year, 10) + 543).toString();
    
    const PAGE_SIZE = 1000;
    let allData = [];
    let from = 0;
    let hasMore = true;
    
    while (hasMore) {
        const { data: page, error } = await supabase
            .from('transaction')
            .select('*')
            .or(`Timestamp.ilike.%${yearAD}%,Timestamp.ilike.%${yearBE}%`)
            .neq('status', 'cancelled') // กรองรายการที่ถูกยกเลิกออก
            .range(from, from + PAGE_SIZE - 1);
            
        if (error) throw error;
        allData = allData.concat(page);
        hasMore = page.length === PAGE_SIZE;
        from += PAGE_SIZE;
    }
    return allData;
};

export const fetchTransactionByInvoice = async (invoiceID) => {
    const { data, error } = await supabase
        .from('transaction')
        .select('*')
        .eq('Invoice', invoiceID)
        .limit(1);
    return handleResponse(data, error, 'fetchTransactionByInvoice');
};

export const fetchLatestGlobalInvoices = async (limit = 100) => {
    const { data, error } = await supabase
        .from('transaction')
        .select('Invoice')
        .not('Invoice', 'is', null)
        .order('id', { ascending: false })
        .limit(limit);
    return handleResponse(data, error, 'fetchLatestGlobalInvoices');
};

export const fetchInterestByReference = async (invoiceID) => {
    const { data, error } = await supabase
        .from('Interest_chart')
        .select('*')
        .eq('reference', invoiceID);
    return handleResponse(data, error, 'fetchInterestByReference');
};

export const fetchTransactionsByDateRange = async (startDate, endDate) => {
    const startObj = new Date(startDate);
    startObj.setHours(0, 0, 0, 0);
    
    const endObj = new Date(endDate);
    endObj.setHours(23, 59, 59, 999);
    
    const PAGE_SIZE = 1000;
    let allData = [];
    let from = 0;
    let hasMore = true;
    
    const startYearAD = startObj.getFullYear();
    const endYearAD = endObj.getFullYear();
    
    const yearsToQuery = [];
    for (let y = startYearAD; y <= endYearAD; y++) {
        yearsToQuery.push(y.toString());
        yearsToQuery.push((y + 543).toString());
    }
    const orQuery = yearsToQuery.map(y => `Timestamp.ilike.%${y}%`).join(',');

    while (hasMore) {
        const { data: page, error } = await supabase
            .from('transaction')
            .select('*')
            .in('type', ['จ่าย', 'จ่ายธรรม'])
            .neq('status', 'cancelled') // กรองรายการที่ถูกยกเลิกออก
            .or(orQuery)
            .range(from, from + PAGE_SIZE - 1);
            
        if (error) {
            console.error('fetchTransactionsByDateRange ERROR:', error);
            return null;
        }
        allData = allData.concat(page);
        hasMore = page.length === PAGE_SIZE;
        from += PAGE_SIZE;
    }
    
    // Filter exact date range in JS
    const filteredData = allData.filter(tx => {
        if (!tx.Timestamp) return false;
        let dt;
        const tsStr = tx.Timestamp.split(',')[0].trim();
        if (tsStr.includes('/')) {
             const parts = tsStr.split('/');
             if(parts.length === 3) {
                 let [d, m, y] = parts;
                 let year = parseInt(y, 10);
                 if (year > 2400) year -= 543;
                 dt = new Date(year, parseInt(m, 10) - 1, parseInt(d, 10));
             }
        } else {
             dt = new Date(tx.Timestamp);
        }
        if (!dt || isNaN(dt.getTime())) return false;
        
        return dt >= startObj && dt <= endObj;
    });

    return filteredData;
};

/**
 * ดึงข้อมูล transaction ทั้งหมดด้วย pagination
 * (Supabase มี default limit 1,000 rows ต้องใช้ pagination เพื่อดึงข้อมูลครบ)
 */
export const fetchAllTransactions = async () => {
    const PAGE_SIZE = 1000;
    let allData = [];
    let from = 0;
    let hasMore = true;
    while (hasMore) {
        const { data: page, error } = await supabase
            .from('transaction')
            .select('*')
            .neq('status', 'cancelled') // กรองรายการที่ถูกยกเลิกออก
            .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        allData = allData.concat(page);
        hasMore = page.length === PAGE_SIZE;
        from += PAGE_SIZE;
    }
    return allData;
};


// src/services/api.js
export const voidReceipt = async (transactionId, userId, reason) => {
  const { data, error } = await supabase.rpc('cancel_payment_receipt', {
    p_transaction_id: transactionId,
    p_cancelled_by: userId,
    p_cancel_reason: reason
  });

  if (error) throw error;
  return data;
};

export const addTransaction = async (transactionData) => {
    const { data, error } = await supabase
        .from('transaction')
        .insert([transactionData]);
    return handleResponse(data, error, 'addTransaction');
};

export const updateInterestChart = async (id, updatedData) => {
    const { data, error } = await supabase
        .from('Interest_chart')
        .update(updatedData)
        .eq('ID', id);
    return handleResponse(data, error, 'updateInterestChart');
};

export const updateContactData = async (idContact, updatedData) => {
    const { data, error } = await supabase
        .from('contact')
        .update(updatedData)
        .eq('ID_contact', idContact);
    return handleResponse(data, error, 'updateContactData');
};

// ==========================================
// ADMIN USER APIs
// ==========================================

export const checkIsAdmin = async (lineUserId) => {
    if (!lineUserId) return false;
    try {
        const { data, error } = await supabase
            .from('admin_users')
            .select('*')
            .eq('line_user_id', lineUserId)
            .maybeSingle();
        if (error) {
            console.error('Error checking admin status:', error);
            return false;
        }
        return !!data;
    } catch (e) {
        console.error('Exception in checkIsAdmin:', e);
        return false;
    }
};

export const fetchAdminUsers = async () => {
    const { data, error } = await supabase
        .from('admin_users')
        .select('*');
    return handleResponse(data, error, 'fetchAdminUsers');
};

export const addAdminUser = async (lineUserId, name = '') => {
    const { data, error } = await supabase
        .from('admin_users')
        .insert([{ line_user_id: lineUserId, name, role: 'admin' }]);
    return handleResponse(data, error, 'addAdminUser');
};

