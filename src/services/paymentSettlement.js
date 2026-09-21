import { uploadFileToStorage } from './storageSeam';
import {
  addTransaction,
  updateInterestChart,
  updateContactData,
  fetchLatestGlobalInvoices,
} from './api';
import { calculateOverdueFee } from '../utils/installmentProgression';

/**
 * Payment Settlement Module
 * 
 * Deep module encapsulating the complete payment workflow:
 * - Late fee calculations for earliest overdue installment
 * - Auto-sequenced Invoice ID generation
 * - Slip document upload via Storage Adapter Seam
 * - Multi-record database transactions (transaction record, interest chart rows, contact balances)
 */

/**
 * Generates the next sequential Invoice ID (e.g. "001/69", "002/69").
 * @returns {Promise<string>} Next invoice ID string
 */
export const generateNextInvoiceID = async () => {
  const transactions = await fetchLatestGlobalInvoices(50);
  const invoices = transactions
    .map((val) => val.Invoice)
    .filter((inv) => inv && inv !== '');

  const lastID = invoices.length > 0 ? invoices[0] : null;
  const now = new Date();
  const yearBE = (now.getFullYear() + 543).toString().substring(2);

  if (!lastID) {
    return `001/${yearBE}`;
  }

  const parts = lastID.split('/');
  if (parts.length < 2 || parts[1] !== yearBE) {
    return `001/${yearBE}`;
  }

  const nextNum = parseInt(parts[0], 10) + 1;
  const numStr = nextNum < 10 ? `00${nextNum}` : nextNum < 100 ? `0${nextNum}` : `${nextNum}`;
  return `${numStr}/${yearBE}`;
};

/**
 * Submits a complete payment settlement for selected installments.
 * 
 * @param {Object} params
 * @param {Array} params.selectedInstallments - List of installment objects selected for payment
 * @param {number} params.totalTree - Total principal amount
 * @param {number} params.totalInterest - Total interest amount
 * @param {number} params.rest - Current remaining contract balance
 * @param {string} params.customerName - Borrower name
 * @param {string} params.contractId - Contract ID
 * @param {any} params.accumulate - Accumulate balance
 * @param {File} params.slipFile - Uploaded payment slip image
 * @returns {Promise<Object>} Result object with invoiceID and slipUrl
 */
export const submitPaymentSettlement = async ({
  selectedInstallments = [],
  totalTree = 0,
  totalInterest = 0,
  rest = 0,
  customerName = '',
  contractId = '',
  accumulate,
  slipFile,
}) => {
  if (!slipFile) {
    throw new Error('กรุณาอัพโหลดสลิปการโอนเงิน');
  }
  if (!selectedInstallments || selectedInstallments.length === 0) {
    throw new Error('ไม่พบงวดที่เลือกสำหรับการชำระเงิน');
  }

  // 1. Resolve earliest overdue installment for fee calculation
  const earliestRow = selectedInstallments.reduce((prev, curr) =>
    new Date(prev.begin_date) < new Date(curr.begin_date) ? prev : curr
  );
  const fee = earliestRow ? calculateOverdueFee(earliestRow.begin_date) : 0;

  // 2. Generate Next Invoice ID
  const invoiceID = await generateNextInvoiceID();

  // 3. Upload slip file to storage
  const timestamp = Date.now();
  const storagePath = `slips/${contractId}/${timestamp}_${slipFile.name}`;
  const slipUrl = await uploadFileToStorage(slipFile, storagePath);

  // 4. Format current payment date string (YYYY-MM-DD)
  const now = new Date();
  const paymentDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;

  // Sorted installments for reference
  const sortedInstallments = [...selectedInstallments].sort(
    (a, b) => a.number_pay - b.number_pay
  );
  const numPayLabel = sortedInstallments.map((r) => r.number_pay).join(',');

  // 5. Create Transaction Record
  const transactionData = {
    type: 'จ่าย',
    Invoice: invoiceID,
    ID_contact: contractId,
    Number_pay: numPayLabel,
    begindate: paymentDateStr,
    Number_date: '',
    details: customerName,
    type_income: `เลขที่สัญญา ${contractId}`,
    tree: String(totalTree),
    interest: totalInterest,
    fee1: 0,
    fee2: fee,
    fee3: 0,
    payroute: 'เงินโอน',
    accu: '0',
    status: 'pending',
    pdf_link: slipUrl,
  };
  await addTransaction(transactionData);

  // 6. Update individual installment rows in Interest_chart
  let runningRest = rest;
  for (const inst of sortedInstallments) {
    runningRest -= Number(inst.tree);
    await updateInterestChart(inst.ID, {
      pay_date: paymentDateStr,
      reference: invoiceID,
      paytree: String(inst.tree),
      payinter: String(inst.interest),
      payfee2: String(fee > 0 && inst.ID === earliestRow?.ID ? fee : 0),
      Rest: String(runningRest),
      payroute: 'เงินโอน',
      pdf_link: slipUrl,
      status: 1,
    });
  }

  // 7. Update Contact record balance
  const newRest = rest - totalTree;
  await updateContactData(contractId, {
    last_datepay: paymentDateStr,
    total_treerest: newRest,
    accumulate: accumulate,
  });

  return {
    success: true,
    invoiceID,
    slipUrl,
    newRest,
  };
};
