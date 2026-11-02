/**
 * download/route.ts
 *
 * Next.js App Router GET endpoint for streaming rendered MP4 video.
 * Supports HTTP Range requests (206 Partial Content) for video scrubbing and preview.
 */

import fs from 'node:fs';
import { Readable } from 'node:stream';
import { NextRequest, NextResponse } from 'next/server';
import { renderService } from '../../../../../lib/render';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

export async function GET(
  req: NextRequest,
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

  if (job.status !== 'completed') {
    return NextResponse.json(
      {
        error: 'El vídeo aún no ha finalizado su renderizado',
        message: `Render job is not completed. Current status: ${job.status}`,
        status: job.status,
        progress: job.progress,
      },
      { status: 409 }
    );
  }

  if (!job.outputPath || !fs.existsSync(job.outputPath)) {
    return NextResponse.json(
      {
        error: 'El archivo MP4 renderizado no existe en disco',
        message: 'Rendered MP4 file has expired or was removed from disk',
      },
      { status: 410 }
    );
  }

  const stat = fs.statSync(job.outputPath);
  const fileSize = stat.size;
  const filename = `launtion-${job.compositionId}-${job.id}.mp4`;

  const rangeHeader = req.headers.get('range');

  if (rangeHeader && rangeHeader.startsWith('bytes=')) {
    const parts = rangeHeader.replace(/bytes=/, '').split('-');
    const rawStart = parts[0];
    const rawEnd = parts[1];

    let start = rawStart ? parseInt(rawStart, 10) : 0;
    let end = rawEnd ? parseInt(rawEnd, 10) : fileSize - 1;

    if (isNaN(start)) start = 0;
    if (isNaN(end) || end >= fileSize) end = fileSize - 1;

    if (start > end || start >= fileSize) {
      return new Response(null, {
        status: 416,
        headers: {
          'Content-Range': `bytes */${fileSize}`,
        },
      });
    }

    const chunkSize = end - start + 1;
    const fileStream = fs.createReadStream(job.outputPath, { start, end });
    const webStream = Readable.toWeb(fileStream);

    return new Response(webStream as unknown as BodyInit, {
      status: 206,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize.toString(),
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  }

  // Full file streaming (200 OK)
  const fileStream = fs.createReadStream(job.outputPath);
  const webStream = Readable.toWeb(fileStream);

  return new Response(webStream as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': fileSize.toString(),
      'Accept-Ranges': 'bytes',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
