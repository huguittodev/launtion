'use client';

/**
 * TextCustomizer.tsx
 *
 * Visual customizer panel for copy and narrative texts across all SceneGraph scenes.
 * Enforces character limits, displays remaining capacity, and triggers
 * deterministic UPDATE_TEXT action dispatches.
 */

import React, { useMemo } from 'react';
import type { SceneGraph } from '../../lib/scene-graph/types';

export interface TextCustomizerProps {
  sceneGraph: SceneGraph;
  onUpdateText: (field: string, value: string | string[], sceneId?: string) => void;
}

export const TextCustomizer: React.FC<TextCustomizerProps> = ({
  sceneGraph,
  onUpdateText,
}) => {
  // Extract values from existing scenes
  const textValues = useMemo(() => {
    let windowTitle = 'Base44 SaaS Studio — Dynamic Surface';
    let textToType = 'I want to build a bike renting app with real-time terrain tracking';
    let buttonText = 'Publish';
    let productName = 'Base44';
    let tagline = 'Build it your way';
    let codeTitle = 'Base44 Architecture • Fleet Engine';
    let headline = 'MODULAR ARCHITECTURE';

    for (const scene of sceneGraph.scenes) {
      const p = scene.payload as Record<string, unknown>;
      if (!p) continue;
      if (typeof p.windowTitle === 'string') windowTitle = p.windowTitle;
      if (typeof p.textToType === 'string') textToType = p.textToType;
      else if (typeof p.promptText === 'string') textToType = p.promptText;
      if (typeof p.buttonText === 'string') buttonText = p.buttonText;
      if (typeof p.productName === 'string') productName = p.productName;
      if (typeof p.tagline === 'string') tagline = p.tagline;
      if (typeof p.title === 'string') codeTitle = p.title;
      if (typeof p.headline === 'string') headline = p.headline;
    }

    return {
      windowTitle,
      textToType,
      buttonText,
      productName,
      tagline,
      codeTitle,
      headline,
    };
  }, [sceneGraph]);

  return (
    <div className="flex flex-col gap-6 text-sm">
      <div>
        <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
          <span>✍️</span>
          <span>Textos & Copy Publicitario</span>
        </h3>
        <p className="text-xs text-neutral-400">
          Personaliza los textos mostrados en la interfaz y narrativa del anuncio publicitario.
        </p>
      </div>

      {/* 1. Window Title */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <label htmlFor="windowTitle" className="font-medium text-neutral-300">
            Título de Ventana (SaaS Surface)
          </label>
          <span className="font-mono text-neutral-500 text-[11px]">
            {textValues.windowTitle.length}/80
          </span>
        </div>
        <input
          id="windowTitle"
          type="text"
          maxLength={80}
          value={textValues.windowTitle}
          onChange={(e) => onUpdateText('windowTitle', e.target.value)}
          className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white text-xs placeholder-neutral-600 focus:outline-none focus:border-[#FF5C35]"
          placeholder="Ej: Base44 Studio — Dynamic Surface"
        />
      </div>

      {/* 2. Prompt Typer Text */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <label htmlFor="textToType" className="font-medium text-neutral-300">
            Texto del Prompt Box (IA)
          </label>
          <span className="font-mono text-neutral-500 text-[11px]">
            {textValues.textToType.length}/200
          </span>
        </div>
        <textarea
          id="textToType"
          rows={3}
          maxLength={200}
          value={textValues.textToType}
          onChange={(e) => onUpdateText('textToType', e.target.value)}
          className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white text-xs placeholder-neutral-600 focus:outline-none focus:border-[#FF5C35] resize-none"
          placeholder="Ej: I want to build a bike renting app with real-time terrain tracking"
        />
      </div>

      {/* 3. Hero Button Label */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <label htmlFor="buttonText" className="font-medium text-neutral-300">
            Etiqueta del Botón Principal (Hero CTA)
          </label>
          <span className="font-mono text-neutral-500 text-[11px]">
            {textValues.buttonText.length}/30
          </span>
        </div>
        <input
          id="buttonText"
          type="text"
          maxLength={30}
          value={textValues.buttonText}
          onChange={(e) => onUpdateText('buttonText', e.target.value)}
          className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white text-xs placeholder-neutral-600 focus:outline-none focus:border-[#FF5C35]"
          placeholder="Ej: Publish"
        />
      </div>

      {/* 4. Brand & Closing CTA */}
      <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col gap-4">
        <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
          Cierre de Marca (Closing CTA)
        </span>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="productName" className="font-medium text-neutral-400">
              Nombre de Producto
            </label>
            <span className="font-mono text-neutral-500 text-[11px]">
              {textValues.productName.length}/50
            </span>
          </div>
          <input
            id="productName"
            type="text"
            maxLength={50}
            value={textValues.productName}
            onChange={(e) => onUpdateText('productName', e.target.value)}
            className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white text-xs placeholder-neutral-600 focus:outline-none focus:border-[#FF5C35]"
            placeholder="Ej: Base44"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="tagline" className="font-medium text-neutral-400">
              Eslogan / Tagline
            </label>
            <span className="font-mono text-neutral-500 text-[11px]">
              {textValues.tagline.length}/100
            </span>
          </div>
          <input
            id="tagline"
            type="text"
            maxLength={100}
            value={textValues.tagline}
            onChange={(e) => onUpdateText('tagline', e.target.value)}
            className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white text-xs placeholder-neutral-600 focus:outline-none focus:border-[#FF5C35]"
            placeholder="Ej: Build it your way"
          />
        </div>
      </div>

      {/* 5. Additional Elements (Code & Headline) */}
      <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col gap-4">
        <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
          Micro-Escenas Sintéticas
        </span>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="codeTitle" className="font-medium text-neutral-400">
              Título Árbol de Código
            </label>
            <span className="font-mono text-neutral-500 text-[11px]">
              {textValues.codeTitle.length}/50
            </span>
          </div>
          <input
            id="codeTitle"
            type="text"
            maxLength={50}
            value={textValues.codeTitle}
            onChange={(e) => onUpdateText('title', e.target.value)}
            className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white text-xs placeholder-neutral-600 focus:outline-none focus:border-[#FF5C35]"
            placeholder="Ej: Base44 Architecture • Fleet Engine"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="headline" className="font-medium text-neutral-400">
              Titular Matriz de Iconos
            </label>
            <span className="font-mono text-neutral-500 text-[11px]">
              {textValues.headline.length}/60
            </span>
          </div>
          <input
            id="headline"
            type="text"
            maxLength={60}
            value={textValues.headline}
            onChange={(e) => onUpdateText('headline', e.target.value)}
            className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white text-xs placeholder-neutral-600 focus:outline-none focus:border-[#FF5C35]"
            placeholder="Ej: MODULAR ARCHITECTURE"
          />
        </div>
      </div>
    </div>
  );
};
