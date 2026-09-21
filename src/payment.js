"use client";

import React , { useState, useEffect, useContext, useRef } from "react";
import PaymentWizard from "./components/PaymentWizard";
import { useSearchParams, useRouter } from "next/navigation";
import { DateTime } from "luxon";
import { DataContext } from './DataContext';
import { fetchContactById, fetchInterestByContact } from './services/api';
import { addMonths } from '@progress/kendo-date-math';
import DateDiff from 'date-diff';
import { ChevronLeft, CreditCard, AlertTriangle, CheckCircle, Clock, ShoppingCart } from 'lucide-react';
import { getContractProgression } from './utils/installmentProgression';

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
      const date2 = DateTime.fromJSDate(new Date()).toFormat("yyyy-MM-dd");
      const daydif = ((new DateDiff(new Date(date2), new Date(row.begin_date))).days().toFixed(0));
      return daydif > 0;
    };

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

    // Find next unpaid installment & fee using Installment Progression Module
    const installments = directInstallments.length > 0
      ? directInstallments
      : search(dataInterest || []);

    const { nextInstallment, nextFee: calculatedFee } = getContractProgression(
      currentContact,
      installments
    );

    const autoPayTriggeredRef = useRef(false);

    // Trigger payment modal with nextInstallment
    const handlePayNextInstallment = () => {
      if (!nextInstallment) return;
      setSelectedRows([nextInstallment]);
      setModalOpen(true);
    };

    // Auto-open payment wizard if autoPay query parameter is present
    useEffect(() => {
      const autoPay = searchParams.get('autoPay');
      if ((autoPay === 'true' || autoPay === '1') && nextInstallment && !autoPayTriggeredRef.current) {
        autoPayTriggeredRef.current = true;
        setSelectedRows([nextInstallment]);
        setModalOpen(true);
      }
    }, [nextInstallment, searchParams]);

    // Summary totals of selected rows for the wizard
    const selectedTotal = selectedRows.reduce((acc, row) => ({
      tree: acc.tree + Number(row.tree),
      interest: acc.interest + Number(row.interest),
    }), { tree: 0, interest: 0 });

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
            selectedInstallments={selectedRows}
            totalTree={selectedTotal.tree}
            totalInterest={selectedTotal.interest}
            rest={currentContact.total_treerest}
            Name={currentContact.Name_loan}
            idContact={searchtxt}
            accumulate={currentContact.accumulate}
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
              <div className="p-5 border-b border-outline-variant/20 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-primary font-sans leading-tight">
                      งวดที่ {nextInstallment.number_pay}
                    </h3>
                    <p className="text-xs text-on-surface-variant font-sans mt-0.5">
                      สัญญาเลขที่ {searchtxt} • คุณ{currentContact?.Name_loan || ''}
                    </p>
                  </div>
                </div>
                
                {/* Status Badge */}
                {isOverdue(nextInstallment) ? (
                  <span className="bg-red-50 text-red-700 border border-red-200 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 font-sans animate-pulse">
                    <AlertTriangle size={14} /> ค้างชำระ
                  </span>
                ) : (
                  <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 font-sans">
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
                  {isOverdue(nextInstallment) && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5 font-medium self-start sm:self-auto">
                      ⚠️ เกินกำหนดชำระค่างวด
                    </p>
                  )}
                </div>

                {/* Items Breakdown list */}
                <div className="divide-y divide-outline-variant/10 text-sm">
                  {/* Principal */}
                  <div className="flex justify-between py-3.5 items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary/40" />
                      <span className="text-on-surface-variant">เงินต้น (Principal)</span>
                    </div>
                    <span className="font-bold text-primary text-base">
                      {Number(nextInstallment.tree).toLocaleString()} ฿
                    </span>
                  </div>

                  {/* Interest */}
                  <div className="flex justify-between py-3.5 items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary/40" />
                      <span className="text-on-surface-variant">ดอกเบี้ย (Interest)</span>
                    </div>
                    <span className="font-bold text-primary text-base">
                      {Number(nextInstallment.interest).toLocaleString()} ฿
                    </span>
                  </div>

                  {/* Late fee / Fine */}
                  <div className="flex justify-between py-3.5 items-center">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${calculatedFee > 0 ? 'bg-red-500' : 'bg-primary/40'}`} />
                      <span className={`${calculatedFee > 0 ? 'text-red-600 font-bold' : 'text-on-surface-variant'}`}>
                        ค่าปรับล่าช้า (Late Fee)
                      </span>
                    </div>
                    <span className={`font-bold text-base ${calculatedFee > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                      {calculatedFee > 0 ? `${calculatedFee.toLocaleString()} ฿` : 'ไม่มีค่าปรับ 0 ฿'}
                    </span>
                  </div>
                </div>

                {/* Total amount container */}
                <div className="bg-primary text-white p-5 rounded-xl flex items-center justify-between border border-secondary-fixed/40 shadow-sm">
                  <div>
                    <p className="text-xs text-secondary-fixed font-semibold tracking-wider uppercase font-sans">
                      ยอดรวมที่ต้องชำระงวดนี้
                    </p>
                    <p className="text-xs text-white/70 font-sans mt-0.5">
                      (เงินต้น + ดอกเบี้ย + ค่าปรับ)
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-black text-secondary-fixed leading-none">
                      {(Number(nextInstallment.tree) + Number(nextInstallment.interest) + calculatedFee).toLocaleString()}
                      <span className="text-sm font-normal text-white ml-1">฿</span>
                    </p>
                  </div>
                </div>

                {/* Confirm Pay Button */}
                <button
                  onClick={handlePayNextInstallment}
                  className="w-full bg-primary text-white hover:bg-primary-container font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 text-base border-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/35 cursor-pointer mt-4"
                >
                  <ShoppingCart size={20} />
                  ดำเนินการชำระค่างวดที่ {nextInstallment.number_pay}
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