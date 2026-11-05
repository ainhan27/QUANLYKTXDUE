// ==============================================================================
// SUPABASE ADMIN CLIENT (SERVICE ROLE - CHỈ DÙNG PHÍA SERVER)
// ==============================================================================

import { createClient } from '@supabase/supabase-js';

// Dùng cho Server Actions cần quyền cao (ví dụ: ghi ai_logs, gửi batch email, auto-reject)
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
