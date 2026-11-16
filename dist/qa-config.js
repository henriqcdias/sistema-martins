(() => {
  const url = 'https://oczxyiakpmgnrpoyhwov.supabase.co';
  const key = window.MARTINS_QA_PUBLISHABLE_KEY || '';
  window.MARTINS_SUPABASE_ENV_CONFIG = Object.freeze({
    VITE_MARTINS_ENV: 'HOMOLOGACAO',
    VITE_SUPABASE_HOMOLOG_URL: url,
    VITE_SUPABASE_HOMOLOG_ANON_KEY: /^sb_publishable_[A-Za-z0-9_-]+$/.test(key) ? key : ''
  });
  delete window.MARTINS_QA_PUBLISHABLE_KEY;
})();
