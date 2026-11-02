import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateDeterministicSceneGraph } from '../src/lib/ai';
import {
  applyAspect,
  applySimpleText,
  applyStyle,
  applyUserMedia,
  getAspectFormat,
  readSimpleTexts,
  STYLE_PRESETS,
} from '../src/lib/simple-editor/simple-edit';
import { buildBrief, deriveProductName, validateUpload } from '../src/lib/simple-editor/generate';
import { ProductBriefSchema } from '../src/lib/ai';

const base = () => generateDeterministicSceneGraph(buildBrief('Una app para reservar bicicletas'));

describe('simple editor edits', () => {
  it('reads the four user-facing texts', () => {
    const t = readSimpleTexts(base());
    assert.ok(t.hook.length > 0);
    assert.ok(t.valueProp.length > 0);
    assert.equal(t.cta, 'Empieza gratis');
    assert.ok(t.productName.length > 0);
  });

  it('updates CTA and value prop everywhere they appear', () => {
    let r = applySimpleText(base(), 'cta', 'Pruébalo ya');
    assert.ok(r.ok);
    r = applySimpleText(r.graph, 'valueProp', 'Reserva en segundos');
    assert.ok(r.ok);
    const t = readSimpleTexts(r.graph);
    assert.equal(t.cta, 'Pruébalo ya');
    assert.equal(t.valueProp, 'Reserva en segundos');
    const buttons = r.graph.scenes.filter((s) => s.type === 'synthetic_hero_button');
    assert.ok(buttons.every((s) => (s.payload as { buttonText: string }).buttonText === 'Pruébalo ya'));
  });

  it('truncates over-long text instead of breaking the graph', () => {
    const r = applySimpleText(base(), 'cta', 'x'.repeat(200));
    assert.ok(r.ok);
    assert.equal(readSimpleTexts(r.graph).cta.length, 30);
  });

  it('ignores empty required text and keeps the graph valid', () => {
    const before = base();
    const r = applySimpleText(before, 'cta', '');
    assert.ok(r.ok);
    assert.equal(readSimpleTexts(r.graph).cta, readSimpleTexts(before).cta);
  });

  it('applies all four style presets', () => {
    for (const p of STYLE_PRESETS) {
      const r = applyStyle(base(), p.id);
      assert.ok(r.ok);
      assert.equal(r.graph.artDirection.archetype, p.id);
    }
  });

  it('switches aspect ratio both ways', () => {
    const v = applyAspect(base(), '9:16');
    assert.equal(getAspectFormat(v.graph), '9:16');
    assert.equal(v.graph.canvas.width, 1080);
    assert.equal(v.graph.canvas.height, 1920);
    const h = applyAspect(v.graph, '16:9');
    assert.equal(h.graph.canvas.width, 1920);
    assert.equal(h.graph.canvas.height, 1080);
  });

  it('embeds user media into the product scene', () => {
    const r = applyUserMedia(base(), 'blob:http://localhost/abc');
    const scene = r.graph.scenes.find((s) => s.type === 'product_interaction_3d');
    assert.equal((scene?.payload as { url?: string }).url, 'blob:http://localhost/abc');
  });
});

describe('landing generation helpers', () => {
  it('builds a valid brief from short and long prompts', () => {
    for (const p of ['', 'Hi', 'Una herramienta de IA que escribe tus emails en segundos y mucho más'.repeat(20)]) {
      assert.ok(ProductBriefSchema.safeParse(buildBrief(p)).success, p.slice(0, 20));
    }
  });

  it('derives a product name', () => {
    assert.equal(deriveProductName('Linear para equipos'), 'Linear para');
    assert.equal(deriveProductName('   '), 'Tu producto');
  });

  it('validates uploads', () => {
    assert.equal(validateUpload({ type: 'video/mp4', size: 1000 }), null);
    assert.equal(validateUpload({ type: 'image/png', size: 1000 }), null);
    assert.ok(validateUpload({ type: 'application/pdf', size: 1000 }));
    assert.ok(validateUpload({ type: 'video/webm', size: 21 * 1024 * 1024 }));
  });
});
