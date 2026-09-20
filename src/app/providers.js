"use client";

import React from 'react';
import AuthProvider from '../linelogin';
import DataProvider from '../DataContext';

export default function Providers({ children }) {
  return (
    <AuthProvider>
      <DataProvider>
        {children}
      </DataProvider>
    </AuthProvider>
  );
}
