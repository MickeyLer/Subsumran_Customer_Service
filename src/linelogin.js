"use client";

import './App.css';
import liff from '@line/liff';
import React, { useEffect, useState } from 'react';
import { checkIsAdmin } from './services/api';

export const AuthContext = React.createContext();

export const AuthProvider = ({ children }) => {

  const [pictureUrl, setPictureUrl] = useState("");
  const [idToken, setIdToken] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [realUserId, setRealUserId] = useState("");
  const [userId, setUserId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [impersonatedCustomer, setImpersonatedCustomer] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const logout = () => {
    liff.logout();
    window.location.reload();
  };

  const switchToCustomer = (targetUserId, customerObj = null) => {
    setUserId(targetUserId);
    setImpersonatedCustomer(customerObj);
  };

  const resetToSelf = () => {
    setUserId(realUserId);
    setImpersonatedCustomer(null);
  };

  const initLine = async () => {
    setIsAuthLoading(true);
    try {
      // Set user data (for testing or LIFF login)
      const currentUserId = "U2cd360ba05fa93c6907ca768afb9a458";
      setRealUserId(currentUserId);
      setUserId(currentUserId);
      setDisplayName("คุณทรัพย์สำราญ");
      setPictureUrl("");

      // Check if realUserId is in admin_users table
      const adminStatus = await checkIsAdmin(currentUserId);
      setIsAdmin(adminStatus);
    } catch (err) {
      console.error("Error evaluating admin status:", err);
      setIsAdmin(false);
    } finally {
      setIsAuthLoading(false);
    }
  };

  useEffect(() => {
    initLine();
  }, []);

  return (
    <AuthContext.Provider value={{
      userId,
      realUserId,
      displayName,
      pictureUrl,
      isAdmin,
      impersonatedCustomer,
      isAuthLoading,
      switchToCustomer,
      resetToSelf
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;