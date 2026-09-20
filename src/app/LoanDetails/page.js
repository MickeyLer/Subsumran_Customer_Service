import React, { Suspense } from 'react';
import LoanDetails from '../../LoanDetails';

export const dynamic = 'force-dynamic';

export default function LoanDetailsPage() {
  return (
    <Suspense 
      fallback={
        <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-md">
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg shadow-sm flex flex-col items-center justify-center py-10 px-8 gap-sm">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary/20 border-t-primary mb-2" />
            <p className="text-label-md font-bold text-primary font-sans">กำลังโหลดรายละเอียดสินเชื่อ...</p>
            <p className="text-xs text-on-surface-variant font-sans">กรุณารอสักครู่ ระบบกำลังดึงข้อมูล</p>
          </div>
        </div>
      }
    >
      <LoanDetails />
    </Suspense>
  );
}
