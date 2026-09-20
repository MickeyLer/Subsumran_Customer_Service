"use client";

import React, { useState, useContext, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthContext } from './linelogin';
import { DataContext } from './DataContext';
import Swal from 'sweetalert2';
import logo from './Logo.png';
import RichMenuGrid from './components/RichMenuGrid';

function Home() {
  const router = useRouter();
  const { 
    userId, 
    realUserId, 
    displayName, 
    pictureUrl, 
    isAdmin, 
    impersonatedCustomer, 
    switchToCustomer, 
    resetToSelf 
  } = useContext(AuthContext);
  const { dataContact, dataCustomer, dataInterest } = useContext(DataContext);

  // Build unique options list for Admin Switcher Toolbar
  const customerOptions = useMemo(() => {
    const optionsMap = new Map();
    
    if (dataContact) {
      dataContact.forEach(c => {
        if (c.userID && c.userID !== realUserId && !optionsMap.has(c.userID)) {
          optionsMap.set(c.userID, {
            value: c.userID,
            label: `👤 ${c.name || 'ไม่ระบุชื่อ'} (สัญญา: ${c.ID_contact || 'N/A'})`
          });
        }
      });
    }

    if (dataCustomer) {
      dataCustomer.forEach(c => {
        const uid = c.userID || c.ID;
        if (uid && uid !== realUserId && !optionsMap.has(uid)) {
          optionsMap.set(uid, {
            value: uid,
            label: `👤 ${c.name || ''} ${c.lastname || ''}`.trim() || uid
          });
        }
      });
    }

    return Array.from(optionsMap.values());
  }, [dataContact, dataCustomer, realUserId]);

  const [activeModal, setActiveModal] = useState(null); // 'profile' | 'contact' | 'bank' | 'savings' | 'services' | 'contractSelect' | 'registerNotify' | null
  const [activeTab, setActiveTab] = useState('home'); // bottom nav tab sync
  const [selectedContractId, setSelectedContractId] = useState('');
  const [goldCalculator, setGoldCalculator] = useState({ weight: 1, type: 'ออมรายวัน' });

  // Registration Form State
  const [registerForm, setRegisterForm] = useState({
    borrowerName: '',
    contractNo: '',
  });
  const [isSubmittingRegister, setIsSubmittingRegister] = useState(false);

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!registerForm.borrowerName.trim() || !registerForm.contractNo.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'กรุณากรอกข้อมูลให้ครบถ้วน',
        text: 'โปรดระบุทั้งชื่อผู้กู้และเลขที่สัญญา',
        confirmButtonColor: '#d83a78'
      });
      return;
    }

    setIsSubmittingRegister(true);

    try {
      const GAS_WEBAPP_URL = process.env.NEXT_PUBLIC_GAS_REGISTER_URL || 'https://script.google.com/macros/s/AKfycbyV9lIdFqCSSyhcEyh_qR0fvSNPwprFmJlaVbD-BTy64KQIwbN3PMlvgsksRCyF10z29Q/exec';
      if (GAS_WEBAPP_URL) {
        await fetch(GAS_WEBAPP_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            borrowerName: registerForm.borrowerName,
            contractNo: registerForm.contractNo,
            userId: userId || 'N/A'
          })
        });
      }

      Swal.fire({
        icon: 'success',
        title: 'ส่งข้อมูลสมัครแจ้งเตือนสำเร็จ!',
        html: `
          <div class="text-left font-sans text-xs flex flex-col gap-2 mt-2">
            <p class="text-sm text-center text-gray-700 font-bold mb-1">ระบบส่งข้อมูลคำขอของท่านไปยังเจ้าหน้าที่แล้ว</p>
            <div class="bg-gray-100 p-3 rounded-lg border border-gray-200">
              <p><b>ชื่อผู้กู้:</b> ${registerForm.borrowerName}</p>
              <p><b>เลขที่สัญญา:</b> ${registerForm.contractNo}</p>
            </div>
            <p class="text-xs text-gray-500 text-center mt-1">เจ้าหน้าที่จะทำการตรวจสอบข้อมูลและเปิดระบบแจ้งเตือนให้ท่านโดยเร็วที่สุดครับ</p>
          </div>
        `,
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#06C755'
      });

      setRegisterForm({ borrowerName: '', contractNo: '' });
      closeModal();
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: 'ไม่สามารถส่งข้อมูลได้ กรุณาลองใหม่อีกครั้ง หรือติดต่อเจ้าหน้าที่',
        confirmButtonColor: '#d83a78'
      });
    } finally {
      setIsSubmittingRegister(false);
    }
  };

  // ----------------------------------------------------
  // MODAL NAVIGATION WITH MOBILE/BROWSER HISTORY SUPPORT
  // ----------------------------------------------------
  const openModal = (modalName) => {
    if (!modalName) {
      closeModal();
      return;
    }
    setActiveModal(modalName);
    if (typeof window !== 'undefined') {
      window.history.pushState({ modal: modalName }, '', `#${modalName}`);
    }
  };

  const closeModal = (shouldGoBack = true) => {
    setActiveModal(null);
    setActiveTab('home');
    if (shouldGoBack && typeof window !== 'undefined' && window.location.hash) {
      window.history.back();
    }
  };

  useEffect(() => {
    const handlePopState = (e) => {
      if (e.state && e.state.modal) {
        setActiveModal(e.state.modal);
      } else {
        setActiveModal(null);
        setActiveTab('home');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // ----------------------------------------------------
  // DATA QUERIES (MEMOIZED)
  // ----------------------------------------------------
  const userContacts = useMemo(() => {
    return dataContact ? dataContact.filter(row => row.userID === userId) : [];
  }, [dataContact, userId]);

  const activeContacts = useMemo(() => {
    return userContacts.filter(row => row.total_treerest > 0);
  }, [userContacts]);

  // Unpaid Installments Calculation
  const unpaidInstallments = useMemo(() => {
    if (!dataInterest) return [];
    const activeContractIds = activeContacts.map(c => c.ID_contact);
    return dataInterest.filter(inst => activeContractIds.includes(inst.Id_contact) && inst.status !== 1);
  }, [dataInterest, activeContacts]);

  // Sort by date to get earliest unpaid
  const { nextInstallment, nextContract } = useMemo(() => {
    const sorted = [...unpaidInstallments].sort(
      (a, b) => new Date(a.begin_date) - new Date(b.begin_date)
    );
    const earliest = sorted[0];
    const contract = earliest
      ? activeContacts.find(c => c.ID_contact === earliest.Id_contact)
      : activeContacts[0];
    return { nextInstallment: earliest, nextContract: contract };
  }, [unpaidInstallments, activeContacts]);

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

  const formatThaiMonthYear = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const months = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    return `${months[date.getMonth()]} ${date.getFullYear() + 543}`;
  };

  // ----------------------------------------------------
  // NAVIGATION TRIGGERS
  // ----------------------------------------------------
  const handleInstallmentClick = () => {
    if (activeContacts.length === 1) {
      router.push(`/Pay?IDcontact=${encodeURIComponent(activeContacts[0].ID_contact)}&autoPay=true`);
    } else if (activeContacts.length > 1) {
      if (!selectedContractId) {
        setSelectedContractId(activeContacts[0].ID_contact);
      }
      openModal('contractSelect');
    } else {
      Swal.fire({
        title: 'ไม่พบสัญญากู้เงิน',
        text: 'บัญชีไลน์ของคุณยังไม่มีประวัติสัญญาที่ต้องชำระในระบบ กรุณาติดต่อเจ้าหน้าที่เพื่อลงทะเบียนสัญญาของคุณ',
        icon: 'info',
        confirmButtonText: 'ติดต่อเจ้าหน้าที่',
        confirmButtonColor: '#d83a78',
        showCancelButton: true,
        cancelButtonText: 'ตกลง',
      }).then((result) => {
        if (result.isConfirmed) {
          openModal('contact');
        }
      });
    }
  };

  const copyToClipboard = (text, bankName) => {
    navigator.clipboard.writeText(text);
    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 2000,
      timerProgressBar: true,
    });
    Toast.fire({
      icon: 'success',
      title: `คัดลอกเลขบัญชี ${bankName} สำเร็จ!`,
    });
  };

  // Synchronize bottom nav actions
  const handleTabClick = (tab) => {
    setActiveTab(tab);
    if (tab === 'profile') openModal('profile');
    if (tab === 'installments') handleInstallmentClick();
    if (tab === 'savings') openModal('savings');
    if (tab === 'bank') openModal('bank');
    if (tab === 'contact') openModal('contact');
    if (tab === 'home') closeModal();
  };

  const handleRichMenuSelect = (id) => {
    if (id === 'profile') openModal('profile');
    if (id === 'installments') handleInstallmentClick();
    if (id === 'pay') handleInstallmentClick();
    if (id === 'savings') openModal('savings');
    if (id === 'bank') openModal('bank');
    if (id === 'contact') openModal('contact');
  };

  return (
    <div className="bg-surface font-sans text-on-background flex flex-col items-center min-h-screen pb-24 selection:bg-secondary-fixed selection:text-primary">
      {/* Top App Bar */}
      <header className="fixed top-0 left-0 w-full h-16 bg-primary border-b-2 border-secondary-fixed shadow-md z-50 flex justify-between items-center px-margin-mobile">
        <div className="flex items-center gap-base">
          <button 
            onClick={() => openModal('services')} 
            className="text-secondary-fixed hover:scale-105 active:scale-95 transition-transform flex items-center w-11 h-11 justify-center rounded-full hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-fixed/50"
            aria-label="บริการและคำนวณสินเชื่อ"
          >
            <span className="material-symbols-outlined text-[28px]">widgets</span>
          </button>
          <h1 className="text-headline-sm font-bold text-secondary-fixed leading-none tracking-tight">ทรัพย์สำราญ พีโก</h1>
        </div>
        <div className="flex items-center gap-sm">
          <button 
            onClick={() => openModal('contact')} 
            className="text-secondary-fixed hover:scale-105 active:scale-95 transition-transform flex items-center w-11 h-11 justify-center rounded-full hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-fixed/50"
            aria-label="ติดต่อเจ้าหน้าที่"
          >
            <span className="material-symbols-outlined">support_agent</span>
          </button>
          <button 
            onClick={() => openModal('profile')} 
            className="w-11 h-11 rounded-full bg-secondary-fixed flex items-center justify-center overflow-hidden border-2 border-secondary-fixed hover:scale-105 active:scale-95 transition-transform cursor-pointer shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-fixed/50 p-0"
            aria-label="ข้อมูลโปรไฟล์ผู้ใช้"
          >
            {pictureUrl ? (
              <img src={pictureUrl} alt="LINE Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-primary text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
            )}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="mt-16 w-full max-w-[600px] px-gutter py-md flex-grow flex flex-col gap-lg">
        
        {/* ADMIN CUSTOMER SWITCHER TOOLBAR */}
        {isAdmin && (
          <div className="w-full bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700 text-white rounded-xl p-md shadow-md border-2 border-amber-300 flex flex-col gap-xs font-sans">
            <div className="flex items-center justify-between border-b border-amber-400/40 pb-xs">
              <div className="flex items-center gap-xs text-xs font-bold uppercase tracking-wider text-amber-100">
                <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
                <span>🛡️ Admin Switcher Toolbar</span>
              </div>
              {userId !== realUserId && (
                <button
                  onClick={() => resetToSelf()}
                  className="text-xs font-bold bg-white text-amber-900 hover:bg-amber-100 px-2.5 py-1 rounded-lg transition-all active:scale-95 flex items-center gap-1 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                  <span>รีเซ็ตมุมมอง</span>
                </button>
              )}
            </div>

            <div className="flex flex-col gap-1 mt-xs">
              <label className="text-xs text-amber-100 font-bold">
                เลือกสลับมุมมองลูกค้า (Impersonate Customer View):
              </label>
              <select
                value={userId}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  if (selectedId === realUserId) {
                    resetToSelf();
                  } else {
                    const matchedCustomer = (dataCustomer || []).find(c => c.userID === selectedId || c.ID === selectedId);
                    const matchedContact = (dataContact || []).find(c => c.userID === selectedId);
                    const custName = matchedCustomer 
                      ? `${matchedCustomer.name || ''} ${matchedCustomer.lastname || ''}`.trim()
                      : matchedContact 
                      ? matchedContact.name 
                      : selectedId;
                    switchToCustomer(selectedId, { name: custName, id: selectedId });
                  }
                }}
                className="w-full p-2.5 rounded-lg text-sm bg-white text-gray-900 font-bold border-2 border-amber-200 outline-none shadow-sm cursor-pointer"
              >
                <option value={realUserId}>-- 👑 มุมมองแอดมิน (หน้าของตัวเอง: {displayName}) --</option>
                {customerOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {userId !== realUserId && (
              <div className="bg-black/20 p-sm rounded-lg text-xs text-amber-100 flex items-center justify-between mt-xs border border-amber-300/30">
                <span>👀 กำลังจำลองมุมมองของ: <strong className="text-white">{impersonatedCustomer?.name || userId}</strong></span>
                <span className="bg-amber-900/60 px-2 py-0.5 rounded text-[10px] font-mono">ID: {userId.substring(0, 12)}...</span>
              </div>
            )}
          </div>
        )}

        {/* Card 1: Brand Banner */}
        <div className="relative w-full h-44 rounded-2xl overflow-hidden shadow-lg border-2 border-secondary-fixed group">
          <img 
            alt="Brand Header" 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBSI9X2y3G_rYFiwEaSEpfrgJ4Wdv5hNSZWaR17I0Odqx1sHuJbCbfajReV-nlNipyB3VBESwwfM5SK35-wMcf4Y3JctJv-E-zvDiyfFo6j9lF9klnWW8g_d0xv1C5UsUo1O-gjfVqHkZMu_qx53sQ5ILmqiwGbyclfR9vsuSSlwznhCvqhFwqOox9bHRBnNbW4w7mmnTFNOT2KVCuU7gnn0NWg_VNuYyTMqMgnuaT1Y_CkROLvXtI46CaDglXXL_b1yiLpWZNqfV8"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/95 via-primary/40 to-transparent flex flex-col justify-end p-md">
            <h2 className="text-[22px] font-bold text-secondary-fixed leading-tight drop-shadow-sm font-sans">บริษัท ทรัพย์สำราญ พีโก จำกัด</h2>
            <p className="text-xs font-semibold text-white/90 tracking-wider font-sans uppercase">SUBSUMRAN PICO CO., LTD.</p>
          </div>
        </div>

        {/* Card 2: Welcome / Customer Greeting with LINE Profile */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden hover:border-primary/30 transition-all">
          <div className="p-md flex items-center gap-md">
            {/* LINE Profile Picture */}
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-full bg-secondary-fixed overflow-hidden border-4 border-primary shadow-lg">
                {pictureUrl ? (
                  <img src={pictureUrl} alt="LINE Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary">
                    <span className="material-symbols-outlined text-secondary-fixed text-[40px]" style={{ fontVariationSettings: "'FILL' 1" }}>account_circle</span>
                  </div>
                )}
              </div>
              {/* LINE badge */}
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#06C755] flex items-center justify-center shadow border-2 border-white">
                <svg viewBox="0 0 24 24" fill="white" className="w-3.5 h-3.5">
                  <path d="M12 2C6.48 2 2 6.03 2 11c0 3.24 1.79 6.09 4.54 7.83-.1.37-.39 1.37-.45 1.59-.07.27.1.27.21.2.09-.06 1.42-.94 1.99-1.32.54.08 1.09.12 1.65.12 5.52 0 10-4.03 10-9 0-4.97-4.48-9-10-9z"/>
                </svg>
              </div>
            </div>

            {/* Greeting Text */}
            <div className="flex-grow min-w-0">
              <p className="text-label-sm font-semibold text-on-surface-variant font-sans">ยินดีต้อนรับ</p>
              <h3 className="text-[20px] font-bold text-primary leading-snug truncate font-sans">
                {displayName || 'คุณลูกค้า'}
              </h3>
              <p className="text-label-sm text-on-surface-variant font-sans mt-xs">
                {dataContact === null
                  ? 'กำลังดึงข้อมูลสัญญา...'
                  : activeContacts.length > 0
                  ? `มีสัญญาใช้งาน ${activeContacts.length} ฉบับ`
                  : 'ยังไม่มีสัญญาที่เปิดบริการ'}
              </p>
            </div>

            <button 
              onClick={() => openModal('profile')}
              className="shrink-0 bg-primary text-white text-[11px] font-bold px-sm py-1.5 rounded-lg hover:bg-primary-container hover:text-secondary-fixed active:scale-95 transition-all shadow-sm flex flex-col items-center gap-0.5 font-sans"
              aria-label="ดูข้อมูลโปรไฟล์"
            >
              <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
              <span>ข้อมูล</span>
            </button>
          </div>
        </div>

        {/* Card 3: สมัครรับการแจ้งเตือนทางไลน์ / ปุ่มเพิ่มสินเชื่อ */}
        {userContacts.length > 0 ? (
          /* กรณีมียอดสัญญาที่ผูกกับ LINE แล้ว -> แสดงปุ่มเพิ่มสินเชื่อเพื่อสมัครแจ้งเตือน */
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-md flex items-center justify-between gap-md shadow-sm">
            <div className="flex items-center gap-md">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary text-[22px]">notifications_active</span>
              </div>
              <div>
                <h4 className="text-body-md font-bold text-primary font-sans leading-tight">สมัครรับแจ้งเตือนเพิ่ม</h4>
                <p className="text-xs text-on-surface-variant font-sans mt-0.5">มีสัญญาใหม่ต้องการรับแจ้งเตือนทาง LINE ใช่หรือไม่?</p>
              </div>
            </div>
            <button 
              onClick={() => openModal('registerNotify')}
              className="bg-primary hover:bg-primary-container text-white font-bold text-xs px-md py-2.5 rounded-lg active:scale-95 transition-all shrink-0 flex items-center gap-1 font-sans shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">add</span> เพิ่มสินเชื่อ
            </button>
          </div>
        ) : (
          /* กรณียังไม่มีสัญญาผูกกับ LINE -> แสดงการ์ดสมัครรับแจ้งเตือนทางไลน์แบบเต็ม */
          <div className="bg-primary text-white rounded-xl p-lg shadow-md border border-secondary-fixed/40 relative overflow-hidden flex flex-col gap-md transition-all duration-200">
            {/* Subtle geometric circles in background for premium look */}
            <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-white/5 border border-white/5 pointer-events-none" />
            <div className="absolute -left-6 -top-6 w-24 h-24 rounded-full bg-white/5 border border-white/5 pointer-events-none" />

            <div className="flex items-start gap-md">
              <div className="w-12 h-12 rounded-full bg-secondary-fixed/20 flex items-center justify-center shrink-0 border border-secondary-fixed/30 animate-pulse">
                <span className="material-symbols-outlined text-secondary-fixed text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>notifications_active</span>
              </div>
              <div className="flex-grow">
                <h3 className="text-body-lg font-bold text-secondary-fixed font-sans leading-snug">สมัครรับแจ้งเตือนทางไลน์</h3>
                <p className="text-label-sm text-white/80 font-sans mt-xs leading-relaxed">
                  รับบิลแจ้งยอดเตือนค่างวดล่วงหน้า และรับใบเสร็จในห้องแชท LINE ทันทีเมื่อทำรายการ สะดวก สบาย และปลอดภัย
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-xs border-t border-white/10 pt-md text-[13px] text-white/90">
              <div className="flex items-center gap-xs">
                <span className="material-symbols-outlined text-secondary-fixed text-[16px]">check_circle</span>
                <span><b>แจ้งเตือนอัตโนมัติ:</b> ส่งแจ้งเตือนล่วงหน้า 3 วัน ป้องกันค่าปรับ</span>
              </div>
              <div className="flex items-center gap-xs">
                <span className="material-symbols-outlined text-secondary-fixed text-[16px]">check_circle</span>
                <span><b>รับใบเสร็จทันที:</b> ระบบส่งใบเสร็จอิเล็กทรอนิกส์เข้าห้องแชททันใจ</span>
              </div>
              <div className="flex items-center gap-xs">
                <span className="material-symbols-outlined text-secondary-fixed text-[16px]">check_circle</span>
                <span><b>เชื่อมต่อง่ายดาย:</b> เชื่อมระบบแจ้งเตือนผ่านบัญชีผู้ใช้ส่วนตัว</span>
              </div>
            </div>

            <div className="flex justify-center mt-sm border-t border-white/10 pt-md">
              <button 
                onClick={() => openModal('registerNotify')}
                className="bg-secondary-fixed text-on-background hover:bg-white hover:text-primary text-label-sm font-bold px-xl py-3 rounded-lg active:scale-95 transition-all shadow-md flex items-center gap-1 font-sans w-full sm:w-auto justify-center"
              >
                สมัครรับแจ้งเตือนทันที <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        )}

        {/* Card 4: สินเชื่อ — Loading State / Empty State / Contracts */}
        {dataContact === null || dataInterest === null ? (
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg shadow-sm flex flex-col items-center justify-center py-10 gap-sm">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary/20 border-t-primary mb-2"></div>
            <p className="text-label-md font-bold text-primary font-sans">กำลังโหลดข้อมูลสินเชื่อ...</p>
            <p className="text-xs text-on-surface-variant font-sans">กรุณารอสักครู่ ระบบกำลังดึงข้อมูลจากฐานข้อมูล</p>
          </div>
        ) : activeContacts.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden hover:border-primary/30 transition-all">
            <div className="p-md flex flex-col gap-sm">
              <div className="flex items-center gap-xs">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>receipt_long</span>
                </div>
                <div>
                  <p className="text-label-sm text-on-surface-variant font-sans leading-none">สินเชื่อของฉัน</p>
                  <h4 className="text-label-lg font-bold text-primary font-sans">ข้อมูลสัญญากู้ยืม</h4>
                </div>
              </div>
              <p className="text-center text-on-surface-variant py-4 font-sans text-sm">ไม่พบข้อมูลสัญญาเงินกู้ในระบบ</p>
            </div>
          </div>
        ) : (
          activeContacts.map((c, idx) => {
            // Find installments for this contract
            const contractInstallments = dataInterest ? dataInterest.filter(inst => inst.Id_contact === c.ID_contact) : [];
            const contractUnpaid = contractInstallments.filter(inst => inst.status !== 1);
            const contractSortedUnpaid = [...contractUnpaid].sort((a, b) => new Date(a.begin_date) - new Date(b.begin_date));
            const nextInst = contractSortedUnpaid[0];

            // Progression calculations
            const paidCount = contractInstallments.filter(inst => inst.status === 1).length;
            const totalCount = Number(c.month_loan) || contractInstallments.length || 0;
            const progressPercent = totalCount > 0 ? Math.min(100, Math.round((paidCount / totalCount) * 100)) : 0;

            // Calculate next payment total (tree + interest + fee if overdue)
            let nextFee = 0;
            if (nextInst && nextInst.begin_date) {
              const beginDate = new Date(nextInst.begin_date);
              const dueDate = new Date(beginDate.getFullYear(), beginDate.getMonth() + 1, beginDate.getDate());
              const today = new Date();
              const diffTime = today - dueDate;
              const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) - 4;
              if (diffDays > 0) {
                nextFee = diffDays * 50;
              }
            }
            const nextPayTotal = nextInst ? Number(nextInst.tree || 0) + Number(nextInst.interest || 0) + nextFee : 0;

            return (
              <div 
                key={c.ID_contact}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/LoanDetails?contractId=${encodeURIComponent(c.ID_contact)}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    router.push(`/LoanDetails?contractId=${encodeURIComponent(c.ID_contact)}`);
                  }
                }}
                aria-label={`ดูรายละเอียดสัญญาที่ ${idx + 1} เลขที่ ${c.ID_contact}`}
                className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden hover:border-secondary/60 hover:shadow-sm transition-all cursor-pointer flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <div className="p-md flex flex-col gap-sm">
                  {/* Header row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-xs">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>receipt_long</span>
                      </div>
                      <div>
                        <p className="text-label-sm text-on-surface-variant font-sans leading-none">สินเชื่อของฉัน</p>
                        <h4 className="text-label-lg font-bold text-primary font-sans">สัญญาที่ {idx + 1}</h4>
                      </div>
                    </div>
                    {nextInst ? (
                      <span className="bg-error-container text-on-error-container px-sm py-0.5 rounded-full text-xs font-bold font-sans">รอชำระ</span>
                    ) : (
                      <span className="bg-green-100 text-green-700 px-sm py-0.5 rounded-full text-xs font-bold font-sans">ชำระครบแล้ว</span>
                    )}
                  </div>

                  {/* Contract Info */}
                  <div className="bg-primary/5 rounded-lg border border-primary/10 p-md flex flex-col gap-md">
                    <div className="grid grid-cols-2 gap-md">
                      <div>
                        <p className="text-label-sm text-on-surface-variant font-sans">เลขที่สัญญา</p>
                        <p className="text-body-md font-bold text-primary font-mono mt-xs">{c.ID_contact}</p>
                      </div>
                      <div>
                        <p className="text-label-sm text-on-surface-variant font-sans">กำหนดชำระ</p>
                        {nextInst ? (
                          <p className="text-body-md font-bold text-primary mt-xs font-sans">
                            {formatThaiDate(nextInst.begin_date)}
                          </p>
                        ) : (
                          <p className="text-body-md font-bold text-green-700 mt-xs font-sans">ชำระเงินครบถ้วน</p>
                        )}
                      </div>
                    </div>

                    {/* Progression Section */}
                    <div className="border-t border-primary/10 pt-sm flex flex-col gap-xs">
                      <div className="flex justify-between items-center text-xs font-sans">
                        <span className="text-on-surface-variant font-medium">ความคืบหน้าการผ่อนชำระ</span>
                        <span className="font-bold text-primary">
                          {totalCount > 0
                            ? `ชำระไป ${paidCount} งวดจาก ${totalCount} งวด (${progressPercent}%)`
                            : `ชำระไป ${paidCount} งวด`}
                        </span>
                      </div>
                      {totalCount > 0 && (
                        <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-primary h-full rounded-full transition-all duration-500 ease-out" 
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      )}
                    </div>
                    
                    {nextInst && (
                      <div className="border-t border-primary/10 pt-sm flex items-center justify-between">
                        <div>
                          <p className="text-label-sm text-on-surface-variant font-sans">ยอดที่ต้องชำระครั้งถัดไป</p>
                          <p className="text-headline-sm font-bold text-primary leading-none mt-xs">
                            {nextPayTotal.toLocaleString()}
                            <span className="text-body-md font-normal ml-1">฿</span>
                          </p>
                          {nextFee > 0 && (
                            <p className="text-[11px] font-bold text-red-600 mt-1 font-sans">
                              (รวมค่าปรับ {nextFee.toLocaleString()} ฿)
                            </p>
                          )}
                        </div>
                        <span className="text-xs font-bold text-white bg-primary hover:bg-primary-container px-md py-2 rounded-lg flex items-center gap-0.5 font-sans shadow-sm">
                          ดูรายละเอียด <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </main>

      {/* Synchronized Bottom Navigation Bar */}
      <nav role="tablist" className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-xs py-base bg-surface-container-lowest max-w-[600px] mx-auto border-t border-outline-variant shadow-lg rounded-t-xl">
        <button 
          onClick={() => handleTabClick('home')}
          role="tab"
          aria-selected={activeTab === 'home' && activeModal === null}
          aria-label="หน้าหลัก"
          className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all cursor-pointer border-0 bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
            activeTab === 'home' && activeModal === null
              ? 'bg-primary text-secondary-fixed scale-105 shadow-md px-md'
              : 'text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          <span className="material-symbols-outlined">home</span>
          <span className="text-label-sm font-bold font-sans">หน้าหลัก</span>
        </button>

        <button 
          onClick={() => handleTabClick('installments')}
          role="tab"
          aria-selected={activeModal === 'contractSelect' || activeTab === 'installments'}
          aria-label="ค่างวด"
          className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all cursor-pointer border-0 bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
            activeModal === 'contractSelect' || activeTab === 'installments'
              ? 'bg-primary text-secondary-fixed scale-105 shadow-md px-md'
              : 'text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          <span className="material-symbols-outlined">calendar_month</span>
          <span className="text-label-sm font-bold font-sans">ค่างวด</span>
        </button>

        <button 
          onClick={() => handleTabClick('bank')}
          role="tab"
          aria-selected={activeModal === 'bank'}
          aria-label="บัญชี"
          className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all cursor-pointer border-0 bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
            activeModal === 'bank'
              ? 'bg-primary text-secondary-fixed scale-105 shadow-md px-md'
              : 'text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          <span className="material-symbols-outlined">account_balance</span>
          <span className="text-label-sm font-bold font-sans">บัญชี</span>
        </button>

        <button 
          onClick={() => handleTabClick('contact')}
          role="tab"
          aria-selected={activeModal === 'contact'}
          aria-label="ติดต่อ"
          className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all cursor-pointer border-0 bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
            activeModal === 'contact'
              ? 'bg-primary text-secondary-fixed scale-105 shadow-md px-md'
              : 'text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          <span className="material-symbols-outlined">support_agent</span>
          <span className="text-label-sm font-bold font-sans">ติดต่อ</span>
        </button>
      </nav>

      {/* ----------------------------------------------------
          MODALS & DRAWERS (Glassmorphic & Animated Backdrop)
          ---------------------------------------------------- */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-gutter animate-fade-in">
          {/* Blur Overlay */}
          <div onClick={closeModal} className="absolute inset-0 bg-primary/45 backdrop-blur-sm transition-opacity" />

          {/* Modal Content Card */}
          <div className="relative bg-white rounded-xl max-w-[500px] w-full max-h-[85vh] overflow-y-auto shadow-xl border border-outline-variant p-md flex flex-col gap-md animate-scale-up">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-outline-variant/30 pb-sm">
              <div className="flex items-center gap-xs text-primary">
                {activeModal === 'profile' && <span className="material-symbols-outlined font-bold text-secondary">account_box</span>}
                {activeModal === 'contact' && <span className="material-symbols-outlined font-bold text-secondary">contact_support</span>}
                {activeModal === 'bank' && <span className="material-symbols-outlined font-bold text-secondary">account_balance</span>}
                {activeModal === 'savings' && <span className="material-symbols-outlined font-bold text-secondary">gold</span>}
                {activeModal === 'services' && <span className="material-symbols-outlined font-bold text-secondary">widgets</span>}
                {activeModal === 'contractSelect' && <span className="material-symbols-outlined font-bold text-secondary">receipt_long</span>}
                {activeModal === 'registerNotify' && <span className="material-symbols-outlined font-bold text-secondary">notifications_active</span>}
                <h2 className="text-headline-sm font-bold">
                  {activeModal === 'profile' && 'ข้อมูลลูกค้า'}
                  {activeModal === 'contact' && 'ช่องทางการติดต่อ'}
                  {activeModal === 'bank' && 'เลขที่บัญชีบริษัท'}
                  {activeModal === 'savings' && 'บริการออมทองคำ'}
                  {activeModal === 'services' && 'บริการและคำนวณสินเชื่อ'}
                  {activeModal === 'contractSelect' && 'เลือกสัญญาที่ต้องการชำระ'}
                  {activeModal === 'registerNotify' && 'ขั้นตอนสมัครแจ้งเตือนทาง LINE'}
                </h2>
              </div>
              <button 
                onClick={closeModal}
                className="w-11 h-11 rounded-full bg-surface-container-high text-on-surface hover:bg-error hover:text-white transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/50 shrink-0"
                aria-label="ปิดกล่องข้อความ"
              >
                <span className="material-symbols-outlined text-[24px]">close</span>
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-grow text-on-surface">
              {/* MODAL 0: REGISTER NOTIFICATION FLOW */}
              {activeModal === 'registerNotify' && (
                <div className="flex flex-col gap-md font-sans">
                  <div className="bg-primary/5 border border-primary/20 p-md rounded-lg text-center">
                    <p className="text-label-sm font-bold text-primary">ขั้นตอนการสมัครรับแจ้งเตือนทาง LINE</p>
                    <p className="text-xs text-on-surface-variant mt-1">กรอกข้อมูลผู้กู้และเลขที่สัญญาเพื่อแจ้งเจ้าหน้าที่เปิดระบบแจ้งเตือน</p>
                  </div>

                  <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-md">
                    {/* Step 1: Input Details */}
                    <div className="bg-surface border border-outline-variant p-md rounded-lg flex flex-col gap-sm shadow-sm">
                      <div className="flex items-center gap-xs">
                        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-secondary-fixed font-black text-body-md shrink-0">1</span>
                        <h4 className="text-body-md font-bold text-primary">กรอกชื่อผู้กู้ และเลขที่สัญญา</h4>
                      </div>

                      <div className="flex flex-col gap-sm mt-xs">
                        <div>
                          <label className="text-xs font-bold text-on-surface-variant mb-1 block">ชื่อ-นามสกุล ผู้กู้ <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            required
                            placeholder="ตัวอย่าง: นายสมชาย ใจดี"
                            value={registerForm.borrowerName}
                            onChange={(e) => setRegisterForm({ ...registerForm, borrowerName: e.target.value })}
                            className="w-full px-md py-2.5 rounded-lg border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm transition-all"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-on-surface-variant mb-1 block">เลขที่สัญญา <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            required
                            placeholder="ตัวอย่าง: 67/0001"
                            value={registerForm.contractNo}
                            onChange={(e) => setRegisterForm({ ...registerForm, contractNo: e.target.value })}
                            className="w-full px-md py-2.5 rounded-lg border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Step 2: Submit Button */}
                    <div className="bg-surface border border-outline-variant p-md rounded-lg flex flex-col gap-xs shadow-sm">
                      <div className="flex items-center gap-xs">
                        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-secondary-fixed font-black text-body-md shrink-0">2</span>
                        <h4 className="text-body-md font-bold text-primary">กดสมัครรับแจ้งเตือน</h4>
                      </div>
                      <p className="text-[12px] text-on-surface-variant">ระบบจะส่งข้อความที่มีชื่อผู้กู้ และเลขที่สัญญา ให้เจ้าหน้าที่โดยอัตโนมัติเพื่อเปิดระบบ</p>

                      <button
                        type="submit"
                        disabled={isSubmittingRegister}
                        className="mt-sm w-full bg-[#06C755] hover:bg-[#05b34c] text-white font-bold text-label-md py-3 rounded-lg active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 font-sans disabled:opacity-50 cursor-pointer"
                      >
                        {isSubmittingRegister ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                            <span>กำลังส่งข้อมูล...</span>
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[20px]">send</span>
                            <span>สมัครรับแจ้งเตือนทันที</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* MODAL 1: PROFILE INFO */}
              {activeModal === 'profile' && (
                <div className="flex flex-col gap-md">
                  <div className="flex items-center gap-md bg-primary-container/10 p-md rounded-lg border border-primary-container/20">
                    <div className="w-16 h-16 rounded-full bg-secondary-fixed overflow-hidden border-2 border-primary shadow">
                      {pictureUrl ? (
                        <img src={pictureUrl} alt="LINE Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-primary text-[36px] font-bold">
                          {displayName?.charAt(0) || 'U'}
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="text-body-lg font-bold text-primary">{displayName || 'ไม่ระบุชื่อ'}</h4>
                    </div>
                  </div>

                  <h3 className="text-label-lg font-bold text-primary border-b border-outline-variant/20 pb-xs">รายการสัญญาเงินกู้ของคุณ</h3>
                  
                  {userContacts.length === 0 ? (
                    <p className="text-center text-on-surface-variant py-md">ยังไม่มีสัญญาเงินกู้จดทะเบียนในระบบ</p>
                  ) : (
                    <div className="flex flex-col gap-sm">
                      {userContacts.map((c, i) => (
                        <div 
                          key={i} 
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            closeModal(false);
                            router.push(`/Pay?IDcontact=${encodeURIComponent(c.ID_contact)}&autoPay=true`);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              closeModal(false);
                              router.push(`/Pay?IDcontact=${encodeURIComponent(c.ID_contact)}&autoPay=true`);
                            }
                          }}
                          aria-label={`ชำระเงินสัญญาเลขที่ ${c.ID_contact}`}
                          className="bg-surface border border-outline-variant rounded-lg p-md flex flex-col gap-xs hover:border-secondary cursor-pointer transition-all hover:bg-secondary-container/5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-body-md font-bold text-primary">เลขที่สัญญา: {c.ID_contact}</span>
                            {c.total_treerest <= 0 ? (
                              <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">ปิดบัญชีแล้ว</span>
                            ) : (
                              <span className="bg-secondary-container text-on-secondary-container text-[10px] font-bold px-2 py-0.5 rounded-full">กำลังผ่อนชำระ</span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-xs text-[12px] text-on-surface-variant">
                            <p>ยอดวงเงินกู้: <span className="font-bold">{c.total_loan?.toLocaleString()} ฿</span></p>
                            <p>ค่างวด: <span className="font-bold">{c.paypermonth?.toLocaleString()} ฿/{c.month_loan}ด.</span></p>
                            <p className="col-span-2">เงินต้นคงเหลือ: <span className="font-bold text-error">{c.total_treerest?.toLocaleString()} ฿</span></p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* MODAL 2: CONTACT INFO */}
              {activeModal === 'contact' && (
                <div className="flex flex-col gap-md">
                  <div className="bg-primary/5 rounded-lg border border-primary/10 overflow-hidden shadow-sm">
                    <img src={logo.src || logo} alt="Company Logo" className="w-28 mx-auto my-md drop-shadow" />
                    <p className="text-center text-label-sm font-bold text-primary">บริษัท ทรัพย์สำราญ พีโก จำกัด</p>
                    <p className="text-center text-[11px] text-on-surface-variant px-md pb-md">ใบอนุญาตประกอบธุรกิจสินเชื่อรายย่อยระดับจังหวัดภายใต้การกำกับ (Pico Finance)</p>
                  </div>

                  <div className="flex flex-col gap-sm">
                    <a href="tel:0642201381" className="flex items-center gap-md bg-surface border border-outline-variant hover:border-secondary p-md rounded-lg transition-all shadow-sm">
                      <span className="material-symbols-outlined text-[28px] text-primary bg-primary/10 p-sm rounded-full">call</span>
                      <div>
                        <p className="text-label-sm text-outline">เบอร์โทรศัพท์ (คลิกเพื่อโทร)</p>
                        <p className="text-body-md font-bold text-primary">064-220-1381</p>
                      </div>
                    </a>

                    <div className="flex items-center gap-md bg-surface border border-outline-variant p-md rounded-lg shadow-sm">
                      <span className="material-symbols-outlined text-[28px] text-primary bg-primary/10 p-sm rounded-full">home_pin</span>
                      <div>
                        <p className="text-label-sm text-outline">ที่ตั้งสำนักงาน</p>
                        <p className="text-[13px] font-semibold text-on-surface leading-tight">79/5 บ้านโนนม่วง ต.ราษฏร์เจริญ อ.พยัคฆภูมิพิสัย จ.มหาสารคาม 44110</p>
                      </div>
                    </div>

                    <a href="https://www.subsumran.online" target="_blank" rel="noreferrer" className="flex items-center gap-md bg-surface border border-outline-variant hover:border-secondary p-md rounded-lg transition-all shadow-sm">
                      <span className="material-symbols-outlined text-[28px] text-primary bg-primary/10 p-sm rounded-full">language</span>
                      <div>
                        <p className="text-label-sm text-outline">เว็บไซต์อย่างเป็นทางการ</p>
                        <p className="text-body-md font-bold text-primary">www.subsumran.online</p>
                      </div>
                    </a>
                  </div>
                </div>
              )}

              {/* MODAL 3: BANK ACCOUNTS */}
              {activeModal === 'bank' && (
                <div className="flex flex-col gap-md">
                  <div className="bg-secondary-container/10 border border-secondary/20 p-md rounded-lg text-center">
                    <p className="text-[13px] text-secondary font-bold">เพื่อความสะดวกรวดเร็วในการตรวจสอบยอดชำระ</p>
                    <p className="text-label-sm text-on-surface-variant mt-xs">กรุณาโอนเงินเข้าบัญชีทางการของบริษัทด้านล่างนี้ และอัปโหลดสลิปเพื่อขอใบเสร็จผ่านหน้าระบบ</p>
                  </div>

                  <div className="flex flex-col gap-md">
                    {/* SCB CARD */}
                    <div className="bg-[#4e2e8a] text-white rounded-xl p-md shadow-sm border border-purple-300/30 relative overflow-hidden flex flex-col gap-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[11px] text-purple-200 uppercase font-bold tracking-wider font-sans">ธนาคารไทยพาณิชย์ (SCB)</p>
                          <h4 className="text-body-lg font-bold mt-xs font-sans">บริษัท ทรัพย์สำราญ พิโก จำกัด</h4>
                        </div>
                        <span className="text-[11px] bg-white/20 px-sm py-0.5 rounded-full font-bold font-sans">บัญชีบริษัท</span>
                      </div>
                      <div className="flex items-center justify-between bg-black/25 p-sm rounded-lg border border-white/10">
                        <span className="font-mono text-headline-sm font-bold tracking-wider">426-047180-9</span>
                        <button 
                          onClick={() => copyToClipboard('4260471809', 'ไทยพาณิชย์ (SCB)')}
                          className="bg-secondary-container text-on-secondary-container hover:bg-secondary-fixed text-label-sm font-bold px-sm py-2 min-h-[44px] rounded-lg active:scale-95 transition-all shadow-md flex items-center gap-1 font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">content_copy</span> คัดลอก
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* MODAL 4: GOLD SAVINGS RATES & CALCULATOR */}
              {activeModal === 'savings' && (
                <div className="flex flex-col gap-md">
                  <div className="bg-secondary-container/30 rounded-xl p-md shadow-sm border border-secondary/40 text-center flex flex-col gap-xs">
                    <p className="text-[12px] font-bold text-secondary uppercase tracking-widest font-sans">บริการออมทองคำคุณภาพเยี่ยม</p>
                    <h3 className="text-headline-sm font-bold text-on-background font-sans">ราคารับออมทองคำวันนี้</h3>
                    <p className="text-headline-md font-black text-primary font-mono mt-xs">33,500 บ. / บาททองคำ</p>
                    <p className="text-[11px] text-on-surface-variant font-sans">ปรับปรุงตามสมาคมค้าทองคำแห่งประเทศไทย</p>
                  </div>

                  <div className="border border-outline-variant rounded-lg p-md bg-surface flex flex-col gap-sm">
                    <h4 className="text-label-lg font-bold text-primary">เครื่องคำนวณแผนการออม</h4>
                    
                    <div className="flex flex-col gap-xs">
                      <label className="text-[11px] text-outline font-bold">น้ำหนักทองคำที่ต้องการออม</label>
                      <select 
                        value={goldCalculator.weight} 
                        onChange={(e) => setGoldCalculator({ ...goldCalculator, weight: Number(e.target.value) })}
                        className="border border-outline rounded-lg p-sm bg-white font-sans text-body-md text-on-surface outline-none"
                      >
                        <option value={0.125}>ครึ่งสลึง (1.89 กรัม)</option>
                        <option value={0.25}>1 สลึง (3.79 กรัม)</option>
                        <option value={0.5}>2 สลึง (7.58 กรัม)</option>
                        <option value={1}>1 บาท (15.16 กรัม)</option>
                        <option value={2}>2 บาท (30.32 กรัม)</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-xs">
                      <label className="text-[11px] text-outline font-bold">รูปแบบการสะสม</label>
                      <div className="grid grid-cols-3 gap-xs">
                        {['ออมรายวัน', 'ออมรายสัปดาห์', 'ออมรายเดือน'].map((mode) => (
                          <button
                            key={mode}
                            onClick={() => setGoldCalculator({ ...goldCalculator, type: mode })}
                            className={`py-2 rounded-lg text-label-sm font-bold shadow-sm transition-all border ${
                              goldCalculator.type === mode
                                ? 'bg-primary text-secondary-fixed border-primary'
                                : 'bg-white text-on-surface-variant border-outline-variant hover:bg-slate-50'
                            }`}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-secondary-container/20 p-md rounded-lg border border-secondary-fixed/50 flex flex-col gap-xs mt-sm text-center">
                      <p className="text-label-sm text-on-secondary-container">ประมาณการค่าส่งออมสะสม:</p>
                      <p className="text-headline-sm font-black text-secondary">
                        {goldCalculator.type === 'ออมรายวัน' && `${Math.ceil((33500 * goldCalculator.weight) / 180)} บ. / วัน (180 วัน)`}
                        {goldCalculator.type === 'ออมรายสัปดาห์' && `${Math.ceil((33500 * goldCalculator.weight) / 24)} บ. / สัปดาห์ (24 สัปดาห์)`}
                        {goldCalculator.type === 'ออมรายเดือน' && `${Math.ceil((33500 * goldCalculator.weight) / 6)} บ. / เดือน (6 เดือน)`}
                      </p>
                      <p className="text-[10px] text-outline-variant/80 font-sans mt-xs">*คำนวณจากราคาประเมินเบื้องต้น สามารถเปลี่ยนน้ำหนักทองและส่งได้เรื่อยๆ ไม่มีขั้นต่ำ</p>
                    </div>
                  </div>
                </div>
              )}

              {/* MODAL 5: CREDIT SERVICES / Pico Loans */}
              {activeModal === 'services' && (
                <div className="flex flex-col gap-md">
                  <div className="flex flex-col gap-sm">
                    <div className="border border-outline-variant rounded-lg p-md bg-surface flex flex-col gap-xs relative overflow-hidden">
                      <div className="absolute top-0 right-0 bg-primary text-secondary-fixed px-sm py-[2px] rounded-bl-lg text-[9px] font-bold font-sans">Pico Finance</div>
                      <h4 className="text-body-md font-bold text-primary">สินเชื่ออเนกประสงค์ ทรัพย์สำราญ</h4>
                      <p className="text-label-sm text-on-surface-variant">สินเชื่อสำหรับบุคคลทั่วไปเพื่อเสริมสภาพคล่องทางการเงิน ดอกเบี้ยลดต้นลดดอกสูงสุดไม่เกิน 3% ต่อเดือน อนุมัติง่ายในพื้นที่</p>
                      <div className="mt-sm flex justify-between items-center">
                        <span className="text-[11px] text-outline font-bold">วงเงินกู้สูงสุด 50,000 บาท</span>
                        <a href="tel:0642201381" className="bg-primary text-secondary-fixed text-label-sm font-bold px-sm py-1.5 rounded-lg active:scale-95 shadow transition-all">โทรปรึกษา</a>
                      </div>
                    </div>

                    <div className="border border-outline-variant rounded-lg p-md bg-surface flex flex-col gap-xs relative overflow-hidden">
                      <div className="absolute top-0 right-0 bg-primary text-secondary-fixed px-sm py-[2px] rounded-bl-lg text-[9px] font-bold font-sans">Nano Finance</div>
                      <h4 className="text-body-md font-bold text-primary">สินเชื่อเพื่อการค้า/แม่ค้าคนเก่ง</h4>
                      <p className="text-label-sm text-on-surface-variant">เหมาะสำหรับพ่อค้าแม่ขาย ร้านค้าปลีก ตลาดสด เพื่อนำไปใช้เป็นทุนหมุนเวียนในการซื้อวัตถุดิบและขยายร้านค้า</p>
                      <div className="mt-sm flex justify-between items-center">
                        <span className="text-[11px] text-outline font-bold">วงเงินกู้สูงสุด 100,000 บาท</span>
                        <a href="tel:0642201381" className="bg-primary text-secondary-fixed text-label-sm font-bold px-sm py-1.5 rounded-lg active:scale-95 shadow transition-all">โทรปรึกษา</a>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* MODAL 6: CONTRACT SELECTOR FOR MULTI-CONTRACT CLIENTS */}
              {activeModal === 'contractSelect' && (
                <div className="flex flex-col gap-sm">
                  <p className="text-label-sm text-on-surface-variant border-b border-outline-variant/20 pb-sm mb-xs">
                    บัญชีของคุณมีสัญญาที่อยู่ระหว่างผ่อนชำระหลายฉบับ กรุณาเลือกสัญญาที่ต้องการชำระหรือตรวจสอบค่างวด:
                  </p>
                  <div className="flex flex-col gap-sm">
                    {activeContacts.map((c, i) => {
                      const isSelected = (selectedContractId || activeContacts[0]?.ID_contact) === c.ID_contact;
                      return (
                        <div 
                          key={i}
                          onClick={() => {
                            setSelectedContractId(c.ID_contact);
                            closeModal(false);
                            router.push(`/Pay?IDcontact=${encodeURIComponent(c.ID_contact)}&autoPay=true`);
                          }}
                          className={`bg-surface border rounded-lg p-md cursor-pointer transition-all shadow-sm flex justify-between items-center group ${
                            isSelected 
                              ? 'border-primary ring-2 ring-primary/20 bg-primary/5' 
                              : 'hover:bg-secondary-container/5 hover:border-secondary border-outline-variant'
                          }`}
                        >
                          <div>
                            <p className="text-body-md font-bold text-primary">เลขที่สัญญา: {c.ID_contact}</p>
                            <p className="text-label-sm text-on-surface-variant mt-xs">
                              ยอดวงเงินกู้: <span className="font-bold">{c.total_loan?.toLocaleString()} ฿</span> | ค่างวด: <span className="font-bold text-primary">{c.paypermonth?.toLocaleString()} ฿</span>
                            </p>
                          </div>
                          <span className="material-symbols-outlined text-secondary text-[24px] group-hover:translate-x-1 transition-transform">
                            arrow_forward_ios
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-outline-variant/30 pt-sm flex justify-end">
              <button 
                onClick={() => {
                  if (activeModal === 'contractSelect') {
                    const targetId = selectedContractId || activeContacts[0]?.ID_contact;
                    closeModal(false);
                    if (targetId) {
                      router.push(`/Pay?IDcontact=${encodeURIComponent(targetId)}&autoPay=true`);
                    }
                  } else {
                    closeModal();
                  }
                }}
                className="bg-primary text-white text-label-sm font-bold px-md py-2 rounded-lg hover:opacity-90 active:scale-95 transition-all font-sans"
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
