/**
 * route.ts
 *
 * Next.js App Router POST /api/render endpoint.
 * Validates request payload against RenderRequestSchema and enqueues job into
 * the background RenderService without blocking the HTTP request (Rule 8).
 *
 * Returns HTTP 202 Accepted with pollUrl.
 */

import { NextRequest, NextResponse } from 'next/server';
import { RenderRequestSchema, renderService } from '../../../lib/render';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        {
          error: 'Cuerpo de petición JSON inválido',
          message: 'Invalid JSON request payload',
        },
        { status: 400 }
      );
    }

    const validation = RenderRequestSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Parámetros de renderizado inválidos',
          issues: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const renderRequest = validation.data;

    let job;
    try {
      job = renderService.enqueue(renderRequest);
    } catch (enqueueErr) {
      const msg = enqueueErr instanceof Error ? enqueueErr.message : String(enqueueErr);
      if (msg.includes('capacity exceeded')) {
        return NextResponse.json(
          {
            error: 'Cola de renderizado saturada',
            message: msg,
          },
          { status: 429 }
        );
      }
      throw enqueueErr;
    }

    return NextResponse.json(
      {
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        compositionId: job.compositionId,
        pollUrl: `/api/render/${job.id}`,
        createdAt: job.createdAt,
      },
      { status: 202 }
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: 'Error interno en el servicio de renderizado',
        message: errorMsg,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  const jobs = renderService.listJobs();
  return NextResponse.json(
    {
      total: jobs.length,
      jobs: jobs.map((j) => ({
        id: j.id,
        status: j.status,
        progress: j.progress,
        compositionId: j.compositionId,
        createdAt: j.createdAt,
        downloadUrl: j.downloadUrl,
      })),
    },
    { status: 200 }
  );
}
