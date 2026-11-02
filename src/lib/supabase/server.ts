/**
 * server.ts
 *
 * Server-side Supabase client for Next.js App Router (Route Handlers & Server Components).
 * Employs cookies for session authentication and isolates service_role access.
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './types';
import type { NextRequest } from 'next/server';

export async function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  let cookieStore: Awaited<ReturnType<typeof cookies>> | null = null;
  try {
    cookieStore = await cookies();
  } catch {
    // Gracefully handle invocation outside active Next.js request context
  }

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore?.getAll() ?? [];
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore?.set(name, value, options);
          });
        } catch {
          // Can be safely ignored if called from a Server Component
        }
      },
    },
  });
}

/**
 * Admin client using SUPABASE_SERVICE_ROLE_KEY.
 * STRICTLY FOR SERVER/WORKER ONLY. NEVER EXPOSE TO CLIENT (Rule 5).
 */
export function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createServerClient<Database>(url, serviceRoleKey, {
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
  });
}

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

/**
 * Extracts authenticated user from request session.
 * In offline/mock mode or when live Supabase is unconfigured, returns deterministic mock user.
 */
export async function getAuthenticatedUser(req?: NextRequest): Promise<AuthenticatedUser | null> {
  const isMock = process.env.MOCK_SUPABASE === 'true' || !process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (isMock) {
    // Check for explicit unauthenticated simulation
    const authHeader = req?.headers.get('authorization');
    if (authHeader && authHeader.includes('Bearer invalid')) {
      return null;
    }
    // Allow custom mock user via header for testing multi-tenant isolation
    const customUserId = req?.headers.get('x-user-id');
    const customUserEmail = req?.headers.get('x-user-email');

    return {
      id: customUserId || '00000000-0000-0000-0000-000000000001',
      email: customUserEmail || 'founder@launtion.demo',
    };
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  return {
    id: user.id,
    email: user.email,
  };
}
