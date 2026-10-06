/**
 * Installment Progression Module
 * 
 * Deep module encapsulating contract progression math, unpaid installment queries,
 * date sorting, late fee calculation, and progress percentages.
 */

/**
 * Parses any date representation (DD/MM/YYYY, YYYY-MM-DD, ISO, or Date instance)
 * safely and accurately into a JavaScript Date object.
 * 
 * @param {string|Date|number} dateInput 
 * @returns {Date|null} Parsed Date instance or null if invalid
 */
export const parseAppDate = (dateInput) => {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }

  const str = String(dateInput).trim();
  if (!str || str === '-') return null;

  // Format DD/MM/YYYY or D/M/YYYY e.g. "08/10/2026" or "8/10/2569"
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const parts = str.split('/');
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexed
    let year = parseInt(parts[2], 10);
    if (year > 2400) year -= 543;
    const parsed = new Date(year, month, day);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  // Format YYYY-MM-DD e.g. "2026-10-08"
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const parts = str.split('-');
    let year = parseInt(parts[0], 10);
    if (year > 2400) year -= 543;
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const parsed = new Date(year, month, day);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
};

/**
 * Formats a date string or Date instance into Thai Date format e.g. "8 ตุลาคม 2569"
 * 
 * @param {string|Date} dateInput 
 * @returns {string} Formatted Thai date string
 */
export const formatThaiDate = (dateInput) => {
  const date = parseAppDate(dateInput);
  if (!date) return dateInput ? String(dateInput) : '';
  const months = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const year = date.getFullYear() > 2400 ? date.getFullYear() : date.getFullYear() + 543;
  return `${date.getDate()} ${months[date.getMonth()]} ${year}`;
};

/**
 * Calculates late interest (ดอกเบี้ยผิดนัด / ค่าปรับล่าช้า - fee2) for an installment or contract.
 * Grace period is 3 days by default (settings.grace_period_days).
 * Formula: Math.round((rowPrincipal * annualRate * actualDaysLate) / 365)
 * 
 * @param {Object|string} rowOrBeginDate - Installment row object or begin_date string
 * @param {Object} contract - Contract object (for interest rate and total_treerest)
 * @param {Object} settings - Company settings (for grace_period_days and normal_interest_rate)
 * @param {Date|string} calcDate - Date of calculation (default: now)
 * @returns {number} Late interest amount in THB
 */
export const calculateLateInterest = (rowOrBeginDate, contract = {}, settings = {}, calcDate = new Date()) => {
  const beginDateStr = typeof rowOrBeginDate === 'object' ? rowOrBeginDate?.begin_date : rowOrBeginDate;
  if (!beginDateStr) return 0;
  const dueDate = parseAppDate(beginDateStr);
  if (!dueDate) return 0;

  const targetDate = parseAppDate(calcDate) || new Date();
  targetDate.setHours(0, 0, 0, 0);

  const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  due.setHours(0, 0, 0, 0);

  const diffTime = targetDate - due;
  const actualDaysLate = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const gracePeriod = parseInt(settings?.grace_period_days || 3, 10);

  if (actualDaysLate <= gracePeriod) return 0;

  const annualRate = parseFloat(contract?.interest || settings?.normal_interest_rate || 15) / 100;
  const rowTree = typeof rowOrBeginDate === 'object' ? parseFloat(rowOrBeginDate?.tree || 0) : 0;
  const rowPrincipal = rowTree > 0 ? rowTree : parseFloat(contract?.total_treerest || 0);

  return Math.round((rowPrincipal * annualRate * actualDaysLate) / 365);
};

/**
 * Calculates collection fee (ค่าทวงถาม - fee3) for an installment.
 * Grace period is 15 days by default (settings.collection_grace_period_days).
 * Tier 1 (16-30 days late): 50 THB (settings.collection_fee_tier1)
 * Tier 2 (>30 days late): 100 THB (settings.collection_fee_tier2)
 * 
 * @param {Object|string} rowOrBeginDate - Installment row object or begin_date string
 * @param {Object} settings - Company settings
 * @param {Date|string} calcDate - Date of calculation (default: now)
 * @returns {number} Collection fee amount in THB
 */
export const calculateCollectionFee = (rowOrBeginDate, settings = {}, calcDate = new Date()) => {
  const beginDateStr = typeof rowOrBeginDate === 'object' ? rowOrBeginDate?.begin_date : rowOrBeginDate;
  if (!beginDateStr) return 0;
  const dueDate = parseAppDate(beginDateStr);
  if (!dueDate) return 0;

  const targetDate = parseAppDate(calcDate) || new Date();
  targetDate.setHours(0, 0, 0, 0);

  const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  due.setHours(0, 0, 0, 0);

  const diffTime = targetDate - due;
  const actualDaysLate = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const collGrace = parseInt(settings?.collection_grace_period_days || 15, 10);
  const fee1 = parseFloat(settings?.collection_fee_tier1 || 50);
  const fee2 = parseFloat(settings?.collection_fee_tier2 || 100);

  if (actualDaysLate <= collGrace) return 0;
  return actualDaysLate > 30 ? fee2 : fee1;
};

