"use client";

import React, { useState, useMemo, useEffect } from 'react';
import Swal from 'sweetalert2';

/**
 * PMT Loan Calculation Formula (Reducing Balance with equal monthly installment)
 * Matches Subsumran Pico Finance standard contract table calculation:
 * e.g., 50,000 THB at 36% p.a. for 36 months = 2,290 THB/month.
 */
export function calculatePMT(principal, annualRatePercent, months) {
  const p = Number(principal) || 0;
  const n = Number(months) || 1;
  const annualRate = Number(annualRatePercent) || 36;
  const r = (annualRate / 100) / 12;

  if (p <= 0 || n <= 0) {
    return { monthly: 0, totalPayment: 0, totalInterest: 0 };
  }

  if (r === 0) {
    const monthly = Math.round(p / n);
    return { monthly, totalPayment: monthly * n, totalInterest: 0 };
  }

  const factor = Math.pow(1 + r, n);
  const monthly = Math.round((p * r * factor) / (factor - 1));
  const totalPayment = monthly * n;
  const totalInterest = Math.max(0, totalPayment - p);

  return { monthly, totalPayment, totalInterest };
}

const COLLATERAL_OPTIONS = [
  { id: 'ที่ดิน', label: 'โฉนดที่ดิน', icon: 'landscape' },
  { id: 'รถยนต์', label: 'รถยนต์', icon: 'directions_car' },
  { id: 'รถจักรยานยนต์', label: 'รถมอเตอร์ไซค์', icon: 'two_wheeler' },
  { id: 'บุคคล', label: 'บุคคลค้ำประกัน', icon: 'groups' },
  { id: 'อื่นๆ', label: 'อื่นๆ / ทรัพย์สิน', icon: 'inventory_2' },
];

const PRESET_AMOUNTS = [10000, 20000, 30000, 50000, 100000];
const PRESET_MONTHS = [6, 12, 18, 24, 36];

