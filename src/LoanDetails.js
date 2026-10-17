"use client";

import React, { useContext, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { DataContext } from './DataContext';
import { fetchContactById, fetchInterestByContact } from './services/api';
import { 
  ChevronLeft, 
  Receipt, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  ArrowRight, 
  TrendingUp,
  Calculator,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Info,
  Sparkles,
  Building2
} from 'lucide-react';
import { DateTime } from 'luxon';
import { getContractProgression, formatThaiDate } from './utils/installmentProgression';
import { getCollateralTypeInfo, parseCollateralDetails } from './utils/collateralType';

function LoanDetails() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const contractId = searchParams.get('contractId');
  
  const { dataContact, dataInterest, loadContractData } = useContext(DataContext) || {};

  const [directContract, setDirectContract] = useState(null);
  const [directInstallments, setDirectInstallments] = useState([]);
  const [isDirectLoading, setIsDirectLoading] = useState(true);

  useEffect(() => {
    if (!contractId) {
      setIsDirectLoading(false);
      return;
    }

    let isMounted = true;
    setIsDirectLoading(true);

    Promise.all([
      fetchContactById(contractId),
      fetchInterestByContact(contractId),
    ]).then(([cData, iData]) => {
      if (isMounted) {
        setDirectContract(cData);
        setDirectInstallments(iData || []);
        setIsDirectLoading(false);
      }
    }).catch(err => {
      console.error("Error fetching targeted loan details:", err);
      if (isMounted) setIsDirectLoading(false);
    });

    if (loadContractData) {
      loadContractData(contractId);
    }

    return () => { isMounted = false; };
  }, [contractId, loadContractData]);

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

  // Find current contract details (prefer direct targeted data)
  const contract = directContract || (dataContact ? dataContact.find(c => c.ID_contact === contractId) : null);

  // Filter installments for this contract (prefer direct targeted data)
  const installments = directInstallments.length > 0 
    ? directInstallments 
    : (dataInterest ? dataInterest.filter(row => row.Id_contact === contractId) : []);
  
  const {
    paidInstallments,
    nextInstallment: nextPayment,
    nextFee,
    nextPayTotal,
    paidCount,
    totalCount,
    progressPercent,
    payoffDetails,
  } = getContractProgression(contract, installments);

  const collateral = getCollateralTypeInfo(contract?.Claimthing);
  const collateralList = parseCollateralDetails(contract?.Claimdetail, contract?.name_claim);

  const [isNavigatingPay, setIsNavigatingPay] = useState(false);
  const [isPayoffExpanded, setIsPayoffExpanded] = useState(false);

  const handlePay = () => {
    setIsNavigatingPay(true);
    router.push(`/Pay?IDcontact=${encodeURIComponent(contractId)}`);
  };

  return (
    <div className="min-h-screen bg-surface pb-24 selection:bg-secondary-fixed selection:text-primary">
      {/* Header App Bar */}
      <header className="fixed top-0 left-0 w-full h-16 bg-primary border-b-2 border-secondary-fixed shadow-md z-50 flex items-center px-margin-mobile gap-base">
        <button 
          onClick={() => {
            if (typeof window !== 'undefined') window.scrollTo(0, 0);
            router.push('/');
          }} 
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
              <div className="bg-primary/5 border-b border-outline-variant/30 p-md flex items-center justify-between gap-2">
                <div className="flex items-center gap-sm">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${collateral.iconContainerClass}`}>
                    <span className="material-symbols-outlined text-[22px]">{collateral.icon}</span>
                  </div>
                  <div>
                    <p className="text-[11px] text-outline font-semibold font-sans tracking-wider">เลขที่สัญญา</p>
                    <h3 className="text-body-lg font-black text-primary font-mono">{contract.ID_contact}</h3>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${collateral.badgeClass}`}>
                  <span className="material-symbols-outlined text-[14px]">{collateral.icon}</span>
                  {collateral.fullLabel}
                </span>
              </div>
              
              <div className="p-md flex flex-col gap-md font-sans">
                {/* Borrower / Guarantor Row */}
                <div className="grid grid-cols-2 gap-md">
                  <div>
                    <p className="text-label-sm text-on-surface-variant font-medium">ชื่อผู้กู้</p>
                    <p className="text-body-md font-bold text-primary mt-xs">{contract.Name_loan}</p>
                  </div>
                  <div>
                    <p className="text-label-sm text-on-surface-variant font-medium">
                      {contract.Claimthing === 'บุคคล' ? 'ผู้ค้ำประกัน' : 'หลักค้ำประกัน'}
                    </p>
                    <p className="text-body-md font-bold text-primary mt-xs">
                      {contract.Claimthing === 'บุคคล' ? (contract.name_claim || '-') : collateral.label}
                    </p>
                  </div>
                </div>

                {collateralList.length > 0 && (
                  <div className="bg-surface border border-outline-variant/50 p-sm rounded-lg flex flex-col gap-1.5">
                    <p className="text-label-sm text-on-surface-variant font-medium flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px]">{collateral.icon}</span>
                      <span>
                        {contract.Claimthing === 'บุคคล'
                          ? 'รายละเอียดผู้ค้ำประกัน'
                          : `รายละเอียดหลักค้ำประกัน (${collateral.label})`}
                      </span>
                    </p>
                    <div className="flex flex-col gap-2">
                      {collateralList.map((item, idx) => (
                        <div key={idx} className="text-[13px] text-on-surface leading-relaxed">
                          {collateralList.length > 1 && (
                            <span className="font-semibold text-primary mr-1">
                              {item.type ? `[${item.type}]` : `รายการที่ ${idx + 1}:`}
                            </span>
                          )}
                          <span>{item.details}</span>
                          {item.coordinates && (
                            <div className="mt-1">
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${Array.isArray(item.coordinates) ? item.coordinates.join(',') : item.coordinates}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 hover:underline font-medium"
                              >
                                <span className="material-symbols-outlined text-[13px]">location_on</span>
                                ดูตำแหน่งบนแผนที่ Google Maps
                              </a>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}


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
                    disabled={isNavigatingPay}
                    className={`w-full text-body-md font-bold py-3.5 rounded-lg transition-all shadow-md flex items-center justify-center gap-xs font-sans ${
                      isNavigatingPay 
                        ? 'bg-primary/70 text-white cursor-not-allowed' 
                        : 'bg-primary text-white hover:bg-primary-container active:scale-95'
                    }`}
                  >
                    {isNavigatingPay ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>กำลังไปหน้าชำระเงิน...</span>
                      </>
                    ) : (
                      <>
                        ชำระเงินตอนนี้ <span className="material-symbols-outlined text-[18px]">payments</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* 4. Loan Payoff / Settlement Card (ยอดปิดบัญชี) */}
            {payoffDetails?.isClosed || Number(contract.total_treerest || 0) <= 0 ? (
              <div className="bg-surface-container-lowest rounded-xl shadow-md border border-emerald-300/80 overflow-hidden font-sans">
                <div className="bg-emerald-500/10 border-b border-emerald-200/60 p-md flex items-center justify-between">
                  <div className="flex items-center gap-sm">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-300">
                      <ShieldCheck size={22} className="stroke-[2.5]" />
                    </div>
                    <div>
                      <h4 className="text-body-lg font-extrabold text-slate-900 font-sans">สถานะการปิดบัญชี</h4>
                      <p className="text-[11px] text-emerald-700 font-medium font-sans">ชำระหนี้ครบถ้วนสมบูรณ์แล้ว</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <CheckCircle size={14} /> ปิดบัญชีแล้ว
                  </span>
                </div>
                <div className="p-md sm:p-lg flex flex-col items-center justify-center text-center gap-xs">
                  <p className="text-xs text-on-surface-variant font-medium">ยอดหนี้ปิดบัญชีคงเหลือ</p>
                  <p className="text-3xl font-black text-emerald-600 font-mono my-1">
                    0 <span className="text-body-lg font-bold">฿</span>
                  </p>
                  <p className="text-xs text-slate-600 max-w-sm mt-1 leading-relaxed">
                    สัญญานี้ได้รับการชำระยอดเงินต้นและดอกเบี้ยครบถ้วนเรียบร้อยแล้ว ไม่มีภาระหนี้ผูกพันเพิ่มเติม ขอขอบพระคุณที่ไว้วางใจใช้บริการ
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-surface-container-lowest rounded-xl shadow-md border border-emerald-500/30 overflow-hidden relative font-sans">
                {/* Decorative gradient top edge */}
                <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-primary" />

                <div className="p-md flex flex-col gap-md">
                  {/* Header Row */}
                  <div className="flex items-start justify-between gap-2 border-b border-outline-variant/30 pb-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
                        <Calculator size={20} className="stroke-[2.5]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-body-lg font-black text-slate-900 font-sans tracking-tight">
                            ยอดปิดบัญชี (ชำระหนี้ทั้งหมด)
                          </h4>
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <Sparkles size={11} /> ปิดสัญญาวันนี้
                          </span>
                        </div>
                        <p className="text-[11px] text-on-surface-variant font-medium mt-0.5 flex items-center gap-1">
                          <Clock size={12} className="text-slate-400" />
                          <span>คำนวณ ณ วันที่ {payoffDetails.calcDateFormatted}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Hero Payoff Amount Box */}
                  <div className="bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/40 rounded-xl p-md border border-emerald-200/70 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800/80">
                        ยอดสุทธิที่ต้องชำระเพื่อปิดบัญชี
                      </span>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-3xl sm:text-4xl font-black text-emerald-700 tracking-tight font-mono">
                          {payoffDetails.totalPayoff.toLocaleString()}
                        </span>
                        <span className="text-body-lg font-bold text-emerald-800">บาท</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        เงินต้นคงเหลือ {payoffDetails.principal.toLocaleString()} ฿ + ดอกเบี้ยตามจริง {payoffDetails.days} วัน ({payoffDetails.normalInterest.toLocaleString()} ฿)
                        {(payoffDetails.lateInterest > 0 || payoffDetails.collectionFee > 0 || payoffDetails.accumulate > 0) && ' + ค่าปรับ/ทวงถาม/ค้างสะสม'}
                      </p>
                    </div>

                    {/* Notice Badge: Close account at company office only */}
                    <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-amber-50/90 border border-amber-200/80 text-amber-900 self-start sm:self-auto shrink-0 shadow-xs font-sans">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800 shrink-0">
                        <Building2 size={18} />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-extrabold text-amber-900 leading-tight">ติดต่อปิดบัญชีที่บริษัทเท่านั้น</p>
                        <p className="text-[10px] text-amber-700 font-medium mt-0.5">ชำระและรับเอกสารสัญญา/หลักประกันคืน ณ สาขา</p>
                      </div>
                    </div>
                  </div>

                  {/* Accordion Toggle for Detailed Calculation Breakdown */}
                  <div className="border border-outline-variant/40 rounded-lg overflow-hidden bg-slate-50/60">
                    <button
                      type="button"
                      onClick={() => setIsPayoffExpanded(!isPayoffExpanded)}
                      className="w-full px-md py-2.5 flex items-center justify-between text-left hover:bg-slate-100/70 transition-colors cursor-pointer"
                      aria-expanded={isPayoffExpanded}
                    >
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Info size={14} className="text-primary" />
                        <span>ดูรายละเอียดสูตรและการคำนวณยอดปิดบัญชี</span>
                      </span>
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-primary">
                        <span>{isPayoffExpanded ? 'ซ่อน' : 'แสดงรายละเอียด'}</span>
                        {isPayoffExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </button>

                    {isPayoffExpanded && (
                      <div className="p-md pt-xs border-t border-outline-variant/30 flex flex-col gap-2 bg-white text-body-md">
                        <div className="flex justify-between items-center text-xs py-1 border-b border-dashed border-slate-200">
                          <span className="text-slate-600">1. เงินต้นคงเหลือจริง (Remaining Principal)</span>
                          <span className="font-bold text-slate-900 font-mono">{payoffDetails.principal.toLocaleString()} ฿</span>
                        </div>

                        <div className="flex justify-between items-start text-xs py-1 border-b border-dashed border-slate-200">
                          <div>
                            <span className="text-slate-600">2. ดอกเบี้ยตามวันที่ใช้งานจริง (Accrued Interest)</span>
                            <p className="text-[10px] text-slate-500">
                              {payoffDetails.isInterestLoan
                                ? 'สัญญารูปแบบดอกเบี้ยรายงวด'
                                : `คิดตามจริง ${payoffDetails.days} วัน (@ อัตรา ${payoffDetails.annualRate}% ต่อปี)`}
                            </p>
                          </div>
                          <span className="font-bold text-slate-900 font-mono shrink-0">
                            {payoffDetails.normalInterest.toLocaleString()} ฿
                          </span>
                        </div>

                        {payoffDetails.lateInterest > 0 && (
                          <div className="flex justify-between items-center text-xs py-1 border-b border-dashed border-slate-200 text-red-600">
                            <span>3. ดอกเบี้ยปรับชำระล่าช้า (Default Interest)</span>
                            <span className="font-bold font-mono">+{payoffDetails.lateInterest.toLocaleString()} ฿</span>
                          </div>
                        )}

                        {payoffDetails.collectionFee > 0 && (
                          <div className="flex justify-between items-center text-xs py-1 border-b border-dashed border-slate-200 text-red-600">
                            <span>4. ค่าธรรมเนียมทวงถามหนี้ (Collection Fee)</span>
                            <span className="font-bold font-mono">+{payoffDetails.collectionFee.toLocaleString()} ฿</span>
                          </div>
                        )}

                        {payoffDetails.accumulate > 0 && (
                          <div className="flex justify-between items-center text-xs py-1 border-b border-dashed border-slate-200 text-amber-700">
                            <span>5. ยอดค้างสะสมเดิม (Accumulated Debt)</span>
                            <span className="font-bold font-mono">+{payoffDetails.accumulate.toLocaleString()} ฿</span>
                          </div>
                        )}

                        <div className="flex justify-between items-center text-xs pt-1.5 font-bold text-emerald-800 bg-emerald-50/80 p-2 rounded-md">
                          <span>รวมยอดปิดบัญชีทั้งสิ้น ณ วันนี้</span>
                          <span className="text-sm font-black text-emerald-700 font-mono">
                            {payoffDetails.totalPayoff.toLocaleString()} ฿
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-600 leading-relaxed bg-amber-50/80 border border-amber-200/80 p-3 rounded-lg flex items-start gap-2 mt-1 font-sans">
                          <Building2 size={16} className="text-amber-700 shrink-0 mt-0.5" />
                          <div className="flex flex-col gap-1">
                            <span className="font-bold text-amber-900">
                              เงื่อนไขและช่องทางการปิดบัญชี:
                            </span>
                            <span className="text-[11px] text-slate-600 leading-relaxed">
                              ยอดปิดบัญชีข้างต้นเป็นการคำนวณเบื้องต้นตามเงินต้นคงเหลือและดอกเบี้ยรายวันถึงวันที่ {payoffDetails.calcDateFormatted} หากท่านประสงค์จะปิดยอดสัญญา <strong>กรุณาติดต่อดำเนินการด้วยตนเองที่สำนักงานบริษัทเท่านั้น</strong> เพื่อตรวจสอบยอดสุทธิ ชำระเงิน และดำเนินการรับเอกสารสัญญาและหลักประกันตัวจริงคืน
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 5. Payment History Card */}
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
                    const fee2Net = Number(item.payfee2 || 0) > 0 ? Number(item.payfee2 || 0) - Number(item.dis_fee2 || 0) : 0;
                    const fee3Net = Number(item.payfee3 || 0) > 0 ? Number(item.payfee3 || 0) - Number(item.dis_fee3 || 0) : 0;
                    const totalPaid = Math.round(
                      Number(item.paytree || 0) + 
                      Number(item.payinter || 0) + 
                      fee2Net + 
                      fee3Net + 
                      Number(item.accu || 0)
                    );
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
