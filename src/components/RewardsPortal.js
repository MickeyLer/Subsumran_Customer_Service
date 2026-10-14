"use client";

import React, { useState, useEffect, useContext } from 'react';
import Swal from 'sweetalert2';
import {
  Award, Gift, Sparkles, CheckCircle2, ShieldCheck, ChevronRight, Clock, Star,
  TrendingUp, RefreshCw, Zap, Flame, Trophy, Lock, CreditCard, Copy, X
} from 'lucide-react';
import { AuthContext } from '../linelogin';
import { DataContext } from '../DataContext';
import supabase from '../supabaseClient';
import { calculateTierInfo, TIER_LEVELS } from '../utils/tierConfig';

/**
 * RewardsPortal — System UI for Loyalty & Points System (ระบบสะสมคะแนน)
 * Designed with UI/UX Pro Max standards for LINE LIFF customer service.
 */
const REWARD_ITEMS_MOCK = [
  {
    id: 'rew_1',
    title: 'คูปองยกเว้นค่าทวงถาม (100 บาท)',
    category: 'discount',
    points_required: 200,
    stock: 45,
    description: 'ใช้สำหรับเป็นส่วนลดหรือยกเว้นค่าทวงถามสำหรับค่างวด 1 งวด',
    image: '🎫',
    badge: 'ยอดนิยม'
  },
  {
    id: 'rew_2',
    title: 'ส่วนลดดอกเบี้ย 0.5% งวดถัดไป',
    category: 'privilege',
    points_required: 500,
    stock: 20,
    description: 'รับส่วนลดดอกเบี้ยค่างวดทันที 0.5% ในการชำระงวดถัดไป',
    image: '🪙',
    badge: 'คุ้มค่าที่สุด'
  },
  {
    id: 'rew_3',
    title: 'บัตรของขวัญ Lotus / Big C มูลค่า 200 บาท',
    category: 'voucher',
    points_required: 600,
    stock: 12,
    description: 'E-Voucher สแกนชำระสินค้าที่ Lotus หรือ Big C ได้ทุกสาขา',
    image: '🎁',
    badge: 'จำกัดจำนวน'
  },
  {
    id: 'rew_4',
    title: 'บัตรเติมเงินมือถือ 100 บาท (ทุกระบบ)',
    category: 'topup',
    points_required: 300,
    stock: 50,
    description: 'เติมเงินเข้าเบอร์มือถือ AIS, True, Dtac ทันที 100 บาท',
    image: '📱',
    badge: 'แลกง่าย'
  },
  {
    id: 'rew_5',
    title: 'สิทธิ์ขยายเวลาชำระเงิน (Grace Period 3 วัน)',
    category: 'privilege',
    points_required: 800,
    stock: 15,
    description: 'ขยายเวลากำหนดชำระค่างวดออกไป 3 วันโดยไม่มีค่าปรับล่าช้า',
    image: '⏱️',
    badge: 'สิทธิพิเศษ Gold'
  }
];

const getTodayThaiDate = () => {
  const now = new Date();
  const thaiTime = new Date(now.getTime() + (7 * 60 + now.getTimezoneOffset()) * 60000);
  return thaiTime.toISOString().slice(0, 10); // 'YYYY-MM-DD'
};

const DEFAULT_TASKS = [
  { id: 'task_daily', title: 'เช็คอินประจำวัน', points: 5, icon: '⚡', completed: false, cta: 'เช็คอินวันนี้' },
  { id: 'task_payment', title: 'ชำระค่างวดตรงเวลา', points: 50, icon: '💳', completed: false, cta: 'ไปชำระค่างวด' },
  { id: 'task_slip', title: 'แนบสลิปผ่าน AI OCR', points: 20, icon: '🤖', completed: false, cta: 'แนบสลิป' },
  { id: 'task_profile', title: 'อัปเดตข้อมูลส่วนตัวครบถ้วน', points: 100, icon: '👤', completed: false, cta: 'อัปเดตข้อมูล' }
];

