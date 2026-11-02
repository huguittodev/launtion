/**
 * src/app/api/projects/route.ts
 *
 * GET: Lists authenticated user's projects.
 * POST: Validates SceneGraph via Zod and creates a new project under the authenticated user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { CreateProjectSchema } from '../../../lib/supabase/schema';
import { getAuthenticatedUser } from '../../../lib/supabase/server';
import { getPersistenceAdapter } from '../../../lib/supabase/persistence-adapter';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const adapter = getPersistenceAdapter();
    const projects = await adapter.listProjects(user.id);

    return NextResponse.json(
      {
        total: projects.length,
        projects,
      },
      { status: 200 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Error interno al consultar proyectos', message: msg },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'JSON de petición inválido' }, { status: 400 });
    }

    const parsed = CreateProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Datos de proyecto inválidos',
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const adapter = getPersistenceAdapter();
    const project = await adapter.createProject(user.id, parsed.data);

    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Error interno al crear proyecto', message: msg },
      { status: 500 }
    );
  }
}
