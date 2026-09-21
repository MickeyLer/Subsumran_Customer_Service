"use client";

import React, { useState, useEffect } from 'react';
import generatePayload from 'promptpay-qr';
import QRious from 'qrious';
import Swal from 'sweetalert2';
import { Camera, UploadCloud, CheckCircle, ChevronRight, X, Copy, QrCode, AlertTriangle, Check } from 'lucide-react';
import { submitPaymentSettlement } from '../services/paymentSettlement';
import { calculateOverdueFee } from '../utils/installmentProgression';

/**
 * PaymentWizard — รองรับการชำระหลายงวดพร้อมกัน
 * Props:
 *  - selectedInstallments: Array<{ID, Id_contact, number_pay, tree, interest, begin_date, rest}>
 *  - totalTree: number  (sum of tree)
 *  - totalInterest: number (sum of interest)
 *  - rest: number (total_treerest of the contact)
 *  - Name: string
 *  - idContact: string
 *  - accumulate: any
 *  - setOpenModal: (bool) => void
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
}) => {
  const onClose = () => setOpenModal(false);
  const onComplete = () => window.location.reload();

  const [step, setStep] = useState(1);
  const [qrSrc, setQrSrc] = useState('');
  const [slipFile, setSlipFile] = useState(null);
  const [slipPreview, setSlipPreview] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const [feedisapp, setFeedisapp] = useState(0);
  const [totalpay, setTotalpay] = useState(0);

  // Earliest overdue row — used for fee calculation
  const earliestRow = selectedInstallments.length > 0
    ? selectedInstallments.reduce((prev, curr) =>
        new Date(prev.begin_date) < new Date(curr.begin_date) ? prev : curr
      )
    : null;

  useEffect(() => {
    // Calculate late fee from the earliest overdue installment
    const calculatedFee = earliestRow ? calculateOverdueFee(earliestRow.begin_date) : 0;
    setFeedisapp(calculatedFee);

    const calculatedTotal = totalTree + totalInterest + calculatedFee;
    setTotalpay(calculatedTotal);

    if (calculatedTotal > 0) {
      try {
        const payload = generatePayload('0123456789123', { amount: calculatedTotal });
        const qr = new QRious({ value: payload, size: 250, level: 'H' });
        setQrSrc(qr.toDataURL());
      } catch (err) {
        console.error("QR Generation error", err);
      }
    }
  }, [totalTree, totalInterest, earliestRow]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSlipFile(file);
      setSlipPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async () => {
    if (!slipFile) {
      Swal.fire('ข้อผิดพลาด', 'กรุณาอัพโหลดสลิป', 'error');
      return;
    }
    if (selectedInstallments.length === 0) {
      Swal.fire('ข้อผิดพลาด', 'ไม่พบงวดที่เลือก', 'error');
      return;
    }

    setIsUploading(true);
    try {
      await submitPaymentSettlement({
        selectedInstallments,
        totalTree,
        totalInterest,
        rest,
        customerName: Name,
        contractId: idContact,
        accumulate,
        slipFile,
      });

      Swal.fire('สำเร็จ', 'บันทึกการชำระเงินเรียบร้อยแล้ว กรุณารอการตรวจสอบ', 'success');
      onComplete();
      onClose();
    } catch (err) {
      console.error(err);
      Swal.fire('ข้อผิดพลาด', err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const sortedSelected = [...selectedInstallments].sort((a, b) => a.number_pay - b.number_pay);

  return (
    <div className="fixed inset-0 z-50 bg-surface flex flex-col w-full h-full overflow-y-auto animate-fade-in font-sans">
      {/* Header & Stepper Section */}
      <div className="bg-primary text-white p-4 sm:p-6 border-b-2 border-secondary-fixed sticky top-0 z-10 shadow-md">
        <div className="flex justify-between items-center mb-6 max-w-xl mx-auto w-full">
          <h2 className="text-xl sm:text-2xl font-bold font-sans text-secondary-fixed">แจ้งชำระค่างวด</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white transition p-2 bg-white/10 hover:bg-white/20 rounded-full" aria-label="ปิด">
            <X size={24} />
          </button>
        </div>

        {/* Stepper */}
        <div className="relative z-10 px-4 max-w-xl mx-auto w-full mb-1">
          {/* Progress Line Track */}
          <div className="absolute top-[18px] left-9 right-9 h-1 bg-white/20 -z-10 rounded-full">
            <div 
              className="h-full bg-secondary-fixed transition-all duration-300 rounded-full"
              style={{ width: `${((step - 1) / 2) * 100}%` }}
            />
          </div>

          <div className="flex justify-between items-start">
            {[
              { id: 1, label: 'ตรวจสอบยอด' },
              { id: 2, label: 'สแกน QR' },
              { id: 3, label: 'แนบสลิป' },
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
                    {isCompleted ? (
                      <Check size={18} className="stroke-[3]" />
                    ) : (
                      <span>{s.id}</span>
                    )}
                  </div>
                  <span
                    className={`mt-1.5 text-[11px] sm:text-xs font-sans transition-colors duration-200 text-center ${
                      isActive
                        ? 'text-secondary-fixed font-bold'
                        : isCompleted
                        ? 'text-white/90 font-medium'
                        : 'text-white/60 font-normal'
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
      <div className="flex-grow p-4 sm:p-8 bg-surface overflow-y-auto">
        <div className="max-w-xl mx-auto w-full pb-16">
          {/* Step 1: Summary */}
          {step === 1 && (
            <div className="animate-fade-in">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-primary mb-1 font-sans">ตรวจสอบยอดชำระ</h3>
                <p className="text-on-surface-variant font-sans text-sm">สัญญาเลขที่ {idContact} — ชำระ {selectedInstallments.length} งวด</p>
              </div>

              {/* Installment list */}
              <div className="bg-slate-50 rounded-lg border border-outline-variant/30 mb-4 overflow-hidden">
                <div className="px-4 py-2 border-b border-outline-variant/20 text-xs font-bold text-on-surface-variant uppercase tracking-wider font-sans">
                  งวดที่เลือกชำระ
                </div>
                {sortedSelected.map((inst, i) => (
                  <div key={i} className="flex justify-between items-center px-4 py-3 border-b border-outline-variant/10 last:border-0">
                    <span className="text-sm font-sans text-on-surface">
                      งวด {inst.number_pay}
                      {new Date(inst.begin_date) < new Date() && inst.status !== 1 && (
                        <span className="ml-2 text-red-600 text-xs font-bold">(ค้างชำระ)</span>
                      )}
                    </span>
                    <span className="text-sm font-bold text-primary font-sans">
                      {(Number(inst.tree) + Number(inst.interest)).toLocaleString()} ฿
                    </span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="bg-white rounded-lg shadow-sm border border-outline-variant/30 overflow-hidden mb-6">
                <div className="flex justify-between p-4 border-b border-outline-variant/10">
                  <span className="text-on-surface-variant font-sans">เงินต้นรวม</span>
                  <span className="font-semibold text-primary font-sans">{totalTree.toLocaleString()} ฿</span>
                </div>
                <div className="flex justify-between p-4 border-b border-outline-variant/10">
                  <span className="text-on-surface-variant font-sans">ดอกเบี้ยรวม</span>
                  <span className="font-semibold text-primary font-sans">{totalInterest.toLocaleString()} ฿</span>
                </div>
                {feedisapp > 0 && (
                  <div className="flex justify-between p-4 border-b border-outline-variant/10 text-red-600 font-sans">
                    <span className="flex items-center gap-1">
                      <AlertTriangle size={14} /> ค่าปรับล่าช้า
                    </span>
                    <span className="font-semibold">{feedisapp.toLocaleString()} ฿</span>
                  </div>
                )}
                <div className="flex justify-between p-5 bg-slate-50/80">
                  <span className="text-lg font-bold text-primary font-sans">ยอดรวมทั้งสิ้น</span>
                  <span className="text-2xl font-black text-secondary font-sans">{totalpay.toLocaleString()} ฿</span>
                </div>
              </div>

              <button
                onClick={() => setStep(2)}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-primary/20"
              >
                ดำเนินการต่อ <ChevronRight size={20} />
              </button>
            </div>
          )}

          {/* Step 2: QR Code */}
          {step === 2 && (
            <div className="animate-fade-in flex flex-col items-center">
              <h3 className="text-xl font-bold text-primary mb-6 font-sans">สแกนเพื่อชำระเงิน</h3>

              <div className="bg-white p-6 rounded-lg shadow-md border border-outline-variant/30 mb-6 flex flex-col items-center w-full">
                {qrSrc ? (
                  <img src={qrSrc} alt="PromptPay QR" className="w-56 h-56 object-contain" />
                ) : (
                  <div className="w-56 h-56 bg-surface rounded-lg flex flex-col items-center justify-center text-outline">
                    <QrCode size={48} className="mb-2" />
                    <span className="font-sans">กำลังสร้าง QR...</span>
                  </div>
                )}
                <div className="mt-4 text-center">
                  <p className="text-sm text-on-surface-variant font-sans">บริษัท ทรัพย์สำราญ พีโก จำกัด</p>
                  <p className="font-bold text-lg text-primary mt-1 font-sans">ยอดชำระ: {totalpay.toLocaleString()} บาท</p>
                </div>
              </div>

              <div className="bg-secondary-container/10 border border-secondary-fixed/50 rounded-lg p-4 mb-6 w-full text-center flex flex-col items-center gap-2">
                <span className="text-sm font-bold text-secondary font-sans">หรือโอนเข้าบัญชีธนาคาร SCB</span>
                <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg font-mono font-bold text-lg text-primary shadow-sm">
                  426-047180-9
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('4260471809');
                      Swal.fire({ icon: 'success', title: 'คัดลอกสำเร็จ', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
                    }}
                    className="text-secondary hover:text-secondary-container p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center bg-secondary-container/20 hover:bg-secondary-container/40 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50"
                    aria-label="คัดลอกเลขบัญชี 426-047180-9"
                  >
                    <Copy size={20} />
                  </button>
                </div>
              </div>

              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 bg-white border-2 border-outline-variant/30 text-on-surface-variant font-bold py-4 rounded-lg transition hover:bg-slate-50 font-sans"
                >
                  ย้อนกลับ
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-lg flex items-center justify-center gap-2 transition shadow-lg font-sans"
                >
                  แนบสลิป <UploadCloud size={20} />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Upload Slip */}
          {step === 3 && (
            <div className="animate-fade-in flex flex-col items-center">
              <h3 className="text-xl font-bold text-primary mb-6 font-sans">อัพโหลดหลักฐานการโอน</h3>

              <div className="w-full mb-6">
                <input
                  type="file"
                  accept="image/*"
                  id="slip-upload"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <label
                  htmlFor="slip-upload"
                  className={`w-full flex flex-col items-center justify-center border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                    slipPreview ? 'border-primary bg-primary/5 p-2' : 'border-outline-variant/50 hover:border-primary hover:bg-slate-50 p-10'
                  }`}
                >
                  {slipPreview ? (
                    <img src={slipPreview} alt="Slip Preview" className="max-h-[300px] object-contain rounded-lg shadow-sm" />
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
                        <Camera size={32} />
                      </div>
                      <span className="font-bold text-primary font-sans">แตะเพื่อเลือกรูปภาพสลิป</span>
                      <span className="text-sm text-on-surface-variant mt-1 font-sans">รองรับ JPG, PNG</span>
                    </>
                  )}
                </label>
              </div>

              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setStep(2)}
                  className="w-1/3 bg-white border-2 border-outline-variant/30 text-on-surface-variant font-bold py-4 rounded-lg transition hover:bg-slate-50 font-sans"
                  disabled={isUploading}
                >
                  ย้อนกลับ
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!slipFile || isUploading}
                  className={`flex-1 font-bold py-4 rounded-lg flex items-center justify-center gap-2 transition shadow-lg font-sans ${
                    !slipFile || isUploading
                      ? 'bg-slate-200 text-on-surface-variant/40 cursor-not-allowed'
                      : 'bg-primary text-white hover:bg-primary-container'
                  }`}
                >
                  {isUploading ? (
                    <span className="animate-pulse font-sans">กำลังบันทึก...</span>
                  ) : (
                    <>ยืนยันการชำระเงิน <CheckCircle size={20} /></>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

};

export default PaymentWizard;
