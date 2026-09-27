"use client";

import "./invoice.css";
import React, { useState, useContext, useEffect } from "react";
import { useSearchParams, useRouter } from 'next/navigation';
import { DataContext } from "./DataContext";
import { fetchInterestByReference, fetchContactById, fetchTransactionByInvoice, fetchReceiptPDFUrl } from "./services/api";
import { DateTime } from "luxon";
import { BAHTTEXT } from './Numbertobath';
import html2canvas from 'html2canvas';
import { ChevronLeft, FileText, Image as ImageIcon, Printer } from 'lucide-react';
import LogoImg from './Logo.png';
import SignImg from './suthep_sign.png';

// Robust helper to format date string to DD/MM/YYYY
const formatDateString = (dateStr) => {
  if (!dateStr) return '-';
  const str = String(dateStr).trim();
  // Check if string is already in DD/MM/YYYY format (e.g. "27/09/2026")
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    return str;
  }
  // Try Luxon fromISO
  const luxonDate = DateTime.fromISO(str);
  if (luxonDate.isValid) {
    return luxonDate.toFormat("dd/MM/yyyy");
  }
  // Try JS Date parser fallback
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${day}/${month}/${year}`;
  }
  return str;
};

export const Invoice = () => {
    const searchParams = useSearchParams();
    const router = useRouter();
    const invoiceID = searchParams.get('invoiceID');
    const { dataInterest, dataContact } = useContext(DataContext) || {};
    const [image2, setImage] = useState(null);

    const [directInvoice, setDirectInvoice] = useState([]);
    const [directContact, setDirectContact] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [pdfUrl, setPdfUrl] = useState(null);
    const [forceHtml, setForceHtml] = useState(false);

    useEffect(() => {
      if (!invoiceID) {
        setIsLoading(false);
        return;
      }
      let isMounted = true;
      setIsLoading(true);

      Promise.all([
        fetchInterestByReference(invoiceID).catch(() => []),
        fetchTransactionByInvoice(invoiceID).catch(() => null),
        fetchReceiptPDFUrl(invoiceID).catch(() => null)
      ]).then(async ([interests, txData, firebasePdfUrl]) => {
        if (!isMounted) return;
        setDirectInvoice(interests || []);

        // Priority check for PDF stored in Firebase / DB
        const foundPdfUrl = firebasePdfUrl || 
          (Array.isArray(txData) ? txData[0]?.pdf_link : txData?.pdf_link) || 
          interests?.[0]?.pdf_link || 
          null;

        setPdfUrl(foundPdfUrl);

        if (interests && interests.length > 0 && interests[0].Id_contact) {
          const contactObj = await fetchContactById(interests[0].Id_contact);
          if (isMounted && contactObj) {
            setDirectContact([contactObj]);
          }
        }
        if (isMounted) setIsLoading(false);
      }).catch(err => {
        console.error("Error fetching invoice targeted data:", err);
        if (isMounted) setIsLoading(false);
      });

      return () => { isMounted = false; };
    }, [invoiceID]);

    function search(rows) {
      if (dataInterest && rows) {
        return rows.filter(row => row.reference === invoiceID);
      }
      return [];
    }

    function searchDataContact(rows) {
      const interestMatches = search(dataInterest);
      if (dataContact && rows && interestMatches.length > 0) {
        return rows.filter(row => row.ID_contact === interestMatches[0].Id_contact);
      }
      return [];
    }

    const handleBack = () => {
      const from = searchParams.get('from');
      const contractIdParam = searchParams.get('contractId');
      const interestMatches = search(dataInterest);
      const contactId = (interestMatches.length > 0 && interestMatches[0]?.Id_contact)
        ? interestMatches[0].Id_contact
        : contractIdParam;

      if (from === 'pay') {
        if (contactId) {
          router.push(`/Pay?IDcontact=${encodeURIComponent(contactId)}`);
        } else {
          router.push('/Pay');
        }
      } else {
        if (contactId) {
          router.push(`/LoanDetails?contractId=${encodeURIComponent(contactId)}`);
        } else {
          router.push('/LoanDetails');
        }
      }
    };

    const handleSaveImage = () => {
      const element = document.getElementById('my-element');
      if (element) {
        html2canvas(element).then((canvas) => {
          const imageData = canvas.toDataURL('image/jpeg');
          setImage(imageData);
        });
      }
    };

    const invoiceData = directInvoice.length > 0 ? directInvoice : search(dataInterest);
    const contactData = directContact.length > 0 ? directContact : searchDataContact(dataContact);
    const contactObj = contactData[0] || {};

    // Active PDF / Image URL derived from state or loaded records
    const activePdfUrl = pdfUrl || invoiceData[0]?.pdf_link || directInvoice[0]?.pdf_link || null;

    const handlePrintPdf = () => {
      if (activePdfUrl) {
        window.open(activePdfUrl, '_blank');
      } else {
        window.print();
      }
    };

    const isImage = activePdfUrl && (
      activePdfUrl.toLowerCase().includes('.jpg') || 
      activePdfUrl.toLowerCase().includes('.jpeg') || 
      activePdfUrl.toLowerCase().includes('.png') ||
      activePdfUrl.includes('receipts_img')
    );
    const hasPdf = Boolean(activePdfUrl) && !forceHtml;

    return (
      <div className="min-h-screen bg-surface pb-20 font-sans">
        {/* Header App Bar */}
        <div className="bg-primary text-white p-4 shadow-md sticky top-0 z-40 flex items-center justify-between border-b-2 border-secondary-fixed">
          <button 
            onClick={handleBack} 
            className="p-2 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-fixed/50 flex items-center justify-center min-w-[44px] min-h-[44px]" 
            aria-label="ย้อนกลับ"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold font-sans text-secondary-fixed">ใบเสร็จรับเงินอิเล็กทรอนิกส์</h1>
          <div className="w-10"></div> {/* Spacer for centering */}
        </div>

        <div className="p-4 max-w-3xl mx-auto space-y-6">
          {activePdfUrl && (
            <div className="flex justify-end gap-2 no-print">
              <button
                onClick={() => setForceHtml(!forceHtml)}
                className="px-4 py-2 bg-white text-primary border border-primary/30 rounded-lg shadow-sm hover:bg-slate-50 font-sans text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                {forceHtml ? (
                  <>
                    <FileText size={16} /> แสดงรูปแบบ PDF/รูปภาพ
                  </>
                ) : (
                  <>
                    <FileText size={16} /> แสดงรูปแบบ HTML
                  </>
                )}
              </button>
            </div>
          )}

          {(isLoading && (invoiceData.length === 0 || contactData.length === 0)) ? (
            <div className="flex flex-col justify-center items-center py-16 bg-white rounded-lg border border-outline-variant/30 shadow-sm">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mb-4"></div>
              <p className="text-on-surface-variant font-sans text-sm">กำลังโหลดข้อมูลใบเสร็จ...</p>
            </div>
          ) : hasPdf ? (
            /* 1. PDF / Image Preview Display (Priority when PDF/Image exists in Firebase) */
            <div className="bg-white rounded-xl shadow-md border border-outline-variant/30 overflow-hidden p-3 text-center">
              <p className="text-xs text-on-surface-variant mb-3 font-sans font-medium">
                เอกสารใบเสร็จรับเงินจากระบบ
              </p>
              {isImage ? (
                <img 
                  src={activePdfUrl} 
                  alt="ใบเสร็จรับเงิน" 
                  className="w-full h-auto max-h-[85vh] object-contain mx-auto rounded-lg border border-outline-variant/30"
                />
              ) : (
                <div className="w-full h-[75vh] min-h-[500px]">
                  <iframe 
                    src={`${activePdfUrl}#view=Fit&toolbar=1&navpanes=0&scrollbar=1`} 
                    className="w-full h-full border-0 rounded-lg shadow-inner"
                    title="Receipt PDF Viewer"
                  />
                </div>
              )}
            </div>
          ) : (
            /* 2. Digital HTML Receipt Display (Format matching my-app - Copy) */
            invoiceData.map((val, idx) => {
              // Discounts only apply when the corresponding fee is greater than 0 (matching my-app - Copy formula)
              const fee2Net = Number(val.payfee2 || 0) > 0 ? Number(val.payfee2 || 0) - Number(val.dis_fee2 || 0) : 0;
              const fee3Net = Number(val.payfee3 || 0) > 0 ? Number(val.payfee3 || 0) - Number(val.dis_fee3 || 0) : 0;
              
              const totalSum = Math.round(
                (Number(val.paytree) || 0) +
                (Number(val.payinter) || 0) +
                fee2Net +
                fee3Net +
                (Number(val.accu) || 0)
              );

              return (
                <div className="invoice-box" id="my-element" key={idx}>
                  {/* Header Section */}
                  <div className="invoice-header">
                    <div className="header-left">
                      <img src={LogoImg.src || LogoImg} alt="Company logo" className="invoice-logo" />
                      <div className="company-details">
                        <strong>บริษัท ทรัพย์สำราญ พิโก จำกัด</strong>
                        <span>เลขที่ประจำตัวผู้เสียภาษี 0445562001132</span>
                        <span>27 หมู่ 1 ต.ปะหลาน อ.พยัคฆภูมิพิสัย จ.มหาสารคาม 44110</span>
                        <span>โทร 064-2201381 | www.subsumran.online</span>
                      </div>
                    </div>
                    <div className="header-right">
                      <div className="invoice-title">ใบเสร็จรับเงิน</div>
                      <div className="invoice-meta">
                        <div className="meta-row">
                          <span className="label">เลขที่ใบเสร็จ:</span>
                          <span className="value">{val.reference}</span>
                        </div>
                        <div className="meta-row">
                          <span className="label">วันที่:</span>
                          <span className="value">
                            {formatDateString(val.pay_date)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Client Info Section */}
                  <div className="client-info-section">
                    <div className="info-label">ได้รับเงินจาก:</div>
                    <div className="info-content">
                      <strong>{contactObj.Name_loan || '-'}</strong><br />
                      <span>เลขที่สัญญา: {val.Id_contact}</span> | <span>งวดที่: {val.number_pay} / {contactObj.month_loan || '-'}</span><br />
                      <span>ที่อยู่: {contactObj.add_loan || '-'}</span>
                    </div>
                  </div>

                  {/* Items Table */}
                  <table className="items-table">
                    <thead>
                      <tr>
                        <th>รายละเอียดการชำระเงิน</th>
                        <th style={{ textAlign: 'right' }}>จำนวนเงิน (บาท)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>เงินต้น (Principal)</td>
                        <td className="amount-col">{Number(val.paytree || 0).toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td>ดอกเบี้ย (Interest)</td>
                        <td className="amount-col">{Number(val.payinter || 0).toLocaleString()}</td>
                      </tr>
                      {Number(val.payfee2 || 0) > 0 && (
                        <>
                          <tr>
                            <td>ค่าปรับล่าช้า (Late Fee)</td>
                            <td className="amount-col">{Number(val.payfee2).toLocaleString()}</td>
                          </tr>
                          {Number(val.dis_fee2 || 0) > 0 && (
                            <tr>
                              <td style={{ color: '#ef4444', paddingLeft: '24px', fontSize: '11px' }}>- ส่วนลดค่าปรับ (Late Fee Discount)</td>
                              <td className="amount-col" style={{ color: '#ef4444' }}>-{Number(val.dis_fee2).toLocaleString()}</td>
                            </tr>
                          )}
                        </>
                      )}
                      {Number(val.payfee3 || 0) > 0 && (
                        <>
                          <tr>
                            <td>ค่าทวงถาม (Collection Fee)</td>
                            <td className="amount-col">{Number(val.payfee3).toLocaleString()}</td>
                          </tr>
                          {Number(val.dis_fee3 || 0) > 0 && (
                            <tr>
                              <td style={{ color: '#ef4444', paddingLeft: '24px', fontSize: '11px' }}>- ส่วนลดค่าทวงถาม (Collection Fee Discount)</td>
                              <td className="amount-col" style={{ color: '#ef4444' }}>-{Number(val.dis_fee3).toLocaleString()}</td>
                            </tr>
                          )}
                        </>
                      )}
                      {Number(val.accu || 0) !== 0 && (
                        <tr>
                          <td>{Number(val.accu) < 0 ? "ใช้เงินสะสมเดิม (Used Savings)" : "จ่ายเงินสะสม / ชำระยอดค้างชำระเดิม"}</td>
                          <td className="amount-col" style={{ color: Number(val.accu) < 0 ? '#ef4444' : 'inherit' }}>
                            {Number(val.accu).toLocaleString()}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* Total Section */}
                  <div className="total-section">
                    <div>
                      <div className="total-label">ยอดชำระรวมทั้งสิ้น (Total Amount)</div>
                      <div className="baht-text">({BAHTTEXT(totalSum)})</div>
                    </div>
                    <div className="total-amount">{totalSum.toLocaleString()} บาท</div>
                  </div>

                  {/* Footer Section */}
                  <div className="footer-section">
                    <div className="notes-area">
                      <div><strong>ชำระโดย:</strong> {val.payroute === '' || !val.payroute ? 'เงินโอน' : val.payroute}</div>
                      <div><strong>กำหนดชำระครั้งต่อไป:</strong> {!val.due_date || val.due_date === '' || (contactObj.total_treerest <= 0) ? '-' : formatDateString(val.due_date)}</div>
                      <div><strong>ยอดเงินต้นคงเหลือ:</strong> {(contactObj.total_treerest <= 0) ? "-" : `${Number(val.resttree || contactObj.total_treerest || 0).toLocaleString()} บาท`}</div>
                      <div style={{ marginTop: '4px', fontStyle: 'italic', fontSize: '9px' }}>* โปรดตรวจสอบความถูกต้อง หากมีข้อสงสัยกรุณาติดต่อภายใน 7 วัน</div>
                    </div>
                    <div className="signature-box">
                      <div className="signature-title" style={{ marginBottom: '2px', fontWeight: 700 }}>ผู้รับเงิน (Receiver)</div>
                      <div className="signature-img-container">
                        <img src={SignImg.src || SignImg} className="signature-img" alt="sign" />
                      </div>
                      <div className="signature-name">(นายสุเทพ บุตรสำราญ)</div>
                      <div className="signature-title">เจ้าหน้าที่ผู้รับมอบอำนาจ</div>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {image2 && (
            <div className="bg-white p-4 rounded-lg shadow-sm border border-outline-variant/30 text-center animate-fade-in no-print">
              <p className="text-xs text-on-surface-variant mb-2 font-sans">รูปภาพใบเสร็จที่บันทึกแล้ว</p>
              <img src={image2} alt="ใบเสร็จรับเงินที่บันทึกแล้ว" className="max-w-full mx-auto border border-outline-variant/30 rounded-lg shadow-inner" />
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-3 pt-4 no-print">
            {activePdfUrl && (
              <button 
                onClick={handlePrintPdf}
                className="px-6 py-3 bg-secondary text-white font-bold rounded-lg shadow-md hover:bg-secondary/90 active:scale-95 transition-all duration-200 min-h-[44px] font-sans text-sm flex items-center justify-center gap-2"
              >
                <Printer size={16} /> พิมพ์/เปิดเอกสาร PDF
              </button>
            )}

            <button 
              onClick={handleBack}
              className="px-8 py-3 bg-primary text-white font-bold rounded-lg shadow-md hover:bg-primary/95 active:scale-95 transition-all duration-200 min-h-[44px] min-w-[140px] font-sans text-sm flex items-center justify-center gap-2"
            >
              <ChevronLeft size={16} /> ย้อนกลับ
            </button> 
          </div>
        </div>
      </div>
    );
};