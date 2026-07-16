import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase con la secret key (sb_secret_...).
 * Alto privilegio: salta RLS. Se usa exclusivamente en el backend para
 * validar el JWT emitido por Supabase Auth. NO se expone al frontend.
 */
@Injectable()
export class SupabaseService {
  readonly client: SupabaseClient;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY;

    if (!url || !secretKey) {
      throw new Error(
        'Faltan SUPABASE_URL o SUPABASE_SECRET_KEY en el entorno.',
      );
    }

    this.client = createClient(url, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
}
