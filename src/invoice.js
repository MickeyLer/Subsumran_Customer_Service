"use client";

import "./invoice.css";
import React, { useState, useContext, useEffect } from "react";
import { useSearchParams, useRouter } from 'next/navigation';
import { DataContext } from "./DataContext";
import { fetchInterestByReference, fetchContactById } from "./services/api";
import { DateTime } from "luxon";
import { BAHTTEXT } from './Numbertobath';
import html2canvas from 'html2canvas';
import { ChevronLeft } from 'lucide-react';
import LogoImg from './Logo.png';
import SignImg from './suthep_sign.png';

export const Invoice = () => {
    const searchParams = useSearchParams();
    const router = useRouter();
    const invoiceID = searchParams.get('invoiceID');
    const { dataInterest, dataContact } = useContext(DataContext) || {};
    const [image2, setImage] = useState(null);

    const [directInvoice, setDirectInvoice] = useState([]);
    const [directContact, setDirectContact] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
      if (!invoiceID) {
        setIsLoading(false);
        return;
      }
      let isMounted = true;
      setIsLoading(true);

      fetchInterestByReference(invoiceID).then(async (interests) => {
        if (!isMounted) return;
        setDirectInvoice(interests || []);
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

    return (
      <div className="min-h-screen bg-surface pb-20">
        {/* Header */}
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
          {(isLoading && (invoiceData.length === 0 || contactData.length === 0)) ? (
            <div className="flex flex-col justify-center items-center py-16 bg-white rounded-lg border border-outline-variant/30 shadow-sm">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mb-4"></div>
              <p className="text-on-surface-variant font-sans text-sm">กำลังโหลดข้อมูลใบเสร็จ...</p>
            </div>
          ) : (
            invoiceData.map((val, idx) => (
              <div className="invoice-box bg-white rounded-lg shadow-sm border border-outline-variant/30 overflow-hidden" id="my-element" key={idx}>
                <p className="font-sans font-bold text-primary text-body-lg text-center my-4">
                  ใบเสร็จรับเงิน
                </p>
                <table>
                  <tbody>
                    <tr className="information">
                      <td colSpan="2">
                        <table>
                          <tbody>
                            <tr>
                              <td>
                                <img src={LogoImg.src || LogoImg} alt="Company logo" style={{ width: "100%", maxWidth: "100px" }} />
                              </td>  
                              <td className="title1 font-sans">
                                <strong>บริษัท ทรัพย์สำราญ พิโก จำกัด</strong> <br />
                                เลขที่ประจำตัวผู้เสียภาษี 0445562001132<br />
                                27 หมู่ 1 ต.ปะหลาน อ.พยัคฆภูมิพิสัย จ.มหาสารคาม 44110 <br />
                                โทร 064-2201381 <a href="https://www.subsumran.online" className="text-secondary hover:text-secondary-fixed font-medium">www.subsumran.online</a>
                              </td>

                              <td className="font-sans">
                                <strong>เลขที่ใบเสร็จ:</strong> {val.reference}<br />
                                <strong>วันที่:</strong> {DateTime.fromISO(val.pay_date).toFormat("dd/MM/yyyy")} <br />
                                <strong>งวดที่:</strong> {val.number_pay} / {contactData[0].month_loan} <br />
                                --------------------<br />
                                <strong>ได้รับเงินจาก:</strong><br />
                                {contactData[0].Name_loan}<br />
                                <strong>เลขที่สัญญา:</strong> {val.Id_contact}<br />
                                <strong>ที่อยู่:</strong> {contactData[0].add_loan}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>

                    <tr className="heading font-sans">
                      <td>รายละเอียดการชำระเงิน</td>
                      <td>จำนวนเงิน</td>
                    </tr>

                    <tr className="item font-sans">
                      <td>เงินต้น</td>
                      <td>{val.paytree.toLocaleString()} บาท</td>
                    </tr>

                    <tr className="item font-sans">
                      <td>ดอกเบี้ย</td>
                      <td>{val.payinter.toLocaleString()} บาท</td>
                    </tr>

                    <tr className="item font-sans">
                      <td>ค่าปรับล่าช้า</td>
                      <td>{val.payfee2.toLocaleString()} บาท</td>
                    </tr>
                    <tr className="item font-sans">
                      <td>- ส่วนลดค่าปรับล่าช้า</td>
                      <td>{val.dis_fee2.toLocaleString()} บาท</td>
                    </tr>
                    <tr className="item font-sans">
                      <td>ค่าทวงถาม</td>
                      <td>{val.payfee3.toLocaleString()} บาท</td>
                    </tr>
                    <tr className="item font-sans">
                      <td>- ส่วนลดค่าทวงถาม</td>
                      <td>{val.dis_fee3.toLocaleString()} บาท</td>
                    </tr>
                    {val.accu > 0 && (
                      <tr className="item font-sans">
                        <td>จ่ายเงินสะสม</td>
                        <td>{val.accu.toLocaleString()} บาท</td>
                      </tr>
                    )}
                    <tr className="total font-sans">
                      <td>รวมเป็นเงินทั้งหมด</td>
                      <td> 
                        {(val.paytree + val.payinter + (val.payfee2 > 0 ? val.payfee2 : 0) - (val.dis_fee2 || 0) + (val.payfee3 > 0 ? val.payfee3 : 0) - (val.dis_fee3 || 0) + (val.accu > 0 ? (val.accu || 0) : 0)).toLocaleString()} บาท <br />
                        <span className="text-xs text-on-surface-variant font-normal font-sans">({BAHTTEXT((val.paytree + val.payinter + (val.payfee2 > 0 ? val.payfee2 : 0) - (val.dis_fee2 || 0) + (val.payfee3 > 0 ? val.payfee3 : 0) - (val.dis_fee3 || 0) + (val.accu > 0 ? (val.accu || 0) : 0)))})</span>
                      </td>
                    </tr>
                    <tr className="details font-sans">
                      <td> &nbsp;&nbsp; ชำระโดย</td>
                      <td>{val.payroute === '' ? 'เงินโอน' : val.payroute}</td>
                    </tr>
                    <tr className="details font-sans">
                      <td> &nbsp;&nbsp; กำหนดชำระครั้งต่อไป</td>
                      <td>{val.due_date === '' || (contactData[0].total_treerest <= 0) ? '-' : DateTime.fromISO(val.due_date).toFormat("dd/MM/yyyy")}</td>
                    </tr>
                    <tr className="details font-sans">
                      <td> &nbsp;&nbsp; ยอดเงินต้นคงเหลือหลังชำระแล้ว</td>
                      <td>{(contactData[0].total_treerest <= 0) ? "-" : val.resttree.toLocaleString()} บาท</td>
                    </tr>
                    <tr className="details font-sans">
                      <td> &nbsp;&nbsp; ยอดเงินสะสม/เงินค้างทั้งหมด</td>
                      <td>{contactData[0].accumulate.toLocaleString()} บาท</td>
                    </tr>
                    <tr className="details font-sans">
                      <td style={{ verticalAlign: 'middle', color: '#43474f', fontSize: '11px' }}>หมายเหตุ: โปรดตรวจสอบความถูกต้อง หากมีข้อสงสัยกรุณาติดต่อภายใน 7 วัน</td>
                      <td>
                        <p className="signature font-sans">ผู้รับเงิน</p>
                        <img src={SignImg.src || SignImg} alt="sign" style={{ width: "100%", maxWidth: "50px", margin: '4px auto', display: 'block' }} />
                        <p className="signature font-sans">(นายสุเทพ  บุตรสำราญ)</p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))
          )}

          {image2 && (
            <div className="bg-white p-4 rounded-lg shadow-sm border border-outline-variant/30 text-center animate-fade-in">
              <p className="text-xs text-on-surface-variant mb-2 font-sans">รูปภาพใบเสร็จ</p>
              <img src={image2} alt="ใบเสร็จรับเงินที่บันทึกแล้ว" className="max-w-full mx-auto border border-outline-variant/30 rounded-lg shadow-inner" />
            </div>
          )}

          <div className="flex justify-center pt-4">
            <button 
              onClick={handleBack}
              className="px-8 py-3 bg-primary text-white font-bold rounded-lg shadow-md hover:bg-primary/95 focus:outline-none focus:ring-2 focus:ring-secondary-fixed/50 hover:shadow-lg active:scale-95 transition-all duration-200 min-h-[44px] min-w-[140px] font-sans text-sm flex items-center justify-center gap-2"
            >
              <ChevronLeft size={16} /> ย้อนกลับ
            </button> 
          </div>
        </div>
      </div>
    );
};