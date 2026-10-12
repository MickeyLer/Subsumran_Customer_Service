/**
 * Collateral Type Utility Module
 * 
 * Maps loan contract collateral / guarantee types (หลักค้ำประกัน / Claimthing)
 * to intuitive icons, color schemes, and descriptive labels.
 * 
 * Supported categories:
 * - ที่ดิน (Land / Real Estate)
 * - บุคคล (Personal Guarantor)
 * - รถยนต์ (Automobile / Car)
 * - รถจักรยานยนต์ (Motorcycle)
 * - Default / General contract
 */

export const COLLATERAL_TYPES = {
  LAND: 'land',
  PERSON: 'person',
  CAR: 'car',
  MOTORCYCLE: 'motorcycle',
  OTHER: 'other',
};

/**
 * Returns icon, theme colors, and formatted labels for a given contract collateral type (Claimthing).
 * 
 * @param {string|null|undefined} claimThing - Collateral type text from DB (e.g. 'ที่ดิน', 'บุคคล', 'รถยนต์', 'รถจักรยานยนต์')
 * @returns {object} Collateral metadata including icon, badge classes, and labels
 */
export const getCollateralTypeInfo = (claimThing) => {
  const str = String(claimThing || '').trim();
  const lower = str.toLowerCase();

  // 1. ที่ดิน (Land / Real Estate)
  if (lower.includes('ที่ดิน') || lower.includes('โฉนด') || lower.includes('ดิน')) {
    return {
      key: COLLATERAL_TYPES.LAND,
      type: 'ที่ดิน',
      label: 'ที่ดิน',
      fullLabel: 'หลักประกัน: ที่ดิน',
      icon: 'landscape',
      iconContainerClass: 'bg-emerald-50 text-emerald-600 border-emerald-200/80',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dotClass: 'bg-emerald-500',
      colorName: 'emerald',
    };
  }

  // 2. รถจักรยานยนต์ (Motorcycle) - Check before general "รถ"
  if (
    lower.includes('จักรยานยนต์') || 
    lower.includes('มอเตอร์ไซค์') || 
    lower.includes('มอไซ') || 
    lower.includes('สองล้อ')
  ) {
    return {
      key: COLLATERAL_TYPES.MOTORCYCLE,
      type: 'รถจักรยานยนต์',
      label: 'รถจักรยานยนต์',
      fullLabel: 'หลักประกัน: รถจักรยานยนต์',
      icon: 'two_wheeler',
      iconContainerClass: 'bg-amber-50 text-amber-600 border-amber-200/80',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      dotClass: 'bg-amber-500',
      colorName: 'amber',
    };
  }

  // 3. รถยนต์ (Car / Automobile)
  if (
    lower.includes('รถยนต์') || 
    lower.includes('รถเก๋ง') || 
    lower.includes('รถกระบะ') || 
    lower.includes('กระบะ') ||
    (lower.includes('รถ') && !lower.includes('จักรยานยนต์'))
  ) {
    return {
      key: COLLATERAL_TYPES.CAR,
      type: 'รถยนต์',
      label: 'รถยนต์',
      fullLabel: 'หลักประกัน: รถยนต์',
      icon: 'directions_car',
      iconContainerClass: 'bg-blue-50 text-blue-600 border-blue-200/80',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      dotClass: 'bg-blue-500',
      colorName: 'blue',
    };
  }

  // 4. บุคคล (Personal guarantor)
  if (
    lower.includes('บุคคล') || 
    lower.includes('คนค้ำ') || 
    lower.includes('ผู้ค้ำ') ||
    lower.includes('คน')
  ) {
    return {
      key: COLLATERAL_TYPES.PERSON,
      type: 'บุคคล',
      label: 'บุคคล',
      fullLabel: 'ค้ำประกัน: บุคคล',
      icon: 'person',
      iconContainerClass: 'bg-indigo-50 text-indigo-600 border-indigo-200/80',
      badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      dotClass: 'bg-indigo-500',
      colorName: 'indigo',
    };
  }

  // 5. Default / Other
  return {
    key: COLLATERAL_TYPES.OTHER,
    type: str || 'สัญญาเงินกู้',
    label: str || 'สัญญาเงินกู้',
    fullLabel: str || 'สัญญาเงินกู้',
    icon: 'receipt_long',
    iconContainerClass: 'bg-rose-50 text-primary border-rose-200/80',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    dotClass: 'bg-rose-500',
    colorName: 'rose',
  };
};
