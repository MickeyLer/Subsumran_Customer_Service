// src/utils/tierConfig.js

/**
 * Shared Tier & Loyalty Level Configuration
 * Bronze: 0 - 99 แต้ม
 * Silver: 100 - 499 แต้ม
 * Gold: 500 - 999 แต้ม
 * Platinum: 1,000+ แต้ม
 */

export const TIER_LEVELS = [
  {
    key: 'bronze',
    name: 'Bronze Member',
    icon: '🥉',
    materialIcon: 'military_tech',
    minPoints: 0,
    maxPoints: 99,
    nextMinPoints: 100,
    badgeBg: 'bg-amber-100 text-amber-800 border-amber-300',
    color: 'border-amber-600/30 bg-amber-50/30',
    perks: ['สะสมคะแนนจากการชำระค่างวดตรงเวลา', 'เช็คอินประจำวันรับแต้มฟรี']
  },
  {
    key: 'silver',
    name: 'Silver Member',
    icon: '🥈',
    materialIcon: 'military_tech',
    minPoints: 100,
    maxPoints: 499,
    nextMinPoints: 500,
    badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
    color: 'border-slate-400/40 bg-slate-50',
    perks: ['ลดค่าธรรมเนียมทวงถาม 50%', 'คูปองแลกของขวัญและบัตรเติมเงิน']
  },
  {
    key: 'gold',
    name: 'Gold Member',
    icon: '🥇',
    materialIcon: 'military_tech',
    minPoints: 500,
    maxPoints: 999,
    nextMinPoints: 1000,
    badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
    color: 'border-yellow-500/50 bg-amber-50/50',
    perks: ['ขยายเวลาชำระค่างวด 3 วัน (Grace Period)', 'ส่วนลดดอกเบี้ย 0.5%']
  },
  {
    key: 'platinum',
    name: 'Platinum Member',
    icon: '💎',
    materialIcon: 'diamond',
    minPoints: 1000,
    maxPoints: Infinity,
    nextMinPoints: null,
    badgeBg: 'bg-cyan-100 text-cyan-900 border-cyan-300',
    color: 'border-cyan-500/50 bg-cyan-50/30',
    perks: ['อนุมัติสินเชื่อ/สัญญาไวพิเศษ', 'ของขวัญส่งตรงถึงบ้านฟรีประจำปี']
  }
];

export function calculateTierInfo(currentPoints = 0) {
  const pts = Math.max(0, Number(currentPoints) || 0);

  if (pts >= 1000) {
    const t = TIER_LEVELS[3];
    return {
      name: t.name,
      icon: t.icon,
      materialIcon: t.materialIcon,
      badgeBg: t.badgeBg,
      currentPoints: pts,
      minPoints: 1000,
      nextTierName: null,
      nextMinPoints: null,
      pointsNeeded: 0,
      progress: 100
    };
  }

  if (pts >= 500) {
    const t = TIER_LEVELS[2];
    const pointsNeeded = 1000 - pts;
    const progress = Math.min(100, Math.round(((pts - 500) / 500) * 100));
    return {
      name: t.name,
      icon: t.icon,
      materialIcon: t.materialIcon,
      badgeBg: t.badgeBg,
      currentPoints: pts,
      minPoints: 500,
      nextTierName: 'Platinum Member',
      nextTierIcon: '💎',
      nextMinPoints: 1000,
      pointsNeeded,
      progress
    };
  }

  if (pts >= 100) {
    const t = TIER_LEVELS[1];
    const pointsNeeded = 500 - pts;
    const progress = Math.min(100, Math.round(((pts - 100) / 400) * 100));
    return {
      name: t.name,
      icon: t.icon,
      materialIcon: t.materialIcon,
      badgeBg: t.badgeBg,
      currentPoints: pts,
      minPoints: 100,
      nextTierName: 'Gold Member',
      nextTierIcon: '🥇',
      nextMinPoints: 500,
      pointsNeeded,
      progress
    };
  }

  const t = TIER_LEVELS[0];
  const pointsNeeded = 100 - pts;
  const progress = Math.min(100, Math.round((pts / 100) * 100));
  return {
    name: t.name,
    icon: t.icon,
    materialIcon: t.materialIcon,
    badgeBg: t.badgeBg,
    currentPoints: pts,
    minPoints: 0,
    nextTierName: 'Silver Member',
    nextTierIcon: '🥈',
    nextMinPoints: 100,
    pointsNeeded,
    progress
  };
}
