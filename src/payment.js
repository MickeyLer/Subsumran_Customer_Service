"use client";

import React , { useState, useEffect, useContext, useRef } from "react";
import PaymentWizard from "./components/PaymentWizard";
import { useSearchParams, useRouter } from "next/navigation";
import { DateTime } from "luxon";
import { DataContext } from './DataContext';
import { fetchContactById, fetchInterestByContact } from './services/api';
import { addMonths } from '@progress/kendo-date-math';
import DateDiff from 'date-diff';
import { ChevronLeft, CreditCard, AlertTriangle, CheckCircle, Clock, ShoppingCart, AlertCircle, Phone, ChevronRight } from 'lucide-react';
import { getContractProgression, formatThaiDate, parseAppDate } from './utils/installmentProgression';

function Pay() {
    const { dataContact, dataInterest, loadContractData } = useContext(DataContext) || {};
    const [modalOpen, setModalOpen] = useState(false);

    // Multi-select state
    const [selectedRows, setSelectedRows] = useState([]); // Array of selected installment rows

    const [searchtxt, setSearch] = useState('');
    const [directContact, setDirectContact] = useState(null);
    const [directInstallments, setDirectInstallments] = useState([]);

    const searchParams = useSearchParams();
    const router = useRouter();

    useEffect(() => {
      const idParam = searchParams.get('IDcontact');
      if (idParam) {
        setSearch(idParam);
        let isMounted = true;
        Promise.all([
          fetchContactById(idParam),
          fetchInterestByContact(idParam),
        ]).then(([cData, iData]) => {
          if (isMounted) {
            if (cData) setDirectContact(cData);
            if (iData) setDirectInstallments(iData);
          }
        }).catch(err => console.error("Error fetching targeted pay data:", err));

        if (loadContractData) {
          loadContractData(idParam);
        }
        return () => { isMounted = false; };
      }
    }, [searchParams, loadContractData]);

    function search(rows) {
      if (dataInterest !== null && searchtxt !== '') {
        return rows.filter(row => String(row.Id_contact) === String(searchtxt));
      }
      return [];
    }

    function searchDataContact(rows) {
      if (dataContact !== null && searchtxt !== '') {
        return rows.filter(row => String(row.ID_contact) === String(searchtxt))[0];
      }
      return null;
    }

    const handleBack = () => {
      if (searchtxt) {
        router.push(`/LoanDetails?contractId=${encodeURIComponent(searchtxt)}`);
      } else {
        router.push('/');
      }
    }

    const currentContact = directContact || searchDataContact(dataContact);

    // Check if a row is overdue (past due date)
    const isOverdue = (row) => {
      if (!row || !row.begin_date) return false;
      const beginDate = parseAppDate(row.begin_date);
      if (!beginDate) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(beginDate.getFullYear(), beginDate.getMonth(), beginDate.getDate());
      return today > dueDate;
    };

    // Find next unpaid installment & fee using Installment Progression Module
    const installments = directInstallments.length > 0
      ? directInstallments
      : search(dataInterest || []);

    const {
      nextInstallment,
      nextFee: calculatedFee,
      nextFeeDetails,
      overdueInstallments,
      eirBreakdown,
      sortedUnpaid,
    } = getContractProgression(
      currentContact,
      installments
    );

    const payMode = 'minimum';

    const hasOverdue = (overdueInstallments && overdueInstallments.length > 0) || isOverdue(nextInstallment);
    const overdueCount = overdueInstallments?.length || (isOverdue(nextInstallment) ? 1 : 0);

    const annualRate = eirBreakdown?.annualRate || parseFloat(currentContact?.interest || 15);
    const eirDays = nextFeeDetails?.days || 0;
    const normalInterest = nextFeeDetails?.normalInterest || Number(nextInstallment?.interest || 0);
    const lateInterest = nextFeeDetails?.lateInterest || 0;
    const collectionFee = nextFeeDetails?.collectionFee || 0;

    // Fixed to calculated minimum installment + overdue fees
    const baseMonthly = Number(currentContact?.paypermonth || nextInstallment?.pay || 0);
    const activePrincipal = Math.max(0, baseMonthly - normalInterest);
    const activeInterest = normalInterest;
    const activeTotal = eirBreakdown?.totalMinimum || (baseMonthly + lateInterest + collectionFee);
    const activeSelectedRows = [nextInstallment].filter(Boolean);

    const autoPayTriggeredRef = useRef(false);

    // Trigger payment modal with activeSelectedRows
    const handlePayNextInstallment = () => {
      if (!nextInstallment && activeSelectedRows.length === 0) return;
      setSelectedRows(activeSelectedRows);
      setModalOpen(true);
    };

    // Auto-open payment wizard if autoPay query parameter is present
    useEffect(() => {
      const autoPay = searchParams.get('autoPay');
      if ((autoPay === 'true' || autoPay === '1') && nextInstallment && !autoPayTriggeredRef.current) {
        autoPayTriggeredRef.current = true;
        setSelectedRows(activeSelectedRows);
        setModalOpen(true);
      }
    }, [nextInstallment, searchParams, activeSelectedRows]);

    return (
      <div className="min-h-screen bg-surface pb-32">
        {/* Header */}
        <div className="bg-primary text-white p-4 shadow-md sticky top-0 z-40 flex items-center justify-between border-b-2 border-secondary-fixed">
          <button onClick={handleBack} className="w-11 h-11 bg-white/10 hover:bg-white/20 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-fixed/50 flex items-center justify-center shrink-0" aria-label="ย้อนกลับ">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold font-sans text-secondary-fixed">ข้อมูลสัญญาและชำระค่างวด</h1>
          <div className="w-11"></div>
        </div>

        {modalOpen && currentContact && (
          <PaymentWizard 
            setOpenModal={(val) => {
              setModalOpen(val);
              if (!val) setSelectedRows([]); // clear selection on close
            }} 
            selectedInstallments={activeSelectedRows}
            totalTree={activePrincipal}
            totalInterest={activeInterest}
            rest={currentContact.total_treerest}
            Name={currentContact.Name_loan}
            idContact={searchtxt}
            accumulate={currentContact.accumulate}
            contract={currentContact}
            payMode={payMode}
            eirBreakdown={eirBreakdown}
            customTotalPay={activeTotal}
          />
        )}

        <div className="p-4 max-w-3xl mx-auto space-y-6">
          
          {/* Next Installment Details */}
          {(!dataInterest && directInstallments.length === 0) || searchtxt === "" ? (
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg shadow-sm flex flex-col items-center justify-center py-12 gap-sm">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary/20 border-t-primary mb-2"></div>
              <p className="text-label-md font-bold text-primary font-sans">กำลังโหลดข้อมูลชำระเงิน...</p>
              <p className="text-xs text-on-surface-variant font-sans">กรุณารอสักครู่ ระบบกำลังดึงข้อมูลค่างวด</p>
            </div>
          ) : nextInstallment ? (
            <div className="bg-white rounded-xl border border-outline-variant/50 overflow-hidden shadow-sm hover:border-primary/30 transition-all">
              <div className="p-5 border-b border-outline-variant/20 flex justify-between items-start bg-slate-50/50">
                <div className="flex items-start gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-primary font-sans leading-tight">
                      งวดที่ {nextInstallment.number_pay}
                    </h3>
                    <p className="text-xs text-on-surface-variant font-sans mt-0.5">
                      สัญญาเลขที่ {searchtxt}
                    </p>
                    {currentContact?.Name_loan && (
                      <p className="text-xs text-on-surface-variant font-sans mt-0.5">
                        {currentContact.Name_loan}
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Status Badge */}
                {hasOverdue ? (
                  <span className="bg-red-50 text-red-700 border border-red-200 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 font-sans animate-pulse shrink-0 whitespace-nowrap">
                    <AlertTriangle size={14} /> ค้างชำระ {overdueCount > 1 ? `(${overdueCount} งวด)` : ''}
                  </span>
                ) : (
                  <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 font-sans shrink-0 whitespace-nowrap">
                    <Clock size={14} /> รอชำระ
                  </span>
                )}
              </div>

              {/* Installment breakdown items */}
              <div className="p-6 space-y-5 font-sans">
                {/* Due Date Display */}
                <div className="bg-primary/5 rounded-xl border border-primary/10 p-4 flex flex-col justify-between sm:flex-row sm:items-center gap-2">
                  <div>
                    <p className="text-xs text-on-surface-variant">กำหนดชำระวันที่</p>
                    <p className="text-base font-bold text-primary mt-1">
                      {formatThaiDate(nextInstallment.begin_date)}
                    </p>
                  </div>
                  {hasOverdue && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5 font-medium self-start sm:self-auto flex items-center gap-1">
                      <AlertTriangle size={14} className="shrink-0" />
                      <span>เกินกำหนดชำระ {overdueCount > 1 ? `(ค้างสะสม ${overdueCount} งวด)` : ''}</span>
                    </p>
                  )}
                </div>

                {/* Informational Card: ยอดปิดสัญญาทั้งหมด (แสดงให้ดูเพื่อทราบเฉยๆ) */}
                {eirBreakdown && (
                  <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-4 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs uppercase tracking-wide">
                          <span className="material-symbols-outlined text-[17px] text-emerald-600">account_balance</span>
                          <span>ยอดสำหรับปิดสัญญาทั้งหมด (แสดงเพื่อทราบ)</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          เงินต้นคงเหลือ {Math.round(eirBreakdown.principal || currentContact?.total_treerest || 0).toLocaleString()} ฿ 
                          + ดอกเบี้ย EIR {Math.round(eirBreakdown.normalInterest || 0).toLocaleString()} ฿ 
                          + ค่าปรับ/ค่าทวงถามสะสม
                        </p>
                        <p className="text-[11px] text-amber-700 font-medium">
                          * หากต้องการปิดบัญชีทั้งหมด หรือประสงค์ชำระเฉพาะดอกเบี้ย กรุณาติดต่อเจ้าหน้าที่เพื่อดำเนินการที่สำนักงาน
                        </p>
                      </div>
                      <div className="text-right sm:text-right shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200 flex items-center sm:flex-col justify-between sm:justify-center">
                        <span className="text-[11px] text-slate-500 font-medium">ยอดปิดบัญชี:</span>
                        <span className="text-xl font-black text-emerald-700 font-mono">
                          {Math.round(eirBreakdown.totalOverdue || 0).toLocaleString()} <span className="text-xs font-sans font-normal text-slate-600">฿</span>
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Items Breakdown list */}
                <div className="divide-y divide-outline-variant/10 text-sm">
                  {/* Principal */}
                  <div className="flex justify-between py-3.5 items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary/40" />
                      <div>
                        <span className="text-on-surface-variant">เงินต้นในงวดนี้ (Principal)</span>
                      </div>
                    </div>
                    <span className="font-bold text-primary text-base">
                      {Math.round(activePrincipal).toLocaleString()} ฿
                    </span>
                  </div>

                  {/* Interest */}
                  <div className="flex justify-between py-3.5 items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary/40" />
                      <div>
                        <span className="text-on-surface-variant">ดอกเบี้ยปกติ EIR (Normal Interest)</span>
                        <p className="text-[10px] text-slate-500">
                          {eirDays > 0 ? `คำนวณตามจริงแบบ EIR (${eirDays} วัน)` : 'ดอกเบี้ยตามงวด'}
                        </p>
                      </div>
                    </div>
                    <span className="font-bold text-primary text-base">
                      {Math.round(activeInterest).toLocaleString()} ฿
                    </span>
                  </div>

                  {/* Late fee / Fine (fee2) */}
                  <div className="flex justify-between py-3.5 items-center">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${lateInterest > 0 ? 'bg-red-500' : 'bg-primary/40'}`} />
                      <div>
                        <span className={`${lateInterest > 0 ? 'text-red-600 font-bold' : 'text-on-surface-variant'}`}>
                          ค่าปรับล่าช้า (Late Fee)
                        </span>
                        {overdueCount > 1 && (
                          <p className="text-[10px] text-red-500">รวมสะสม {overdueCount} งวดที่ค้างชำระ</p>
                        )}
                      </div>
                    </div>
                    <span className={`font-bold text-base ${lateInterest > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                      {lateInterest > 0 ? `${lateInterest.toLocaleString()} ฿` : 'ไม่มีค่าปรับ 0 ฿'}
                    </span>
                  </div>

                  {/* Collection Fee (fee3) */}
                  {collectionFee > 0 && (
                    <div className="flex justify-between py-3.5 items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        <div>
                          <span className="text-amber-600 font-bold">
                            ค่าทวงถาม (Collection Fee)
                          </span>
                          {overdueCount > 1 && (
                            <p className="text-[10px] text-amber-600">รวมสะสม {overdueCount} งวดที่ค้างชำระ</p>
                          )}
                        </div>
                      </div>
                      <span className="font-bold text-base text-amber-600">
                        {collectionFee.toLocaleString()} ฿
                      </span>
                    </div>
                  )}
                </div>

                {/* Notice for Customer: Questions, Interest Only, Account Close */}
                <div className="bg-amber-50/90 border border-amber-200/90 rounded-xl p-3 flex items-center justify-between gap-2 text-xs text-amber-900 font-sans shadow-xs">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertCircle size={16} className="text-amber-600 shrink-0" />
                    <div>
                      <span>ประสงค์ชำระเฉพาะดอกเบี้ย ปิดยอดสัญญา หรือมีข้อสงสัย?</span>
                      <p className="text-[11px] text-amber-700/80">กรุณาติดต่อเจ้าหน้าที่เพื่อดำเนินการที่สำนักงาน</p>
                    </div>
                  </div>
                  <a
                    href="tel:0642201381"
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shrink-0 no-underline transition-all active:scale-95 shadow-xs"
                  >
                    <Phone size={13} />
                    โทรติดต่อ
                  </a>
                </div>

                {/* Total amount container */}
                <div className="bg-primary text-white p-5 rounded-xl flex items-center justify-between border border-secondary-fixed/40 shadow-sm">
                  <div>
                    <p className="text-xs text-secondary-fixed font-semibold tracking-wider uppercase font-sans">
                      ยอดรวมที่ต้องชำระงวดนี้
                    </p>
                    <p className="text-xs text-white/70 font-sans mt-0.5">
                      (ค่างวดตามที่คำนวณได้ รวมค่าปรับและค่าทวงถามสะสม)
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-black text-secondary-fixed leading-none">
                      {Math.round(activeTotal).toLocaleString()}
                      <span className="text-sm font-normal text-white ml-1">฿</span>
                    </p>
                  </div>
                </div>

                {/* Confirm Pay Button */}
                <button
                  onClick={handlePayNextInstallment}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/25 transition-all active:scale-[0.98] text-base border border-emerald-500/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/40 cursor-pointer mt-4"
                >
                  <ShoppingCart size={20} className="shrink-0" />
                  <span>
                    ดำเนินการชำระค่างวดที่ {nextInstallment.number_pay} ({Math.round(activeTotal).toLocaleString()} ฿)
                  </span>
                  <ChevronRight size={18} className="shrink-0 opacity-80" />
                </button>
              </div>
            </div>
          ) : (
            /* Celebrating completed all payments */
            <div className="bg-white rounded-xl shadow-md border border-outline-variant/30 p-8 text-center flex flex-col items-center gap-4 transition-all hover:shadow-lg font-sans">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                <CheckCircle size={40} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-primary">ชำระค่างวดครบถ้วนแล้ว</h3>
                <p className="text-sm text-on-surface-variant mt-2 leading-relaxed max-w-sm">
                  สัญญานี้ได้รับการชำระยอดเงินต้นครบถ้วนดีเยี่ยมเรียบร้อยแล้ว ไม่มีค่างวดคงค้าง ขอขอบพระคุณเป็นอย่างยิ่งที่เลือกใช้บริการของเรา
                </p>
              </div>
              <button
                onClick={handleBack}
                className="mt-2 bg-primary hover:bg-primary/95 text-secondary-fixed font-bold px-8 py-3 rounded-lg active:scale-95 transition-all shadow-md flex items-center gap-1 border-0"
              >
                <ChevronLeft size={18} /> กลับหน้ารายละเอียดสัญญา
              </button>
            </div>
          )}
        </div>
      </div>
    );
};
export default Pay;