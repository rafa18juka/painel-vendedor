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
  for (const tier of cfg.ml_bonus.tiers) {
    if (count >= tier.min && count <= tier.max) {
      return tier.value;
    }
  }
  return 0;
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
