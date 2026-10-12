"use client";

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import {
  CheckCircle2, XCircle, AlertTriangle, FileText, ArrowLeft,
  ExternalLink, ShieldCheck, Clock, User, CreditCard, DollarSign,
  Maximize2, RefreshCw, Eye, Check, X
} from 'lucide-react';
import {
  fetchPendingPaymentById,
  updatePendingPaymentStatus,
  fetchContactById,
} from '../../services/api';
import { submitPaymentSettlement } from '../../services/paymentSettlement';
import { addUsedQRCode, COMPANY_BANK_INFO, validateSlipDate } from '../../utils/slipVerification';
import { notifyLineGroup } from '../../utils/lineNotifyHelper';
import StandardReceiptA4 from '../../components/StandardReceiptA4';
import { sendReceiptToGoogleAppsScript } from '../../utils/senttoAppscript';

export const dynamic = 'force-dynamic';

function ReviewSlipContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [record, setRecord] = useState(null);
  const [contract, setContract] = useState(null);
  const [error, setError] = useState(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const receiptRef = useRef(null);
  const [receiptDataState, setReceiptDataState] = useState(null);

  // Load pending payment data
  const loadData = async () => {
    if (!id) {
      setError('ไม่พบรหัสคำขอตรวจสอบสลิป (Missing ID)');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await fetchPendingPaymentById(id);
      if (!data) {
        setError('ไม่พบข้อมูลคำขอตรวจสอบสลิปนี้ในระบบ อาจถูกลบไปแล้ว');
        setLoading(false);
        return;
      }
      setRecord(data);

      if (data.contract_id) {
        const cData = await fetchContactById(data.contract_id).catch(() => null);
        if (cData) setContract(cData);
      }
    } catch (err) {
      console.error('Error fetching pending payment:', err);
      setError(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  // Handle 1-Click Approve
  const handleApprove = async () => {
    if (!record || processing) return;

    const confirmRes = await Swal.fire({
      title: 'ยืนยันอนุมัติการชำระเงิน?',
      html: `
        <div class="text-left text-sm space-y-2 p-2">
          <p>👤 ผู้กู้: <b>${record.customer_name || '-'}</b></p>
          <p>📄 สัญญาเลขที่: <b>${record.contract_id}</b></p>
          <p>💰 ยอดชำระ: <b class="text-emerald-600 text-base">${Number(record.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</b></p>
          <div class="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-2 rounded mt-2">
            ⚠️ เมื่อกดยืนยัน ระบบจะทำการตัดยอดหนี้ในระบบและออกเลขที่ใบเสร็จทันที
          </div>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '✅ ยืนยันอนุมัติและออกใบเสร็จ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#16a34a',
      cancelButtonColor: '#64748b',
    });

    if (!confirmRes.isConfirmed) return;

    try {
      setProcessing(true);

      // 1. Submit Settlement (Deducts debt, generates invoice ID, creates transaction)
      const settlementResult = await submitPaymentSettlement({
        selectedInstallments: record.selected_installments || [],
        totalTree: Number(record.total_tree || 0),
        totalInterest: Number(record.total_interest || 0),
        rest: Number(record.rest || contract?.total_treerest || 0),
        customerName: record.customer_name || '',
        contractId: record.contract_id,
        accumulate: record.accumulate || contract?.accumulate,
        slipUrl: record.slip_url,
        contract: contract || {},
      });

      const invoiceID = settlementResult.invoiceID;

      // 2. Prepare master receipt data for A4 template
      const sortedInsts = [...(record.selected_installments || [])].sort((a, b) => a.number_pay - b.number_pay);
      const numPayLabel = sortedInsts.map(i => i.number_pay).join(',');
      const masterReceiptData = {
        invoiceID: invoiceID,
        ID_contact: record.contract_id,
        Name_loan: record.customer_name,
        name: record.customer_name,
        userID: contract?.userID || '',
        add_loan: contract?.add_loan || '-',
        address: contract?.add_loan || '-',
        tree: record.total_tree,
        int: record.total_interest,
        feedisapp: 0,
        feefollow: 0,
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

      // 3. Render A4 receipt to canvas and post to Google Apps Script / LINE
      let generatedReceiptUrl = null;
      try {
        await new Promise(r => setTimeout(r, 350));
        const gasRes = await sendReceiptToGoogleAppsScript(receiptRef, masterReceiptData);
        if (gasRes && (gasRes.imageUrl || gasRes.url)) {
          generatedReceiptUrl = gasRes.imageUrl || gasRes.url;
        }
      } catch (gasErr) {
        console.warn('sendReceiptToGoogleAppsScript error:', gasErr);
      }

      // 4. Mark pending_payment as approved
      const updated = await updatePendingPaymentStatus(record.id, {
        status: 'approved',
        invoice_id: invoiceID,
        reviewed_by: 'เจ้าหน้าที่ (1-Click Approval)',
        reviewed_at: new Date().toISOString(),
      });

      // 5. Register slip hash as used
      if (record.slip_hash) {
        await addUsedQRCode(record.slip_hash, '', {
          amount: record.amount,
          contractId: record.contract_id,
          userName: record.customer_name,
          slipUrl: record.slip_url,
        });
      }

      // 6. Notify LINE Group of completion
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const invoiceUrl = `${baseUrl}/Invoice?invoiceID=${encodeURIComponent(invoiceID)}`;

      await notifyLineGroup({
        amount: record.amount,
        userName: record.customer_name,
        contractId: record.contract_id,
        imageUrl: generatedReceiptUrl || record.slip_url,
        isAutoApproved: false,
        invoiceId: invoiceID,
        invoiceUrl: invoiceUrl,
        reason: `✅ เจ้าหน้าที่อนุมัติเรียบร้อย ออกใบเสร็จเลขที่ ${invoiceID}`,
      }).catch((err) => console.error('Failed to notify LINE:', err));

      setRecord(updated || { ...record, status: 'approved', invoice_id: invoiceID });

      Swal.fire({
        icon: 'success',
        title: 'อนุมัติการชำระเงินเรียบร้อย!',
        html: `
          <div class="text-left text-sm space-y-2">
            <p class="text-emerald-700 font-bold">ออกเลขที่ใบเสร็จ: ${invoiceID}</p>
            <p>ระบบได้ทำการตัดยอดหนี้ของสัญญา <b>${record.contract_id}</b> เรียบร้อยแล้ว</p>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: '📄 เปิดดูใบเสร็จรับเงิน',
        cancelButtonText: 'ปิด',
        confirmButtonColor: '#0284c7',
        cancelButtonColor: '#64748b',
      }).then((result) => {
        if (result.isConfirmed) {
          window.open(invoiceUrl, '_blank');
        }
      });
    } catch (err) {
      console.error('Approval failed:', err);
      Swal.fire('เกิดข้อผิดพลาดในการอนุมัติ', err.message || 'ไม่สามารถตัดยอดได้', 'error');
    } finally {
      setProcessing(false);
    }
  };

  // Handle Reject
  const handleReject = async () => {
    if (!record || processing) return;

    const { value: rejectReason } = await Swal.fire({
      title: 'ระบุเหตุผลในการปฏิเสธสลิป',
      input: 'select',
      inputOptions: {
        'ยอดเงินที่โอนไม่ตรงกับยอดที่ต้องชำระ': 'ยอดเงินที่โอนไม่ตรงกับยอดที่ต้องชำระ',
        'รูปสลิปไม่ชัดเจน / ไม่สามารถตรวจสอบได้': 'รูปสลิปไม่ชัดเจน / ไม่สามารถตรวจสอบได้',
        'บัญชีปลายทางไม่ถูกต้อง': 'บัญชีปลายทางไม่ถูกต้อง',
        'สลิปนี้ถูกใช้งานไปแล้ว (สลิปซ้ำ)': 'สลิปนี้ถูกใช้งานไปแล้ว (สลิปซ้ำ)',
        'other': 'อื่นๆ (ระบุข้อความเอง)',
      },
      inputPlaceholder: 'เลือกเหตุผลการปฏิเสธ',
      showCancelButton: true,
      confirmButtonText: 'ถัดไป',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc2626',
    });

    if (!rejectReason) return;

    let finalReason = rejectReason;
    if (rejectReason === 'other') {
      const { value: customText } = await Swal.fire({
        title: 'ระบุเหตุผลเพิ่มเติม',
        input: 'text',
        inputPlaceholder: 'พิมพ์เหตุผลที่ปฏิเสธสลิป...',
        showCancelButton: true,
        confirmButtonText: 'ยืนยันปฏิเสธ',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#dc2626',
      });
      if (!customText) return;
      finalReason = customText;
    }

    try {
      setProcessing(true);
      const updated = await updatePendingPaymentStatus(record.id, {
        status: 'rejected',
        reject_reason: finalReason,
        reviewed_by: 'เจ้าหน้าที่',
        reviewed_at: new Date().toISOString(),
      });

      // Notify LINE
      await notifyLineGroup({
        amount: record.amount,
        userName: record.customer_name,
        contractId: record.contract_id,
        imageUrl: record.slip_url,
        reason: `❌ เจ้าหน้าที่ปฏิเสธสลิป: ${finalReason}`,
      }).catch((err) => console.error('Failed to notify LINE:', err));

      setRecord(updated || { ...record, status: 'rejected', reject_reason: finalReason });

      Swal.fire({
        icon: 'info',
        title: 'บันทึกการปฏิเสธเรียบร้อย',
        text: `เหตุผล: ${finalReason}`,
        confirmButtonColor: '#0284c7',
      });
    } catch (err) {
      console.error('Reject failed:', err);
      Swal.fire('เกิดข้อผิดพลาด', err.message || 'ไม่สามารถบันทึกได้', 'error');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200 flex flex-col items-center gap-4 max-w-sm w-full">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/20 border-t-primary" />
          <h3 className="text-base font-bold text-slate-800">กำลังโหลดข้อมูลสลิป...</h3>
          <p className="text-xs text-slate-500 text-center">ระบบกำลังดึงข้อมูลสลิปและสัญญาจากฐานข้อมูล</p>
        </div>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-red-200 flex flex-col items-center gap-4 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
            <AlertTriangle size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-800">ไม่สามารถเปิดหน้าตรวจสอบได้</h3>
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-2 px-6 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-semibold hover:bg-slate-700 transition"
          >
            กลับสู่หน้าหลัก
          </button>
        </div>
      </div>
    );
  }

  const aiData = record.ai_result?.extractedData || {};
  const isApproved = record.status === 'approved';
  const isRejected = record.status === 'rejected';
  const isPending = record.status === 'pending';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 pb-16 font-sans">
      {/* App Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
              TS
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                ระบบตรวจสอบสลิปและอนุมัติชำระเงิน
              </h1>
              <p className="text-xs text-slate-500">บริษัท ทรัพย์สำราญ พิโก จำกัด (เจ้าหน้าที่)</p>
            </div>
          </div>

          {/* Status Pill */}
          <div>
            {isApproved && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <CheckCircle2 size={14} /> อนุมัติแล้ว
              </span>
            )}
            {isRejected && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
                <XCircle size={14} /> ปฏิเสธแล้ว
              </span>
            )}
            {isPending && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                <Clock size={14} /> รอดำเนินการตรวจสอบ
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Approved Banner */}
        {isApproved && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <p className="font-bold text-emerald-900 text-sm sm:text-base">
                  รายการนี้ได้รับการอนุมัติและออกใบเสร็จเรียบร้อยแล้ว
                </p>
                <p className="text-xs text-emerald-700">
                  เลขที่ใบเสร็จ: <b className="font-mono text-sm">{record.invoice_id}</b> | โดย: {record.reviewed_by || 'เจ้าหน้าที่'}
                </p>
              </div>
            </div>
            {record.invoice_id && (
              <a
                href={`/Invoice?invoiceID=${encodeURIComponent(record.invoice_id)}`}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow transition"
              >
                <FileText size={16} /> เปิดดูใบเสร็จรับเงิน
              </a>
            )}
          </div>
        )}

        {/* Rejected Banner */}
        {isRejected && (
          <div className="mb-6 p-4 bg-red-50 border border-red-300 rounded-2xl flex items-center gap-3 text-red-900 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shrink-0">
              <XCircle size={24} />
            </div>
            <div>
              <p className="font-bold text-sm sm:text-base">สลิปนี้ถูกปฏิเสธแล้ว</p>
              <p className="text-xs text-red-700">
                เหตุผล: <b>{record.reject_reason || 'ข้อมูลไม่ถูกต้อง'}</b> | โดย: {record.reviewed_by || 'เจ้าหน้าที่'}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Slip Image & AI Analysis (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Slip Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <CreditCard size={18} className="text-slate-600" />
                  <h3 className="font-bold text-sm text-slate-800">สลิปการโอนเงินของลูกค้า</h3>
                </div>
                {record.slip_url && (
                  <button
                    onClick={() => setIsImageModalOpen(true)}
                    className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
                  >
                    <Maximize2 size={13} /> ดูภาพขยาย
                  </button>
                )}
              </div>

              <div className="p-4 flex flex-col items-center justify-center bg-slate-900/5 min-h-[360px]">
                {record.slip_url ? (
                  <div
                    onClick={() => setIsImageModalOpen(true)}
                    className="cursor-zoom-in group relative rounded-xl overflow-hidden border border-slate-200 bg-white max-w-sm shadow"
                  >
                    <img
                      src={record.slip_url}
                      alt="Slip"
                      className="max-h-[460px] w-auto object-contain transition group-hover:scale-[1.02]"
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold gap-1.5 backdrop-blur-[1px]">
                      <Eye size={16} /> คลิกเพื่อดูภาพเต็ม
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-slate-400 py-12">
                    <p className="text-sm">ไม่มีไฟล์รูปสลิป</p>
                  </div>
                )}
              </div>
            </div>

            {/* AI Audit Breakdown Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-primary" />
                  <h3 className="font-bold text-sm text-slate-800">ผลการวิเคราะห์ด้วย AI (Gemini Flash)</h3>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-md font-mono bg-slate-100 text-slate-600">
                  Confidence: {record.ai_result?.confidence ? `${Math.round(record.ai_result.confidence * 100)}%` : '0%'}
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                {/* 1. ยอดเงินในสลิป: ระบบต้องการ vs AI อ่านได้ */}
                {(() => {
                  const expectedAmt = Number(record.amount || 0);
                  const extractedAmt = parseFloat(aiData.amount || 0);
                  const isAmtMatch = !isNaN(extractedAmt) && extractedAmt > 0 && Math.abs(extractedAmt - expectedAmt) < 1.0;
                  return (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700">ยอดเงินในสลิป:</span>
                        {isAmtMatch ? (
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Check size={13} /> ตรงกัน
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-red-700 bg-red-100 border border-red-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <X size={13} /> ไม่ตรงกัน
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-white p-2 rounded-lg border border-slate-100">
                        <div>
                          <span className="text-slate-400 block text-[10px]">ระบบต้องการ</span>
                          <span className="font-bold text-slate-800 font-mono">
                            {expectedAmt.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-400 block text-[10px]">AI อ่านได้</span>
                          <span className={`font-bold font-mono ${isAmtMatch ? 'text-emerald-700' : 'text-red-600'}`}>
                            {aiData.amount
                              ? `${extractedAmt.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`
                              : 'ไม่พบยอดเงินในสลิป'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 2. บัญชีปลายทาง: ตรงกับ SCB 426-047180-9 หรือไม่ */}
                {(() => {
                  const rawAcc = String(aiData.account_number || '').replace(/[^0-9]/g, '');
                  const isAccMatch = Boolean(
                    rawAcc.includes('4260471809') ||
                    (aiData.account_number && (
                      aiData.account_number.includes('4260471809') ||
                      aiData.account_number.includes('426-047180-9')
                    )) ||
                    (rawAcc.length >= 4 && '4260471809'.endsWith(rawAcc)) ||
                    (rawAcc.endsWith('1809') && rawAcc.startsWith('426'))
                  );
                  return (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700">บัญชีปลายทาง:</span>
                        {isAccMatch ? (
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Check size={13} /> ตรงกับ SCB 426-047180-9
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <AlertTriangle size={13} /> ไม่ตรงกับ SCB 426-047180-9
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-white p-2 rounded-lg border border-slate-100">
                        <div>
                          <span className="text-slate-400 block text-[10px]">บัญชีเป้าหมาย</span>
                          <span className="font-bold text-slate-800 font-mono">SCB 426-047180-9</span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-400 block text-[10px]">AI อ่านได้</span>
                          <span className={`font-bold font-mono ${isAccMatch ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {aiData.account_number || aiData.bank_name || 'ไม่พบเลขบัญชีในสลิป'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 3. ชื่อบัญชี: ตรงกับ บริษัท ทรัพย์สำราญ พิโก จำกัด หรือไม่ */}
                {(() => {
                  const recName = (aiData.recipient_name || '').toLowerCase();
                  const isNameMatch = ['ทรัพย์สำราญ', 'SUB SUM RAN'].some(v => recName.includes(v.toLowerCase()));
                  return (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700">ชื่อบัญชี:</span>
                        {isNameMatch ? (
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Check size={13} /> ตรงกับ บริษัท ทรัพย์สำราญ พิโก จำกัด
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <AlertTriangle size={13} /> ไม่ตรงกับ บริษัท ทรัพย์สำราญ พิโก จำกัด
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-white p-2 rounded-lg border border-slate-100 items-center">
                        <div>
                          <span className="text-slate-400 block text-[10px]">ชื่อบัญชีเป้าหมาย</span>
                          <span className="font-bold text-slate-800 text-[11px]">บริษัท ทรัพย์สำราญ พิโก จำกัด</span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-400 block text-[10px]">AI อ่านได้</span>
                          <span className={`font-bold text-[11px] truncate block ${isNameMatch ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {aiData.recipient_name || 'ไม่พบชื่อบัญชีในสลิป'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 4. วันที่โอนในสลิป: ตรวจสอบวันนี้หรือเมื่อวาน (ไม่เกิน 48 ชม.) */}
                {(() => {
                  const dateComp = record.ai_result?.comparison?.date;
                  const dateValidation = dateComp || validateSlipDate(aiData.transfer_date, aiData.raw_date_text, new Date(record.created_at || Date.now()));
                  const isDateValid = dateValidation.isValid;
                  const actualDateStr = dateValidation.formattedDate || aiData.transfer_date || 'ไม่พบวันที่';

                  return (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700">วันที่โอนในสลิป:</span>
                        {isDateValid ? (
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Check size={13} /> {dateValidation.reason || 'โอนภายใน 48 ชม.'}
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-red-700 bg-red-100 border border-red-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <X size={13} /> {dateValidation.reason || 'เกิน 48 ชม.'}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-white p-2 rounded-lg border border-slate-100 items-center">
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

              {/* AI Diagnostic Notes */}
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">ข้อสังเกตของ AI:</p>
                  <p className="mt-0.5 text-slate-700">
                    {record.ai_result?.message || record.ai_result?.error || 'ต้องการให้เจ้าหน้าที่ตรวจสอบความถูกต้องก่อนอนุมัติ'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Contract Information & 1-Click Action (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Payment & Contract Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User size={18} className="text-slate-700" />
                  <h3 className="font-bold text-sm text-slate-900">ข้อมูลสัญญาและยอดชำระ</h3>
                </div>
                <span className="font-mono text-xs px-2 py-0.5 bg-primary/10 text-primary font-bold rounded">
                  {record.contract_id}
                </span>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-xs text-slate-500">ชื่อผู้กู้</span>
                  <span className="font-bold text-slate-900">{record.customer_name || '-'}</span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-xs text-slate-500">งวดที่ชำระ</span>
                  <span className="font-bold text-slate-900">
                    {record.selected_installments?.map((inst) => `งวดที่ ${inst.number_pay}`).join(', ') || '-'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-xs text-slate-500">เงินต้นตัดชำระ</span>
                  <span className="font-mono text-slate-800">
                    {Number(record.total_tree || 0).toLocaleString()} ฿
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-xs text-slate-500">ดอกเบี้ย</span>
                  <span className="font-mono text-slate-800">
                    {Number(record.total_interest || 0).toLocaleString()} ฿
                  </span>
                </div>

                {contract && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-xs text-slate-500">หนี้เงินต้นคงเหลือปัจจุบัน</span>
                    <span className="font-mono font-bold text-red-600">
                      {Number(contract.total_treerest || 0).toLocaleString()} ฿
                    </span>
                  </div>
                )}

                {/* Total highlight box */}
                <div className="p-3.5 bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 rounded-xl flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-900">ยอดชำระทั้งหมด</span>
                  <span className="text-xl font-bold font-mono text-sky-700">
                    {Number(record.amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿
                  </span>
                </div>
              </div>
            </div>

            {/* 1-Click Action Box */}
            {isPending && (
              <div className="bg-white rounded-2xl border-2 border-primary/30 shadow-md p-5 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <h3 className="font-bold text-sm text-slate-900">การดำเนินการของเจ้าหน้าที่ (1-Click)</h3>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  กรุณาตรวจสอบรูปสลิปและยอดเงินด้านซ้ายมือ หากถูกต้องครบถ้วน สามารถกดปุ่มเพื่ออนุมัติและออกใบเสร็จได้ทันทีครับ
                </p>

                <div className="space-y-3 pt-2">
                  <button
                    onClick={handleApprove}
                    disabled={processing}
                    className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50 text-white font-bold text-sm sm:text-base rounded-xl shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {processing ? (
                      <RefreshCw size={18} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={18} />
                    )}
                    ⚡ อนุมัติและออกใบเสร็จ (1-Click)
                  </button>

                  <button
                    onClick={handleReject}
                    disabled={processing}
                    className="w-full py-2.5 px-4 bg-slate-100 hover:bg-red-50 hover:text-red-700 active:scale-[0.99] disabled:opacity-50 text-slate-700 font-semibold text-xs sm:text-sm rounded-xl border border-slate-200 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <XCircle size={16} /> ปฏิเสธสลิป / แจ้งให้อัปโหลดใหม่
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Fullscreen Image Modal */}
      {isImageModalOpen && (
        <div
          onClick={() => setIsImageModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
        >
          <div className="relative max-w-3xl max-h-[90vh] bg-transparent">
            <button
              onClick={() => setIsImageModalOpen(false)}
              className="absolute -top-10 right-0 text-white hover:text-slate-300 font-bold text-sm flex items-center gap-1 cursor-pointer"
            >
              <XCircle size={20} /> ปิดหน้าต่าง
            </button>
            <img
              src={record.slip_url}
              alt="Full Slip"
              className="max-h-[85vh] w-auto rounded-lg shadow-2xl object-contain mx-auto"
            />
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
            invoiceID: record?.invoice_id || 'preview',
            ID_contact: record?.contract_id,
            name: record?.customer_name,
            address: contract?.add_loan,
            tree: record?.total_tree,
            int: record?.total_interest,
            number_pay: record?.selected_installments?.map(i => i.number_pay).join(','),
            month_loan: contract?.month_loan,
            resttree: contract?.total_treerest,
            date_receipt: new Date().toISOString().split('T')[0],
          }} 
        />
      </div>
    </div>
  );
}

export default function ReviewSlipPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary/20 border-t-primary" />
        </div>
      }
    >
      <ReviewSlipContent />
    </Suspense>
  );
}
