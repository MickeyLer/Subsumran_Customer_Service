/**
 * settingsApi.js
 * API สำหรับ Company Settings ที่เก็บใน Firebase Firestore
 * (แยกออกจาก api.js เพราะใช้ data source คนละแหล่งกับ Supabase)
 */
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

/**
 * ดึง Company Settings จาก Firebase Firestore
 * @returns {Promise<Object>} company settings object
 */
export const getCompanySettings = async () => {
  try {
    const docRef = doc(db, 'settings', 'company');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      console.debug('No company settings found, returning defaults.');
      return {
        logo: '',
        company_name: 'บริษัท ทรัพย์สำราญ',
        company_address: '',
        grace_period_days: 3,
        default_interest_rate_margin: 1,
        min_debt_for_collection_fee: 1000,
        collection_fee_tier1: 50,
        collection_fee_tier2: 100,
        collection_grace_period_days: 15,
      };
    }
  } catch (error) {
    console.error('Error fetching company settings:', error);
    throw error;
  }
};

/**
 * อัปเดต Company Settings ใน Firebase Firestore
 * @param {Object} settings
 * @returns {Promise<boolean>}
 */
export const updateCompanySettings = async (settings) => {
  try {
    const docRef = doc(db, 'settings', 'company');
    await setDoc(docRef, settings, { merge: true });
    console.debug('Company settings updated successfully.');
    return true;
  } catch (error) {
    console.error('Error updating company settings:', error);
    throw error;
  }
};
