import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getIndexDb(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.INDEX_SUPABASE_URL!,
      process.env.INDEX_SUPABASE_SERVICE_KEY!
    );
  }
  return _client;
}
