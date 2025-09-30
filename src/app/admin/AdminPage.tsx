import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '../../hooks/useAuth';
import { Config, Sale } from '../../types';
import { getConfig, saveConfig, getUserProfile } from '../../services/config';
import { getAllSalesByMonth } from '../../services/sales';
import { resetUserDay, resetUserMonth } from '../../services/adminTools';
import { getClosure, publishClosure, type ClosurePayload } from '../../services/closures';
import { getMlLinks } from '../../services/ml';
import { calcMlWeeklyBonus, calcCommissionForSale, getFaturamentoRate } from '../../lib/calc';
import { formatDate, getNow, getWeekKey } from '../../lib/time';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { SimpleBarChart } from '../../components/charts/SimpleBarChart';
import { SimpleLineChart } from '../../components/charts/SimpleLineChart';

const configSchema = z.object({
  pontualidade_default: z.number().min(0),
  timezone: z.string(),
  instagram_posts: z.number().min(0),
  instagram_stories: z.number().min(0)
});

const closureSchema = z.object({
  month: z.string(),
  adesao_capa: z.number().min(0).max(100),
  adesao_imper: z.number().min(0).max(100),
  faturamento_sofas: z.number().min(0),
  pontualidade_admin: z.number().min(0),
  pontualidade_coordenadora: z.number().min(0),
  pontualidade_vendedoras: z.record(z.string(), z.number().min(0))
});

type ClosureForm = z.infer<typeof closureSchema>;

type ConfigForm = z.infer<typeof configSchema>;

