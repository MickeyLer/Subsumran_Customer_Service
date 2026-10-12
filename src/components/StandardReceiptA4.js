"use client";

import React, { forwardRef } from 'react';
import { BAHTTEXT } from '../Numbertobath';
import LogoImg from '../Logo.png';
import SignImg from '../suthep_sign.png';

/**
 * StandardReceiptA4 — Master Receipt Template matching `my-app - Copy`
 * 
 * Fixed 794px width (210mm) container ensuring exact same print layout,
 * font spacing, company info, and signatures regardless of client screen size.
 */
const StandardReceiptA4 = forwardRef(({ paymentData = {}, isCancelled = false }, ref) => {
  const tree = Number(paymentData.tree || paymentData.paytree || 0);
  const intVal = Number(paymentData.int || paymentData.payinter || 0);
  const fee2 = Number(paymentData.feedisapp || paymentData.payfee2 || 0);
  const disFee2 = Number(paymentData.disfeedis || paymentData.dis_fee2 || 0);
  const fee3 = Number(paymentData.feefollow || paymentData.payfee3 || 0);
  const disFee3 = Number(paymentData.disfeefol || paymentData.dis_fee3 || 0);
  const accu = Number(paymentData.accu || 0);
  const accuDis = Number(paymentData.accu_discount || 0);

  const netFee2 = fee2 > 0 ? fee2 - disFee2 : 0;
  const netFee3 = fee3 > 0 ? fee3 - disFee3 : 0;

  const totalSum = Math.round(tree + intVal + netFee2 + netFee3 + accu - accuDis);

  const invoiceId = paymentData.invoiceID || paymentData.reference || '-';
  const contractId = paymentData.ID_contact || paymentData.Id_contact || '-';
  const customerName = paymentData.name || paymentData.customer_name || paymentData.Name_loan || '-';
  const customerAddress = paymentData.address || paymentData.add_loan || '-';
  const numPay = paymentData.number_pay || '-';
  const totalMonths = paymentData.month_loan || '-';
  const payRoute = paymentData.payroute || 'เงินโอน';
  const restTree = paymentData.resttree ?? paymentData.total_treerest ?? '-';
  const nextDue = paymentData.next_due || paymentData.due_date || '-';

  // Format date helper
  const dateStr = paymentData.date_receipt || paymentData.pay_date || new Date().toISOString().split('T')[0];

  return (
    <div
      ref={ref}
      style={{
        width: '794px',
        minHeight: '560px',
        backgroundColor: '#ffffff',
        padding: '26px 36px',
        fontFamily: "'Sarabun', sans-serif",
        color: '#1e293b',
        fontSize: '11px',
        lineHeight: '16px',
        boxSizing: 'border-box',
        position: 'relative',
        margin: '0 auto',
      }}
    >
      {/* Header Section */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          borderBottom: '2px solid #004dbe',
          paddingBottom: '8px',
          marginBottom: '8px',
        }}
      >
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          <img
            src={LogoImg.src || LogoImg}
            alt="Logo"
            style={{ height: '42px', width: 'auto', objectFit: 'contain' }}
          />
          <div style={{ fontSize: '10px', lineHeight: '14px', color: '#4b5563', textAlign: 'left' }}>
            <strong style={{ fontSize: '13px', color: '#004dbe', display: 'block', marginBottom: '2px' }}>
              บริษัท ทรัพย์สำราญ พิโก จำกัด
            </strong>
            <span style={{ display: 'block' }}>เลขที่ประจำตัวผู้เสียภาษี 0445562001132</span>
            <span style={{ display: 'block' }}>27 หมู่ 1 ต.ปะหลาน อ.พยัคฆภูมิพิสัย จ.มหาสารคาม 44110</span>
            <span style={{ display: 'block' }}>โทร 064-2201381 | www.subsumran.online</span>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '17px', fontWeight: 800, color: '#004dbe', letterSpacing: '2px', marginBottom: '4px' }}>
            ใบเสร็จรับเงิน
          </div>
          <div style={{ fontSize: '11px', color: '#1e293b' }}>
            <div>
              <span style={{ color: '#64748b', marginRight: '6px' }}>เลขที่ใบเสร็จ:</span>
              <strong style={{ fontFamily: 'monospace', fontSize: '12px' }}>{invoiceId}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', marginRight: '6px' }}>วันที่:</span>
              <strong>{dateStr}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Information */}
      <div
        style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          padding: '8px 12px',
          marginBottom: '10px',
          textAlign: 'left',
        }}
      >
        <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>
          ได้รับเงินจาก: {isCancelled && <span style={{ color: '#ef4444', marginLeft: '10px' }}>(รายการนี้ถูกยกเลิกแล้ว)</span>}
        </div>
        <div style={{ fontSize: '11px', marginTop: '2px' }}>
          <strong style={{ fontSize: '12px', color: '#0f172a' }}>{customerName}</strong><br />
          <span>เลขที่สัญญา: <b>{contractId}</b></span> | <span>งวดที่: <b>{numPay} / {totalMonths}</b></span><br />
          <span style={{ color: '#475569' }}>ที่อยู่: {customerAddress}</span>
        </div>
      </div>

      {/* Items Table */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          marginBottom: '10px',
          fontSize: '11px',
        }}
      >
        <thead>
          <tr style={{ backgroundColor: '#004dbe', color: '#ffffff' }}>
            <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>รายละเอียดการชำระเงิน</th>
            <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, width: '160px' }}>จำนวนเงิน (บาท)</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
            <td style={{ padding: '6px 10px', textAlign: 'left' }}>เงินต้น (Principal)</td>
            <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>{tree.toLocaleString()}</td>
          </tr>
          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
            <td style={{ padding: '6px 10px', textAlign: 'left' }}>ดอกเบี้ย (Interest)</td>
            <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>{intVal.toLocaleString()}</td>
          </tr>
          {fee2 > 0 && (
            <>
              <tr style={{ borderBottom: disFee2 > 0 ? 'none' : '1px solid #e2e8f0' }}>
                <td style={{ padding: '6px 10px', textAlign: 'left' }}>ค่าปรับล่าช้า (Late Fee)</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>{fee2.toLocaleString()}</td>
              </tr>
              {disFee2 > 0 && (
                <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#ef4444' }}>
                  <td style={{ padding: '4px 10px 6px 24px', textAlign: 'left', fontSize: '10px' }}>- ส่วนลดค่าปรับ (Late Fee Discount)</td>
                  <td style={{ padding: '4px 10px 6px 10px', textAlign: 'right', fontWeight: 600 }}>-{disFee2.toLocaleString()}</td>
                </tr>
              )}
            </>
          )}
          {fee3 > 0 && (
            <>
              <tr style={{ borderBottom: disFee3 > 0 ? 'none' : '1px solid #e2e8f0' }}>
                <td style={{ padding: '6px 10px', textAlign: 'left' }}>ค่าทวงถาม (Collection Fee)</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>{fee3.toLocaleString()}</td>
              </tr>
              {disFee3 > 0 && (
                <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#ef4444' }}>
                  <td style={{ padding: '4px 10px 6px 24px', textAlign: 'left', fontSize: '10px' }}>- ส่วนลดค่าทวงถาม (Collection Fee Discount)</td>
                  <td style={{ padding: '4px 10px 6px 10px', textAlign: 'right', fontWeight: 600 }}>-{disFee3.toLocaleString()}</td>
                </tr>
              )}
            </>
          )}
          {accu !== 0 && (
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '6px 10px', textAlign: 'left' }}>
                {accu < 0 ? "ใช้เงินสะสมเดิม (Used Savings)" : "ชำระยอดค้างชำระเดิม (Legacy Debt Payment)"}
              </td>
              <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: accu < 0 ? '#ef4444' : 'inherit' }}>
                {accu.toLocaleString()}
              </td>
            </tr>
          )}
          {accuDis > 0 && (
            <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#ef4444' }}>
              <td style={{ padding: '4px 10px 6px 24px', textAlign: 'left', fontSize: '10px' }}>- ส่วนลด/ปรับปรุงยอดเดิม (Legacy Adjustment)</td>
              <td style={{ padding: '4px 10px 6px 10px', textAlign: 'right', fontWeight: 600 }}>-{accuDis.toLocaleString()}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Total Section */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#eff6ff',
          border: '1.5px solid #004dbe',
          borderRadius: '6px',
          padding: '8px 14px',
          marginBottom: '12px',
        }}
      >
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#004dbe' }}>
            ยอดชำระรวมทั้งสิ้น (Total Amount)
          </div>
          <div style={{ fontSize: '10px', color: '#475569', fontStyle: 'italic' }}>
            ({BAHTTEXT(totalSum)})
          </div>
        </div>
        <div style={{ fontSize: '17px', fontWeight: 800, color: '#004dbe', fontFamily: 'monospace' }}>
          {totalSum.toLocaleString()} บาท
        </div>
      </div>

      {/* Footer Notes & Signature */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          paddingTop: '6px',
        }}
      >
        <div style={{ textAlign: 'left', fontSize: '10px', color: '#475569', lineHeight: '16px' }}>
          <div><strong>ชำระโดย:</strong> {payRoute}</div>
          <div><strong>กำหนดชำระครั้งต่อไป:</strong> {nextDue}</div>
          <div><strong>ยอดเงินต้นคงเหลือ:</strong> {typeof restTree === 'number' ? `${restTree.toLocaleString()} บาท` : `${restTree} บาท`}</div>
          <div style={{ marginTop: '4px', fontStyle: 'italic', fontSize: '8.5px', color: '#94a3b8' }}>
            * โปรดตรวจสอบความถูกต้อง หากมีข้อสงสัยกรุณาติดต่อภายใน 7 วัน
          </div>
        </div>

        <div style={{ textAlign: 'center', width: '190px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#1e293b', marginBottom: '2px' }}>
            ผู้รับเงิน (Receiver)
          </div>
          <div style={{ height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img
              src={SignImg.src || SignImg}
              alt="Signature"
              style={{ maxHeight: '34px', width: 'auto', objectFit: 'contain' }}
            />
          </div>
          <div style={{ fontSize: '10px', fontWeight: 600, color: '#1e293b', marginTop: '2px' }}>
            (นายสุเทพ บุตรสำราญ)
          </div>
          <div style={{ fontSize: '9px', color: '#64748b' }}>
            เจ้าหน้าที่ผู้รับมอบอำนาจ
          </div>
        </div>
      </div>
    </div>
  );
});

StandardReceiptA4.displayName = 'StandardReceiptA4';

export default StandardReceiptA4;
