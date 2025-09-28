# Painel dos Consultores – Ralph Couch

Painel web motivacional e operacional para o time de consultoria Ralph Couch. Construído com React 18, TypeScript e Vite, usando Tailwind + shadcn/ui, animações com Framer Motion, gráficos Chart.js e persistência híbrida (Firebase Realtime Database/Auth + localStorage).

## Tecnologias

- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Firebase Auth + Realtime Database
- Framer Motion, canvas-confetti e sonner
- Chart.js (via react-chartjs-2)
- date-fns + date-fns-tz (timezone fixa America/Sao_Paulo)

## Estrutura de pastas

```
src/
 ├─ app/
 │   ├─ login/
 │   ├─ painel/
 │   └─ admin/
 ├─ components/
 ├─ hooks/
 ├─ lib/
 ├─ services/
 ├─ types/
 └─ styles/
```

## Configuração

1. Instale dependências:

```bash
npm install
```

2. Crie um arquivo `.env` na raiz com as credenciais do Firebase (SDK Web modular):

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
# Opcional: use em desenvolvimento com emuladores locais
VITE_USE_FIREBASE_EMULATORS=true
```

As variáveis estão exemplificadas em `.env.example`.

3. Configure o Firebase:
   - Ative Authentication com método Email/Senha e crie os usuários: admin, Leticia, Nayara, Nathalia.
   - No Realtime Database, importe `seed/initial-data.json` para criar `config/` e `users/` iniciais.
   - Publique as regras do RTDB presentes em `firebase.database.rules.json`.

## Scripts

- `npm run dev` – inicia o Vite em modo desenvolvimento (porta 5173 por padrão).
- `npm run build` – executa `tsc` e gera o build de produção.
- `npm run preview` – serve o build de produção para conferência local.

## Fluxos principais

- **/login** – autenticação via email/senha e roteamento por papel (admin, coordenadora, vendedora).
- **/painel** – painel motivacional para consultoras e coordenadora com planner IG manual, registro de vendas, links Mercado Livre, ferramentas de texto, notas e pendências (persistência local com export/import).
- **/admin** – visão exclusiva do administrador com dashboards de vendas e comissões, atualização de parâmetros principais e rotina de fechamento (dia 5).

## LocalStorage

Dados pessoais ficam no navegador, com namespace por usuária:

- `rc_templates_user`
- `rc_quickfields_user`
- `rc_notas_user`
- `rc_pendencias_user`

Utilize os botões de exportar/importar para backup manual.

## Deploy

Recomendado Firebase Hosting. Após `npm run build`, faça `firebase deploy --only hosting` configurando o diretório `dist/`.

## Credenciais iniciais sugeridas

| Nome      | Papel        | Email (exemplo)           |
|-----------|--------------|---------------------------|
| Admin     | admin        | admin@ralphcouch.com      |
| Leticia   | coordenadora | leticia@ralphcouch.com    |
| Nayara    | vendedora    | nayara@ralphcouch.com     |
| Nathalia  | vendedora    | nathalia@ralphcouch.com   |

Defina senhas seguras e compartilhe individualmente.

## Timezone

Todas as datas são calculadas fixando o fuso `America/Sao_Paulo` (ver utilitário em `src/lib/time.ts`).
