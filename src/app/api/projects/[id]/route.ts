/**
 * src/app/api/projects/[id]/route.ts
 *
 * GET: Fetches full project and SceneGraph for authenticated owner.
 * PUT: Updates name or SceneGraph.
 * DELETE: Deletes project.
 */

import { NextRequest, NextResponse } from 'next/server';
import { UpdateProjectSchema } from '../../../../lib/supabase/schema';
import { getAuthenticatedUser } from '../../../../lib/supabase/server';
import { getPersistenceAdapter } from '../../../../lib/supabase/persistence-adapter';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const resolvedParams = await Promise.resolve(context.params);
    const id = resolvedParams.id;
    const adapter = getPersistenceAdapter();
    const project = await adapter.getProject(user.id, id);

    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ project }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Error al obtener proyecto', message: msg },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const resolvedParams = await Promise.resolve(context.params);
    const id = resolvedParams.id;
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'JSON de petición inválido' }, { status: 400 });
    }

    const parsed = UpdateProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Datos de actualización inválidos',
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const adapter = getPersistenceAdapter();
    const updated = await adapter.updateProject(user.id, id, parsed.data);

    if (!updated) {
      return NextResponse.json(
        { error: 'Proyecto no encontrado o sin autorización' },
        { status: 404 }
      );
    }

    return NextResponse.json({ project: updated }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Error al actualizar proyecto', message: msg },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const resolvedParams = await Promise.resolve(context.params);
    const id = resolvedParams.id;
    const adapter = getPersistenceAdapter();
    const success = await adapter.deleteProject(user.id, id);

    if (!success) {
      return NextResponse.json(
        { error: 'Proyecto no encontrado o sin autorización' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, message: 'Proyecto eliminado exitosamente' },
      { status: 200 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Error al eliminar proyecto', message: msg },
      { status: 500 }
    );
  }
}
