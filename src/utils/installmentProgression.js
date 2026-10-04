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
 * Calculates late fee for an installment based on its begin_date.
 * Due date is the begin_date itself. Grace period is 4 days.
 * Late fee is 50 THB/day after grace period.
 * 
 * @param {string|Date} beginDateStr 
 * @returns {number} Late fee amount in THB
 */
export const calculateOverdueFee = (beginDateStr) => {
  if (!beginDateStr) return 0;
  const beginDate = parseAppDate(beginDateStr);
  if (!beginDate) return 0;

  const dueDate = new Date(beginDate.getFullYear(), beginDate.getMonth(), beginDate.getDate());
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = today - dueDate;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) - 4;

  return diffDays > 0 ? diffDays * 50 : 0;
};

/**
 * Calculates progression metrics for a specific loan contract.
 * 
 * @param {Object} contract - Contract object from contact table
 * @param {Array} installments - List of installment objects for this contract
 * @returns {Object} Progression metrics and next payment summary
 */
export const getContractProgression = (contract, installments = []) => {
  if (!installments || !Array.isArray(installments)) {
    return {
      paidInstallments: [],
      unpaidInstallments: [],
      sortedUnpaid: [],
      nextInstallment: null,
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
  const nextFee = nextInstallment ? calculateOverdueFee(nextInstallment.begin_date) : 0;
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
