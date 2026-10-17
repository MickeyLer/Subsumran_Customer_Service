"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Swal from 'sweetalert2';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  User,
  ShieldCheck,
  Clock,
  CreditCard,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  RefreshCw
} from 'lucide-react';

export const dynamic = 'force-dynamic';

function ReviewRegisterContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // โหลดข้อมูลคำขอสมัครจาก API
  const loadData = async () => {
    if (!id) {
      setError('ไม่พบรหัสคำขอตรวจสอบ (Missing Registration ID)');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/registerNotify?id=${encodeURIComponent(id)}`);
      const resJson = await res.json();

      if (!res.ok || !resJson.success) {
        throw new Error(resJson.error || 'ไม่สามารถโหลดข้อมูลคำขอได้');
      }

      setData(resJson);
    } catch (err) {
      console.error('Error fetching registration:', err);
      setError(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  // ฟังก์ชันคัดลอก LINE User ID
  const handleCopyUserId = (text) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ดำเนินการอนุมัติ (Approve)
  const handleApprove = async () => {
    if (!data?.registration || processing) return;
    const { registration, contract, nameMatch } = data;

    const confirmRes = await Swal.fire({
      title: 'ยืนยันการผูกสัญญา?',
      html: `
        <div class="text-left text-sm space-y-2 p-2">
          <p>👤 ชื่อผู้กู้: <b>${registration.borrower_name}</b></p>
          <p>📄 เลขที่สัญญา: <b>${registration.contract_no}</b></p>
          <p>🆔 LINE User ID: <code class="text-xs bg-gray-100 p-1 rounded font-mono">${registration.line_user_id}</code></p>
          ${!nameMatch?.isMatch ? `
            <div class="bg-amber-50 border border-amber-300 text-amber-800 text-xs p-2 rounded mt-2">
              ⚠️ <b>คำเตือน:</b> ชื่อผู้กู้ที่พิมพ์ไม่ตรงกับในสัญญา กรุณาตรวจสอบให้แน่ใจก่อนอนุมัติ
            </div>
          ` : ''}
          <div class="bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs p-2 rounded mt-2">
            ✅ เมื่อกดยืนยัน ระบบจะบันทึก LINE ID เข้าสู่สัญญาใน Supabase ทันที
          </div>
        </div>
      `,
      icon: nameMatch?.isMatch ? 'question' : 'warning',
      showCancelButton: true,
      confirmButtonText: '✅ ยืนยันผูกสัญญา',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#06C755',
      cancelButtonColor: '#64748b',
    });

    if (!confirmRes.isConfirmed) return;

    try {
      setProcessing(true);
      const res = await fetch('/api/registerNotify', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: registration.id,
          action: 'approve',
        }),
      });

      const resJson = await res.json();
      if (!res.ok || !resJson.success) {
        throw new Error(resJson.error || 'เกิดข้อผิดพลาดในการอนุมัติ');
      }

      await Swal.fire({
        icon: 'success',
        title: 'ยืนยันผูกสัญญาสำเร็จ!',
        text: `ระบบได้ทำการบันทึก LINE User ID ให้กับสัญญาเลขที่ ${registration.contract_no} เรียบร้อยแล้ว`,
        confirmButtonColor: '#06C755',
        confirmButtonText: 'ตกลง',
      });

      loadData();
    } catch (err) {
      console.error('Approval error:', err);
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: err.message || 'ไม่สามารถอนุมัติได้ กรุณาลองใหม่อีกครั้ง',
        confirmButtonColor: '#ef4444',
      });
    } finally {
      setProcessing(false);
    }
  };

  // ดำเนินการปฏิเสธ (Reject)
  const handleReject = async () => {
    if (!data?.registration || processing) return;
    const { registration } = data;

    const { value: reason, isConfirmed } = await Swal.fire({
      title: 'ปฏิเสธคำขอสมัคร?',
      text: `ท่านต้องการปฏิเสธคำขอของสัญญาเลขที่ ${registration.contract_no} ใช่หรือไม่?`,
      input: 'text',
      inputPlaceholder: 'ระบุเหตุผล (ถ้ามี) เช่น เลขสัญญาไม่ถูกต้อง',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '🚫 ยืนยันปฏิเสธ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
    });

    if (!isConfirmed) return;

    try {
      setProcessing(true);
      const res = await fetch('/api/registerNotify', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: registration.id,
          action: 'reject',
          rejectReason: reason || 'เจ้าหน้าที่ปฏิเสธคำขอ',
        }),
      });

      const resJson = await res.json();
      if (!res.ok || !resJson.success) {
        throw new Error(resJson.error || 'เกิดข้อผิดพลาดในการปฏิเสธ');
      }

      await Swal.fire({
        icon: 'info',
        title: 'ปฏิเสธคำขอแล้ว',
        text: `คำขอของสัญญาเลขที่ ${registration.contract_no} ถูกปฏิเสธเรียบร้อยแล้ว`,
        confirmButtonColor: '#64748b',
        confirmButtonText: 'ตกลง',
      });

      loadData();
    } catch (err) {
      console.error('Reject error:', err);
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: err.message || 'ไม่สามารถปฏิเสธได้',
        confirmButtonColor: '#ef4444',
      });
    } finally {
      setProcessing(false);
    }
  };

  // Loading View
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-300 border-t-emerald-600 mb-4" />
        <p className="text-slate-600 font-medium text-sm">กำลังโหลดข้อมูลคำขอสมัครแจ้งเตือน...</p>
      </div>
    );
  }

  // Error View
  if (error || !data?.registration) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 max-w-md w-full p-6 text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">ไม่สามารถเปิดหน้าตรวจสอบได้</h2>
          <p className="text-slate-600 text-sm mb-6">{error || 'ไม่พบข้อมูลในระบบ'}</p>
          <button
            onClick={() => router.push('/')}
            className="w-full py-3 bg-slate-800 text-white rounded-xl font-medium text-sm hover:bg-slate-700 transition"
          >
            กลับสู่หน้าหลัก
          </button>
        </div>
      </div>
    );
  }

  const { registration, contract, nameMatch } = data;
  const isContractFound = !!contract;
  const isPending = registration.status === 'pending';
  const isApproved = registration.status === 'approved';
  const isRejected = registration.status === 'rejected';

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString('th-TH', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 flex justify-center items-start">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 mb-3">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold">ตรวจสอบข้อมูลการสมัครแจ้งเตือน</h1>
          <p className="text-xs text-slate-400 mt-1">บริษัท ทรัพย์สำราญ พิโก จำกัด</p>
        </div>

        <div className="p-5 space-y-5">
          
          {/* Status Alert Banner */}
          <div>
            {!isContractFound ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-bold text-red-800">⚠️ ไม่พบเลขที่สัญญานี้ในระบบ</h3>
                  <p className="text-xs text-red-700 mt-0.5 leading-relaxed">
                    ไม่พบสัญญาเลขที่ <b>{registration.contract_no}</b> ในฐานข้อมูล Supabase กรุณาตรวจสอบกับผู้กู้อีกครั้ง
                  </p>
                </div>
              </div>
            ) : nameMatch?.isMatch ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-bold text-emerald-800">✅ ตรวจสอบแล้ว: ชื่อตรงกับในระบบ</h3>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    ชื่อที่ระบุตรงกับชื่อผู้กู้ในฐานข้อมูลสัญญา Supabase
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-bold text-amber-800">⚠️ คำเตือน: ชื่อที่พิมพ์ไม่ตรงกับในสัญญา</h3>
                  <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                    ผู้กู้พิมพ์: <b>{registration.borrower_name}</b> แต่ชื่อในสัญญาคือ: <b>{contract?.Name_loan || '-'}</b>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Review Status If Already Handled */}
          {!isPending && (
            <div className={`rounded-xl p-4 text-center border ${
              isApproved 
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
                : 'bg-slate-100 border-slate-300 text-slate-700'
            }`}>
              <div className="font-bold text-sm flex items-center justify-center gap-1.5">
                {isApproved ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-slate-500" />}
                {isApproved ? 'อนุมัติผูกสัญญาเรียบร้อยแล้ว' : 'ปฏิเสธคำขอนี้แล้ว'}
              </div>
              <p className="text-xs mt-1 opacity-80">
                เมื่อ {formatDateTime(registration.reviewed_at)}
                {registration.reject_reason ? ` (เหตุผล: ${registration.reject_reason})` : ''}
              </p>
            </div>
          )}

          {/* Box 1: ข้อมูลที่ลูกค้าพิมพ์เข้ามา */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wider">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>ข้อมูลที่ส่งมาจาก LINE (ลูกค้า):</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500">ชื่อผู้กู้ที่พิมพ์:</span>
                <span className="font-bold text-slate-800 text-sm">{registration.borrower_name}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500">เลขที่สัญญา:</span>
                <span className="font-bold text-sky-700 font-mono text-sm">{registration.contract_no}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500">LINE User ID:</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-slate-700 text-[11px] max-w-[170px] truncate">{registration.line_user_id}</span>
                  <button
                    onClick={() => handleCopyUserId(registration.line_user_id)}
                    className="p-1 hover:bg-slate-200 rounded text-slate-500 transition"
                    title="คัดลอก ID"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center pt-1 text-[11px] text-slate-400">
                <span>เวลาส่งคำขอ:</span>
                <span>{formatDateTime(registration.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Box 2: ข้อมูลในฐานข้อมูล Supabase */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wider">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>ข้อมูลจริงในระบบสัญญา (Supabase):</span>
            </div>
            {isContractFound ? (
              <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-emerald-100">
                  <span className="text-slate-500">เลขที่สัญญาในระบบ:</span>
                  <span className="font-bold text-slate-800 font-mono">{contract.ID_contact || registration.contract_no}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-emerald-100">
                  <span className="text-slate-500">ชื่อผู้กู้ในระบบ:</span>
                  <span className={`font-bold ${nameMatch?.isMatch ? 'text-emerald-700' : 'text-red-600 font-bold'}`}>
                    {contract.Name_loan || '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-emerald-100">
                  <span className="text-slate-500">ยอดเงินกู้:</span>
                  <span className="font-bold text-slate-800">
                    {contract.total_loan ? `${Number(contract.total_loan).toLocaleString()} บาท` : '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-emerald-100">
                  <span className="text-slate-500">ค่างวดต่อเดือน:</span>
                  <span className="font-bold text-emerald-700 text-sm">
                    {contract.paypermonth ? `${Number(contract.paypermonth).toLocaleString()} บาท` : '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 text-[11px]">
                  <span className="text-slate-500">สถานะ LINE ID เดิม:</span>
                  <span className="text-slate-600 font-mono truncate max-w-[160px]">
                    {contract.userID ? contract.userID : 'ยังไม่ได้ผูกบัญชี'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-xs text-slate-500">
                ❌ ไม่พบข้อมูลสัญญานี้ในฐานข้อมูล contact
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {isPending ? (
            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                disabled={processing}
                onClick={handleReject}
                className="flex-1 py-3 px-4 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition shadow-sm disabled:opacity-50"
              >
                <XCircle className="w-4 h-4 text-red-500" />
                <span>ปฏิเสธคำขอ</span>
              </button>
              <button
                type="button"
                disabled={processing}
                onClick={handleApprove}
                className="flex-1 py-3 px-4 bg-[#06C755] hover:bg-[#05b34c] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition shadow-md hover:shadow-lg disabled:opacity-50"
              >
                {processing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>{processing ? 'กำลังบันทึก...' : '✅ ยืนยันผูกสัญญา'}</span>
              </button>
            </div>
          ) : (
            <div className="pt-2">
              <button
                onClick={() => router.push('/')}
                className="w-full py-3 bg-slate-800 text-white rounded-xl font-medium text-xs hover:bg-slate-700 transition"
              >
                กลับสู่หน้าหลัก
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default function ReviewRegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-300 border-t-emerald-600" />
        </div>
      }
    >
      <ReviewRegisterContent />
    </Suspense>
  );
}
