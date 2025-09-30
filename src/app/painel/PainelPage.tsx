import { useCallback, useEffect, useMemo, useRef, useState, ChangeEvent } from "react";



import { useForm } from "react-hook-form";



import { z } from "zod";



import { zodResolver } from "@hookform/resolvers/zod";



import { format } from "date-fns";



import confetti from "canvas-confetti";



import { toast } from "sonner";



import { useAuth } from "../../hooks/useAuth";



import {



  Config,



  Sale,



  SaleStatus,



  TemplateEntry,



  TemplateCategory,



  StickyNote,



  OrderNote,



  PendencyItem



} from "../../types";



import { getConfig } from "../../services/config";



import { addSale, deleteSale, getSalesByUserMonth, updateSale, type SaleRecord } from "../../services/sales";



import { getClosure, type ClosurePayload } from "../../services/closures";



import { getIGDay, incrementIG } from "../../services/ig";



import { addMlLink, getMlLinks } from "../../services/ml";



import { calcCommissionForSale, calcMlWeeklyBonus } from "../../lib/calc";



import { formatDate, getNow, getWeekKey } from "../../lib/time";



import { ls } from "../../lib/storage";



import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";



import { Button } from "../../components/ui/button";



import { Input } from "../../components/ui/input";



import { Textarea } from "../../components/ui/textarea";



import { Badge } from "../../components/ui/badge";



import { Progress } from "../../components/ui/progress";



import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";



import { Copy, LogOut, PlusCircle, Sparkles, ChevronsDownUp, Pencil, Trash2, Tag, Plus } from "lucide-react";



import { useNavigate } from "react-router-dom";



import { cn } from "../../utils/cn";



import { noteBgUrl } from "../../utils/note-bg";







const DEFAULT_QUICK_FIELDS: Record<string, string> = {



  cliente: "",



  modelo: "",



  valor_avista: "",



  valor_parcelado: "",



  frete: "",



  prazo: ""



};







const PLACEHOLDER_FALLBACK = Object.keys(DEFAULT_QUICK_FIELDS);







type TemplateUiState = {



  activeCategoryId: string;



  collapsedTemplates: Record<string, boolean>;



};







const DEFAULT_TEMPLATE_STATE: TemplateUiState = {



  activeCategoryId: '',



  collapsedTemplates: {}



};







const NOTE_COLORS = ["yellow", "pink", "blue", "green", "red"];



const PENDENCY_COLORS = ["#FECACA", "#FDE68A", "#BFDBFE", "#C4B5FD", "#FBCFE8", "#D9F99D", "#A5F3FC", "#FDBA74", "#FED7AA", "#F3F4F6"];







const SALE_STATUS_META: Record<SaleStatus, { label: string; className: string }> = {



  entrada: { label: "Entrada paga", className: "border-red-200 bg-red-50 text-red-700" },



  frete: { label: "Sofa pago, falta frete", className: "border-yellow-200 bg-yellow-50 text-yellow-700" },



  pendente: { label: "Pendente de pagamento/entrega", className: "border-sky-200 bg-sky-50 text-sky-700" },



  concluida: { label: "Pago e entregue", className: "border-green-200 bg-green-50 text-green-700" }



};







const ML_DAILY_TARGET = 6;



const ML_MEDIUM_THRESHOLD = 8;



const ML_IDEAL_THRESHOLD = 10;

const ORDER_NOTE_THEMES = ['fundonotasazul', 'fundonotaslaranja', 'fundonotasrosa', 'fundonotasverde', 'fundonotasverdinho'] as const;







function createId(prefix: string) {

  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {

    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

  }

  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

}







function sortSales(entries: SaleRecord[]): SaleRecord[] {



  return [...entries].sort((a, b) => {



    const diff = new Date(b.date).getTime() - new Date(a.date).getTime();



    if (diff !== 0) return diff;



    return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");



  });



}







function normalizeTemplateCategories(raw: unknown): TemplateCategory[] {



  const makeDefault = () => [



    { id: createId("cat"), name: "Atendimento", templates: [] },



    { id: createId("cat"), name: "Instagram", templates: [] }



  ];







  if (!Array.isArray(raw)) {



    return makeDefault();



  }







  if (raw.every((item) => item && typeof item === "object" && "templates" in item)) {



    return (raw as TemplateCategory[]).map((category) => ({



      ...category,



      templates: (category.templates ?? []).map((tpl) => ({



        id: tpl.id ?? createId("tpl"),



        name: tpl.name ?? "Sem titulo",



        content: tpl.content ?? ""



      }))



    }));



  }







  if (raw.every((item) => item && typeof item === "object" && "content" in item)) {



    return [



      {



        id: createId("cat"),



        name: "Atendimento",



        templates: (raw as TemplateEntry[]).map((tpl) => ({



          id: tpl.id ?? createId("tpl"),



          name: tpl.name ?? "Template",



          content: tpl.content ?? ""



        }))



      },



      { id: createId("cat"), name: "Instagram", templates: [] }



    ];



  }







  return makeDefault();



}







function collectTemplateIds(categories: TemplateCategory[]): Set<string> {



  return new Set(categories.flatMap((category) => category.templates.map((tpl) => tpl.id)));



}







function pruneCollapsedMap(collapsed: Record<string, boolean> | undefined, categories: TemplateCategory[]): Record<string, boolean> {



  const ids = collectTemplateIds(categories);



  const source = collapsed ?? {};



  return Object.entries(source).reduce<Record<string, boolean>>((acc, [id, value]) => {



    if (ids.has(id)) {



      acc[id] = value;



    }



    return acc;



  }, {});



}







function normalizeOrderNotes(raw: unknown, defaultMonth: string): OrderNote[] {
  if (Array.isArray(raw)) {
    return (raw as (OrderNote & { color?: string; theme?: string })[]).map((note) => ({
      ...note,
      id: note.id ?? createId("note"),
      saleId: note.saleId ?? "",
      month: note.month ?? defaultMonth,
      text: note.text ?? "",
      createdAt: note.createdAt ?? new Date().toISOString()
    }));
  }
  if (raw && typeof raw === "object") {
    return Object.entries(raw as Record<string, string>).map(([key, value]) => ({
      id: createId("note"),
      saleId: "",
      month: defaultMonth,
      text: `${key}: ${value}`,
      createdAt: new Date().toISOString()
    }));
  }
  return [];
}














function normalizePendencias(raw: unknown, defaultMonth: string): PendencyItem[] {



  if (Array.isArray(raw)) {



    return (raw as (string | PendencyItem)[]).map((item) =>



      typeof item === "string"



        ? {



            id: createId("todo"),



            saleId: "",



            text: item,



            color: PENDENCY_COLORS[0],



            month: defaultMonth,



            createdAt: new Date().toISOString()



          }



        : {



            id: item.id ?? createId("todo"),



            saleId: item.saleId ?? "",



            text: item.text ?? "",



            color: item.color ?? PENDENCY_COLORS[0],



            month: item.month ?? defaultMonth,



            createdAt: item.createdAt ?? new Date().toISOString()



          }



    );



  }







  return [];



}









function normalizeCurrencyInput(value: unknown, emptyValue: number | undefined = 0) {

  if (value === undefined || value === null) {

    return emptyValue;

  }



  if (typeof value === "number") {

    return Number.isFinite(value) ? value : null;

  }



  if (typeof value !== "string") {

    return null;

  }



  const trimmed = value.trim();



  if (!trimmed) {

    return emptyValue;

  }



  let normalized = trimmed.replace(/\s/g, "");

  const hasComma = normalized.includes(",");

  const hasDot = normalized.includes(".");



  if (hasComma && hasDot) {

    normalized = normalized.replace(/\./g, "").replace(",", ".");

  } else if (hasComma) {

    normalized = normalized.replace(",", ".");

  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(normalized)) {

    normalized = normalized.replace(/\./g, "");

  }



  const parsed = Number(normalized);



  if (!Number.isFinite(parsed)) {

    return null;

  }



  return parsed;

}



function toCurrencyNumber(value: unknown) {

  const parsed = normalizeCurrencyInput(value, 0);

  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;

}



const currencyField = (invalidMessage: string) =>

  z.preprocess(

    (value) => normalizeCurrencyInput(value),

    z

      .number({ invalid_type_error: invalidMessage })

      .min(0, "Valor nao pode ser negativo")

  );



const optionalCurrencyField = z.preprocess(

  (value) => normalizeCurrencyInput(value, undefined),

  z.number().min(0).optional()

);



const saleSchema = z

  .object({

    date: z.string().nonempty("Informe a data"),

    client: z.string().min(2, "Informe o nome da cliente"),

    orderId: z.string().min(1, "Informe o numero do pedido"),

    net: currencyField("Informe o valor liquido"),

    gross: currencyField("Informe o valor bruto"),

    capa: optionalCurrencyField,

    impermeabilizacao: optionalCurrencyField

  })

  .superRefine((data, ctx) => {

    const serviceOnly = data.orderId.trim().endsWith('#');

    const totalServicos = (data.capa ?? 0) + (data.impermeabilizacao ?? 0);



    if (!serviceOnly) {

      if (data.net <= 0) {

        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['net'], message: 'Informe o valor liquido.' });

      }



      if (data.gross <= 0) {

        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['gross'], message: 'Informe o valor bruto.' });

      }



    } else if (totalServicos <= 0) {

      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['capa'], message: 'Para pedidos com # informe capa ou impermeabilizacao.' });

    }



  });

type SaleForm = z.infer<typeof saleSchema>;







const noteDefaults: StickyNote[] = [];



