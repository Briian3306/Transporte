/**
 * Supabase CLI (local Docker). Used by `pnpm dev` / `npm run dev`.
 * Default demo anon key from `supabase start` — safe for local only.
 */
export const environment = {
  production: false,
  supabaseUrl: 'http://127.0.0.1:54321',
  supabaseKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
  apiUrl: 'https://demo.tpteibarra.ar',
  authToken: 'Token f2c32fcec0dd24163a468d95335571292af6732e'
};
