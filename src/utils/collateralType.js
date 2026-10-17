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

/**
 * Parses and normalizes Claimdetail string into a clean list of collateral items.
 * Safely handles:
 * 1. Legacy plain-text strings (older contracts)
 * 2. Modern serialized JSON arrays and objects (newer contracts)
 * 3. Fallback extraction from formData or contract.name_claim
 * 
 * @param {string|any} claimDetail - Raw Claimdetail from database
 * @param {string} [nameClaim] - Fallback guarantor name (from contract.name_claim)
 * @returns {Array<{type: string, details: string, images: string[], coordinates: any}>}
 */
export const parseCollateralDetails = (claimDetail, nameClaim = '') => {
  if (!claimDetail) return [];

  let parsed = null;

  if (typeof claimDetail === 'string') {
    const trimmed = claimDetail.trim();
    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
      try {
        parsed = JSON.parse(trimmed);
      } catch (err) {
        parsed = null;
      }
    }
  } else if (typeof claimDetail === 'object') {
    parsed = claimDetail;
  }

  // Handle double-encoded JSON strings if any
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch (e) {
      // keep as string
    }
  }

  // Fallback: If not JSON, it's a plain text description (older contracts)
  if (!parsed) {
    const text = String(claimDetail).trim();
    return text ? [{ type: '', details: text, images: [], coordinates: null }] : [];
  }

  const rawList = Array.isArray(parsed) ? parsed : [parsed];

  return rawList
    .map((item) => {
      if (typeof item === 'string') {
        return { type: '', details: item.trim(), images: [], coordinates: null };
      }
      if (!item || typeof item !== 'object') {
        return { type: '', details: String(item || '').trim(), images: [], coordinates: null };
      }

      const type = item.type || '';
      let details = (item.details || '').trim();
      const formData = item.formData || {};

      // 1. Person guarantor fallbacks
      if (type.includes('บุคคล') || (!details || details === 'ผู้ค้ำประกัน')) {
        if (!details || details === 'ผู้ค้ำประกัน') {
          if (formData.details && formData.details.trim() && formData.details.trim() !== 'ผู้ค้ำประกัน') {
            details = formData.details.trim();
          } else if (formData.name && formData.name.trim()) {
            details = `ผู้ค้ำประกัน: ${formData.name.trim()}`;
          } else if (nameClaim && nameClaim.trim()) {
            details = `ผู้ค้ำประกัน: ${nameClaim.trim()}`;
          }
        }
      }

      // 2. Land details fallbacks
      if (!details && (type.includes('ที่ดิน') || formData.deedNumber || formData.land)) {
        const land = formData.land || formData;
        const parts = [];
        if (land.deedNumber) parts.push(`โฉนดเลขที่ ${land.deedNumber}`);
        if (land.landNumber) parts.push(`เลขที่ดิน ${land.landNumber}`);
        if (land.survey) parts.push(`หน้าสำรวจ ${land.survey}`);
        if (land.subDistrict) parts.push(`ตำบล ${land.subDistrict}`);
        if (land.district) parts.push(`อำเภอ ${land.district}`);
        if (land.province) parts.push(`จังหวัด ${land.province}`);
        if (land.area || land.book || land.zone) {
          parts.push(`เนื้อที่ ${land.area || 0} ไร่ ${land.book || 0} งาน ${land.zone || 0} ตารางวา`);
        }
        if (parts.length > 0) details = parts.join(' ');
      }

      // 3. Vehicle details fallbacks
      if (!details && (type.includes('รถ') || formData.brand || formData.car || formData.motorcycle)) {
        const veh = formData.car || formData.motorcycle || formData;
        const parts = [];
        if (veh.brand) parts.push(`ยี่ห้อ ${veh.brand}`);
        if (veh.model) parts.push(`รุ่น ${typeof veh.model === 'object' ? veh.model.name : veh.model}`);
        if (veh.licensePlate) parts.push(`ทะเบียน ${veh.licensePlate}`);
        if (veh.province) parts.push(`จังหวัด ${veh.province}`);
        if (parts.length > 0) details = parts.join(' ');
      }

      // 4. Coordinates extraction
      let coordinates = item.coordinates || null;
      if (!coordinates && formData.coordinates) {
        coordinates = formData.coordinates;
      } else if (!coordinates && formData.latitude && formData.longitude) {
        coordinates = [formData.latitude, formData.longitude];
      }

      return {
        type,
        details: details || item.details || '-',
        images: Array.isArray(item.images) ? item.images : [],
        coordinates,
      };
    })
    .filter((item) => item.details && item.details !== '-');
};

