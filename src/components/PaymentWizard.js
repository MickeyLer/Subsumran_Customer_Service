"use client";

import React, { useState, useEffect, useRef } from 'react';
import generatePayload from 'promptpay-qr';
import QRious from 'qrious';
import Swal from 'sweetalert2';
import {
  Camera, UploadCloud, CheckCircle, ChevronRight, X, Copy, QrCode, AlertTriangle,
  Check, Download, Bot, UserCheck, RefreshCw, ArrowLeft, Clock, Sparkles, Image as ImageIcon
} from 'lucide-react';
import { submitPaymentSettlement } from '../services/paymentSettlement';
import { createPendingPayment } from '../services/api';
import { uploadFileToStorage } from '../services/storageSeam';
import { calculateOverdueFeeDetails, parseAppDate } from '../utils/installmentProgression';
import {
  verifySlipWithGemini, COMPANY_BANK_INFO, PROMPTPAY_NUMBER, addUsedQRCode
} from '../utils/slipVerification';
import { notifyLineGroup } from '../utils/lineNotifyHelper';
import StandardReceiptA4 from './StandardReceiptA4';
import { sendReceiptToGoogleAppsScript } from '../utils/senttoAppscript';

/**
 * PaymentWizard — UI/UX Pro Max Edition
 * Features:
 * - 3-Step Wizard Flow (1. ตรวจสอบยอด, 2. ชำระเงิน/QR, 3. อัปโหลดและตรวจสอบสลิป)
 * - Method selection for Payment: Bank Transfer vs PromptPay QR (with downloadable/shareable QR)
 * - Method selection for Verification: 🤖 AI Verification vs 👤 Send to Staff Review
 * - Dynamic Mobile Controls: File, Camera, Gallery triggers for iOS/Android compatibility
 * - OCR Progress Bar & Duplicate Slip Hash Prevention
 * - Automatic LINE Notification to Manager when slip verification fails, needs manual review, or user chooses staff review!
 */