export function PainelPage() {



  const { user, logout } = useAuth();



  const storageUid = user?.uid ?? 'anon';



  const navigate = useNavigate();



  const [config, setConfig] = useState<Config | null>(null);



  const [salesMap, setSalesMap] = useState<Record<string, SaleRecord[]>>({});
  const [sharedSalesMap, setSharedSalesMap] = useState<Record<string, SaleRecord[]>>({});
  const [closureMap, setClosureMap] = useState<Record<string, ClosurePayload | null>>({});



  const [ig, setIg] = useState({ posts: 0, stories: 0 });



  const [mlLinks, setMlLinks] = useState<{ url: string; ts: number }[]>([]);



  const [templateCategories, setTemplateCategories] = useState<TemplateCategory[]>([]);



  const [activeCategoryId, setActiveCategoryId] = useState<string>('');



  const [quickFields, setQuickFields] = useState<Record<string, string>>(DEFAULT_QUICK_FIELDS);



  const [orderNotes, setOrderNotes] = useState<OrderNote[]>([]);



  const [pendencias, setPendencias] = useState<PendencyItem[]>([]);



  const [personalNotes, setPersonalNotes] = useState<StickyNote[]>(noteDefaults);



  const [mlUrl, setMlUrl] = useState('');



  const [loadingConfig, setLoadingConfig] = useState(true);



  const [editingSale, setEditingSale] = useState<{ month: string; sale: SaleRecord } | null>(null);



  const [personalTarget, setPersonalTarget] = useState(() => {



    if (typeof window === 'undefined') return 50000;



    const stored = window.localStorage.getItem('meta_pessoal');



    const parsed = stored ? Number(stored) : NaN;



    return Number.isFinite(parsed) && parsed >= 50000 ? parsed : 50000;



  });



  const [activeTab, setActiveTab] = useState<'overview' | 'tools'>('overview');



  const [collapsedTemplates, setCollapsedTemplates] = useState<Record<string, boolean>>({});



  const [hydratedUid, setHydratedUid] = useState<string | null>(null);



  const storageUidRef = useRef(storageUid);



  const today = formatDate(getNow(), 'yyyy-MM-dd');



  const currentMonth = today.slice(0, 7);



  const currentWeek = getWeekKey(getNow());







  const saleForm = useForm<SaleForm>({



    resolver: zodResolver(saleSchema),



    defaultValues: { date: today, client: '', orderId: '', net: 0, gross: 0, capa: 0, impermeabilizacao: 0 }



  });







  useEffect(() => {



    storageUidRef.current = storageUid;

    setHydratedUid(null);



    const templates = normalizeTemplateCategories(ls.getUserScoped('templates_user', storageUid, []));



    setTemplateCategories(templates);



    const storedTemplateState = ls.getUserScoped('templates_state_user', storageUid, DEFAULT_TEMPLATE_STATE);

    const firstCategoryId = templates[0]?.id ?? '';

    const nextActiveCategoryId = templates.some((category) => category.id === storedTemplateState.activeCategoryId)

      ? storedTemplateState.activeCategoryId

      : firstCategoryId;



    setActiveCategoryId(nextActiveCategoryId);

    setCollapsedTemplates(pruneCollapsedMap(storedTemplateState.collapsedTemplates, templates));



    const storedQuick = ls.getUserScoped('quickfields_user', storageUid, DEFAULT_QUICK_FIELDS);



    setQuickFields({ ...DEFAULT_QUICK_FIELDS, ...storedQuick });







    const notes = normalizeOrderNotes(ls.getUserScoped('notas_user', storageUid, []), currentMonth);



    setOrderNotes(notes);







    const pend = normalizePendencias(ls.getUserScoped('pendencias_user', storageUid, []), currentMonth);



    setPendencias(pend);







    setPersonalNotes(ls.getUserScoped('sticky_user', storageUid, []));



    setHydratedUid(storageUid);



  }, [storageUid, currentMonth]);







  useEffect(() => {



    storageUidRef.current = storageUid;



  }, [storageUid]);







  useEffect(() => {



    if (hydratedUid !== storageUidRef.current) return;



    ls.setUserScoped('templates_user', storageUidRef.current, templateCategories);



  }, [templateCategories, hydratedUid]);







  useEffect(() => {



    if (hydratedUid !== storageUidRef.current) return;



    const persistedActiveId = templateCategories.some((category) => category.id === activeCategoryId)

      ? activeCategoryId

      : templateCategories[0]?.id ?? '';



    const persistedCollapsed = pruneCollapsedMap(collapsedTemplates, templateCategories);



    ls.setUserScoped('templates_state_user', storageUidRef.current, {

      activeCategoryId: persistedActiveId,

      collapsedTemplates: persistedCollapsed

    });



  }, [activeCategoryId, collapsedTemplates, templateCategories, hydratedUid]);







  useEffect(() => {



    if (hydratedUid !== storageUidRef.current) return;



    ls.setUserScoped('quickfields_user', storageUidRef.current, quickFields);



  }, [quickFields, hydratedUid]);







  useEffect(() => {



    if (hydratedUid !== storageUidRef.current) return;



    ls.setUserScoped('notas_user', storageUidRef.current, orderNotes);



  }, [orderNotes, hydratedUid]);







  useEffect(() => {



    if (hydratedUid !== storageUidRef.current) return;



    ls.setUserScoped('pendencias_user', storageUidRef.current, pendencias);



  }, [pendencias, hydratedUid]);







  useEffect(() => {



    if (hydratedUid !== storageUidRef.current) return;



    ls.setUserScoped('sticky_user', storageUidRef.current, personalNotes);



  }, [personalNotes, hydratedUid]);







  useEffect(() => {



    if (typeof window === 'undefined') return;



    window.localStorage.setItem('meta_pessoal', String(personalTarget));



  }, [personalTarget]);







  useEffect(() => {



    async function load() {



      if (!user) return;



      setLoadingConfig(true);



      try {



        const [cfg, sales, igDay, links, closure] = await Promise.all([



          getConfig(),



          getSalesByUserMonth(user.uid, currentMonth),



          getIGDay(user.uid, today),



          getMlLinks(user.uid),



          getClosure(currentMonth)



        ]);



        setConfig(cfg);



        setSalesMap((prev) => ({ ...prev, [currentMonth]: sortSales(sales) }));



        setClosureMap((prev) => ({ ...prev, [currentMonth]: closure ?? null }));



        setIg(igDay ?? { posts: 0, stories: 0 });



        setMlLinks((links ?? []).map((link) => ({ url: link.url, ts: link.ts })));



      } catch (error) {



        console.error(error);



        toast.error('Falha ao carregar dados.');



      } finally {



        setLoadingConfig(false);



      }



    }



    load();



  }, [user?.uid, currentMonth, today]);







  const relatedUids = useMemo(() => {
    if (!config || !user) return [] as string[];
    const { coordinatorId, sellers } = config.team;
    if (user.uid === coordinatorId) {
      return Array.from(new Set(sellers.filter((uid) => uid && uid !== user.uid)));
    }
    if (sellers.includes(user.uid)) {
      if (!coordinatorId || coordinatorId === user.uid) return [] as string[];
      return [coordinatorId];
    }
    return [];
  }, [config, user?.uid]);

  useEffect(() => {
    if (!config || !user) return;
    if (relatedUids.length === 0) {
      setSharedSalesMap((prev) => {
        if (!prev[currentMonth]) return prev;
        const next = { ...prev };
        delete next[currentMonth];
        return next;
      });
      return;
    }

    let active = true;

    (async () => {
      try {
        const entries = await Promise.all(
          relatedUids.map(async (uid) => {
            const list = await getSalesByUserMonth(uid, currentMonth);
            return list.map((sale) => ({ ...sale, sellerUid: sale.sellerUid ?? uid })) as SaleRecord[];
          })
        );
        if (!active) return;
        setSharedSalesMap((prev) => ({ ...prev, [currentMonth]: entries.flat() }));
      } catch (error) {
        console.error(error);
      }
    })();

    return () => {
      active = false;
    };
  }, [config, user?.uid, currentMonth, relatedUids]);



  const currentSales = useMemo(() => salesMap[currentMonth] ?? [], [salesMap, currentMonth]);



  const productSales = useMemo(() => currentSales.filter((sale) => !sale.serviceOnly), [currentSales]);



  const { net: netTotal, gross: grossTotal } = useMemo(() => {

    return productSales.reduce(

      (totals, sale) => {

        const serviceAmount = toCurrencyNumber(sale.services?.capa) + toCurrencyNumber(sale.services?.impermeabilizacao);

        const gross = toCurrencyNumber(sale.gross ?? sale.net ?? 0);

        const net = toCurrencyNumber(sale.net ?? gross);

        const grossWithoutServices = gross > serviceAmount ? gross - serviceAmount : gross;

        const netWithoutServices = net > serviceAmount ? net - serviceAmount : net;

        totals.net += netWithoutServices;

        totals.gross += grossWithoutServices;

        return totals;

      },

      { net: 0, gross: 0 }

    );

  }, [productSales]);



  const serviceTotals = useMemo(() => currentSales.reduce((totals, sale) => {

    const capa = toCurrencyNumber(sale.services?.capa);

    const impermeabilizacao = toCurrencyNumber(sale.services?.impermeabilizacao);

    const recordedServices = capa + impermeabilizacao;

    const serviceTotal = sale.serviceOnly

      ? Math.max(recordedServices, toCurrencyNumber(sale.net ?? sale.gross ?? 0))

      : recordedServices;



    return {

      total: totals.total + serviceTotal,

      capa: totals.capa + capa,

      impermeabilizacao: totals.impermeabilizacao + impermeabilizacao

    };

  }, { total: 0, capa: 0, impermeabilizacao: 0 }), [currentSales]);



  const closureInfo = closureMap[currentMonth];


  const closurePontualidade = user ? closureInfo?.pontualidade?.[user.uid] : undefined;


  const closureMlBonus = user ? closureInfo?.mlWeeks?.[user.uid] : undefined;


  const closureExtrasTotal = user ? closureInfo?.bonus?.[user.uid] : undefined;


  const closureFinalized = closureExtrasTotal != null;


  const adesaoCapa = closureInfo?.adesao?.capa;


  const adesaoImper = closureInfo?.adesao?.impermeabilizacao;


  const serviceBonus = useMemo(() => {



    if (!config) return 0;



    const baseRate = config.services?.base_min ?? 0;



    const capaRate = typeof adesaoCapa === 'number' && adesaoCapa > 0 ? adesaoCapa : baseRate;



    const imperRate = typeof adesaoImper === 'number' && adesaoImper > 0 ? adesaoImper : baseRate;



    const capaCommission = serviceTotals.capa * capaRate;



    const imperCommission = serviceTotals.impermeabilizacao * imperRate;



    const otherServices = Math.max(serviceTotals.total - serviceTotals.capa - serviceTotals.impermeabilizacao, 0);



    const otherRate = Math.max(baseRate, capaRate, imperRate);



    const otherCommission = otherServices * otherRate;



    return capaCommission + imperCommission + otherCommission;



  }, [config, adesaoCapa, adesaoImper, serviceTotals.total, serviceTotals.capa, serviceTotals.impermeabilizacao]);



  const faturamentoBonus =

    closureExtrasTotal != null

      ? Math.max(closureExtrasTotal - (closurePontualidade ?? 0) - (closureMlBonus ?? 0), 0)

      : 0;



  const attendanceBonus = closurePontualidade ?? config?.pontualidade_default ?? 0;



  const orderCount = productSales.length;



  const monthlyTarget = Math.max(50000, personalTarget);



  const monthlyProgress = monthlyTarget > 0 ? Math.min(100, Math.round((grossTotal / monthlyTarget) * 100)) : 0;








  const commissionTotal = useMemo(() => {



    if (!config || !user) return 0;



    const combined = [...currentSales, ...(sharedSalesMap[currentMonth] ?? [])];



    if (combined.length === 0) return 0;



    const seen = new Set<string>();



    return combined.reduce((acc, sale) => {



      const seller = sale.sellerUid ?? '';



      if (!seller) return acc;



      const key = `${seller}:${sale.id ?? sale.orderId ?? sale.date}`;



      if (seen.has(key)) return acc;



      seen.add(key);



      const map = calcCommissionForSale(config, sale.net, seller, config.team);



      return acc + (map[user.uid] ?? 0);



    }, 0);



  }, [config, user?.uid, currentSales, sharedSalesMap, currentMonth]);







  const mlBonus = useMemo(() => {



    if (!config) return 0;



    if (closureFinalized && closureMlBonus != null && closureMlBonus > 0) return closureMlBonus;



    const fallback = mlLinks.length >= 50 ? 60 : mlLinks.length >= 40 ? 40 : mlLinks.length >= 30 ? 20 : 0;



    const configured = calcMlWeeklyBonus(config, mlLinks.length);



    return Math.max(configured, fallback);



  }, [closureFinalized, closureMlBonus, config, mlLinks.length]);

  const extrasTotal = useMemo(
    () => serviceBonus + mlBonus + attendanceBonus + faturamentoBonus,
    [serviceBonus, mlBonus, attendanceBonus, faturamentoBonus]
  );



  const totalWithExtras = commissionTotal + extrasTotal;









  

function getMlDisplayTitle(url: string) {



  try {



    const { pathname } = new URL(url);



    const segments = pathname.split('/').filter(Boolean);



    const last = segments[segments.length - 1] ?? url;



    const decoded = decodeURIComponent(last);



    const withoutSuffix = decoded.replace(/[-_]?_[A-Z]{2}$/i, '');



    const withoutCodes = withoutSuffix



      .replace(/^[A-Z]{3}-\d+-/i, '')



      .replace(/^\d+-/, '');



    const sanitized = withoutCodes.replace(/[^a-z0-9-]+/gi, '-');



    const normalized = sanitized.replace(/-+/g, '-').replace(/^-|-$/g, '');



    return normalized || withoutSuffix || url;



  } catch (error) {



    return url;



  }



}



const mlTodayCount = useMemo(() => {



    return mlLinks.reduce((total, link) => {



      const day = format(new Date(link.ts), 'yyyy-MM-dd');



      return day === today ? total + 1 : total;



    }, 0);



  }, [mlLinks, today]);







  const igProgress = useMemo(() => {



    if (!config) return 0;



    const postPct = Math.min(ig.posts / config.instagram.postsPerDay, 1);



    const storiesPct = Math.min(ig.stories / config.instagram.storiesPerDay, 1);



    return Math.round(((postPct + storiesPct) / 2) * 100);



  }, [config, ig]);







  const mlProgress = useMemo(() => Math.min(100, Math.round((mlTodayCount / ML_DAILY_TARGET) * 100)), [mlTodayCount]);



  const progressAverage = Math.round(igProgress * 0.7 + mlProgress * 0.3);



  const [progressFlags, setProgressFlags] = useState({ half: false, full: false });







  useEffect(() => {



    if (progressAverage >= 100 && !progressFlags.full) {



      confetti({ particleCount: 100, spread: 70, origin: { y: 0.7 } });



      toast.success('Meta diaria concluida! Voce esta voando.');



      setProgressFlags({ half: true, full: true });



    } else if (progressAverage >= 50 && !progressFlags.half) {



      toast('Siga firme! Voce ja passou da metade do dia.');



      setProgressFlags((prev) => ({ ...prev, half: true }));



    }



  }, [progressAverage, progressFlags]);







  const motivational = progressAverage >= 100



    ? 'Dia concluido com brilho! Compartilhe essa energia.'



    : progressAverage >= 50



      ? 'Voce esta brilhando, mantenha o ritmo.'



      : 'Pequenos passos hoje, conquistas gigantes no fechamento.';







  const updateSalesForMonth = useCallback((month: string, transformer: (list: SaleRecord[]) => SaleRecord[]) => {



    setSalesMap((prev) => {



      const current = prev[month] ?? [];



      return { ...prev, [month]: sortSales(transformer(current)) };



    });



  }, []);







  const handleSaleSubmit = saleForm.handleSubmit(async (data) => {



    if (!user || !config) return;



    const trimmedOrder = data.orderId.trim();



    const serviceOnly = trimmedOrder.endsWith('#');



    const normalizedOrderId = serviceOnly ? trimmedOrder.slice(0, -1) : trimmedOrder;



    const month = data.date.slice(0, 7);







    const baseSale: Sale = {



      date: data.date,



      client: data.client,



      net: data.net,



      gross: data.gross,



      services: { capa: data.capa || 0, impermeabilizacao: data.impermeabilizacao || 0 },



      sellerUid: user.uid,



      orderId: normalizedOrderId,



      serviceOnly,



      status: editingSale?.sale.status ?? 'pendente'



    };







    try {



      if (editingSale) {



        const previousMonth = editingSale.month;



        const saleId = editingSale.sale.id;



        if (previousMonth !== month) {



          await deleteSale({ uid: user.uid, month: previousMonth, saleId });



          const newId = await addSale({ ...baseSale, createdAt: editingSale.sale.createdAt ?? new Date().toISOString() });



          const persistedId = newId ?? createId('sale');



          updateSalesForMonth(previousMonth, (list) => list.filter((item) => item.id !== saleId));



          updateSalesForMonth(month, (list) => [

            { id: persistedId, ...baseSale, createdAt: editingSale.sale.createdAt ?? new Date().toISOString() },

            ...list

          ]);



        } else {



          const dataToSave: Sale = { ...baseSale, createdAt: editingSale.sale.createdAt ?? new Date().toISOString() };



          await updateSale({ uid: user.uid, month, saleId, data: dataToSave });



          updateSalesForMonth(month, (list) => list.map((item) => (item.id === saleId ? { id: saleId, ...dataToSave } : item)));



        }



        toast.success('Venda atualizada.');



      } else {



        const dataToSave: Sale = { ...baseSale, createdAt: new Date().toISOString() };



        const newId = await addSale(dataToSave);



        const persistedId = newId ?? createId('sale');



        updateSalesForMonth(month, (list) => [{ id: persistedId, ...dataToSave }, ...list]);



        const commissions = calcCommissionForSale(config, data.net, user.uid, config.team);



        const userCommission = commissions[user.uid] ?? 0;



        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });



        toast.success(`Venda registrada! Comissao estimada R$ ${userCommission.toFixed(2)}`);



      }







      setEditingSale(null);



      saleForm.reset({ date: today, client: '', orderId: '', net: 0, gross: 0, capa: 0, impermeabilizacao: 0 });



    } catch (error) {



      console.error(error);



      toast.error('Erro ao salvar a venda.');



    }



  });







  const handleEditSale = (month: string, sale: SaleRecord) => {



    setEditingSale({ month, sale });



    saleForm.reset({



      date: sale.date,



      client: sale.client,



      orderId: sale.serviceOnly ? `${sale.orderId ?? ''}#` : (sale.orderId ?? ''),



      net: sale.net,



      gross: sale.gross ?? sale.net,



      capa: sale.services?.capa ?? 0,



      impermeabilizacao: sale.services?.impermeabilizacao ?? 0



    });



  };







  const handleDeleteSale = async (month: string, sale: SaleRecord) => {



    if (!user) return;



    if (!window.confirm(`Remover o pedido ${sale.orderId ?? ''} do dia?`)) return;



    try {



      await deleteSale({ uid: user.uid, month, saleId: sale.id });



      updateSalesForMonth(month, (list) => list.filter((item) => item.id !== sale.id));



      if (editingSale && editingSale.sale.id === sale.id) {



        setEditingSale(null);



        saleForm.reset({ date: today, client: '', orderId: '', net: 0, gross: 0, capa: 0, impermeabilizacao: 0 });



      }



      toast.success('Venda removida.');



    } catch (error) {



      console.error(error);



      toast.error('Nao foi possivel remover a venda.');



    }



  };







  const handleStatusChange = async (month: string, sale: SaleRecord, status: SaleStatus) => {



    if (!user) return;



    try {



      await updateSale({ uid: user.uid, month, saleId: sale.id, data: { ...sale, status } });



      updateSalesForMonth(month, (list) => list.map((item) => (item.id === sale.id ? { ...item, status } : item)));



    } catch (error) {



      console.error(error);



      toast.error('Nao foi possivel atualizar o status.');



    }



  };







  const handleIG = async (type: 'posts' | 'stories') => {



    if (!config || !user) return;



    const limit = type === 'posts' ? config.instagram.postsPerDay : config.instagram.storiesPerDay;

    const currentCount = (ig as any)[type] ?? 0;

    const alreadyHitGoal = currentCount >= limit;



    if (alreadyHitGoal) {

      toast('Meta atingida! Continue postando :)');

    }



    const timeLabel = format(getNow(), 'HH:mm');



    await incrementIG({ uid: user.uid, dateISO: today, type, time: type === 'stories' ? timeLabel : undefined });



    const updated = await getIGDay(user.uid, today);

    const normalizedIg: { posts: number; stories: number } = { posts: updated?.posts ?? 0, stories: updated?.stories ?? 0 };



    setIg(normalizedIg);



    const updatedCount = normalizedIg[type];



    if (!alreadyHitGoal && updatedCount >= limit) {



      if (type === 'posts') {



        confetti({ particleCount: 80, spread: 70, origin: { y: 0.8 } });



        toast.success('Post do dia feito!');



      }



      if (type === 'stories') {



        confetti({ particleCount: 80, spread: 60, origin: { y: 0.8 } });



        toast.success('Stories concluidos!');



      }



    }



  };







  const handleAddMl = async () => {



    if (!mlUrl.trim() || !user) return;



    const previousCount = mlTodayCount;



    try {



      await addMlLink({ uid: user.uid, url: mlUrl });



      const links = await getMlLinks(user.uid);



      const normalized = (links ?? []).map((link) => ({ url: link.url, ts: link.ts }));



      setMlLinks(normalized);



      setMlUrl('');



      const countToday = normalized.reduce((total, link) => {



        const day = format(new Date(link.ts), 'yyyy-MM-dd');



        return day === today ? total + 1 : total;



      }, 0);



      let message = 'Link registrado com sucesso!';



      if (previousCount < ML_IDEAL_THRESHOLD && countToday >= ML_IDEAL_THRESHOLD) {



        confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });



        message = `Meta ideal do Mercado Livre concluida! ${countToday} anuncios no dia.`;



      } else if (previousCount < ML_MEDIUM_THRESHOLD && countToday >= ML_MEDIUM_THRESHOLD) {



        message = `Meta media do Mercado Livre alcancada! ${countToday} anuncios no dia.`;



      } else if (previousCount < ML_DAILY_TARGET && countToday >= ML_DAILY_TARGET) {



        message = `Meta minima do Mercado Livre garantida! ${countToday} anuncios no dia.`;



      }



      toast.success(message);



    } catch (error) {



      console.error(error);



      toast.error(error instanceof Error ? error.message : 'Erro ao registrar link');



    }



  };







  const handleRequestSalesForMonth = useCallback(async (month: string) => {



    if (!user) return;



    const needsOwn = !salesMap[month];



    const needsShared = relatedUids.length > 0 && !sharedSalesMap[month];



    const needsClosure = closureMap[month] === undefined;



    if (!needsOwn && !needsShared && !needsClosure) return;



    try {



      if (needsOwn) {



        const data = await getSalesByUserMonth(user.uid, month);



        setSalesMap((prev) => ({ ...prev, [month]: sortSales(data) }));



      }



      if (needsShared) {



        const entries = await Promise.all(



          relatedUids.map(async (uid) => {



            const list = await getSalesByUserMonth(uid, month);



            return list.map((sale) => ({ ...sale, sellerUid: sale.sellerUid ?? uid })) as SaleRecord[];



          })



        );



        setSharedSalesMap((prev) => ({ ...prev, [month]: entries.flat() }));



      }



      if (needsClosure) {



        const closure = await getClosure(month);



        setClosureMap((prev) => ({ ...prev, [month]: closure ?? null }));



      }



    } catch (error) {



      console.error(error);



      toast.error('Nao foi possivel carregar vendas do mes selecionado.');



    }



  }, [user, salesMap, relatedUids, sharedSalesMap, closureMap]);







  const handleLogout = async () => {



    await logout();



    navigate('/login');



  };







  const placeholderKeys = Object.keys(quickFields).length > 0 ? Object.keys(quickFields) : PLACEHOLDER_FALLBACK;



  const availableMonths = useMemo(() => {



    const set = new Set(Object.keys(salesMap));



    set.add(currentMonth);



    return Array.from(set).sort().reverse();



  }, [salesMap, currentMonth]);







  const activeCategory = templateCategories.find((category) => category.id === activeCategoryId) ?? templateCategories[0];







  const mlWeeklyBadge = useMemo(() => {

    const tiers = config?.ml_bonus?.tiers ?? [];

    if (tiers.length === 0) {

      return { label: 'Aquecendo', icon: null };

    }

    const sorted = [...tiers].sort((a, b) => a.min - b.min);

    const count = mlLinks.length;

    const tierIndex = sorted.findIndex((tier) => count >= tier.min && count <= (tier.max ?? Number.POSITIVE_INFINITY));

    const safeIndex = tierIndex === -1 && count > 0 ? sorted.length - 1 : tierIndex;

    if (safeIndex === -1) {

      return { label: 'Aquecendo', icon: null };

    }

    const medals = [
      { label: 'Bronze', icon: '/icons/bronze.png' },
      { label: 'Prata', icon: '/icons/prata.png' },
      { label: 'Ouro', icon: '/icons/ouro.png' }
    ];

    return medals[Math.min(safeIndex, medals.length - 1)] ?? { label: 'Aquecendo', icon: null };

  }, [config, mlLinks.length]);




  const salesHighlightsTooltip = [
    'Resumo em tempo real.',
    `Pedidos no mes: ${orderCount}`,
    `Status: ${monthlyProgress}%`,
    `Meta definida: R$ ${monthlyTarget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  ].join('\n');

  const commissionHighlightsTooltip = [
    closureFinalized ? 'Valores finais confirmados pelo fechamento.' : 'Sujeita a conferencias do admin.',
    `Valor da comissao por faturamento liquido: R$ ${commissionTotal.toFixed(2)}`,
    `Valor da comissao por servicos vendidos: R$ ${serviceBonus.toFixed(2)}`,
    `Bonus de faturamento: R$ ${faturamentoBonus.toFixed(2)}`,
    `Bonus do ML: R$ ${mlBonus.toFixed(2)}`,
    `Bonus assiduidade: R$ ${attendanceBonus.toFixed(2)}`,
    `Total com bonus${closureFinalized ? ' do fechamento' : ''}: R$ ${totalWithExtras.toFixed(2)}`
  ].join('\n');

  const mlHighlightsTooltip = [
    'Dia atual focado nos links.',
    `Medalha da semana: ${mlWeeklyBadge.label}`,
    `Semana: ${mlLinks.length} links`
  ].join('\n');

  const instagramHighlightsTooltip = [
    'Posts e stories enviados.',
    'Use o planner para marcar horarios e manter o ritmo.'
  ].join('\n');







  if (loadingConfig) {



    return <div className="flex h-screen items-center justify-center text-lg">Carregando painel...</div>;



  }







  if (!user || !config) {



    return <div className="flex h-screen items-center justify-center text-lg">Configuracao indisponivel.</div>;



  }







  return (



    <div className="min-h-screen bg-gradient-to-br from-[#cfe7ff] via-[#dfe8ff] to-[#ffd9e6] sm:to-[#c9ffe6] pb-16">



      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">



        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">



          <div>



            <h1 className="text-2xl font-semibold text-slate-900">Bom dia, {user.name.split(' ')[0]}!</h1>



            <p className="text-sm text-slate-600">{motivational}</p>



          </div>


          <div className="w-full max-w-lg">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Progresso do dia</div>
            <div className="flex items-center">
              <div className="flex-1 rounded-3xl border border-white/30 bg-white/20 p-1 shadow-lg backdrop-blur-md">
                <Progress
                  value={progressAverage}
                  className="relative h-6 w-full overflow-hidden rounded-full bg-transparent"
                  indicatorClassName="bg-gradient-to-r from-[#5A8DEE] via-[#7FD1FF] to-[#9FF2D0] transition-all duration-300"
                />
              </div>
              <span className="ml-2 text-sm font-medium text-slate-800">{progressAverage}%</span>
            </div>
          </div>






          <Button variant="outline" onClick={handleLogout}>



            <LogOut className="w-4 h-4 opacity-80" /> Sair



          </Button>



        </div>



      </header>







      <main className="mx-auto mt-6 flex max-w-6xl flex-col gap-6 px-4">



        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'overview' | 'tools')} className="w-full">



          <TabsList className="bg-white">



            <TabsTrigger value="overview">Painel</TabsTrigger>



            <TabsTrigger value="tools">Ferramentas</TabsTrigger>



          </TabsList>







          <TabsContent value="overview" className="mt-6 space-y-6">



            {personalNotes.length > 0 && (



              <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">



                {personalNotes.slice(0, 8).map((note) => (



                  <div
                    key={note.id}
                    style={{ backgroundImage: `url(${noteBgUrl(note.color) || noteBgUrl('yellow')})` }}
                    className="relative mx-auto flex aspect-square w-full min-w-[160px] max-w-[220px] flex-col justify-between bg-cover bg-center bg-no-repeat p-3 text-sm text-slate-900 sm:p-4"
                  >



                    <div className="flex-1 overflow-y-auto whitespace-pre-wrap break-words pr-2 pl-4 pt-6">{note.text}</div>



                    {note.date && <p className="mt-2 text-xs font-semibold text-slate-600">Ate {format(new Date(note.date), 'dd/MM')}</p>}



                  </div>



                ))}



              </section>



            )}







            <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">



              <Card className="group overflow-visible" title={salesHighlightsTooltip} tabIndex={0}>
                <img
                  src="/icons/vendas.png"
                  alt=""
                  aria-hidden="true"
                  className="absolute -top-6 -right-4 w-16 max-w-[55%] pointer-events-none select-none opacity-80 sm:-top-8 sm:-right-5 sm:w-20"
                />
                <CardHeader className="pb-2">
                  <CardTitle>Vendas do mes</CardTitle>
                  <CardDescription className="sr-only">Resumo em tempo real.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold text-slate-900">R$ {grossTotal.toFixed(2)}</div>
                </CardContent>
                <div className="sr-only">
                  <p>Resumo em tempo real.</p>
                  <p>Pedidos no mes: {orderCount}.</p>
                  <p>Status: {monthlyProgress}%.</p>
                  <p>Meta definida: R$ {monthlyTarget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.</p>
                </div>
              </Card>







              <Card className="group overflow-visible" title={commissionHighlightsTooltip} tabIndex={0}>
                <img
                  src="/icons/dinheiro.png"
                  alt=""
                  aria-hidden="true"
                  className="absolute -top-6 -right-4 w-16 max-w-[55%] pointer-events-none select-none opacity-80 sm:-top-8 sm:-right-5 sm:w-20"
                />
                <CardHeader className="pb-2">
                  <CardTitle>Comissao estimada</CardTitle>
                  <CardDescription className="sr-only">Sujeita a conferencias do admin.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold text-slate-900">R$ {commissionTotal.toFixed(2)}</div>
                  <div className="mt-1 text-sm text-slate-500">Com bonus: <span className="font-semibold text-slate-800">R$ {totalWithExtras.toFixed(2)}</span></div>
                </CardContent>
                <div className="sr-only">
                  <p>Valor da comissao por faturamento liquido: R$ {commissionTotal.toFixed(2)}.</p>
                  <p>Valor da comissao por servicos vendidos: R$ {serviceBonus.toFixed(2)}.</p>
                  <p>Bonus de faturamento: R$ {faturamentoBonus.toFixed(2)}.</p>
                  <p>Bonus do ML: R$ {mlBonus.toFixed(2)}.</p>
                  <p>Bonus assiduidade: R$ {attendanceBonus.toFixed(2)}.</p>
                  <p>Total com bonus{closureFinalized ? ' do fechamento' : ''}: R$ {totalWithExtras.toFixed(2)}.</p>
                  {closureFinalized && <p>Fechamento publicado para este mes.</p>}
                </div>
              </Card>







              <Card className="group overflow-visible" title={mlHighlightsTooltip} tabIndex={0}>
                <img
                  src="/icons/mercadolivre.png"
                  alt=""
                  aria-hidden="true"
                  className="absolute -top-6 -right-4 w-16 max-w-[55%] pointer-events-none select-none opacity-80 sm:-top-8 sm:-right-5 sm:w-20"
                />
                <CardHeader className="pb-2">
                  <CardTitle>Anuncios Mercado Livre</CardTitle>
                  <CardDescription className="sr-only">Dia atual focado nos links.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <div className="text-3xl font-semibold text-slate-900">{mlTodayCount}</div>
                    {mlWeeklyBadge.icon && (
                      <img
                        src={mlWeeklyBadge.icon}
                        alt={`Medalha ${mlWeeklyBadge.label}`}
                        className="h-8 w-8 shrink-0"
                      />
                    )}
                  </div>
                </CardContent>
                <div className="sr-only">
                  <p>Medalha da semana: {mlWeeklyBadge.label}.</p>
                  <p>Semana: {mlLinks.length} links.</p>
                </div>
              </Card>







              <Card className="group overflow-visible" title={instagramHighlightsTooltip} tabIndex={0}>
                <img
                  src="/icons/instagram.png"
                  alt=""
                  aria-hidden="true"
                  className="absolute -top-6 -right-4 w-16 max-w-[55%] pointer-events-none select-none opacity-80 sm:-top-8 sm:-right-5 sm:w-20"
                />
                <CardHeader className="pb-2">
                  <CardTitle>Instagram hoje</CardTitle>
                  <CardDescription className="sr-only">Posts e stories enviados.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold text-slate-900">{ig.posts}/{config.instagram.postsPerDay} posts - {ig.stories}/{config.instagram.storiesPerDay} stories</div>
                </CardContent>
                <div className="sr-only">
                  <p>Use o planner para marcar horarios e manter o ritmo.</p>
                </div>
              </Card>



            </section>



            <section className="grid gap-6 lg:grid-cols-3">



              <Card className="lg:col-span-2">



                <CardHeader>



                  <CardTitle>Planner Instagram</CardTitle>



                  <CardDescription>Metas diarias: {config.instagram.postsPerDay} post / {config.instagram.storiesPerDay} stories.</CardDescription>



                </CardHeader>



                <CardContent>



                  <div className="flex flex-wrap items-center gap-2">



                    <Button onClick={() => handleIG('posts')}>



                      <Sparkles className="w-4 h-4 opacity-80" /> Marcar post feito



                    </Button>



                    <Button variant="outline" onClick={() => handleIG('stories')}>



                      <Sparkles className="w-4 h-4 opacity-80" /> Marcar story agora



                    </Button>



                    <Badge className="border border-slate-300 bg-white text-slate-600">Streak em construcao</Badge>



                  </div>



                  <div className="mt-4 grid gap-2 text-sm">



                    <p className="font-semibold text-slate-700">Sugestoes de horarios</p>



                    <ul className="grid gap-2 md:grid-cols-2">



                      {['09:30', '11:30', '14:30', '16:30', '#TBT quinta', 'Visite o showroom (sexta tarde)', 'Sabado: estamos abertos!'].map((slot) => (



                        <li key={slot} className="rounded-lg border border-dashed border-brand-200 bg-brand-50 px-3 py-2 text-brand-700">



                          {slot}



                        </li>



                      ))}



                    </ul>



                  </div>



                </CardContent>



              </Card>







              <Card>



                                <img

                  src="/icons/meta.png"

                  alt=""

                  aria-hidden="true"

                  className="absolute -top-3 -right-2 sm:-top-4 sm:-right-3 w-10 sm:w-12 max-w-[45%] opacity-80 pointer-events-none select-none"

                />



                <CardHeader>



                  <CardTitle>Meta pessoal do mes</CardTitle>



                  <CardDescription>Escolha sua meta minima de 50.000 e acompanhe a jornada.</CardDescription>



                </CardHeader>



                <CardContent>



                  <MetaPessoal netTotal={netTotal} value={personalTarget} onChange={setPersonalTarget} />



                </CardContent>



              </Card>



            </section>







            <section className="grid gap-6 lg:grid-cols-2">



              <Card className="flex flex-col lg:min-h-[640px]">



                <CardHeader>



                  <CardTitle>Anuncios Mercado Livre</CardTitle>



                  <CardDescription>Cadastre os links unicos do dia para garantir o bonus semanal.</CardDescription>



                </CardHeader>



                <CardContent className="flex flex-col flex-1">



                  <div className="flex gap-2 shrink-0">



                    <Input value={mlUrl} onChange={(event) => setMlUrl(event.target.value)} placeholder="https://produto.mercadolivre.com.br/..." aria-label="URL do anuncio" />



                    <Button onClick={handleAddMl}>



                      <PlusCircle className="w-4 h-4 opacity-80" /> Adicionar



                    </Button>



                  </div>



                  <p className="mt-2 shrink-0 text-xs text-slate-500">Semana {currentWeek} - bonus atual R$ {mlBonus.toFixed(2)} ({mlLinks.length} links)</p>



                  <ul className="mt-3 flex-1 min-h-0 max-h-[750px] space-y-2 overflow-y-auto text-sm">



                    {mlLinks.map((link) => (



                      <li key={link.url} className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2">



                        <span className="truncate text-slate-700" title={link.url}>{getMlDisplayTitle(link.url)}</span>



                        <span className="text-xs text-slate-400">{format(new Date(link.ts), 'dd/MM HH:mm')}</span>



                      </li>



                    ))}



                    {mlLinks.length === 0 && <p className="text-sm text-slate-500">Nenhum link cadastrado ainda.</p>}



                  </ul>



                </CardContent>



              </Card>







              <Card>



                <CardHeader>



                  <CardTitle>Registrar venda</CardTitle>



                  <CardDescription>Valores liquidos, servicos e ajustes entram no calculo da comissao.</CardDescription>



                </CardHeader>



                <CardContent>



                  <form className="grid gap-3" onSubmit={handleSaleSubmit}>



                    <div className="grid gap-1">



                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Data</label>



                      <Input type="date" {...saleForm.register('date')} />



                    </div>



                    <div className="grid gap-1">



                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Cliente</label>



                      <Input placeholder="Nome da cliente" {...saleForm.register('client')} />



                    </div>



                    <div className="grid gap-1">



                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Pedido</label>



                      <Input placeholder="#" {...saleForm.register('orderId')} />



                      <p className="text-[11px] uppercase tracking-wide text-slate-400">Use # para registrar apenas servicos (ex.: 2222#)</p>



                    </div>



                    <div className="grid gap-1">



                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Valor liquido (R$)</label>



                      <Input inputMode="decimal" pattern="[0-9.,]*" {...saleForm.register('net')} />



                    </div>



                    <div className="grid gap-1">



                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Valor bruto (R$)</label>



                      <Input inputMode="decimal" pattern="[0-9.,]*" {...saleForm.register('gross')} />



                    </div>



                    <div className="grid grid-cols-2 gap-3">



                      <div>



                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Capa</label>



                        <Input inputMode="decimal" pattern="[0-9.,]*" {...saleForm.register('capa')} />



                      </div>



                      <div>



                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Impermeabilizacao</label>



                        <Input inputMode="decimal" pattern="[0-9.,]*" {...saleForm.register('impermeabilizacao')} />



                      </div>



                    </div>



                    <div className="flex items-center gap-3">



                      <Button type="submit">{editingSale ? 'Atualizar venda' : 'Salvar venda'}</Button>



                      {editingSale && (



                        <Button type="button" variant="ghost" onClick={() => {



                          setEditingSale(null);



                          saleForm.reset({ date: today, client: '', orderId: '', net: 0, gross: 0, capa: 0, impermeabilizacao: 0 });



                        }}>



                          Cancelar edicao



                        </Button>



                      )}



                    </div>



                  </form>







                  <div className="mt-6 space-y-2">



                    <div className="flex items-center justify-between text-xs font-semibold uppercase text-slate-500">



                      <span>Vendas registradas</span>



                      <span>{orderCount}</span>



                    </div>



                    {currentSales.length === 0 ? (



                      <p className="text-sm text-slate-500">Sem vendas registradas neste mes.</p>



                    ) : (



                      <div className="max-h-72 overflow-y-auto pr-1">



                        <ul className="space-y-2">



                          {currentSales.map((sale) => {



                          const status = sale.status ?? 'pendente';



                          const style = SALE_STATUS_META[status];



                          const firstName = sale.client.split(' ')[0] ?? sale.client;



                          return (



                            <li key={sale.id} className={cn('flex flex-col gap-2 rounded-md border bg-white p-3 text-sm text-slate-700 md:flex-row md:items-center md:justify-between', style.className)}>



                              <div className="flex flex-col gap-1">



                                <div className="flex items-center gap-2 text-slate-600">



                                  <span className="font-semibold">{firstName}</span>



                                  <span className="text-xs text-slate-500">#{sale.orderId ?? 'sem-id'}</span>



                                  {sale.serviceOnly && <Badge className="border border-slate-300 bg-white text-slate-600">Servico</Badge>}



                                </div>



                                <div className="flex flex-wrap gap-3 text-xs text-slate-500">



                                  <span>Liquido: R$ {sale.net.toFixed(2)}</span>



                                  <span>Bruto: R$ {(sale.gross ?? 0).toFixed(2)}</span>



                                  <span>Data: {format(new Date(sale.date), 'dd/MM')}</span>



                                </div>



                              </div>



                              <div className="flex flex-wrap items-center gap-3">



                                <select



                                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"



                                  value={status}



                                  onChange={(event) => handleStatusChange(currentMonth, sale, event.target.value as SaleStatus)}



                                >



                                  {Object.entries(SALE_STATUS_META).map(([value, meta]) => (



                                    <option key={value} value={value}>{meta.label}</option>



                                  ))}



                                </select>



                                <Button type="button" variant="ghost" size="icon" onClick={() => handleEditSale(currentMonth, sale)}>



                                  <Pencil className="w-4 h-4 opacity-80" />



                                </Button>



                                <Button type="button" variant="ghost" size="icon" onClick={() => handleDeleteSale(currentMonth, sale)}>



                                  <Trash2 className="w-4 h-4 opacity-80" />



                                </Button>



                              </div>



                            </li>



                          );



                        })}



                        </ul>



                      </div>



                    )}



                  </div>



                </CardContent>



              </Card>



            </section>



            <OrderNotesPanel



              months={availableMonths}



              currentMonth={currentMonth}



              salesByMonth={salesMap}



              notes={orderNotes}



              onUpsert={(note) => {



                setOrderNotes((prev) => {



                  const exists = prev.find((item) => item.id === note.id);



                  if (exists) {



                    return prev.map((item) => (item.id === note.id ? note : item));



                  }



                  return [...prev, note];



                });



              }}



              onDelete={(id) => setOrderNotes((prev) => prev.filter((item) => item.id !== id))}



              onRequestMonth={handleRequestSalesForMonth}



            />







            <PendenciasPanel



              months={availableMonths}



              currentMonth={currentMonth}



              salesByMonth={salesMap}



              items={pendencias}



              onCreate={(item) => setPendencias((prev) => [...prev, item])}



              onRemove={(id) => setPendencias((prev) => prev.filter((item) => item.id !== id))}



              onRequestMonth={handleRequestSalesForMonth}



            />



          </TabsContent>



          

        <TabsContent value="tools" className="mt-6 space-y-6">

          <section className="grid gap-6 lg:grid-cols-[280px_1fr]">

            <aside className="space-y-4">

              <Card>

                <CardHeader>

                  <CardTitle>Preenchimentos rapidos</CardTitle>

                  <CardDescription>Defina os valores usados nas chaves dos templates.</CardDescription>

                </CardHeader>

                <CardContent className="space-y-4">

                  <div className="space-y-3">

                    {Object.entries(quickFields).map(([field, value]) => (

                      <div key={field} className="space-y-1 text-xs">

                        <label className="font-semibold uppercase text-slate-600">{field}</label>

                        <Input

                          value={value ?? ''}

                          onChange={(event) => setQuickFields((prev) => ({ ...prev, [field]: event.target.value }))}

                          placeholder={`[${field}]`}

                          className="h-9 text-sm"

                        />

                        {!PLACEHOLDER_FALLBACK.includes(field) && (

                          <Button

                            type="button"

                            variant="ghost"

                            size="sm"

                            className="self-start text-[11px]"

                            onClick={() => {

                              setQuickFields((prev) => {

                                const copy = { ...prev };

                                delete copy[field];

                                return copy;

                              });

                            }}

                          >

                            Remover campo

                          </Button>

                        )}

                      </div>

                    ))}

                  </div>

                  <div className="space-y-2 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600">

                    <p className="font-semibold text-slate-700">Chaves disponiveis</p>

                    <div className="flex flex-wrap gap-2">

                      {placeholderKeys.map((key) => (

                        <span key={key} className="rounded border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] text-slate-700">

                          [{key}]

                        </span>

                      ))}

                    </div>

                    <p>Digite um novo identificador e clique em adicionar para criar chaves personalizadas.</p>

                  </div>

                  <AddQuickField onAdd={(key) => setQuickFields((prev) => ({ ...prev, [key]: '' }))} existing={quickFields} />

                </CardContent>

              </Card>

            </aside>

            <div className="flex flex-col gap-6 lg:flex-row">

              <div className="w-full max-w-[240px] space-y-3">

                <p className="text-xs font-semibold uppercase text-slate-500">Ficharios</p>

                <div className="space-y-2">

                  {templateCategories.map((category) => (

                    <div

                      key={category.id}

                      className={cn(

                        'group flex items-center justify-between rounded-md border px-3 py-2 text-sm shadow-sm transition',

                        category.id === activeCategoryId

                          ? 'border-slate-900 bg-slate-900/5 text-slate-900'

                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'

                      )}

                    >

                      <button type="button" className="flex flex-1 items-center truncate rounded-full border border-white/30 bg-white/20 px-5 py-2.5 text-left font-medium text-slate-800 shadow backdrop-blur-md transition-all duration-200 hover:bg-white/30 hover:shadow-lg active:scale-[0.98] focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-white/60 focus-visible:ring-2 focus-visible:ring-white/60" onClick={() => setActiveCategoryId(category.id)}>

                        {category.name}

                      </button>

                      <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">

                        <Button

                          type="button"

                          variant="ghost"

                          size="icon"

                          onClick={() => {

                            const name = prompt('Renomear fichario', category.name);

                            if (!name) return;

                            setTemplateCategories((prev) => prev.map((item) => (item.id === category.id ? { ...item, name } : item)));

                          }}

                        >

                          <Pencil className="w-4 h-4 opacity-80" />

                        </Button>

                        {templateCategories.length > 1 && (

                          <Button

                            type="button"

                            variant="ghost"

                            size="icon"

                            onClick={() => {

                              if (!window.confirm('Remover fichario?')) return;

                              setTemplateCategories((prev) => prev.filter((item) => item.id !== category.id));

                              if (activeCategoryId === category.id) {

                                const next = templateCategories.find((item) => item.id !== category.id);

                                setActiveCategoryId(next?.id ?? '');

                              }

                            }}

                          >

                            <Trash2 className="w-4 h-4 opacity-80" />

                          </Button>

                        )}

                      </div>

                    </div>

                  ))}

                </div>

                <Button

                  type="button"

                  variant="outline"

                  className="w-full"

                  onClick={() => {

                    const name = prompt('Nome do novo fichario', 'Novo fichario');

                    if (!name) return;

                    const category = { id: createId('cat'), name, templates: [] as TemplateEntry[] };

                    setTemplateCategories((prev) => [...prev, category]);

                    setActiveCategoryId(category.id);

                  }}

                >

                  + Novo fichario

                </Button>

              </div>

              <div className="flex-1 space-y-4">

                <div className="flex flex-wrap items-center justify-between gap-2">

                  <div>

                    <p className="text-sm font-semibold text-slate-700">{activeCategory?.name ?? 'Templates'}</p>

                    <p className="text-xs text-slate-500">Salve respostas padrao por canal ou tema.</p>

                  </div>

                  <Button

                    type="button"

                    variant="outline"

                    onClick={() => {

                      if (!activeCategory) return;

                      const tpl: TemplateEntry = {

                        id: createId('tpl'),

                        name: 'Novo template',

                        content: 'Ola [cliente]! Segue o orcamento do [modelo].'

                      };

                      setTemplateCategories((prev) =>

                        prev.map((category) => (category.id === activeCategory.id ? { ...category, templates: [...category.templates, tpl] } : category))

                      );

                    }}

                  >

                    Novo template

                  </Button>

                </div>

                {activeCategory?.templates.length ? (

                  <div className="space-y-4">

                    {activeCategory.templates.map((template) => (

                      <TemplateEditor

                        key={template.id}

                        template={template}

                        placeholderKeys={placeholderKeys}

                        quickFields={quickFields}

                        collapsed={collapsedTemplates[template.id] ?? false}

                        onToggleCollapse={(id) => setCollapsedTemplates((prev) => ({ ...prev, [id]: !prev[id] }))}

                        onChange={(updated) => {

                          setTemplateCategories((prev) =>

                            prev.map((category) =>

                              category.id === activeCategory.id

                                ? { ...category, templates: category.templates.map((tpl) => (tpl.id === updated.id ? updated : tpl)) }

                                : category

                            )

                          );

                        }}

                        onCopy={(entry) => copyTemplate(entry, quickFields)}

                        onDelete={(id) => {

                          setTemplateCategories((prev) =>

                            prev.map((category) =>

                              category.id === activeCategory.id

                                ? { ...category, templates: category.templates.filter((tpl) => tpl.id !== id) }

                                : category

                            )

                          );

                          setCollapsedTemplates((prev) => {

                            if (!(id in prev)) return prev;

                            const next = { ...prev };

                            delete next[id];

                            return next;

                          });

                        }}

                      />

                    ))}

                  </div>

                ) : (

                  <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">

                    Nenhum template neste fichario. Clique em <span className="font-semibold">Novo template</span> para cadastrar o primeiro texto.

                  </div>

                )}

              </div>

            </div>

          </section>

          <StickyNotesBoard

            notes={personalNotes}

            onCreate={({ text, date }) =>

              setPersonalNotes((prev) => [

                ...prev,

                {

                  id: createId('note'),

                  text,

                  date,

                  color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)]

                }

              ])

            }

            onRemove={(id) => setPersonalNotes((prev) => prev.filter((note) => note.id !== id))}

          />

          <Card>

            <CardHeader>

              <CardTitle>Backup local</CardTitle>

              <CardDescription>Exporte ou importe os dados armazenados neste dispositivo.</CardDescription>

            </CardHeader>

            <CardContent className="space-y-3">

              <Button

                variant="outline"

                onClick={() => {

                  const data = ls.exportAll(storageUid);

                  if (!data) return;

                  const blob = new Blob([data], { type: 'application/json' });

                  const url = URL.createObjectURL(blob);

                  const link = document.createElement('a');

                  link.href = url;

                  link.download = `painel-${storageUid}-${today}.json`;

                  link.click();

                  URL.revokeObjectURL(url);

                }}

                className="w-full"

              >

                Exportar JSON

              </Button>

              <label className="flex h-10 cursor-pointer items-center justify-center rounded-md border border-dashed border-slate-300 text-sm text-slate-600 transition hover:bg-slate-100">

                Importar JSON

                <input

                  type="file"

                  accept="application/json"

                  onChange={async (event: ChangeEvent<HTMLInputElement>) => {

                    const file = event.target.files?.[0];

                    if (!file) return;

                    const content = await file.text();

                    ls.importAll(storageUid, content);

                    const importedTemplates = normalizeTemplateCategories(ls.getUserScoped('templates_user', storageUid, []));

                    setTemplateCategories(importedTemplates);

                    const importedTemplateState = ls.getUserScoped('templates_state_user', storageUid, DEFAULT_TEMPLATE_STATE);

                    const firstImportedId = importedTemplates[0]?.id ?? '';

                    const nextImportedActiveId = importedTemplates.some((category) => category.id === importedTemplateState.activeCategoryId)

                      ? importedTemplateState.activeCategoryId

                      : firstImportedId;

                    setActiveCategoryId(nextImportedActiveId);

                    setCollapsedTemplates(pruneCollapsedMap(importedTemplateState.collapsedTemplates, importedTemplates));

                    setQuickFields({ ...DEFAULT_QUICK_FIELDS, ...ls.getUserScoped('quickfields_user', storageUid, DEFAULT_QUICK_FIELDS) });

                    setOrderNotes(normalizeOrderNotes(ls.getUserScoped('notas_user', storageUid, []), currentMonth));

                    setPendencias(normalizePendencias(ls.getUserScoped('pendencias_user', storageUid, []), currentMonth));

                    setPersonalNotes(ls.getUserScoped('sticky_user', storageUid, []));

                    toast.success('Dados importados com sucesso.');

                  }}

                  className="hidden"

                />

              </label>

            </CardContent>

          </Card>

        </TabsContent>





        </Tabs>



      </main>



    </div>



  );



}



function AddQuickField({ onAdd, existing }: { onAdd: (key: string) => void; existing: Record<string, string> }) {



  const [value, setValue] = useState('');



  return (



    <div className="flex gap-2">



      <Input value={value} placeholder="nome_do_campo" onChange={(event) => setValue(event.target.value)} />



      <Button



        type="button"



        onClick={() => {



          const normalized = value.trim().toLowerCase().replace(/\s+/g, '_');



          if (!normalized) {



            toast.error('Informe um nome para o campo.');



            return;



          }



          if (existing[normalized]) {



            toast.error('Este campo ja existe.');



            return;



          }



          onAdd(normalized);



          setValue('');



        }}



      >



        Adicionar



      </Button>



    </div>



  );



}







function TemplateEditor({



  template,



  placeholderKeys,



  quickFields,



  collapsed,



  onToggleCollapse,



  onChange,



  onCopy,



  onDelete



}: {



  template: TemplateEntry;



  placeholderKeys: string[];



  quickFields: Record<string, string>;



  collapsed: boolean;



  onToggleCollapse: (id: string) => void;



  onChange: (entry: TemplateEntry) => void;



  onCopy: (entry: TemplateEntry) => void;



  onDelete: (id: string) => void;



}) {



  const textareaRef = useRef<HTMLTextAreaElement>(null);



  const [showSuggestions, setShowSuggestions] = useState(false);







  const insertPlaceholder = (key: string) => {



    const textarea = textareaRef.current;



    if (!textarea) return;



    const start = textarea.selectionStart ?? 0;



    const end = textarea.selectionEnd ?? 0;



    const nextContent = `${template.content.slice(0, start)}[${key}]${template.content.slice(end)}`;



    onChange({ ...template, content: nextContent });



    setShowSuggestions(false);



    requestAnimationFrame(() => {



      const cursor = start + key.length + 2;



      textarea.selectionStart = textarea.selectionEnd = cursor;



      textarea.focus();



    });



  };







  return (



    <Card className="border border-slate-200 bg-white">



      <CardHeader className="flex-row items-center justify-between">



        <Input value={template.name} onChange={(event) => onChange({ ...template, name: event.target.value })} className="max-w-sm border-none px-0 text-base font-semibold" />



        <div className="flex items-center gap-2">



          <Button type="button" variant="ghost" size="icon" onClick={() => onToggleCollapse(template.id)}>



            <ChevronsDownUp className="w-4 h-4 opacity-80" />



          </Button>



          <Button type="button" variant="ghost" size="icon" onClick={() => onCopy(template)}>



            <Copy className="w-4 h-4 opacity-80" />



          </Button>



          <Button type="button" variant="ghost" size="icon" onClick={() => onDelete(template.id)}>



            <Trash2 className="w-4 h-4 opacity-80" />



          </Button>



        </div>



      </CardHeader>



      {!collapsed && (



        <CardContent className="space-y-3">



          <Textarea



            ref={textareaRef}



            value={template.content}



            rows={4}



            onChange={(event) => onChange({ ...template, content: event.target.value })}



            onKeyDown={(event) => {



              if (event.key === '[') {



                setShowSuggestions(true);



              }



              if (event.key === 'Escape') {



                setShowSuggestions(false);



              }



            }}



          />



          {showSuggestions && (



            <div className="flex flex-wrap gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">



              {placeholderKeys.map((key) => (



                <Button key={key} type="button" variant="outline" size="sm" onMouseDown={(event) => { event.preventDefault(); insertPlaceholder(key); }}>



                  [{key}]



                </Button>



              ))}



              <Button type="button" variant="ghost" size="sm" onMouseDown={(event) => { event.preventDefault(); setShowSuggestions(false); }}>



                fechar



              </Button>



            </div>



          )}



          <div className="text-xs text-slate-500">



            Valores atuais: {placeholderKeys.map((key) => `${key}=${quickFields[key] ?? ''}`).join(' | ')}



          </div>



        </CardContent>



      )}



    </Card>



  );



}







function copyTemplate(entry: TemplateEntry, quickFields: Record<string, string>) {



  if (!entry.content) {



    toast.error('Template sem conteudo.');



    return;



  }



  let text = entry.content;



  Object.entries(quickFields).forEach(([key, value]) => {



    text = text.split(`[${key}]`).join(value ?? '');



  });



  navigator.clipboard.writeText(text);



  toast.success('Texto copiado! Personalize no app desejado.');



}





function StickyNotesBoard({ notes, onCreate, onRemove }: { notes: StickyNote[]; onCreate: (payload: { text: string; date?: string }) => void; onRemove: (id: string) => void }) {

  const [text, setText] = useState('');

  const [date, setDate] = useState('');



  const handleAdd = () => {

    if (!text.trim()) {

      toast.error('Escreva a nota antes de adicionar.');

      return;

    }

    onCreate({ text: text.trim(), date: date || undefined });

    setText('');

    setDate('');

  };



  return (

    <Card>

      <CardHeader>

        <CardTitle>Notas pessoais</CardTitle>

        <CardDescription>Escreva lembretes e deixe-os visiveis ao entrar no painel.</CardDescription>

      </CardHeader>

      <CardContent>

        <div className="grid gap-4 rounded-3xl bg-white/75 p-4 backdrop-blur-sm lg:grid-cols-[280px_1fr]">

          <div className="flex h-full flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-sm">

            <Textarea

              rows={4}

              placeholder="Escreva lembretes curtos"

              value={text}

              onChange={(event) => setText(event.target.value)}

              className="resize-none text-sm"

            />

            <div className="flex flex-wrap items-center gap-2">

              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-9 w-auto text-sm" />

              <Button type="button" onClick={handleAdd}>

                <Plus className="w-4 h-4 opacity-80" /> Adicionar nota

              </Button>

            </div>

            <p className="text-[11px] text-slate-500">Dica: use a data para destacar tarefas com prazo.</p>

          </div>

          {notes.length === 0 ? (

            <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">

              Sem notas ainda.

            </div>

          ) : (

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">

              {notes.map((note) => (

                <div
                  key={note.id}
                  style={{ backgroundImage: `url(${noteBgUrl(note.color) || noteBgUrl('yellow')})` }}
                  className="relative mx-auto flex aspect-square w-full min-w-[160px] max-w-[220px] flex-col justify-between bg-cover bg-center bg-no-repeat p-3 text-sm text-slate-900 sm:p-4"
                >

                  <button

                    type="button"

                    className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full border border-white/30 bg-white/20 text-sm font-medium text-slate-800 shadow backdrop-blur-md transition-all duration-200 hover:bg-white/30 hover:shadow-md active:scale-[0.98] focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-white/60 focus-visible:ring-2 focus-visible:ring-white/60"

                    onClick={() => onRemove(note.id)}

                    aria-label="Remover nota"

                  >

                    x

                  </button>

                  <div className="flex-1 overflow-y-auto whitespace-pre-wrap break-words pr-2 pl-4 pt-6">{note.text}</div>

                  {note.date && <p className="mt-3 text-xs font-semibold text-slate-600">Ate {format(new Date(note.date), 'dd/MM')}</p>}

                </div>

              ))}

            </div>

          )}

        </div>

      </CardContent>

    </Card>

  );

}





function OrderNotesPanel({

  months,

  currentMonth,

  salesByMonth,

  notes,

  onUpsert,

  onDelete,

  onRequestMonth

}: {

  months: string[];

  currentMonth: string;

  salesByMonth: Record<string, SaleRecord[]>;

  notes: OrderNote[];

  onUpsert: (note: OrderNote) => void;

  onDelete: (id: string) => void;

  onRequestMonth: (month: string) => void;

}) {

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const [selectedSaleId, setSelectedSaleId] = useState('');

  const [text, setText] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);



  useEffect(() => {

    if (selectedMonth && !salesByMonth[selectedMonth]) {

      onRequestMonth(selectedMonth);

    }

  }, [selectedMonth, salesByMonth, onRequestMonth]);



  const sales = salesByMonth[selectedMonth] ?? [];

  const monthNotes = notes.filter((note) => note.month === selectedMonth);



  const handleSubmit = () => {

    if (!selectedSaleId) {

      toast.error('Escolha o pedido.');

      return;

    }

    if (!text.trim()) {

      toast.error('Escreva a nota.');

      return;

    }

    const note: OrderNote = {

      id: editingId ?? createId('note'),

      saleId: selectedSaleId,

      month: selectedMonth,

      text: text.trim(),

      createdAt: editingId ? monthNotes.find((item) => item.id === editingId)?.createdAt ?? new Date().toISOString() : new Date().toISOString()

    };

    onUpsert(note);

    setEditingId(null);

    setSelectedSaleId('');

    setText('');

  };



  return (

    <Card>

      <CardHeader>

        <CardTitle>Notas por pedido</CardTitle>

        <CardDescription>Registre observacoes especificas de cada atendimento.</CardDescription>

      </CardHeader>

      <CardContent>

        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">

          <div className="space-y-3">

            <div className="space-y-2 text-sm">

              <label className="text-xs font-semibold uppercase text-slate-600">Mes de referencia</label>

              <select

                className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"

                value={selectedMonth}

                onChange={(event) => {

                  setSelectedMonth(event.target.value);

                  setSelectedSaleId('');

                  setText('');

                  setEditingId(null);

                }}

              >

                {months.map((month) => (

                  <option key={month} value={month}>

                    {month}

                  </option>

                ))}

              </select>

            </div>

            <div className="space-y-2 text-sm">

              <label className="text-xs font-semibold uppercase text-slate-600">Escolha o pedido</label>

              <select

                className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"

                value={selectedSaleId}

                onChange={(event) => setSelectedSaleId(event.target.value)}

              >

                <option value="">Selecione o pedido</option>

                {sales.map((sale) => (

                  <option key={sale.id} value={sale.id}>

                    #{sale.orderId ?? 'sem-id'} - {sale.client}

                  </option>

                ))}

              </select>

            </div>

            <Textarea

              rows={4}

              placeholder="Resumo do atendimento, preferencias ou proximos passos"

              value={text}

              onChange={(event) => setText(event.target.value)}

            />

            <div className="flex flex-wrap gap-2">

              <Button type="button" onClick={handleSubmit}>

                {editingId ? 'Atualizar nota' : 'Salvar nota'}

              </Button>

              {editingId && (

                <Button

                  type="button"

                  variant="ghost"

                  onClick={() => {

                    setEditingId(null);

                    setSelectedSaleId('');

                    setText('');

                  }}

                >

                  Cancelar

                </Button>

              )}

            </div>

          </div>

          {monthNotes.length === 0 ? (

            <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">

              Sem notas para este mes.

            </div>

          ) : (

            <ul className="space-y-3 text-sm text-slate-700">

              {monthNotes.map((note, index) => {

                const sale = sales.find((item) => item.id === note.saleId);
                const theme =
                  (note as { color?: string; theme?: string }).color ??
                  (note as { theme?: string }).theme ??
                  undefined;

                const fallbackTheme = ORDER_NOTE_THEMES[index % ORDER_NOTE_THEMES.length];
                const chosenTheme = theme && noteBgUrl(theme) ? theme : fallbackTheme;
                const background = noteBgUrl(chosenTheme) || noteBgUrl(fallbackTheme);





                return (

                  <li

                    key={note.id}

                    className="relative flex flex-col gap-3 rounded-2xl bg-left bg-no-repeat p-6 pl-16 pr-6 text-slate-800 md:flex-row md:items-center md:justify-between md:pl-24"



                    style={{ backgroundImage: `url(${background})`, backgroundSize: "100% 100%", backgroundPosition: "left center" }}



                  >

                    <div className="flex-1 text-sm md:max-w-[65%] ml-2 md:ml-4">



                      <p className="font-semibold text-slate-700">#{sale?.orderId ?? 'sem-id'} - {sale?.client ?? 'Pedido fora do mes'}</p>

                      <div className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap break-words pr-1 text-xs text-slate-500">{note.text}</div>

                    </div>

                    <div className="flex items-center gap-2 text-slate-600">

                      <Button

                        type="button"

                        variant="ghost"

                        size="icon"

                        onClick={() => {

                          setEditingId(note.id);

                          setSelectedMonth(note.month);

                          setSelectedSaleId(note.saleId);

                          setText(note.text);

                        }}

                      >

                        <Pencil className="w-4 h-4 opacity-80" />

                      </Button>

                      <Button type="button" variant="ghost" size="icon" onClick={() => onDelete(note.id)}>

                        <Trash2 className="w-4 h-4 opacity-80" />

                      </Button>

                    </div>

                  </li>

                );

              })}

            </ul>

          )}

        </div>

      </CardContent>

    </Card>

  );

}





function PendenciasPanel({

  months,

  currentMonth,

  salesByMonth,

  items,

  onCreate,

  onRemove,

  onRequestMonth

}: {

  months: string[];

  currentMonth: string;

  salesByMonth: Record<string, SaleRecord[]>;

  items: PendencyItem[];

  onCreate: (item: PendencyItem) => void;

  onRemove: (id: string) => void;

  onRequestMonth: (month: string) => void;

}) {

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const [saleId, setSaleId] = useState('');

  const [text, setText] = useState('');

  const [color, setColor] = useState(PENDENCY_COLORS[0]);

  const [filterSaleId, setFilterSaleId] = useState('');



  useEffect(() => {

    if (selectedMonth && !salesByMonth[selectedMonth]) {

      onRequestMonth(selectedMonth);

    }

  }, [selectedMonth, salesByMonth, onRequestMonth]);



  const sales = salesByMonth[selectedMonth] ?? [];

  const monthItems = items.filter((item) => item.month === selectedMonth);
  const filterOptions = useMemo(() => {
    const labels = new Map<string, string>();
    for (const item of monthItems) {
      if (!labels.has(item.saleId)) {
        const sale = sales.find((entry) => entry.id === item.saleId);
        const label = `#${sale?.orderId ?? 'sem-id'} - ${sale?.client ?? 'Pedido fora do mes'}`;
        labels.set(item.saleId, label);
      }
    }
    return Array.from(labels.entries()).map(([id, label]) => ({ id, label }));
  }, [monthItems, sales]);

  const filteredItems = useMemo(() => {
    if (!filterSaleId) return monthItems;
    return monthItems.filter((item) => item.saleId === filterSaleId);
  }, [monthItems, filterSaleId]);




  const handleSave = () => {

    if (!saleId) {

      toast.error('Escolha o pedido.');

      return;

    }

    if (!text.trim()) {

      toast.error('Descreva a pendencia.');

      return;

    }

    onCreate({ id: createId('todo'), saleId, text: text.trim(), color, month: selectedMonth, createdAt: new Date().toISOString() });

    setSaleId('');

    setText('');

    setColor(PENDENCY_COLORS[0]);

    setFilterSaleId('');


  };



  return (

    <Card>

      <CardHeader>

        <CardTitle>Pendencias de pedidos</CardTitle>

        <CardDescription>Controle pagamentos, fretes e entregas que precisam de acompanhamento.</CardDescription>

      </CardHeader>

      <CardContent>

        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">

          <div className="space-y-3">

            <div className="space-y-2 text-sm">

              <label className="text-xs font-semibold uppercase text-slate-600">Mes</label>

              <select

                className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"

                value={selectedMonth}

                onChange={(event) => {

                  setSelectedMonth(event.target.value);

                  setSaleId('');

                  setText('');

                  setColor(PENDENCY_COLORS[0]);
                  setFilterSaleId('');

                }}

              >

                {months.map((month) => (

                  <option key={month} value={month}>

                    {month}

                  </option>

                ))}

              </select>

            </div>

            <div className="space-y-2 text-sm">

              <label className="text-xs font-semibold uppercase text-slate-600">Pedido</label>

              <select

                className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"

                value={saleId}

                onChange={(event) => setSaleId(event.target.value)}

              >

                <option value="">Selecione o pedido</option>

                {sales.map((sale) => (

                  <option key={sale.id} value={sale.id}>

                    #{sale.orderId ?? 'sem-id'} - {sale.client}

                  </option>

                ))}

              </select>

            </div>

            <Textarea

              rows={3}

              placeholder="Ex.: Falta pagar o frete"

              value={text}

              onChange={(event) => setText(event.target.value)}

            />

            <div className="space-y-2 text-sm">

              <span className="text-xs font-semibold uppercase text-slate-600">Cor</span>

              <div className="flex flex-wrap items-center gap-2">

                {PENDENCY_COLORS.map((option) => (

                  <button

                    key={option}

                    type="button"

                    className={cn('h-6 w-6 rounded-full border', color === option ? 'border-slate-900' : 'border-transparent')}

                    style={{ backgroundColor: option }}

                    onClick={() => setColor(option)}

                    aria-label={`Cor ${option}`}

                  />

                ))}

              </div>

            </div>

            <Button type="button" onClick={handleSave}>

              <Tag className="w-4 h-4 opacity-80" /> Salvar pendencia

            </Button>

          </div>

          {monthItems.length === 0 ? (

            <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">

              Nenhuma pendencia para este mes.

            </div>

          ) : (

            <div className="flex flex-col gap-3">
              {filterOptions.length > 1 && (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className="text-xs font-semibold uppercase text-slate-500">Filtrar por pedido</span>
                  <div className="flex items-center gap-2">
                    <select
                      id="pendency-filter"
                      value={filterSaleId}
                      onChange={(event) => setFilterSaleId(event.target.value)}
                      className="min-w-[200px] rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm shadow-sm"
                    >
                      <option value="">Todos os pedidos</option>
                      {filterOptions.map((option) => (
                        <option key={option.id || 'sem-id'} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {filterSaleId && (
                      <button
                        type="button"
                        className="text-xs font-semibold text-slate-500 underline-offset-2 transition hover:text-slate-700 hover:underline"
                        onClick={() => setFilterSaleId('')}
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                </div>
              )}

              {filteredItems.length === 0 ? (
                <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                  Nenhuma pendencia encontrada para este filtro.
                </div>
              ) : (
                <ul className="space-y-3 text-sm text-slate-700">
                  {filteredItems.map((item) => {
                    const sale = sales.find((entry) => entry.id === item.saleId);
                    const background = noteBgUrl('pendencias');

                    return (
                      <li
                        key={item.id}
                        className="relative flex flex-col gap-2 bg-left bg-no-repeat p-6 pl-16 pr-6 text-slate-800 md:flex-row md:items-center md:justify-between md:pl-24"
                        style={{ backgroundImage: `url(${background})`, backgroundSize: "100% 100%", backgroundPosition: "left center" }}
                      >
                        <div className="flex items-start gap-3 md:max-w-[65%]">
                          <span className="mt-1 inline-flex h-4 w-4 rounded-full" style={{ backgroundColor: item.color }} />
                          <div className="ml-2 flex-1 text-sm md:ml-3">
                            <p className="font-semibold text-slate-800">#{sale?.orderId ?? 'sem-id'} - {sale?.client ?? 'Pedido fora do mes'}</p>
                            <div className="mt-1 max-h-28 overflow-y-auto whitespace-pre-wrap break-words pr-1 text-xs text-slate-600">{item.text}</div>
                          </div>
                        </div>

                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:bg-white/40" onClick={() => onRemove(item.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

        </div>

      </CardContent>

    </Card>

  );

}



function MetaPessoal({ netTotal, value, onChange }: { netTotal: number; value: number; onChange: (value: number) => void }) {



  const target = Math.max(50000, value);



  const falta = Math.max(target - netTotal, 0);



  const diasRestantes = 30 - Number(format(getNow(), 'd'));



  const pacing = diasRestantes > 0 ? falta / diasRestantes : falta;







  const handleTargetChange = (event: ChangeEvent<HTMLInputElement>) => {



    const raw = Number(event.target.value);



    if (Number.isNaN(raw)) {



      onChange(50000);



      return;



    }



    onChange(Math.max(50000, raw));



  };







  return (



    <div className="space-y-3 text-sm text-slate-600">



      <div>



        <label className="text-xs font-semibold uppercase text-slate-500">Meta desejada neste mes (minimo R$ 50.000)</label>



        <Input type="number" min={50000} value={target} onChange={handleTargetChange} />



      </div>



      <p>Ja realizado: <strong>R$ {netTotal.toFixed(2)}</strong></p>



      <p>Falta: <strong>R$ {falta.toFixed(2)}</strong></p>



      <p>Pacing diario sugerido: <strong>R$ {pacing.toFixed(2)}</strong></p>



    </div>



  );



}











