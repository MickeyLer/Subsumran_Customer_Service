import { getAuth } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

/* // Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBWnC85SIuKrJf-vJSMdgaYPCDPHVGzi9k",
  authDomain: "aomthong-cb545.firebaseapp.com",
  projectId: "aomthong-cb545",
  storageBucket: "aomthong-cb545.firebasestorage.app",
  messagingSenderId: "936194372164",
  appId: "1:936194372164:web:9036177089a1e2c081c211",
  measurementId: "G-4NWPE6VZ3F"
}; */

// test firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDOXxQxdQSWDwq4Fu9C6170dn-onf7btSM",
  authDomain: "aomtest-5740e.firebaseapp.com",
  projectId: "aomtest-5740e",
  storageBucket: "aomtest-5740e.firebasestorage.app",
  messagingSenderId: "98821429167",
  appId: "1:98821429167:web:3ddf1f4100cb766a90c15a",
  measurementId: "G-3BTB89XX59"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const functions = getFunctions(app, 'asia-southeast1'); // Adjust region if needed

export { db, auth, storage, functions };