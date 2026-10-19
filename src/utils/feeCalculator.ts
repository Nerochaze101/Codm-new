/**
 * Transaction Fee Calculator Utility
 * Handles deposit and withdrawal fee calculations, gateway cost splits, and admin earnings.
 */

export interface DepositFeeBreakdown {
  baseAmount: number;
  gatewayFee: number; // Discarded Flutterwave cost (₦10.00)
  adminFee: number;   // Added to admin dashboard balance (₦5.50)
  totalFee: number;   // Total fee added on top (₦15.50)
  totalPayable: number; // Final amount user pays (baseAmount + totalFee)
}

export interface WithdrawalFeeBreakdown {
  payoutAmount: number;
  gatewayFee: number; // Discarded Flutterwave cost (₦10.00)
  adminFee: number;   // Added to admin dashboard balance (₦40.00)
  totalFee: number;   // Total fee charged (₦50.00)
  totalDeduction: number; // Total wallet deduction (payoutAmount + totalFee)
}

/**
 * Calculate deposit fees and fund splits
 * @param requestedAmount - The target wallet funding amount in NGN
 */
export function calculateDepositFee(requestedAmount: number): DepositFeeBreakdown {
  const baseAmount = Math.max(0, requestedAmount);
  const gatewayFee = 10.00; // Discarded Flutterwave cost
  const adminFee = 5.50;    // Added to admin dashboard balance
  const totalFee = 15.50;   // Total deposit fee
  const totalPayable = baseAmount + totalFee;

  return {
    baseAmount,
    gatewayFee,
    adminFee,
    totalFee,
    totalPayable,
  };
}

/**
 * Calculate withdrawal fees and fund splits
 * @param requestedPayout - The target bank payout amount in NGN
 */
export function calculateWithdrawalFee(requestedPayout: number): WithdrawalFeeBreakdown {
  const payoutAmount = Math.max(0, requestedPayout);
  const gatewayFee = 10.00; // Discarded Flutterwave cost
  const adminFee = 40.00;   // Added to admin dashboard balance
  const totalFee = 50.00;   // Total withdrawal fee
  const totalDeduction = payoutAmount + totalFee;

  return {
    payoutAmount,
    gatewayFee,
    adminFee,
    totalFee,
    totalDeduction,
  };
}

export interface AbandonedMatchSettlementBreakdown {
  stakeAmount: number;
  platformFeeRate: number; // e.g. 0.10 (10%)
  platformFee: number;     // e.g. ₦100
  penaltyFeeRate: number;  // 0.10 (10% penalty fee)
  penaltyFee: number;      // e.g. ₦100
  totalDeduction: number;  // platformFee + penaltyFee
  refundPerPlayer: number; // stakeAmount - totalDeduction
}

/**
 * Calculate abandoned match settlement, refund, and fee deductions
 * Refunds player stake minus platform fee plus 10% penalty fee
 */
export function calculateAbandonedMatchRefund(
  stakeAmount: number,
  platformFeePercentage: number = 10
): AbandonedMatchSettlementBreakdown {
  const stake = Math.max(0, stakeAmount);
  const platformFeeRate = (platformFeePercentage || 10) / 100;
  const platformFee = Math.round(stake * platformFeeRate);
  const penaltyFeeRate = 0.10; // 10% penalty fee for abandoned/stalled matches
  const penaltyFee = Math.round(stake * penaltyFeeRate);
  const totalDeduction = platformFee + penaltyFee;
  const refundPerPlayer = Math.max(0, stake - totalDeduction);

  return {
    stakeAmount: stake,
    platformFeeRate,
    platformFee,
    penaltyFeeRate,
    penaltyFee,
    totalDeduction,
    refundPerPlayer,
  };
}