/**
 * Calculates combined overdue fee details (lateInterest + collectionFee)
 * 
 * @param {Object|string} rowOrBeginDate 
 * @param {Object} contract 
 * @param {Object} settings 
 * @param {Date|string} calcDate 
 * @returns {Object} { lateInterest, collectionFee, totalFee }
 */
export const calculateOverdueFeeDetails = (rowOrBeginDate, contract = {}, settings = {}, calcDate = new Date()) => {
  const lateInterest = calculateLateInterest(rowOrBeginDate, contract, settings, calcDate);
  const collectionFee = calculateCollectionFee(rowOrBeginDate, settings, calcDate);
  return {
    lateInterest,
    collectionFee,
    totalFee: lateInterest + collectionFee,
  };
};

/**
 * Calculates late fee for an installment based on its begin_date and contract/settings.
 * 
 * @param {string|Date|Object} beginDateStr - Installment begin_date or row object
 * @param {Object} [contract] - Contract object
 * @param {Object} [settings] - Company settings
 * @param {Date|string} [calcDate] - Date of calculation
 * @returns {number} Combined late fee + collection fee amount in THB
 */
export const calculateOverdueFee = (beginDateStr, contract = {}, settings = {}, calcDate = new Date()) => {
  const details = calculateOverdueFeeDetails(beginDateStr, contract, settings, calcDate);
  return details.totalFee;
};

/**
 * EIR Breakdown calculation matching my-app - Copy logic
 */
export const calcEIRBreakdown = ({ contract = {}, paymentDate, settings = {}, overdueRows = [], history = [] }) => {
  const annualRate = parseFloat(contract?.interest || settings?.normal_interest_rate || 15) / 100;
  const principal = parseFloat(contract?.total_treerest || 0);

  let lastPayRaw = contract?.last_datepay;
  if (!lastPayRaw && history && history.length > 0) {
    lastPayRaw = history[0].begindate;
  }
  if (!lastPayRaw) {
    lastPayRaw = contract?.date_contact;
  }

  const lastPayDate = parseAppDate(lastPayRaw) || new Date();
  const payDate = paymentDate ? parseAppDate(paymentDate) || new Date() : new Date();

  const diffTime = payDate - lastPayDate;
  const days = Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));
  const normalInterest = Math.round((principal * annualRate * days) / 365);
  const monthlyInstallment = parseFloat(contract?.paypermonth || 0);

  let lateInterest = 0;
  let collectionFee = 0;

  (overdueRows || []).forEach((row) => {
    const details = calculateOverdueFeeDetails(row, contract, settings, payDate);
    lateInterest += details.lateInterest;
    collectionFee += details.collectionFee;
  });

  const totalOverdue = collectionFee + lateInterest + normalInterest + principal;
  const isInterestLoan = contract?.loan_type === 'interest';
  const baseInstallment = Math.min(principal, monthlyInstallment);

  const totalMinimum = isInterestLoan
    ? collectionFee + lateInterest + Math.max(normalInterest, monthlyInstallment)
    : collectionFee + lateInterest + Math.max(normalInterest, baseInstallment);

  const totalInterestOnly = collectionFee + lateInterest + normalInterest;

  return {
    principal,
    normalInterest,
    lateInterest,
    collectionFee,
    totalOverdue,
    totalMinimum,
    totalInterestOnly,
    monthlyInstallment,
    days,
    annualRate: annualRate * 100,
    isInterestLoan,
  };
};

/**
 * Payment Waterfall matching my-app - Copy logic
 * Priority: Collection Fee -> Late Interest -> Normal Interest -> Principal
 */
export const applyWaterfall = (
  paymentAmount,
  breakdown,
  manualCollFee,
  manualLateInt,
  discountCollFee = 0,
  discountLateInt = 0,
  discountNormInt = 0,
  skipPrincipal = false
) => {
  const effCollFee = Math.max(0, (manualCollFee ?? breakdown.collectionFee) - (discountCollFee ?? 0));
  const effLateInt = Math.max(0, (manualLateInt ?? breakdown.lateInterest) - (discountLateInt ?? 0));
  const effNormInt = Math.max(0, breakdown.normalInterest - (discountNormInt ?? 0));
  const effPrincipal = breakdown.principal;

  let remaining = Math.max(0, paymentAmount);
  let paidCollFee = 0,
    paidLateInt = 0,
    paidNormInt = 0,
    paidPrincipal = 0;

  // 1. Collection Fees
  if (remaining >= effCollFee) {
    paidCollFee = effCollFee;
    remaining -= effCollFee;
  } else {
    paidCollFee = remaining;
    remaining = 0;
  }

  // 2. Default / Late Interest
  if (remaining >= effLateInt) {
    paidLateInt = effLateInt;
    remaining -= effLateInt;
  } else {
    paidLateInt = remaining;
    remaining = 0;
  }

  // 3. Normal Interest
  if (skipPrincipal) {
    paidNormInt = remaining;
    remaining = 0;
  } else {
    if (remaining >= effNormInt) {
      paidNormInt = effNormInt;
      remaining -= effNormInt;
    } else {
      paidNormInt = remaining;
      remaining = 0;
    }
  }

  // 4. Principal Reduction
  if (!skipPrincipal) {
    if (remaining >= effPrincipal) {
      paidPrincipal = effPrincipal;
      remaining -= effPrincipal;
    } else {
      paidPrincipal = remaining;
      remaining = 0;
    }
  }

  const newPrincipal = Math.max(0, effPrincipal - paidPrincipal);

  return {
    paidCollFee,
    paidLateInt,
    paidNormInt,
    paidPrincipal,
    excess: remaining,
    newPrincipal,
    total: paidCollFee + paidLateInt + paidNormInt + paidPrincipal,
    skipPrincipal,
  };
};