export function AdminPage() {
  const { user, logout } = useAuth();
  const [config, setConfig] = useState<Config | null>(null);
  const [salesByUser, setSalesByUser] = useState<Record<string, Sale[]>>({});
  const [loading, setLoading] = useState(true);
  const [closureInfo, setClosureInfo] = useState<ClosurePayload | null>(null);
  const [teamProfiles, setTeamProfiles] = useState<Record<string, string>>({});
  const [mlLinksByUser, setMlLinksByUser] = useState<Record<string, { url: string; ts: number }[]>>({});
  const [selectedUid, setSelectedUid] = useState('');
  const [resetDay, setResetDay] = useState(formatDate(getNow(), 'yyyy-MM-dd'));
  const [resetMonth, setResetMonth] = useState(formatDate(getNow(), 'yyyy-MM'));
  const [resetLoading, setResetLoading] = useState({ day: false, month: false });
  const [reloadKey, setReloadKey] = useState(0);
  const navigate = useNavigate();

  const month = formatDate(getNow(), 'yyyy-MM');
  const week = getWeekKey(getNow());

  const availableUsers = useMemo(() => {
    if (!config) return [] as string[];
    return Array.from(new Set([config.team.coordinatorId, ...config.team.sellers]));
  }, [config]);

  useEffect(() => {
    if (!config) return;
    let active = true;
    const unique = Array.from(new Set([config.team.coordinatorId, ...config.team.sellers]));
    Promise.all(
      unique.map(async (uid) => {
        try {
          const profile = await getUserProfile(uid);
          return [uid, profile?.name ?? uid] as const;
        } catch {
          return [uid, uid] as const;
        }
      })
    ).then((entries) => {
      if (!active) return;
      setTeamProfiles(Object.fromEntries(entries));
    });
    return () => {
      active = false;
    };
  }, [config]);

  useEffect(() => {
    if (availableUsers.length === 0) return;
    if (!selectedUid || !availableUsers.includes(selectedUid)) {
      setSelectedUid(availableUsers[0]);
    }
  }, [availableUsers, selectedUid]);

  useEffect(() => {
    if (!config) return;
    let active = true;
    const users = Array.from(new Set([config.team.coordinatorId, ...config.team.sellers]));
    Promise.all(
      users.map(async (uid) => {
        try {
          const links = await getMlLinks(uid);
          return [uid, links ?? []] as const;
        } catch (error) {
          console.error(error);
          return [uid, []] as const;
        }
      })
    ).then((entries) => {
      if (!active) return;
      setMlLinksByUser(Object.fromEntries(entries));
    });
    return () => {
      active = false;
    };
  }, [config, week, reloadKey]);

  const configForm = useForm<ConfigForm>({
    resolver: zodResolver(configSchema),
    defaultValues: { pontualidade_default: 150, timezone: 'America/Sao_Paulo', instagram_posts: 1, instagram_stories: 10 }
  });

  const closureForm = useForm<ClosureForm>({
    resolver: zodResolver(closureSchema),
    defaultValues: {
      month,
      adesao_capa: 5,
      adesao_imper: 5,
      faturamento_sofas: 150000,
      pontualidade_admin: 150,
      pontualidade_coordenadora: 150,
      pontualidade_vendedoras: {}
    }
  });

  async function handleLogout() {
    try {
      await logout();
      navigate('/login', { replace: true });
      toast.success('Sessão encerrada.');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível encerrar a sessão.');
    }
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const cfg = await getConfig();
        setConfig(cfg);
        configForm.reset({
          pontualidade_default: cfg.pontualidade_default,
          timezone: cfg.timezone,
          instagram_posts: cfg.instagram.postsPerDay,
          instagram_stories: cfg.instagram.storiesPerDay
        });
        const sales = await getAllSalesByMonth(month);
        setSalesByUser(sales);
        const closure = await getClosure(month);
        setClosureInfo(closure);
      } catch (error) {
        console.error(error);
        toast.error('Erro ao carregar painel admin.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [month, reloadKey]);

  const totals = useMemo(() => {
    if (!config) return { vendas: 0, porUsuario: new Map<string, number>() };
    let vendas = 0;
    const map = new Map<string, number>();
    Object.entries(salesByUser).forEach(([uid, entries]) => {
      const sum = entries.reduce((acc, sale) => acc + sale.net, 0);
      map.set(uid, sum);
      vendas += sum;
    });
    return { vendas, porUsuario: map };
  }, [salesByUser, config]);

  const ranking = useMemo(() => {
    return Array.from(totals.porUsuario.entries())
      .map(([uid, value]) => ({ uid, value }))
      .sort((a, b) => b.value - a.value);
  }, [totals]);

  const chartLabels = ranking.map((item) => teamProfiles[item.uid] ?? item.uid);
  const chartValues = ranking.map((item) => Number(item.value.toFixed(2)));

  const commissionTable = useMemo(() => {
    if (!config) return [] as { uid: string; valor: number }[];
    return Object.entries(salesByUser).map(([uid, entries]) => {
      const total = entries.reduce((acc, sale) => {
        const map = calcCommissionForSale(config, sale.net, sale.sellerUid, config.team);
        return acc + (map[uid] ?? 0);
      }, 0);
      return { uid, valor: total };
    });
  }, [config, salesByUser]);

  const handleResetDay = async () => {
    if (!selectedUid) {
      toast.error('Selecione uma consultora.');
      return;
    }
    if (!resetDay) {
      toast.error('Informe o dia.');
      return;
    }
    const targetName = teamProfiles[selectedUid] ?? selectedUid;
    if (!window.confirm(`Remover IG, anuncios e vendas do dia ${resetDay} para ${targetName}?`)) {
      return;
    }
    setResetLoading((prev) => ({ ...prev, day: true }));
    try {
      await resetUserDay({ uid: selectedUid, date: resetDay });
      toast.success('Dados do dia resetados.');
      setLoading(true);
      setReloadKey((key) => key + 1);
    } catch (error) {
      console.error(error);
      toast.error('Falha ao resetar o dia.');
    } finally {
      setResetLoading((prev) => ({ ...prev, day: false }));
    }
  };

  const handleResetMonth = async () => {
    if (!selectedUid) {
      toast.error('Selecione uma consultora.');
      return;
    }
    if (!resetMonth) {
      toast.error('Informe o mes.');
      return;
    }
    const targetName = teamProfiles[selectedUid] ?? selectedUid;
    if (!window.confirm(`Remover dados do mes ${resetMonth} para ${targetName}?`)) {
      return;
    }
    setResetLoading((prev) => ({ ...prev, month: true }));
    try {
      await resetUserMonth({ uid: selectedUid, month: resetMonth });
      toast.success('Dados do mes resetados.');
      setLoading(true);
      setReloadKey((key) => key + 1);
    } catch (error) {
      console.error(error);
      toast.error('Falha ao resetar o mes.');
    } finally {
      setResetLoading((prev) => ({ ...prev, month: false }));
    }
  };

  const handleConfigSave = configForm.handleSubmit(async (values) => {
    if (!config) return;
    try {
      const updated: Config = {
        ...config,
        pontualidade_default: values.pontualidade_default,
        timezone: values.timezone,
        instagram: {
          ...config.instagram,
          postsPerDay: values.instagram_posts,
          storiesPerDay: values.instagram_stories
        }
      };
      await saveConfig(updated);
      setConfig(updated);
      toast.success('Configurações atualizadas.');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível salvar.');
    }
  });

  const handleClosure = closureForm.handleSubmit(async (values) => {
    if (!config) return;

    const normalizeRate = (value: number) => {
      if (!Number.isFinite(value)) return config.services?.base_min ?? 0;
      const rate = value > 1 ? value / 100 : value;
      return rate < 0 ? 0 : rate;
    };

    const adesaoCapa = normalizeRate(values.adesao_capa);
    const adesaoImper = normalizeRate(values.adesao_imper);

    const pontualidade: Record<string, number> = {
      uid_admin: values.pontualidade_admin,
      [config.team.coordinatorId]: values.pontualidade_coordenadora,
      ...values.pontualidade_vendedoras
    };

    const bonusMl: Record<string, number> = {};

    const rate = getFaturamentoRate(config, values.faturamento_sofas);
    const equipe = [config.team.coordinatorId, ...config.team.sellers];
    const bonusEquipe = rate > 0 ? (values.faturamento_sofas * rate) / equipe.length : 0;
    const bonus: Record<string, number> = {};
    equipe.forEach((uid) => {
      bonus[uid] = (bonus[uid] ?? 0) + bonusEquipe + (bonusMl[uid] ?? 0) + (pontualidade[uid] ?? config.pontualidade_default);
    });

    const payload: ClosurePayload = {
      month: values.month,
      adesao: { capa: adesaoCapa, impermeabilizacao: adesaoImper },
      faturamento_sofas: values.faturamento_sofas,
      pontualidade,
      mlWeeks: bonusMl,
      bonus
    };

    try {
      await publishClosure(payload);
      setClosureInfo(payload);
      toast.success('Fechamento publicado! Painéis notificados.');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao publicar fechamento.');
    }
  });

  if (!user || user.role !== 'admin') {
    return <div className="flex h-screen items-center justify-center text-lg">Acesso restrito ao administrador.</div>;
  }

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-lg">Carregando admin...</div>;
  }

  if (!config) {
    return <div className="flex h-screen items-center justify-center text-lg">Configuração ausente.</div>;
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-16">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Administração central</h1>
            <p className="text-sm text-slate-600">Configure regras, acompanhe o mes e publique o fechamento.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => window.print()}>
              Exportar visão
            </Button>
            <Button type="button" variant="ghost" onClick={handleLogout}>
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto mt-6 flex max-w-6xl flex-col gap-6 px-4">
        <Tabs defaultValue="dash">
          <TabsList className="bg-white">
            <TabsTrigger value="dash">Dashboard</TabsTrigger>
            <TabsTrigger value="config">Configurações</TabsTrigger>
            <TabsTrigger value="closure">Fechamento</TabsTrigger>
            <TabsTrigger value="maintenance">Manutenção</TabsTrigger>
          </TabsList>

          <TabsContent value="dash" className="space-y-6">
            <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader>
                  <CardDescription>Faturamento do mes</CardDescription>
                  <CardTitle>R$ {totals.vendas.toFixed(2)}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-500">Somatório de vendas lançadas no mes.</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardDescription>Bônus faturamento</CardDescription>
                  <CardTitle>{(getFaturamentoRate(config, totals.vendas) * 100).toFixed(2)}%</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-500">Rate aplicado sobre o total.</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardDescription>Semana atual</CardDescription>
                  <CardTitle>{week}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-500">Alinhe com as metas semanais de ML e IG.</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardDescription>Último fechamento</CardDescription>
                  <CardTitle>{closureInfo ? `Publicado em ${new Date(closureInfo.publishedAt ?? Date.now()).toLocaleDateString('pt-BR')}` : 'Pendente'}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-500">Mantenha a equipe informada até dia 5.</CardContent>
              </Card>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <Card className="p-6">
                <CardHeader>
                  <CardTitle>Ranking por vendas</CardTitle>
                  <CardDescription>Valores líquidos lançados.</CardDescription>
                </CardHeader>
                <CardContent>
                  <SimpleBarChart labels={chartLabels} values={chartValues} />
                </CardContent>
              </Card>
              <Card className="p-6">
                <CardHeader>
                  <CardTitle>Comissões estimadas</CardTitle>
                  <CardDescription>Somatório individual com base nas regras atuais.</CardDescription>
                </CardHeader>
                <CardContent>
                  <SimpleLineChart
                    labels={commissionTable.map((c) => teamProfiles[c.uid] ?? c.uid)}
                    values={commissionTable.map((c) => Number(c.valor.toFixed(2)))}
                  />
                </CardContent>
              </Card>
            </section>

            <section>
              <Card className="p-6">
                <CardHeader>
                  <CardTitle>Links Mercado Livre</CardTitle>
                  <CardDescription>Acompanhamento semanal em tempo real.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {availableUsers.map((uid) => {
                    const items = mlLinksByUser[uid] ?? [];
                    const displayName = teamProfiles[uid] ?? uid;
                    return (
                      <div key={uid} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between text-sm font-medium text-slate-800">
                          <span>{displayName}</span>
                          <span>{items.length} {items.length === 1 ? "link" : "links"}</span>
                        </div>
                        {items.length > 0 ? (
                          <ul className="mt-2 space-y-1 text-xs text-slate-600">
                            {items.slice(0, 10).map((item) => (
                              <li key={item.url} className="flex items-center justify-between gap-2">
                                <a href={item.url} target="_blank" rel="noreferrer" className="truncate text-blue-600 hover:underline">{item.url}</a>
                                <span className="whitespace-nowrap text-[10px] text-slate-400">{format(new Date(item.ts), "dd/MM HH:mm")}</span>
                              </li>
                            ))}
                            {items.length > 10 && (
                              <li className="text-[11px] text-slate-500">+ {items.length - 10} links</li>
                            )}
                          </ul>
                        ) : (
                          <p className="mt-2 text-xs text-slate-500">Nenhum link registrado nesta semana.</p>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </section>

            <section>
              <Card>
                <CardHeader>
                  <CardTitle>Observa��es r�pidas</CardTitle>
                  <CardDescription>Use este bloco para registrar decis�es internas.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea rows={5} placeholder="Resumo da reuni�o semanal, ajustes manuais, pend�ncias do fechamento..." />
                </CardContent>
              </Card>
            </section>
          </TabsContent>

          <TabsContent value="config">
            <Card>
              <CardHeader>
                <CardTitle>Configuração de regras</CardTitle>
                <CardDescription>Altere metas e padrões. Demais parâmetros devem ser ajustados via Firebase console.</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="grid gap-4 md:grid-cols-2" onSubmit={handleConfigSave}>
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-600">Timezone</label>
                    <Input {...configForm.register('timezone')} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-600">Pontualidade padrão (R$)</label>
                    <Input type="number" step="10" {...configForm.register('pontualidade_default', { valueAsNumber: true })} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-600">Posts por dia</label>
                    <Input type="number" {...configForm.register('instagram_posts', { valueAsNumber: true })} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-600">Stories por dia</label>
                    <Input type="number" {...configForm.register('instagram_stories', { valueAsNumber: true })} />
                  </div>
                  <div className="md:col-span-2">
                    <Button type="submit">Salvar alterações</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="closure">
            <Card>
              <CardHeader>
                <CardTitle>Fechamento mensal</CardTitle>
                <CardDescription>Confirme adesões, bônus e publique para liberar os parabéns do time.</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="grid gap-4 md:grid-cols-2" onSubmit={handleClosure}>
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-600">Mes</label>
                    <Input type="month" {...closureForm.register('month')} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-600">Faturamento sofás (R$)</label>
                    <Input type="number" step="1000" {...closureForm.register('faturamento_sofas', { valueAsNumber: true })} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-600">Adesão capas</label>
                    <Input type="number" step="0.01" {...closureForm.register('adesao_capa', { valueAsNumber: true })} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-600">Adesão impermeabilização</label>
                    <Input type="number" step="0.01" {...closureForm.register('adesao_imper', { valueAsNumber: true })} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold uppercase text-slate-600">Pontualidade coordenadora</label>
                    <Input type="number" {...closureForm.register('pontualidade_coordenadora', { valueAsNumber: true })} />
                  </div>
                  {config.team.sellers.map((seller) => (
                    <div key={seller} className="md:col-span-1">
                      <label className="text-xs font-semibold uppercase text-slate-600">Pontualidade {teamProfiles[seller] ?? seller}</label>
                      <Input
                        type="number"
                        {...closureForm.register(`pontualidade_vendedoras.${seller}` as const, { valueAsNumber: true })}
                      />
                    </div>
                  ))}
                  <div className="md:col-span-2">
                    <Button type="submit">Recalcular &amp; Publicar</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="maintenance">
            <Card>
              <CardHeader>
                <CardTitle>Manutenção de dados</CardTitle>
                <CardDescription>Use com cuidado: remove registros de Instagram, Mercado Livre e vendas.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-600">Consultora</label>
                  <select
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
                    value={selectedUid}
                    onChange={(event) => setSelectedUid(event.target.value)}
                    disabled={availableUsers.length === 0}
                  >
                    {availableUsers.length === 0 && <option value="">Sem consultoras cadastradas</option>}
                    {availableUsers.map((uid) => (
                      <option key={uid} value={uid}>
                        {teamProfiles[uid] ?? uid}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-3 md:grid-cols-3 md:items-end">
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-600">Dia</label>
                    <Input type="date" value={resetDay} onChange={(event) => setResetDay(event.target.value)} />
                  </div>
                  <div className="md:col-span-2 flex items-end gap-3">
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={!selectedUid || resetLoading.day}
                      onClick={handleResetDay}
                    >
                      {resetLoading.day ? 'Limpando...' : 'Zerar dia'}
                    </Button>
                    <p className="text-xs text-slate-500">Remove posts, stories, anuncios e vendas do dia selecionado.</p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3 md:items-end">
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-600">Mes</label>
                    <Input type="month" value={resetMonth} onChange={(event) => setResetMonth(event.target.value)} />
                  </div>
                  <div className="md:col-span-2 flex items-end gap-3">
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={!selectedUid || resetLoading.month}
                      onClick={handleResetMonth}
                    >
                      {resetLoading.month ? 'Limpando...' : 'Zerar mes'}
                    </Button>
                    <p className="text-xs text-slate-500">Apaga os registros do mes inteiro, incluindo semanas do Mercado Livre.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}





