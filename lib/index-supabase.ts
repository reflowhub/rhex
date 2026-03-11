import { createClient } from "@supabase/supabase-js";

export const indexDb = createClient(
  process.env.INDEX_SUPABASE_URL!,
  process.env.INDEX_SUPABASE_SERVICE_KEY!
);
