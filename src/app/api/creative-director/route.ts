/**
 * route.ts
 *
 * Secure Next.js App Router POST endpoint for Creative Director generation.
 * Validates request payload against ProductBriefSchema, communicates with Gemini,
 * or transparently triggers deterministic fallback synthesis.
 *
 * Never leaks server secrets or fails with 500 when external AI APIs are unreachable.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  ProductBriefSchema,
  generateCreativeDirectorSceneGraph,
  generateDeterministicSceneGraph,
} from '../../../lib/ai';

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

    const briefValidation = ProductBriefSchema.safeParse(rawBody);

    if (!briefValidation.success) {
      return NextResponse.json(
        {
          error: 'Datos del producto inválidos',
          issues: briefValidation.error.issues,
        },
        { status: 400 }
      );
    }

    const brief = briefValidation.data;
    const result = await generateCreativeDirectorSceneGraph(brief);

    return NextResponse.json(
      {
        success: true,
        source: result.source,
        model: result.model,
        reason: result.reason,
        latencyMs: result.latencyMs,
        sceneGraph: result.sceneGraph,
      },
      { status: 200 }
    );
  } catch (fatalErr: unknown) {
    console.error('[CreativeDirector] Unhandled error in route handler:', fatalErr);

    const safeFallback = generateDeterministicSceneGraph({
      productName: 'Studio Demo',
      description: 'High performance automated video motion generation',
    });

    return NextResponse.json(
      {
        success: true,
        source: 'deterministic-fallback',
        reason: fatalErr instanceof Error ? fatalErr.message : 'INTERNAL_EXCEPTION',
        sceneGraph: safeFallback,
      },
      { status: 200 }
    );
  }
}
