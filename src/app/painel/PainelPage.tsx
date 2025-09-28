import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import { useAuth } from '../../hooks/useAuth';
import { Config, Sale } from '../../types';
import { getConfig } from '../../services/config';
import { addSale, getSalesByUserMonth } from '../../services/sales';
import { getIGDay, incrementIG } from '../../services/ig';
import { addMlLink, getMlLinks } from '../../services/ml';
import { calcCommissionForSale, calcMlWeeklyBonus } from '../../lib/calc';
import { formatDate, getNow, getWeekKey } from '../../lib/time';
import { ls } from '../../lib/storage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Copy, LogOut, PlusCircle, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const saleSchema = z.object({
  date: z.string().nonempty(),
  client: z.string().min(2, 'Informe o nome da cliente'),
  orderId: z.string().min(2, 'Número do pedido obrigatório'),
  net: z.number({ invalid_type_error: 'Valor líquido obrigatório' }).positive('Valor deve ser maior que zero'),
  capa: z.number().min(0).optional(),
  impermeabilizacao: z.number().min(0).optional()
});

type SaleForm = z.infer<typeof saleSchema>;

interface TemplateEntry {
  id: string;
  name: string;
  content: string;
}

export function PainelPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [config, setConfig] = useState<Config | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [ig, setIg] = useState<{ posts: number; stories: number }>({ posts: 0, stories: 0 });
  const [mlLinks, setMlLinks] = useState<{ url: string; ts: number }[]>([]);
  const [templates, setTemplates] = useState<TemplateEntry[]>([]);
  const [quickFields, setQuickFields] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [todos, setTodos] = useState<string[]>([]);
  const [mlUrl, setMlUrl] = useState('');
  const [loadingConfig, setLoadingConfig] = useState(true);

  const today = useMemo(() => formatDate(getNow(), 'yyyy-MM-dd'), []);
  const monthKey = today.slice(0, 7);
  const weekKey = useMemo(() => getWeekKey(getNow()), []);

  const saleForm = useForm<SaleForm>({
    resolver: zodResolver(saleSchema),
    defaultValues: { date: today, client: '', orderId: '', net: 0, capa: 0, impermeabilizacao: 0 }
  });

  useEffect(() => {
    if (!user) return;

    setTemplates(ls.getUserScoped('templates_user', user.uid, []));
    setQuickFields(ls.getUserScoped('quickfields_user', user.uid, {}));
    setNotes(ls.getUserScoped('notas_user', user.uid, {}));
    setTodos(ls.getUserScoped('pendencias_user', user.uid, []));
  }, [user?.uid]);

  useEffect(() => {
    async function load() {
      try {
        const cfg = await getConfig();
        setConfig(cfg);
        if (user) {
          const [userSales, igDay, links] = await Promise.all([
            getSalesByUserMonth(user.uid, monthKey),
            getIGDay(user.uid, today),
            getMlLinks(user.uid)
          ]);
          setSales(userSales);
          setIg(igDay);
          setMlLinks(links);
        }
      } catch (error) {
        console.error(error);
        toast.error('Falha ao carregar dados.');
      } finally {
        setLoadingConfig(false);
      }
    }
    load();
  }, [user?.uid, monthKey, today]);

  useEffect(() => {
    if (!user) return;
    ls.setUserScoped('templates_user', user.uid, templates);
  }, [templates, user?.uid]);

  useEffect(() => {
    if (!user) return;
    ls.setUserScoped('quickfields_user', user.uid, quickFields);
  }, [quickFields, user?.uid]);

  useEffect(() => {
    if (!user) return;
    ls.setUserScoped('notas_user', user.uid, notes);
  }, [notes, user?.uid]);

  useEffect(() => {
    if (!user) return;
    ls.setUserScoped('pendencias_user', user.uid, todos);
  }, [todos, user?.uid]);

  const commissionTotal = useMemo(() => {
    if (!config || !user) return 0;
    return sales.reduce((acc, sale) => {
      const map = calcCommissionForSale(config, sale.net, sale.sellerUid, config.team);
      return acc + (map[user.uid] ?? 0);
    }, 0);
  }, [config, sales, user?.uid]);

  const mlBonus = useMemo(() => {
    if (!config) return 0;
    return calcMlWeeklyBonus(config, mlLinks.length);
  }, [config, mlLinks.length]);

  const igProgress = useMemo(() => {
    if (!config) return 0;
    const postPct = Math.min(ig.posts / config.instagram.postsPerDay, 1);
    const storiesPct = Math.min(ig.stories / config.instagram.storiesPerDay, 1);
    return Math.round(((postPct + storiesPct) / 2) * 100);
  }, [config, ig]);

  const mlProgress = useMemo(() => {
    if (!config) return 0;
    const target = config.ml_bonus.tiers.at(-1)?.min ?? 50;
    return Math.min(100, Math.round((mlLinks.length / target) * 100));
  }, [config, mlLinks.length]);

  const saleProgress = useMemo(() => {
    if (!sales.length) return 0;
    return Math.min(100, Math.round((sales.length / 3) * 100));
  }, [sales.length]);

  const progressAverage = Math.round((igProgress * 0.4 + mlProgress * 0.3 + saleProgress * 0.3));
  const [progressFlags, setProgressFlags] = useState({ half: false, full: false });

  useEffect(() => {
    if (progressAverage >= 100 && !progressFlags.full) {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.7 } });
      toast.success('Meta diária concluída! Você está voando.');
      setProgressFlags({ half: true, full: true });
    } else if (progressAverage >= 50 && !progressFlags.half) {
      toast('Siga firme! Você já passou da metade do dia.');
      setProgressFlags((prev) => ({ ...prev, half: true }));
    }
  }, [progressAverage, progressFlags]);

  const motivational = progressAverage >= 100 ? 'Dia concluído com brilho! Compartilhe essa energia.' : progressAverage >= 50 ? 'Você está brilhando, mantenha o ritmo.' : 'Pequenos passos hoje, conquistas gigantes no fechamento.';

  const handleSaleSubmit = saleForm.handleSubmit(async (data) => {
    if (!user || !config) return;
    const payload: Sale = {
      date: data.date,
      client: data.client,
      net: data.net,
      services: {
        capa: data.capa || 0,
        impermeabilizacao: data.impermeabilizacao || 0
      },
      sellerUid: user.uid,
      orderId: data.orderId
    };
    try {
      await addSale(payload);
      setSales((prev) => [...prev, payload]);
      const commissions = calcCommissionForSale(config, data.net, user.uid, config.team);
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      toast.success(`Venda registrada! Comissão estimada R$ ${commissions[user.uid]?.toFixed(2) ?? '0,00'}`);
      saleForm.reset({ ...data, client: '', orderId: '', net: 0, capa: 0, impermeabilizacao: 0 });
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar a venda.');
    }
  });

  const handleIG = async (type: 'posts' | 'stories') => {
    if (!config || !user) return;
    const limit = type === 'posts' ? config.instagram.postsPerDay : config.instagram.storiesPerDay;
    if (ig[type] >= limit) {
      toast('Meta atingida! Aproveite para celebrar.');
      return;
    }
    const timeLabel = format(getNow(), 'HH:mm');
    await incrementIG({ uid: user.uid, dateISO: today, type, time: type === 'stories' ? timeLabel : undefined });
    const updated = await getIGDay(user.uid, today);
    setIg(updated);
    if (type === 'posts' && updated.posts === config.instagram.postsPerDay) {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.8 } });
      toast.success('Post do dia feito!');
    }
    if (type === 'stories' && updated.stories === config.instagram.storiesPerDay) {
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.8 } });
      toast.success('Stories concluídos!');
    }
  };

  const handleAddMl = async () => {
    if (!mlUrl.trim() || !user) return;
    try {
      await addMlLink({ uid: user.uid, url: mlUrl });
      const links = await getMlLinks(user.uid);
      setMlLinks(links);
      setMlUrl('');
      toast.success('Link registrado com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Erro ao registrar link');
    }
  };

  const updateTemplate = (entry: TemplateEntry) => {
    setTemplates((prev) => prev.map((tpl) => (tpl.id === entry.id ? entry : tpl)));
  };

  const addTemplate = () => {
    const id = crypto.randomUUID();
    setTemplates((prev) => [...prev, { id, name: 'Novo template', content: 'Olá [cliente]! Segue o orçamento do [modelo].' }]);
  };

  const deleteTemplate = (id: string) => {
    setTemplates((prev) => prev.filter((tpl) => tpl.id !== id));
  };

  const copyTemplate = (tpl: TemplateEntry) => {
    let text = tpl.content;
    Object.entries(quickFields).forEach(([key, value]) => {
      text = text.replaceAll(`[${key}]`, value ?? '');
    });
    navigator.clipboard.writeText(text);
    toast.success('Texto copiado! Personalize a mensagem no seu app.');
  };

  const exportData = () => {
    if (!user) return;
    const data = ls.exportAll(user.uid);
    if (!data) return;
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `painel-${user.name}-${today}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    const file = event.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    ls.importAll(user.uid, content);
    setTemplates(ls.getUserScoped('templates_user', user.uid, []));
    setQuickFields(ls.getUserScoped('quickfields_user', user.uid, {}));
    setNotes(ls.getUserScoped('notas_user', user.uid, {}));
    setTodos(ls.getUserScoped('pendencias_user', user.uid, []));
    toast.success('Dados pessoais importados com sucesso.');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (loadingConfig) {
    return <div className="flex h-screen items-center justify-center text-lg">Carregando painel...</div>;
  }

  if (!user || !config) {
    return <div className="flex h-screen items-center justify-center text-lg">Configuração indisponível.</div>;
  }

  const mlRange = config.ml_bonus.tiers.find((tier) => mlLinks.length >= tier.min && mlLinks.length <= tier.max);

  return (
    <div className="min-h-screen bg-slate-100 pb-16">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Bom dia, {user.name.split(' ')[0]}!</h1>
            <p className="text-sm text-slate-600">{motivational}</p>
          </div>
          <div className="w-full max-w-md">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>Progresso do dia</span>
              <span>{progressAverage}%</span>
            </div>
            <Progress value={progressAverage} />
          </div>
          <Button variant="outline" onClick={handleLogout} className="flex items-center gap-2">
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </header>

      <main className="mx-auto mt-6 flex max-w-6xl flex-col gap-6 px-4">
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardDescription>Vendas do mês</CardDescription>
              <CardTitle>R$ {sales.reduce((acc, sale) => acc + sale.net, 0).toFixed(2)}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-500">Pedidos registrados por você ({sales.length}).</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Comissão estimada</CardDescription>
              <CardTitle>R$ {commissionTotal.toFixed(2)}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-500">Calculada com base nas regras atuais.</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Links ML semana ({weekKey})</CardDescription>
              <CardTitle>{mlLinks.length}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-500">Faixa atual: R$ {mlRange?.value ?? 0}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Instagram hoje</CardDescription>
              <CardTitle>
                {ig.posts}/{config.instagram.postsPerDay} posts · {ig.stories}/{config.instagram.storiesPerDay} stories
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-500">Mantenha o ritmo para fechar o streak.</CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Planner Instagram</CardTitle>
              <CardDescription>Metas diárias: {config.instagram.postsPerDay} post / {config.instagram.storiesPerDay} stories.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => handleIG('posts')} className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" /> Marcar post feito
                </Button>
                <Button variant="outline" onClick={() => handleIG('stories')} className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" /> Marcar story agora
                </Button>
                <Badge>Streak em construção</Badge>
              </div>
              <div className="mt-4 grid gap-2 text-sm">
                <p className="font-semibold text-slate-700">Sugestões de horários</p>
                <ul className="grid gap-2 md:grid-cols-2">
                  {['09:30', '11:30', '14:30', '16:30', '#TBT quinta', 'Visite o showroom (sexta tarde)', 'Sábado: estamos abertos!'].map((slot) => (
                    <li key={slot} className="rounded-lg border border-dashed border-brand-200 bg-brand-50 px-3 py-2 text-brand-700">
                      {slot}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Meta pessoal do mês</CardTitle>
              <CardDescription>Defina quanto deseja faturar e acompanhe o restante.</CardDescription>
            </CardHeader>
            <CardContent>
              <MetaPessoal netTotal={sales.reduce((acc, sale) => acc + sale.net, 0)} />
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Anúncios Mercado Livre</CardTitle>
              <CardDescription>Insira links únicos para validar seu bônus semanal.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input value={mlUrl} onChange={(e) => setMlUrl(e.target.value)} placeholder="https://produto.mercadolivre.com.br/..." aria-label="URL do anúncio" />
                <Button onClick={handleAddMl} className="flex items-center gap-2">
                  <PlusCircle className="h-4 w-4" /> Adicionar
                </Button>
              </div>
              <p className="mt-2 text-xs text-slate-500">Semana {weekKey} · bônus atual R$ {mlRange?.value ?? 0}</p>
              <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-sm">
                {mlLinks.map((link) => (
                  <li key={link.url} className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2">
                    <span className="truncate text-slate-700">{link.url}</span>
                    <span className="text-xs text-slate-400">{format(typeof link.ts === 'number' ? new Date(link.ts) : new Date(), 'dd/MM HH:mm')}</span>
                  </li>
                ))}
                {mlLinks.length === 0 && <p className="text-sm text-slate-500">Nenhum link lançado ainda.</p>}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Registrar venda</CardTitle>
              <CardDescription>Valores líquidos e serviços adicionados elevam sua comissão.</CardDescription>
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
                </div>
                <div className="grid gap-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Valor líquido</label>
                  <Input type="number" step="0.01" {...saleForm.register('net', { valueAsNumber: true })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Capa</label>
                    <Input type="number" step="0.01" {...saleForm.register('capa', { valueAsNumber: true })} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Impermeabilização</label>
                    <Input type="number" step="0.01" {...saleForm.register('impermeabilizacao', { valueAsNumber: true })} />
                  </div>
                </div>
                <Button type="submit">Salvar venda</Button>
              </form>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Ferramentas de texto</CardTitle>
              <CardDescription>Personalize templates e use preenchimento rápido para copiar mensagens.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                <div className="grid gap-2 md:grid-cols-2">
                  {['cliente', 'modelo', 'valor_avista', 'valor_parcelado', 'frete', 'prazo'].map((field) => (
                    <div key={field} className="grid gap-1 text-xs">
                      <label className="font-semibold uppercase text-slate-600">{field}</label>
                      <Input
                        value={quickFields[field] ?? ''}
                        onChange={(e) => setQuickFields((prev) => ({ ...prev, [field]: e.target.value }))}
                        placeholder={`[${field}]`}
                      />
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" onClick={addTemplate}>
                  Novo template
                </Button>
                <div className="space-y-4">
                  {templates.map((tpl) => (
                    <Card key={tpl.id} className="border-dashed border-brand-200 bg-brand-50/70">
                      <CardHeader className="flex-row items-center justify-between">
                        <Input
                          value={tpl.name}
                          onChange={(e) => updateTemplate({ ...tpl, name: e.target.value })}
                          className="max-w-xs border-none bg-transparent px-0 text-base font-semibold"
                        />
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => copyTemplate(tpl)} aria-label="Copiar template">
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteTemplate(tpl.id)} aria-label="Excluir template">
                            ×
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Textarea value={tpl.content} onChange={(e) => updateTemplate({ ...tpl, content: e.target.value })} rows={4} />
                      </CardContent>
                    </Card>
                  ))}
                  {templates.length === 0 && <p className="text-sm text-slate-500">Cadastre seu primeiro template para agilizar as respostas.</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="notas">
            <TabsList className="bg-white">
              <TabsTrigger value="notas">Notas por cliente</TabsTrigger>
              <TabsTrigger value="pendencias">Pendências diárias</TabsTrigger>
              <TabsTrigger value="backup">Backup local</TabsTrigger>
            </TabsList>
            <TabsContent value="notas">
              <Card>
                <CardHeader>
                  <CardTitle>Notas pessoais</CardTitle>
                  <CardDescription>Somente você vê essas notas neste navegador.</CardDescription>
                </CardHeader>
                <CardContent>
                  <NotasCliente notes={notes} onUpdate={setNotes} />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="pendencias">
              <Card>
                <CardHeader>
                  <CardTitle>Pendências</CardTitle>
                  <CardDescription>Mantenha seu foco diário organizado.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Pendencias todos={todos} onChange={setTodos} />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="backup">
              <Card>
                <CardHeader>
                  <CardTitle>Exportar / Importar</CardTitle>
                  <CardDescription>Faça backup dos dados pessoais salvos neste dispositivo.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button variant="outline" onClick={exportData} className="w-full">
                    Exportar JSON
                  </Button>
                  <label className="flex h-10 cursor-pointer items-center justify-center rounded-md border border-dashed border-slate-300 text-sm text-slate-600 transition hover:bg-slate-100">
                    Importar JSON
                    <input type="file" accept="application/json" onChange={importData} className="hidden" />
                  </label>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </section>
      </main>
    </div>
  );
}

function NotasCliente({ notes, onUpdate }: { notes: Record<string, string>; onUpdate: (value: Record<string, string>) => void }) {
  const [cliente, setCliente] = useState('');
  const [texto, setTexto] = useState('');

  const handleSave = () => {
    if (!cliente) return;
    onUpdate({ ...notes, [cliente]: texto });
    setCliente('');
    setTexto('');
    toast.success('Nota salva!');
  };

  return (
    <div className="space-y-3">
      <Input placeholder="Nome da cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} />
      <Textarea rows={4} placeholder="Resumo do atendimento, preferências, objeções..." value={texto} onChange={(e) => setTexto(e.target.value)} />
      <Button onClick={handleSave}>Salvar nota</Button>
      <div className="space-y-2">
        {Object.entries(notes).map(([name, note]) => (
          <Card key={name} className="border border-slate-200 bg-white">
            <CardHeader>
              <CardTitle className="text-base">{name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-slate-600">{note}</p>
            </CardContent>
          </Card>
        ))}
        {Object.keys(notes).length === 0 && <p className="text-sm text-slate-500">Sem notas ainda. Use este espaço para registrar insights.</p>}
      </div>
    </div>
  );
}

function Pendencias({ todos, onChange }: { todos: string[]; onChange: (value: string[]) => void }) {
  const [item, setItem] = useState('');

  const addItem = () => {
    if (!item.trim()) return;
    onChange([...todos, item.trim()]);
    setItem('');
  };

  const toggle = (idx: number) => {
    onChange(todos.filter((_, index) => index !== idx));
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input value={item} onChange={(e) => setItem(e.target.value)} placeholder="Ex.: Responder leads de ontem" />
        <Button onClick={addItem}>Adicionar</Button>
      </div>
      <ul className="space-y-2">
        {todos.map((todo, idx) => (
          <li key={`${todo}-${idx}`} className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            <span>{todo}</span>
            <Button variant="ghost" size="sm" onClick={() => toggle(idx)} aria-label="Concluir tarefa">
              Concluir
            </Button>
          </li>
        ))}
        {todos.length === 0 && <p className="text-sm text-slate-500">Liste lembretes rápidos para manter o foco.</p>}
      </ul>
    </div>
  );
}

function MetaPessoal({ netTotal }: { netTotal: number }) {
  const [meta, setMeta] = useState<number>(() => {
    if (typeof window === 'undefined') return 50000;
    const stored = window.localStorage.getItem('meta_pessoal');
    return stored ? Number(stored) : 50000;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('meta_pessoal', String(meta));
  }, [meta]);

  const falta = Math.max(meta - netTotal, 0);
  const diasRestantes = 30 - Number(format(getNow(), 'd'));
  const pacing = diasRestantes > 0 ? falta / diasRestantes : falta;

  return (
    <div className="space-y-3 text-sm text-slate-600">
      <div>
        <label className="text-xs font-semibold uppercase text-slate-500">Meta (R$)</label>
        <Input type="number" value={meta} onChange={(e) => setMeta(Number(e.target.value))} />
      </div>
      <p>Já realizado: <strong>R$ {netTotal.toFixed(2)}</strong></p>
      <p>Falta: <strong>R$ {falta.toFixed(2)}</strong></p>
      <p>Pacing diário sugerido: <strong>R$ {pacing.toFixed(2)}</strong></p>
    </div>
  );
}
