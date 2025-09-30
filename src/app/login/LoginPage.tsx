import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';

const schema = z.object({
  email: z.string().email('Informe um e-mail válido'),
  password: z.string().min(6, 'Senha com mínimo 6 caracteres')
});

type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const { login, status, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === 'authenticated' && user) {
      navigate(user.role === 'admin' ? '/admin' : '/painel', { replace: true });
    }
  }, [status, user, navigate]);

  const form = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await login(data.email, data.password);
      toast.success('Bem-vinda de volta!');
      navigate('/painel');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível entrar. Verifique as credenciais.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-100 via-white to-brand-200 p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="w-full max-w-md">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>Painel dos Consultores</CardTitle>
            <CardDescription>Entre com seu e-mail corporativo para acessar seu painel personalizado.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">E-mail</label>
                <Input type="email" placeholder="nome@empresa.com" {...form.register('email')} />
                {form.formState.errors.email && <p className="mt-1 text-xs text-red-500">{form.formState.errors.email.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Senha</label>
                <Input type="password" placeholder="••••••" {...form.register('password')} />
                {form.formState.errors.password && <p className="mt-1 text-xs text-red-500">{form.formState.errors.password.message}</p>}
              </div>
              <Button type="submit" disabled={loading} className="mt-2">
                {loading ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>
            <p className="mt-6 text-center text-xs text-slate-500">
              Time Ralph Couch · Fuso fixo America/Sao_Paulo · Segurança em primeiro lugar
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
