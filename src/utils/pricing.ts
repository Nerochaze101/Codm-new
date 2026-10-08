export interface TieredRakeItem {
  stake: number;
  pot: number;
  rakePercent: number;
  rakePercentFormatted: string;
  platformFee: number;
  winnerPayout: number;
  paystackCostEstimate: string;
  netPlatformProfit: number;
}

export const TIERED_COMMISSION_SCHEDULE: TieredRakeItem[] = [
  {
    stake: 1000,
    pot: 2000,
    rakePercent: 0.10,
    rakePercentFormatted: '10%',
    platformFee: 200,
    winnerPayout: 1800,
    paystackCostEstimate: '~₦40',
    netPlatformProfit: 160,
  },
  {
    stake: 2500,
    pot: 5000,
    rakePercent: 0.08,
    rakePercentFormatted: '8%',
    platformFee: 400,
    winnerPayout: 4600,
    paystackCostEstimate: '~₦235',
    netPlatformProfit: 165,
  },
  {
    stake: 5000,
    pot: 10000,
    rakePercent: 0.07,
    rakePercentFormatted: '7%',
    platformFee: 700,
    winnerPayout: 9300,
    paystackCostEstimate: '~₦375',
    netPlatformProfit: 325,
  },
  {
    stake: 10000,
    pot: 20000,
    rakePercent: 0.05,
    rakePercentFormatted: '5%',
    platformFee: 1000,
    winnerPayout: 19000,
    paystackCostEstimate: '~₦525',
    netPlatformProfit: 475,
  },
];

export function getRakePercentage(stakeAmount: number): number {
  if (stakeAmount >= 10000) return 0.05; // 5% for ₦10,000+
  if (stakeAmount >= 5000) return 0.07;  // 7% for ₦5,000
  if (stakeAmount >= 2500) return 0.08;  // 8% for ₦2,500
  return 0.10;                     // 10% for ₦1,000
}

export function calculateMatchEconomics(stakeAmount: number) {
  const potAmount = Math.max(0, stakeAmount) * 2;
  const rakeRate = getRakePercentage(stakeAmount);
  const platformFee = Math.round(potAmount * rakeRate);
  const winnerPayout = potAmount - platformFee;
  const rakePercentFormatted = `${Math.round(rakeRate * 100)}%`;

  return {
    stakeAmount,
    potAmount,
    rakeRate,
    rakePercentFormatted,
    platformFee,
    winnerPayout,
  };
}
