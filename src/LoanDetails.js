"use client";

import React, { useContext } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { DataContext } from './DataContext';
import { ChevronLeft, Receipt, CheckCircle, Clock, AlertTriangle, ArrowRight, TrendingUp } from 'lucide-react';
import { DateTime } from 'luxon';
import { getContractProgression } from './utils/installmentProgression';

function LoanDetails() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const contractId = searchParams.get('contractId');
  
  const { dataContact, dataInterest } = useContext(DataContext);

  // Fallback if accessed without state
  if (!contractId) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-md">
        <p className="text-on-surface-variant font-sans font-medium mb-md">ไม่พบข้อมูลสัญญา</p>
        <button 
          onClick={() => router.push('/')} 
          className="bg-primary text-white font-bold px-lg py-2.5 rounded-lg active:scale-95 transition-all shadow-md"
        >
          กลับหน้าหลัก
        </button>
      </div>
    );
  }

  // Find current contract details
  const contract = dataContact ? dataContact.find(c => c.ID_contact === contractId) : null;

  // Filter installments for this contract
  const installments = dataInterest ? dataInterest.filter(row => row.Id_contact === contractId) : [];
  
  const {
    paidInstallments,
    nextInstallment: nextPayment,
    nextFee,
    nextPayTotal,
    paidCount,
    totalCount,
    progressPercent
  } = getContractProgression(contract, installments);

  // Helper: Format Thai Date
  const formatThaiDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const months = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear() + 543}`;
  };

  const handlePay = () => {
    router.push(`/Pay?IDcontact=${encodeURIComponent(contractId)}`);
  };

  return (
    <div className="min-h-screen bg-surface pb-24 selection:bg-secondary-fixed selection:text-primary">
      {/* Header App Bar */}
      <header className="fixed top-0 left-0 w-full h-16 bg-primary border-b-2 border-secondary-fixed shadow-md z-50 flex items-center px-margin-mobile gap-base">
        <button 
          onClick={() => router.push('/')} 
          className="text-secondary-fixed hover:scale-105 active:scale-95 transition-transform flex items-center w-11 h-11 justify-center rounded-full hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-fixed/50"
          aria-label="ย้อนกลับ"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-headline-sm font-bold text-secondary-fixed leading-none tracking-tight">รายละเอียดสินเชื่อ</h1>
      </header>

      {/* Main Content Area */}
      <main className="mt-20 w-full max-w-[600px] mx-auto px-gutter py-md flex flex-col gap-lg animate-fade-in">
        
        {/* Loading State */}
        {!contract ? (
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg shadow-sm flex flex-col items-center justify-center py-12 gap-sm">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary/20 border-t-primary mb-2"></div>
            <p className="text-label-md font-bold text-primary font-sans">กำลังโหลดรายละเอียดสินเชื่อ...</p>
            <p className="text-xs text-on-surface-variant font-sans">กรุณารอสักครู่ ระบบกำลังดึงข้อมูลสัญญาจากฐานข้อมูล</p>
          </div>
        ) : (
          <>
            {/* 1. Basic Contract Info Card */}
            <div className="bg-surface-container-lowest rounded-xl shadow-md border border-outline-variant overflow-hidden">
              <div className="bg-primary/5 border-b border-outline-variant/30 p-md flex items-center gap-sm">
                <span className="material-symbols-outlined text-primary text-[24px]">receipt_long</span>
                <div>
                  <p className="text-[11px] text-outline font-semibold font-sans tracking-wider">เลขที่สัญญา</p>
                  <h3 className="text-body-lg font-black text-primary font-mono">{contract.ID_contact}</h3>
                </div>
              </div>
              
              <div className="p-md flex flex-col gap-md font-sans">
                {/* Borrower / Guarantor Row */}
                <div className="grid grid-cols-2 gap-md">
                  <div>
                    <p className="text-label-sm text-on-surface-variant font-medium">ชื่อผู้กู้</p>
                    <p className="text-body-md font-bold text-primary mt-xs">{contract.Name_loan}</p>
                  </div>
                  <div>
                    <p className="text-label-sm text-on-surface-variant font-medium">ผู้ค้ำประกัน</p>
                    <p className="text-body-md font-bold text-primary mt-xs">{contract.name_claim || '-'}</p>
                  </div>
                </div>

                <hr className="border-outline-variant/30" />

                {/* Primary Financial Data Grid */}
                <div className="grid grid-cols-2 gap-sm">
                  <div className="bg-surface border border-outline-variant/50 p-sm rounded-lg flex flex-col justify-between">
                    <span className="text-[11px] text-on-surface-variant">ยอดวงเงินกู้ทั้งหมด</span>
                    <span className="text-body-lg font-extrabold text-primary mt-xs">{contract.total_loan?.toLocaleString()} ฿</span>
                  </div>
                  <div className="bg-secondary-container/10 border border-secondary-fixed/50 p-sm rounded-lg flex flex-col justify-between">
                    <span className="text-[11px] text-primary font-medium">ค่างวดต่อเดือน</span>
                    <span className="text-body-lg font-extrabold text-primary mt-xs">{contract.paypermonth?.toLocaleString()} ฿</span>
                  </div>
                </div>

                {/* Address Section */}
                <div className="bg-surface border border-outline-variant/50 p-sm rounded-lg">
                  <p className="text-label-sm text-on-surface-variant font-medium">ที่อยู่ในการจัดส่งเอกสาร</p>
                  <p className="text-[13px] text-on-surface mt-xs leading-relaxed">{contract.add_loan || 'ไม่ระบุที่อยู่'}</p>
                </div>
              </div>
            </div>

            {/* 2. Progression Card */}
            <div className="bg-surface-container-lowest rounded-xl shadow-md border border-outline-variant p-md flex flex-col gap-md">
              <div className="flex justify-between items-center">
                <h4 className="text-label-lg font-extrabold text-primary font-sans flex items-center gap-xs">
                  <TrendingUp size={18} className="text-secondary" /> ความคืบหน้าการผ่อนชำระ
                </h4>
                <span className="text-headline-sm font-black text-secondary font-sans">{progressPercent}%</span>
              </div>

              {/* Progress Bar Container */}
              <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden border border-slate-200">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Installment breakdown counts */}
              <div className="grid grid-cols-2 gap-md pt-xs text-center border-b border-outline-variant/30 pb-md font-sans">
                <div className="border-r border-outline-variant/30">
                  <p className="text-label-sm text-on-surface-variant">ชำระไปแล้ว</p>
                  <p className="text-[20px] font-black text-green-600 mt-xs">{paidCount} <span className="text-body-md font-normal">งวด</span></p>
                </div>
                <div>
                  <p className="text-label-sm text-on-surface-variant font-sans">สัญญาผ่อนทั้งหมด</p>
                  <p className="text-[20px] font-black text-primary mt-xs">{totalCount} <span className="text-body-md font-normal">งวด</span></p>
                </div>
              </div>

              {/* Remaining Principal Card */}
              <div className="bg-red-50/60 border border-red-200/80 p-md rounded-xl flex flex-col items-center justify-center text-center font-sans gap-xs shadow-sm">
                <p className="text-label-sm text-red-700 font-bold tracking-wide">เงินต้นคงเหลือปัจจุบัน</p>
                <p className="text-[28px] font-black text-red-600 leading-tight my-1">
                  {contract.total_treerest?.toLocaleString()} <span className="text-body-lg font-bold">฿</span>
                </p>
                {contract.accumulate > 0 && (
                  <div className="w-full pt-xs border-t border-red-200/60 mt-xs flex items-center justify-center gap-2 text-red-700">
                    <span className="text-label-sm font-semibold">เงินสะสม/ค้างจ่าย:</span>
                    <span className="text-body-md font-bold">{contract.accumulate?.toLocaleString()} ฿</span>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Next payment status and Pay button */}
            <div className="bg-surface-container-lowest rounded-xl shadow-md border border-outline-variant p-md flex flex-col gap-sm">
              <div className="flex items-center justify-between border-b border-outline-variant/30 pb-xs">
                <h4 className="text-label-lg font-bold text-primary font-sans flex items-center gap-xs">
                  <span className="material-symbols-outlined text-[18px]">calendar_month</span> ข้อมูลค่างวดงวดถัดไป
                </h4>
                {nextPayment ? (
                  <span className="bg-error-container text-on-error-container px-sm py-0.5 rounded-full text-[10px] font-bold font-sans">รอดำเนินการ</span>
                ) : (
                  <span className="bg-green-100 text-green-700 px-sm py-0.5 rounded-full text-[10px] font-bold font-sans">จ่ายครบถ้วนแล้ว</span>
                )}
              </div>

              <div className="flex items-center justify-between font-sans py-xs">
                {nextPayment ? (
                  <>
                    <div>
                      <p className="text-label-sm text-on-surface-variant">กำหนดชำระงวดถัดไป:</p>
                      <p className="text-body-lg font-bold text-primary leading-tight mt-xs">
                        {formatThaiDate(nextPayment.begin_date)}
                      </p>
                      <p className="text-xs text-outline font-semibold font-mono mt-xs">งวดที่ {nextPayment.number_pay}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-label-sm text-on-surface-variant">ยอดที่ต้องชำระ:</p>
                      <p className="text-headline-sm font-black text-primary leading-none mt-xs">
                        {nextPayTotal.toLocaleString()} <span className="text-body-md font-normal">฿</span>
                      </p>
                      {nextFee > 0 && (
                        <p className="text-[11px] font-bold text-red-600 mt-1 font-sans">
                          (รวมค่าปรับ {nextFee.toLocaleString()} ฿)
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-sm py-xs w-full justify-center text-green-600 font-bold">
                    <CheckCircle size={24} /> สัญญานี้ได้รับการชำระยอดเงินต้นครบถ้วนดีเยี่ยมแล้ว
                  </div>
                )}
              </div>

              {nextPayment && (
                <div className="mt-sm">
                  <button 
                    onClick={handlePay}
                    className="w-full bg-primary text-white hover:bg-primary-container text-body-md font-bold py-3.5 rounded-lg active:scale-95 transition-all shadow-md flex items-center justify-center gap-xs font-sans"
                  >
                    ชำระเงินตอนนี้ <span className="material-symbols-outlined text-[18px]">payments</span>
                  </button>
                </div>
              )}
            </div>

            {/* 4. Payment History Card */}
            <div className="bg-surface-container-lowest rounded-xl shadow-md border border-outline-variant overflow-hidden flex flex-col">
              <div className="bg-slate-50 border-b border-outline-variant/30 p-md flex items-center gap-xs">
                <Receipt size={18} className="text-primary" />
                <h4 className="text-label-lg font-extrabold text-primary font-sans">ประวัติการชำระเงิน</h4>
              </div>

              {paidInstallments.length === 0 ? (
                <div className="p-lg text-center text-on-surface-variant font-sans text-sm">
                  ยังไม่มีประวัติการชำระเงินที่สมบูรณ์ในระบบ
                </div>
              ) : (
                <div className="divide-y divide-outline-variant/10 font-sans max-h-[300px] overflow-y-auto">
                  {paidInstallments.map((item, idx) => {
                    const totalPaid = Number(item.paytree || 0) + Number(item.payinter || 0) + Number(item.payfee2 || 0) + Number(item.payfee3 || 0) - Number(item.dis_fee2 || 0) - Number(item.dis_fee3 || 0) + Number(item.accu || 0);
                    return (
                      <div key={idx} className="p-md flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div>
                          <div className="flex items-center gap-xs">
                            <span className="w-5 h-5 rounded-full bg-green-100 text-green-800 text-[10px] font-bold flex items-center justify-center">
                              {item.number_pay}
                            </span>
                            <span className="font-bold text-primary text-body-md">งวดที่ {item.number_pay}</span>
                          </div>
                          <p className="text-[11px] text-outline font-medium mt-0.5">
                            ชำระวันที่: {item.pay_date ? formatThaiDate(item.pay_date) : '-'}
                          </p>
                        </div>

                        <div className="flex items-center gap-md">
                          <div className="text-right">
                            <p className="text-body-md font-bold text-primary">
                              {totalPaid.toLocaleString()} ฿
                            </p>
                            <p className="text-[10px] text-outline font-medium">เงินต้น: {item.paytree?.toLocaleString()} ฿</p>
                          </div>
                          
                          {item.reference ? (
                            <button
                              onClick={() => router.push(`/Invoice?invoiceID=${encodeURIComponent(item.reference)}&from=loandetail&contractId=${encodeURIComponent(contractId)}`)}
                              className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-secondary hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 shrink-0"
                              title="ดูใบเสร็จ"
                              aria-label={`ดูใบเสร็จงวดที่ ${item.number_pay}`}
                            >
                              <ArrowRight size={18} />
                            </button>
                          ) : (
                            <span className="w-11" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default LoanDetails;
