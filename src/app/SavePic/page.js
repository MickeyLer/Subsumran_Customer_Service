import React, { Suspense } from 'react';
import Pic from '../../savepic';

export const dynamic = 'force-dynamic';

export default function SavePicPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-sans">กำลังโหลด...</div>}>
      <Pic />
    </Suspense>
  );
}