const PaymentWizard = ({
  setOpenModal,
  selectedInstallments = [],
  totalTree = 0,
  totalInterest = 0,
  rest = 0,
  Name = '',
  idContact = '',
  accumulate,
  contract = {},
  settings = {},
}) => {
  const onClose = () => setOpenModal(false);
  const onComplete = () => window.location.reload();

  const [step, setStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('transfer'); // 'transfer' | 'qr'
  const [verificationMode, setVerificationMode] = useState(null); // 'ai' | 'manual' | null

  // State
  const [qrSrc, setQrSrc] = useState('');
  const [slipFile, setSlipFile] = useState(null);
  const [slipPreview, setSlipPreview] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [verificationResult, setVerificationResult] = useState(null);

  const [lateInterest, setLateInterest] = useState(0);
  const [collectionFee, setCollectionFee] = useState(0);
  const [totalpay, setTotalpay] = useState(0);

  const fileInputRef = useRef(null);
  const receiptRef = useRef(null);
  const [receiptDataState, setReceiptDataState] = useState(null);

  useEffect(() => {
    let sumLate = 0;
    let sumColl = 0;

    (selectedInstallments || []).forEach((inst) => {
      const details = calculateOverdueFeeDetails(inst, contract, settings);
      sumLate += details.lateInterest;
      sumColl += details.collectionFee;
    });

    setLateInterest(sumLate);
    setCollectionFee(sumColl);

    const calculatedTotal = totalTree + totalInterest + sumLate + sumColl;
    setTotalpay(calculatedTotal);

    if (calculatedTotal > 0) {
      try {
        const payload = generatePayload(PROMPTPAY_NUMBER, { amount: calculatedTotal });
        const qr = new QRious({ value: payload, size: 280, level: 'H' });
        setQrSrc(qr.toDataURL());
      } catch (err) {
        console.error("QR Generation error", err);
      }
    }
  }, [totalTree, totalInterest, selectedInstallments, contract, settings]);

  // Auto AI Verification Helper
  const runAiVerification = async (fileToVerify) => {
    if (!fileToVerify) return null;
    setIsVerifying(true);
    setOcrProgress(15);
    try {
      const res = await verifySlipWithGemini(fileToVerify, totalpay, (pct) => setOcrProgress(pct));
      setVerificationResult(res);
      return res;
    } catch (err) {
      console.error('Error during AI verification:', err);
      const fallbackRes = {
        isValid: false,
        confidence: 0,
        error: err.message || 'ไม่สามารถวิเคราะห์สลิปด้วย AI ได้',
        needsManualReview: true
      };
      setVerificationResult(fallbackRes);
      return fallbackRes;
    } finally {
      setIsVerifying(false);
    }
  };

  // File Upload Handlers
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      if (!file.type.startsWith('image/')) {
        Swal.fire('ข้อผิดพลาด', 'กรุณาเลือกไฟล์รูปภาพ (JPG, PNG)', 'error');
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        Swal.fire('ข้อผิดพลาด', 'ไฟล์รูปภาพต้องมีขนาดไม่เกิน 15MB', 'error');
        return;
      }

      setSlipFile(file);
      setSlipPreview(URL.createObjectURL(file));
      setVerificationResult(null);
      setOcrProgress(0);

      // เริ่มวิเคราะห์สลิปด้วย AI ทันทีเมื่อเลือกไฟล์
      if (verificationMode === 'ai') {
        runAiVerification(file);
      }
    }
  };

  const triggerFileInput = (mode) => {
    if (isVerifying || !fileInputRef.current) return;
    if (mode === 'camera') {
      fileInputRef.current.setAttribute('capture', 'environment');
    } else {
      fileInputRef.current.removeAttribute('capture');
    }
    fileInputRef.current.click();
  };

  const copyToClipboard = (text, label = 'คัดลอกสำเร็จ') => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    Swal.fire({
      icon: 'success',
      title: label,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 1500
    });
  };

  const downloadQRCode = () => {
    if (!qrSrc) return;
    const link = document.createElement('a');
    link.download = `PromptPay_${totalpay}_THB.png`;
    link.href = qrSrc;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Submit Logic
  const handleSubmit = async () => {
    if (!slipFile) {
      Swal.fire('ข้อผิดพลาด', 'กรุณาอัปโหลดสลิปการโอนเงิน', 'error');
      return;
    }

    const currentMode = verificationMode || 'ai';
    setIsVerifying(true);
    setOcrProgress(10);

    let verifyRes = null;

    try {
      if (currentMode === 'ai') {
        // ใช้ผลการวิเคราะห์ที่มีอยู่แล้ว หากวิเคราะห์ไปแล้วตอนเลือกไฟล์
        if (verificationResult && verificationResult.extractedData) {
          verifyRes = verificationResult;
          setOcrProgress(40);
        } else {
          setOcrProgress(20);
          verifyRes = await verifySlipWithGemini(slipFile, totalpay, (pct) => setOcrProgress(pct));
          setVerificationResult(verifyRes);
        }

        if (verifyRes?.isValid && verifyRes?.qrCodeInfo?.hash) {
          // Save hash if valid to prevent duplicate usage
          addUsedQRCode(verifyRes.qrCodeInfo.hash, '', { amount: totalpay, contractId: idContact });
        }
      } else {
        setOcrProgress(50);
      }

      // Check if AI verification passed 100%
      if (currentMode === 'ai' && verifyRes?.isValid) {
        // =========================================================================
        // 🌟 CASE 1: AI ตรวจสอบผ่าน 100% -> Auto-Settlement & Auto-Invoice
        // =========================================================================
        setOcrProgress(70);

        const settlementResult = await submitPaymentSettlement({
          selectedInstallments,
          totalTree,
          totalInterest,
          rest,
          customerName: Name,
          contractId: idContact,
          accumulate,
          slipFile,
          contract,
          settings,
        });

        // Prepare master receipt data for A4 template
        const sortedInsts = [...(selectedInstallments || [])].sort((a, b) => a.number_pay - b.number_pay);
        const numPayLabel = sortedInsts.map(i => i.number_pay).join(',');
        const masterReceiptData = {
          invoiceID: settlementResult.invoiceID,
          ID_contact: idContact,
          Name_loan: Name,
          name: Name,
          userID: contract?.userID || '',
          add_loan: contract?.add_loan || '-',
          address: contract?.add_loan || '-',
          tree: totalTree,
          int: totalInterest,
          feedisapp: lateInterest,
          feefollow: collectionFee,
          disfeedis: 0,
          disfeefol: 0,
          accu: 0,
          accu_discount: 0,
          number_pay: numPayLabel,
          month_loan: contract?.month_loan || '-',
          resttree: settlementResult.newRest,
          payroute: 'เงินโอน',
          next_due: contract?.Next_duedate || '-',
          date_receipt: new Date().toISOString().split('T')[0],
        };
        setReceiptDataState(masterReceiptData);

        // Render A4 receipt to canvas and post to Google Apps Script / LINE
        let generatedReceiptUrl = null;
        try {
          await new Promise(r => setTimeout(r, 350));
          const gasRes = await sendReceiptToGoogleAppsScript(receiptRef, masterReceiptData);
          if (gasRes && (gasRes.imageUrl || gasRes.url)) {
            generatedReceiptUrl = gasRes.imageUrl || gasRes.url;
          }
        } catch (gasErr) {
          console.warn('sendReceiptToGoogleAppsScript error in PaymentWizard:', gasErr);
        }

        setOcrProgress(100);
        setIsVerifying(false);

        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        const invoiceUrl = `${baseUrl}/Invoice?invoiceID=${encodeURIComponent(settlementResult.invoiceID)}`;

        // ส่งแจ้งเตือนสรุปเข้ากลุ่ม LINE บัญชี/เจ้าหน้าที่ พร้อมรูปใบเสร็จมาตรฐาน
        await notifyLineGroup({
          amount: totalpay,
          userName: Name || 'ลูกค้า',
          contractId: idContact,
          imageUrl: generatedReceiptUrl || settlementResult?.slipUrl || slipPreview || '',
          isAutoApproved: true,
          invoiceId: settlementResult.invoiceID,
          invoiceUrl: invoiceUrl,
          reason: '🤖 AI ตรวจสอบผ่าน 100% ตัดยอดและออกใบเสร็จอัตโนมัติ',
        }).catch(err => console.error('Failed to notify LINE group:', err));

        Swal.fire({
          icon: 'success',
          title: 'ชำระค่างวดสำเร็จเรียบร้อย!',
          html: `<div class="text-left text-sm space-y-2">
            <p class="font-semibold text-emerald-600">🤖 AI ตรวจสอบความถูกต้องเรียบร้อย เงินเข้าแล้ว</p>
            <p class="text-slate-700">เลขที่ใบเสร็จ: <b class="text-emerald-700">${settlementResult.invoiceID}</b></p>
            <p class="text-slate-700">ยอดชำระ: <b>${Number(totalpay).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</b></p>
          </div>`,
          showCancelButton: true,
          confirmButtonText: '📄 เปิดดูใบเสร็จรับเงิน',
          cancelButtonText: 'ปิด',
          confirmButtonColor: '#16a34a',
          cancelButtonColor: '#64748b'
        }).then((result) => {
          if (result.isConfirmed) {
            window.location.href = invoiceUrl;
          } else {
            onComplete();
            onClose();
          }
        });

      } else {
        // =========================================================================
        // ⚠️ CASE 2: AI ตรวจไม่ผ่าน หรือลูกค้าส่งตรวจเอง -> พักรายการไว้ (Pending)
        // *** กั้นเด็ดขาด: ยังไม่ตัดยอดหนี้! ไม่แก้ไข Interest_chart และ Contact ***
        // =========================================================================
        setOcrProgress(60);

        // 1. อัปโหลดรูปสลิปขึ้น Cloud Storage ก่อนเพื่อส่ง URL ให้เจ้าหน้าที่ดู
        const timestamp = Date.now();
        const storagePath = `slips/${idContact}/${timestamp}_${slipFile.name || 'slip.jpg'}`;
        const uploadedSlipUrl = await uploadFileToStorage(slipFile, storagePath);

        setOcrProgress(80);

        // 2. บันทึกคำขอชำระเงินลงตาราง pending_payments ใน Supabase
        const pendingRecord = await createPendingPayment({
          contract_id: String(idContact),
          customer_name: Name || 'ไม่ระบุชื่อ',
          amount: totalpay,
          total_tree: totalTree,
          total_interest: totalInterest,
          rest: rest,
          accumulate: accumulate ? String(accumulate) : null,
          selected_installments: selectedInstallments,
          slip_url: uploadedSlipUrl,
          slip_hash: verifyRes?.qrCodeInfo?.hash || null,
          ai_result: verifyRes ? {
            isValid: verifyRes.isValid,
            confidence: verifyRes.confidence,
            extractedData: verifyRes.extractedData || null,
            error: verifyRes.error || null,
            message: verifyRes.message || null
          } : null,
          status: 'pending'
        });

        // 3. สร้างลิงก์ 1-Click Approval สำหรับเจ้าหน้าที่
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        const approvalUrl = `${baseUrl}/ReviewSlip?id=${pendingRecord.id}`;

        const failureReason = currentMode === 'manual'
          ? 'ลูกค้าเลือกส่งตรวจสอบเอง (รอเจ้าหน้าที่ตรวจสอบในระบบ)'
          : `AI ตรวจสอบไม่ผ่าน: ${verifyRes?.error || verifyRes?.message || 'ข้อมูลในสลิปไม่ตรงกับยอดชำระ'}`;

        console.warn('Sending alert to LINE Manager Group with 1-Click approval URL:', approvalUrl);

        // 4. ส่ง Flex Message เข้ากลุ่ม LINE เจ้าหน้าที่ พร้อมปุ่ม 1-Click Approval
        await notifyLineGroup({
          amount: totalpay,
          userName: Name || 'ลูกค้า',
          contractId: idContact,
          imageUrl: uploadedSlipUrl || slipPreview || '',
          confidence: verifyRes?.confidence ? `${Math.round(verifyRes.confidence * 100)}%` : '0%',
          reason: failureReason,
          approvalUrl: approvalUrl,
        }).catch(err => console.error('Failed to notify LINE group:', err));

        setOcrProgress(100);
        setIsVerifying(false);

        Swal.fire({
          icon: 'info',
          title: 'ส่งสลิปให้เจ้าหน้าที่เรียบร้อยแล้ว',
          html: `<div class="text-left text-sm space-y-2">
            <p class="text-slate-600">ระบบได้ส่งสลิปให้เจ้าหน้าที่ตรวจสอบความถูกต้องผ่านระบบเรียบร้อยแล้ว</p>
            <div class="text-xs text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
              ⏳ <b>สถานะ: รอเจ้าหน้าที่ตรวจสอบ</b><br/>
              เมื่อเจ้าหน้าที่ตรวจสอบและกดยืนยัน ระบบจะตัดยอดและออกใบเสร็จให้ทันทีครับ
            </div>
          </div>`,
          confirmButtonText: 'รับทราบ',
          confirmButtonColor: '#0284c7'
        }).then(() => {
          onComplete();
          onClose();
        });
      }

    } catch (err) {
      console.error(err);
      setIsVerifying(false);
      Swal.fire('เกิดข้อผิดพลาด', err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error');
    }
  };

  const sortedSelected = [...selectedInstallments].sort((a, b) => a.number_pay - b.number_pay);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex flex-col w-full h-full overflow-y-auto animate-fade-in font-sans">
      
      {/* Dynamic Mobile Modal Container */}
      <div className="min-h-full w-full flex flex-col bg-surface sm:max-w-2xl sm:mx-auto sm:my-6 sm:rounded-2xl sm:shadow-2xl overflow-hidden">

        {/* Header & Stepper Section */}
        <div className="bg-gradient-to-r from-primary via-primary-container to-blue-900 text-white p-4 sm:p-6 border-b-2 border-secondary-fixed sticky top-0 z-20 shadow-md">
          <div className="flex justify-between items-center mb-5">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-white/10 rounded-xl">
                <Sparkles className="w-5 h-5 text-secondary-fixed animate-pulse" />
              </span>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-secondary-fixed leading-tight font-sans">
                  ระบบชำระค่างวด & ตรวจสอบสลิป
                </h2>
                <p className="text-xs text-white/70">สัญญา {idContact} — {Name}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition p-2 bg-white/10 hover:bg-white/20 rounded-full shrink-0"
              aria-label="ปิด"
            >
              <X size={22} />
            </button>
          </div>

          {/* Stepper Progress */}
          <div className="relative z-10 px-2 max-w-xl mx-auto w-full">
            <div className="absolute top-[18px] left-8 right-8 h-1 bg-white/20 -z-10 rounded-full">
              <div
                className="h-full bg-secondary-fixed transition-all duration-300 rounded-full"
                style={{ width: `${((step - 1) / 2) * 100}%` }}
              />
            </div>

            <div className="flex justify-between items-start">
              {[
                { id: 1, label: '1. ตรวจสอบยอด' },
                { id: 2, label: '2. ชำระเงิน/QR' },
                { id: 3, label: '3. ยืนยันสลิป' },
              ].map((s) => {
                const isCompleted = step > s.id;
                const isActive = step === s.id;

                return (
                  <div key={s.id} className="flex flex-col items-center min-w-[64px]">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
                        isActive
                          ? 'bg-white text-primary shadow-lg ring-4 ring-white/30 scale-110 font-black text-base'
                          : isCompleted
                          ? 'bg-secondary-fixed text-on-primary-fixed-variant shadow-md font-bold'
                          : 'bg-white/15 text-white/90 border border-white/30 font-semibold text-sm'
                      }`}
                    >
                      {isCompleted ? <Check size={18} className="stroke-[3]" /> : <span>{s.id}</span>}
                    </div>
                    <span
                      className={`mt-1.5 text-[11px] sm:text-xs font-sans transition-colors duration-200 text-center ${
                        isActive ? 'text-secondary-fixed font-bold' : isCompleted ? 'text-white/90 font-medium' : 'text-white/60 font-normal'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Content Body */}
        <div className="flex-grow p-4 sm:p-6 bg-slate-50/50 overflow-y-auto">
          <div className="max-w-xl mx-auto w-full pb-12">

            {/* ========================================================= */}
            {/* STEP 1: SUMMARY & DETAILS */}
            {/* ========================================================= */}
            {step === 1 && (
              <div className="animate-fade-in space-y-4">
                <div className="text-center mb-4">
                  <h3 className="text-lg font-bold text-primary font-sans">รายการงวดที่เลือกชำระ</h3>
                  <p className="text-xs text-on-surface-variant font-sans">ตรวจสอบยอดเงินรวมก่อนดำเนินการโอน</p>
                </div>

                {/* Installment breakdown list */}
                <div className="bg-white rounded-xl border border-outline-variant/30 overflow-hidden shadow-sm">
                  <div className="px-4 py-2.5 bg-slate-100/80 border-b border-outline-variant/20 text-xs font-bold text-on-surface-variant uppercase tracking-wider font-sans">
                    รายการงวดค้างชำระ ({sortedSelected.length} งวด)
                  </div>
                  <div className="divide-y divide-slate-100">
                    {sortedSelected.map((inst, i) => (
                      <div key={i} className="flex justify-between items-center px-4 py-3 text-sm">
                        <div>
                          <span className="font-bold text-primary">งวดที่ {inst.number_pay}</span>
                          <p className="text-xs text-slate-500">กำหนดชำระ: {inst.begin_date || 'ไม่ระบุ'}</p>
                        </div>
                        <span className="font-bold text-slate-800">
                          {(Number(inst.tree) + Number(inst.interest)).toLocaleString()} ฿
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Calculation breakdown */}
                <div className="bg-white rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden text-sm">
                  <div className="flex justify-between p-3.5 border-b border-slate-100">
                    <span className="text-slate-600">เงินต้นรวม</span>
                    <span className="font-semibold text-primary">{totalTree.toLocaleString()} ฿</span>
                  </div>
                  <div className="flex justify-between p-3.5 border-b border-slate-100">
                    <span className="text-slate-600">ดอกเบี้ยรวม</span>
                    <span className="font-semibold text-primary">{totalInterest.toLocaleString()} ฿</span>
                  </div>
                  {lateInterest > 0 && (
                    <div className="flex justify-between p-3.5 border-b border-slate-100 text-red-600">
                      <span className="flex items-center gap-1 font-medium">
                        <AlertTriangle size={14} /> ค่าปรับล่าช้า
                      </span>
                      <span className="font-bold">{lateInterest.toLocaleString()} ฿</span>
                    </div>
                  )}
                  {collectionFee > 0 && (
                    <div className="flex justify-between p-3.5 border-b border-slate-100 text-amber-600">
                      <span className="flex items-center gap-1 font-medium">
                        <AlertTriangle size={14} /> ค่าทวงถาม
                      </span>
                      <span className="font-bold">{collectionFee.toLocaleString()} ฿</span>
                    </div>
                  )}
                  <div className="flex justify-between p-4 bg-primary/5 border-t border-primary/10">
                    <span className="text-base font-bold text-primary">ยอดรวมชำระทั้งสิ้น</span>
                    <span className="text-2xl font-black text-primary">{totalpay.toLocaleString()} <span className="text-sm font-normal">฿</span></span>
                  </div>
                </div>

                <button
                  onClick={() => setStep(2)}
                  className="w-full mt-4 bg-primary hover:bg-primary/95 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-98 text-base border-0 cursor-pointer"
                >
                  ถัดไป: เลือกวิธีชำระเงิน <ChevronRight size={20} />
                </button>
              </div>
            )}

            {/* ========================================================= */}
            {/* STEP 2: PAYMENT & QR GENERATION */}
            {/* ========================================================= */}
            {step === 2 && (
              <div className="animate-fade-in space-y-4">
                <div className="text-center">
                  <h3 className="text-lg font-bold text-primary font-sans">ชำระเงินตามจำนวน</h3>
                  <p className="text-3xl font-black text-blue-600 my-1">฿{totalpay.toLocaleString()}</p>
                </div>

                {/* Tabs selection */}
                <div className="grid grid-cols-2 gap-2 bg-slate-200/60 p-1 rounded-xl">
                  <button
                    onClick={() => setPaymentMethod('transfer')}
                    className={`py-3 px-4 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                      paymentMethod === 'transfer'
                        ? 'bg-white text-primary shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    🏦 โอนบัญชีธนาคาร
                  </button>
                  <button
                    onClick={() => setPaymentMethod('qr')}
                    className={`py-3 px-4 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                      paymentMethod === 'qr'
                        ? 'bg-white text-primary shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    📱 QR พร้อมเพย์
                  </button>
                </div>

                {/* Option 1: Bank Transfer */}
                {paymentMethod === 'transfer' && (
                  <div className="bg-white rounded-2xl p-5 border border-outline-variant/30 shadow-sm space-y-4">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3 text-center">
                      <div>
                        <span className="text-xs text-slate-500 uppercase font-semibold">ธนาคาร</span>
                        <p className="font-bold text-slate-800 text-base">{COMPANY_BANK_INFO.bankName}</p>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500 uppercase font-semibold">ชื่อบัญชี</span>
                        <p className="font-bold text-slate-800 text-base">{COMPANY_BANK_INFO.accountName}</p>
                      </div>
                      <div className="pt-1">
                        <span className="text-xs text-slate-500 uppercase font-semibold">เลขที่บัญชี</span>
                        <p className="font-mono font-black text-2xl text-blue-700 tracking-wider my-1">
                          {COMPANY_BANK_INFO.accountNumber}
                        </p>
                        <button
                          onClick={() => copyToClipboard('4260471809', 'คัดลอกเลขบัญชีแล้ว!')}
                          className="mt-1 px-4 py-2 bg-blue-600 text-white rounded-full text-xs font-bold hover:bg-blue-700 flex items-center justify-center gap-1.5 mx-auto transition-all shadow-sm active:scale-95"
                        >
                          <Copy size={14} /> คัดลอกเลขบัญชี
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Option 2: PromptPay QR */}
                {paymentMethod === 'qr' && (
                  <div className="bg-white rounded-2xl p-5 border border-outline-variant/30 shadow-sm text-center space-y-4">
                    <div className="bg-slate-50 p-4 rounded-xl inline-block border border-slate-200 shadow-inner">
                      {qrSrc ? (
                        <img src={qrSrc} alt="PromptPay QR" className="w-56 h-56 mx-auto object-contain rounded-lg" />
                      ) : (
                        <div className="w-56 h-56 flex flex-col items-center justify-center text-slate-400">
                          <QrCode size={48} className="animate-spin mb-2" />
                          <span className="text-xs">กำลังสร้าง QR...</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">สแกนจ่ายผ่านแอปธนาคารทุกธนาคาร</p>
                      <p className="font-bold text-sm text-slate-800 mt-0.5">เบอร์พร้อมเพย์: {PROMPTPAY_NUMBER}</p>
                    </div>
                    <button
                      onClick={downloadQRCode}
                      className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold rounded-xl shadow-md hover:from-emerald-600 hover:to-teal-700 flex items-center justify-center gap-2 transition-all active:scale-98"
                    >
                      <Download size={18} /> บันทึกรูป QR Code
                    </button>
                  </div>
                )}

                {/* Instructions Alert */}
                <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
                  <p className="font-bold flex items-center gap-1">💡 ข้อแนะนำในการชำระเงิน:</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-amber-800">
                    <li>โอนเงินตรงตามยอด <strong>{totalpay.toLocaleString()} บาท</strong></li>
                    <li>บันทึกสลิป/ภาพถ่ายการโอนเงินลงมือถือ</li>
                    <li>กดปุ่ม <strong>"ฉันโอนเงินแล้ว (ไปแนบสลิป)"</strong> ด้านล่าง</li>
                  </ol>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setStep(1)}
                    className="w-1/3 py-3.5 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition"
                  >
                    ย้อนกลับ
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    className="flex-1 py-3.5 bg-primary hover:bg-primary/95 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-1.5 transition active:scale-98"
                  >
                    ฉันโอนเงินแล้ว (ไปแนบสลิป) <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* STEP 3: SLIP UPLOAD & VERIFICATION */}
            {/* ========================================================= */}
            {step === 3 && (
              <div className="animate-fade-in space-y-4">
                <div className="text-center">
                  <h3 className="text-lg font-bold text-primary font-sans">ขั้นตอนที่ 3: แนบสลิปยืนยันการฝากเงิน</h3>
                  <p className="text-xs text-slate-600 mt-0.5">ยอดโอน: <strong className="text-blue-600">{totalpay.toLocaleString()} บาท</strong></p>
                </div>

                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isVerifying}
                />

                {/* Mode Selector (AI vs Manual) if not selected */}
                {!verificationMode && (
                  <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <p className="text-sm font-bold text-center text-slate-800 mb-2">เลือกวิธีการตรวจสอบสลิป</p>
                    
                    <button
                      onClick={() => setVerificationMode('ai')}
                      className="w-full text-left p-4 rounded-xl border-2 border-blue-100 hover:border-blue-500 hover:bg-blue-50/50 transition-all group relative overflow-hidden"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xl shrink-0">
                          🤖
                        </div>
                        <div>
                          <h5 className="font-bold text-blue-900 text-sm">ให้ AI ตรวจสอบอัตโนมัติ (แนะนำ)</h5>
                          <p className="text-xs text-blue-700">ตรวจสอบสลิปทันที อนุมัติรวดเร็ว เงินเข้าไว</p>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => setVerificationMode('manual')}
                      className="w-full text-left p-4 rounded-xl border-2 border-slate-100 hover:border-slate-400 hover:bg-slate-50 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xl shrink-0">
                          👤
                        </div>
                        <div>
                          <h5 className="font-bold text-slate-900 text-sm">ส่งเจ้าหน้าที่ตรวจสอบทางไลน์</h5>
                          <p className="text-xs text-slate-500">กรณีสลิปไม่ชัด หรือต้องการให้เจ้าหน้าที่ตรวจสอบให้ (รออนุมัติ)</p>
                        </div>
                      </div>
                    </button>
                  </div>
                )}

                {/* Upload UI (Show when mode selected) */}
                {verificationMode && (
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex justify-between items-center text-xs border-b border-slate-100 pb-2">
                      <span className="font-bold text-blue-700">
                        {verificationMode === 'ai' ? '🤖 โหมด: AI ตรวจสอบอัตโนมัติ' : '👤 โหมด: เจ้าหน้าที่ตรวจสอบทางไลน์'}
                      </span>
                      <button
                        onClick={() => setVerificationMode(null)}
                        className="text-blue-600 underline font-semibold hover:text-blue-800"
                        disabled={isVerifying}
                      >
                        เปลี่ยนโหมด
                      </button>
                    </div>

                    {!slipPreview ? (
                      <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center space-y-4">
                        <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                          <UploadCloud size={32} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">แตะปุ่มเพื่อแนบรูปภาพสลิป</p>
                          <p className="text-xs text-slate-400 mt-0.5">รองรับ JPG, PNG (ไม่เกิน 15MB)</p>
                        </div>

                        {/* Trigger buttons */}
                        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
                          <button
                            type="button"
                            onClick={() => triggerFileInput('file')}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-5 rounded-xl text-sm transition-all shadow-md active:scale-95"
                          >
                            📤 เลือกสลิป
                          </button>
                          <button
                            type="button"
                            onClick={() => triggerFileInput('camera')}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-5 rounded-xl text-sm transition-all shadow-md active:scale-95 flex items-center justify-center gap-1"
                          >
                            <Camera size={16} /> ถ่ายรูป/กล้อง
                          </button>
                          <button
                            type="button"
                            onClick={() => triggerFileInput('gallery')}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-5 rounded-xl text-sm transition-all shadow-md active:scale-95 flex items-center justify-center gap-1"
                          >
                            <ImageIcon size={16} /> อัลบั้ม
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Preview Section */
                      <div className="border border-slate-200 rounded-xl p-3 space-y-3 text-center">
                        <div className="relative inline-block max-w-full">
                          <img
                            src={slipPreview}
                            alt="Slip Preview"
                            className="max-h-72 rounded-lg mx-auto shadow-sm object-contain"
                          />
                          <button
                            onClick={() => {
                              setSlipPreview('');
                              setSlipFile(null);
                              setVerificationResult(null);
                            }}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 shadow-md hover:bg-red-600 transition"
                            disabled={isVerifying}
                          >
                            <X size={16} />
                          </button>
                        </div>
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => triggerFileInput('gallery')}
                            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold transition"
                            disabled={isVerifying}
                          >
                            🖼️ เปลี่ยนรูปสลิป
                          </button>
                        </div>
                      </div>
                    )}

                    {/* OCR Progress Bar */}
                    {isVerifying && (
                      <div className="space-y-1.5 p-3 bg-blue-50 rounded-xl border border-blue-100">
                        <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                          <span className="flex items-center gap-1.5">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                            {verificationMode === 'ai' ? 'AI กำลังวิเคราะห์สลิป...' : 'กำลังส่งข้อมูลให้เจ้าหน้าที่...'}
                          </span>
                          <span>{ocrProgress}%</span>
                        </div>
                        <div className="w-full bg-blue-200/70 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                            style={{ width: `${ocrProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Manual Mode Info Note */}
                    {verificationMode === 'manual' && slipFile && (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 flex items-center gap-2">
                        <UserCheck size={16} className="text-slate-600 shrink-0" />
                        <span>สลิปจะถูกส่งให้เจ้าหน้าที่ตรวจสอบความถูกต้องผ่านทางไลน์ (รออนุมัติ)</span>
                      </div>
                    )}

                    {/* AI Mode: Trigger button if not yet verified */}
                    {verificationMode === 'ai' && slipFile && !verificationResult && !isVerifying && (
                      <button
                        type="button"
                        onClick={() => runAiVerification(slipFile)}
                        className="w-full py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition border border-blue-200 shadow-2xs"
                      >
                        <Bot size={16} /> แตะเพื่อให้ AI วิเคราะห์สลิปทันที
                      </button>
                    )}

                    {/* กล่อง ผลการวิเคราะห์ AI (Gemini Flash) */}
                    {verificationMode === 'ai' && verificationResult && (
                      <div className={`p-4 rounded-2xl border transition-all shadow-sm space-y-3 ${
                        verificationResult.isValid
                          ? 'bg-emerald-50/70 border-emerald-200'
                          : 'bg-amber-50/70 border-amber-200'
                      }`}>
                        {/* Header */}
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                              <Bot size={18} />
                            </span>
                            <div>
                              <h4 className="text-xs font-bold text-slate-900 leading-tight">
                                ผลการวิเคราะห์ AI (Gemini Flash)
                              </h4>
                              <p className="text-[10px] text-slate-500">
                                ตรวจสอบข้อมูลสลิปเปรียบเทียบกับระบบ
                              </p>
                            </div>
                          </div>
                          {verificationResult.isValid ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle size={13} className="text-emerald-600" /> ข้อมูลถูกต้อง
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                              <AlertTriangle size={13} className="text-amber-600" /> ข้อมูลไม่ตรงกัน
                            </span>
                          )}
                        </div>

                        {/* Comparison Rows */}
                        <div className="space-y-2 text-xs">
                          {/* 1. ยอดเงินในสลิป */}
                          {(() => {
                            const isAmtValid = verificationResult.comparison?.amount?.isValid ?? (Math.abs(parseFloat(verificationResult.extractedData?.amount || 0) - totalpay) < 1.0);
                            return (
                              <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-2xs space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-slate-700">ยอดเงินในสลิป:</span>
                                  {isAmtValid ? (
                                    <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                      <Check size={13} /> ตรงกัน
                                    </span>
                                  ) : (
                                    <span className="text-[11px] font-bold text-red-600 flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                                      <X size={13} /> ไม่ตรงกัน
                                    </span>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2 rounded-lg">
                                  <div>
                                    <span className="text-slate-400 block text-[10px]">ระบบต้องการ</span>
                                    <span className="font-bold text-slate-800 font-mono">
                                      {Number(totalpay).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-slate-400 block text-[10px]">AI อ่านได้</span>
                                    <span className={`font-bold font-mono ${isAmtValid ? 'text-emerald-700' : 'text-red-600'}`}>
                                      {verificationResult.extractedData?.amount
                                        ? `${Number(verificationResult.extractedData.amount).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`
                                        : 'ไม่พบยอดเงิน'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          {/* 2. บัญชีปลายทาง */}
                          {(() => {
                            const isAccValid = verificationResult.comparison?.account?.isValid ?? Boolean(
                              verificationResult.extractedData?.account_number?.includes('4260471809') ||
                              verificationResult.extractedData?.account_number?.includes('426-047180-9')
                            );
                            return (
                              <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-2xs space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-slate-700">บัญชีปลายทาง:</span>
                                  {isAccValid ? (
                                    <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                      <Check size={13} /> ตรงกับ SCB 426-047180-9
                                    </span>
                                  ) : (
                                    <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                      <AlertTriangle size={13} /> ไม่ตรงกับ SCB 426-047180-9
                                    </span>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2 rounded-lg">
                                  <div>
                                    <span className="text-slate-400 block text-[10px]">บัญชีเป้าหมาย</span>
                                    <span className="font-bold text-slate-800 font-mono">SCB 426-047180-9</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-slate-400 block text-[10px]">AI อ่านได้</span>
                                    <span className={`font-bold font-mono ${isAccValid ? 'text-emerald-700' : 'text-amber-700'}`}>
                                      {verificationResult.extractedData?.account_number || 'ไม่พบเลขบัญชีในสลิป'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          {/* 3. ชื่อบัญชี */}
                          {(() => {
                            const isNameValid = verificationResult.comparison?.name?.isValid ?? Boolean(
                              ['ทรัพย์สำราญ', 'SUB SUM RAN'].some(v =>
                                (verificationResult.extractedData?.recipient_name || '').toLowerCase().includes(v.toLowerCase())
                              )
                            );
                            return (
                              <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-2xs space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-slate-700">ชื่อบัญชี:</span>
                                  {isNameValid ? (
                                    <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                      <Check size={13} /> ตรงกับ บริษัท ทรัพย์สำราญ พิโก จำกัด
                                    </span>
                                  ) : (
                                    <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                      <AlertTriangle size={13} /> ไม่ตรงกับ บริษัท ทรัพย์สำราญ พิโก จำกัด
                                    </span>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2 rounded-lg items-center">
                                  <div>
                                    <span className="text-slate-400 block text-[10px]">ชื่อบัญชีเป้าหมาย</span>
                                    <span className="font-bold text-slate-800 text-[11px]">บริษัท ทรัพย์สำราญ พิโก จำกัด</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-slate-400 block text-[10px]">AI อ่านได้</span>
                                    <span className={`font-bold text-[11px] block truncate ${isNameValid ? 'text-emerald-700' : 'text-amber-700'}`}>
                                      {verificationResult.extractedData?.recipient_name || 'ไม่พบชื่อบัญชีในสลิป'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          {/* 4. วันที่โอนในสลิป (ตรวจสอบวันนี้/เมื่อวาน ไม่เกิน 48 ชม.) */}
                          {(() => {
                            const dateComp = verificationResult.comparison?.date;
                            const isDateValid = dateComp?.isValid ?? true;
                            const actualDateStr = dateComp?.actual || verificationResult.extractedData?.transfer_date || 'ไม่พบวันที่';
                            return (
                              <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-2xs space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-slate-700">วันที่โอนในสลิป:</span>
                                  {isDateValid ? (
                                    <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                      <Check size={13} /> {dateComp?.reason || 'โอนภายใน 48 ชม.'}
                                    </span>
                                  ) : (
                                    <span className="text-[11px] font-bold text-red-600 flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                                      <X size={13} /> {dateComp?.reason || 'เกิน 48 ชม.'}
                                    </span>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2 rounded-lg items-center">
                                  <div>
                                    <span className="text-slate-400 block text-[10px]">เงื่อนไขระบบ</span>
                                    <span className="font-bold text-slate-800 text-[11px]">วันนี้หรือเมื่อวาน (ไม่เกิน 48 ชม.)</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-slate-400 block text-[10px]">AI อ่านได้</span>
                                    <span className={`font-bold font-mono text-[11px] block ${isDateValid ? 'text-emerald-700' : 'text-red-600'}`}>
                                      {actualDateStr}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Status message banner */}
                        <div className={`p-2.5 rounded-xl text-xs flex items-start gap-2 ${
                          verificationResult.isValid
                            ? 'bg-emerald-100/90 text-emerald-900 border border-emerald-300'
                            : 'bg-amber-100/90 text-amber-900 border border-amber-300'
                        }`}>
                          {verificationResult.isValid ? (
                            <>
                              <CheckCircle size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                              <div className="space-y-0.5">
                                <p className="font-bold">ข้อมูลสลิปถูกต้องสมบูรณ์</p>
                                <p className="text-[11px] text-emerald-800">เมื่อกดยืนยัน ระบบจะตัดยอดและออกใบเสร็จให้อัตโนมัติทันที</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                              <div className="space-y-0.5">
                                <p className="font-bold">{verificationResult.error || 'พบข้อมูลไม่ตรงกัน'}</p>
                                <p className="text-[11px] text-amber-800">ระบบจะส่งสลิปให้เจ้าหน้าที่ตรวจสอบทางไลน์เพื่ออนุมัติ</p>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Re-verify action */}
                        <div className="flex justify-end pt-0.5">
                          <button
                            type="button"
                            onClick={() => runAiVerification(slipFile)}
                            disabled={isVerifying}
                            className="text-[11px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-blue-50 transition"
                          >
                            <RefreshCw size={12} className={isVerifying ? 'animate-spin' : ''} /> วิเคราะห์สลิปใหม่อีกครั้ง
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Submit Button */}
                    <button
                      onClick={handleSubmit}
                      disabled={!slipFile || isVerifying}
                      className={`w-full py-4 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed text-base ${
                        verificationMode === 'ai' && verificationResult?.isValid
                          ? 'bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800'
                          : verificationMode === 'ai' && verificationResult && !verificationResult.isValid
                            ? 'bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-700 hover:to-orange-800'
                            : 'bg-gradient-to-r from-primary to-blue-700 hover:from-primary/90 hover:to-blue-800'
                      }`}
                    >
                      {isVerifying ? (
                        <span className="animate-pulse flex items-center gap-2">
                          <RefreshCw size={18} className="animate-spin" /> กำลังประมวลผล...
                        </span>
                      ) : (
                        verificationMode === 'ai' && verificationResult?.isValid ? (
                          <>ยืนยันและตัดยอดชำระเงินทันที <CheckCircle size={20} /></>
                        ) : verificationMode === 'ai' && verificationResult && !verificationResult.isValid ? (
                          <>ส่งให้เจ้าหน้าที่ตรวจสอบทางไลน์ <UserCheck size={20} /></>
                        ) : (
                          <>ยืนยันและส่งสลิปชำระเงิน <CheckCircle size={20} /></>
                        )
                      )}
                    </button>

                  </div>
                )}

                <div className="pt-2">
                  <button
                    onClick={() => setStep(2)}
                    className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-sm"
                    disabled={isVerifying}
                  >
                    ย้อนกลับขั้นตอนชำระเงิน
                  </button>
                </div>

              </div>
            )}

          </div>
        </div>
      </div>

      {/* Offscreen Standard A4 Receipt for html2canvas */}
      <div 
        style={{ 
          position: 'fixed', 
          left: '-9999px', 
          top: 0, 
          width: '794px', 
          zIndex: -100, 
          pointerEvents: 'none' 
        }}
        aria-hidden="true"
      >
        <StandardReceiptA4 
          ref={receiptRef} 
          paymentData={receiptDataState || {
            invoiceID: 'preview',
            ID_contact: idContact,
            name: Name,
            address: contract?.add_loan,
            tree: totalTree,
            int: totalInterest,
            feedisapp: lateInterest,
            feefollow: collectionFee,
            number_pay: selectedInstallments?.map(i => i.number_pay).join(','),
            month_loan: contract?.month_loan,
            resttree: contract?.total_treerest,
            date_receipt: new Date().toISOString().split('T')[0],
          }} 
        />
      </div>

    </div>
  );
};

export default PaymentWizard;
