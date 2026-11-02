/**
 * src/app/api/input-intelligence/route.ts
 *
 * Secure Next.js App Router POST endpoint for Phase 5 Input Intelligence (Multimodal Analysis).
 * Accepts screenshots (PNG, JPG, WebP) and video clips (MP4) in base64.
 *
 * Validates payload size (<= 20MB) and format with strict Zod schema.
 * Executes Gemini 2.5 Flash Vision multimodal detection or engages deterministic fallback.
 * Returns synthesized visual landmarks, inferred InteractionMap, and adapted SceneGraph.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  InputIntelligencePayloadSchema,
  analyzeMediaWithGeminiVision,
  generateDeterministicVisualFallback,
} from '../../../lib/input-intelligence';

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

    const validation = InputIntelligencePayloadSchema.safeParse(rawBody);

    if (!validation.success) {
      const isSizeError = validation.error.issues.some((issue) =>
        issue.message.toLowerCase().includes('20mb')
      );

      return NextResponse.json(
        {
          error: isSizeError
            ? 'File size exceeds maximum 20MB limit'
            : 'Invalid request payload',
          issues: validation.error.issues,
        },
        { status: isSizeError ? 413 : 400 }
      );
    }

    const result = await analyzeMediaWithGeminiVision(validation.data);

    return NextResponse.json(
      {
        success: true,
        source: result.source,
        model: result.model,
        reason: result.reason,
        latencyMs: result.latencyMs,
        summary: result.summary,
        landmarks: result.landmarks,
        detectedElements: result.detectedElements,
        interactionMap: result.interactionMap,
        sceneGraph: result.sceneGraph,
        asset: result.asset,
      },
      { status: 200 }
    );
  } catch (fatalErr: unknown) {
    console.error('[InputIntelligence] Unhandled exception in route handler:', fatalErr);

    const safeFallback = generateDeterministicVisualFallback({
      reason: fatalErr instanceof Error ? fatalErr.message : 'INTERNAL_EXCEPTION',
    });

    return NextResponse.json(
      {
        success: true,
        source: 'deterministic-fallback',
        reason: safeFallback.reason,
        latencyMs: safeFallback.latencyMs,
        summary: safeFallback.summary,
        landmarks: safeFallback.landmarks,
        detectedElements: safeFallback.detectedElements,
        interactionMap: safeFallback.interactionMap,
        sceneGraph: safeFallback.sceneGraph,
      },
      { status: 200 }
    );
  }
}
