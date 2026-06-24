# Natur Erva ERP – Frontend

React 19 + Vite 6 + TypeScript. Backend: Supabase (sem servidor próprio).

## Como correr

- **Desenvolvimento:** `npm run dev` (raiz do projeto)
- **Build:** `npm run build`
- **Testes:** `npm run test` (watch) ou `npm run test:run` (uma vez)

Para testes, instale as dependências: `npm install` (inclui vitest, jsdom, @testing-library/react).

## Estrutura

- **`modules/`** – Módulos por domínio: `admin`, `auth`, `core`, `customers`, `media`, `products`, `sales`, `series`, `shop`.
- **`modules/core/`** – Serviços partilhados (`dataService`, `locationService`), tipos (`types/`), rotas admin (`routes/adminRoutes.ts`), contextos (Language, Toast, Location), layout e páginas base.
- **`components/`** – Layouts (`AdminLayout`, `PublicLayout`), `ErrorBoundary`, redirecionamentos.
- **Rotas:** Públicas em `/`, `/loja`, `/series/*`; área admin em `/admin/*` (mapeamento em `modules/core/routes/adminRoutes.ts`).

## Configuração Supabase

Variáveis de ambiente na raiz (`.env`). Cliente Supabase em `modules/core/services/supabaseClient.ts`.

## Contextos principais

- **ShopContext** – Modo loja (UI loja vs admin).
- **LanguageContext** – Idioma da UI.
- **LocationContext** – Localização ativa (multi-tenant).
- **ToastContext** – Notificações (`useToast()`).
- **DashboardPreferencesProvider** – Preferências do dashboard.
- **Auth** – Estado de sessão e navegação via `useAppAuth()` (em `modules/auth/hooks/useAppAuth.ts`).

## Error Boundaries

Um Error Boundary envolve a área admin e outro as rotas públicas. Em caso de erro numa página, é mostrada uma mensagem amigável e opção de voltar, em vez de tela branca.
