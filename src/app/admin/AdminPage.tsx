import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useAuth } from '../../hooks/useAuth';
import { Config, Sale } from '../../types';
import { getConfig, saveConfig } from '../../services/config';
import { getAllSalesByMonth } from '../../services/sales';
import { getClosure, publishClosure, type ClosurePayload } from '../../services/closures';
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
  adesao_capa: z.number().min(0).max(1),
  adesao_imper: z.number().min(0).max(1),
  faturamento_sofas: z.number().min(0),
  pontualidade_admin: z.number().min(0),
  pontualidade_coordenadora: z.number().min(0),
  pontualidade_vendedoras: z.record(z.string(), z.number().min(0))
});

type ClosureForm = z.infer<typeof closureSchema>;

type ConfigForm = z.infer<typeof configSchema>;

export function AdminPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState<Config | null>(null);
  const [salesByUser, setSalesByUser] = useState<Record<string, Sale[]>>({});
  const [loading, setLoading] = useState(true);
  const [closureInfo, setClosureInfo] = useState<ClosurePayload | null>(null);

  const month = formatDate(getNow(), 'yyyy-MM');
  const week = getWeekKey(getNow());

  const configForm = useForm<ConfigForm>({
    resolver: zodResolver(configSchema),
    defaultValues: { pontualidade_default: 150, timezone: 'America/Sao_Paulo', instagram_posts: 1, instagram_stories: 10 }
  });

  const closureForm = useForm<ClosureForm>({
    resolver: zodResolver(closureSchema),
    defaultValues: {
      month,
      adesao_capa: 0.2,
      adesao_imper: 0.5,
      faturamento_sofas: 150000,
      pontualidade_admin: 150,
      pontualidade_coordenadora: 150,
      pontualidade_vendedoras: {}
    }
  });

  useEffect(() => {
    async function load() {
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
  }, [month]);

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

  const chartLabels = ranking.map((item) => item.uid);
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
    const pontualidade: Record<string, number> = {
      uid_admin: values.pontualidade_admin,
      [config.team.coordinatorId]: values.pontualidade_coordenadora,
      ...values.pontualidade_vendedoras
    };

    const bonusMl: Record<string, number> = {};
    Object.entries(salesByUser).forEach(([uid]) => {
      // Placeholder: admin preenche manualmente
      bonusMl[uid] = calcMlWeeklyBonus(config, 0);
    });

    const rate = getFaturamentoRate(config, values.faturamento_sofas);
    const equipe = [config.team.coordinatorId, ...config.team.sellers];
    const bonusEquipe = rate > 0 ? (values.faturamento_sofas * rate) / equipe.length : 0;
    const bonus: Record<string, number> = {};
    equipe.forEach((uid) => {
      bonus[uid] = (bonus[uid] ?? 0) + bonusEquipe + (bonusMl[uid] ?? 0) + (pontualidade[uid] ?? config.pontualidade_default);
    });

    const payload: ClosurePayload = {
      month: values.month,
      adesao: { capa: values.adesao_capa, impermeabilizacao: values.adesao_imper },
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
            <p className="text-sm text-slate-600">Configure regras, acompanhe o mês e publique o fechamento.</p>
          </div>
          <Button variant="outline" onClick={() => window.print()}>
            Exportar visão
          </Button>
        </div>
      </header>

      <main className="mx-auto mt-6 flex max-w-6xl flex-col gap-6 px-4">
        <Tabs defaultValue="dash">
          <TabsList className="bg-white">
            <TabsTrigger value="dash">Dashboard</TabsTrigger>
            <TabsTrigger value="config">Configurações</TabsTrigger>
            <TabsTrigger value="closure">Fechamento</TabsTrigger>
          </TabsList>

          <TabsContent value="dash" className="space-y-6">
            <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader>
                  <CardDescription>Faturamento do mês</CardDescription>
                  <CardTitle>R$ {totals.vendas.toFixed(2)}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-500">Somatório de vendas lançadas no mês.</CardContent>
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
                    labels={commissionTable.map((c) => c.uid)}
                    values={commissionTable.map((c) => Number(c.valor.toFixed(2)))}
                  />
                </CardContent>
              </Card>
            </section>

            <section>
              <Card>
                <CardHeader>
                  <CardTitle>Observações rápidas</CardTitle>
                  <CardDescription>Use este bloco para registrar decisões internas.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea rows={5} placeholder="Resumo da reunião semanal, ajustes manuais, pendências do fechamento..." />
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
                    <label className="text-xs font-semibold uppercase text-slate-600">Mês</label>
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
                      <label className="text-xs font-semibold uppercase text-slate-600">Pontualidade {seller}</label>
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
        </Tabs>
      </main>
    </div>
  );
}
