/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string
    readonly VITE_SUPABASE_ANON_KEY: string
    readonly VITE_ESEWA_MERCHANT_CODE: string
    readonly VITE_ESEWA_SECRET_KEY: string
    readonly VITE_ESEWA_PAYMENT_URL: string
    readonly VITE_ESEWA_SUCCESS_URL: string
    readonly VITE_ESEWA_FAILURE_URL: string
    readonly VITE_FIREBASE_API_KEY: string
    readonly VITE_FIREBASE_VAPID_KEY: string
    readonly VITE_SENTRY_DSN: string
    readonly VITE_POSTHOG_KEY: string
  }
  
  interface ImportMeta {
    readonly env: ImportMetaEnv
  }