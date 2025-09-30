export type Role = 'admin' | 'coordenadora' | 'vendedora';

export interface Config {
  team: { coordinatorId: string; sellers: string[] };
  commissions: {
    seller_own: number;
    seller_over_coord: number;
    coord_own: number;
    coord_over_seller: number;
  };
  services: {
    base_min: number;
    impermeabilizacao: { minAdesao: number; rate: number }[];
    capa: { minAdesao: number; rate: number }[];
  };
  ml_bonus: { tiers: { min: number; max: number; value: number }[] };
  faturamento_bonus: { min: number; rate: number }[];
  instagram: {
    postsPerDay: number;
    storiesPerDay: number;
    weekdays: { start: string; end: string };
    saturday: { start: string; end: string };
  };
  timezone: string;
  pontualidade_default: number;
}

export type SaleStatus = 'entrada' | 'frete' | 'pendente' | 'concluida';

export interface Sale {
  date: string;
  client: string;
  net: number;
  gross: number;
  services?: { capa?: number; impermeabilizacao?: number };
  sellerUid: string;
  orderId?: string;
  serviceOnly?: boolean;
  status?: SaleStatus;
  createdAt?: string;
}

export interface IGTrackingDay {
  posts: number;
  stories: number;
  times?: string[];
}

export interface MlLinkItem {
  url: string;
  ts: number;
}

export interface AppUser {
  uid: string;
  name: string;
  role: Role;
  email?: string;
}


export interface TemplateEntry {
  id: string;
  name: string;
  content: string;
}

export interface TemplateCategory {
  id: string;
  name: string;
  templates: TemplateEntry[];
}

export interface StickyNote {
  id: string;
  text: string;
  color: string;
  date?: string;
  createdAt?: string;
}

export interface OrderNote {
  id: string;
  saleId: string;
  month: string;
  text: string;
  createdAt: string;
}

export interface PendencyItem {
  id: string;
  saleId: string;
  month: string;
  text: string;
  color: string;
  createdAt: string;
}