export default function LoanCalculator({
  initialAmount = 50000,
  initialMonths = 36,
  userName = '',
  lineUserId = '',
  lineDisplayName = '',
  linePictureUrl = '',
  onClose = () => {},
}) {
  // Tabs: 'calculator' | 'info'
  const [activeTab, setActiveTab] = useState('calculator');

  // Calculator State
  const [loanAmount, setLoanAmount] = useState(initialAmount);
  const [months, setMonths] = useState(initialMonths);
  const interestRate = 36; // 36% per year (Pico Finance standard)

  // Form State (Phone always starts empty for user to input manually)
  const [customerName, setCustomerName] = useState(userName || '');
  const [phone, setPhone] = useState('');
  const [collateral, setCollateral] = useState('ที่ดิน');
  const [collateralDetail, setCollateralDetail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showApplyForm, setShowApplyForm] = useState(true);

  // Sync initial user name if logged in
  useEffect(() => {
    if (userName && !customerName) setCustomerName(userName);
  }, [userName]);

  // Real-time calculation
  const calculation = useMemo(() => {
    return calculatePMT(loanAmount, interestRate, months);
  }, [loanAmount, months, interestRate]);

  // Handle amount change from input
  const handleAmountInput = (e) => {
    const rawVal = e.target.value.replace(/[^0-9]/g, '');
    const num = rawVal ? Math.min(100000, Math.max(0, parseInt(rawVal, 10))) : 0;
    setLoanAmount(num);
  };

  // Submit loan inquiry to backend API -> sends to LINE Group & Supabase
  const handleSubmitInquiry = async (e) => {
    e.preventDefault();

    const trimmedName = customerName.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) {
      Swal.fire({
        icon: 'warning',
        title: 'กรุณากรอกชื่อ-นามสกุล',
        text: 'โปรดระบุชื่อของท่านเพื่อให้เจ้าหน้าที่ตรวจสอบและติดต่อกลับ',
        confirmButtonColor: '#d83a78',
      });
      return;
    }

    if (!trimmedPhone || trimmedPhone.length < 9) {
      Swal.fire({
        icon: 'warning',
        title: 'กรุณากรอกเบอร์โทรศัพท์',
        text: 'โปรดระบุเบอร์โทรศัพท์ที่ถูกต้องอย่างน้อย 9-10 หลัก',
        confirmButtonColor: '#d83a78',
      });
      return;
    }

    if (!loanAmount || loanAmount < 1000) {
      Swal.fire({
        icon: 'warning',
        title: 'กรุณาระบุยอดเงินกู้',
        text: 'ยอดเงินกู้ขั้นต่ำคือ 1,000 บาท',
        confirmButtonColor: '#d83a78',
      });
      return;
    }

    // Confirmation dialog before sending
    const confirmResult = await Swal.fire({
      title: 'ยืนยันส่งข้อมูลให้เจ้าหน้าที่?',
      html: `
        <div class="text-left text-sm space-y-1.5 p-3 bg-slate-50 rounded-lg border border-slate-200 mt-2 font-sans">
          <p><strong>ชื่อผู้สนใจ:</strong> ${trimmedName}</p>
          <p><strong>เบอร์โทร:</strong> ${trimmedPhone}</p>
          <p><strong>ยอดเงินที่ต้องการ:</strong> ${loanAmount.toLocaleString()} บาท</p>
          <p><strong>จำนวนงวด:</strong> ${months} งวด (${months} เดือน)</p>
          <p><strong>ค่างวดประมาณการ:</strong> <span class="text-rose-600 font-bold">${calculation.monthly.toLocaleString()}</span> บาท/เดือน</p>
          <p><strong>สิ่งค้ำประกัน:</strong> ${collateral} ${collateralDetail ? `(${collateralDetail})` : ''}</p>
        </div>
        <p class="text-xs text-slate-500 mt-3 font-sans">ระบบจะส่งข้อมูลแจ้งเตือนไปยังกลุ่ม LINE เจ้าหน้าที่ เพื่อติดต่อกลับหาท่านทันที</p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#16a34a',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'ยืนยันส่งข้อมูล',
      cancelButtonText: 'แก้ไขข้อมูล',
      reverseButtons: true,
    });

    if (!confirmResult.isConfirmed) return;

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/loanInquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: trimmedName,
          phone: trimmedPhone,
          collateral: collateral,
          collateralDetail: collateralDetail.trim(),
          loanAmount: loanAmount,
          months: months,
          interestRate: interestRate,
          monthlyInstallment: calculation.monthly,
          totalPayment: calculation.totalPayment,
          lineUserId: lineUserId || '',
          lineDisplayName: lineDisplayName || '',
          linePictureUrl: linePictureUrl || '',
        }),
      });

      const resData = await response.json();

      if (!response.ok || !resData.success) {
        throw new Error(resData?.error || 'ไม่สามารถส่งข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
      }

      await Swal.fire({
        icon: 'success',
        title: 'ส่งข้อมูลเรียบร้อยแล้ว!',
        html: `
          <div class="font-sans text-sm space-y-2">
            <p class="text-slate-700">เจ้าหน้าที่ได้รับข้อมูลความสนใจสินเชื่อของคุณ <strong>${trimmedName}</strong> เรียบร้อยแล้ว</p>
            <div class="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-800 text-xs">
              💬 ส่งแจ้งเตือนเข้ากลุ่มเจ้าหน้าที่แล้ว เจ้าหน้าที่จะติดต่อกลับผ่านเบอร์ <strong>${trimmedPhone}</strong> หรือ LINE โดยเร็วที่สุดครับ
            </div>
          </div>
        `,
        confirmButtonColor: '#d83a78',
        confirmButtonText: 'ตกลง',
      });

      onClose();
    } catch (err) {
      console.error('Error submitting loan inquiry:', err);
      Swal.fire({
        icon: 'error',
        title: 'ส่งข้อมูลไม่สำเร็จ',
        text: err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง หรือโทรติดต่อเจ้าหน้าที่โดยตรง',
        confirmButtonColor: '#d83a78',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 font-sans text-slate-800">
      {/* Tab Switcher: Calculator vs Product Info */}
      <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('calculator')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'calculator'
              ? 'bg-white text-primary shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">calculate</span>
          คำนวณค่างวดและยื่นกู้
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('info')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'info'
              ? 'bg-white text-primary shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">info</span>
          ประเภทสินเชื่อ
        </button>
      </div>

      {activeTab === 'info' ? (
        /* PRODUCT INFO TAB (Legacy Cards from screenshot) */
        <div className="flex flex-col gap-3">
          <div className="border border-outline-variant rounded-xl p-4 bg-white flex flex-col gap-2 relative overflow-hidden shadow-xs">
            <div className="absolute top-0 right-0 bg-primary text-secondary-fixed px-3 py-1 rounded-bl-xl text-[10px] font-bold font-sans">
              Pico Finance
            </div>
            <h4 className="text-sm font-bold text-primary">สินเชื่ออเนกประสงค์ ทรัพย์สำราญ</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              สินเชื่อสำหรับบุคคลทั่วไปเพื่อเสริมสภาพคล่องทางการเงิน ดอกเบี้ยลดต้นลดดอกสูงสุดไม่เกิน 3% ต่อเดือน (36% ต่อปี) อนุมัติง่ายในพื้นที่
            </p>
            <div className="mt-2 flex justify-between items-center pt-2 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-700">วงเงินกู้สูงสุด 50,000 บาท</span>
              <a
                href="tel:0642201381"
                className="bg-primary hover:bg-[#ba2660] text-white text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95 shadow-xs transition-all flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">call</span>
                โทรปรึกษา
              </a>
            </div>
          </div>

          <div className="border border-outline-variant rounded-xl p-4 bg-white flex flex-col gap-2 relative overflow-hidden shadow-xs">
            <div className="absolute top-0 right-0 bg-primary text-secondary-fixed px-3 py-1 rounded-bl-xl text-[10px] font-bold font-sans">
              Nano Finance
            </div>
            <h4 className="text-sm font-bold text-primary">สินเชื่อเพื่อการค้า/แม่ค้าคนเก่ง</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              เหมาะสำหรับพ่อค้าแม่ขาย ร้านค้าปลีก ตลาดสด เพื่อนำไปใช้เป็นทุนหมุนเวียนในการซื้อวัตถุดิบและขยายร้านค้า
            </p>
            <div className="mt-2 flex justify-between items-center pt-2 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-700">วงเงินกู้สูงสุด 100,000 บาท</span>
              <a
                href="tel:0642201381"
                className="bg-primary hover:bg-[#ba2660] text-white text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95 shadow-xs transition-all flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">call</span>
                โทรปรึกษา
              </a>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('calculator')}
            className="w-full mt-1 bg-rose-50 text-primary border border-rose-200 hover:bg-rose-100 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">calculate</span>
            ไปที่เครื่องคำนวณค่างวด
          </button>
        </div>
      ) : (
        /* CALCULATOR & SUBMIT FORM TAB */
        <div className="flex flex-col gap-4">
          {/* STEP 1: CALCULATOR INPUTS */}
          <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 flex flex-col gap-3.5 shadow-xs">
            {/* 1. Loan Amount */}
            <div>
              <div className="flex justify-between items-baseline mb-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center">1</span>
                  ยอดเงินที่ต้องการกู้
                </label>
                <span className="text-xs text-slate-500 font-mono">สูงสุด 100,000 บ.</span>
              </div>

              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={loanAmount ? loanAmount.toLocaleString() : ''}
                  onChange={handleAmountInput}
                  placeholder="เช่น 50,000"
                  className="w-full pl-3 pr-12 py-2.5 rounded-xl border border-slate-300 bg-white font-mono font-bold text-base text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-inner"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 font-sans pointer-events-none">
                  บาท
                </span>
              </div>

              {/* Slider for Loan Amount */}
              <div className="mt-2.5 px-1">
                <input
                  type="range"
                  min="5000"
                  max="100000"
                  step="5000"
                  value={loanAmount || 5000}
                  onChange={(e) => setLoanAmount(Number(e.target.value))}
                  className="w-full accent-primary h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-600 font-mono mt-1 font-medium">
                  <span>5,000</span>
                  <span>50,000</span>
                  <span>100,000</span>
                </div>
              </div>

              {/* Quick Amount Chips */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {PRESET_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setLoanAmount(amt)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all border ${
                      loanAmount === amt
                        ? 'bg-primary text-white border-primary shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-primary/40'
                    }`}
                  >
                    {amt.toLocaleString()} ฿
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Number of Installments / Months */}
            <div className="pt-2 border-t border-slate-200/80">
              <div className="flex justify-between items-baseline mb-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center">2</span>
                  จำนวนงวดที่ต้องการผ่อน
                </label>
                <span className="text-xs font-bold text-primary font-mono">{months} เดือน</span>
              </div>

              {/* Quick Month Chips */}
              <div className="grid grid-cols-5 gap-1.5">
                {PRESET_MONTHS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMonths(m)}
                    className={`py-1.5 px-1 rounded-lg text-xs font-bold font-sans transition-all text-center border ${
                      months === m
                        ? 'bg-primary text-white border-primary shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-primary/40'
                    }`}
                  >
                    {m} งวด
                  </button>
                ))}
              </div>

              {/* Stepper for custom months */}
              <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3 py-1.5 mt-2">
                <span className="text-xs text-slate-600 font-medium">ปรับระยะเวลางวดเอง:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMonths((prev) => Math.max(1, prev - 1))}
                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition-colors active:scale-95"
                  >
                    -
                  </button>
                  <span className="font-mono font-bold text-sm w-8 text-center text-slate-800">{months}</span>
                  <button
                    type="button"
                    onClick={() => setMonths((prev) => Math.min(60, prev + 1))}
                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition-colors active:scale-95"
                  >
                    +
                  </button>
                  <span className="text-xs text-slate-500 font-sans">เดือน</span>
                </div>
              </div>
            </div>

            {/* 3. Interest Rate Information */}
            <div className="flex items-center justify-between bg-rose-50/70 border border-rose-200/60 rounded-xl p-2.5 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-primary">percent</span>
                <div>
                  <p className="font-bold text-primary">อัตราดอกเบี้ย 36% ต่อปี</p>
                  <p className="text-[10px] text-slate-500 font-sans">3.0% ต่อเดือน (ลดต้นลดดอก PMT ตามเกณฑ์พิโกไฟแนนซ์)</p>
                </div>
              </div>
              <span className="text-[10px] font-bold bg-white text-primary px-2 py-0.5 rounded-full border border-rose-200 shrink-0">
                Pico Finance
              </span>
            </div>
          </div>

          {/* STEP 2: CALCULATION RESULT CARD */}
          <div className="bg-gradient-to-br from-primary via-[#c92f6b] to-[#a81c53] text-white rounded-2xl p-4 shadow-md relative overflow-hidden flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-rose-150 font-bold uppercase tracking-wider font-sans">ประมาณการค่างวดผ่อนชำระ</p>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-3xl font-black font-mono tracking-tight text-white drop-shadow-xs">
                    {calculation.monthly.toLocaleString()}
                  </span>
                  <span className="text-xs font-bold text-rose-100">บาท / เดือน</span>
                </div>
              </div>
              <div className="bg-white/15 px-2.5 py-1 rounded-full text-[10px] font-bold border border-white/20 backdrop-blur-xs">
                {months} งวด ({months} เดือน)
              </div>
            </div>

            {/* Breakdown table inside card */}
            <div className="bg-black/20 rounded-xl p-2.5 border border-white/10 grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <p className="text-[10px] text-rose-200 font-sans">วงเงินกู้</p>
                <p className="font-bold font-mono mt-0.5 text-white">{loanAmount.toLocaleString()} ฿</p>
              </div>
              <div className="border-x border-white/10 px-1">
                <p className="text-[10px] text-rose-200 font-sans">ดอกเบี้ยรวมโดยประมาณ</p>
                <p className="font-bold font-mono mt-0.5 text-amber-300">{calculation.totalInterest.toLocaleString()} ฿</p>
              </div>
              <div>
                <p className="text-[10px] text-rose-200 font-sans">ยอดผ่อนรวมทั้งสิ้น</p>
                <p className="font-bold font-mono mt-0.5 text-emerald-300">{calculation.totalPayment.toLocaleString()} ฿</p>
              </div>
            </div>

            <p className="text-[10px] text-rose-100/90 leading-tight">
              * คำนวณด้วยวิธีลดต้นลดดอก (PMT) ยอดค่างวดเท่ากันทุกเดือน ยอดจริงขึ้นอยู่กับการพิจารณาอนุมัติของบริษัท
            </p>
          </div>

          {/* STEP 3: CUSTOMER CONTACT & COLLATERAL SUBMISSION FORM */}
          <div className="border border-outline-variant rounded-2xl p-4 bg-white flex flex-col gap-3.5 shadow-xs">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[20px] text-emerald-600">verified_user</span>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 font-sans">
                    สนใจกู้เงินยอดนี้? ส่งข้อมูลให้เจ้าหน้าที่ตรวจสอบ
                  </h4>
                  <p className="text-[11px] text-slate-500 font-sans">
                    ระบบจะส่งข้อมูลเข้ากลุ่ม LINE เจ้าหน้าที่เพื่อติดต่อกลับหาท่านทันที
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmitInquiry} className="flex flex-col gap-3">
              {/* Customer Name */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  ชื่อ-นามสกุล ของท่าน <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">
                    person
                  </span>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="กรอกชื่อ-นามสกุล"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  เบอร์โทรศัพท์ที่ติดต่อได้ <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">
                    call
                  </span>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="กรอกเบอร์โทรศัพท์ 10 หลัก"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-mono"
                  />
                </div>
              </div>

              {/* Collateral Selection */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  สิ่งค้ำประกัน / หลักทรัพย์ค้ำประกัน <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {COLLATERAL_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setCollateral(opt.id)}
                      className={`flex items-center gap-1.5 p-2 rounded-xl text-xs font-bold border transition-all text-left ${
                        collateral === opt.id
                          ? 'bg-amber-50 text-amber-900 border-amber-400 ring-2 ring-amber-400/20'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px] text-amber-600 shrink-0">
                        {opt.icon}
                      </span>
                      <span className="truncate">{opt.label}</span>
                    </button>
                  ))}
                </div>

                {/* Collateral Detail text */}
                <div className="mt-2">
                  <input
                    type="text"
                    value={collateralDetail}
                    onChange={(e) => setCollateralDetail(e.target.value)}
                    placeholder="รายละเอียดเพิ่มเติม (เช่น โฉนด 2 งาน อ.พยัคฆภูมิพิสัย, รถ Isuzu 2018)"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !loanAmount || loanAmount <= 0}
                className="w-full bg-[#06C755] hover:bg-[#05b34c] text-white font-bold text-sm py-3 rounded-xl active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 font-sans disabled:opacity-50 cursor-pointer mt-1"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    <span>กำลังส่งข้อมูลให้เจ้าหน้าที่...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[20px]">send</span>
                    <span>ส่งให้เจ้าหน้าที่ตรวจสอบทันที</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
