"use client";

import React, { useState, useContext, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthContext } from './linelogin';
import { DataContext } from './DataContext';
import Swal from 'sweetalert2';
import logo from './Logo.png';
import RichMenuGrid from './components/RichMenuGrid';
import RewardsPortal from './components/RewardsPortal';
import supabase from './supabaseClient';
import { calculateTierInfo } from './utils/tierConfig';
import { getContractProgression, getOverallProgression, formatThaiDate } from './utils/installmentProgression';
import { getCollateralTypeInfo } from './utils/collateralType';

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
    resetToSelf,
    isAuthLoading
  } = useContext(AuthContext);
  const { dataContact, dataCustomer, dataInterest, refreshUserData, ensureAdminDataLoaded } = useContext(DataContext) || {};

  // Loyalty & Points State (Synced with Supabase line_users)
  const [userPoints, setUserPoints] = useState(380);

  useEffect(() => {
    if (!userId) return;
    const fetchLoyaltyPoints = async () => {
      try {
        const { data, error } = await supabase
          .from('line_users')
          .select('total_points, tier_level')
          .eq('line_user_id', userId)
          .maybeSingle();

        if (data && data.total_points !== undefined && data.total_points !== null) {
          setUserPoints(Number(data.total_points));
        }
      } catch (err) {
        console.warn('Failed to fetch user points from Supabase:', err);
      }
    };
    fetchLoyaltyPoints();
  }, [userId]);

  const tierInfo = useMemo(() => calculateTierInfo(userPoints), [userPoints]);

  useEffect(() => {
    if (userId && refreshUserData) {
      refreshUserData(userId);
    }
  }, [userId, refreshUserData]);

  // Dynamic Customer Name Resolver (prefers impersonated -> LIFF displayName -> DB Customer/Contact -> empty during loading)
  const customerDisplayName = useMemo(() => {
    if (impersonatedCustomer?.name) {
      return impersonatedCustomer.name;
    }
    if (displayName) {
      return displayName;
    }
    if (dataCustomer && userId) {
      const matched = dataCustomer.find(c => c.userID === userId || c.ID === userId);
      if (matched) {
        const full = `${matched.name || ''} ${matched.lastname || ''}`.trim();
        if (full) return full;
      }
    }
    if (dataContact && userId) {
      const matched = dataContact.find(c => c.userID === userId);
      const contactName = matched?.Name_loan || matched?.name;
      if (contactName) return contactName;
    }
    return '';
  }, [impersonatedCustomer, displayName, dataCustomer, dataContact, userId]);

  // Admin Switcher Autocomplete State
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [isAdminSearchOpen, setIsAdminSearchOpen] = useState(false);
  const [navigatingContractId, setNavigatingContractId] = useState(null);

  const handleNavigateDetail = (contractId) => {
    setNavigatingContractId(contractId);
    router.push(`/LoanDetails?contractId=${encodeURIComponent(contractId)}`);
  };

  // Build searchable items list (Contracts + Customers) for Autocomplete
  const searchableAdminItems = useMemo(() => {
    const items = [];
    const seenKeys = new Set();

    if (dataContact) {
      dataContact.forEach(c => {
        if (!c.userID || c.userID === realUserId) return;
        const key = `${c.ID_contact}_${c.userID}`;
        if (seenKeys.has(key)) return;
        seenKeys.add(key);

        const custName = c.Name_loan || c.name || 'ไม่ระบุชื่อ';
        const contractNo = c.ID_contact || '-';
        const searchStr = `${contractNo} ${custName} ${c.userID}`.toLowerCase();

        items.push({
          contractNo: contractNo,
          customerName: custName,
          userId: c.userID,
          totalLoan: c.total_loan,
          totalTreerest: c.total_treerest,
          status: c.total_treerest > 0 ? 'ผ่อนชำระ' : (c.total_treerest === 0 ? 'ปิดบัญชีแล้ว' : 'สัญญา'),
          searchStr: searchStr,
          type: 'contract'
        });
      });
    }

    if (dataCustomer) {
      dataCustomer.forEach(c => {
        const uid = c.userID || c.ID;
        if (!uid || uid === realUserId) return;
        const fullName = `${c.name || ''} ${c.lastname || ''}`.trim() || 'ลูกค้าไม่ระบุชื่อ';
        const key = `cust_${uid}`;
        if (seenKeys.has(key)) return;
        seenKeys.add(key);

        const searchStr = `${fullName} ${uid}`.toLowerCase();
        items.push({
          contractNo: '-',
          customerName: fullName,
          userId: uid,
          totalLoan: null,
          totalTreerest: null,
          status: 'บัญชีลูกค้า',
          searchStr: searchStr,
          type: 'customer'
        });
      });
    }

    return items;
  }, [dataContact, dataCustomer, realUserId]);

  // Filtered Autocomplete Results
  const filteredAdminResults = useMemo(() => {
    if (!adminSearchQuery.trim()) {
      return searchableAdminItems.slice(0, 15);
    }
    const query = adminSearchQuery.trim().toLowerCase();
    return searchableAdminItems
      .filter(item => item.searchStr.includes(query))
      .slice(0, 25);
  }, [adminSearchQuery, searchableAdminItems]);

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

  // Overall Progression Query
  const { nextInstallment, nextContract } = useMemo(() => {
    return getOverallProgression(activeContacts, dataInterest || []);
  }, [activeContacts, dataInterest]);



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
    <div className="bg-[#f8f9fa] font-sans text-slate-800 flex flex-col items-center min-h-screen pb-24 selection:bg-rose-100 selection:text-primary">
      {/* Top App Bar */}
      <header className="fixed top-0 left-0 w-full h-16 bg-gradient-to-r from-primary via-[#d83a78] to-[#ba2660] border-b border-amber-200/30 shadow-sm z-50 flex justify-between items-center px-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border-2 border-white/80 shadow-xs overflow-hidden shrink-0">
            <img src={logo.src || logo} alt="Logo" className="w-full h-full object-cover scale-110" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-tight tracking-tight font-sans">ทรัพย์สำราญ พิโก</h1>
            <p className="text-[10px] text-amber-200 font-semibold tracking-wider font-sans uppercase">PICO FINANCE</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => openModal('services')} 
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer"
            aria-label="บริการและคำนวณสินเชื่อ"
          >
            <span className="material-symbols-outlined text-[22px]">widgets</span>
          </button>
          <button 
            onClick={() => openModal('contact')} 
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer"
            aria-label="ติดต่อเจ้าหน้าที่"
          >
            <span className="material-symbols-outlined text-[22px]">support_agent</span>
          </button>
          <button 
            onClick={() => openModal('profile')} 
            className="w-10 h-10 rounded-full bg-white/15 overflow-hidden border-2 border-amber-300/60 hover:scale-105 active:scale-95 transition-transform cursor-pointer shadow-xs p-0 flex items-center justify-center"
            aria-label="ข้อมูลโปรไฟล์ผู้ใช้"
          >
            {pictureUrl ? (
              <img src={pictureUrl} alt="LINE Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-white text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
            )}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="mt-16 w-full max-w-[600px] px-4 py-4 flex-grow flex flex-col gap-4">
        
        {/* ADMIN CUSTOMER SWITCHER TOOLBAR WITH AUTOCOMPLETE */}
        {isAdmin && (
          <div className="w-full bg-gradient-to-r from-amber-800 via-amber-700 to-amber-800 text-white rounded-xl p-md shadow-lg border-2 border-amber-300 flex flex-col gap-sm font-sans relative z-40">
            <div className="flex items-center justify-between border-b border-amber-400/30 pb-xs">
              <div className="flex items-center gap-xs text-xs font-bold text-amber-100 font-sans">
                <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
                <span>🛡️ Admin Switcher</span>
              </div>
              {userId !== realUserId && (
                <button
                  onClick={() => {
                    resetToSelf();
                    setAdminSearchQuery('');
                    setIsAdminSearchOpen(false);
                    if (refreshUserData) refreshUserData(realUserId);
                  }}
                  className="text-xs font-bold bg-white text-amber-900 hover:bg-amber-100 px-2.5 py-1 rounded-lg transition-all active:scale-95 flex items-center gap-1 shadow-sm font-sans"
                >
                  <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                  <span>รีเซ็ตมุมมอง</span>
                </button>
              )}
            </div>

            {/* Autocomplete Input Container */}
            <div className="relative w-full">
              <label className="text-xs text-amber-100 font-bold mb-1 block font-sans">
                ค้นหาเลขที่สัญญา หรือ ชื่อลูกค้า:
              </label>
              
              <div className="relative flex items-center font-sans">
                <span className="material-symbols-outlined absolute left-3 text-amber-700 text-[20px] pointer-events-none">
                  search
                </span>
                
                <input
                  type="text"
                  value={adminSearchQuery}
                  onFocus={() => {
                    if (ensureAdminDataLoaded) ensureAdminDataLoaded();
                    setIsAdminSearchOpen(true);
                  }}
                  onChange={(e) => {
                    setAdminSearchQuery(e.target.value);
                    setIsAdminSearchOpen(true);
                  }}
                  placeholder="พิมพ์เลขที่สัญญา (เช่น 18/2567) หรือ ชื่อลูกค้า..."
                  className="w-full pl-10 pr-10 py-2.5 rounded-lg text-base bg-white text-gray-900 font-bold font-sans border-2 border-amber-200 outline-none focus:ring-2 focus:ring-amber-400 shadow-inner"
                />

                {adminSearchQuery && (
                  <button
                    onClick={() => {
                      setAdminSearchQuery('');
                      setIsAdminSearchOpen(true);
                    }}
                    className="absolute right-3 text-gray-400 hover:text-gray-600 flex items-center justify-center p-1"
                    aria-label="ล้างคำค้นหา"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                )}
              </div>

              {/* Autocomplete Dropdown Menu */}
              {isAdminSearchOpen && (
                <>
                  {/* Backdrop to close when clicking outside */}
                  <div 
                    className="fixed inset-0 z-30" 
                    onClick={() => setIsAdminSearchOpen(false)} 
                  />

                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-white text-gray-900 rounded-xl shadow-2xl border-2 border-amber-400 max-h-72 overflow-y-auto z-40 divide-y divide-gray-100 font-sans">
                    <div className="px-md py-1.5 bg-amber-50 text-amber-900 text-[11px] font-bold flex justify-between items-center border-b border-amber-200 sticky top-0 z-10 font-sans">
                      <span>{adminSearchQuery ? `ผลการค้นหา (${filteredAdminResults.length} รายการ)` : `รายการสัญญาทั้งหมด (เลือกเพื่อสลับมุมมอง)`}</span>
                      <button 
                        onClick={() => setIsAdminSearchOpen(false)}
                        className="text-amber-700 hover:text-amber-900 text-xs font-bold font-sans"
                      >
                        ปิด ✕
                      </button>
                    </div>

                    {filteredAdminResults.length === 0 ? (
                      <div className="p-md text-center text-xs text-gray-500 font-sans">
                        ไม่พบเลขที่สัญญาหรือชื่อลูกค้าที่ตรงกับ "{adminSearchQuery}"
                      </div>
                    ) : (
                      filteredAdminResults.map((item, idx) => (
                        <div
                          key={`${item.userId}_${item.contractNo}_${idx}`}
                          onClick={() => {
                            switchToCustomer(item.userId, { name: item.customerName, id: item.userId });
                            setAdminSearchQuery(item.contractNo !== '-' ? `สัญญา: ${item.contractNo} (${item.customerName})` : item.customerName);
                            setIsAdminSearchOpen(false);
                            if (refreshUserData) refreshUserData(item.userId);
                          }}
                          className={`p-md hover:bg-amber-50 cursor-pointer transition-all flex justify-between items-center font-sans ${
                            userId === item.userId ? 'bg-amber-100/70 font-bold border-l-4 border-amber-600' : ''
                          }`}
                        >
                          <div className="flex flex-col gap-0.5 font-sans">
                            <div className="flex items-center gap-2 font-sans">
                              {item.contractNo !== '-' && (
                                <span className="bg-amber-700 text-white font-sans text-xs px-2 py-0.5 rounded font-bold">
                                  {item.contractNo}
                                </span>
                              )}
                              <span className="text-sm font-bold text-gray-900 font-sans">
                                {item.customerName}
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-500 flex items-center gap-2 font-sans">
                              {item.totalLoan && (
                                <span className="font-sans">วงเงิน: <strong>{item.totalLoan.toLocaleString()} ฿</strong></span>
                              )}
                              <span className="font-sans text-[10px] text-gray-400">ID: {item.userId.substring(0, 10)}...</span>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1 font-sans">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-sans ${
                              item.status === 'ผ่อนชำระ'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : item.status === 'ปิดบัญชีแล้ว'
                                ? 'bg-green-100 text-green-700 border border-green-300'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {item.status}
                            </span>
                            {userId === item.userId && (
                              <span className="text-[10px] font-bold text-amber-700 flex items-center gap-0.5 font-sans">
                                <span className="material-symbols-outlined text-[12px]">visibility</span> เลือกอยู่
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Currently Active Impersonation Indicator */}
            {userId !== realUserId && (
              <div className="bg-black/25 p-sm rounded-lg text-xs text-amber-100 flex items-center justify-between border border-amber-300/30 font-sans">
                <span className="flex items-center gap-1.5 font-sans">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  online: <strong className="text-white font-bold">{customerDisplayName || impersonatedCustomer?.name || userId}</strong>
                </span>
                <span className="bg-amber-900/60 px-2 py-0.5 rounded text-[10px] font-sans text-amber-200">
                  ID: {userId.substring(0, 12)}...
                </span>
              </div>
            )}
          </div>
        )}

        {/* Customer Profile & Overview Card (Clean, Spacious, No duplicate avatar) */}
        <div 
          onClick={() => openModal('profile')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openModal('profile');
            }
          }}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs hover:shadow-sm hover:border-primary/40 transition-all cursor-pointer font-sans relative overflow-hidden group"
        >
          <div className="flex items-stretch justify-between gap-3">
            {/* Left: Customer Info */}
            <div className="min-w-0 flex-1 flex flex-col justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400 font-sans">ยินดีต้อนรับ</p>
                {isAuthLoading || (!customerDisplayName && (dataContact === null || dataCustomer === null)) ? (
                  <div className="flex items-center gap-2 py-0.5 my-0.5">
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-primary/20 border-t-primary shrink-0"></div>
                    <span className="text-xs text-slate-400 font-sans font-medium animate-pulse">กำลังโหลดข้อมูล...</span>
                  </div>
                ) : (
                  <h2 className="text-[19px] font-extrabold text-slate-900 leading-tight truncate mt-0.5">
                    {customerDisplayName || 'คุณลูกค้า'}
                  </h2>
                )}
              </div>

              {/* Contract info */}
              <div className="flex items-center text-xs text-slate-500 mt-2.5">
                <span className="flex items-center gap-1 font-medium whitespace-nowrap">
                  <span className="material-symbols-outlined text-[15px] text-primary">description</span>
                  {dataContact === null
                    ? 'กำลังดึงข้อมูลสัญญา...'
                    : activeContacts.length > 0
                    ? `สัญญาผ่อนชำระ ${activeContacts.length} ฉบับ`
                    : 'ยังไม่มีสัญญาเปิดบริการ'}
                </span>
              </div>
            </div>

            {/* Right: Tier Badge (Top-Right) & Action (Bottom-Right) */}
            <div className="shrink-0 flex flex-col items-end justify-between">
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-2xs whitespace-nowrap ${tierInfo.badgeBg}`}>
                <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {tierInfo.materialIcon}
                </span>
                <span>{tierInfo.name}</span>
              </span>

              <div className="flex items-center gap-0.5 text-xs font-semibold text-slate-500 group-hover:text-primary bg-slate-50 group-hover:bg-primary/10 px-2.5 py-1 rounded-xl border border-slate-200/80 transition-all shadow-2xs mt-2">
                <span>ข้อมูล</span>
                <span className="material-symbols-outlined text-[14px] group-hover:translate-x-0.5 transition-transform">chevron_right</span>
              </div>
            </div>
          </div>
        </div>

        {/* Compact Quick Actions Strip */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-2 shadow-2xs grid grid-cols-4 gap-1 w-full">
          <button
            onClick={handleInstallmentClick}
            className="flex flex-col items-center justify-center py-2 px-1 rounded-xl hover:bg-slate-50 active:scale-95 transition-all group cursor-pointer"
            aria-label="ชำระค่างวด"
          >
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-primary flex items-center justify-center mb-1 group-hover:bg-primary group-hover:text-white transition-colors">
              <span className="material-symbols-outlined text-[20px]">payments</span>
            </div>
            <span className="text-[11px] font-medium text-slate-700 font-sans">ชำระค่างวด</span>
          </button>

          <button
            onClick={() => openModal('bank')}
            className="flex flex-col items-center justify-center py-2 px-1 rounded-xl hover:bg-slate-50 active:scale-95 transition-all group cursor-pointer"
            aria-label="เลขที่บัญชี"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-1 group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <span className="material-symbols-outlined text-[20px]">account_balance</span>
            </div>
            <span className="text-[11px] font-medium text-slate-700 font-sans">เลขบัญชี</span>
          </button>

          <button
            onClick={() => openModal('services')}
            className="flex flex-col items-center justify-center py-2 px-1 rounded-xl hover:bg-slate-50 active:scale-95 transition-all group cursor-pointer"
            aria-label="คำนวณสินเชื่อ"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-1 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <span className="material-symbols-outlined text-[20px]">calculate</span>
            </div>
            <span className="text-[11px] font-medium text-slate-700 font-sans">คำนวณเงิน</span>
          </button>

          <button
            onClick={() => openModal('contact')}
            className="flex flex-col items-center justify-center py-2 px-1 rounded-xl hover:bg-slate-50 active:scale-95 transition-all group cursor-pointer"
            aria-label="ติดต่อเจ้าหน้าที่"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <span className="material-symbols-outlined text-[20px]">support_agent</span>
            </div>
            <span className="text-[11px] font-medium text-slate-700 font-sans">ติดต่อเรา</span>
          </button>
        </div>

        {/* Loyalty & Rewards Progression Card (Clean & Motivating) */}
        <div 
          onClick={() => openModal('rewards')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openModal('rewards');
            }
          }}
          className="w-full bg-white rounded-2xl p-4 shadow-xs hover:shadow-md border border-slate-200/90 hover:border-amber-400/60 transition-all flex flex-col gap-3 font-sans relative overflow-hidden group cursor-pointer"
        >
          {/* Subtle warm accent glow on top right */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-amber-100/40 via-yellow-50/20 to-transparent rounded-bl-full pointer-events-none" />

          {/* Top Row: Title & Total Points */}
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 leading-tight">ระบบสะสมคะแนนลูกค้า</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">รับแต้มเพิ่มทุกครั้งที่ชำระตรงเวลา</p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-[11px] font-semibold text-slate-400">คะแนนสะสม</p>
              <p className="text-xl font-black text-amber-600 leading-tight">
                {userPoints.toLocaleString()} <span className="text-xs font-semibold text-slate-600">แต้ม</span>
              </p>
            </div>
          </div>

          {/* Middle: Gamified Progression Bar */}
          <div className="bg-slate-50/90 rounded-xl p-3 border border-slate-200/70 flex flex-col gap-1.5 relative z-10">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-700 flex items-center gap-1">
                <span>{tierInfo.nextTierIcon || '💎'} เป้าหมาย:</span>
                <span className="text-amber-800">{tierInfo.nextTierName || 'ระดับสูงสุด (Platinum)'}</span>
              </span>
              <span className="font-extrabold text-amber-700 font-mono text-[11px]">
                {tierInfo.nextMinPoints
                  ? `${userPoints.toLocaleString()} / ${tierInfo.nextMinPoints.toLocaleString()} แต้ม (${tierInfo.progress}%)`
                  : `${userPoints.toLocaleString()} แต้ม (100%)`}
              </span>
            </div>

            {/* Progression Bar Track */}
            <div className="w-full bg-slate-200/80 h-2.5 rounded-full overflow-hidden p-[1px]">
              <div 
                className="bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 h-full rounded-full transition-all duration-700 ease-out shadow-xs" 
                style={{ width: `${tierInfo.progress}%` }}
              />
            </div>

            <div className="flex justify-between items-center text-[11px] pt-0.5">
              <span className="text-slate-500 font-medium flex items-center gap-1">
                {tierInfo.pointsNeeded > 0 ? (
                  <span>✨ อีก {tierInfo.pointsNeeded.toLocaleString()} แต้ม ปลดล็อก {tierInfo.nextTierName}</span>
                ) : (
                  <span>👑 คุณอยู่ระดับสูงสุดแล้ว ขอบคุณที่ไว้วางใจ</span>
                )}
              </span>
              <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/70">
                +5 ฟรีวันนี้
              </span>
            </div>
          </div>

          {/* Bottom Row: Check-in nudge & CTA Button */}
          <div className="flex items-center justify-between pt-0.5 relative z-10">
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px] text-amber-500">check_circle</span>
              <span>เช็คอินและทำภารกิจสะสมแต้ม</span>
            </span>

            <div className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/90 font-bold px-3 py-1.5 rounded-xl text-xs transition-all shadow-2xs flex items-center gap-0.5 group-hover:border-amber-400">
              <span>สิทธิประโยชน์</span>
              <span className="material-symbols-outlined text-[15px] group-hover:translate-x-0.5 transition-transform">chevron_right</span>
            </div>
          </div>
        </div>

        {/* Card 4: สินเชื่อ — Loading State / Empty State / Contracts */}
        {dataContact === null || dataInterest === null ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-xs flex flex-col items-center justify-center py-10 gap-2">
            <div className="animate-spin rounded-full h-9 w-9 border-3 border-primary/20 border-t-primary mb-2"></div>
            <p className="text-sm font-bold text-slate-800 font-sans">กำลังโหลดข้อมูลสินเชื่อ...</p>
            <p className="text-xs text-slate-500 font-sans">กรุณารอสักครู่ ระบบกำลังดึงข้อมูลจากฐานข้อมูล</p>
          </div>
        ) : activeContacts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col items-center text-center gap-2">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-1 text-slate-400">
              <span className="material-symbols-outlined text-[26px]">receipt_long</span>
            </div>
            <h4 className="text-base font-bold text-slate-800 font-sans">ยังไม่มีสัญญาเงินกู้ที่เปิดบริการ</h4>
            <p className="text-xs text-slate-500 font-sans max-w-xs">
              หากท่านมีสัญญาเงินกู้กับบริษัท ทรัพย์สำราญ พิโก จำกัด สามารถสมัครรับแจ้งเตือนหรือติดต่อเจ้าหน้าที่ได้ทันที
            </p>
          </div>
        ) : (
          activeContacts.map((c, idx) => {
            const contractInstallments = dataInterest ? dataInterest.filter(inst => inst.Id_contact === c.ID_contact) : [];
            const {
              nextInstallment: nextInst,
              nextFee,
              nextPayTotal,
              paidCount,
              totalCount,
              progressPercent
            } = getContractProgression(c, contractInstallments);
            const collateral = getCollateralTypeInfo(c.Claimthing);

            return (
              <div 
                key={c.ID_contact}
                role="button"
                tabIndex={0}
                onClick={() => handleNavigateDetail(c.ID_contact)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleNavigateDetail(c.ID_contact);
                  }
                }}
                aria-label={`ดูรายละเอียดสัญญาที่ ${idx + 1} เลขที่ ${c.ID_contact}`}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-primary/40 transition-all cursor-pointer flex flex-col overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 group"
              >
                <div className="p-4 flex flex-col gap-3">
                  {/* Top Bar: Contract Number, Collateral Type & Status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs ${collateral.iconContainerClass}`}>
                        <span className="material-symbols-outlined text-[20px]">{collateral.icon}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-sm font-bold text-slate-900 font-sans">สัญญาที่ {idx + 1}</h4>
                          <span className="text-[11px] font-mono text-slate-500 font-semibold">({c.ID_contact})</span>
                        </div>
                      </div>
                    </div>

                    {nextInst ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" /> รอชำระ
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> ชำระครบแล้ว
                      </span>
                    )}
                  </div>

                  {/* Borrower Chip & Guarantor Info */}
                  <div className="bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-1.5 flex items-center justify-between gap-2 text-xs text-slate-700 font-medium">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">person</span>
                      <span className="truncate">ผู้กู้: <strong className="text-slate-900">{c.Name_loan || c.name || 'ไม่ระบุชื่อ'}</strong></span>
                    </div>
                    {c.Claimthing === 'บุคคล' && c.name_claim ? (
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 shrink-0 truncate">
                        <span>ผู้ค้ำ:</span>
                        <strong className="text-slate-800 truncate max-w-[120px]">{c.name_claim}</strong>
                      </div>
                    ) : null}
                  </div>

                  {/* Hero Amount & Due Date Box */}
                  <div className="bg-gradient-to-br from-rose-50/40 via-white to-amber-50/20 rounded-xl border border-rose-100/80 p-3.5 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500 font-sans">ยอดที่ต้องชำระงวดนี้</p>
                      {nextInst ? (
                        <div>
                          <p className="text-2xl font-black text-primary leading-tight mt-0.5">
                            {nextPayTotal.toLocaleString()}
                            <span className="text-xs font-semibold text-slate-600 ml-1">บาท</span>
                          </p>
                          {nextFee > 0 && (
                            <p className="text-[10px] font-bold text-rose-600 mt-0.5">
                              (รวมค่าปรับ {nextFee.toLocaleString()} บ.)
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-base font-bold text-emerald-600 mt-1">ชำระครบถ้วนแล้ว</p>
                      )}
                    </div>

                    <div className="text-right">
                      <p className="text-[11px] font-semibold text-slate-500 font-sans">กำหนดชำระ</p>
                      {nextInst ? (
                        <div className="flex items-center gap-1 mt-0.5 justify-end">
                          <span className="material-symbols-outlined text-[16px] text-amber-600">event</span>
                          <span className="text-xs font-bold text-slate-800 font-sans">
                            {formatThaiDate(nextInst.begin_date)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-emerald-700 mt-1 block">ปิดยอดสัญญาแล้ว</span>
                      )}
                    </div>
                  </div>

                  {/* Progression Section */}
                  <div className="flex flex-col gap-1.5 pt-1">
                    <div className="flex justify-between items-center text-[11px] font-sans">
                      <span className="text-slate-500 font-medium">ความคืบหน้าการชำระ</span>
                      <span className="font-bold text-slate-700">
                        {totalCount > 0
                          ? `ชำระแล้ว ${paidCount} / ${totalCount} งวด (${progressPercent}%)`
                          : `ชำระแล้ว ${paidCount} งวด`}
                      </span>
                    </div>
                    {totalCount > 0 && (
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-primary to-rose-400 h-full rounded-full transition-all duration-500 ease-out" 
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <div className="pt-1">
                    {navigatingContractId === c.ID_contact ? (
                      <div className="w-full bg-primary/80 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 font-sans shadow-xs">
                        <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>กำลังเปิดรายละเอียด...</span>
                      </div>
                    ) : (
                      <div className="w-full bg-primary hover:bg-[#ba2660] text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1 font-sans shadow-xs group-hover:shadow-sm active:scale-[0.98] transition-all">
                        <span>ดูรายละเอียดและชำระค่างวด</span>
                        <span className="material-symbols-outlined text-[16px] group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Card 4: สมัครรับการแจ้งเตือนทางไลน์ / ปุ่มเพิ่มสินเชื่อ */}
        {userContacts.length > 0 ? (
          /* กรณีมียอดสัญญาที่ผูกกับ LINE แล้ว -> แสดงปุ่มเพิ่มสินเชื่อเพื่อสมัครแจ้งเตือน */
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs hover:shadow-sm transition-all">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[22px]">notifications_active</span>
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-slate-800 font-sans leading-tight">สมัครรับแจ้งเตือนเพิ่ม</h4>
                <p className="text-xs text-slate-500 font-sans mt-0.5 truncate">ต้องการผูกสัญญาฉบับใหม่เพื่อรับแจ้งเตือนบิลทาง LINE หรือไม่?</p>
              </div>
            </div>
            <button 
              onClick={() => openModal('registerNotify')}
              className="bg-primary hover:bg-[#ba2660] text-white font-bold text-xs px-3.5 py-2.5 rounded-xl active:scale-95 transition-all shrink-0 flex items-center gap-1 font-sans shadow-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">add</span> เพิ่มสัญญา
            </button>
          </div>
        ) : (
          /* กรณียังไม่มีสัญญาผูกกับ LINE -> แสดงการ์ดสมัครรับแจ้งเตือนทางไลน์แบบเต็ม */
          <div className="bg-gradient-to-br from-primary via-[#d83a78] to-[#ba2660] text-white rounded-2xl p-5 shadow-sm border border-amber-200/30 relative overflow-hidden flex flex-col gap-4 transition-all">
            {/* Subtle geometric circles */}
            <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
            <div className="absolute -left-6 -top-6 w-24 h-24 rounded-full bg-white/10 pointer-events-none" />

            <div className="flex items-start gap-3 relative z-10">
              <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/20">
                <span className="material-symbols-outlined text-amber-200 text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>notifications_active</span>
              </div>
              <div className="flex-grow">
                <h3 className="text-base font-bold text-white font-sans leading-snug">สมัครรับแจ้งเตือนค่างวดทาง LINE</h3>
                <p className="text-xs text-white/80 font-sans mt-1 leading-relaxed">
                  รับบิลแจ้งเตือนค่างวดล่วงหน้า และรับใบเสร็จอิเล็กทรอนิกส์ในห้องแชททันที สะดวก ปลอดภัย
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-1.5 border-t border-white/15 pt-3 text-xs text-white/90 relative z-10">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-amber-300 text-[16px]">check_circle</span>
                <span><b>แจ้งเตือนอัตโนมัติ:</b> ล่วงหน้า 3 วัน ป้องกันค่าปรับ</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-amber-300 text-[16px]">check_circle</span>
                <span><b>รับใบเสร็จทันที:</b> ส่งใบเสร็จอิเล็กทรอนิกส์เข้าห้องแชท</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-amber-300 text-[16px]">check_circle</span>
                <span><b>เชื่อมต่อง่ายดาย:</b> เพียงระบุชื่อผู้กู้และเลขที่สัญญา</span>
              </div>
            </div>

            <div className="flex justify-center border-t border-white/15 pt-3 relative z-10">
              <button 
                onClick={() => openModal('registerNotify')}
                className="bg-white text-primary hover:bg-rose-50 text-xs font-bold px-6 py-2.5 rounded-xl active:scale-95 transition-all shadow-xs flex items-center justify-center gap-1 font-sans w-full cursor-pointer"
              >
                <span>สมัครรับแจ้งเตือนทันที</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Synchronized Bottom Navigation Bar */}
      <nav role="tablist" className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[600px] z-50 flex justify-around items-center px-2 py-1.5 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] rounded-t-2xl">
        <button 
          onClick={() => handleTabClick('home')}
          role="tab"
          aria-selected={activeTab === 'home' && activeModal === null}
          aria-label="หน้าหลัก"
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer border-0 bg-transparent focus-visible:outline-none ${
            activeTab === 'home' && activeModal === null
              ? 'text-primary font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className={`p-1 rounded-xl transition-all ${activeTab === 'home' && activeModal === null ? 'bg-rose-50 text-primary scale-110' : ''}`}>
            <span className="material-symbols-outlined text-[24px]">home</span>
          </div>
          <span className="text-[11px] font-sans mt-0.5">หน้าหลัก</span>
        </button>

        <button 
          onClick={() => handleTabClick('installments')}
          role="tab"
          aria-selected={activeModal === 'contractSelect' || activeTab === 'installments'}
          aria-label="ค่างวด"
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer border-0 bg-transparent focus-visible:outline-none ${
            activeModal === 'contractSelect' || activeTab === 'installments'
              ? 'text-primary font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className={`p-1 rounded-xl transition-all ${activeModal === 'contractSelect' || activeTab === 'installments' ? 'bg-rose-50 text-primary scale-110' : ''}`}>
            <span className="material-symbols-outlined text-[24px]">calendar_month</span>
          </div>
          <span className="text-[11px] font-sans mt-0.5">ค่างวด</span>
        </button>

        <button 
          onClick={() => handleTabClick('bank')}
          role="tab"
          aria-selected={activeModal === 'bank'}
          aria-label="บัญชี"
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer border-0 bg-transparent focus-visible:outline-none ${
            activeModal === 'bank'
              ? 'text-primary font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className={`p-1 rounded-xl transition-all ${activeModal === 'bank' ? 'bg-rose-50 text-primary scale-110' : ''}`}>
            <span className="material-symbols-outlined text-[24px]">account_balance</span>
          </div>
          <span className="text-[11px] font-sans mt-0.5">บัญชี</span>
        </button>

        <button 
          onClick={() => handleTabClick('contact')}
          role="tab"
          aria-selected={activeModal === 'contact'}
          aria-label="ติดต่อ"
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer border-0 bg-transparent focus-visible:outline-none ${
            activeModal === 'contact'
              ? 'text-primary font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className={`p-1 rounded-xl transition-all ${activeModal === 'contact' ? 'bg-rose-50 text-primary scale-110' : ''}`}>
            <span className="material-symbols-outlined text-[24px]">support_agent</span>
          </div>
          <span className="text-[11px] font-sans mt-0.5">ติดต่อ</span>
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
                            className="w-full px-md py-2.5 rounded-lg border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-base transition-all"
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
                            className="w-full px-md py-2.5 rounded-lg border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-base transition-all"
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
                          {(customerDisplayName || displayName)?.charAt(0) || 'U'}
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="text-body-lg font-bold text-primary">{customerDisplayName || displayName || 'ไม่ระบุชื่อ'}</h4>
                    </div>
                  </div>

                  <h3 className="text-label-lg font-bold text-primary border-b border-outline-variant/20 pb-xs">รายการสัญญาเงินกู้ของคุณ</h3>
                  
                  {userContacts.length === 0 ? (
                    <p className="text-center text-on-surface-variant py-md">ยังไม่มีสัญญาเงินกู้จดทะเบียนในระบบ</p>
                  ) : (
                    <div className="flex flex-col gap-sm">
                      {userContacts.map((c, i) => {
                        const collateral = getCollateralTypeInfo(c.Claimthing);
                        return (
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
                            <div className="flex justify-between items-center gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${collateral.iconContainerClass}`}>
                                  <span className="material-symbols-outlined text-[18px]">{collateral.icon}</span>
                                </div>
                                <div className="min-w-0">
                                  <span className="text-body-md font-bold text-primary">เลขที่สัญญา: {c.ID_contact}</span>
                                </div>
                              </div>
                              {c.total_treerest <= 0 ? (
                                <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">ปิดบัญชีแล้ว</span>
                              ) : (
                                <span className="bg-secondary-container text-on-secondary-container text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">กำลังผ่อนชำระ</span>
                              )}
                            </div>
                          <div className="text-xs text-amber-950 font-bold bg-amber-50 px-2.5 py-1 rounded border border-amber-200/70 flex items-center gap-1 font-sans">
                            <span className="material-symbols-outlined text-[16px] text-amber-700">person</span>
                            <span>ผู้กู้: {c.Name_loan || c.name || 'ไม่ระบุชื่อ'}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-xs text-[12px] text-on-surface-variant">
                            <p>ยอดวงเงินกู้: <span className="font-bold">{c.total_loan?.toLocaleString()} ฿</span></p>
                            <p>ค่างวด: <span className="font-bold">{c.paypermonth?.toLocaleString()} ฿/{c.month_loan}ด.</span></p>
                            <p className="col-span-2">เงินต้นคงเหลือ: <span className="font-bold text-error">{c.total_treerest?.toLocaleString()} ฿</span></p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                </div>
              )}

              {/* MODAL 2: CONTACT INFO */}
              {activeModal === 'contact' && (
                <div className="flex flex-col gap-md">
                  <div className="bg-primary/5 rounded-lg border border-primary/10 overflow-hidden shadow-sm">
                    <img src={logo.src || logo} alt="Company Logo" className="w-28 mx-auto my-md drop-shadow" />
                    <p className="text-center text-label-sm font-bold text-primary">บริษัท ทรัพย์สำราญ พิโก จำกัด</p>
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
                      const collateral = getCollateralTypeInfo(c.Claimthing);
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
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${collateral.iconContainerClass}`}>
                              <span className="material-symbols-outlined text-[20px]">{collateral.icon}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-body-md font-bold text-primary">เลขที่สัญญา: {c.ID_contact}</p>
                              <p className="text-xs text-amber-950 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200/80 inline-flex items-center gap-1 mt-0.5">
                                <span className="material-symbols-outlined text-[14px] text-amber-700 shrink-0">person</span>
                                <span className="truncate">ผู้กู้: {c.Name_loan || c.name || 'ไม่ระบุชื่อ'}</span>
                              </p>
                              <p className="text-label-sm text-on-surface-variant mt-xs">
                                ยอดวงเงินกู้: <span className="font-bold">{c.total_loan?.toLocaleString()} ฿</span> | ค่างวด: <span className="font-bold text-primary">{c.paypermonth?.toLocaleString()} ฿</span>
                              </p>
                            </div>
                          </div>
                          <span className="material-symbols-outlined text-secondary text-[24px] group-hover:translate-x-1 transition-transform shrink-0">
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

      {/* Rewards & Loyalty Portal Modal */}
      <RewardsPortal 
        isOpen={activeModal === 'rewards'} 
        onClose={closeModal} 
        currentPoints={userPoints}
        onPointsChange={(newPts) => setUserPoints(newPts)}
      />
    </div>
  );
}

export default Home;
