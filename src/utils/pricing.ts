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

/**
 * Solo 1v1 Rake Percentage (Default 10%, tiered down for high-stakes)
 */
export function getRakePercentage(totalPotAmount: number): number {
  return getSoloRakePercentage(totalPotAmount);
}

export function getSoloRakePercentage(totalPotAmount: number, baseRate: number = 10): number {
  if (totalPotAmount >= 100000) return Math.min(baseRate / 100, 0.035); // 3.5% for High-Roller Pots (₦100,000+)
  if (totalPotAmount >= 50000) return Math.min(baseRate / 100, 0.04);   // 4% for Large Pots (₦50,000+)
  if (totalPotAmount >= 10000) return Math.min(baseRate / 100, 0.05);   // 5% for Medium Pots (₦10,000+)
  if (totalPotAmount >= 5000) return Math.min(baseRate / 100, 0.07);    // 7% for ₦5,000+ pots
  if (totalPotAmount >= 2500) return Math.min(baseRate / 100, 0.08);    // 8% for ₦2,500+ pots
  return baseRate / 100;                                                // 10% for Micro-Wagers (< ₦2,500)
}

/**
 * 5v5 Squad ("Squared") Platform Fee (Special 5% reduced rate vs 1v1)
 * Squad matches aggregate 10 players, so a lower platform fee % is charged
 * to reward organized clan warfare and maximize individual squad member winnings!
 */
export function getSquadRakePercentage(
  _stakePerPlayer: number,
  totalPotAmount: number,
  baseSquadRate: number = 5
): number {
  if (totalPotAmount >= 100000) return Math.min(baseSquadRate / 100, 0.03); // 3.0% for Mega Squad Tournaments
  if (totalPotAmount >= 50000) return Math.min(baseSquadRate / 100, 0.035); // 3.5% for ₦50,000+ Squad Pots
  if (totalPotAmount >= 25000) return Math.min(baseSquadRate / 100, 0.04);  // 4% for ₦25,000+ Squad Pots
  return baseSquadRate / 100;                                               // Default 5% Squad Fee
}

export function calculateMatchEconomics(stakeAmount: number, customFeePercent?: number) {
  const potAmount = Math.max(0, stakeAmount) * 2;
  const rakeRate = customFeePercent !== undefined
    ? customFeePercent / 100
    : getSoloRakePercentage(potAmount);
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

/**
 * Squad Economics: Calculates exact pot, distinct squad fee, and per-winner payout
 * For 5v5 Squad: 10 players stake, 5 players on winning squad split net pool equally.
 */
export function calculateSquadEconomics(
  stakePerPlayer: number,
  playersPerTeam: number = 5,
  squadFeePercent: number = 5
) {
  const totalPlayers = playersPerTeam * 2; // e.g., 10 players for 5v5
  const totalPot = Math.max(0, stakePerPlayer) * totalPlayers; // e.g., ₦1,000 * 10 = ₦10,000
  const rakeRate = getSquadRakePercentage(stakePerPlayer, totalPot, squadFeePercent); // 5% default squad fee
  const platformFee = Math.round(totalPot * rakeRate); // ₦500 on ₦10,000 pot
  const netWinningPool = totalPot - platformFee; // ₦9,500
  const payoutPerPlayer = Math.floor(netWinningPool / playersPerTeam); // ₦1,900 per player
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