/**
 * Calculates progression metrics for a specific loan contract.
 * 
 * @param {Object} contract - Contract object from contact table
 * @param {Array} installments - List of installment objects for this contract
 * @param {Object} [settings] - Company settings object
 * @returns {Object} Progression metrics and next payment summary
 */
export const getContractProgression = (contract, installments = [], settings = {}) => {
  if (!installments || !Array.isArray(installments)) {
    return {
      paidInstallments: [],
      unpaidInstallments: [],
      sortedUnpaid: [],
      nextInstallment: null,
      nextFeeDetails: { lateInterest: 0, collectionFee: 0, totalFee: 0 },
      nextFee: 0,
      nextPayTotal: 0,
      paidCount: 0,
      totalCount: Number(contract?.month_loan) || 0,
      progressPercent: 0,
    };
  }

  // 1. Paid installments (sorted newest to oldest by number_pay descending)
  const paidInstallments = installments
    .filter((row) => row.status === 1 || String(row.status) === '1')
    .sort((a, b) => {
      const numA = Number(a.number_pay) || 0;
      const numB = Number(b.number_pay) || 0;
      if (numA !== numB) return numB - numA;
      const timeA = parseAppDate(b.pay_date || b.begin_date)?.getTime() || 0;
      const timeB = parseAppDate(a.pay_date || a.begin_date)?.getTime() || 0;
      return timeA - timeB;
    });

  // 2. Unpaid installments (sorted earliest to latest by begin_date ascending)
  const unpaidInstallments = installments.filter((row) => row.status !== 1 && String(row.status) !== '1');
  const sortedUnpaid = [...unpaidInstallments].sort((a, b) => {
    const timeA = parseAppDate(a.begin_date)?.getTime() || 0;
    const timeB = parseAppDate(b.begin_date)?.getTime() || 0;
    return timeA - timeB;
  });

  // 3. Next payment resolution
  const nextInstallment = sortedUnpaid[0] || null;
  const nextFeeDetails = nextInstallment
    ? calculateOverdueFeeDetails(nextInstallment, contract, settings)
    : { lateInterest: 0, collectionFee: 0, totalFee: 0 };
  const nextFee = nextFeeDetails.totalFee;
  const nextPayTotal = nextInstallment
    ? Number(nextInstallment.tree || 0) + Number(nextInstallment.interest || 0) + nextFee
    : 0;

  // 4. Progression counts & percentages
  const paidCount = paidInstallments.length;
  const totalCount = Number(contract?.month_loan) || installments.length || 0;
  const progressPercent = totalCount > 0 ? Math.min(100, Math.round((paidCount / totalCount) * 100)) : 0;

  return {
    paidInstallments,
    unpaidInstallments,
    sortedUnpaid,
    nextInstallment,
    nextFeeDetails,
    nextFee,
    nextPayTotal,
    paidCount,
    totalCount,
    progressPercent,
  };
};

/**
 * Calculates global progression across multiple contracts for a user.
 * 
 * @param {Array} activeContacts - Array of active contracts
 * @param {Array} allInstallments - All interest chart records
 * @returns {Object} Global next due installment and corresponding contract
 */
export const getOverallProgression = (activeContacts = [], allInstallments = []) => {
  if (!allInstallments || allInstallments.length === 0 || !activeContacts || activeContacts.length === 0) {
    return { nextInstallment: null, nextContract: activeContacts[0] || null };
  }

  const activeContractIds = activeContacts.map((c) => c.ID_contact);
  const unpaid = allInstallments.filter(
    (inst) => activeContractIds.includes(inst.Id_contact) && inst.status !== 1 && String(inst.status) !== '1'
  );

  const sorted = [...unpaid].sort((a, b) => {
    const timeA = parseAppDate(a.begin_date)?.getTime() || 0;
    const timeB = parseAppDate(b.begin_date)?.getTime() || 0;
    return timeA - timeB;
  });

  const earliest = sorted[0] || null;
  const contract = earliest
    ? activeContacts.find((c) => c.ID_contact === earliest.Id_contact)
    : activeContacts[0];

  return { nextInstallment: earliest, nextContract: contract };
};
