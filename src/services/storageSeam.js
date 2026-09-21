import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';

/**
 * Storage Adapter Seam
 * 
 * Deep module encapsulating media uploads, file deletions, and PDF retrieval
 * behind a unified storage interface, isolating application code from Firebase Storage SDK.
 */

// Production Firebase Storage Adapter implementation
const firebaseStorageAdapter = {
  uploadFile: async (file, path) => {
    if (!file) return null;
    try {
      const storageRef = ref(storage, path);
      const snapshot = await uploadBytes(storageRef, file);
      return await getDownloadURL(snapshot.ref);
    } catch (error) {
      console.error('Firebase Storage Error [uploadFile]:', error);
      throw error;
    }
  },

  deleteFile: async (path) => {
    try {
      const storageRef = ref(storage, path);
      await deleteObject(storageRef);
      console.log(`Firebase Storage: Deleted file at ${path}`);
    } catch (error) {
      if (error.code === 'storage/object-not-found') {
        console.log(`Firebase Storage: File not found at ${path}, skipping deletion.`);
      } else {
        console.error('Error deleting file from Firebase Storage:', error);
        throw error;
      }
    }
  },

  deleteFolder: async (folderPath) => {
    try {
      const pathStr = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;
      const folderRef = ref(storage, pathStr);
      const listResult = await listAll(folderRef);

      const deletePromises = listResult.items.map((item) => deleteObject(item));
      const subFolderPromises = listResult.prefixes.map((subFolder) =>
        firebaseStorageAdapter.deleteFolder(subFolder.fullPath)
      );

      await Promise.all([...deletePromises, ...subFolderPromises]);
      console.log(`Firebase Storage: Cleared folder at ${pathStr}`);
    } catch (error) {
      if (error.code !== 'storage/object-not-found') {
        console.error('Error clearing folder from Firebase Storage:', error);
        throw error;
      }
    }
  },

  fetchPDFUrl: async (contractId, fileName) => {
    try {
      const safeId = contractId.replace(/\//g, '-');
      const pathStr = `contracts_pdf/${safeId}/${fileName}`;
      const storageRef = ref(storage, pathStr);
      return await getDownloadURL(storageRef);
    } catch (error) {
      if (error.code === 'storage/object-not-found') {
        return null;
      }
      console.error('Error fetching PDF from Firebase Storage:', error);
      return null;
    }
  },
};

// Active adapter (defaults to production Firebase Storage)
let activeAdapter = firebaseStorageAdapter;

/**
 * Configure or swap the active storage adapter (useful for unit tests / test doubles).
 * @param {Object} customAdapter 
 */
export const setStorageAdapter = (customAdapter) => {
  activeAdapter = customAdapter;
};

export const uploadFileToStorage = (file, path) => activeAdapter.uploadFile(file, path);

export const deleteFileFromStorage = (path) => activeAdapter.deleteFile(path);

export const deleteFolderFromStorage = (folderPath) => activeAdapter.deleteFolder(folderPath);

export const fetchContractPDFUrl = (contractId, fileName) => activeAdapter.fetchPDFUrl(contractId, fileName);

export const uploadCustomerPhoto = async (file, customerId) => {
  try {
    await activeAdapter.deleteFolder(`customer_photos/${customerId}/`);
  } catch (e) {
    console.log('No existing photo folder to clear', e.message);
  }
  return activeAdapter.uploadFile(file, `customer_photos/${customerId}/${file.name}`);
};

export const uploadProfilePhoto = async (file, userId) => {
  if (!file) return null;
  try {
    await activeAdapter.deleteFolder(`profile_photos/${userId}/`);
  } catch (e) {
    console.log('No existing profile folder to clear', e.message);
  }
  return activeAdapter.uploadFile(file, `profile_photos/${userId}/${file.name}`);
};

export const uploadCompanyLogo = async (file) => {
  if (!file) return null;
  try {
    await activeAdapter.deleteFolder(`company/logo/`);
  } catch (e) {
    console.log('No existing logo folder to clear', e.message);
  }
  return activeAdapter.uploadFile(file, `company/logo/${file.name}`);
};

export const uploadContractPDF = async (pdfBlob, path) => {
  if (!pdfBlob) return null;
  return activeAdapter.uploadFile(pdfBlob, path);
};
