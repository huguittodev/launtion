/**
 * [id]/route.ts
 *
 * Next.js App Router GET & DELETE endpoint for polling render job status and cancellation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { renderService } from '../../../../lib/render';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

export async function GET(
  _req: NextRequest,
  context: RouteContext
) {
  const { id } = await Promise.resolve(context.params);

  const job = renderService.getJob(id);
  if (!job) {
    return NextResponse.json(
      {
        error: 'Trabajo de renderizado no encontrado',
        message: `Render job "${id}" not found`,
        jobId: id,
      },
      { status: 404 }
    );
  }

  return NextResponse.json(
    {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      framesRendered: job.framesRendered,
      totalFrames: job.totalFrames,
      renderedBytes: job.renderedBytes,
      currentStage: job.currentStage,
      downloadUrl: job.status === 'completed' ? job.downloadUrl : null,
      error: job.error ?? null,
      createdAt: job.createdAt,
      startedAt: job.startedAt ?? null,
      completedAt: job.completedAt ?? null,
      durationMs: job.durationMs ?? null,
    },
    { status: 200 }
  );
}

export async function DELETE(
  _req: NextRequest,
  context: RouteContext
) {
  const { id } = await Promise.resolve(context.params);

  const job = renderService.getJob(id);
  if (!job) {
    return NextResponse.json(
      {
        error: 'Trabajo de renderizado no encontrado',
        message: `Render job "${id}" not found`,
        jobId: id,
      },
      { status: 404 }
    );
  }

  const cancelled = renderService.cancel(id);

  return NextResponse.json(
    {
      success: cancelled,
      jobId: id,
      status: renderService.getJob(id)?.status ?? 'cancelled',
    },
    { status: 200 }
  );
}
