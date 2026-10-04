"use client";

import React from 'react';
import AuthProvider from '../linelogin';
import DataProvider from '../DataContext';
import ScrollToTop from '../components/ScrollToTop';

export default function Providers({ children }) {
  return (
    <AuthProvider>
      <DataProvider>
        <ScrollToTop />
        {children}
      </DataProvider>
    </AuthProvider>
  );
}
