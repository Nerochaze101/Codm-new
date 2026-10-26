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
    stake: 100,
    pot: 200,
    rakePercent: 0.10,
    rakePercentFormatted: '10%',
    platformFee: 20,
    winnerPayout: 180,
    paystackCostEstimate: '~₦3',
    netPlatformProfit: 17,
  },
  {
    stake: 500,
    pot: 1000,
    rakePercent: 0.10,
    rakePercentFormatted: '10%',
    platformFee: 100,
    winnerPayout: 900,
    paystackCostEstimate: '~₦15',
    netPlatformProfit: 85,
  },
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

export function getRakePercentage(totalPotAmount: number): number {
  if (totalPotAmount >= 100000) return 0.035; // 3.5% for High-Roller Pots (₦100,000+)
  if (totalPotAmount >= 50000) return 0.04;   // 4% for Large Pots (₦50,000+)
  if (totalPotAmount >= 10000) return 0.05;   // 5% for Medium Pots (₦10,000+)
  if (totalPotAmount >= 5000) return 0.07;    // 7% for ₦5,000+ pots
  if (totalPotAmount >= 2500) return 0.08;    // 8% for ₦2,500+ pots
  return 0.10;                                // 10% for Micro-Wagers (< ₦2,500)
}

export function calculateMatchEconomics(stakeAmount: number) {
  const potAmount = Math.max(0, stakeAmount) * 2;
  const rakeRate = getRakePercentage(potAmount);
  const platformFee = Math.round(potAmount * rakeRate);
  const winnerPayout = potAmount - platformFee;
  const rakePercentFormatted = `${(rakeRate * 100).toFixed(rakeRate < 0.05 ? 1 : 0)}%`;

  return {
    stakeAmount,
    potAmount,
    rakeRate,
    rakePercentFormatted,
    platformFee,
    winnerPayout,
  };
}


export function calculateSquadEconomics(stakePerPlayer: number, playersPerTeam: number = 5) {
  const totalPlayers = playersPerTeam * 2; // e.g., 10 players for 5v5
  const totalPot = Math.max(0, stakePerPlayer) * totalPlayers; // e.g., ₦1,000 * 10 = ₦10,000
  const rakeRate = getRakePercentage(totalPot); // e.g., 8% for ₦10,000 pot
  const platformFee = Math.round(totalPot * rakeRate); // ₦800
  const netWinningPool = totalPot - platformFee; // ₦9,200
  const payoutPerPlayer = Math.floor(netWinningPool / playersPerTeam); // ₦1,840 per player
  const rakePercentFormatted = `${(rakeRate * 100).toFixed(rakeRate < 0.05 ? 1 : 0)}%`;

  return {
    stakePerPlayer,
    playersPerTeam,
    totalPlayers,
    totalPot,
    rakeRate,
    rakePercentFormatted,
    platformFee,
    netWinningPool,
    payoutPerPlayer,
  };
}

