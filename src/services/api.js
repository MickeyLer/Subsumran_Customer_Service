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

export const fetchCustomerByUserId = async (userId) => {
    if (!userId) return null;
    const { data, error } = await supabase
        .from('Customer')
        .select('*')
        .or(`userID.eq.${userId},ID.eq.${userId}`)
        .maybeSingle();
    return handleResponse(data, error, 'fetchCustomerByUserId');
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

// Re-export Storage Adapter Seam (backward compatible)
export {
    uploadFileToStorage as uploadFileToFirebase,
    deleteFileFromStorage as deleteFileFromFirebase,
    deleteFolderFromStorage as deleteFolderFromFirebase,
    uploadCustomerPhoto as uploadCustomerPhotoToFirebase,
    uploadCustomerPhoto as updateCustomerPhotoInFirebase,
    uploadProfilePhoto as uploadProfilePhotoToFirebase,
    uploadCompanyLogo as uploadCompanyLogoToFirebase,
    uploadContractPDF as uploadContractPDFToFirebase,
    fetchContractPDFUrl
} from './storageSeam';


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

export const fetchContactById = async (contractId) => {
    if (!contractId) return null;
    const { data, error } = await supabase
        .from('contact')
        .select('*')
        .eq('ID_contact', contractId)
        .maybeSingle();
    return handleResponse(data, error, 'fetchContactById');
};

export const fetchContactsByUser = async (userId) => {
    if (!userId) return [];
    const { data, error } = await supabase
        .from('contact')
        .select('*')
        .eq('userID', userId);
    return handleResponse(data, error, 'fetchContactsByUser');
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

export const fetchInterestByContacts = async (contractIds) => {
    if (!contractIds || contractIds.length === 0) return [];
    const { data, error } = await supabase
        .from('Interest_chart')
        .select('*')
        .in('Id_contact', contractIds)
        .order('ID', { ascending: true });
    return handleResponse(data, error, 'fetchInterestByContacts');
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

