import { Config } from '../types';

export function calcCommissionForSale(cfg: Config, saleNet: number, sellerUid: string, team: { coordinatorId: string; sellers: string[] }) {
  const { coordinatorId, sellers } = team;
  const isCoord = sellerUid === coordinatorId;
  const isSeller = sellers.includes(sellerUid);

  const amounts: Record<string, number> = {};

  if (isSeller) {
    amounts[sellerUid] = cfg.commissions.seller_own * saleNet;
    amounts[coordinatorId] = (amounts[coordinatorId] ?? 0) + cfg.commissions.coord_own * saleNet;
  } else if (isCoord) {
    amounts[coordinatorId] = cfg.commissions.coord_own * saleNet;
    for (const uid of sellers) {
      amounts[uid] = (amounts[uid] ?? 0) + cfg.commissions.seller_over_coord * saleNet;
    }
  }

  return amounts;
}

export function getServiceRate(cfg: Config, kind: 'capa' | 'impermeabilizacao', adesaoGlobal: number) {
  const tiers = cfg.services[kind];
  const base = cfg.services.base_min;
  let rate = base;
  for (const tier of tiers) {
    if (adesaoGlobal > tier.minAdesao) {
      rate = Math.max(rate, tier.rate);
    }
  }
  return rate;
}

export function calcMlWeeklyBonus(cfg: Config, count: number) {
  const tiersSource = cfg.ml_bonus?.tiers as unknown;
  const rawTiers = Array.isArray(tiersSource) ? tiersSource : tiersSource ? Object.values(tiersSource as Record<string, unknown>) : [];

  const fallbackTiers = [
    { min: 30, max: 39, value: 20 },
    { min: 40, max: 49, value: 40 },
    { min: 50, max: null, value: 60 }
  ];

  const tiers = rawTiers.length > 0 ? rawTiers : fallbackTiers;

  const toNumber = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[^0-9.,-]/g, '').replace(',', '.').trim();
      if (cleaned.length === 0) return null;
      const parsed = Number(cleaned);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  };

  let bonus = 0;

  for (const rawTier of tiers) {
    if (!rawTier || typeof rawTier !== 'object') continue;
    const tier = rawTier as Record<string, unknown>;
    const min = toNumber(tier.min);
    const max = toNumber(tier.max);
    const value = toNumber(tier.value);

    if (min === null || value === null) continue;
    if (count < min) continue;
    if (max !== null && count > max) continue;

    bonus = Math.max(bonus, value);
  }

  if (bonus === 0 && count > 0) {
    for (const tier of fallbackTiers) {
      if (count >= tier.min && (tier.max === null || count <= tier.max)) {
        bonus = Math.max(bonus, tier.value);
      }
    }
  }

  return bonus;
}

export function getFaturamentoRate(cfg: Config, total: number) {
  let rate = 0;
  for (const tier of cfg.faturamento_bonus) {
    if (total >= tier.min) {
      rate = Math.max(rate, tier.rate);
    }
  }
  return rate;
}
