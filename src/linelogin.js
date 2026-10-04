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
    try {
      if (typeof window !== 'undefined' && liff.isLoggedIn()) {
        liff.logout();
      }
    } catch (err) {
      console.error("Error logging out from LIFF:", err);
    }
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

    const liffId = process.env.NEXT_PUBLIC_LIFF_ID || process.env.REACT_APP_LIFF_ID;

    if (liffId) {
      try {
        await liff.init({ liffId });

        if (liff.isLoggedIn()) {
          const profile = await liff.getProfile();
          const token = liff.getIDToken();

          setRealUserId(profile.userId);
          setUserId(profile.userId);
          setDisplayName(profile.displayName || "");
          setPictureUrl(profile.pictureUrl || "");
          setIdToken(token || "");

          const adminStatus = await checkIsAdmin(profile.userId);
          setIsAdmin(adminStatus);
          setIsAuthLoading(false);
          return;
        } else {
          // If inside LINE app or opened via LIFF URL, trigger login flow
          if (liff.isInClient()) {
            liff.login();
            return;
          } else {
            // Opened in external browser with configured LIFF ID
            liff.login();
            return;
          }
        }
      } catch (err) {
        console.error("LIFF initialization error:", err);
      }
    } else {
      console.warn("NEXT_PUBLIC_LIFF_ID is not defined in environment variables. Falling back to default test profile.");
    }

    // Fallback for local development or testing without LIFF ID / outside LINE browser
    const fallbackUserId = "U2cd360ba05fa93c6907ca768afb9a458";
    setRealUserId(fallbackUserId);
    setUserId(fallbackUserId);
    setDisplayName("คุณทรัพย์สำราญ");
    setPictureUrl("");

    try {
      const adminStatus = await checkIsAdmin(fallbackUserId);
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
      idToken,
      isAdmin,
      impersonatedCustomer,
      isAuthLoading,
      switchToCustomer,
      resetToSelf,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;