import supabase from '../supabaseClient';
import { uploadFileToStorage } from './storageSeam';
import {
  addTransaction,
  updateInterestChart,
  updateContactData,
  fetchLatestGlobalInvoices,
} from './api';
import { calculateOverdueFee, calculateOverdueFeeDetails, parseAppDate } from '../utils/installmentProgression';
import { DateTime } from 'luxon';

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
  slipUrl: passedSlipUrl,
  contract = {},
  settings = {},
}) => {
  if (!slipFile && !passedSlipUrl) {
    throw new Error('กรุณาอัพโหลดสลิปการโอนเงิน');
  }
  if (!selectedInstallments || selectedInstallments.length === 0) {
    throw new Error('ไม่พบงวดที่เลือกสำหรับการชำระเงิน');
  }

  // 1. Resolve fee2 (late interest) and fee3 (collection fee) across selected installments
  let totalLateInterest = 0;
  let totalCollectionFee = 0;

  selectedInstallments.forEach((inst) => {
    const details = calculateOverdueFeeDetails(inst, contract, settings);
    totalLateInterest += details.lateInterest;
    totalCollectionFee += details.collectionFee;
  });

  // 2. Generate Next Invoice ID
  const invoiceID = await generateNextInvoiceID();

  // 3. Resolve slip URL (use passed URL or upload file to storage)
  let slipUrl = passedSlipUrl;
  if (!slipUrl && slipFile) {
    const timestamp = Date.now();
    const storagePath = `slips/${contractId}/${timestamp}_${slipFile.name || 'slip.jpg'}`;
    slipUrl = await uploadFileToStorage(slipFile, storagePath);
  }

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
  const newRest = Math.max(0, rest - totalTree);
  const totalAmount = totalTree + totalInterest + totalLateInterest + totalCollectionFee;

  // Calculate Next Due Date (advancing 1 month)
  const currentDueStr = contract?.Next_duedate || contract?.date_contact || paymentDateStr;
  let nextDueDateStr = paymentDateStr;
  try {
    const d = DateTime.fromISO(currentDueStr);
    nextDueDateStr = (d.isValid ? d : DateTime.fromISO(paymentDateStr)).plus({ months: 1 }).toISODate();
  } catch (e) {
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextDueDateStr = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-${String(nextMonth.getDate()).padStart(2, '0')}`;
  }

  // 5. Prepare chart updates for atomic process_payment_v2 RPC
  let runningRest = rest;
  const chartUpdates = sortedInstallments.map((inst) => {
    runningRest -= Number(inst.tree);
    const instDetails = calculateOverdueFeeDetails(inst, contract, settings);
    return {
      id: String(inst.ID),
      pay_date: paymentDateStr,
      reference: invoiceID,
      paytree: String(inst.tree),
      payinter: String(inst.interest),
      payfee2: String(instDetails.lateInterest),
      payfee3: String(instDetails.collectionFee),
      dis_fee2: '0',
      dis_fee3: '0',
      resttree: String(Math.max(0, runningRest)),
      accu: '0',
      payroute: 'เงินโอน',
      user_record: 'LINE-LIFF',
      status: 1,
    };
  });

  // 6. Prepare Transaction Record data
  const txData = {
    type: 'จ่าย',
    Timestamp: new Date().toISOString(),
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
    fee2: totalLateInterest, // ค่าปรับล่าช้า (Late interest)
    fee3: totalCollectionFee, // ค่าทวงถาม (Collection fee)
    dis_fee2: '0',
    dis_fee3: '0',
    payroute: 'เงินโอน',
    accu: '0',
    accu_discount: '0',
    rest_loan: String(newRest),
    due_date: nextDueDateStr,
    user_record: 'LINE-LIFF',
    income: String(totalAmount),
    slip_url: slipUrl,
    pdf_link: '',
  };

  // 7. Execute Atomic Database Update via process_payment_v2 (Same as my-app - Copy)
  let rpcSuccess = false;
  try {
    const { error: rpcError } = await supabase.rpc('process_payment_v2', {
      p_tx_data: txData,
      p_contact_id: contractId,
      p_contact_update: {
        last_datepay: paymentDateStr,
        total_treerest: newRest,
        Next_duedate: nextDueDateStr,
        accumulate: accumulate ? Number(accumulate) : 0,
      },
      p_chart_updates: chartUpdates,
    });

    if (!rpcError) {
      rpcSuccess = true;
      console.log('✅ process_payment_v2 executed successfully with pessimistic lock!');
      if (slipUrl) {
        await supabase.from('transaction').update({ slip_url: slipUrl }).eq('Invoice', invoiceID).catch(() => {});
      }
    } else {
      console.warn('RPC process_payment_v2 returned error, falling back to sequential updates:', rpcError);
    }
  } catch (rpcErr) {
    console.warn('RPC process_payment_v2 threw error, falling back to sequential updates:', rpcErr);
  }

  // Fallback to sequential updates if RPC was not used
  if (!rpcSuccess) {
    await addTransaction({ ...txData, status: 'pending' });

    let fallbackRest = rest;
    for (const inst of sortedInstallments) {
      fallbackRest -= Number(inst.tree);
      const instDetails = calculateOverdueFeeDetails(inst, contract, settings);
      await updateInterestChart(inst.ID, {
        pay_date: paymentDateStr,
        reference: invoiceID,
        paytree: String(inst.tree),
        payinter: String(inst.interest),
        payfee2: String(instDetails.lateInterest),
        payfee3: String(instDetails.collectionFee),
        Rest: String(Math.max(0, fallbackRest)),
        payroute: 'เงินโอน',
        slip_url: slipUrl,
        pdf_link: '',
        status: 1,
      });
    }

    await updateContactData(contractId, {
      last_datepay: paymentDateStr,
      total_treerest: newRest,
      accumulate: accumulate,
    });
  }

  return {
    success: true,
    invoiceID,
    slipUrl,
    newRest,
  };
};
