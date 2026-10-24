/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** 'true' turns the mock payment on in a production build (e.g. a Pages preview). */
  readonly VITE_MOCK_PAYMENTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
