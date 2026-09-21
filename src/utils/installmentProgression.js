/**
 * Installment Progression Module
 * 
 * Deep module encapsulating contract progression math, unpaid installment queries,
 * date sorting, late fee calculation, and progress percentages.
 */

/**
 * Calculates late fee for an installment based on its begin_date.
 * Due date is 1 month after begin_date. Grace period is 4 days.
 * Late fee is 50 THB/day after grace period.
 * 
 * @param {string|Date} beginDateStr 
 * @returns {number} Late fee amount in THB
 */
export const calculateOverdueFee = (beginDateStr) => {
  if (!beginDateStr) return 0;
  const beginDate = new Date(beginDateStr);
  if (isNaN(beginDate.getTime())) return 0;

  const dueDate = new Date(beginDate.getFullYear(), beginDate.getMonth() + 1, beginDate.getDate());
  const today = new Date();
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
    .filter((row) => row.status === 1)
    .sort((a, b) => {
      const numA = Number(a.number_pay) || 0;
      const numB = Number(b.number_pay) || 0;
      if (numA !== numB) return numB - numA;
      return new Date(b.pay_date || b.begin_date || 0) - new Date(a.pay_date || a.begin_date || 0);
    });

  // 2. Unpaid installments (sorted earliest to latest by begin_date ascending)
  const unpaidInstallments = installments.filter((row) => row.status !== 1);
  const sortedUnpaid = [...unpaidInstallments].sort(
    (a, b) => new Date(a.begin_date) - new Date(b.begin_date)
  );

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
    (inst) => activeContractIds.includes(inst.Id_contact) && inst.status !== 1
  );

  const sorted = [...unpaid].sort((a, b) => new Date(a.begin_date) - new Date(b.begin_date));
  const earliest = sorted[0] || null;
  const contract = earliest
    ? activeContacts.find((c) => c.ID_contact === earliest.Id_contact)
    : activeContacts[0];

  return { nextInstallment: earliest, nextContract: contract };
};
