import supabase from '../supabaseClient';
import { uploadFileToStorage } from './storageSeam';
import {
  addTransaction,
  updateInterestChart,
  updateContactData,
  fetchLatestGlobalInvoices,
} from './api';
import { calculateOverdueFee, calculateOverdueFeeDetails, parseAppDate, applyWaterfall } from '../utils/installmentProgression';
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
  payMode = 'minimum',
  breakdown = null,
  paymentAmount: passedAmount = null,
}) => {
  if (!slipFile && !passedSlipUrl) {
    throw new Error('กรุณาอัพโหลดสลิปการโอนเงิน');
  }
  if (!selectedInstallments || selectedInstallments.length === 0) {
    throw new Error('ไม่พบงวดที่เลือกสำหรับการชำระเงิน');
  }

  // 1. Resolve fee2 (late interest), fee3 (collection fee), interest, and principal
  let totalLateInterest = 0;
  let totalCollectionFee = 0;
  let paidPrincipal = totalTree;
  let paidNormInt = totalInterest;
  let paidLateInt = 0;
  let paidCollFee = 0;
  let totalAmount = 0;
  let newRest = Math.max(0, rest - totalTree);

  if (breakdown) {
    totalLateInterest = Number(breakdown.lateInterest || 0);
    totalCollectionFee = Number(breakdown.collectionFee || 0);

    const calcAmount = passedAmount !== null && passedAmount !== undefined
      ? Number(passedAmount)
      : (payMode === 'overdue'
          ? breakdown.totalOverdue
          : payMode === 'interest'
            ? breakdown.totalInterestOnly
            : breakdown.totalMinimum);
    totalAmount = calcAmount;

    // Apply Waterfall: Collection Fee -> Late Interest -> Normal Interest -> Principal
    const wf = applyWaterfall(
      totalAmount,
      breakdown,
      breakdown.collectionFee,
      breakdown.lateInterest,
      0, // discountCollFee
      0, // discountLateInt
      0, // discountNormInt
      payMode === 'interest'
    );

    paidCollFee = wf.paidCollFee;
    paidLateInt = wf.paidLateInt;
    paidNormInt = wf.paidNormInt;
    paidPrincipal = wf.paidPrincipal;
    newRest = wf.newPrincipal;
  } else {
    selectedInstallments.forEach((inst) => {
      const details = calculateOverdueFeeDetails(inst, contract, settings);
      totalLateInterest += details.lateInterest;
      totalCollectionFee += details.collectionFee;
    });
    paidLateInt = totalLateInterest;
    paidCollFee = totalCollectionFee;
    totalAmount = totalTree + totalInterest + totalLateInterest + totalCollectionFee;
  }

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
    (a, b) => Number(a.number_pay || 0) - Number(b.number_pay || 0)
  );
  const numPayLabel = sortedInstallments.map((r) => r.number_pay).join(',');

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
  let chartUpdates = [];

  if (breakdown && payMode === 'overdue' && sortedInstallments.length > 1) {
    // Multi-row overdue distribution matching my-app - Copy
    let remainingPrincipal = paidPrincipal;
    let remainingNormInt = paidNormInt;
    let remainingLateInt = paidLateInt;
    let remainingCollFee = paidCollFee;
    const overdueFeeLimit = Math.round(totalLateInterest / Math.max(1, sortedInstallments.length));
    const overdueCollLimit = Math.round(totalCollectionFee / Math.max(1, sortedInstallments.length));

    chartUpdates = sortedInstallments.map((inst, idx) => {
      const isLast = idx === sortedInstallments.length - 1;
      const pFee2 = isLast ? remainingLateInt : Math.min(remainingLateInt, overdueFeeLimit);
      const pFee3 = isLast ? remainingCollFee : Math.min(remainingCollFee, overdueCollLimit);
      remainingLateInt -= pFee2;
      remainingCollFee -= pFee3;

      const rowInterestCap = parseFloat(inst.interest || 0);
      const pInt = isLast ? remainingNormInt : Math.min(remainingNormInt, rowInterestCap);
      remainingNormInt -= pInt;

      const targetTotal = parseFloat(contract.paypermonth || 0);
      const pTree = isLast
        ? remainingPrincipal
        : Math.min(remainingPrincipal, Math.max(0, targetTotal - pInt - pFee2 - pFee3));
      remainingPrincipal -= pTree;
      runningRest -= pTree;

      return {
        id: String(inst.ID),
        pay_date: paymentDateStr,
        reference: invoiceID,
        paytree: String(Math.round(pTree)),
        payinter: String(Math.round(pInt)),
        payfee2: String(Math.round(pFee2)),
        payfee3: String(Math.round(pFee3)),
        dis_fee2: String(Math.round(Math.max(0, overdueFeeLimit - pFee2))),
        dis_fee3: String(Math.round(Math.max(0, overdueCollLimit - pFee3))),
        resttree: String(Math.round(Math.max(0, runningRest))),
        accu: '0',
        payroute: 'เงินโอน',
        user_record: 'LINE-LIFF',
        status: 1,
      };
    });
  } else {
    // Single installment or standard waterfall on targeted installments
    let remainingNormInt = paidNormInt;
    let remainingPrincipal = paidPrincipal;

    chartUpdates = sortedInstallments.map((inst, idx) => {
      const isLast = idx === sortedInstallments.length - 1;
      const pTree = isLast ? remainingPrincipal : Math.min(remainingPrincipal, Number(inst.tree || 0));
      const pInt = isLast ? remainingNormInt : Math.min(remainingNormInt, Number(inst.interest || 0));
      remainingPrincipal -= pTree;
      remainingNormInt -= pInt;
      runningRest -= pTree;

      return {
        id: String(inst.ID),
        pay_date: paymentDateStr,
        reference: invoiceID,
        paytree: String(Math.round(pTree)),
        payinter: String(Math.round(pInt)),
        payfee2: String(Math.round(paidLateInt)),
        payfee3: String(Math.round(paidCollFee)),
        dis_fee2: String(Math.max(0, totalLateInterest - paidLateInt)),
        dis_fee3: String(Math.max(0, totalCollectionFee - paidCollFee)),
        resttree: String(Math.round(Math.max(0, runningRest))),
        accu: '0',
        payroute: 'เงินโอน',
        user_record: 'LINE-LIFF',
        status: 1,
      };
    });
  }

  // 6. Prepare Transaction Record data (matching my-app - Copy)
  const txData = {
    type: 'จ่าย',
    Timestamp: new Date().toISOString(),
    Invoice: invoiceID,
    ID_contact: contractId,
    Number_pay: numPayLabel,
    begindate: paymentDateStr,
    Number_date: String(breakdown ? (breakdown.days || '') : ''),
    details: customerName,
    type_income: `เลขที่สัญญา ${contractId}`,
    tree: String(Math.round(paidPrincipal)),
    interest: Math.round(paidNormInt),
    fee1: 0,
    fee2: Math.round(totalLateInterest),
    fee3: Math.round(totalCollectionFee),
    dis_fee2: String(Math.max(0, Math.round(totalLateInterest - paidLateInt))),
    dis_fee3: String(Math.max(0, Math.round(totalCollectionFee - paidCollFee))),
    payroute: 'เงินโอน',
    accu: '0',
    accu_discount: '0',
    rest_loan: String(Math.round(newRest)),
    due_date: nextDueDateStr,
    user_record: 'LINE-LIFF',
    income: String(Math.round(totalAmount)),
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
    paidPrincipal,
    paidNormInt,
    paidLateInt,
    paidCollFee,
    totalAmount,
  };
};