export default function RewardsPortal({ isOpen, onClose, currentPoints = 0, onPointsChange }) {
  const authContext = useContext(AuthContext) || {};
  const { userId, displayName, pictureUrl } = authContext;
  const { dataCustomer } = useContext(DataContext) || {};

  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'tasks' | 'history' | 'tiers'
  const [points, setPoints] = useState(currentPoints);
  const [tier, setTier] = useState(() => calculateTierInfo(currentPoints));
  const [dailyCheckedIn, setDailyCheckedIn] = useState(false);
  const [tasks, setTasks] = useState(DEFAULT_TASKS);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [rewardItems, setRewardItems] = useState(REWARD_ITEMS_MOCK);
  const [loadingRewards, setLoadingRewards] = useState(true);

  // History state: empty by default, loaded from Supabase points_transactions
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const updateTierInfo = (currentPts) => {
    setTier(calculateTierInfo(currentPts));
    if (onPointsChange) {
      onPointsChange(currentPts);
    }
  };

  // Sync when prop changes
  useEffect(() => {
    if (currentPoints !== undefined && currentPoints !== points) {
      setPoints(currentPoints);
      setTier(calculateTierInfo(currentPoints));
    }
  }, [currentPoints]);

  // Load reward items from Supabase reward_items table
  const fetchRewardItems = async () => {
    try {
      setLoadingRewards(true);
      const { data, error } = await supabase
        .from('reward_items')
        .select('*')
        .eq('is_active', true)
        .order('points_required', { ascending: true });

      if (error) {
        console.warn('Error fetching reward_items from Supabase:', error);
        return;
      }

      if (data && data.length > 0) {
        setRewardItems(data);
      }
    } catch (err) {
      console.warn('Fallback to mock reward items:', err);
    } finally {
      setLoadingRewards(false);
    }
  };

  useEffect(() => {
    fetchRewardItems();
  }, []);

  // Load points, transaction history, and dynamic task status from Supabase
  const fetchUserData = async () => {
    if (!userId) {
      setLoadingHistory(false);
      setLoadingTasks(false);
      return;
    }

    try {
      setLoadingHistory(true);
      setLoadingTasks(true);

      // 1. Fetch total points & tier from line_users
      const { data: userData, error: userError } = await supabase
        .from('line_users')
        .select('total_points, tier_level')
        .eq('line_user_id', userId)
        .maybeSingle();

      if (userData && userData.total_points !== undefined && userData.total_points !== null) {
        const userPts = Number(userData.total_points);
        setPoints(userPts);
        updateTierInfo(userPts);
      }

      // 2. Fetch transaction history from points_transactions
      const { data: txData, error: txError } = await supabase
        .from('points_transactions')
        .select('*')
        .eq('line_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);

      if (txError) {
        console.warn('Error loading points_transactions:', txError);
        setHistory([]);
      } else if (txData && txData.length > 0) {
        const formattedTx = txData.map(tx => ({
          id: tx.id,
          title: tx.description || (tx.points > 0 ? 'ได้รับคะแนน' : 'แลกของรางวัล'),
          points: tx.points,
          type: tx.type || (tx.points > 0 ? 'EARN' : 'REDEEM'),
          date: new Date(tx.created_at).toLocaleString('th-TH', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        }));
        setHistory(formattedTx);
      } else {
        // No transactions found in database: show empty list (no fake mock!)
        setHistory([]);
      }

      // 3. Compute dynamic task completion from actual database records
      const todayStr = getTodayThaiDate();
      const hasCheckedInToday = Boolean(
        txData && txData.some(tx => 
          (tx.reference_id && tx.reference_id.includes(todayStr)) ||
          (tx.description && tx.description.includes('เช็คอิน') && tx.created_at && tx.created_at.slice(0, 10) === todayStr)
        )
      );
      setDailyCheckedIn(hasCheckedInToday);

      // Check payment status from points_transactions or customer records
      const hasPayment = Boolean(
        (txData && txData.some(tx => tx.description && (tx.description.includes('ชำระ') || tx.description.includes('งวด')))) ||
        (dataCustomer && (dataCustomer.last_datepay || dataCustomer.total_treerest !== undefined))
      );

      // Check OCR slip status
      const hasSlip = Boolean(
        (txData && txData.some(tx => tx.description && (tx.description.includes('สลิป') || tx.description.includes('OCR')))) ||
        hasPayment
      );

      // Check profile completion
      const isProfileComplete = Boolean(
        dataCustomer && (dataCustomer.Name_loan || dataCustomer.Name || dataCustomer.name) &&
        (dataCustomer.citizenid || dataCustomer.ID_card || dataCustomer.Tel || dataCustomer.tel)
      );

      setTasks([
        { 
          id: 'task_daily', 
          title: 'เช็คอินประจำวัน', 
          points: 5, 
          icon: '⚡', 
          completed: hasCheckedInToday, 
          cta: hasCheckedInToday ? '✓ เช็คอินแล้ว' : 'เช็คอินวันนี้' 
        },
        { 
          id: 'task_payment', 
          title: 'ชำระค่างวดตรงเวลา', 
          points: 50, 
          icon: '💳', 
          completed: hasPayment, 
          cta: hasPayment ? '✓ สำเร็จแล้ว' : 'ไปชำระค่างวด' 
        },
        { 
          id: 'task_slip', 
          title: 'แนบสลิปผ่าน AI OCR', 
          points: 20, 
          icon: '🤖', 
          completed: hasSlip, 
          cta: hasSlip ? '✓ สำเร็จแล้ว' : 'แนบสลิป' 
        },
        { 
          id: 'task_profile', 
          title: 'อัปเดตข้อมูลส่วนตัวครบถ้วน', 
          points: 100, 
          icon: '👤', 
          completed: isProfileComplete, 
          cta: isProfileComplete ? '✓ สำเร็จแล้ว' : 'อัปเดตข้อมูล' 
        }
      ]);
    } catch (err) {
      console.warn('Error loading user points or history from Supabase:', err);
    } finally {
      setLoadingHistory(false);
      setLoadingTasks(false);
    }
  };

  // Re-fetch when modal opens or userId changes
  useEffect(() => {
    if (userId) {
      fetchUserData();
    }
  }, [userId, isOpen]);

  const handleDailyCheckIn = async () => {
    if (dailyCheckedIn) {
      Swal.fire({
        icon: 'info',
        title: 'เช็คอินแล้ววันนี้!',
        text: 'คุณได้รับคะแนนเช็คอินประจำวันเรียบร้อยแล้ว กลับมาเช็คอินใหม่พรุ่งนี้นะครับ',
        confirmButtonColor: '#0284c7'
      });
      return;
    }

    if (!userId) {
      Swal.fire({
        icon: 'warning',
        title: 'ไม่พบข้อมูลผู้ใช้',
        text: 'กรุณาเข้าสู่ระบบ LINE เพื่อสะสมคะแนน',
        confirmButtonColor: '#0284c7'
      });
      return;
    }

    const earned = 5;
    const todayStr = getTodayThaiDate();
    const refId = `checkin_${todayStr}`;

    try {
      // 1. Double check Supabase to avoid double insertion for the same day
      const { data: existingCheckin } = await supabase
        .from('points_transactions')
        .select('id')
        .eq('line_user_id', userId)
        .eq('reference_id', refId)
        .maybeSingle();

      if (existingCheckin) {
        setDailyCheckedIn(true);
        setTasks(prev => prev.map(t => t.id === 'task_daily' ? { ...t, completed: true, cta: '✓ เช็คอินแล้ว' } : t));
        Swal.fire({
          icon: 'info',
          title: 'เช็คอินแล้ววันนี้!',
          text: 'คุณได้รับคะแนนเช็คอินประจำวันเรียบร้อยแล้ว กลับมาเช็คอินใหม่พรุ่งนี้นะครับ',
          confirmButtonColor: '#0284c7'
        });
        return;
      }

      // 2. Fetch current points from line_users to prevent desync
      const { data: userRow } = await supabase
        .from('line_users')
        .select('total_points')
        .eq('line_user_id', userId)
        .maybeSingle();

      const currentPts = userRow ? Number(userRow.total_points || 0) : points;
      const newTotal = currentPts + earned;

      // 3. Update line_users
      await supabase
        .from('line_users')
        .update({
          total_points: newTotal,
          last_active_at: new Date().toISOString()
        })
        .eq('line_user_id', userId);

      // 4. Insert into points_transactions
      const { data: insertedTx, error: txInsertErr } = await supabase
        .from('points_transactions')
        .insert({
          line_user_id: userId,
          points: earned,
          type: 'EARN',
          description: 'เช็คอินประจำวัน',
          reference_id: refId
        })
        .select()
        .single();

      if (txInsertErr) {
        console.error('Error inserting check-in transaction:', txInsertErr);
      }

      // 5. Update local states
      setPoints(newTotal);
      updateTierInfo(newTotal);
      setDailyCheckedIn(true);
      setTasks(prev => prev.map(t => t.id === 'task_daily' ? { ...t, completed: true, cta: '✓ เช็คอินแล้ว' } : t));

      setHistory(prev => [
        {
          id: insertedTx?.id || `tx_${Date.now()}`,
          title: 'เช็คอินประจำวัน',
          points: +earned,
          type: 'EARN',
          date: 'วันนี้ (เมื่อครู่)'
        },
        ...prev
      ]);

      Swal.fire({
        icon: 'success',
        title: '🎉 เช็คอินสำเร็จ! +5 คะแนน',
        text: `คุณได้รับ 5 คะแนนสะสม ยอดรวมปัจจุบัน: ${newTotal} คะแนน`,
        confirmButtonColor: '#0284c7'
      });
    } catch (err) {
      console.error('Error during daily check-in:', err);
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: 'ไม่สามารถบันทึกการเช็คอินได้ กรุณาลองใหม่อีกครั้ง',
        confirmButtonColor: '#0284c7'
      });
    }
  };

  const handleTaskAction = (task) => {
    if (task.completed) return;
    if (task.id === 'task_daily') {
      handleDailyCheckIn();
    } else if (task.id === 'task_payment' || task.id === 'task_slip') {
      onClose();
    } else if (task.id === 'task_profile') {
      onClose();
    }
  };

  const renderRewardIcon = (img) => {
    if (!img) return <div className="text-4xl mb-2">🎁</div>;
    if (typeof img === 'string' && (img.startsWith('http') || img.startsWith('/') || img.startsWith('data:'))) {
      return (
        <div className="w-14 h-14 mb-2 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
          <img src={img} alt="reward" className="w-full h-full object-cover" />
        </div>
      );
    }
    return <div className="text-4xl mb-2">{img}</div>;
  };

  const handleRedeemItem = (item) => {
    const isOutOfStock = typeof item.stock === 'number' && item.stock <= 0;
    if (isOutOfStock) {
      Swal.fire({
        icon: 'warning',
        title: 'ของรางวัลหมดชั่วคราว',
        text: `ขออภัยครับ "${item.title}" สิทธิ์หมดแล้ว โปรดเลือกของรางวัลรายการอื่น`,
        confirmButtonColor: '#0284c7'
      });
      return;
    }

    if (points < item.points_required) {
      Swal.fire({
        icon: 'warning',
        title: 'คะแนนไม่เพียงพอ',
        text: `คุณต้องการอีก ${item.points_required - points} คะแนน สำหรับแลก "${item.title}"`,
        confirmButtonColor: '#0284c7'
      });
      return;
    }

    const displayIcon = item.image_url || item.image || '🎁';
    const iconHtml = (typeof displayIcon === 'string' && (displayIcon.startsWith('http') || displayIcon.startsWith('/')))
      ? `<img src="${displayIcon}" class="w-16 h-16 mx-auto object-cover rounded-xl my-2" />`
      : `<div class="text-4xl my-2">${displayIcon}</div>`;

    Swal.fire({
      title: 'ยืนยันการแลกของรางวัล',
      html: `
        <div class="text-center font-sans space-y-2">
          ${iconHtml}
          <p class="font-bold text-slate-800 text-lg">${item.title}</p>
          <p class="text-sm text-slate-500">${item.description || ''}</p>
          <div class="p-3 bg-amber-50 rounded-xl text-amber-900 text-sm font-bold border border-amber-200 mt-2">
            ใช้คะแนนสะสม: ${item.points_required} คะแนน
          </div>
          ${item.stock !== undefined && item.stock !== null ? `<p class="text-xs text-slate-400 mt-1">คงเหลือ ${item.stock} สิทธิ์</p>` : ''}
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'ยืนยันการแลก',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#0284c7',
      cancelButtonColor: '#64748b'
    }).then(async (result) => {
      if (result.isConfirmed) {
        const newTotal = points - item.points_required;
        setPoints(newTotal);
        updateTierInfo(newTotal);

        // Optimistic UI updates
        setRewardItems(prev => prev.map(ri => ri.id === item.id ? { ...ri, stock: Math.max(0, (ri.stock || 0) - 1) } : ri));

        setHistory(prev => [
          { id: `tx_${Date.now()}`, title: `แลก ${item.title}`, points: -item.points_required, type: 'REDEEM', date: 'วันนี้ (เมื่อครู่)' },
          ...prev
        ]);

        // Sync with Supabase
        try {
          if (userId) {
            await supabase
              .from('line_users')
              .update({ total_points: newTotal })
              .eq('line_user_id', userId);

            await supabase
              .from('points_transactions')
              .insert({
                line_user_id: userId,
                points: -item.points_required,
                type: 'REDEEM',
                description: `แลก ${item.title}`,
                reference_id: String(item.id)
              });
          }

          if (item.id && typeof item.stock === 'number') {
            await supabase
              .from('reward_items')
              .update({ stock: Math.max(0, item.stock - 1) })
              .eq('id', item.id);
          }
        } catch (err) {
          console.error('Error saving redemption to Supabase:', err);
        }

        Swal.fire({
          icon: 'success',
          title: '🎁 แลกของรางวัลสำเร็จ!',
          html: `ระบบบันทึกการแลก <strong>"${item.title}"</strong> เรียบร้อยแล้ว สิทธิ์ของคุณจะแสดงในประวัติและแจ้งเตือนผ่าน LINE`,
          confirmButtonColor: '#0284c7'
        });
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex flex-col w-full h-full overflow-y-auto animate-fade-in font-sans">
      <div className="min-h-full w-full flex flex-col bg-slate-50 sm:max-w-2xl sm:mx-auto sm:my-6 sm:rounded-2xl sm:shadow-2xl overflow-hidden">

        {/* --- Top Header & User Card --- */}
        <div className="bg-gradient-to-r from-blue-900 via-primary to-indigo-950 text-white p-5 sticky top-0 z-20 shadow-md">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-white/10 rounded-xl">
                <Trophy className="w-5 h-5 text-amber-300 animate-bounce" />
              </span>
              <div>
                <h2 className="text-lg font-black text-white font-sans leading-tight">
                  ระบบสะสมคะแนน & สิทธิประโยชน์
                </h2>
                <p className="text-xs text-white/70">ทรัพย์สำราญ Pico Rewards</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition p-2 bg-white/10 hover:bg-white/20 rounded-full"
              aria-label="ปิด"
            >
              <X size={22} />
            </button>
          </div>

          {/* User Points & Tier Banner */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 text-white shadow-inner flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <img
                src={pictureUrl || 'https://via.placeholder.com/60'}
                alt={displayName || 'Customer'}
                className="w-14 h-14 rounded-full border-2 border-amber-300 shadow-md object-cover"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-bold text-white leading-tight">{displayName || 'คุณลูกค้า'}</span>
                  <span className="bg-amber-400/20 text-amber-300 border border-amber-300/40 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    {tier.icon} {tier.name}
                  </span>
                </div>
                <p className="text-xs text-white/70 mt-0.5">สมาชิกทรัพย์สำราญคลับ</p>
              </div>
            </div>

            {/* Total Points Display */}
            <div className="bg-white/15 border border-white/30 rounded-xl px-5 py-2.5 text-center w-full sm:w-auto shrink-0">
              <span className="text-xs text-amber-200 uppercase tracking-wider font-semibold">คะแนนสะสมของคุณ</span>
              <p className="text-3xl font-black text-amber-300 leading-none mt-1">
                {points.toLocaleString()} <span className="text-sm font-normal text-white">คะแนน</span>
              </p>
            </div>
          </div>

          {/* Tier Progress */}
          <div className="mt-3 bg-white/10 rounded-xl p-2.5 border border-white/15 text-xs">
            <div className="flex justify-between items-center text-white/90 mb-1">
              <span>ระดับปัจจุบัน: <strong>{tier.icon} {tier.name}</strong></span>
              <span>ถัดไป: <strong>{tier.nextMinPoints} คะแนน</strong></span>
            </div>
            <div className="w-full bg-black/20 rounded-full h-2 overflow-hidden">
              <div className="bg-gradient-to-r from-amber-400 to-yellow-300 h-full transition-all duration-500 rounded-full" style={{ width: `${tier.progress}%` }} />
            </div>
          </div>
        </div>

        {/* --- Navigation Tabs --- */}
        <div className="bg-white border-b border-slate-200 sticky top-[148px] z-10 grid grid-cols-4 text-xs font-bold text-center">
          {[
            { id: 'catalog', label: '🎁 แลกรางวัล', icon: Gift },
            { id: 'tasks', label: '⚡ รับคะแนน', icon: Zap },
            { id: 'history', label: '📜 ประวัติคะแนน', icon: Clock },
            { id: 'tiers', label: '👑 สิทธิพิเศษ', icon: Award }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3.5 px-2 flex flex-col items-center gap-1 transition-all border-b-2 ${
                  isActive
                    ? 'border-primary text-primary bg-primary/5 font-black'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* --- Tab Contents --- */}
        <div className="p-4 sm:p-6 flex-grow overflow-y-auto space-y-4">

          {/* 1. CATALOG TAB */}
          {activeTab === 'catalog' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Gift className="w-4 h-4 text-primary" /> คลังของรางวัลทั้งหมด
                  </h3>
                  <button
                    onClick={fetchRewardItems}
                    disabled={loadingRewards}
                    className="p-1 text-slate-400 hover:text-primary transition rounded-lg hover:bg-slate-100"
                    title="รีเฟรชรายการของรางวัล"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingRewards ? 'animate-spin text-primary' : ''}`} />
                  </button>
                </div>
                <span className="text-xs text-slate-500">คะแนนคงเหลือ: <strong className="text-primary">{points}</strong></span>
              </div>

              {loadingRewards ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-xs">กำลังโหลดของรางวัลจากระบบ...</span>
                </div>
              ) : rewardItems.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">
                  ยังไม่มีของรางวัลเปิดให้แลกในขณะนี้
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {rewardItems.map(item => {
                    const isOutOfStock = typeof item.stock === 'number' && item.stock <= 0;
                    const canAfford = points >= item.points_required;
                    const canRedeem = canAfford && !isOutOfStock;

                    return (
                      <div
                        key={item.id}
                        className={`bg-white rounded-2xl p-4 border shadow-sm flex flex-col justify-between hover:shadow-md transition-all relative overflow-hidden group ${
                          isOutOfStock ? 'border-slate-200 opacity-60' : 'border-slate-200'
                        }`}
                      >
                        {item.badge && (
                          <span className="absolute top-3 right-3 bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200">
                            {item.badge}
                          </span>
                        )}

                        <div>
                          {renderRewardIcon(item.image_url || item.image)}
                          <h4 className="font-bold text-slate-900 text-sm leading-snug">{item.title}</h4>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.description}</p>
                          {item.stock !== undefined && item.stock !== null && (
                            <p className="text-[11px] font-medium text-slate-400 mt-1.5">
                              {item.stock > 0 ? `คงเหลือ ${item.stock} สิทธิ์` : 'สิทธิ์หมดแล้ว'}
                            </p>
                          )}
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">คะแนนที่ใช้</span>
                            <p className="text-lg font-black text-blue-700 leading-none">{item.points_required} <span className="text-xs font-normal">แต้ม</span></p>
                          </div>

                          <button
                            onClick={() => handleRedeemItem(item)}
                            disabled={!canRedeem}
                            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95 ${
                              isOutOfStock
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                                : canAfford
                                ? 'bg-primary hover:bg-primary/90 text-white cursor-pointer'
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                            }`}
                          >
                            {isOutOfStock ? 'ของหมด' : canAfford ? 'แลกรางวัล' : 'คะแนนไม่พอ'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 2. TASKS TAB */}
          {activeTab === 'tasks' && (
            <div className="space-y-4 animate-fade-in">
              {/* Daily Check-in Card */}
              <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl p-5 text-white shadow-md flex items-center justify-between">
                <div>
                  <span className="bg-white/20 text-amber-100 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    ภารกิจรายวัน
                  </span>
                  <h4 className="text-lg font-black mt-1">เช็คอินเข้าใช้งานวันนี้</h4>
                  <p className="text-xs text-amber-100 mt-0.5">รับฟรีทันที 5 คะแนนสะสมทุกวัน</p>
                </div>
                <button
                  onClick={handleDailyCheckIn}
                  className={`px-5 py-3 rounded-xl font-black text-xs transition-all shadow-lg active:scale-95 ${
                    dailyCheckedIn
                      ? 'bg-white/30 text-white cursor-default'
                      : 'bg-white text-amber-900 hover:bg-amber-50 cursor-pointer animate-pulse'
                  }`}
                >
                  {dailyCheckedIn ? '✓ เช็คอินแล้ว' : '⚡ เช็คอินรับ +5'}
                </button>
              </div>

              <div className="flex justify-between items-center pt-2">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-500" /> ภารกิจสะสมคะแนนเพิ่มเติม
                </h3>
                <button
                  onClick={fetchUserData}
                  disabled={loadingTasks}
                  className="p-1 text-slate-400 hover:text-primary transition rounded-lg hover:bg-slate-100"
                  title="รีเฟรชภารกิจ"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingTasks ? 'animate-spin text-primary' : ''}`} />
                </button>
              </div>

              {loadingTasks ? (
                <div className="py-10 flex flex-col items-center justify-center text-slate-400 gap-2 bg-white rounded-2xl border border-slate-200">
                  <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-xs">กำลังตรวจสอบภารกิจจากระบบ...</span>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {tasks.map(t => (
                    <div key={t.id} className="bg-white rounded-xl p-4 border border-slate-200 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-xl shrink-0">
                          {t.icon}
                        </div>
                        <div>
                          <h5 className="font-bold text-slate-800 text-sm">{t.title}</h5>
                          <span className="text-xs text-emerald-600 font-bold">+{t.points} คะแนน</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleTaskAction(t)}
                        disabled={t.completed}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          t.completed
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                            : 'bg-primary/10 text-primary hover:bg-primary hover:text-white cursor-pointer active:scale-95'
                        }`}
                      >
                        {t.completed ? '✓ สำเร็จแล้ว' : t.cta}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. HISTORY TAB */}
          {activeTab === 'history' && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-primary" /> ประวัติการรับและใช้คะแนน
                </h3>
                <button
                  onClick={fetchUserData}
                  disabled={loadingHistory}
                  className="p-1 text-slate-400 hover:text-primary transition rounded-lg hover:bg-slate-100"
                  title="รีเฟรชประวัติ"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin text-primary' : ''}`} />
                </button>
              </div>

              {loadingHistory ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2 bg-white rounded-2xl border border-slate-200">
                  <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-xs">กำลังโหลดประวัติคะแนนจากระบบ...</span>
                </div>
              ) : history.length === 0 ? (
                <div className="py-12 px-4 text-center bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-2xl mb-2">
                    📜
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm">ยังไม่มีประวัติคะแนนสะสม</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                    เมื่อคุณเช็คอินประจำวัน ชำระค่างวด หรือแลกของรางวัล รายการคะแนนจริงจะแสดงที่นี่
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 shadow-sm overflow-hidden">
                  {history.map(item => (
                    <div key={item.id} className="p-3.5 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{item.title}</p>
                        <p className="text-slate-400 mt-0.5">{item.date}</p>
                      </div>
                      <span className={`font-black text-sm ${
                        item.type === 'EARN' ? 'text-emerald-600' : 'text-red-500'
                      }`}>
                        {item.points > 0 ? `+${item.points}` : item.points} แต้ม
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. TIERS & BENEFITS TAB */}
          {activeTab === 'tiers' && (
            <div className="space-y-3 animate-fade-in">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-primary" /> สิทธิประโยชน์ระดับสมาชิก (Loyalty Tiers)
              </h3>

              <div className="space-y-3">
                {TIER_LEVELS.map(t => (
                  <div key={t.name} className={`p-4 rounded-2xl border ${t.color} shadow-sm space-y-2`}>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <span className="text-xl">{t.icon}</span> {t.name}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        {t.maxPoints === Infinity ? `${t.minPoints.toLocaleString()}+ คะแนน` : `${t.minPoints.toLocaleString()} - ${t.maxPoints.toLocaleString()} คะแนน`}
                      </span>
                    </div>
                    <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                      {t.perks.map((p, idx) => <li key={idx}>{p}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
