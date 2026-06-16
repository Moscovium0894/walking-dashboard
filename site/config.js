// Supabase connection for the dashboard.
// These two values are SAFE to expose in client-side code: the publishable key
// only works within the row-level security rules (signed-in users only), so it
// cannot leak data. The secret service_role key is NEVER put here.
export const SUPABASE_URL = "https://qmfnuzidbaqvxiehpywl.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_zCC6mE-X0BS9EYIjsy7Quw_lxQfZ4pn";
