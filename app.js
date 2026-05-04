'use strict';

// ─── SECURITY ────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const API_BASE       = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL          = 'gemini-3.1-flash-image-preview';
const COST_IMG_FIXED = 0.10;
const COST_IN_TOKEN  = 0.000000075;
const COST_OUT_TOKEN = 0.0000003;

const FORMAT_DIMS = {
  '4:5':  { w: 1080, h: 1350, label: 'Feed 4:5',     ratioClass: 'ratio-4-5'  },
  '1:1':  { w: 1080, h: 1080, label: 'Quadrado 1:1',  ratioClass: 'ratio-1-1' },
  '9:16': { w: 1080, h: 1920, label: 'Story 9:16',    ratioClass: 'ratio-9-16' },
};

const BUILTIN_MODIFIERS = {
  'nazarko-engenharia': 'Deep engineering brand aesthetic built on dark backgrounds (#0D0E12, #1A1F2E), with rich cobalt blue (#1F4788) and electric azure (#4A90E2) as structural colors, and energetic orange (#F39C12) as focal accent. Typography pairs bold geometric Roboto headlines with IBM Plex Mono monospaced technical labels, conveying precision and data clarity. Photography direction: dramatic low-angle shots of construction sites, structural blueprints, and field details under high-contrast directional lighting. Glassmorphism overlays used sparingly on dark surfaces. Mood: authoritative, precise, field-ready — regional Brazilian engineering with modern technical confidence.',
};

const CONFIDENCE_TIPS = {
  medium: [
    'Adicione uma bio detalhada com palavras-chave do seu nicho',
    'Publique pelo menos 12 posts no feed antes de analisar o perfil',
    'Use uma foto de perfil profissional e de alta qualidade',
    'Adicione o link do site, portfólio ou WhatsApp na bio',
    'Configure como conta comercial e defina a categoria correta',
    'Mantenha consistência entre o nome de exibição e o @handle',
  ],
  low: [
    'Crie a conta com o nome exato do negócio',
    'Complete 100% das informações do perfil (bio, site, contato)',
    'Publique pelo menos 9 posts antes de analisar',
    'Configure como conta profissional (empresa ou criador de conteúdo)',
    'Use um @handle diretamente relacionado ao nicho do negócio',
    'Adicione localização e categoria no perfil comercial',
  ],
};

const THEME_BASE = {
  '--bg':'#0F0D1A','--bg2':'#161325','--bg3':'#1A1629',
  '--bg-deep':'#09071A','--bg-dark':'#080613',
  '--primary':'#6C3CE1','--primary-glow':'rgba(108,60,225,.25)',
  '--secondary':'#A855F7',
  '--accent':'#22D3EE','--accent-dim':'rgba(34,211,238,.13)','--accent-border':'rgba(34,211,238,.22)',
  '--surface':'rgba(255,255,255,.04)','--surface-h':'rgba(255,255,255,.07)',
  '--border':'rgba(255,255,255,.08)','--border-focus':'rgba(108,60,225,.6)',
  '--text':'#F0EEF9','--text-muted':'rgba(240,238,249,.55)','--text-dim':'rgba(240,238,249,.28)',
};

const THEMES = {
  violeta: { label:'Violeta', vars:{} },
  mono: { label:'Mono', vars:{
    '--bg':'#0A0A0A','--bg2':'#101010','--bg3':'#141414',
    '--bg-deep':'#060606','--bg-dark':'#030303',
    '--primary':'#6B7280','--primary-glow':'rgba(107,114,128,.25)',
    '--secondary':'#9CA3AF',
    '--accent':'#E5E7EB','--accent-dim':'rgba(229,231,235,.08)','--accent-border':'rgba(229,231,235,.18)',
    '--border':'rgba(255,255,255,.1)','--border-focus':'rgba(156,163,175,.5)',
    '--text':'#F9FAFB','--text-muted':'rgba(249,250,251,.55)','--text-dim':'rgba(249,250,251,.28)',
  }},
  ocean: { label:'Oceano', vars:{
    '--bg':'#020D1A','--bg2':'#041220','--bg3':'#061626',
    '--bg-deep':'#010810','--bg-dark':'#010509',
    '--primary':'#1D4ED8','--primary-glow':'rgba(29,78,216,.25)',
    '--secondary':'#60A5FA',
    '--accent':'#38BDF8','--accent-dim':'rgba(56,189,248,.1)','--accent-border':'rgba(56,189,248,.2)',
    '--border-focus':'rgba(29,78,216,.6)',
    '--text':'#EFF6FF','--text-muted':'rgba(239,246,255,.55)','--text-dim':'rgba(239,246,255,.28)',
  }},
  amber: { label:'Âmbar', vars:{
    '--bg':'#150C00','--bg2':'#1C1000','--bg3':'#221400',
    '--bg-deep':'#0F0700','--bg-dark':'#0A0500',
    '--primary':'#B45309','--primary-glow':'rgba(180,83,9,.25)',
    '--secondary':'#F59E0B',
    '--accent':'#FCD34D','--accent-dim':'rgba(252,211,77,.1)','--accent-border':'rgba(252,211,77,.2)',
    '--border-focus':'rgba(180,83,9,.6)',
    '--text':'#FFFBEB','--text-muted':'rgba(255,251,235,.55)','--text-dim':'rgba(255,251,235,.28)',
  }},
  esmeralda: { label:'Esmeralda', vars:{
    '--bg':'#010F0A','--bg2':'#021409','--bg3':'#031A0B',
    '--bg-deep':'#000A06','--bg-dark':'#000603',
    '--primary':'#047857','--primary-glow':'rgba(4,120,87,.25)',
    '--secondary':'#10B981',
    '--accent':'#34D399','--accent-dim':'rgba(52,211,153,.1)','--accent-border':'rgba(52,211,153,.2)',
    '--border-focus':'rgba(4,120,87,.6)',
    '--text':'#ECFDF5','--text-muted':'rgba(236,253,245,.55)','--text-dim':'rgba(236,253,245,.28)',
  }},
};

// ─── STATE ───────────────────────────────────────────────────────────────────

const state = {
  brandName:        '',
  region:           'Rondônia (RO), Brasil',
  contentType:      'carousel',
  slideCount:       7,
  format:           '4:5',
  qty:              2,
  ideaMode:         'manual',
  selectedIdea:     '',
  imageSource:      'surprise',
  imageDescription: '',
  attachedImage:    null,
  slides:           [],
  images:           [],
  caption:          '',
  currentSlide:     0,
  totalCost:        0,
  generating:       false,
  brandServices:    [],
  _lastPrompts:     [],
  _lastVariations:  [],
  currentTheme:     'violeta',
  priorityPersonaIds: [],
  brandPillars:     [],
  logos:            [],
  personas:         [],
  personPhotos:     [],
  currentView:      'client',
  _currentFormatLabel: '',
  _formatPreselected: false,
  postType:         'educativo',
  storiesSeqCount:  5,
  _activeSlideN:    0,
  _perFormat:       {},
  _abortController: null,
  _genStartTime:    null,
  _timerInterval:   null,
  _usedIdeas:       [],
  stylePref:        '',
  refImages:        [],
  refStyle:         [],
};

// ─── CRC-32 + ZIP ─────────────────────────────────────────────────────────────

const CRC32 = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++)
    crc = CRC32[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

class ZipWriter {
  constructor() { this.localParts = []; this.centralParts = []; this.count = 0; this.offset = 0; }
  addFile(filename, data) {
    const enc = new TextEncoder(), name = enc.encode(filename);
    const crc = crc32(data), size = data.length;
    const lh = new Uint8Array(30 + name.length), lv = new DataView(lh.buffer);
    lv.setUint32(0,0x04034B50,true); lv.setUint16(4,20,true); lv.setUint16(6,0,true);
    lv.setUint16(8,0,true); lv.setUint16(10,0,true); lv.setUint16(12,0,true);
    lv.setUint32(14,crc,true); lv.setUint32(18,size,true); lv.setUint32(22,size,true);
    lv.setUint16(26,name.length,true); lv.setUint16(28,0,true); lh.set(name,30);
    const cd = new Uint8Array(46 + name.length), cv = new DataView(cd.buffer);
    cv.setUint32(0,0x02014B50,true); cv.setUint16(4,20,true); cv.setUint16(6,20,true);
    cv.setUint16(8,0,true); cv.setUint16(10,0,true); cv.setUint16(12,0,true);
    cv.setUint16(14,0,true); cv.setUint32(16,crc,true); cv.setUint32(20,size,true);
    cv.setUint32(24,size,true); cv.setUint16(28,name.length,true); cv.setUint16(30,0,true);
    cv.setUint16(32,0,true); cv.setUint16(34,0,true); cv.setUint16(36,0,true);
    cv.setUint32(38,0,true); cv.setUint32(42,this.offset,true); cd.set(name,46);
    this.localParts.push(lh, data); this.centralParts.push(cd);
    this.offset += lh.length + size; this.count++;
  }
  generate() {
    const cdOffset = this.offset; let cdSize = 0;
    for (const p of this.centralParts) cdSize += p.length;
    const eocd = new Uint8Array(22), ev = new DataView(eocd.buffer);
    ev.setUint32(0,0x06054B50,true); ev.setUint16(4,0,true); ev.setUint16(6,0,true);
    ev.setUint16(8,this.count,true); ev.setUint16(10,this.count,true);
    ev.setUint32(12,cdSize,true); ev.setUint32(16,cdOffset,true); ev.setUint16(20,0,true);
    return new Blob([...this.localParts,...this.centralParts,eocd],{type:'application/zip'});
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function slugify(name) {
  return name.toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}
function getModifier(brandName) {
  const slug = slugify(brandName);
  return BUILTIN_MODIFIERS[slug] || localStorage.getItem(`adgen_mod_${slug}`) || '';
}
function saveModifier(brandName, modifier) {
  localStorage.setItem(`adgen_mod_${slugify(brandName)}`, modifier.trim());
}

function saveClientLogos(brandName, logos) {
  if (!brandName) return;
  localStorage.setItem(`adgen_logos_${slugify(brandName)}`, JSON.stringify(logos));
}
function loadClientLogos(brandName) {
  if (!brandName) return [];
  try { return JSON.parse(localStorage.getItem(`adgen_logos_${slugify(brandName)}`)) || []; }
  catch { return []; }
}

function saveClientRefStyle(brandName, entries) {
  if (!brandName) return;
  localStorage.setItem(`adgen_refstyle_${slugify(brandName)}`, JSON.stringify(entries));
}
function loadClientRefStyle(brandName) {
  if (!brandName) return [];
  const raw = localStorage.getItem(`adgen_refstyle_${slugify(brandName)}`);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    // backward compat: old format was a plain string
    return [{ imageIndex: 0, type: 'foto', label: 'Estilo geral', style: String(parsed) }];
  } catch {
    return raw ? [{ imageIndex: 0, type: 'foto', label: 'Estilo geral', style: raw }] : [];
  }
}

function renderLogoPreview() {
  const preview = document.getElementById('logo-preview');
  if (!preview) return;
  preview.innerHTML = '';
  state.logos.forEach((logo, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'logo-thumb-wrap';
    const img = document.createElement('img');
    img.src = `data:${logo.mime};base64,${logo.b64}`;
    img.alt = logo.name || `logo ${idx + 1}`;
    img.className = 'logo-preview-img';
    img.title = logo.name || `Logotipo ${idx + 1}`;
    const rmBtn = document.createElement('button');
    rmBtn.type = 'button';
    rmBtn.className = 'logo-rm-btn';
    rmBtn.textContent = '×';
    rmBtn.title = 'Remover';
    rmBtn.addEventListener('click', () => {
      state.logos.splice(idx, 1);
      saveClientLogos(state.brandName || '', state.logos);
      renderLogoPreview();
    });
    wrap.appendChild(img);
    wrap.appendChild(rmBtn);
    preview.appendChild(wrap);
  });
}

async function analyzeLogosForModifier() {
  const apiKey = localStorage.getItem('adgen_key') || '';
  if (!apiKey || !state.logos.length) return;

  const preview = document.getElementById('logo-preview');
  const hint = document.createElement('span');
  hint.className = 'logo-analyzing';
  hint.textContent = 'Analisando paleta…';
  if (preview) preview.appendChild(hint);

  const parts = [];
  state.logos.forEach((logo, i) => {
    parts.push({ text: i === 0 ? 'Brand logo:' : `Logo variation ${i + 1}:` });
    parts.push({ inlineData: { mimeType: logo.mime, data: logo.b64 } });
  });
  parts.push({ text: `Analyze this brand logo and extract its visual identity data.

Return ONLY a valid JSON object — no markdown, no explanation:
{
  "colors": ["#RRGGBB"],
  "colorNames": ["descriptive name in Portuguese"],
  "typography": "typeface style description (serif/sans-serif/script/display, weight, personality)",
  "logoStyle": "wordmark | lettermark | monogram | icon+text | abstract mark | emblem",
  "mood": "2-3 adjectives in Portuguese describing the visual personality",
  "colorVariations": "description of alternate color schemes visible across variations, or empty string"
}` });

  try {
    const data = await callGemini(apiKey, {
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
    });
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const info = JSON.parse(raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim());

    const palette = (info.colors || [])
      .map((c, i) => `${c}${info.colorNames?.[i] ? ' (' + info.colorNames[i] + ')' : ''}`)
      .join(', ');
    const parts2 = [
      palette && `Palette: ${palette}`,
      info.typography && `Typography: ${info.typography}`,
      info.logoStyle && `Logo: ${info.logoStyle}`,
      info.mood && `Mood: ${info.mood}`,
      info.colorVariations && `Variations: ${info.colorVariations}`,
    ].filter(Boolean).join('. ');

    const textarea = document.getElementById('mod-textarea');
    const badge = document.getElementById('mod-badge');
    const existing = textarea?.value.trim() || '';
    const cleaned = existing.replace(/^\[LOGO:[^\]]*\]\s*/, '').trim();
    const newModifier = `[LOGO: ${parts2}] ${cleaned}`.trim();

    if (textarea) textarea.value = newModifier;
    if (state.brandName) saveModifier(state.brandName, newModifier);
    if (badge) { badge.textContent = 'Atualizado'; badge.className = 'modifier-badge badge-ok'; }
    toast('Modifier atualizado com a paleta do logotipo.', 'ok');
  } catch (err) {
    console.error('Logo analysis error:', err);
    toast('Não foi possível analisar o logotipo automaticamente.', 'warn');
  } finally {
    if (hint.parentNode) hint.parentNode.removeChild(hint);
  }
}

// ─── REFERENCE IMAGES ────────────────────────────────────────────────────────

function renderRefPreviews() {
  const preview = document.getElementById('ref-preview');
  if (!preview) return;
  preview.innerHTML = '';
  state.refImages.forEach((img, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'logo-thumb-wrap';
    const el = document.createElement('img');
    el.src = `data:${img.mime};base64,${img.b64}`;
    el.alt = `ref ${idx + 1}`;
    el.className = 'logo-preview-img';
    el.title = `Referência ${idx + 1}`;
    const rmBtn = document.createElement('button');
    rmBtn.type = 'button';
    rmBtn.className = 'logo-rm-btn';
    rmBtn.textContent = '×';
    rmBtn.title = 'Remover';
    rmBtn.addEventListener('click', () => {
      state.refImages.splice(idx, 1);
      renderRefPreviews();
      syncRefStyleUI();
    });
    wrap.appendChild(el);
    wrap.appendChild(rmBtn);
    preview.appendChild(wrap);
  });
  const analyzeBtn = document.getElementById('btn-analyze-refs');
  if (analyzeBtn) analyzeBtn.style.display = state.refImages.length ? '' : 'none';
}

const REF_TYPE_META = {
  texto:      { label: 'TEXTO',      color: '#22D3EE' },
  foto:       { label: 'FOTO',       color: '#22C55E' },
  lifestyle:  { label: 'LIFESTYLE',  color: '#A78BFA' },
  produto:    { label: 'PRODUTO',    color: '#F59E0B' },
  ilustracao: { label: 'ILUSTRAÇÃO', color: '#F472B6' },
  abstrato:   { label: 'ABSTRATO',   color: '#94A3B8' },
};

const REF_USAGE_MAP = {
  criativos:  ['foto', 'produto', 'lifestyle', 'abstrato', 'ilustracao'],
  carrossel:  ['texto', 'ilustracao', 'abstrato', 'foto'],
  stories:    ['lifestyle', 'foto', 'abstrato', 'produto'],
};

function syncRefStyleUI() {
  const out = document.getElementById('ref-style-output');
  const txt = document.getElementById('ref-style-text');
  if (!out || !txt) return;
  if (!state.refStyle.length) { out.style.display = 'none'; txt.innerHTML = ''; return; }
  out.style.display = '';
  txt.innerHTML = state.refStyle.map((entry, i) => {
    const meta = REF_TYPE_META[entry.type] || { label: entry.type.toUpperCase(), color: '#94A3B8' };
    const usedBy = Object.entries(REF_USAGE_MAP)
      .filter(([, types]) => types[0] === entry.type || types[1] === entry.type)
      .map(([k]) => ({ criativos: 'Criativos', carrossel: 'Carrossel', stories: 'Stories' }[k] || k));
    const usedNote = usedBy.length ? `<span style="font-size:10px;color:var(--text-dim);margin-left:6px;">usado em: ${usedBy.join(', ')}</span>` : '';
    return `<div style="margin-bottom:${i < state.refStyle.length - 1 ? '10' : '0'}px;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
        <span style="font-size:9px;font-weight:700;letter-spacing:.1em;font-family:'JetBrains Mono',monospace;background:${meta.color}22;color:${meta.color};border:1px solid ${meta.color}44;border-radius:4px;padding:2px 6px;">${meta.label}</span>
        <span style="font-size:11px;font-weight:500;color:var(--text-muted);">${esc(entry.label)}</span>${usedNote}
      </div>
      <div style="font-size:11px;color:var(--text-dim);line-height:1.55;padding-left:2px;">${esc(entry.style)}</div>
    </div>`;
  }).join('<div style="height:1px;background:var(--border);margin:10px 0;"></div>');
}

async function analyzeRefImages(apiKey) {
  if (!apiKey) { toast('Configure a chave Gemini antes de analisar.', 'warn'); return; }
  if (!state.refImages.length) { toast('Adicione imagens de referência primeiro.', 'warn'); return; }

  const btn = document.getElementById('btn-analyze-refs');
  if (btn) { btn.disabled = true; btn.textContent = 'Analisando…'; }

  const parts = [];
  state.refImages.forEach((img, i) => {
    parts.push({ text: `Image ${i + 1}:` });
    parts.push({ inlineData: { mimeType: img.mime, data: img.b64 } });
  });
  parts.push({ text: `Analyze each reference image provided by the client (in order) and classify its visual style.

Content type definitions:
- "texto": composition dominated by typography, text treatments, or editorial text layouts
- "foto": photographic scene (environments, architecture, food, abstract photography)
- "lifestyle": lifestyle photography with people in context (portraits, activities, candid)
- "produto": product photography (objects isolated or styled on controlled backgrounds)
- "ilustracao": illustration, graphic design, vector art, digital painting, collage
- "abstrato": abstract, geometric, color-field, gradient, or pattern-based visual

Return ONLY a valid JSON array — exactly one object per image, in the same order:
[{"imageIndex":0,"type":"texto | foto | lifestyle | produto | ilustracao | abstrato","label":"short label in Portuguese","style":"40-55 word English paragraph: color palette, lighting, composition, mood. Precise, no filler."}]` });

  try {
    const data = await callGemini(apiKey, {
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature: 0.15, maxOutputTokens: 4096 },
    });
    const usage = data.usageMetadata || {};
    state.totalCost += (usage.promptTokenCount || 0) * COST_IN_TOKEN + (usage.candidatesTokenCount || 0) * COST_OUT_TOKEN;
    refreshCost();
    const raw = (data.candidates?.[0]?.content?.parts?.[0]?.text || '')
      .replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    let entries;
    try {
      entries = JSON.parse(raw);
    } catch (_) {
      // JSON was truncated — salvage complete objects already present
      const complete = [];
      const objRe = /\{[\s\S]*?"style"\s*:\s*"[^"]*"\s*\}/g;
      let m;
      while ((m = objRe.exec(raw)) !== null) {
        try { complete.push(JSON.parse(m[0])); } catch (_2) {}
      }
      if (!complete.length) throw new Error('Resposta inválida — tente com menos imagens');
      entries = complete;
      toast(`JSON truncado — ${complete.length} de ${state.refImages.length} imagens recuperadas.`, 'warn');
    }

    if (!Array.isArray(entries) || !entries.length) throw new Error('Resposta inválida');
    state.refStyle = entries;
    if (state.brandName) saveClientRefStyle(state.brandName, entries);
    syncRefStyleUI();
    toast(`${entries.length} estilo${entries.length > 1 ? 's extraídos' : ' extraído'} e salvo${entries.length > 1 ? 's' : ''}!`, 'ok');
  } catch (err) {
    console.error('Ref analysis error:', err);
    toast('Não foi possível analisar as referências: ' + err.message, 'err');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⚡ Analisar estilo'; }
  }
}

function parseFullBrandDna(text) {
  const result = {};
  const sec1 = text.match(/##\s*1\.\s*MARCA([\s\S]*?)(?=\n##|\n---|$)/i)?.[1] || '';
  const nome = sec1.match(/\*\*Nome:\*\*\s*(.+)/i)?.[1]?.trim();
  const niche = sec1.match(/\*\*Nicho:\*\*\s*(.+)/i)?.[1]?.trim();
  const tone = sec1.match(/\*\*Tom:\*\*\s*(.+)/i)?.[1]?.trim();
  const region = sec1.match(/\*\*Regi[oã]o:\*\*\s*(.+)/i)?.[1]?.trim();
  if (nome) result.brandName = nome;
  if (niche) result.niche = niche;
  if (tone) result.tone = tone;
  if (region) result.region = region;
  const sec2 = text.match(/##\s*2\.\s*ESTILO VISUAL\s*\n+([\s\S]*?)(?=\n##|\n---|$)/i)?.[1]?.trim();
  if (sec2) result.stylePref = sec2;
  const sec3 = text.match(/##\s*3\.\s*SERVI[ÇC]OS([\s\S]*?)(?=\n##|\n---|$)/i)?.[1] || '';
  const services = [...sec3.matchAll(/^-\s*(.+)/gm)].map(m => m[1].trim()).filter(Boolean);
  if (services.length) result.services = services;
  const sec4 = text.match(/##\s*4\.\s*PERSONAS([\s\S]*?)(?=\n##|\n---|$)/i)?.[1] || '';
  if (sec4) {
    const personas = sec4.split(/(?=###\s)/).map(block => {
      const name = block.match(/###\s*(.+)/)?.[1]?.trim();
      if (!name) return null;
      const ageRange = block.match(/\*\*Faixa et[aá]ria:\*\*\s*(.+)/i)?.[1]?.trim() || '';
      const trait = block.match(/\*\*Perfil:\*\*\s*(.+)/i)?.[1]?.trim() || '';
      const interests = (block.match(/\*\*Interesses:\*\*\s*(.+)/i)?.[1] || '').split(',').map(s => s.trim()).filter(Boolean);
      const painPoints = (block.match(/\*\*Dores:\*\*\s*(.+)/i)?.[1] || '').split(',').map(s => s.trim()).filter(Boolean);
      return { id: uid(), name, ageRange, trait, interests, painPoints };
    }).filter(Boolean);
    if (personas.length) result.personas = personas;
  }
  const modMatch = text.match(/##\s*6\.\s*IMAGE GENERATION PROMPT MODIFIER[\s\S]*?\n+([\s\S]+?)(?:\n---|\n##|$)/i);
  if (modMatch) result.modifier = modMatch[1].replace(/^>\s*/gm, '').trim();
  return result;
}

function composeBrandDna() {
  const colors = document.getElementById('dna-colors').value.trim();
  const logo   = document.getElementById('dna-logo').value.trim();
  const typo   = document.getElementById('dna-typography').value.trim();
  const photo  = document.getElementById('dna-photo').value.trim();
  const mood   = document.getElementById('dna-mood').value.trim();
  const niche  = document.getElementById('dna-niche-field').value.trim();
  if (!colors && !mood) { toast('Preencha pelo menos Cores e Mood visual.', 'warn'); return; }
  const parts = [];
  parts.push((niche ? niche.charAt(0).toUpperCase() + niche.slice(1) + ' brand' : 'Brand') + (colors ? ` with a palette built on ${colors}.` : '.'));
  if (logo)  parts.push(`Logo style: ${logo}.`);
  if (typo)  parts.push(`Typography: ${typo} — reflecting the brand personality through letterform.`);
  if (photo) parts.push(`Photography direction: ${photo}.`);
  if (mood)  parts.push(`Overall visual mood: ${mood}.`);
  const modifier = parts.join(' ');
  document.getElementById('mod-textarea').value = modifier;
  document.getElementById('mod-badge').textContent = 'Composto';
  document.getElementById('mod-badge').className = 'modifier-badge badge-ok';
  document.getElementById('mod-details').removeAttribute('open');
  document.getElementById('dna-compose-form').style.display = 'none';
  toast('Modifier composto! Clique em Salvar para persistir.', 'ok');
}

function exportBrandDna() {
  const brand = document.getElementById('in-brand').value.trim() || state.brandName;
  if (!brand) { toast('Preencha o nome da marca antes de exportar.', 'warn'); return; }
  const clientData = ClientDB.load(brand) || {};
  const modifier   = document.getElementById('mod-textarea').value.trim() || clientData.modifier || '';
  const stylePref  = document.getElementById('in-style-pref')?.value.trim() || clientData.stylePref || '';
  const niche      = document.getElementById('bc-niche')?.textContent.replace('—','').trim() || clientData.niche || '';
  const tone       = document.getElementById('bc-tone')?.textContent.replace('—','').trim() || clientData.tone || '';
  const region     = state.region || clientData.region || '';
  const services   = clientData.services || state.brandServices || [];
  const personas   = state.personas.length ? state.personas : clientData.personas || [];
  const date       = new Date().toLocaleDateString('pt-BR');
  let md = `# Brand DNA — ${brand}\n_Gerado por NZRK AD Generator em ${date}_\n\n---\n\n`;
  md += `## 1. MARCA\n`;
  md += `- **Nome:** ${brand}\n`;
  if (niche)  md += `- **Nicho:** ${niche}\n`;
  if (tone)   md += `- **Tom:** ${tone}\n`;
  if (region) md += `- **Região:** ${region}\n`;
  md += '\n';
  if (stylePref) md += `## 2. ESTILO VISUAL\n${stylePref}\n\n`;
  if (services.length) {
    md += `## 3. SERVIÇOS\n`;
    services.forEach(s => { md += `- ${s}\n`; });
    md += '\n';
  }
  if (personas.length) {
    md += `## 4. PERSONAS\n\n`;
    personas.forEach(p => {
      md += `### ${p.name || '(sem nome)'}\n`;
      if (p.ageRange)        md += `- **Faixa etária:** ${p.ageRange}\n`;
      if (p.trait)           md += `- **Perfil:** ${p.trait}\n`;
      if (p.interests?.length)   md += `- **Interesses:** ${p.interests.join(', ')}\n`;
      if (p.painPoints?.length)  md += `- **Dores:** ${p.painPoints.join(', ')}\n`;
      md += '\n';
    });
  }
  if (modifier) {
    md += `## 6. IMAGE GENERATION PROMPT MODIFIER\n\n> ${modifier}\n\n`;
  }
  md += `---\n_Importe este arquivo no NZRK AD Generator para restaurar o perfil completo._\n`;
  const blob = new Blob([md], { type: 'text/markdown' });
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: `brand-dna-${slugify(brand)}.md` }).click();
  URL.revokeObjectURL(url);
  toast('brand-dna.md exportado!', 'ok');
}
function b64ToBytes(b64) {
  const bin = atob(b64), arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}
function uid() { return String(Date.now() + Math.random()); }

// ─── CLIENT STORAGE (localStorage + IndexedDB) ───────────────────────────────

const ClientDB = (() => {
  const KEY = s => `adgen_client_${s}`;
  const IDX = 'adgen_clients_idx';

  function save(brandName, data) {
    const slug = slugify(brandName);
    const existing = load(brandName) || { brandName, history: [] };
    const updated = { ...existing, ...data, brandName, slug, updatedAt: Date.now() };
    localStorage.setItem(KEY(slug), JSON.stringify(updated));
    const idx = JSON.parse(localStorage.getItem(IDX) || '[]');
    if (!idx.includes(slug)) { idx.push(slug); localStorage.setItem(IDX, JSON.stringify(idx)); }
  }

  function load(brandName) {
    const raw = localStorage.getItem(KEY(slugify(brandName)));
    return raw ? JSON.parse(raw) : null;
  }

  function list() {
    const idx = JSON.parse(localStorage.getItem(IDX) || '[]');
    return idx.map(s => { const r = localStorage.getItem(KEY(s)); return r ? JSON.parse(r) : null; })
      .filter(Boolean).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  function addHistory(brandName, record) {
    const client = load(brandName) || { brandName, history: [] };
    if (!client.history) client.history = [];
    client.history.unshift(record);
    if (client.history.length > 100) client.history.length = 100;
    save(brandName, client);
  }

  function getUsedThemes(brandName) {
    return load(brandName)?.history?.map(h => h.theme).filter(Boolean) || [];
  }

  function remove(brandName) {
    const slug = slugify(brandName);
    localStorage.removeItem(KEY(slug));
    const idx = JSON.parse(localStorage.getItem(IDX) || '[]');
    localStorage.setItem(IDX, JSON.stringify(idx.filter(s => s !== slug)));
  }

  return { save, load, list, addHistory, getUsedThemes, remove };
})();

const ImageDB = (() => {
  let _db = null;

  async function open() {
    if (_db) return _db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('adgen_db', 1);
      req.onupgradeneeded = e => {
        if (!e.target.result.objectStoreNames.contains('generations'))
          e.target.result.createObjectStore('generations', { keyPath: 'id' });
      };
      req.onsuccess = e => { _db = e.target.result; resolve(_db); };
      req.onerror = e => reject(e.target.error);
    });
  }

  async function save(record) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('generations', 'readwrite');
      tx.objectStore('generations').put(record);
      tx.oncomplete = resolve; tx.onerror = e => reject(e.target.error);
    });
  }

  async function list(brandSlug) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('generations', 'readonly');
      const results = [];
      tx.objectStore('generations').openCursor().onsuccess = e => {
        const cursor = e.target.result;
        if (cursor) {
          if (!brandSlug || cursor.value.brandSlug === brandSlug) results.push(cursor.value);
          cursor.continue();
        } else resolve(results.sort((a, b) => b.date - a.date));
      };
      tx.onerror = e => reject(e.target.error);
    });
  }

  async function remove(id) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('generations', 'readwrite');
      tx.objectStore('generations').delete(id);
      tx.oncomplete = resolve; tx.onerror = e => reject(e.target.error);
    });
  }

  return { save, list, remove };
})();

// ─── CANVAS NORMALIZE ────────────────────────────────────────────────────────

async function normalizeToTarget(b64, mime, targetW, targetH) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const tmp = document.createElement('canvas');
      tmp.width = img.width; tmp.height = img.height;
      const tctx = tmp.getContext('2d'); tctx.drawImage(img,0,0);
      const corners = [
        tctx.getImageData(0,0,1,1).data, tctx.getImageData(img.width-1,0,1,1).data,
        tctx.getImageData(0,img.height-1,1,1).data, tctx.getImageData(img.width-1,img.height-1,1,1).data,
      ];
      const r = Math.round(corners.reduce((s,d)=>s+d[0],0)/4);
      const g = Math.round(corners.reduce((s,d)=>s+d[1],0)/4);
      const bl= Math.round(corners.reduce((s,d)=>s+d[2],0)/4);
      const c = document.createElement('canvas');
      c.width = targetW; c.height = targetH;
      const ctx = c.getContext('2d');
      ctx.fillStyle = `rgb(${r},${g},${bl})`; ctx.fillRect(0,0,targetW,targetH);
      const scale = Math.max(targetW/img.width, targetH/img.height);
      ctx.save(); ctx.rect(0,0,targetW,targetH); ctx.clip();
      ctx.drawImage(img,(targetW-img.width*scale)/2,(targetH-img.height*scale)/2,img.width*scale,img.height*scale);
      ctx.restore();
      resolve({ b64: c.toDataURL('image/png').split(',')[1], mime:'image/png' });
    };
    img.onerror = () => resolve({b64,mime});
    img.src = `data:${mime};base64,${b64}`;
  });
}

// ─── OPENAI / DALL·E 3 API ───────────────────────────────────────────────────

async function callDallE3(apiKey, prompt, format, label = '') {
  const SIZES = { '4:5': '1024x1792', '1:1': '1024x1024', '9:16': '1024x1792' };
  const COSTS = { '1024x1024': 0.080, '1024x1792': 0.120 };
  const size = SIZES[format] || '1024x1024';
  const signal = state._abortController?.signal;
  if (label) setProgress(`${label} via DALL·E 3…`);
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'dall-e-3', prompt: prompt.slice(0, 4000), n: 1, size, response_format: 'b64_json', quality: 'hd' }),
    ...(signal ? { signal } : {}),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `DALL-E HTTP ${res.status}`); }
  const data = await res.json();
  state.totalCost += COSTS[size] ?? 0.08; refreshCost();
  return { b64: data.data[0].b64_json, mime: 'image/png' };
}

// ─── TEXT OVERLAY ────────────────────────────────────────────────────────────

function _hexToRgb(hex) {
  const c = (hex || '').replace('#', '');
  if (c.length !== 6) return '0,0,0';
  return `${parseInt(c.slice(0,2),16)},${parseInt(c.slice(2,4),16)},${parseInt(c.slice(4,6),16)}`;
}

async function overlayAdText(b64, mime, adText, format) {
  if (!adText || (!adText.headline && !adText.sub && !adText.cta)) return { b64, mime };
  try { await document.fonts.load('700 40px Inter'); } catch (_) {}
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const W = img.width, H = img.height;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      // Bottom gradient scrim — brand-tinted when colors provided
      const c = adText.colors || {};
      const scrimRgb = _hexToRgb(c.scrimHex || '#000000');
      const grad = ctx.createLinearGradient(0, H * 0.44, 0, H);
      grad.addColorStop(0, `rgba(${scrimRgb},0)`);
      grad.addColorStop(0.42, `rgba(${scrimRgb},0.58)`);
      grad.addColorStop(1, `rgba(${scrimRgb},0.86)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      const pad = Math.round(W * 0.072);
      const maxW = W - pad * 2;
      ctx.textBaseline = 'alphabetic';

      // Vertical anchors — measured from bottom of text block
      const isStory = format === '9:16';
      const ctaBottom  = isStory ? H * 0.90 : H * 0.91;
      const subBottom  = isStory ? H * 0.81 : H * 0.82;
      const headBottom = isStory ? H * 0.72 : H * 0.73;

      // CTA pill
      if (adText.cta) {
        const fs = Math.round(W * 0.034);
        ctx.font = `600 ${fs}px Inter, Arial, sans-serif`;
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
        const tw = ctx.measureText(adText.cta).width;
        const pX = Math.round(W * 0.042), pY = Math.round(H * 0.016);
        const pillW = tw + pX * 2, pillH = fs + pY * 2;
        const pillTop = ctaBottom - pillH;
        const r = pillH / 2;
        ctx.fillStyle = c.ctaBg || '#6C3CE1';
        ctx.beginPath();
        ctx.moveTo(pad + r, pillTop);
        ctx.lineTo(pad + pillW - r, pillTop);
        ctx.arcTo(pad + pillW, pillTop, pad + pillW, pillTop + r, r);
        ctx.lineTo(pad + pillW, pillTop + pillH - r);
        ctx.arcTo(pad + pillW, pillTop + pillH, pad + pillW - r, pillTop + pillH, r);
        ctx.lineTo(pad + r, pillTop + pillH);
        ctx.arcTo(pad, pillTop + pillH, pad, pillTop + pillH - r, r);
        ctx.lineTo(pad, pillTop + r);
        ctx.arcTo(pad, pillTop, pad + r, pillTop, r);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = c.ctaText || '#FFFFFF';
        ctx.fillText(adText.cta, pad + pX, pillTop + pY + fs * 0.88);
      }

      // Sub
      if (adText.sub) {
        const fs = Math.round(W * 0.036);
        ctx.font = `400 ${fs}px Inter, Arial, sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.84)';
        ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 6;
        drawWrappedBottom(ctx, adText.sub, pad, subBottom, maxW, fs * 1.32);
      }

      // Headline
      if (adText.headline) {
        const fs = Math.round(W * 0.058);
        ctx.font = `700 ${fs}px Inter, Arial, sans-serif`;
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 8;
        drawWrappedBottom(ctx, adText.headline, pad, headBottom, maxW, fs * 1.22);
      }

      resolve({ b64: canvas.toDataURL('image/png').split(',')[1], mime: 'image/png' });
    };
    img.onerror = () => resolve({ b64, mime });
    img.src = `data:${mime};base64,${b64}`;
  });
}

function drawWrappedBottom(ctx, text, x, yBottom, maxW, lineH) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);
  for (let i = lines.length - 1; i >= 0; i--) {
    ctx.fillText(lines[i], x, yBottom);
    yBottom -= lineH;
  }
}

// ─── GEMINI API ──────────────────────────────────────────────────────────────

async function callGemini(apiKey, body, modelOverride, apiVersion) {
  const model = modelOverride || MODEL;
  const base = apiVersion
    ? `https://generativelanguage.googleapis.com/${apiVersion}/models`
    : API_BASE;
  const url = `${base}/${model}:generateContent?key=${apiKey}`;
  const signal = state._abortController?.signal;
  const res = await fetch(url, {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.error?.message||`HTTP ${res.status}`); }
  return res.json();
}

async function callGeminiWithRetry(apiKey, body, label='') {
  const DELAYS = [4000, 8000, 15000];
  for (let attempt = 0; attempt < 3; attempt++) {
    if (state._abortController?.signal.aborted) throw new DOMException('Aborted','AbortError');
    try { return await callGemini(apiKey, body); }
    catch (err) {
      if (err.name === 'AbortError') throw err;
      const retryable = /high demand|503|overload|unavailable/i.test(err.message);
      if (retryable && attempt < 2) {
        const wait = DELAYS[attempt];
        setProgress(`${label} — sobrecarga, nova tentativa em ${wait/1000}s… (${attempt+2}/3)`);
        await new Promise(r => setTimeout(r, wait));
      } else throw err;
    }
  }
}

// ─── INSTAGRAM ANALYSIS ──────────────────────────────────────────────────────

async function analyzeInstagramProfile(handle, apiKey) {
  const clean = handle.replace(/^@/, '');

  const prompt = `You are a brand intelligence analyst. Analyze the Instagram handle @${clean} and return brand context for a visual content creation tool.

CRITICAL HONESTY RULES:
- This may be a small personal account with little or no data in your training set. That is fine — be honest.
- NEVER invent or hallucinate data. If you don't know something with certainty, use a generic/inferred value and set confidence accordingly.
- REGION: Only return a specific city+state if you are CERTAIN it appears in this account's bio or public profile. If any doubt → return "Brasil".
- NICHE: Infer from the handle name and any known context. A person's name handle (e.g. @ednaalessio) suggests an individual professional — try to identify the profession if known, otherwise return "Profissional liberal".
- CONFIDENCE: "high" = you have reliable specific data about this exact account. "medium" = you have partial data. "low" = you have little to no specific data and are mostly inferring.
- Returning partial honest data with confidence "low" is FAR better than fabricating complete data with confidence "high".

Return ONLY a valid JSON object — no markdown, no code fences:
{
  "brandName": "person or brand name (capitalize correctly; infer from handle if unknown)",
  "niche": "industry/niche in max 4 words in Portuguese",
  "tone": "exactly 4 adjectives, comma-separated, in Portuguese",
  "audience": "primary target audience in 1 sentence in Portuguese",
  "region": "city+state only if CERTAIN — otherwise 'Brasil'",
  "exactServices": ["service 1 in Portuguese", "service 2", "...up to 8 — generic if unknown"],
  "contentPillars": ["pillar 1 in Portuguese", "pillar 2", "pillar 3"],
  "confidence": "high | medium | low",
  "stylePref": "visual style in 2-4 words in Portuguese that best describes this brand's aesthetic, e.g. 'Minimalista e clean', 'Quente e acolhedor', 'Moderno e tecnológico', 'Feminino e elegante', 'Rústico e orgânico'",
  "brandColors": {
    "primary": "dominant brand color as hex (e.g. '#1F4788') — infer from known palette or return '#000000' if unknown",
    "accent": "accent/highlight color as hex (e.g. '#F39C12') — used for CTA buttons in ad overlays"
  },
  "modifier": "80-90 word English paragraph for image AI: brand color palette with hex codes if known, logo style description if known (circular monogram, wordmark, illustrated mascot, etc.), typography personality, photography direction (lighting, angles, subjects), overall visual mood. Single flowing paragraph, no bullets.",
  "personas": [
    {
      "name": "Persona name in Portuguese",
      "ageRange": "age range e.g. '28-45 anos'",
      "trait": "1-sentence profile: occupation, life stage, and dominant motivation — e.g. 'Mãe empreendedora de 35 anos que busca organização financeira para crescer o negócio sem abrir mão da família'",
      "interests": ["interest 1", "interest 2", "interest 3", "interest 4"],
      "painPoints": ["pain point 1", "pain point 2", "pain point 3"]
    },
    { "name": "second distinct persona", "ageRange": "...", "trait": "...", "interests": [], "painPoints": [] },
    { "name": "third distinct persona", "ageRange": "...", "trait": "...", "interests": [], "painPoints": [] }
  ]
}`;

  const data = await callGeminiWithRetry(apiKey, {
    contents: [{ role:'user', parts:[{text:prompt}] }],
    generationConfig: { temperature:0, maxOutputTokens:2000 },
  }, 'Análise de perfil');

  const usage = data.usageMetadata || {};
  state.totalCost += (usage.promptTokenCount||0)*COST_IN_TOKEN + (usage.candidatesTokenCount||0)*COST_OUT_TOKEN;
  refreshCost();

  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const clean2 = raw.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim();
  const jsonMatch = clean2.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Resposta inválida da análise de perfil');
  return JSON.parse(jsonMatch[0]);
}

// ─── PERSONA HELPERS ─────────────────────────────────────────────────────────

function getPersonaContext() {
  if (!state.personas.length) return '';
  const active = state.priorityPersonaIds.length
    ? state.personas.filter(p => state.priorityPersonaIds.includes(p.id))
    : state.personas.slice(0, 3);
  if (!active.length) return '';
  const lines = active.map((p, i) =>
    `${i+1}. ${p.name}${p.ageRange ? ` (${p.ageRange})` : ''}`
    + (p.trait ? ` — Característica: ${p.trait}` : '')
    + (p.interests.length ? ` — Interesses: ${p.interests.slice(0,4).join(', ')}` : '')
    + (p.painPoints.length ? ` — Dores: ${p.painPoints.slice(0,3).join('; ')}` : '')
  ).join('\n');
  return `\nPERSONAS-ALVO:\n${lines}`;
}

function getPostObjectiveDirectives() {
  const map = {
    'educativo': {
      label: 'Post Educativo',
      visual: 'Prioritize readability and clear visual hierarchy. Use structured layouts: numbered steps, data callouts, or before/after comparisons. Typography leads with a large informative headline followed by legible supporting content. Calm, authoritative palette.',
      typography: 'Bold clear headline as anchor. Medium-weight body text for content. Use size contrast to guide reading order (big → small).',
      mood: 'Authoritative, trustworthy, educational, clear.',
      colorHint: 'Professional calm colors. Blues, greens, or brand palette. Avoid aggressive reds or urgency tones.',
    },
    'venda': {
      label: 'Venda / Lançamento',
      visual: 'Maximum visual impact. Main offer or benefit must be the LARGEST element. High-contrast CTA block. Use urgency colors (bold red, orange, or energetic accent). Price or key number dominates visually. Every pixel drives toward conversion — eliminate all clutter.',
      typography: 'Ultra-bold maximum-weight headline. CTA text large, contrasting, impossible to miss. Minimal supporting text.',
      mood: 'Urgent, exciting, high-energy, action-driving.',
      colorHint: 'High contrast. Urgency accent (red, orange, or vibrant brand color) on CTA and key price/offer element.',
    },
    'prova-social': {
      label: 'Prova Social / Depoimento',
      visual: 'Quote-style layout with prominent quotation marks or testimonial card. Human face or name visible and credible. Star ratings or trust badges if applicable. Warm, authentic color palette — avoid cold or corporate tones.',
      typography: 'Large legible quote text as hero. Name/attribution in smaller weight. Warm, conversational feel.',
      mood: 'Authentic, trustworthy, human, warm, relatable.',
      colorHint: 'Warm palette. Cream, warm white, or brand colors. Avoid cold blues.',
    },
    'bastidores': {
      label: 'Bastidores',
      visual: 'Candid documentary composition. Real environment: workspace, team, equipment, process in action. Natural lighting. Honest unpolished feel is intentional — authenticity IS the message. Minimal text overlay.',
      typography: 'Minimal text. Let the photo tell the story. Any overlay should feel casual, not corporate.',
      mood: 'Authentic, transparent, human, insider, behind-the-scenes.',
      colorHint: 'Natural unprocessed look. Real lighting colors. Avoid heavy filters or stylized palettes.',
    },
    'engajamento': {
      label: 'Engajamento',
      visual: 'Bold central question or provocative statement as visual hero. Dynamic eye-catching composition. High visual energy. Opinion-provoking hook imagery. If showing choices: layout them as clear contrasting visual options.',
      typography: 'Maximum-size question text. Bold high-contrast with key word highlighted differently. Invites reading and response.',
      mood: 'Provocative, energetic, thought-provoking, interactive, curious.',
      colorHint: 'High contrast. Energetic colors. Use color to highlight the key question word or contrast choices.',
    },
    'duvidas': {
      label: 'Dúvidas Frequentes',
      visual: 'FAQ or Q&A structured layout. Numbered questions or clear question/answer pairs. Clean organized composition with generous spacing. Question mark as visual motif. Easy-to-scan hierarchy.',
      typography: 'Clear Q bold / A regular hierarchy. Large readable question. Smaller but legible answer text. List formatting.',
      mood: 'Helpful, calm, reassuring, organized, approachable.',
      colorHint: 'Calm accessible palette. Clear background for text legibility. Avoid dark moody tones.',
    },
    'conscientizacao': {
      label: 'Conscientização',
      visual: 'Emotionally powerful imagery. Key statistic or impactful number as visual hero. Symbolic or metaphorical imagery. Strong visual contrast to convey weight of the message. Bold headline that demands attention.',
      typography: 'Impactful bold typography. Key number or statistic as largest text element. Heavy emotional weight.',
      mood: 'Impactful, emotional, urgent, important, eye-opening.',
      colorHint: 'High contrast. Stark palette to convey gravity, or vibrant cause-related colors.',
    },
  };
  return map[state.postType] || null;
}

function buildObjectiveDirectivesBlock() {
  const obj = getPostObjectiveDirectives();
  const active = state.priorityPersonaIds.length
    ? state.personas.filter(p => state.priorityPersonaIds.includes(p.id))
    : state.personas.slice(0, 3);
  if (!obj && !active.length) return '';
  let block = '\n\n════ DESIGN MANDATE — OBJECTIVE & AUDIENCE ════\n';
  if (obj) {
    block += `OBJECTIVE: ${obj.label}\n`;
    block += `  Visual direction: ${obj.visual}\n`;
    block += `  Typography: ${obj.typography}\n`;
    block += `  Mood: ${obj.mood}\n`;
    block += `  Color strategy: ${obj.colorHint}\n`;
  }
  if (active.length) {
    block += '\nTARGET AUDIENCE — every visual decision must resonate with:\n';
    active.forEach((p, i) => {
      let line = `  ${i+1}. ${p.name}`;
      if (p.ageRange) line += ` (${p.ageRange})`;
      if (p.trait) line += ` | "${p.trait}"`;
      if (p.interests.length) line += ` | Interests: ${p.interests.slice(0,3).join(', ')}`;
      if (p.painPoints.length) line += ` | Pain: ${p.painPoints.slice(0,2).join('; ')}`;
      block += line + '\n';
    });
    block += '  → Choose imagery, typography weight, color, and emotional tone that this audience finds instantly relatable, aspirational, and trustworthy.\n';
  }
  block += '══════════════════════════════════════════';
  return block;
}

function clearIdeasIfStale() {
  const chipsEl = document.getElementById('ideas-chips');
  if (!chipsEl || !chipsEl.children.length) return;
  chipsEl.innerHTML = '';
  state.selectedIdea = '';
  state._usedIdeas = [];
  const btnIdeas = document.getElementById('btn-ideas');
  if (btnIdeas) { btnIdeas.textContent = '↺ Gerar mais ideias'; btnIdeas.className = 'btn-ideas btn-ideas--more'; }
  const complementWrap = document.getElementById('idea-complement');
  if (complementWrap) complementWrap.style.display = 'none';
}

function renderPersonaFocus() {
  const el = document.getElementById('persona-focus-pills');
  if (!el || !state.personas.length) return;
  el.innerHTML = '';

  // "Todos" pill — active when no specific persona is selected
  const todosBtn = document.createElement('button');
  todosBtn.type = 'button';
  todosBtn.className = 'focus-pill' + (!state.priorityPersonaIds.length ? ' active' : '');
  todosBtn.innerHTML = '<span class="focus-pill-name">Todos</span>';
  todosBtn.addEventListener('click', () => {
    if (state.priorityPersonaIds.length) {
      state.priorityPersonaIds = [];
      renderPersonaFocus();
      clearIdeasIfStale();
    }
  });
  el.appendChild(todosBtn);

  state.personas.slice(0, 4).forEach(p => {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'focus-pill';
    const nameSpan = `<span class="focus-pill-name">${esc(p.name) || '(sem nome)'}</span>`;
    const sub = p.trait || p.ageRange || '';
    const traitSpan = sub ? `<span class="focus-pill-trait">${esc(sub)}</span>` : '';
    btn.innerHTML = nameSpan + traitSpan;
    if (state.priorityPersonaIds.includes(p.id)) btn.classList.add('active');
    btn.addEventListener('click', () => {
      if (state.priorityPersonaIds.includes(p.id)) {
        state.priorityPersonaIds = state.priorityPersonaIds.filter(id => id !== p.id);
      } else {
        state.priorityPersonaIds.push(p.id);
      }
      renderPersonaFocus();
      clearIdeasIfStale();
    });
    el.appendChild(btn);
  });
  document.getElementById('persona-focus-row').style.display = state.personas.length ? 'flex' : 'none';
}

function parsePersonaFile(text, filename) {
  if (filename.toLowerCase().endsWith('.json')) {
    const data = JSON.parse(text);
    const arr = Array.isArray(data) ? data : [data];
    return arr.map(p => ({
      id: uid(),
      name: p.name || p.nome || '',
      ageRange: p.ageRange || p.faixaEtaria || p.idade || '',
      interests: p.interests || p.interesses || [],
      painPoints: p.painPoints || p.dores || p.desafios || [],
    }));
  }
  // TXT: blocks separated by --- or triple newline
  const blocks = text.split(/\n---+\n|\n{3,}/);
  return blocks.filter(b => b.trim()).map(block => {
    const lines = block.trim().split('\n');
    const get = (...keys) => {
      for (const key of keys) {
        const line = lines.find(l => new RegExp(`^${key}\\s*:`, 'i').test(l));
        if (line) return line.replace(/^[^:]+:\s*/, '').trim();
      }
      return '';
    };
    const getList = (...keys) => {
      const val = get(...keys);
      return val ? val.split(/,|;/).map(s => s.trim()).filter(Boolean) : [];
    };
    return {
      id: uid(),
      name: get('nome', 'name', 'persona'),
      ageRange: get('faixa etária', 'faixa etaria', 'idade', 'age', 'agerange'),
      interests: getList('interesses', 'interests'),
      painPoints: getList('dores', 'desafios', 'pain points', 'painpoints'),
    };
  }).filter(p => p.name);
}

function renderPersonas() {
  const list = document.getElementById('personas-list');
  const empty = document.getElementById('personas-empty');
  list.innerHTML = '';
  if (!state.personas.length) {
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  state.personas.forEach(p => list.appendChild(buildPersonaCard(p)));
}

function buildPersonaCard(p) {
  const card = document.createElement('div');
  card.className = 'persona-card'; card.dataset.id = p.id;

  const interestTags = p.interests.map(i => `<span class="persona-tag">${i}</span>`).join('');
  const painTags = p.painPoints.map(pt => `<span class="persona-pain">${pt}</span>`).join('');

  const metaHtml = (p.ageRange || p.trait)
    ? `<div class="persona-meta">${p.ageRange ? `<span class="persona-age">${p.ageRange}</span>` : ''}${p.trait ? `<span class="persona-trait">${p.trait}</span>` : ''}</div>`
    : '';
  card.innerHTML = `
    <div class="persona-hdr">
      <div class="persona-hdr-info">
        <div class="persona-name">${p.name || '(sem nome)'}</div>
        ${metaHtml}
      </div>
      <span class="persona-chevron">›</span>
    </div>
    <div class="persona-body">
      ${p.interests.length ? `<div class="persona-section-lbl">Interesses</div><div class="persona-tags">${interestTags}</div>` : ''}
      ${p.painPoints.length ? `<div class="persona-section-lbl" style="margin-top:10px">Dores e Desafios</div><div class="persona-tags">${painTags}</div>` : ''}
      <div class="persona-actions">
        <button type="button" class="btn-sm persona-edit-btn" style="flex:1" data-id="${p.id}">Editar</button>
        <button type="button" class="persona-del-btn" data-id="${p.id}" title="Remover">✕</button>
      </div>
    </div>`;

  card.querySelector('.persona-hdr').addEventListener('click', () => {
    const body = card.querySelector('.persona-body');
    const chev = card.querySelector('.persona-chevron');
    const open = body.classList.toggle('show');
    chev.classList.toggle('open', open);
  });

  card.querySelector('.persona-edit-btn').addEventListener('click', e => {
    e.stopPropagation();
    showPersonaEditForm(card, p);
  });

  card.querySelector('.persona-del-btn').addEventListener('click', e => {
    e.stopPropagation();
    state.personas = state.personas.filter(x => x.id !== p.id);
    renderPersonas();
  });

  return card;
}

function showPersonaEditForm(card, p) {
  const body = card.querySelector('.persona-body');
  const chev = card.querySelector('.persona-chevron');
  body.classList.add('show'); chev.classList.add('open');

  body.innerHTML = `
    <div class="persona-edit-form">
      <div class="form-group">
        <label>Nome da persona</label>
        <input type="text" class="pe-name" value="${p.name}" placeholder="ex: Proprietários em fase de construção">
      </div>
      <div class="form-group">
        <label>Faixa etária</label>
        <input type="text" class="pe-age" value="${p.ageRange}" placeholder="ex: 25-55 anos">
      </div>
      <div class="form-group">
        <label>Característica principal</label>
        <input type="text" class="pe-trait" value="${p.trait||''}" placeholder="ex: Empreendedor, Proprietário de imóvel…">
      </div>
      <div class="form-group">
        <label>Interesses (um por linha)</label>
        <textarea class="pe-interests" rows="3">${p.interests.join('\n')}</textarea>
      </div>
      <div class="form-group">
        <label>Dores e desafios (um por linha)</label>
        <textarea class="pe-pains" rows="3">${p.painPoints.join('\n')}</textarea>
      </div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button type="button" class="btn-gen pe-save" style="flex:1;padding:9px;font-size:13px">Salvar</button>
        <button type="button" class="btn-sm pe-cancel">Cancelar</button>
      </div>
    </div>`;

  body.querySelector('.pe-save').addEventListener('click', () => {
    const idx = state.personas.findIndex(x => x.id === p.id);
    if (idx === -1) return;
    state.personas[idx] = {
      ...state.personas[idx],
      name: body.querySelector('.pe-name').value.trim(),
      ageRange: body.querySelector('.pe-age').value.trim(),
      trait: body.querySelector('.pe-trait').value.trim(),
      interests: body.querySelector('.pe-interests').value.split('\n').map(s=>s.trim()).filter(Boolean),
      painPoints: body.querySelector('.pe-pains').value.split('\n').map(s=>s.trim()).filter(Boolean),
    };
    renderPersonas();
  });

  body.querySelector('.pe-cancel').addEventListener('click', () => renderPersonas());
}

// ─── PERSON PHOTOS UI ────────────────────────────────────────────────────────

function renderPersonPhotos() {
  const grid = document.getElementById('person-photos-grid');
  if (!grid) return;
  grid.innerHTML = '';
  state.personPhotos.forEach(photo => {
    const thumb = document.createElement('div');
    thumb.className = 'person-photo-thumb';
    const img = document.createElement('img');
    img.src = `data:${photo.mime};base64,${photo.b64}`; img.alt = 'foto';
    const rm = document.createElement('button');
    rm.type = 'button'; rm.className = 'person-photo-rm'; rm.title = 'Remover'; rm.textContent = '×';
    rm.addEventListener('click', () => {
      state.personPhotos = state.personPhotos.filter(x => x.id !== photo.id);
      renderPersonPhotos();
    });
    thumb.appendChild(img); thumb.appendChild(rm);
    grid.appendChild(thumb);
  });
}

// ─── PROMPT GENERATION ───────────────────────────────────────────────────────

async function generatePrompts(marca, tema, modifier, apiKey) {
  const N = state.slideCount, region = state.region;
  const { imageSource, imageDescription, attachedImage } = state;

  const imageNote = imageSource === 'describe' && imageDescription
    ? `\nIMAGEM DE REFERÊNCIA: "${imageDescription}"`
    : imageSource === 'attach' && attachedImage
    ? '\nSTYLE REFERENCE: Image provided above — analyze its composition, palette, lighting, mood, and visual language. Create something SIMILAR in style but adapted to the brand and objective.'
    : '';

  const objectiveBlock = buildObjectiveDirectivesBlock();
  const briefNote = _getClientBriefNote();
  const stratNote = _getStrategyNote([2, 5]);

  const personRule = state.personPhotos.length
    ? '\n11. PERSON RULE: A real person\'s photo is provided as reference. Include this person REALISTICALLY — same facial features, skin tone, build, age. Do NOT idealize, alter, or caricature their appearance.'
    : '';

  const logoRule = state.logos.length
    ? '10. LOGO RULE: Brand logo reference(s) provided above — incorporate the most appropriate variation EXACTLY as-is, without modification.'
    : '10. LOGO RULE: NEVER invent, draw, or approximate any brand logo, symbol, emblem, or icon. No gear icons, house shapes, shields, letter marks, monograms, or abstract brand symbols. Represent the brand by its name as clean plain text ONLY.';

  const narrativeGuide =
    N===1?'Single slide: one powerful message.':
    N===2?'2 slides: bold hook → CTA.':
    N===3?'3 slides: hook → core insight → CTA.':
    N<=5?`${N} slides: hook → problem → solution → key proof → CTA.`:
    `${N} slides: richest narrative arc. Hook first, CTA last, fill middle with problem/solution/data/proof.`;

  const prompt = `You are an expert Instagram carousel strategist and visual prompt engineer.

TASK: Generate exactly ${N} image generation prompts for a ${N}-slide Instagram carousel.
Brand: ${marca} | Topic: ${tema} | Region: ${region}${imageNote}

════ VISUAL STYLE REFERENCE (do NOT copy this text into prompts) ════
Style guide for all slides: "${modifier}"${_getRefStyleBlock('carrossel')}
══════════════════════════════════════════${objectiveBlock}${briefNote}${stratNote}

⚠️ ABSOLUTE RULES:
1. PORTRAIT: Every image is vertical portrait (taller than wide).
2. SAFE ZONE — CRITICAL: ALL text elements must be fully contained within a 20% inset from EVERY edge (top, bottom, left, right). Text that touches or crosses any border is FORBIDDEN. No headline, CTA, or label may appear within the top 20% or bottom 20% of the image.
3. MODIFIER IS STYLE ONLY: Never render hex codes, font names, or tech specs as visible text.
4. GEOGRAPHY: Only "${region}" for location. NEVER São Paulo, Rio de Janeiro, Minas Gerais, or other states.
5. TEXT IN PORTUGUESE: All visible words must be Brazilian Portuguese (pt-BR). No English.
6. TEXT RELEVANCE: Text overlaid must relate directly to what is visually shown.
7. VISUAL COHESION: All ${N} slides share the same palette, lighting, and composition style.
8. NO GIBBERISH: All text must be real, meaningful pt-BR words. No partial words or nonsense.
9. TEXT QUALITY: Max 5 words per text element. Simple common vocabulary only. NEVER invent or distort words. Grammatically correct pt-BR. When unsure, use a simpler word or a number.
${logoRule}${personRule}

SLIDE FORMATS (choose best per slide): "photo" | "graphic" | "icon" | "stat"
Narrative arc: ${narrativeGuide}

Return ONLY a valid JSON array:
[{"slide":1,"tipo":"hero","format":"photo","prompt":"..."},...]
Each "prompt" must contain ONLY the visual description — do NOT include the modifier text (it will be prepended automatically).`;

  const parts = [];
  if (state.logos.length) {
    parts.push({text: state.logos.length === 1 ? 'Brand logo (incorporate EXACTLY — do NOT redraw or approximate):' : `Brand logo — ${state.logos.length} variations (incorporate the most appropriate one EXACTLY):`});
    for (const lg of state.logos) parts.push({inlineData:{mimeType:lg.mime, data:lg.b64}});
  }
  for (const ph of state.personPhotos) {
    parts.push({text:'Person to include realistically in images:'});
    parts.push({inlineData:{mimeType:ph.mime, data:ph.b64}});
  }
  if (imageSource==='attach' && attachedImage) {
    parts.push({text:'STYLE REFERENCE IMAGE: Analyze this image — study its composition, color palette, lighting, typography treatment, spatial layout, mood, and visual energy. Create images that speak the same visual language, adapted to the brand identity and post objective.'});
    parts.push({inlineData:{mimeType:attachedImage.mime, data:attachedImage.b64}});
  }
  parts.push({text:prompt});

  const data = await callGemini(apiKey, {
    contents:[{role:'user', parts}],
    generationConfig:{temperature:0.72, maxOutputTokens:8192},
  });
  const usage = data.usageMetadata||{};
  state.totalCost += (usage.promptTokenCount||0)*COST_IN_TOKEN+(usage.candidatesTokenCount||0)*COST_OUT_TOKEN;
  refreshCost();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text||'';
  return JSON.parse(raw.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim());
}

function _getRefStyleBlock(contentType) {
  if (!state.refStyle.length) return '';
  const order = REF_USAGE_MAP[contentType] || [];
  // Sort entries so preferred types for this content type come first
  const sorted = [...state.refStyle].sort((a, b) => {
    const ia = order.indexOf(a.type), ib = order.indexOf(b.type);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  const lines = sorted.map(e => `[${e.label}] ${e.style}`).join('\n');
  const note = order[0] ? ` — prioritize types most relevant to ${contentType}` : '';
  return `\n\n════ VISUAL REFERENCES — client's benchmark images${note} ════\n${lines}`;
}

async function generateVariationPrompts(marca, brief, modifier, qty, format, apiKey) {
  const region = state.region, fmtInfo = FORMAT_DIMS[format];
  const isStory = format==='9:16';
  const { imageSource, imageDescription, attachedImage } = state;
  const aspectNote = isStory
    ? 'VERTICAL PORTRAIT 9:16 — image must be TALLER than wide, optimized for mobile full-screen Stories.'
    : format==='1:1' ? 'SQUARE 1:1 — perfectly balanced centered composition.'
    : 'VERTICAL PORTRAIT 4:5 — image must be TALLER than wide (portrait orientation, NOT landscape, NOT horizontal), optimized for Instagram Feed.';

  const imageNote = imageSource === 'describe' && imageDescription
    ? `\nREFERENCE CONCEPT: "${imageDescription}" — use as creative direction for composition and mood.`
    : imageSource === 'attach' && attachedImage
    ? '\nSTYLE REFERENCE: Image provided above — analyze its composition, palette, lighting, mood, and visual language. Create something SIMILAR in style but adapted to the brand and objective.'
    : '';
  const objectiveBlock = buildObjectiveDirectivesBlock();
  const briefNote = _getClientBriefNote();
  const stratNote = _getStrategyNote([2, 3, 5]);

  const personRule = state.personPhotos.length
    ? `\n${isStory?'13':'12'}. PERSON RULE: A real person's photo is provided as reference. Include this person REALISTICALLY — same facial features, skin tone, build, age. Do NOT idealize, alter, or caricature their appearance.`
    : '';

  const logoRule = state.logos.length
    ? 'Brand logo reference(s) provided above — incorporate the most appropriate variation EXACTLY as-is, without modification.'
    : 'NEVER invent, draw, or approximate any brand logo, symbol, emblem, or icon. No gear icons, house shapes, shields, letter marks, monograms, or abstract symbols. Use brand name as clean plain text ONLY.';

  const prompt = `Expert advertising creative director and visual prompt engineer.

TASK: Generate exactly ${qty} image generation prompts — ${qty} visual variation(s) of the same ad.
Brand: ${marca} | Brief: ${brief} | Format: ${fmtInfo.label} — ${aspectNote} | Region: ${region}${imageNote}

════ VISUAL STYLE REFERENCE (do NOT copy this text into prompts) ════
Style guide: "${modifier}"${_getRefStyleBlock('criativos')}
══════════════════════════════════════════${objectiveBlock}${briefNote}${stratNote}

Variation angles: 1=hero, 2=lifestyle/context, 3=close-up/detail (if qty≥3), 4=abstract/conceptual (if qty≥4)

⚠️ ABSOLUTE RULES:
1. ASPECT RATIO: ${aspectNote}
2. ZERO TEXT IN IMAGE: Do NOT render ANY text, letters, words, numbers, signs, labels, or symbols inside the generated image. The ad copy will be overlaid programmatically on top. Pure visual scene only — this rule overrides everything else.
3. MODIFIER IS STYLE ONLY: No hex codes, font names, or tech specs as visual elements.
4. GEOGRAPHY: Only "${region}". Never other Brazilian states.
5. VISUAL COHESION: All ${qty} variations share palette, lighting, and brand aesthetic.
6. SINGLE AD: Each is a standalone visual scene — clean, impactful, no distractions.
${isStory?'7':'6'}. LOGO RULE: ${logoRule}${personRule}

OVERLAY COLORS: For each variation, pick brand-appropriate hex colors for the text overlay:
- "scrimHex": darkest tone of brand palette for the gradient scrim (e.g. "#0A0820" dark navy, "#1A0800" dark amber, "#000000" neutral black)
- "ctaBg": brand accent/primary color for the CTA pill (e.g. "#F39C12" orange, "#1F4788" cobalt, "#D4AF37" gold)
- "ctaText": "#FFFFFF" (or "#000000" if ctaBg is very light)

Return ONLY valid JSON:
[{"variation":1,"angle":"hero","prompt":"...","adText":{"headline":"headline impactante em pt-BR, max 38 chars","sub":"benefício principal em pt-BR, max 55 chars","cta":"chamada para ação em pt-BR, max 18 chars","colors":{"scrimHex":"#000000","ctaBg":"#6C3CE1","ctaText":"#FFFFFF"}}},...]
Each "prompt" must contain ONLY the visual description — do NOT include the modifier text (it will be prepended automatically).
The "adText" fields must be compelling ad copy in pt-BR matching the visual scene and brand brief.`;

  const parts = [];
  if (state.logos.length) {
    parts.push({text: state.logos.length === 1 ? 'Brand logo (incorporate EXACTLY — do NOT redraw or approximate):' : `Brand logo — ${state.logos.length} variations (incorporate the most appropriate one EXACTLY):`});
    for (const lg of state.logos) parts.push({inlineData:{mimeType:lg.mime, data:lg.b64}});
  }
  for (const ph of state.personPhotos) {
    parts.push({text:'Person to include realistically in images:'});
    parts.push({inlineData:{mimeType:ph.mime, data:ph.b64}});
  }
  if (imageSource === 'attach' && attachedImage) {
    parts.push({text:'STYLE REFERENCE IMAGE: Analyze this image — study its composition, color palette, lighting, typography treatment, spatial layout, mood, and visual energy. Create images that speak the same visual language, adapted to the brand identity and post objective.'});
    parts.push({inlineData:{mimeType:attachedImage.mime, data:attachedImage.b64}});
  }
  parts.push({text:prompt});

  const data = await callGemini(apiKey, {
    contents:[{role:'user', parts}],
    generationConfig:{temperature:0.72, maxOutputTokens:4096},
  });
  const usage = data.usageMetadata||{};
  state.totalCost += (usage.promptTokenCount||0)*COST_IN_TOKEN+(usage.candidatesTokenCount||0)*COST_OUT_TOKEN;
  refreshCost();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text||'';
  return JSON.parse(raw.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim());
}

async function generateCaption(marca, temaOrBrief, promptsOrVariations, apiKey, isCarousel=true, personasOverride=null) {
  const region = state.region, format = state.format;
  if (!isCarousel && format==='9:16') return '';

  const activePersonas = personasOverride || (state.personas.length ? state.personas.slice(0,3) : []);
  const personaNote = activePersonas.length
    ? `\nPersonas-alvo: ${activePersonas.map(p=>`${p.name}${p.ageRange?` (${p.ageRange})`:''}${p.trait?` — ${p.trait}`:''}`).join(', ')}`
    : '';
  const postObj = getPostObjectiveDirectives();
  const objectiveNote = postObj ? `\nObjetivo do post: ${postObj.label} — tom ${postObj.mood.toLowerCase()}` : '';
  const briefNote = _getClientBriefNote();
  const stratNote = _getStrategyNote([4, 5]);

  const arc = isCarousel
    ? promptsOrVariations.map((p,i) => `Slide ${i+1}: ${p.tipo||'content'}`).join(', ')
    : promptsOrVariations.map((p,i) => `Variação ${i+1}: ${p.angle||'ad'}`).join(', ');

  const prompt = `Write a perfect Instagram caption. Ready to paste, no labels.

Brand: ${marca} | ${isCarousel?'Topic':'Brief'}: ${temaOrBrief} | Region: ${region}${personaNote}${objectiveNote}${briefNote}${stratNote}
${isCarousel?`Slides: ${state.slideCount}`:`Format: ${FORMAT_DIMS[format]?.label}`}
Content:
${arc}

STRUCTURE:
1. HOOK (lines 1-2): scroll-stopper, bold, specific. Max 10 words/line. No emoji on line 1. Shows BEFORE "ver mais".
[blank line]
2. BODY (2-3 short paragraphs, 2 lines max): problem/context → what it reveals → why now in ${region}
[blank line]
3. CTA: one direct instruction or question.
[blank line]
4. HASHTAGS: 10-12 total. Mix broad + topic-specific + regional (${region.split(',')[0]}) + brand.

STYLE: Brazilian Portuguese. Direct, authoritative. Max 4 emojis. No jargon. Geographic refs: always ${region}.`;

  const data = await callGemini(apiKey, {
    contents:[{role:'user',parts:[{text:prompt}]}],
    generationConfig:{temperature:0.68, maxOutputTokens:1024},
  });
  const usage = data.usageMetadata||{};
  state.totalCost += (usage.promptTokenCount||0)*COST_IN_TOKEN+(usage.candidatesTokenCount||0)*COST_OUT_TOKEN;
  refreshCost();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()||'';
}

async function generateIdeas(marca, modifier, apiKey, existingIdeas=[]) {
  const region = state.region;
  const isCarousel = state.contentType === 'carousel' || state.contentType === 'stories_seq';
  const services = state.brandServices;
  const servicesLine = services.length
    ? `Serviços reais confirmados: ${services.slice(0,7).join(', ')}`
    : `Inferir serviços a partir do nome/nicho da marca`;

  const usedThemes = ClientDB.getUsedThemes(marca);
  const allAvoid = [...usedThemes, ...existingIdeas];
  const avoidLine = allAvoid.length
    ? `\nIDEIAS/TEMAS A EVITAR — gere ideias completamente diferentes:\n${allAvoid.slice(0,20).map(t=>`- ${t}`).join('\n')}`
    : '';

  const activePersonas = state.priorityPersonaIds.length
    ? state.personas.filter(p => state.priorityPersonaIds.includes(p.id))
    : state.personas.slice(0, 3);
  const personaNote = activePersonas.length
    ? `\nPersonas-alvo (gere ideias que ressoem DIRETAMENTE com essas pessoas):\n${activePersonas.map(p =>
        `- ${p.name}${p.ageRange ? ` (${p.ageRange})` : ''}${p.trait ? ` — "${p.trait}"` : ''}${p.painPoints.length ? `: ${p.painPoints.slice(0,2).join('; ')}` : ''}`
      ).join('\n')}`
    : '';

  const tipoDesc = state.contentType === 'stories_seq'
    ? 'Sequência de Stories (série de frames narrativos 9:16)'
    : isCarousel ? 'Carrossel (sequência de slides informativos)'
    : 'Criativo (anúncio/post visual único)';

  const objDirectives = getPostObjectiveDirectives();
  const objNote = objDirectives
    ? `\nObjetivo do post: ${objDirectives.label} — gere ideias com ângulo adequado para esse tipo de conteúdo`
    : '';
  const briefNote = _getClientBriefNote();
  const stratNote = _getStrategyNote([5]);

  const prompt = `Estrategista de conteúdo para Instagram brasileiro.

Marca: ${marca} | Região: ${region}
Tipo: ${tipoDesc}
${servicesLine}${objNote}${personaNote}${avoidLine}${briefNote}${stratNote}

Gere exatamente 5 ideias de tema ESPECÍFICAS para os serviços listados acima.
Regras:
- Cada ideia deve mencionar ou aludir a um serviço/entrega CONCRETO da marca (não categoria genérica)
- Cada ideia deve ressoar DIRETAMENTE com as personas-alvo listadas (linguagem, dor e aspirações delas)
- O ângulo da ideia deve se encaixar no objetivo do post definido acima
- Específica, engajante, com potencial de salvar/compartilhar
- Máximo 8 palavras por ideia
- Em português brasileiro
- NÃO gere ideias sobre serviços que a marca não oferece
- NÃO repita temas já criados listados acima

Retorne APENAS JSON array de 5 strings:
["Ideia 1","Ideia 2","Ideia 3","Ideia 4","Ideia 5"]`;

  const data = await callGeminiWithRetry(apiKey, {
    contents:[{role:'user',parts:[{text:prompt}]}],
    generationConfig:{temperature:0.85, maxOutputTokens:512},
  }, 'Geração de ideias');
  const usage = data.usageMetadata||{};
  state.totalCost += (usage.promptTokenCount||0)*COST_IN_TOKEN+(usage.candidatesTokenCount||0)*COST_OUT_TOKEN;
  refreshCost();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text||'';
  return JSON.parse(raw.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim());
}

async function generateImage(prompt, apiKey, label='') {
  const parts = [];
  if (state.logos.length) {
    parts.push({text: state.logos.length === 1 ? 'Brand logo (incorporate EXACTLY — do NOT redraw or approximate):' : `Brand logo — ${state.logos.length} variations (incorporate the most appropriate one EXACTLY):`});
    for (const lg of state.logos) parts.push({inlineData:{mimeType:lg.mime, data:lg.b64}});
  }
  for (const ph of state.personPhotos) {
    parts.push({text:'Real person to include in image (use realistically — same face, build, skin tone):'});
    parts.push({inlineData:{mimeType:ph.mime, data:ph.b64}});
  }
  parts.push({text:prompt});
  const data = await callGeminiWithRetry(apiKey, {
    contents:[{role:'user', parts}],
    generationConfig:{responseModalities:['image','text']},
  }, label);
  state.totalCost += COST_IMG_FIXED; refreshCost();
  const resParts = data.candidates?.[0]?.content?.parts||[];
  const imgPart = resParts.find(p=>p.inlineData?.mimeType?.startsWith('image/'));
  if (!imgPart) throw new Error('Resposta sem imagem');
  return { b64: imgPart.inlineData.data, mime: imgPart.inlineData.mimeType };
}

// ─── CAROUSEL UI ─────────────────────────────────────────────────────────────

function initSlots(n) {
  const N = (n !== undefined) ? n : (state._activeSlideN || state.slideCount);
  const track = document.getElementById('c-track'); track.innerHTML='';
  for (let i=0; i<N; i++) {
    const el = document.createElement('div'); el.className='c-slide'; el.dataset.i=i;
    el.innerHTML=`<div class="slide-spinner" style="opacity:.2"><div class="spinner"></div></div>`;
    track.appendChild(el);
  }
}
function initSegBar(n) {
  const N = (n !== undefined) ? n : (state._activeSlideN || state.slideCount);
  const bar = document.getElementById('seg-bar'); bar.innerHTML='';
  for (let i=0; i<N; i++) {
    const seg=document.createElement('div'); seg.className='seg'; seg.dataset.i=i;
    seg.addEventListener('click',()=>goTo(i)); bar.appendChild(seg);
  }
}
function refreshSegs() {
  document.querySelectorAll('.seg').forEach((seg,i)=>{
    const s=state.slides[i]; let cls='seg';
    if (i===state.currentSlide) cls+=' active';
    else if (s==='loading') cls+=' loading';
    else if (s?.b64) cls+=' done';
    else if (s?.error) cls+=' err';
    seg.className=cls;
  });
}
function setSlideEl(index, data) {
  const el = document.querySelectorAll('.c-slide')[index]; if (!el) return;
  if (data==='loading') {
    el.innerHTML=`<div class="slide-spinner"><div class="spinner"></div><p>Gerando slide ${index+1}…</p></div>`;
  } else if (data?.error) {
    el.innerHTML=`<div class="slide-err"><span>⚠</span><p>Slide ${index+1}</p><small>${data.error}</small><button class="btn-regen" data-i="${index}">↺ Tentar novamente</button></div>`;
    el.querySelector('.btn-regen')?.addEventListener('click', () => regenSlide(index));
  } else if (data?.b64) {
    const img=new Image(); img.alt=`Slide ${index+1}`; img.draggable=false;
    img.style.cursor='zoom-in';
    img.addEventListener('click',()=>openLightbox(data.b64, data.mime, `Slide ${index+1}`));
    img.addEventListener('load',()=>{el.innerHTML='';el.appendChild(img);});
    img.src=`data:${data.mime};base64,${data.b64}`;
  }
  refreshSegs();
}
function goTo(index) {
  const N=state._activeSlideN||state.slideCount; index=Math.max(0,Math.min(N-1,index));
  state.currentSlide=index;
  document.getElementById('c-track').style.transform=`translateX(-${index*100}%)`;
  document.getElementById('cnt-cur').textContent=index+1;
  document.getElementById('nav-prev').classList.toggle('hidden',index===0);
  document.getElementById('nav-next').classList.toggle('hidden',index===N-1);
  refreshSegs();
}

// ─── CREATIVE (GRID) UI ──────────────────────────────────────────────────────

function initGrid(qty, format) {
  const grid=document.getElementById('img-grid'), fmtInfo=FORMAT_DIMS[format];
  grid.innerHTML=''; grid.className=`img-grid show cols-${Math.min(qty,4)}`;
  for (let i=0; i<qty; i++) {
    const slot=document.createElement('div');
    slot.className=`img-slot ${fmtInfo.ratioClass}`; slot.dataset.i=i;
    slot.innerHTML=`<div class="slot-spinner" style="opacity:.25"><div class="spinner"></div></div><span class="slot-num">${i+1}</span>`;
    grid.appendChild(slot);
  }
}
function setSlotEl(index, data) {
  const el=document.querySelectorAll('.img-slot')[index]; if (!el) return;
  if (data==='loading') {
    el.innerHTML=`<div class="slot-spinner"><div class="spinner"></div><p>Gerando ${index+1}…</p></div><span class="slot-num">${index+1}</span>`;
  } else if (data?.error) {
    el.innerHTML=`<div class="slot-err"><span>⚠</span><p>${index+1}</p><button class="btn-regen" data-i="${index}">↺</button></div><span class="slot-num">${index+1}</span>`;
    el.querySelector('.btn-regen')?.addEventListener('click', () => regenCreative(index));
  } else if (data?.b64) {
    const img=new Image(); img.alt=`Variação ${index+1}`; img.draggable=false;
    img.style.cursor='zoom-in';
    img.addEventListener('click',()=>openLightbox(data.b64, data.mime, `Variação ${index+1}`));
    img.addEventListener('load',()=>{
      el.innerHTML=`<span class="slot-num">${index+1}</span>`;
      el.insertBefore(img, el.firstChild);
    });
    img.src=`data:${data.mime};base64,${data.b64}`;
  }
}

// ─── LIGHTBOX ────────────────────────────────────────────────────────────────

function openLightbox(b64, mime, label='') {
  const lb = document.getElementById('lightbox');
  document.getElementById('lightbox-img').src = `data:${mime};base64,${b64}`;
  document.getElementById('lightbox-info').textContent = label;
  lb.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  const lb = document.getElementById('lightbox');
  if (lb) lb.style.display = 'none';
  document.body.style.overflow = '';
}

// ─── PROGRESS / COST / TOAST ─────────────────────────────────────────────────

function setProgress(text, hide=false) {
  const el=document.getElementById('prog-text'); el.textContent=text; el.classList.toggle('hide',hide);
}
function refreshCost() {
  document.getElementById('cost-val').textContent=`$${state.totalCost.toFixed(4)}`;
}
function toast(msg, type='') {
  const c=document.getElementById('toasts'), el=document.createElement('div');
  el.className=`toast ${type}`; el.textContent=msg; c.appendChild(el);
  setTimeout(()=>el.remove(),4500);
}

// ─── DOWNLOAD ────────────────────────────────────────────────────────────────

async function downloadZip(slug, items, labelFn) {
  const btn=document.getElementById('btn-dl'); btn.disabled=true;
  const zip=new ZipWriter(); let n=0;
  for (let i=0; i<items.length; i++) {
    const s=items[i]; if (!s?.b64) continue; n++;
    btn.textContent=`Empacotando ${n}/${items.length}…`;
    zip.addFile(labelFn(i), b64ToBytes(s.b64));
    await new Promise(r=>setTimeout(r,0));
  }
  if (state.caption) {
    zip.addFile('legenda.txt', new TextEncoder().encode(state.caption));
  }
  const blob=zip.generate(), url=URL.createObjectURL(blob);
  Object.assign(document.createElement('a'),{href:url,download:`${slug||'download'}.zip`}).click();
  URL.revokeObjectURL(url);
  btn.textContent='Download pronto ✓'; btn.disabled=false;
  setTimeout(()=>{ btn.textContent='Baixar arquivos'; },3500);
}

// ─── GENERATION FLOWS ─────────────────────────────────────────────────────────

async function generateCarousel(marca, tema, modifier, apiKey) {
  const N = state.slideCount;
  state._activeSlideN = N;
  state.slides=new Array(N).fill(null); state.caption=''; state.currentSlide=0;

  document.getElementById('view-creative').style.display='none';
  document.getElementById('view-carousel').style.display='block';
  document.getElementById('cnt-tot').textContent=N;
  initSlots(N); initSegBar(N); goTo(0);

  setProgress('Gerando prompts…');
  let prompts;
  try { prompts = await generatePrompts(marca, tema, modifier, apiKey); }
  catch(err) {
    toast(`Erro ao gerar prompts: ${err.message}`,'err');
    setProgress(`Erro: ${err.message}`); return null;
  }

  for (let i=0; i<N; i++) { state.slides[i]='loading'; setSlideEl(i,'loading'); }

  state._lastPrompts = prompts;

  for (let i=0; i<N; i++) {
    if (state._abortController?.signal.aborted) break;
    if (!prompts[i]) continue;
    const label=`Slide ${i+1}/${N}`; setProgress(`Gerando ${label}…`);
    try {
      const fmtInfo=FORMAT_DIMS['4:5'];
      const fullPrompt = `${modifier}\n\n${prompts[i].prompt}`;
      const raw=await generateImage(fullPrompt, apiKey, label);
      setProgress(`Normalizando ${label}…`);
      const normed=await normalizeToTarget(raw.b64, raw.mime, fmtInfo.w, fmtInfo.h);
      state.slides[i]=normed; setSlideEl(i,normed);
    } catch(err) {
      if (err.name === 'AbortError') break;
      state.slides[i]={error:err.message}; setSlideEl(i,{error:err.message});
      toast(`Slide ${i+1}: ${err.message}`,'err');
    }
  }
  saveFormatState();
  return prompts;
}

async function generateCreative(marca, brief, modifier, apiKey) {
  const qty=state.qty, format=state.format, fmtInfo=FORMAT_DIMS[format];
  state.images=new Array(qty).fill(null); state.caption='';

  document.getElementById('view-carousel').style.display='none';
  document.getElementById('view-creative').style.display='block';
  initGrid(qty, format);

  setProgress('Gerando prompts de variações…');
  let variations;
  try { variations=await generateVariationPrompts(marca, brief, modifier, qty, format, apiKey); }
  catch(err) {
    toast(`Erro ao gerar prompts: ${err.message}`,'err');
    setProgress(`Erro: ${err.message}`); return null;
  }

  for (let i=0; i<qty; i++) { state.images[i]='loading'; setSlotEl(i,'loading'); }

  state._lastVariations = variations;

  const openAIKey = localStorage.getItem('adgen_openai_key') || '';
  for (let i=0; i<qty; i++) {
    if (state._abortController?.signal.aborted) break;
    if (!variations[i]) continue;
    const label=`Variação ${i+1}/${qty}`; setProgress(`Gerando ${label}…`);
    try {
      const fullPrompt = `${modifier}\n\n${variations[i].prompt}`;
      const raw = openAIKey
        ? await callDallE3(openAIKey, fullPrompt, format, label)
        : await generateImage(fullPrompt, apiKey, label);
      setProgress(`Finalizando ${label}…`);
      const normed = await normalizeToTarget(raw.b64, raw.mime, fmtInfo.w, fmtInfo.h);
      const final  = await overlayAdText(normed.b64, normed.mime, variations[i].adText, format);
      state.images[i]=final; setSlotEl(i,final);
    } catch(err) {
      if (err.name === 'AbortError') break;
      state.images[i]={error:err.message}; setSlotEl(i,{error:err.message});
      toast(`Variação ${i+1}: ${err.message}`,'err');
    }
  }
  saveFormatState();
  return variations;
}

// ─── STORIES SEQUENCE ────────────────────────────────────────────────────────

async function generateStorySeqPrompts(marca, tema, modifier, apiKey) {
  const N = state.storiesSeqCount;
  const region = state.region;
  const { imageSource, imageDescription, attachedImage } = state;
  const objectiveBlock = buildObjectiveDirectivesBlock();
  const briefNote = _getClientBriefNote();
  const stratNote = _getStrategyNote([2, 5, 6]);

  const imageNote = imageSource === 'describe' && imageDescription
    ? `\nREFERENCE CONCEPT: "${imageDescription}" — use as creative direction for composition and mood.`
    : imageSource === 'attach' && attachedImage
    ? '\nSTYLE REFERENCE: Image provided above — analyze its composition, palette, lighting, mood, and visual language. Create something SIMILAR in style but adapted to the brand and objective.'
    : '';

  const personRule = state.personPhotos.length
    ? '\nPERSON RULE: Real person photo provided — include REALISTICALLY, same facial features, skin tone, build. Do NOT idealize.'
    : '';

  const logoRule = state.logos.length
    ? 'LOGO RULE: Brand logo reference(s) provided above — incorporate the most appropriate variation EXACTLY as-is.'
    : 'LOGO RULE: NEVER invent logos, symbols, or letter marks. Brand name as clean plain text ONLY.';

  const arcGuide = N <= 3
    ? `Frame 1: gancho visual impactante. Frame ${N}: CTA direto.`
    : `Frame 1: gancho/pergunta impactante que para o scroll. Frames 2-${N-1}: desenvolvimento com dados/provas/insights. Frame ${N}: CTA forte e ação direta.`;

  const prompt = `Expert Instagram Story sequence strategist and visual prompt engineer.

TASK: Generate exactly ${N} image prompts for a ${N}-frame Instagram Story sequence.
Brand: ${marca} | Topic: ${tema} | Region: ${region}${imageNote}

════ VISUAL STYLE REFERENCE (do NOT copy into prompts) ════
Style guide: "${modifier}"${_getRefStyleBlock('stories')}
══════════════════════════════════════════${objectiveBlock}${briefNote}${stratNote}

Story arc: ${arcGuide}

⚠️ ABSOLUTE RULES:
1. FORMAT: Every image MUST be vertical 9:16 — taller than wide, full-screen mobile Stories.
2. SELF-CONTAINED: Each frame stands alone. No swipe-up prompts, no UI elements, no arrows.
3. MINIMAL TEXT: Max 3 text elements per frame. Large, bold, legible on small phone screens.
4. SAFE ZONE — CRITICAL: ALL text must be fully inside a 20% inset from every edge (top, bottom, left, right). Text cut off by any edge is STRICTLY FORBIDDEN. No text within the top 20% or bottom 20% of the frame.
5. GEOGRAPHY: Only "${region}". Never other Brazilian states.
6. PORTUGUESE: All visible text in pt-BR. No English.
7. VISUAL CONTINUITY: All ${N} frames share palette, typography, and brand aesthetic.
8. NO GIBBERISH: Real meaningful pt-BR words. No partial words or nonsense.
9. TEXT QUALITY: Max 5 words per element. Simple vocabulary. Grammatically correct pt-BR.
10. ${logoRule}${personRule}

Return ONLY a valid JSON array:
[{"frame":1,"role":"hook","prompt":"..."},...]
Each "prompt" must contain ONLY the visual description — do NOT include the modifier text.`;

  const parts = [];
  if (state.logos.length) {
    parts.push({text: state.logos.length === 1 ? 'Brand logo (incorporate EXACTLY — do NOT redraw or approximate):' : `Brand logo — ${state.logos.length} variations (incorporate the most appropriate one EXACTLY):`});
    for (const lg of state.logos) parts.push({inlineData:{mimeType:lg.mime, data:lg.b64}});
  }
  for (const ph of state.personPhotos) {
    parts.push({text:'Person to include realistically in images:'});
    parts.push({inlineData:{mimeType:ph.mime, data:ph.b64}});
  }
  if (imageSource === 'attach' && attachedImage) {
    parts.push({text:'STYLE REFERENCE IMAGE: Analyze this image — study its composition, color palette, lighting, typography treatment, spatial layout, mood, and visual energy. Create images that speak the same visual language, adapted to the brand identity and post objective.'});
    parts.push({inlineData:{mimeType:attachedImage.mime, data:attachedImage.b64}});
  }
  parts.push({text: prompt});

  const data = await callGemini(apiKey, {
    contents:[{role:'user', parts}],
    generationConfig:{temperature:0.72, maxOutputTokens:4096},
  });
  const usage = data.usageMetadata||{};
  state.totalCost += (usage.promptTokenCount||0)*COST_IN_TOKEN+(usage.candidatesTokenCount||0)*COST_OUT_TOKEN;
  refreshCost();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text||'';
  return JSON.parse(raw.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim());
}

async function generateStoriesSeq(marca, tema, modifier, apiKey) {
  const N = state.storiesSeqCount;
  const fmtInfo = FORMAT_DIMS['9:16'];
  state._activeSlideN = N;
  state.slides = new Array(N).fill(null); state.caption = ''; state.currentSlide = 0;

  document.getElementById('view-creative').style.display = 'none';
  document.getElementById('view-carousel').style.display = 'block';
  document.getElementById('cnt-tot').textContent = N;
  initSlots(N); initSegBar(N); goTo(0);

  setProgress('Gerando prompts para os stories…');
  let prompts;
  try { prompts = await generateStorySeqPrompts(marca, tema, modifier, apiKey); }
  catch(err) {
    toast(`Erro ao gerar prompts: ${err.message}`, 'err');
    setProgress(`Erro: ${err.message}`); return null;
  }

  for (let i = 0; i < N; i++) { state.slides[i] = 'loading'; setSlideEl(i, 'loading'); }
  state._lastPrompts = prompts;

  for (let i = 0; i < N; i++) {
    if (state._abortController?.signal.aborted) break;
    if (!prompts[i]) continue;
    const label = `Frame ${i+1}/${N}`; setProgress(`Gerando ${label}…`);
    try {
      const fullPrompt = `${modifier}\n\n${prompts[i].prompt}`;
      const raw = await generateImage(fullPrompt, apiKey, label);
      setProgress(`Normalizando ${label}…`);
      const normed = await normalizeToTarget(raw.b64, raw.mime, fmtInfo.w, fmtInfo.h);
      state.slides[i] = normed; setSlideEl(i, normed);
    } catch(err) {
      if (err.name === 'AbortError') break;
      state.slides[i] = {error: err.message}; setSlideEl(i, {error: err.message});
      toast(`Frame ${i+1}: ${err.message}`, 'err');
    }
  }
  saveFormatState();
  return prompts;
}

const POST_TYPE_LABELS = {
  'educativo':       'Post educativo',
  'venda':           'Venda / Lançamento',
  'prova-social':    'Prova social / Depoimento',
  'bastidores':      'Bastidores',
  'engajamento':     'Engajamento',
  'duvidas':         'Dúvidas Frequentes',
  'conscientizacao': 'Conscientização',
};

async function generate() {
  const apiKey  = localStorage.getItem('adgen_key')||'';
  const marca   = document.getElementById('in-brand').value.trim();
  const modifier= document.getElementById('mod-textarea').value.trim();
  const stylePref = document.getElementById('in-style-pref')?.value.trim() || '';
  const fullModifier = stylePref ? `${modifier}\nPreferência visual do cliente: ${stylePref}` : modifier;
  const regionEl = state.contentType === 'carousel' ? document.getElementById('in-region')
    : state.contentType === 'stories_seq' ? document.getElementById('in-region-stories')
    : document.getElementById('in-region-creative');
  const region  = (regionEl?.value||'').trim()||'Rondônia (RO), Brasil';

  let tema;
  if (state.ideaMode==='ideas') {
    tema=state.selectedIdea;
    if (!tema) { toast('Selecione uma ideia antes de gerar.','warn'); return; }
    const complement = document.getElementById('in-idea-complement')?.value.trim()||'';
    if (complement) tema += ` — ${complement}`;
  } else {
    tema=document.getElementById('in-tema').value.trim();
    if (!tema) { toast('Preencha o tema / descrição.','warn'); return; }
  }
  const postLabel = POST_TYPE_LABELS[state.postType] || '';
  const temaComTipo = postLabel ? `[${postLabel}] ${tema}` : tema;

  if (!apiKey)   { toast('Adicione sua API key.','warn'); return; }
  if (!marca)    { toast('Preencha o nome da marca.','warn'); return; }
  if (!fullModifier) { toast('Adicione o Image Generation Modifier.','warn'); return; }
  if (state.imageSource==='attach' && !state.attachedImage) { toast('Anexe uma imagem ou escolha outra opção.','warn'); return; }

  state.slideCount      = parseInt(document.getElementById('in-count').value,10)||7;
  state.format          = document.getElementById('in-format').value||'4:5';
  state.qty             = parseInt(document.getElementById('in-qty').value,10)||2;
  state.storiesSeqCount = parseInt(document.getElementById('in-stories-count')?.value,10)||5;
  state.region          = region;
  if (state.imageSource==='describe') state.imageDescription=document.getElementById('in-img-desc').value.trim();

  // Abort controller + timer setup
  state._abortController = new AbortController();
  state._genStartTime = Date.now();
  const timerEl = document.getElementById('prog-timer');
  const stopBtn = document.getElementById('btn-stop');
  if (timerEl) { timerEl.textContent = '0:00'; timerEl.style.display = 'inline'; }
  if (stopBtn) stopBtn.style.display = 'block';
  state._timerInterval = setInterval(() => {
    const s = Math.floor((Date.now() - state._genStartTime) / 1000);
    if (timerEl) timerEl.textContent = `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  }, 1000);

  state.generating=true; state.totalCost=0; refreshCost();
  const btnGen=document.getElementById('btn-gen');
  const btnDl=document.getElementById('btn-dl');
  const captCard=document.getElementById('caption-card');
  btnGen.disabled=true; btnGen.textContent='Gerando…';
  btnDl.classList.remove('show');
  if (captCard) captCard.style.display='none';

  document.getElementById('preview-empty').style.display='none';
  document.getElementById('preview-active').style.display='flex';

  let result;
  const aborted = () => state._abortController?.signal.aborted;

  if (state.contentType === 'stories_seq') {
    result = await generateStoriesSeq(marca, temaComTipo, fullModifier, apiKey);
    const successful = state.slides.some(s=>s?.b64);
    if (successful) { btnDl.classList.add('show'); toast(aborted()?'Geração interrompida.':'Stories gerados!', aborted()?'warn':'ok'); }

  } else if (state.contentType === 'carousel') {
    result = await generateCarousel(marca, temaComTipo, fullModifier, apiKey);
    const successful = state.slides.some(s=>s?.b64);
    if (successful && result && !aborted()) {
      setProgress('Gerando legenda…');
      try {
        state.caption=await generateCaption(marca, tema, result, apiKey, true);
        if (captCard && state.caption) {
          document.getElementById('caption-text').value=state.caption;
          captCard.style.display='block';
          renderCaptionPersonaTabs();
          const dlCap = document.getElementById('btn-dl-captions');
          if (dlCap && state.personas.length >= 2) dlCap.style.display = 'inline-flex';
        }
      } catch(err) { if (!aborted()) toast(`Legenda: ${err.message}`,'warn'); }
    }
    if (successful) { btnDl.classList.add('show'); toast(aborted()?'Geração interrompida.':'Carrossel gerado!', aborted()?'warn':'ok'); }

  } else {
    result = await generateCreative(marca, temaComTipo, fullModifier, apiKey);
    const successful = state.images.some(s=>s?.b64);
    if (successful && result && state.format!=='9:16' && !aborted()) {
      setProgress('Gerando legenda…');
      try {
        state.caption=await generateCaption(marca, tema, result, apiKey, false);
        if (captCard && state.caption) {
          document.getElementById('caption-text').value=state.caption;
          captCard.style.display='block';
          renderCaptionPersonaTabs();
          const dlCap = document.getElementById('btn-dl-captions');
          if (dlCap && state.personas.length >= 2) dlCap.style.display = 'inline-flex';
        }
      } catch(err) { if (!aborted()) toast(`Legenda: ${err.message}`,'warn'); }
    }
    if (successful) { btnDl.classList.add('show'); toast(aborted()?'Geração interrompida.':'Criativos gerados!', aborted()?'warn':'ok'); }
  }

  // Save generation to history
  if (!state.brandName) state.brandName = marca;
  const usesSlides = state.contentType === 'carousel' || state.contentType === 'stories_seq';
  const genSuccessful2 = usesSlides ? state.slides.some(s=>s?.b64) : state.images.some(s=>s?.b64);
  if (genSuccessful2 && marca) {
    const genId = uid();
    const items = usesSlides ? state.slides : state.images;
    const frameLabel = state.contentType === 'stories_seq' ? 'Frame' : state.contentType === 'carousel' ? 'Slide' : 'Variação';
    const validImages = items.filter(s=>s?.b64).map((img,i) => ({
      b64: img.b64, mime: img.mime,
      label: `${frameLabel} ${i+1}`,
    }));
    ImageDB.save({
      id: genId, brandSlug: slugify(marca), brandName: marca, date: Date.now(),
      type: state.contentType, theme: tema, format: state.format,
      slideCount: state.slideCount,
      personas: state.personas.map(p=>({name:p.name, ageRange:p.ageRange})),
      images: validImages, caption: state.caption,
    }).catch(()=>{});
    ClientDB.addHistory(marca, {
      id: genId, theme: tema, type: state.contentType, format: state.format,
      personaNames: state.personas.map(p=>p.name), imageCount: validImages.length,
    });
    showPersonaTarget();
  }

  // Clean up timer + abort
  clearInterval(state._timerInterval); state._timerInterval = null;
  state._abortController = null;
  if (stopBtn) stopBtn.style.display = 'none';
  const finalTime = timerEl?.textContent || '';
  if (timerEl && finalTime !== '0:00') {
    timerEl.style.display = 'inline';
  } else if (timerEl) {
    timerEl.style.display = 'none';
  }

  setProgress('', true);
  btnGen.textContent='Gerar'; btnGen.disabled=false; state.generating=false;
}

async function downloadAllCaptions() {
  if (state.contentType === 'stories_seq') { toast('Stories são auto-contidos — sem legenda.', 'warn'); return; }
  const apiKey = localStorage.getItem('adgen_key') || '';
  const marca  = document.getElementById('in-brand').value.trim();
  const tema   = state.ideaMode==='ideas' ? state.selectedIdea : document.getElementById('in-tema').value.trim();
  const isCarousel = state.contentType === 'carousel';
  const variations = isCarousel ? state._lastPrompts : state._lastVariations;
  if (!marca || !variations?.length) { toast('Nenhuma geração disponível.','warn'); return; }

  const btn = document.getElementById('btn-dl-captions');
  if (btn) { btn.disabled = true; btn.textContent = '…'; }

  const personas = state.personas.length ? state.personas : [null];
  const lines = [];
  lines.push(`LEGENDAS — ${marca} | ${tema}`);
  lines.push(`Gerado em: ${new Date().toLocaleString('pt-BR')}`);
  lines.push('');

  try {
    for (let i = 0; i < Math.min(personas.length, 3); i++) {
      const p = personas[i];
      const header = p ? `━━ Persona: ${p.name}${p.ageRange ? ` (${p.ageRange})` : ''} ━━` : '━━ Legenda Geral ━━';
      lines.push(header);
      try {
        const caption = await generateCaption(marca, tema, variations, apiKey, isCarousel, p ? [p] : undefined);
        lines.push(caption || '(sem legenda)');
      } catch(err) { lines.push(`(erro: ${err.message})`); }
      lines.push('');
    }
    const blob = new Blob([lines.join('\n')], { type:'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href:url, download:`legendas_${slugify(marca||'download')}.txt` }).click();
    URL.revokeObjectURL(url);
    toast('Legendas baixadas!', 'ok');
  } catch(err) { toast(`Erro: ${err.message}`, 'err'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = '↓ Todas'; } }
}

// ─── MODIFIER / API KEY UI ───────────────────────────────────────────────────

function syncModifier(brandName) {
  const mod=getModifier(brandName);
  const badge=document.getElementById('mod-badge');
  const detail=document.getElementById('mod-details');
  const ta=document.getElementById('mod-textarea');
  ta.value=mod;
  if (mod) { badge.textContent='Carregado'; badge.className='modifier-badge badge-ok'; detail.removeAttribute('open'); }
  else { badge.textContent='Não encontrado'; badge.className='modifier-badge badge-miss'; detail.setAttribute('open',''); }
}

function syncApiKey() {
  const key=localStorage.getItem('adgen_key')||'';
  const ok=key.length>10;
  const inp=document.getElementById('api-key-input'); if(inp) inp.value=key;
  const inpM=document.getElementById('api-key-input-mobile'); if(inpM) inpM.value=key;
  const dot=document.getElementById('api-key-dot'); if(dot) dot.classList.toggle('ok',ok);
  const dotM=document.getElementById('api-key-dot-mobile'); if(dotM) dotM.classList.toggle('ok',ok);
  const btn=document.getElementById('btn-gen'); if(btn) btn.disabled=!ok;
}

function syncOpenAIKey() {
  const key = localStorage.getItem('adgen_openai_key') || '';
  const ok  = key.length > 10;
  const inp = document.getElementById('openai-key-input'); if (inp) inp.value = key;
  const dot = document.getElementById('openai-key-dot');  if (dot) dot.classList.toggle('ok', ok);
}

// ─── TYPE UI UPDATE ──────────────────────────────────────────────────────────

function updateTypeUI() {
  const t = state.contentType;
  const isCarousel = t === 'carousel';
  const isCreative = t === 'creative';
  const isStoriesSeq = t === 'stories_seq';
  document.getElementById('opts-carousel').style.display = isCarousel ? 'block' : 'none';
  document.getElementById('opts-creative').style.display = isCreative ? 'block' : 'none';
  document.getElementById('opts-stories-seq').style.display = isStoriesSeq ? 'block' : 'none';

  // Keep all region inputs in sync
  const regionSources = ['in-region', 'in-region-creative', 'in-region-stories'];
  const activeRegionEl = document.getElementById(isCarousel ? 'in-region' : isStoriesSeq ? 'in-region-stories' : 'in-region-creative');
  const activeRegion = activeRegionEl?.value || '';
  if (activeRegion) {
    regionSources.forEach(id => { const el = document.getElementById(id); if (el) el.value = activeRegion; });
    state.region = activeRegion.trim() || 'Rondônia (RO), Brasil';
  }

  const temaLabel = document.getElementById('tema-label');
  if (temaLabel) temaLabel.textContent = isCarousel ? 'Tema do carrossel' : isStoriesSeq ? 'Tema da sequência' : 'Descrição do criativo';
  document.getElementById('in-tema').placeholder = isCarousel
    ? 'ex: 5 erros que atrasam a aprovação da sua obra'
    : isStoriesSeq
    ? 'ex: Como aprovamos um projeto residencial em tempo recorde'
    : 'ex: Anúncio para novos projetos residenciais em Ji-Paraná';
}

// ─── BRAND ANALYSIS UI ───────────────────────────────────────────────────────

function showBrandCard(info) {
  const card = document.getElementById('brand-card');
  document.getElementById('bc-name').textContent  = info.brandName || '—';
  document.getElementById('bc-niche').textContent = info.niche || '—';
  document.getElementById('bc-tone').textContent  = info.tone || '—';
  document.getElementById('bc-audience').textContent = info.audience || '—';
  const conf = info.confidence || 'medium';
  const confEl = document.getElementById('bc-confidence');
  confEl.textContent = conf==='high'?'Alta confiança':conf==='medium'?'Confiança média':'Inferido';
  confEl.className = `bc-badge ${conf==='high'?'badge-ok':conf==='medium'?'badge-warn':'badge-miss'}`;

  const services = info.exactServices || info.services || [];
  const servicesRow = document.getElementById('bc-services-row');
  const servicesWrap = document.getElementById('bc-services');
  if (services.length && servicesRow && servicesWrap) {
    servicesWrap.innerHTML = '';
    services.forEach(s => {
      const pill = document.createElement('span');
      pill.className = 'bc-service'; pill.textContent = s;
      servicesWrap.appendChild(pill);
    });
    servicesRow.style.display = 'flex';
  } else if (servicesRow) {
    servicesRow.style.display = 'none';
  }

  // Confidence improvement tips
  const tipsEl = document.getElementById('bc-tips');
  if (tipsEl) {
    const tips = CONFIDENCE_TIPS[conf] || [];
    if (tips.length) {
      tipsEl.innerHTML = `
        <details class="conf-tips-details">
          <summary class="conf-tips-summary">💡 Como melhorar para Alta confiança</summary>
          <ul class="conf-tips-list">
            ${tips.map(t => `<li>${t}</li>`).join('')}
          </ul>
        </details>`;
      tipsEl.style.display = 'block';
    } else {
      tipsEl.style.display = 'none';
    }
  }

  card.style.display='block';
}

// ─── THEME SYSTEM ────────────────────────────────────────────────────────────

function applyTheme(key) {
  const theme = THEMES[key] || THEMES.violeta;
  const root = document.documentElement;
  Object.entries(THEME_BASE).forEach(([k, v]) => root.style.setProperty(k, v));
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  state.currentTheme = key;
  localStorage.setItem('adgen_theme', key);
  document.querySelectorAll('.theme-swatch').forEach(s => s.classList.toggle('active', s.dataset.theme === key));
}

function initTheme() {
  const saved = localStorage.getItem('adgen_theme') || 'violeta';
  applyTheme(saved);
}

// ─── REGEN SINGLE ────────────────────────────────────────────────────────────

async function regenSlide(index) {
  const apiKey = localStorage.getItem('adgen_key') || '';
  const modifier = document.getElementById('mod-textarea').value.trim();
  if (!apiKey || !state._lastPrompts?.[index]) return;
  state.slides[index] = 'loading'; setSlideEl(index, 'loading');
  try {
    const fullPrompt = `${modifier}\n\n${state._lastPrompts[index].prompt}`;
    const raw = await generateImage(fullPrompt, apiKey, `Slide ${index+1}`);
    const normed = await normalizeToTarget(raw.b64, raw.mime, FORMAT_DIMS['4:5'].w, FORMAT_DIMS['4:5'].h);
    state.slides[index] = normed; setSlideEl(index, normed);
    toast(`Slide ${index+1} regerado!`, 'ok');
  } catch(err) {
    state.slides[index] = { error: err.message }; setSlideEl(index, { error: err.message });
    toast(`Slide ${index+1}: ${err.message}`, 'err');
  }
}

async function regenCreative(index) {
  const apiKey = localStorage.getItem('adgen_key') || '';
  const modifier = document.getElementById('mod-textarea').value.trim();
  if (!apiKey || !state._lastVariations?.[index]) return;
  const fmtInfo = FORMAT_DIMS[state.format];
  state.images[index] = 'loading'; setSlotEl(index, 'loading');
  try {
    const fullPrompt = `${modifier}\n\n${state._lastVariations[index].prompt}`;
    const raw = await generateImage(fullPrompt, apiKey, `Variação ${index+1}`);
    const normed = await normalizeToTarget(raw.b64, raw.mime, fmtInfo.w, fmtInfo.h);
    state.images[index] = normed; setSlotEl(index, normed);
    toast(`Variação ${index+1} regerada!`, 'ok');
  } catch(err) {
    state.images[index] = { error: err.message }; setSlotEl(index, { error: err.message });
    toast(`Variação ${index+1}: ${err.message}`, 'err');
  }
}

// ─── COST ESTIMATE ───────────────────────────────────────────────────────────

function updateCostEstimate() {
  const el = document.getElementById('cost-estimate');
  if (!el) return;
  const t = state.contentType;
  const nImages = t === 'carousel'
    ? (parseInt(document.getElementById('in-count')?.value, 10) || 7)
    : t === 'stories_seq'
    ? (parseInt(document.getElementById('in-stories-count')?.value, 10) || 5)
    : (parseInt(document.getElementById('in-qty')?.value, 10) || 2);
  const est = (nImages * COST_IMG_FIXED).toFixed(2);
  el.textContent = `~$${est} estimado`;
}

// ─── CAPTION PER PERSONA ─────────────────────────────────────────────────────

async function regenCaption(personaIdx) {
  if (state.contentType === 'stories_seq') { toast('Stories são auto-contidos — sem legenda.', 'warn'); return; }
  const apiKey = localStorage.getItem('adgen_key') || '';
  const marca = document.getElementById('in-brand').value.trim();
  if (!apiKey || !marca) return;
  const tema = state.ideaMode === 'ideas' ? state.selectedIdea : document.getElementById('in-tema').value.trim();
  const source = state.contentType === 'carousel' ? state._lastPrompts : state._lastVariations;
  if (!source?.length) { toast('Gere o conteúdo primeiro.', 'warn'); return; }

  const btn = document.getElementById('btn-regen-caption');
  if (btn) { btn.disabled = true; btn.textContent = 'Gerando…'; }

  // Filter personas for this specific caption
  const savedPersonas = state.personas;
  if (personaIdx !== undefined && state.personas[personaIdx]) {
    state.personas = [state.personas[personaIdx]];
  }
  try {
    const cap = await generateCaption(marca, tema, source, apiKey, state.contentType === 'carousel');
    state.caption = cap;
    const ta = document.getElementById('caption-text');
    if (ta) ta.value = cap;
    const card = document.getElementById('caption-card');
    if (card) card.style.display = 'block';
    toast('Legenda atualizada!', 'ok');
  } catch(err) {
    toast(`Legenda: ${err.message}`, 'err');
  } finally {
    state.personas = savedPersonas;
    if (btn) { btn.disabled = false; btn.textContent = '↺ Regenerar'; }
  }
}

// ─── HELPERS (UI) ────────────────────────────────────────────────────────────

function scrollToSection(id) {
  const profileSections = ['sec-marca', 'sec-personas'];
  if (profileSections.includes(id)) {
    if (state.currentView !== 'client-profile') showClientProfile();
  } else {
    if (state.currentView !== 'form') showForm(null, null);
  }
  setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior:'smooth', block:'start' }), 50);
}

function renderCaptionPersonaTabs() {
  const el = document.getElementById('caption-persona-tabs');
  if (!el || state.personas.length < 2) { if(el) el.innerHTML=''; return; }
  el.innerHTML = `<button class="caption-persona-tab active" data-idx="">Geral</button>`
    + state.personas.slice(0, 3).map((p, i) =>
        `<button class="caption-persona-tab" data-idx="${i}">${p.name||`Persona ${i+1}`}</button>`
      ).join('');
}

function showPersonaTarget() {
  const el = document.getElementById('persona-target-bar');
  if (!el) return;
  const active = state.priorityPersonaIds.length
    ? state.personas.filter(p => state.priorityPersonaIds.includes(p.id))
    : state.personas.slice(0, 3);
  if (!active.length) { el.style.display = 'none'; return; }
  const pills = active.map(p => `<span class="ptarget-pill">${p.name}</span>`).join('');
  el.innerHTML = `<span class="ptarget-label">Criado para</span>${pills}`;
  el.style.display = 'flex';
}

// ─── HISTORY MODAL ───────────────────────────────────────────────────────────

async function showHistory() {
  const modal = document.getElementById('history-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  const clientsEl = document.getElementById('hm-clients');
  const gensEl    = document.getElementById('hm-gens');
  const clients   = ClientDB.list();

  clientsEl.innerHTML = '';
  if (!clients.length) {
    clientsEl.innerHTML = '<p class="hm-empty-msg">Nenhum cliente salvo ainda</p>';
    gensEl.innerHTML    = '<p class="hm-empty-msg">Analise um @handle para começar</p>';
    return;
  }
  clients.forEach((client, i) => {
    const btn = document.createElement('button');
    btn.className = 'hm-client-btn' + (i===0?' active':'');
    btn.innerHTML = `<div class="hm-client-name">${esc(client.brandName)}</div><div class="hm-client-count">${client.history?.length||0} criações</div>`;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.hm-client-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      loadClientHistory(client);
    });
    clientsEl.appendChild(btn);
  });
  if (clients.length) loadClientHistory(clients[0]);
}

async function loadClientHistory(client) {
  const gensEl = document.getElementById('hm-gens');
  gensEl.innerHTML = '<div class="hm-loading"><div class="spinner"></div></div>';
  try {
    const generations = await ImageDB.list(client.slug);
    gensEl.innerHTML = '';
    if (!generations.length) {
      gensEl.innerHTML = '<p class="hm-empty-msg">Nenhuma criação registrada para este cliente</p>';
      return;
    }
    generations.forEach(gen => {
      const card = document.createElement('div');
      card.className = 'hm-gen-card';
      const date = new Date(gen.date).toLocaleDateString('pt-BR', {day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'});
      const personaNames = gen.personas?.map(p=>esc(p.name)).join(', ') || '';
      const typeLbl = gen.type==='carousel' ? 'Carrossel' : 'Criativo';
      const thumbs = (gen.images||[]).slice(0,4).map((img,i) =>
        `<img class="hm-thumb" src="data:${img.mime};base64,${img.b64}" alt="${img.label||`img ${i+1}`}" data-idx="${i}">`
      ).join('');
      card.innerHTML = `
        <div class="hm-gen-meta">
          <span class="hm-gen-badge">${typeLbl}</span>
          <span class="hm-gen-date">${date}</span>
          <button class="hm-gen-del" data-id="${gen.id}" title="Excluir esta criação">✕</button>
        </div>
        <div class="hm-gen-theme">${esc(gen.theme)}</div>
        ${personaNames ? `<div class="hm-gen-personas">Para: ${personaNames}</div>` : ''}
        <div class="hm-gen-thumbs">${thumbs}</div>
      `;
      card.querySelectorAll('.hm-thumb').forEach((thumb, idx) => {
        thumb.addEventListener('click', () => openLightbox(gen.images[idx].b64, gen.images[idx].mime, gen.images[idx].label||`Imagem ${idx+1}`));
      });
      card.querySelector('.hm-gen-del').addEventListener('click', async () => {
        await ImageDB.remove(gen.id);
        const clientData = ClientDB.load(client.brandName);
        if (clientData?.history) {
          clientData.history = clientData.history.filter(h => h.id !== gen.id);
          ClientDB.save(client.brandName, clientData);
        }
        card.remove();
        if (!gensEl.querySelector('.hm-gen-card')) gensEl.innerHTML = '<p class="hm-empty-msg">Nenhuma criação registrada</p>';
      });
      gensEl.appendChild(card);
    });
  } catch(err) {
    gensEl.innerHTML = `<p class="hm-empty-msg">Erro ao carregar: ${err.message}</p>`;
  }
}

function closeHistory() {
  const modal = document.getElementById('history-modal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
}

// ─── DASHBOARD / CLIENT VIEW / NAV ──────────────────────────────────────────

const SB_FMTS = [
  { id:'carousel',    label:'Carrossel',         wip:false, ctype:'carousel', fmt:null },
  { id:'post',        label:'Feed',              wip:false, ctype:'creative', fmt:'4:5' },
  { id:'story',       label:'Story Único',       wip:false, ctype:'creative', fmt:'9:16' },
  { id:'stories_seq', label:'Seq. de Stories',   wip:false, ctype:'stories_seq', fmt:'9:16' },
  { id:'reels',       label:'Vídeo / Reels',     wip:true },
  { id:'livre',       label:'Criação Livre',     wip:true },
  { id:'foto',        label:'Foto Profissional', wip:true },
];

function renderSidebarNav(view) {
  const nav = document.getElementById('sb-nav');
  if (!nav) return;

  if (view === 'client') { nav.innerHTML = ''; return; }

  const backSvg = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="flex-shrink:0;margin-right:2px"><path d="M8 2L4 6l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const histBtn = `<button class="sb-item" data-action="history"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="flex-shrink:0"><circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.3"/><path d="M7 4v3.5l2.5 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg> Histórico</button>`;

  if (view === 'briefing') {
    const brand = state.brandName || '';
    const s = _loadStrat();
    const done = s.confirmed?.[1];
    let html = `<button class="sb-item" data-action="edit-profile">${backSvg} Perfil</button><div class="sb-divider"></div>`;
    if (brand) html += `<div class="sb-group">${brand}</div>`;
    html += `<button class="sb-item" onclick="document.getElementById('strat-etapa-1')?.scrollIntoView({behavior:'smooth',block:'start'})"><span class="sb-num${done ? ' done' : ''}">${done ? '✓' : '1'}</span>Questionário${done ? ' <span style="color:var(--secondary);font-size:10px;margin-left:4px">✓</span>' : ''}</button>`;
    if (done) {
      html += `<div class="sb-divider"></div><button class="sb-item" onclick="showStrategyResultsView()" style="color:var(--secondary);font-weight:600">📊 Ver Estratégia →</button>`;
    }
    nav.innerHTML = html;
    return;
  }

  if (view === 'strategy') {
    const brand = state.brandName || '';
    const s = _loadStrat();
    const resSections = [
      { n:2, title:'Identidade da Marca' },
      { n:3, title:'Análise de Mercado' },
      { n:4, title:'Público & Conversão' },
      { n:5, title:'Estratégia de Conteúdo' },
      { n:6, title:'Plano 30 Dias' },
      { n:7, title:'Plano de Longo Prazo' },
    ];
    let html = `<button class="sb-item" onclick="showBriefingView()">${backSvg} Briefing</button><div class="sb-divider"></div>`;
    if (brand) html += `<div class="sb-group">${brand}</div>`;
    html += `<div class="sb-group" style="margin-top:8px">Seções</div>`;
    resSections.forEach(({ n, title }) => {
      const done = !!s.content?.[n];
      html += `<button class="sb-item" onclick="document.getElementById('res-sec-${n}')?.scrollIntoView({behavior:'smooth',block:'start'})"><span class="sb-num${done ? ' done' : ''}">${n - 1}</span>${title}${done ? ' <span style="color:var(--secondary);font-size:10px;margin-left:4px">✓</span>' : ''}</button>`;
    });
    nav.innerHTML = html;
    return;
  }

  if (view === 'client-profile') {
    const brand = state.brandName || '';
    const strat = _loadStrat();
    const briefDone = !!strat.confirmed?.[1];
    const hasStrat  = RES_SECTIONS.some(sec => strat.content?.[sec.n]);
    let html = `<button class="sb-item" data-action="change-client">${backSvg} Clientes</button><div class="sb-divider"></div>`;
    if (brand) html += `<div class="sb-group">${brand}</div>`;
    html += `<button class="sb-item" data-section="sec-marca"><span class="sb-num">1</span>Marca</button>`;
    html += `<button class="sb-item" data-section="sec-personas"><span class="sb-num">2</span>Público-Alvo</button>`;
    if (brand) {
      html += `<div class="sb-divider"></div><div class="sb-group">Estratégia</div>`;
      html += `<button class="sb-item" onclick="saveClientProfile(showBriefingView)"><span class="sb-num${briefDone ? ' done' : ''}">${briefDone ? '✓' : '→'}</span>Briefing</button>`;
      if (briefDone || hasStrat) html += `<button class="sb-item" onclick="showStrategyResultsView()"><span class="sb-num${hasStrat ? ' done' : ''}">${hasStrat ? '✓' : '→'}</span>Estratégia</button>`;
    }
    nav.innerHTML = html;
    setupSectionObserver(['sec-marca', 'sec-personas']);
    return;
  }

  if (view === 'dashboard') {
    const brand = state.brandName || localStorage.getItem('adgen_last_brand') || '';
    let html = '';
    if (brand) {
      const strat = _loadStrat();
      const briefDone = !!strat.confirmed?.[1];
      const hasStrat  = RES_SECTIONS.some(sec => strat.content?.[sec.n]);
      html += `<div class="sb-group">Cliente</div><div class="sb-client-item"><span class="sb-client-name">${brand}</span><button class="sb-client-change" data-action="change-client">Trocar</button></div>`;
      html += `<button class="sb-item" data-action="edit-profile">✎ Editar perfil</button>`;
      html += `<div class="sb-divider"></div><div class="sb-group">Estratégia</div>`;
      html += `<button class="sb-item" onclick="showBriefingView()"><span class="sb-num${briefDone ? ' done' : ''}">${briefDone ? '✓' : '1'}</span>Briefing${briefDone ? '' : ' <span style="color:var(--secondary);font-size:10px;margin-left:4px">→</span>'}</button>`;
      html += `<button class="sb-item" onclick="showStrategyResultsView()" ${!briefDone ? 'style="opacity:.4;pointer-events:none"' : ''}><span class="sb-num${hasStrat ? ' done' : ''}">${hasStrat ? '✓' : '2'}</span>Estratégia${!briefDone ? '' : hasStrat ? '' : ' <span style="color:var(--secondary);font-size:10px;margin-left:4px">→</span>'}</button>`;
      html += `<div class="sb-divider"></div>`;
    }
    html += `<div class="sb-group">Criar Post</div>`;
    SB_FMTS.forEach(f => {
      if (f.wip) {
        html += `<div class="sb-item-wip">${f.label}<span class="badge-wip">dev</span></div>`;
      } else {
        html += `<button class="sb-item" data-fmt-ctype="${f.ctype}" data-fmt-fmt="${f.fmt||''}">${f.label}</button>`;
      }
    });
    html += `<div class="sb-divider"></div><div class="sb-group">Ferramentas</div>${histBtn}`;
    nav.innerHTML = html;
    return;
  }

  if (view === 'form') {
    const brand = state.brandName || '';
    const tipoHidden = !!state._formatPreselected;
    const steps = [
      ...(!tipoHidden ? [{ section:'sec-tipo',    num:'1', label:'Tipo' }] : []),
      { section:'sec-tema',    num: tipoHidden ? '1' : '2', label:'Tema' },
      { section:'sec-imagem',  num: tipoHidden ? '2' : '3', label:'Imagem' },
    ];
    let html = '';
    if (brand) {
      html += `<div class="sb-group">Cliente</div><div class="sb-client-item"><span class="sb-client-name">${brand}</span><button class="sb-client-change" data-action="change-client">Trocar</button></div>`;
      html += `<button class="sb-item" data-action="edit-profile">✎ Editar perfil</button>`;
      html += `<div class="sb-divider"></div>`;
    }
    html += `<div class="sb-group">Criar Post</div>`;
    SB_FMTS.forEach(f => {
      const isActive = !f.wip && f.ctype === state.contentType && (
        state.contentType === 'stories_seq' ||
        f.fmt === state.format ||
        (!f.fmt && state.contentType === 'carousel'));
      if (f.wip) {
        html += `<div class="sb-item-wip">${f.label}<span class="badge-wip">dev</span></div>`;
      } else {
        html += `<button class="sb-item${isActive ? ' sb-active' : ''}" data-fmt-ctype="${f.ctype}" data-fmt-fmt="${f.fmt||''}">${f.label}</button>`;
      }
    });
    html += `<div class="sb-divider"></div>`;
    const fmtLabel = state._currentFormatLabel || 'Etapas';
    html += `<div class="sb-group">${fmtLabel}</div>`;
    steps.forEach(s => {
      html += `<button class="sb-item" data-section="${s.section}"><span class="sb-num">${s.num}</span>${s.label}</button>`;
    });
    html += `<div class="sb-divider"></div><div class="sb-group">Ferramentas</div>${histBtn}`;
    nav.innerHTML = html;
    const obsSections = tipoHidden
      ? ['sec-tema', 'sec-imagem']
      : ['sec-tipo', 'sec-tema', 'sec-imagem'];
    setupSectionObserver(obsSections);
  }
}

function setupSectionObserver(sections) {
  if (window._stepObs) window._stepObs.disconnect();
  if (!('IntersectionObserver' in window)) return;
  window._stepObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      document.querySelectorAll('#sb-nav [data-section]').forEach(b => b.classList.remove('sb-active'));
      const active = document.querySelector(`#sb-nav [data-section="${e.target.id}"]`);
      if (active) active.classList.add('sb-active');
    });
  }, { threshold: 0.3 });
  sections.forEach(id => {
    const el = document.getElementById(id); if (el) window._stepObs.observe(el);
  });
}

const _ALL_VIEWS = ['client-view','client-profile-view','dashboard-view','form-view','briefing-view','strategy-view'];
function _showView(activeId) {
  _ALL_VIEWS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = id === activeId ? 'block' : 'none';
  });
}

function showClientView() {
  _showView('client-view');
  state.currentView = 'client';
  renderSidebarNav('client');
  renderRecentClients();
}

function showClientProfile() {
  _showView('client-profile-view');
  state.currentView = 'client-profile';
  renderSidebarNav('client-profile');
  const nameEl = document.getElementById('cp-topbar-name');
  if (nameEl) nameEl.textContent = state.brandName || 'Novo Cliente';
  const brandInput = document.getElementById('in-brand');
  if (brandInput && state.brandName) brandInput.value = state.brandName;
  const hasClient = !!ClientDB.load(state.brandName);
  const delBtn = document.getElementById('cp-delete-btn');
  if (delBtn) delBtn.style.display = hasClient ? 'inline-flex' : 'none';
  const expBtn = document.getElementById('btn-export-dna');
  if (expBtn) expBtn.style.display = hasClient ? 'inline-flex' : 'none';
  renderCpStepper();
  renderCpNextCard();
  const spEl = document.getElementById('in-style-pref');
  if (spEl) spEl.value = state.stylePref || '';
  renderPersonas();
  renderPersonaFocus();
  syncModifier(state.brandName || '');
  setTimeout(() => document.getElementById('sec-marca')?.scrollIntoView({ behavior:'smooth', block:'start' }), 50);
}

function renderCpStepper() {
  const strat    = _loadStrat();
  const briefDone = !!strat.confirmed?.[1];
  const hasStrat  = RES_SECTIONS.some(sec => strat.content?.[sec.n]);
  const hasBrand  = !!state.brandName;
  const s2 = document.getElementById('cps-2'), n2 = document.getElementById('cps-n2');
  const s3 = document.getElementById('cps-3'), n3 = document.getElementById('cps-n3');
  if (!s2) return;
  if (briefDone) {
    s2.className = 'flow-step fs-done'; s2.onclick = showBriefingView; n2.textContent = '✓';
  } else if (hasBrand) {
    s2.className = 'flow-step fs-next'; s2.onclick = () => saveClientProfile(showBriefingView); n2.textContent = '2';
  } else {
    s2.className = 'flow-step'; s2.onclick = null; n2.textContent = '2';
  }
  if (hasStrat) {
    s3.className = 'flow-step fs-done'; s3.onclick = showStrategyResultsView; n3.textContent = '✓';
  } else if (briefDone) {
    s3.className = 'flow-step fs-next'; s3.onclick = showStrategyResultsView; n3.textContent = '3';
  } else {
    s3.className = 'flow-step'; s3.onclick = null; n3.textContent = '3';
  }
}

function renderCpNextCard() {
  const el = document.getElementById('cp-next-card');
  if (!el) return;
  if (!state.brandName) { el.innerHTML = ''; return; }
  const strat    = _loadStrat();
  const briefDone = !!strat.confirmed?.[1];
  const hasStrat  = RES_SECTIONS.some(sec => strat.content?.[sec.n]);
  if (hasStrat) {
    el.innerHTML = `<div class="nsc nsc-strat"><span class="nsc-icon">📊</span><div class="nsc-info"><div class="nsc-title">Estratégia gerada</div><div class="nsc-desc">Acesse análise de mercado, plano de conteúdo e plano de ação.</div></div><button class="nsc-btn nsc-btn-accent" onclick="showStrategyResultsView()">Ver Estratégia →</button></div>`;
  } else if (briefDone) {
    el.innerHTML = `<div class="nsc nsc-strat"><span class="nsc-icon">📊</span><div class="nsc-info"><div class="nsc-title">Briefing completo — gere sua estratégia</div><div class="nsc-desc">Clique para gerar análise de mercado, plano de conteúdo e plano de ação personalizados.</div></div><button class="nsc-btn nsc-btn-accent" onclick="showStrategyResultsView()">Gerar Estratégia →</button></div>`;
  } else {
    el.innerHTML = `<div class="nsc"><span class="nsc-icon">📋</span><div class="nsc-info"><div class="nsc-title">Próximo passo: Briefing Estratégico</div><div class="nsc-desc">Responda o questionário para gerar uma estratégia de conteúdo e plano de ação personalizados para ${_se(state.brandName)}.</div></div><button class="nsc-btn" onclick="saveClientProfile(showBriefingView)">Salvar e ir ao Briefing →</button></div>`;
  }
}

function saveClientProfile(dest) {
  const brand = document.getElementById('in-brand').value.trim();
  if (!brand) { toast('Preencha o nome da marca.', 'warn'); return; }
  const modifier = document.getElementById('mod-textarea').value.trim();
  const stylePref = document.getElementById('in-style-pref')?.value.trim() || '';
  state.brandName = brand;
  state.stylePref = stylePref;
  localStorage.setItem('adgen_last_brand', brand);
  if (modifier) saveModifier(brand, modifier);
  ClientDB.save(brand, {
    personas: state.personas,
    region: state.region,
    modifier,
    stylePref,
  });
  toast(`Perfil de "${brand}" salvo!`, 'ok');
  (dest || showDashboard)();
}

async function deleteClient() {
  const brand = state.brandName;
  if (!brand) return;
  if (!confirm(`Excluir permanentemente o perfil de "${brand}"?\n\nTodas as imagens geradas para este cliente também serão apagadas.`)) return;
  try {
    const gens = await ImageDB.list(slugify(brand));
    for (const gen of gens) await ImageDB.remove(gen.id);
  } catch(_) {}
  ClientDB.remove(brand);
  localStorage.removeItem('adgen_last_brand');
  localStorage.removeItem(`adgen_refstyle_${slugify(brand)}`);
  state.brandName = '';
  state.personas = [];
  state.stylePref = '';
  state.refImages = [];
  state.refStyle = [];
  renderPersonas();
  toast(`"${brand}" excluído.`, 'ok');
  showClientView();
}

function renderRecentClients() {
  const wrap = document.getElementById('cv-recents');
  const grid = document.getElementById('cv-recents-grid');
  if (!wrap || !grid) return;
  const clients = ClientDB.list();
  if (!clients.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  grid.innerHTML = clients.slice(0, 6).map(c =>
    `<button class="cv-recent-btn" data-client="${encodeURIComponent(c.brandName)}">${c.brandName}</button>`
  ).join('');
}

function selectClient(name) {
  if (!name?.trim()) return;
  state.brandName = name.trim();
  state._perFormat = {};
  state.priorityPersonaIds = [];
  state._usedIdeas = [];
  state.selectedIdea = '';
  const chipsEl = document.getElementById('ideas-chips');
  if (chipsEl) chipsEl.innerHTML = '';
  const btnIdeas = document.getElementById('btn-ideas');
  if (btnIdeas) { btnIdeas.textContent = '↺ Gerar mais ideias'; btnIdeas.className = 'btn-ideas btn-ideas--more'; }
  const complementWrap = document.getElementById('idea-complement');
  if (complementWrap) complementWrap.style.display = 'none';
  localStorage.setItem('adgen_last_brand', state.brandName);
  const brandInput = document.getElementById('in-brand');
  if (brandInput) brandInput.value = state.brandName;
  state.logos = loadClientLogos(state.brandName);
  state.refImages = [];
  state.refStyle = loadClientRefStyle(state.brandName);
  renderRefPreviews();
  syncRefStyleUI();
  const clientData = ClientDB.load(state.brandName);
  if (clientData) {
    if (clientData.personas?.length) { state.personas = clientData.personas; }
    if (clientData.region) {
      state.region = clientData.region;
      ['in-region','in-region-creative','in-region-stories'].forEach(id => { const el = document.getElementById(id); if (el) el.value = clientData.region; });
    }
    if (clientData.stylePref) {
      state.stylePref = clientData.stylePref;
      const spEl = document.getElementById('in-style-pref'); if (spEl) spEl.value = clientData.stylePref;
    }
    syncModifier(state.brandName);
    renderPersonas(); renderPersonaFocus();
    showDashboard();
  } else {
    syncModifier(state.brandName);
    showClientProfile();
  }
}

// ─── DASHBOARD CALENDAR ──────────────────────────────────────────────────────

function _parseStratSection(content, keyword) {
  if (!content) return '';
  const esc = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = content.match(new RegExp(`##\\s*${esc}[\\s\\S]*?(?=\\n##\\s|$)`, 'i'));
  return m ? m[0] : '';
}

function _parseMdTableRows(text) {
  return text.split('\n')
    .filter(l => /^\s*\|/.test(l) && !/^\s*\|[\s:\-|]+$/.test(l))
    .map(l => l.trim().split('|').map(c => c.replace(/\*\*?([^*]*)\*\*?/g,'$1').trim()).filter(Boolean));
}

function _calIcon(text) {
  const t = (text || '').toLowerCase();
  if (t.includes('reels') || t.includes('vídeo') || t.includes('video')) return '🎬';
  if (t.includes('carrossel') || t.includes('carousel')) return '🃏';
  if (t.includes('stories') || t.includes('story')) return '📱';
  if (t.includes('live')) return '🔴';
  return '📸';
}

function _calType(text) {
  const t = (text || '').toLowerCase();
  if (t.includes('reels') || t.includes('reel')) return 'REELS';
  if (t.includes('carrossel') || t.includes('carousel')) return 'CARROSSEL';
  if (t.includes('stories') || t.includes('story')) return 'STORIES';
  if (t.includes('live')) return 'LIVE';
  if (t.includes('foto')) return 'FOTO';
  return 'POST';
}

function _nextWeekday(targetDay) {
  const today = new Date();
  const diff = (targetDay - today.getDay() + 7) % 7;
  const d = new Date(today);
  d.setDate(today.getDate() + diff);
  return d;
}

function _calGetMoves(slug) {
  try { return JSON.parse(localStorage.getItem(`adgen_cal_moves_${slug}`)) || {}; } catch { return {}; }
}
function _calGetStatuses(slug) {
  try { return JSON.parse(localStorage.getItem(`adgen_cal_status_${slug}`)) || {}; } catch { return {}; }
}
function _calSetMoves(slug, obj) { localStorage.setItem(`adgen_cal_moves_${slug}`, JSON.stringify(obj)); }
function _calSetStatuses(slug, obj) { localStorage.setItem(`adgen_cal_status_${slug}`, JSON.stringify(obj)); }

let _calViewYear = null, _calViewMonth = null;

function _dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function _calPrevMonth() {
  if (_calViewMonth === 0) { _calViewMonth = 11; _calViewYear--; }
  else _calViewMonth--;
  renderDashboardCalendar();
}

function _calNextMonth() {
  if (_calViewMonth === 11) { _calViewMonth = 0; _calViewYear++; }
  else _calViewMonth++;
  renderDashboardCalendar();
}

function _getTodayCalEvent() {
  const s = _loadStrat();
  const c6 = s.content?.[6] || '';
  if (!c6) return null;
  const DAY_MAP = { 'domingo':0,'segunda':1,'terça':2,'quarta':3,'quinta':4,'sexta':5,'sábado':6 };
  const weekRows = _parseMdTableRows(_parseStratSection(c6, 'Plano de Execução Simples')).slice(1);
  if (!weekRows.length) return null;
  const today = new Date();
  const todayDs = _dateStr(today);
  const todayDow = today.getDay();
  const slug = slugify(state.brandName || 'default');
  const moves = _calGetMoves(slug);
  const statuses = _calGetStatuses(slug);
  const baseEvents = weekRows.map((row, i) => {
    const [diaRaw, oque] = row;
    const key = Object.keys(DAY_MAP).find(k => (diaRaw || '').toLowerCase().includes(k));
    const origDay = key !== undefined ? DAY_MAP[key] : null;
    if (origDay === null || !oque) return null;
    const id = `ev_${i}`;
    return { id, rowIndex: i, origDay, text: oque, icon: _calIcon(oque), type: _calType(oque) };
  }).filter(Boolean);
  const todayEvs = [];
  for (const ev of baseEvents) {
    const instanceId = `${ev.id}_${todayDs}`;
    if (moves[instanceId] && moves[instanceId] !== todayDs) continue;
    if (ev.origDay === todayDow) todayEvs.push({ ...ev, instanceId });
  }
  for (const [instanceId, newDs] of Object.entries(moves)) {
    if (newDs !== todayDs) continue;
    const baseId = instanceId.slice(0, -11);
    const ev = baseEvents.find(e => e.id === baseId);
    if (ev && !todayEvs.find(e => e.instanceId === instanceId)) todayEvs.push({ ...ev, instanceId });
  }
  return todayEvs.find(e => (statuses[e.instanceId] || 'pending') !== 'skipped') || null;
}

function renderDashboardCalendar() {
  const container = document.getElementById('dash-calendar');
  if (!container) return;

  const now = new Date();
  if (_calViewYear === null) { _calViewYear = now.getFullYear(); _calViewMonth = now.getMonth(); }

  const s = _loadStrat();
  const c6 = s.content?.[6] || '';
  const c7 = s.content?.[7] || '';

  if (!c6) {
    container.innerHTML = `<div class="dash-calendar-empty">
      <span>📅</span>
      <p>Gere a <strong>Estratégia</strong> para ver sugestões de agenda</p>
    </div>`;
    return;
  }

  const DAY_MAP = { 'domingo':0,'segunda':1,'terça':2,'quarta':3,'quinta':4,'sexta':5,'sábado':6 };
  const weekRows = _parseMdTableRows(_parseStratSection(c6, 'Plano de Execução Simples')).slice(1);

  const slug = slugify(state.brandName || 'default');
  const moves = _calGetMoves(slug);
  const statuses = _calGetStatuses(slug);

  const baseEvents = weekRows.map((row, i) => {
    const [diaRaw, oque, , horario] = row;
    const key = Object.keys(DAY_MAP).find(k => (diaRaw || '').toLowerCase().includes(k));
    const origDay = key !== undefined ? DAY_MAP[key] : null;
    if (origDay === null || !oque) return null;
    const id = `ev_${i}`;
    return { id, rowIndex: i, origDay, text: oque, icon: _calIcon(oque), type: _calType(oque), time: horario || '' };
  }).filter(Boolean);

  const year = _calViewYear, month = _calViewMonth;
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const firstDow = firstDay.getDay();
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - (firstDow === 0 ? 6 : firstDow - 1));
  const lastDow = lastDay.getDay();
  const gridEnd = new Date(lastDay);
  gridEnd.setDate(lastDay.getDate() + (lastDow === 0 ? 0 : 7 - lastDow));

  // Build instanceMap: dateStr → [eventInstances]
  const instanceMap = {};
  const cur = new Date(gridStart);
  while (cur <= gridEnd) { instanceMap[_dateStr(cur)] = []; cur.setDate(cur.getDate() + 1); }

  for (const ev of baseEvents) {
    const c = new Date(gridStart);
    while (c <= gridEnd) {
      if (c.getDay() === ev.origDay) {
        const ds = _dateStr(c);
        instanceMap[ds].push({ ...ev, instanceId: `${ev.id}_${ds}` });
      }
      c.setDate(c.getDate() + 1);
    }
  }

  // Apply drag moves
  for (const [instanceId, newDs] of Object.entries(moves)) {
    const origDs = instanceId.slice(-10);
    if (instanceMap[origDs]) instanceMap[origDs] = instanceMap[origDs].filter(e => e.instanceId !== instanceId);
    if (instanceMap[newDs]) {
      const baseId = instanceId.slice(0, -11);
      const ev = baseEvents.find(e => e.id === baseId);
      if (ev && !instanceMap[newDs].find(e => e.instanceId === instanceId))
        instanceMap[newDs].push({ ...ev, instanceId });
    }
  }

  // Progress count (current month only)
  let totalMonth = 0, doneMonth = 0;
  for (let d = 1; d <= lastDay.getDate(); d++) {
    for (const ev of (instanceMap[_dateStr(new Date(year, month, d))] || [])) {
      totalMonth++;
      if (statuses[ev.instanceId] === 'done') doneMonth++;
    }
  }

  const today = new Date(); today.setHours(0,0,0,0);
  const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const pct = totalMonth > 0 ? Math.round(doneMonth / totalMonth * 100) : 0;

  let html = '';

  if (c7) {
    const roadmapRows = _parseMdTableRows(_parseStratSection(c7, 'Roadmap de 6 Meses')).slice(1);
    if (roadmapRows.length) {
      const [mes, fase, foco, meta] = roadmapRows[0];
      html += `<div class="cal-milestone">
        <span class="cal-milestone-label">${mes || 'Mês 1'} · ${fase || ''}</span>
        <span class="cal-milestone-focus">${foco || ''}${meta ? ' — ' + meta : ''}</span>
      </div>`;
    }
  }

  const planRows = _parseMdTableRows(_parseStratSection(c6, 'Plano de 30 Dias')).slice(1);
  if (planRows.length) {
    const [semana, foco, meta] = planRows[0];
    html += `<div class="cal-week-focus">
      <span class="cal-week-label">${semana || 'Semana 1'}</span>
      <span class="cal-week-text">${foco || ''}</span>
      ${meta ? `<span class="cal-week-meta">${meta}</span>` : ''}
    </div>`;
  }

  html += `<div class="cal-nav">
    <button class="cal-nav-btn" data-cal-nav="prev">&#8249;</button>
    <span class="cal-nav-title">${MONTHS_PT[month]} ${year}</span>
    <button class="cal-nav-btn" data-cal-nav="next">&#8250;</button>
  </div>
  <div class="cal-progress">
    <div class="cal-progress-bar"><div class="cal-progress-fill" style="width:${pct}%"></div></div>
    <span class="cal-progress-label">${doneMonth}/${totalMonth} realizados</span>
  </div>`;

  const DAY_LABELS = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
  html += '<div class="cal-month-hd">';
  for (const d of DAY_LABELS) html += `<div class="cal-month-hd-cell">${d}</div>`;
  html += '</div><div class="cal-month-grid">';

  const cell = new Date(gridStart);
  while (cell <= gridEnd) {
    const ds = _dateStr(cell);
    const inMonth = cell.getMonth() === month;
    const isToday = cell.toDateString() === today.toDateString();
    const isWeekend = cell.getDay() === 0 || cell.getDay() === 6;
    const classes = ['cal-day', !inMonth && 'cal-day--other', isToday && 'cal-day--today', isWeekend && 'cal-day--weekend'].filter(Boolean).join(' ');
    const dayEvs = instanceMap[ds] || [];

    html += `<div class="${classes}" data-date="${ds}"><div class="cal-day-num">${cell.getDate()}</div><div class="cal-day-events">`;

    for (const ev of dayEvs) {
      const st = statuses[ev.instanceId] || 'pending';
      const cc = ['cal-chip', st === 'done' && 'cal-chip--done', st === 'skipped' && 'cal-chip--skipped'].filter(Boolean).join(' ');
      const safeText = ev.text.replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      html += `<div class="${cc}" draggable="true" data-instance-id="${ev.instanceId}" data-date="${ds}" data-full-text="${safeText}" data-time="${ev.time}" data-icon="${ev.icon}" data-type="${ev.type}" data-row-index="${ev.rowIndex}" data-orig-day="${ev.origDay}" data-status="${st}"><span class="cal-chip-icon">${ev.icon}</span><span class="cal-chip-type">${ev.type}</span><button class="cal-chip-edit" title="Editar">✎</button><span class="cal-chip-check" data-check="${ev.instanceId}">${st === 'done' ? '✓' : ''}</span></div>`;
    }

    html += `</div></div>`;
    cell.setDate(cell.getDate() + 1);
  }
  html += '</div>';

  container.innerHTML = html;
  _initCalInteractions(container, slug);
}

function _initCalInteractions(container, slug) {
  let draggedEl = null;

  container.addEventListener('dragstart', e => {
    const chip = e.target.closest('.cal-chip');
    if (!chip) return;
    draggedEl = chip;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', chip.dataset.instanceId);
    setTimeout(() => chip.classList.add('cal-chip--dragging'), 0);
  });

  container.addEventListener('dragend', () => {
    if (draggedEl) draggedEl.classList.remove('cal-chip--dragging');
    container.querySelectorAll('.cal-day--drop-over').forEach(c => c.classList.remove('cal-day--drop-over'));
    draggedEl = null;
  });

  container.addEventListener('dragover', e => {
    const day = e.target.closest('.cal-day');
    if (!day || !draggedEl) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    container.querySelectorAll('.cal-day--drop-over').forEach(c => c.classList.remove('cal-day--drop-over'));
    day.classList.add('cal-day--drop-over');
  });

  container.addEventListener('dragleave', e => {
    if (!container.contains(e.relatedTarget))
      container.querySelectorAll('.cal-day--drop-over').forEach(c => c.classList.remove('cal-day--drop-over'));
  });

  container.addEventListener('drop', e => {
    const day = e.target.closest('.cal-day');
    if (!day || !draggedEl) return;
    e.preventDefault();
    day.classList.remove('cal-day--drop-over');
    const newDs = day.dataset.date;
    const instanceId = draggedEl.dataset.instanceId;
    const moves = _calGetMoves(slug);
    moves[instanceId] = newDs;
    _calSetMoves(slug, moves);
    const evDiv = day.querySelector('.cal-day-events');
    if (evDiv) { draggedEl.classList.remove('cal-chip--dragging'); draggedEl.dataset.date = newDs; evDiv.appendChild(draggedEl); }
    draggedEl = null;
  });

  container.addEventListener('click', e => {
    const navBtn = e.target.closest('[data-cal-nav]');
    if (navBtn) { navBtn.dataset.calNav === 'prev' ? _calPrevMonth() : _calNextMonth(); return; }
    const checkBtn = e.target.closest('.cal-chip-check');
    if (checkBtn) { e.stopPropagation(); _calToggleDone(checkBtn.dataset.check, slug, container); return; }
    const editBtn = e.target.closest('.cal-chip-edit');
    if (editBtn) { e.stopPropagation(); const chip = editBtn.closest('.cal-chip'); if (chip) _calShowEdit(chip, slug, container); return; }
    const chip = e.target.closest('.cal-chip');
    if (chip) { _calShowDetail(chip, slug, container); return; }
    if (!e.target.closest('#cal-detail-panel')) document.getElementById('cal-detail-panel')?.remove();
    if (!e.target.closest('#cal-edit-panel')) document.getElementById('cal-edit-panel')?.remove();
  });
}

function _calToggleDone(instanceId, slug, container) {
  const statuses = _calGetStatuses(slug);
  const prev = statuses[instanceId] || 'pending';
  statuses[instanceId] = prev === 'done' ? 'pending' : 'done';
  _calSetStatuses(slug, statuses);
  const chip = container.querySelector(`[data-instance-id="${instanceId}"]`);
  if (chip) {
    const isDone = statuses[instanceId] === 'done';
    chip.classList.toggle('cal-chip--done', isDone);
    chip.classList.remove('cal-chip--skipped');
    chip.dataset.status = statuses[instanceId];
    const chk = chip.querySelector('.cal-chip-check');
    if (chk) chk.textContent = isDone ? '✓' : '';
  }
  _calUpdateProgress(container, slug);
}

function _calUpdateProgress(container, slug) {
  const statuses = _calGetStatuses(slug);
  const chips = container.querySelectorAll('.cal-day:not(.cal-day--other) .cal-chip');
  let total = chips.length, done = 0;
  chips.forEach(c => { if (statuses[c.dataset.instanceId] === 'done') done++; });
  const pct = total > 0 ? Math.round(done / total * 100) : 0;
  const fill = container.querySelector('.cal-progress-fill');
  const label = container.querySelector('.cal-progress-label');
  if (fill) fill.style.width = `${pct}%`;
  if (label) label.textContent = `${done}/${total} realizados`;
}

function _calShowDetail(chip, slug, container) {
  document.getElementById('cal-detail-panel')?.remove();
  const instanceId = chip.dataset.instanceId;
  const statuses = _calGetStatuses(slug);
  const status = statuses[instanceId] || 'pending';
  const [y, m, d] = chip.dataset.date.split('-').map(Number);
  const dateLabel = new Date(y, m-1, d).toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long' });
  const panel = document.createElement('div');
  panel.id = 'cal-detail-panel';
  panel.className = 'cal-detail';
  panel.innerHTML = `<button class="cal-detail-close" id="cal-dtl-close">&#10005;</button>
    <div class="cal-detail-type">${chip.dataset.icon} ${chip.dataset.type || ''} &middot; ${dateLabel}</div>
    <div class="cal-detail-text">${chip.dataset.fullText}</div>
    ${chip.dataset.time ? `<div class="cal-detail-time">&#128336; ${chip.dataset.time}</div>` : ''}
    <div class="cal-detail-actions">
      <button class="cal-detail-btn cal-detail-btn--done${status==='done'?' cal-detail-btn--active':''}" data-action="done" data-instance="${instanceId}">${status==='done'?'&#10003; Realizado':'&#10003; Marcar Feito'}</button>
      <button class="cal-detail-btn cal-detail-btn--skip${status==='skipped'?' cal-detail-btn--active':''}" data-action="skip" data-instance="${instanceId}">${status==='skipped'?'&#8629; Pulado':'&#8629; Pular'}</button>
    </div>`;
  document.body.appendChild(panel);
  const rect = chip.getBoundingClientRect();
  const pw = 268, ph = panel.offsetHeight || 160;
  let left = Math.min(rect.left, window.innerWidth - pw - 8);
  let top = rect.bottom + 6;
  if (top + ph > window.innerHeight - 8) top = rect.top - ph - 6;
  panel.style.left = `${Math.max(8, left)}px`;
  panel.style.top = `${Math.max(8, top)}px`;
  panel.querySelector('#cal-dtl-close').addEventListener('click', () => panel.remove());
  panel.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action, id = btn.dataset.instance;
    const st = _calGetStatuses(slug);
    const prev = st[id] || 'pending';
    if (action === 'done') st[id] = prev === 'done' ? 'pending' : 'done';
    if (action === 'skip') st[id] = prev === 'skipped' ? 'pending' : 'skipped';
    _calSetStatuses(slug, st);
    const c = container.querySelector(`[data-instance-id="${id}"]`);
    if (c) {
      c.classList.toggle('cal-chip--done', st[id] === 'done');
      c.classList.toggle('cal-chip--skipped', st[id] === 'skipped');
      c.dataset.status = st[id];
      const chk = c.querySelector('.cal-chip-check');
      if (chk) chk.textContent = st[id] === 'done' ? '✓' : '';
    }
    _calUpdateProgress(container, slug);
    panel.remove();
  });
}

function _calShowEdit(chip, slug, container) {
  document.getElementById('cal-edit-panel')?.remove();
  document.getElementById('cal-detail-panel')?.remove();
  const rowIndex = parseInt(chip.dataset.rowIndex);
  const origDay  = parseInt(chip.dataset.origDay);
  const DAY_NAMES_PT = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
  const dayOpts = DAY_NAMES_PT.map((d, i) => `<option value="${i}"${i === origDay ? ' selected' : ''}>${d}</option>`).join('');
  const panel = document.createElement('div');
  panel.id = 'cal-edit-panel';
  panel.className = 'cal-edit';
  panel.innerHTML = `
    <button class="cal-detail-close" id="cal-edit-close">&#10005;</button>
    <div class="cal-detail-type">&#9998; Editar evento recorrente</div>
    <div class="cal-edit-field">
      <label class="cal-edit-label">Conteúdo</label>
      <textarea class="cal-edit-ta" id="cal-edit-text" rows="3">${chip.dataset.fullText || ''}</textarea>
    </div>
    <div class="cal-edit-row">
      <div class="cal-edit-field" style="flex:1">
        <label class="cal-edit-label">Dia da semana</label>
        <select class="cal-edit-sel" id="cal-edit-day">${dayOpts}</select>
      </div>
      <div class="cal-edit-field" style="width:90px">
        <label class="cal-edit-label">Horário</label>
        <input class="cal-edit-inp" id="cal-edit-time" type="text" value="${chip.dataset.time || ''}" placeholder="19h">
      </div>
    </div>
    <div class="cal-detail-actions">
      <button class="cal-detail-btn" id="cal-edit-cancel">Cancelar</button>
      <button class="cal-detail-btn cal-detail-btn--done" id="cal-edit-save">Salvar</button>
    </div>`;
  document.body.appendChild(panel);
  const rect = chip.getBoundingClientRect();
  const pw = 296, ph = panel.offsetHeight || 240;
  let left = Math.min(rect.left, window.innerWidth - pw - 8);
  let top  = rect.bottom + 6;
  if (top + ph > window.innerHeight - 8) top = rect.top - ph - 6;
  panel.style.left = `${Math.max(8, left)}px`;
  panel.style.top  = `${Math.max(8, top)}px`;
  panel.querySelector('#cal-edit-close').addEventListener('click', () => panel.remove());
  panel.querySelector('#cal-edit-cancel').addEventListener('click', () => panel.remove());
  panel.querySelector('#cal-edit-save').addEventListener('click', () => {
    const newText = document.getElementById('cal-edit-text').value.trim();
    const newDay  = parseInt(document.getElementById('cal-edit-day').value);
    const newTime = document.getElementById('cal-edit-time').value.trim();
    if (!newText) return;
    panel.remove();
    _calSaveEdit(rowIndex, newText, newDay, newTime, slug);
  });
}

function _calSaveEdit(rowIndex, newText, newDay, newTime, slug) {
  const s = _loadStrat();
  const c6 = s.content?.[6] || '';
  if (!c6) return;
  const sectionText = _parseStratSection(c6, 'Plano de Execução Simples');
  if (!sectionText) return;
  const DAY_NAMES_PT = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
  const sectionLines = sectionText.split('\n');
  let headerSeen = false, dataCount = 0;
  const newSectionLines = sectionLines.map(line => {
    if (!/^\s*\|/.test(line)) return line;
    if (/^\s*\|[\s:\-|]+$/.test(line)) return line;
    if (!headerSeen) { headerSeen = true; return line; }
    if (dataCount === rowIndex) {
      dataCount++;
      const parts = line.split('|');
      parts[1] = ` ${DAY_NAMES_PT[newDay] || parts[1].trim()} `;
      parts[2] = ` ${newText} `;
      if (parts.length >= 5) parts[4] = ` ${newTime || parts[4].trim()} `;
      return parts.join('|');
    }
    dataCount++;
    return line;
  });
  const pos = c6.indexOf(sectionText);
  if (pos === -1) return;
  // If day changed, clear stale moves for this base event
  const baseId = `ev_${rowIndex}`;
  const moves = _calGetMoves(slug);
  let movesChanged = false;
  for (const key of Object.keys(moves)) {
    if (key.startsWith(baseId + '_')) { delete moves[key]; movesChanged = true; }
  }
  if (movesChanged) _calSetMoves(slug, moves);
  s.content[6] = c6.slice(0, pos) + newSectionLines.join('\n') + c6.slice(pos + sectionText.length);
  _saveStrat(s);
  renderDashboardCalendar();
}

function showDashboard() {
  _showView('dashboard-view');
  state.currentView = 'dashboard';
  renderSidebarNav('dashboard');
  updateDashboardGreeting();
  renderDashboardCalendar();
  loadDashboardGallery();
}

// ─── PER-FORMAT STATE ─────────────────────────────────────────────────────────

function getFormatKey() {
  if (state.contentType === 'carousel') return 'carousel';
  if (state.contentType === 'stories_seq') return 'stories_seq';
  return `creative_${state.format}`;
}

function saveFormatState() {
  const key = getFormatKey();
  const usesSlides = state.contentType === 'carousel' || state.contentType === 'stories_seq';
  state._perFormat[key] = {
    ctype: state.contentType,
    fmt: state.format,
    slides: usesSlides ? state.slides.slice() : null,
    images: !usesSlides ? state.images.slice() : null,
    caption: state.caption,
    _lastPrompts: state._lastPrompts.slice(),
    _lastVariations: state._lastVariations.slice(),
    activeSlideN: state._activeSlideN,
  };
}

function restoreFormatState(key) {
  const saved = state._perFormat[key];
  if (!saved) return false;
  const usesSlides = saved.ctype === 'carousel' || saved.ctype === 'stories_seq';
  state.slides = usesSlides ? (saved.slides || []) : [];
  state.images = !usesSlides ? (saved.images || []) : [];
  state.caption = saved.caption || '';
  state._lastPrompts = saved._lastPrompts || [];
  state._lastVariations = saved._lastVariations || [];
  state._activeSlideN = saved.activeSlideN || 0;
  return true;
}

function clearPreviewForFormat() {
  document.getElementById('preview-empty').style.display = 'flex';
  document.getElementById('preview-active').style.display = 'none';
  document.getElementById('btn-dl').classList.remove('show');
  const captionCard = document.getElementById('caption-card');
  if (captionCard) captionCard.style.display = 'none';
  setProgress('', true);
}

function renderSavedFormat() {
  setProgress('', true);
  const usesSlides = state.contentType === 'carousel' || state.contentType === 'stories_seq';
  const hasContent = usesSlides
    ? state.slides.some(s => s && s !== 'loading')
    : state.images.some(s => s && s !== 'loading');
  if (!hasContent) { clearPreviewForFormat(); return; }

  document.getElementById('preview-empty').style.display = 'none';
  document.getElementById('preview-active').style.display = 'flex';

  if (usesSlides) {
    const N = state.slides.length;
    state._activeSlideN = N;
    document.getElementById('view-creative').style.display = 'none';
    document.getElementById('view-carousel').style.display = 'block';
    document.getElementById('cnt-tot').textContent = N;
    initSlots(N); initSegBar(N); goTo(0);
    state.slides.forEach((s, i) => { if (s && s !== 'loading') setSlideEl(i, s); });
  } else {
    const N = state.images.length;
    const fmt = state.format;
    document.getElementById('view-carousel').style.display = 'none';
    document.getElementById('view-creative').style.display = 'block';
    initGrid(N, fmt);
    state.images.forEach((s, i) => { if (s && s !== 'loading') setSlotEl(i, s); });
  }

  document.getElementById('btn-dl').classList.add('show');
  const captionCard = document.getElementById('caption-card');
  if (captionCard) {
    if (state.caption) {
      captionCard.style.display = 'block';
      document.getElementById('caption-text').value = state.caption;
    } else {
      captionCard.style.display = 'none';
    }
  }
}

function showForm(ctype, fmt) {
  // Save current format's images before switching (only when already in form view)
  const isSwitchingFormat = !!ctype && state.currentView === 'form';
  if (isSwitchingFormat) saveFormatState();

  _showView('form-view');
  state.currentView = 'form';
  state._formatPreselected = !!ctype;
  const tipoSection = document.getElementById('sec-tipo');
  if (tipoSection) tipoSection.style.display = ctype ? 'none' : '';
  if (ctype) {
    state.contentType = ctype;
    document.querySelectorAll('[data-ctype]').forEach(c => c.classList.toggle('active', c.dataset.ctype === ctype));
    updateTypeUI();
  }
  if (fmt) {
    state.format = fmt;
    const sel = document.getElementById('in-format'); if (sel) sel.value = fmt;
    if (ctype === 'creative' && fmt === '9:16') {
      state.qty = 1;
      const qtyEl = document.getElementById('in-qty'); if (qtyEl) qtyEl.value = '1';
    }
  }
  // Filter format select options based on context
  const formatGroup = document.getElementById('format-group');
  const formatSel = document.getElementById('in-format');
  if (formatGroup && formatSel) {
    if (ctype === 'creative' && fmt === '9:16') {
      formatGroup.style.display = 'none';
    } else if (ctype === 'creative') {
      formatGroup.style.display = '';
      formatSel.innerHTML = '<option value="4:5">Feed 4:5 (1080×1350)</option><option value="1:1">Quadrado (1080×1080)</option>';
      formatSel.value = fmt || '4:5';
    } else {
      formatGroup.style.display = '';
      formatSel.innerHTML = '<option value="4:5">Feed 4:5 (1080×1350)</option><option value="1:1">Quadrado (1080×1080)</option><option value="9:16">Story (1080×1920)</option>';
      formatSel.value = state.format;
    }
  }
  const fmtLabel = ctype === 'carousel' ? 'Carrossel'
    : ctype === 'stories_seq' ? 'Seq. de Stories'
    : ctype === 'creative' && fmt === '9:16' ? 'Story Único'
    : ctype === 'creative' ? 'Feed'
    : state._currentFormatLabel || 'Criar Post';
  state._currentFormatLabel = fmtLabel;
  const ctxLabel = document.getElementById('form-ctx-label');
  if (ctxLabel) ctxLabel.textContent = fmtLabel;
  const fmtBadge = document.getElementById('form-ctx-fmt-badge');
  if (fmtBadge) {
    const badgeText = ctype === 'creative' ? (fmt || state.format) : ctype === 'stories_seq' ? '9:16' : '';
    fmtBadge.textContent = badgeText;
    fmtBadge.style.display = badgeText ? '' : 'none';
  }
  const temaBadge = document.querySelector('#sec-tema .step-badge');
  const imagemBadge = document.querySelector('#sec-imagem .step-badge');
  if (temaBadge) temaBadge.textContent = ctype ? '1' : '2';
  if (imagemBadge) imagemBadge.textContent = ctype ? '2' : '3';
  renderSidebarNav('form');

  // Restore saved images for the new format (if any)
  if (isSwitchingFormat) {
    if (restoreFormatState(getFormatKey())) renderSavedFormat();
    else clearPreviewForFormat();
  }

  renderLogoPreview();
  const firstSection = ctype ? 'sec-tema' : 'sec-tipo';
  setTimeout(() => document.getElementById(firstSection)?.scrollIntoView({ behavior:'smooth', block:'start' }), 50);
}

function updateDashboardGreeting() {
  const nameEl = document.getElementById('dash-username');
  const handleEl = document.getElementById('dash-handle');
  if (nameEl) nameEl.textContent = localStorage.getItem('adgen_user_name') || 'Gustavo';
  if (handleEl) {
    const brand = state.brandName || localStorage.getItem('adgen_last_brand') || 'seuhandle';
    handleEl.textContent = brand.startsWith('@') ? brand : `@${brand.replace(/\s+/g,'').toLowerCase()}`;
  }
}

async function loadDashboardGallery() {
  const galleryEl = document.getElementById('dash-gallery');
  if (!galleryEl) return;
  try {
    const allGen = await ImageDB.list();
    if (!allGen.length) return;
    const pairs = allGen.slice(0, 8).flatMap(g => (g.images || []).slice(0, 3).map(img => ({ img, genId: g.id })));
    if (!pairs.length) return;
    const grid = document.createElement('div');
    grid.className = 'dash-gallery-grid';
    pairs.slice(0, 12).forEach(({ img, genId }) => {
      const wrap = document.createElement('div');
      wrap.className = 'dash-gallery-item';
      const el = document.createElement('img');
      el.className = 'dash-gallery-thumb';
      el.src = `data:${img.mime};base64,${img.b64}`;
      el.alt = '';
      el.addEventListener('click', () => openLightbox(img.b64, img.mime));
      const delBtn = document.createElement('button');
      delBtn.className = 'dash-gallery-del';
      delBtn.title = 'Remover da galeria';
      delBtn.textContent = '✕';
      delBtn.addEventListener('click', async e => {
        e.stopPropagation();
        await ImageDB.remove(genId);
        loadDashboardGallery();
      });
      wrap.appendChild(el);
      wrap.appendChild(delBtn);
      grid.appendChild(wrap);
    });
    galleryEl.innerHTML = '';
    galleryEl.appendChild(grid);
  } catch(_) {}
}

function initDashboard() {
  const DASH_SVGS = {
    carousel:`<svg width="22" height="18" viewBox="0 0 22 18" fill="none"><rect x="0" y="0" width="22" height="5" rx="1.5" fill="currentColor"/><rect x="0" y="6.5" width="22" height="5" rx="1.5" fill="currentColor" opacity=".6"/><rect x="0" y="13" width="22" height="5" rx="1.5" fill="currentColor" opacity=".3"/></svg>`,
    post:`<svg width="14" height="18" viewBox="0 0 14 18" fill="none"><rect x="1" y="1" width="12" height="16" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="3" y="4" width="8" height="6" rx="1" fill="currentColor" opacity=".5"/><rect x="3" y="12" width="8" height="1.5" rx=".75" fill="currentColor" opacity=".35"/></svg>`,
    story:`<svg width="10" height="18" viewBox="0 0 10 18" fill="none"><rect x="1" y="1" width="8" height="16" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="2.5" y="3" width="5" height="7" rx=".8" fill="currentColor" opacity=".5"/></svg>`,
    stories_seq:`<svg width="22" height="18" viewBox="0 0 22 18" fill="none"><rect x="0" y="2" width="6" height="14" rx="1.5" fill="currentColor" opacity=".4"/><rect x="8" y="1" width="6" height="16" rx="1.5" fill="currentColor" opacity=".7"/><rect x="16" y="2" width="6" height="14" rx="1.5" fill="currentColor" opacity=".4"/></svg>`,
    reels:`<svg width="20" height="18" viewBox="0 0 20 18" fill="none"><circle cx="10" cy="9" r="8" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M8 6.5l6 2.5-6 2.5V6.5z" fill="currentColor" opacity=".7"/></svg>`,
    livre:`<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 13.5L13.5 3l1.5 1.5L4.5 15H3V13.5z" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linejoin="round"/><path d="M11 5l2 2" stroke="currentColor" stroke-width="1.4"/></svg>`,
    foto:`<svg width="20" height="16" viewBox="0 0 20 16" fill="none"><rect x="1" y="3" width="18" height="12" rx="2" stroke="currentColor" stroke-width="1.4" fill="none"/><circle cx="10" cy="9" r="3" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M7 3l1.5-2h3L13 3" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" fill="none"/></svg>`,
  };
  const formats = [
    { id:'carousel',    label:'Carrossel',            desc:'Sequência de slides educativos', wip:false, ctype:'carousel',  fmt:null },
    { id:'post',        label:'Post',                 desc:'Imagem única para o feed',       wip:false, ctype:'creative',  fmt:'4:5' },
    { id:'story',       label:'Story Único',          desc:'Formato vertical 9:16',          wip:false, ctype:'creative',  fmt:'9:16' },
    { id:'stories_seq', label:'Sequência de Stories', desc:'Série de stories conectados',    wip:false, ctype:'stories_seq', fmt:'9:16' },
    { id:'reels',       label:'Editar Vídeo/Reels',   desc:'Roteiro e criação de Reels',     wip:true  },
    { id:'livre',       label:'Criação Livre',        desc:'Descreva o que precisa',         wip:true  },
    { id:'foto',        label:'Foto Profissional',    desc:'Foto de produto ou serviço',     wip:true  },
  ];
  const grid = document.getElementById('dash-formats-grid');
  if (grid) {
    formats.forEach(f => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `dash-fmt-card${f.wip ? ' wip' : ''}`;
      btn.innerHTML = `<div class="dash-fmt-icon-wrap">${DASH_SVGS[f.id]||''}</div>`
        + `<div class="dash-fmt-title">${f.label}</div>`
        + `<div class="dash-fmt-desc">${f.desc}</div>`
        + (f.wip ? '<span class="badge-wip">em desenvolvimento</span>' : '');
      if (!f.wip) btn.addEventListener('click', () => showForm(f.ctype, f.fmt));
      grid.appendChild(btn);
    });
  }

  const TOOLS = [
    { icon:'🎬', label:'Roteiro de Reels',    desc:'Crie roteiros completos para seus Reels' },
    { icon:'📱', label:'Roteiro de Stories',  desc:'Stories sequenciais com narrativa' },
    { icon:'✨', label:'Otimize Bio & Nome',   desc:'Melhore o perfil para conversão' },
    { icon:'📊', label:'Insights',            desc:'Análise de performance do seu conteúdo' },
    { icon:'⚡', label:'Automações',          desc:'Publique automaticamente no horário certo' },
  ];
  const toolsList = document.getElementById('dash-tools-list');
  if (toolsList) {
    TOOLS.forEach(t => {
      const div = document.createElement('div');
      div.className = 'dash-tool-item';
      div.innerHTML = `<div class="dash-tool-icon">${t.icon}</div>`
        + `<div class="dash-tool-info"><div class="dash-tool-name">${t.label}</div><div class="dash-tool-desc">${t.desc}</div></div>`
        + `<span class="badge-wip">em desenvolvimento</span>`
        + `<span class="dash-tool-arrow">›</span>`;
      toolsList.appendChild(div);
    });
  }

  updateDashboardGreeting();
  loadDashboardGallery();
}

// ─── INIT ────────────────────────────────────────────────────────────────────

function init() {
  syncApiKey();
  renderPersonas();
  initTheme();

  // Carousel nav
  document.getElementById('nav-prev').addEventListener('click',()=>goTo(state.currentSlide-1));
  document.getElementById('nav-next').addEventListener('click',()=>goTo(state.currentSlide+1));
  document.addEventListener('keydown', e => {
    if (e.key==='Escape') { closeLightbox(); closeHistory(); return; }
    if (!state.slides.some(s=>s!==null)) return;
    if (e.key==='ArrowLeft') goTo(state.currentSlide-1);
    if (e.key==='ArrowRight') goTo(state.currentSlide+1);
  });
  const vp=document.getElementById('carousel-vp');
  let startX=null;
  vp.addEventListener('mousedown',e=>{startX=e.clientX;vp.classList.add('dragging');});
  vp.addEventListener('mouseup',e=>{
    vp.classList.remove('dragging');
    if (startX===null) return;
    const d=startX-e.clientX; if (Math.abs(d)>48) goTo(state.currentSlide+(d>0?1:-1)); startX=null;
  });
  vp.addEventListener('mouseleave',()=>{vp.classList.remove('dragging');startX=null;});
  vp.addEventListener('touchstart',e=>{ startX=e.touches[0].clientX;vp.classList.add('dragging'); },{passive:true});
  vp.addEventListener('touchend',e=>{ vp.classList.remove('dragging'); const d=startX-e.changedTouches[0].clientX; if(Math.abs(d)>48)goTo(state.currentSlide+(d>0?1:-1)); startX=null; },{passive:true});

  // API key (sidebar + mobile)
  document.getElementById('api-key-input').addEventListener('input',e=>{
    localStorage.setItem('adgen_key',e.target.value.trim()); syncApiKey();
  });
  document.getElementById('api-key-input-mobile')?.addEventListener('input',e=>{
    localStorage.setItem('adgen_key',e.target.value.trim()); syncApiKey();
  });

  // OpenAI key
  syncOpenAIKey();
  document.getElementById('openai-key-input')?.addEventListener('input', e => {
    localStorage.setItem('adgen_openai_key', e.target.value.trim()); syncOpenAIKey();
  });

  // Reference images
  document.getElementById('btn-upload-ref')?.addEventListener('click', () => document.getElementById('file-ref-img')?.click());
  document.getElementById('file-ref-img')?.addEventListener('change', e => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        const b64 = ev.target.result.split(',')[1];
        const mime = file.type || 'image/jpeg';
        state.refImages.push({ b64, mime, name: file.name });
        renderRefPreviews();
      };
      reader.readAsDataURL(file);
    });
  });
  document.getElementById('btn-analyze-refs')?.addEventListener('click', () =>
    analyzeRefImages(localStorage.getItem('adgen_key') || '')
  );
  document.getElementById('btn-clear-ref-style')?.addEventListener('click', () => {
    state.refStyle = [];
    if (state.brandName) saveClientRefStyle(state.brandName, []);
    syncRefStyleUI();
    toast('Estilo de referência removido.', 'ok');
  });

  // Brand input — detect @handle
  let brandTimer;
  document.getElementById('in-brand').addEventListener('input',e=>{
    clearTimeout(brandTimer);
    const val=e.target.value.trim();
    const isHandle=val.startsWith('@');
    document.getElementById('btn-analyze').style.display=isHandle&&val.length>2?'inline-flex':'none';
    brandTimer=setTimeout(()=>{
      if (!isHandle && val.length>=2) syncModifier(val);
    },380);
  });

  // Analyze Instagram profile
  document.getElementById('btn-analyze').addEventListener('click', async () => {
    const apiKey=localStorage.getItem('adgen_key')||'';
    const handle=document.getElementById('in-brand').value.trim();
    if (!apiKey) { toast('Adicione sua API key primeiro.','warn'); return; }
    const btn=document.getElementById('btn-analyze');
    btn.disabled=true; btn.textContent='Analisando…';
    try {
      const info=await analyzeInstagramProfile(handle, apiKey);
      if (info.brandName) document.getElementById('in-brand').value=info.brandName;
      if (info.region) {
        ['in-region','in-region-creative','in-region-stories'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=info.region; });
        state.region=info.region;
      }
      if (info.modifier) {
        document.getElementById('mod-textarea').value=info.modifier;
        document.getElementById('mod-badge').textContent='Gerado';
        document.getElementById('mod-badge').className='modifier-badge badge-ok';
        document.getElementById('mod-details').removeAttribute('open');
        saveModifier(info.brandName||handle, info.modifier);
      }
      if (info.stylePref) {
        const spEl = document.getElementById('in-style-pref');
        if (spEl) spEl.value = info.stylePref;
        state.stylePref = info.stylePref;
      }
      showBrandCard(info);
      state.brandName = info.brandName||handle;
      localStorage.setItem('adgen_last_brand', state.brandName);
      state.brandServices = info.exactServices||info.services||[];
      state.brandPillars = info.contentPillars||info.contentThemes||[];
      if (info.personas && info.personas.length) {
        state.personas = info.personas.map(p => ({
          id: uid(),
          name: p.name||'',
          ageRange: p.ageRange||'',
          trait: p.trait||p.occupation||'',
          interests: Array.isArray(p.interests)?p.interests:[],
          painPoints: Array.isArray(p.painPoints)?p.painPoints:[],
        }));
        renderPersonas();
        renderPersonaFocus();
        if (info.confidence !== 'high') {
          toast(`Perfil analisado (confiança ${info.confidence||'?'}) — revise localização e serviços.`, 'warn');
        } else {
          toast('Perfil analisado — 3 personas criadas!', 'ok');
        }
      } else {
        if (info.confidence !== 'high') {
          toast(`Perfil analisado (confiança ${info.confidence||'?'}) — revise os dados retornados.`, 'warn');
        } else {
          toast('Perfil analisado com sucesso!', 'ok');
        }
      }
      // Save client profile
      ClientDB.save(info.brandName||handle, {
        niche: info.niche, tone: info.tone, modifier: info.modifier,
        region: info.region, services: info.exactServices||[],
        personas: state.personas, stylePref: info.stylePref||'',
      });
    } catch(err) {
      toast(`Erro ao analisar: ${err.message}`,'err');
    } finally {
      btn.disabled=false; btn.textContent='Analisar perfil';
      document.getElementById('btn-analyze').style.display='inline-flex';
    }
  });

  // Modifier file — full import
  document.getElementById('btn-load-dna').addEventListener('click',()=>document.getElementById('file-dna').click());
  document.getElementById('file-dna').addEventListener('change',e=>{
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>{
      const data=parseFullBrandDna(ev.target.result);
      const populated=[];
      if (data.brandName) { document.getElementById('in-brand').value=data.brandName; state.brandName=data.brandName; populated.push('nome'); }
      if (data.niche||data.tone) { showBrandCard({brandName:data.brandName||state.brandName,niche:data.niche,tone:data.tone,audience:'',confidence:'high',services:data.services||[]}); populated.push('nicho/tom'); }
      if (data.region) { state.region=data.region; ['in-region','in-region-creative','in-region-stories'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=data.region;}); populated.push('região'); }
      if (data.stylePref) { const el=document.getElementById('in-style-pref'); if(el)el.value=data.stylePref; state.stylePref=data.stylePref; populated.push('estilo visual'); }
      if (data.personas?.length) { state.personas=data.personas; renderPersonas(); renderPersonaFocus(); populated.push(`${data.personas.length} persona(s)`); }
      if (data.modifier) { document.getElementById('mod-textarea').value=data.modifier; document.getElementById('mod-badge').textContent='Carregado'; document.getElementById('mod-badge').className='modifier-badge badge-ok'; populated.push('modifier'); }
      if (data.services?.length) { state.brandServices=data.services; }
      if (state.brandName) ClientDB.save(state.brandName,{niche:data.niche,tone:data.tone,modifier:data.modifier,region:data.region,services:data.services||[],personas:state.personas,stylePref:data.stylePref||''});
      if (populated.length) toast(`Importado: ${populated.join(', ')}.`,'ok');
      else toast('Nenhum dado reconhecido no arquivo.','warn');
    }; reader.readAsText(file); e.target.value='';
  });

  // Modifier — Compor manualmente
  document.getElementById('btn-toggle-compose').addEventListener('click',()=>{
    const f=document.getElementById('dna-compose-form');
    f.style.display=f.style.display==='none'?'block':'none';
  });
  document.getElementById('btn-compose-dna').addEventListener('click', composeBrandDna);

  // Export brand-dna.md
  document.getElementById('btn-export-dna').addEventListener('click', exportBrandDna);

  document.getElementById('btn-save-mod').addEventListener('click',()=>{
    const brand=document.getElementById('in-brand').value.trim();
    const mod=document.getElementById('mod-textarea').value.trim();
    if (!brand||!mod) { toast('Preencha marca e modifier.','warn'); return; }
    saveModifier(brand,mod); syncModifier(brand); toast('Modifier salvo.','ok');
  });

  // Personas
  document.getElementById('btn-add-persona').addEventListener('click',()=>{
    const newP = { id:uid(), name:'', ageRange:'', trait:'', interests:[], painPoints:[] };
    state.personas.push(newP); renderPersonas(); renderPersonaFocus();
    const card = document.querySelector(`.persona-card[data-id="${newP.id}"]`);
    if (card) showPersonaEditForm(card, newP);
  });
  document.getElementById('btn-upload-personas').addEventListener('click',()=>document.getElementById('file-personas').click());
  document.getElementById('file-personas').addEventListener('change',e=>{
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>{
      try {
        const personas=parsePersonaFile(ev.target.result, file.name);
        if (!personas.length) { toast('Nenhuma persona encontrada no arquivo.','warn'); return; }
        state.personas=[...state.personas,...personas]; renderPersonas();
        toast(`${personas.length} persona(s) importada(s).`,'ok');
      } catch(err) { toast(`Erro ao importar: ${err.message}`,'err'); }
    }; reader.readAsText(file); e.target.value='';
  });

  // Content type cards
  document.querySelectorAll('[data-ctype]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if (btn.dataset.ctype !== state.contentType) saveFormatState();
      document.querySelectorAll('[data-ctype]').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active'); state.contentType=btn.dataset.ctype; updateTypeUI();
      if (restoreFormatState(getFormatKey())) renderSavedFormat();
      else clearPreviewForFormat();
    });
  });

  // Carousel: slide count
  document.getElementById('in-count').addEventListener('input',e=>{
    const v=parseInt(e.target.value,10); if (v>=1&&v<=15) { state.slideCount=v; document.getElementById('cnt-tot').textContent=v; }
  });

  // Creative: format / qty
  document.getElementById('in-format').addEventListener('change',e=>{
    state.format=e.target.value;
    const b=document.getElementById('form-ctx-fmt-badge');
    if (b && b.style.display!=='none') b.textContent=e.target.value;
  });
  document.getElementById('in-qty').addEventListener('input',e=>{ const v=parseInt(e.target.value,10); if(v>=1&&v<=4) state.qty=v; });

  // Stories sequence: frame count + region
  document.getElementById('in-stories-count')?.addEventListener('input',e=>{
    const v=parseInt(e.target.value,10); if(v>=2&&v<=8) { state.storiesSeqCount=v; updateCostEstimate(); }
  });
  document.getElementById('in-region-stories')?.addEventListener('input',e=>{
    state.region=e.target.value.trim()||'Rondônia (RO), Brasil';
    document.getElementById('in-region').value=state.region;
    document.getElementById('in-region-creative').value=state.region;
  });

  // Region (keep all three synced)
  const syncRegion = (src, val) => {
    state.region = val.trim() || 'Rondônia (RO), Brasil';
    ['in-region','in-region-creative','in-region-stories'].forEach(id => {
      if (id !== src) { const el=document.getElementById(id); if(el) el.value=state.region; }
    });
  };
  document.getElementById('in-region').addEventListener('input',e=>syncRegion('in-region',e.target.value));
  document.getElementById('in-region-creative').addEventListener('input',e=>syncRegion('in-region-creative',e.target.value));

  // Idea mode toggle
  document.querySelectorAll('.idea-mode-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.idea-mode-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active'); state.ideaMode=btn.dataset.mode;
      document.getElementById('tema-manual').style.display=state.ideaMode==='manual'?'block':'none';
      document.getElementById('tema-ideas').style.display=state.ideaMode==='ideas'?'block':'none';
      if (state.ideaMode==='ideas') {
        state._usedIdeas=[]; state.selectedIdea='';
        const bi=document.getElementById('btn-ideas');
        if (bi) bi.className='btn-ideas btn-ideas--more';
      }
    });
  });

  // Generate ideas
  document.getElementById('btn-ideas').addEventListener('click', async () => {
    const apiKey=localStorage.getItem('adgen_key')||'';
    const marca=document.getElementById('in-brand').value.trim();
    const modifier=document.getElementById('mod-textarea').value.trim();
    if (!apiKey) { toast('Adicione sua API key.','warn'); return; }
    if (!marca)  { toast('Preencha a marca.','warn'); return; }
    const btn=document.getElementById('btn-ideas'); btn.disabled=true; btn.textContent='Gerando…';
    try {
      const ideas=await generateIdeas(marca, modifier, apiKey, state._usedIdeas);
      state._usedIdeas = [...state._usedIdeas, ...ideas];
      const chips=document.getElementById('ideas-chips'); chips.innerHTML=''; state.selectedIdea='';
      const complementWrap = document.getElementById('idea-complement');
      if (complementWrap) { complementWrap.style.display='none'; }
      const complementTa = document.getElementById('in-idea-complement');
      if (complementTa) complementTa.value = '';
      const calEv = _getTodayCalEvent();
      if (calEv) {
        const calChip = document.createElement('button'); calChip.type = 'button';
        calChip.className = 'idea-chip idea-chip--cal';
        calChip.innerHTML = `<span class="idea-chip-cal-badge">${calEv.icon} Tema do dia</span>${calEv.text}`;
        calChip.addEventListener('click', () => {
          document.querySelectorAll('.idea-chip').forEach(c => c.classList.remove('selected'));
          calChip.classList.add('selected'); state.selectedIdea = calEv.text;
          if (complementWrap) complementWrap.style.display = 'block';
          if (complementTa) complementTa.focus();
        });
        chips.appendChild(calChip);
      }
      ideas.forEach((idea, idx) => {
        const chip=document.createElement('button'); chip.type='button'; chip.className='idea-chip';
        chip.innerHTML=`<span class="idea-chip-num">${idx+1}.</span>${esc(idea)}`;
        chip.addEventListener('click',()=>{
          document.querySelectorAll('.idea-chip').forEach(c=>c.classList.remove('selected'));
          chip.classList.add('selected'); state.selectedIdea=idea;
          if (complementWrap) complementWrap.style.display='block';
          if (complementTa) complementTa.focus();
        });
        chips.appendChild(chip);
      });
    } catch(err) { toast(`Erro: ${err.message}`,'err'); }
    finally {
      btn.disabled=false;
      btn.textContent = '↺ Gerar mais ideias';
      btn.className = 'btn-ideas btn-ideas--more';
    }
  });

  // Image source
  document.querySelectorAll('.source-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.source-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active'); state.imageSource=btn.dataset.source;
      document.getElementById('source-describe').style.display=state.imageSource==='describe'?'block':'none';
      document.getElementById('source-attach').style.display=state.imageSource==='attach'?'block':'none';
    });
  });
  document.getElementById('in-img-desc').addEventListener('input',e=>{ state.imageDescription=e.target.value.trim(); });

  // Logo upload
  document.getElementById('btn-upload-logo').addEventListener('click', () => document.getElementById('file-logo').click());
  document.getElementById('file-logo').addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const [header, b64] = ev.target.result.split(',');
      const mime = header.match(/data:(.*);base64/)?.[1] || 'image/png';
      state.logos.push({ b64, mime, name: file.name });
      saveClientLogos(state.brandName || '', state.logos);
      renderLogoPreview();
      analyzeLogosForModifier();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  // Reference image (attach)
  document.getElementById('btn-attach-img').addEventListener('click',()=>document.getElementById('file-img').click());
  document.getElementById('file-img').addEventListener('change',e=>{
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>{
      const [header,b64]=ev.target.result.split(',');
      const mime=header.match(/data:(.*);base64/)?.[1]||'image/png';
      state.attachedImage={b64,mime};
      const preview=document.getElementById('attach-preview'); preview.innerHTML='';
      const img=document.createElement('img'); img.src=ev.target.result; img.alt='ref';
      const rmBtn=document.createElement('button'); rmBtn.type='button'; rmBtn.className='btn-sm'; rmBtn.style.marginTop='6px'; rmBtn.textContent='Remover';
      rmBtn.addEventListener('click',()=>{ state.attachedImage=null; preview.innerHTML=''; document.getElementById('file-img').value=''; });
      preview.appendChild(img); preview.appendChild(rmBtn);
    }; reader.readAsDataURL(file);
  });

  // Person photos
  document.getElementById('btn-add-person-photo').addEventListener('click',()=>document.getElementById('file-person-photo').click());
  document.getElementById('file-person-photo').addEventListener('change',e=>{
    Array.from(e.target.files).forEach(file=>{
      const reader=new FileReader();
      reader.onload=ev=>{
        const [header,b64]=ev.target.result.split(',');
        const mime=header.match(/data:(.*);base64/)?.[1]||'image/png';
        state.personPhotos.push({id:uid(), b64, mime});
        renderPersonPhotos();
      }; reader.readAsDataURL(file);
    }); e.target.value='';
  });

  // Lightbox
  document.getElementById('lightbox').addEventListener('click', e=>{
    if (e.target===document.getElementById('lightbox')) closeLightbox();
  });
  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);

  // Generate button
  document.getElementById('btn-gen').addEventListener('click', async e => {
    e.preventDefault(); if (state.generating) return; await generate();
  });

  // Download
  document.getElementById('btn-dl').addEventListener('click',()=>{
    const tema=state.ideaMode==='ideas'?state.selectedIdea:document.getElementById('in-tema').value.trim();
    const slug=slugify(tema||'download');
    if (state.contentType === 'stories_seq') {
      const fmtInfo = FORMAT_DIMS['9:16'];
      downloadZip(slug, state.slides, i=>`story-${String(i+1).padStart(2,'0')}_${fmtInfo.w}x${fmtInfo.h}.png`);
    } else if (state.contentType==='carousel') {
      const fmtInfo=FORMAT_DIMS['4:5'];
      downloadZip(slug, state.slides, i=>`slide-${String(i+1).padStart(2,'0')}_${fmtInfo.w}x${fmtInfo.h}.png`);
    } else {
      const fmtInfo=FORMAT_DIMS[state.format];
      downloadZip(slug, state.images, i=>`criativo-${String(i+1).padStart(2,'0')}_${fmtInfo.w}x${fmtInfo.h}.png`);
    }
  });

  // Theme swatches
  document.querySelectorAll('.theme-swatch').forEach(s => {
    s.addEventListener('click', () => applyTheme(s.dataset.theme));
  });

  // Sidebar event delegation
  document.getElementById('sb-nav')?.addEventListener('click', e => {
    const item = e.target.closest('[data-action],[data-section],[data-fmt-ctype]');
    if (!item) return;
    const action = item.dataset.action;
    if (action === 'history') { showHistory(); return; }
    if (action === 'dashboard') { showDashboard(); return; }
    if (action === 'change-client') { showClientView(); return; }
    if (action === 'edit-profile') { showClientProfile(); return; }
    if (item.dataset.section) { scrollToSection(item.dataset.section); return; }
    if (item.dataset.fmtCtype) showForm(item.dataset.fmtCtype, item.dataset.fmtFmt || null);
  });

  // Client view events
  document.getElementById('cv-brand-input')?.addEventListener('input', e => {
    const val = e.target.value.trim();
    const isHandle = val.startsWith('@') && val.length > 2;
    const analyzeBtn = document.getElementById('cv-btn-analyze');
    if (analyzeBtn) analyzeBtn.style.display = isHandle ? 'flex' : 'none';
  });
  document.getElementById('cv-continue')?.addEventListener('click', () => {
    const name = document.getElementById('cv-brand-input')?.value.trim();
    if (!name) { toast('Digite o nome do cliente.', 'warn'); return; }
    selectClient(name);
  });
  document.getElementById('cv-brand-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('cv-continue')?.click();
  });
  document.getElementById('cv-recents-grid')?.addEventListener('click', e => {
    const btn = e.target.closest('.cv-recent-btn');
    if (!btn) return;
    const name = decodeURIComponent(btn.dataset.client || '');
    if (name) selectClient(name);
  });
  document.getElementById('cv-btn-analyze')?.addEventListener('click', async () => {
    const apiKey = localStorage.getItem('adgen_key') || '';
    const handle = document.getElementById('cv-brand-input')?.value.trim();
    if (!apiKey) { toast('Adicione sua API key primeiro.', 'warn'); return; }
    const btn = document.getElementById('cv-btn-analyze');
    btn.disabled = true; btn.textContent = 'Analisando…';
    try {
      const info = await analyzeInstagramProfile(handle, apiKey);
      const name = info.brandName || handle;
      state.brandName = name;
      localStorage.setItem('adgen_last_brand', name);
      document.getElementById('cv-brand-input').value = name;
      document.getElementById('in-brand').value = name;
      if (info.region) {
        state.region = info.region;
        ['in-region','in-region-creative','in-region-stories'].forEach(id => { const el = document.getElementById(id); if (el) el.value = info.region; });
      }
      if (info.modifier) {
        document.getElementById('mod-textarea').value = info.modifier;
        document.getElementById('mod-badge').textContent = 'Gerado';
        document.getElementById('mod-badge').className = 'modifier-badge badge-ok';
        document.getElementById('mod-details').removeAttribute('open');
        saveModifier(name, info.modifier);
      }
      if (info.stylePref) {
        const spEl = document.getElementById('in-style-pref');
        if (spEl) spEl.value = info.stylePref;
        state.stylePref = info.stylePref;
      }
      if (info.personas && info.personas.length) {
        state.personas = info.personas.map(p => ({
          id: uid(), name: p.name||'', ageRange: p.ageRange||'',
          trait: p.trait||'', interests: Array.isArray(p.interests)?p.interests:[],
          painPoints: Array.isArray(p.painPoints)?p.painPoints:[],
        }));
        renderPersonas();
        renderPersonaFocus();
      }
      ClientDB.save(name, {
        niche: info.niche, tone: info.tone, modifier: info.modifier,
        region: info.region, services: info.exactServices||[],
        personas: state.personas, stylePref: info.stylePref||'',
      });
      showBrandCard(info);
      if (info.confidence === 'high') {
        toast(`${name} analisado com sucesso!`, 'ok');
      } else {
        toast(`${name} analisado (confiança ${info.confidence}) — revise localização e serviços.`, 'warn');
      }
      showClientProfile();
    } catch(err) {
      toast(`Erro na análise: ${err.message}`, 'err');
    } finally {
      btn.disabled = false; btn.textContent = '✦ Analisar perfil'; btn.style.display = 'flex';
    }
  });

  // Save / delete client profile
  document.getElementById('cp-save-btn')?.addEventListener('click', saveClientProfile);
  document.getElementById('cp-delete-btn')?.addEventListener('click', deleteClient);

  // Stop generation
  document.getElementById('btn-stop')?.addEventListener('click', () => {
    state._abortController?.abort();
    toast('Interrompendo geração…', 'warn');
  });

  // Download all captions
  document.getElementById('btn-dl-captions')?.addEventListener('click', downloadAllCaptions);

  // Post type pills
  document.getElementById('post-type-pills')?.addEventListener('click', e => {
    const btn = e.target.closest('.post-type-pill');
    if (!btn) return;
    document.querySelectorAll('.post-type-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.postType = btn.dataset.ptype;
    clearIdeasIfStale();
  });

  // Cost estimate live update
  updateCostEstimate();
  document.getElementById('in-count')?.addEventListener('input', updateCostEstimate);
  document.getElementById('in-qty')?.addEventListener('input', updateCostEstimate);
  document.getElementById('in-stories-count')?.addEventListener('input', updateCostEstimate);
  document.querySelectorAll('[data-ctype]').forEach(btn => btn.addEventListener('click', () => setTimeout(updateCostEstimate, 0)));

  // Caption regenerate + persona tabs
  document.getElementById('btn-regen-caption')?.addEventListener('click', () => regenCaption());
  document.getElementById('caption-persona-tabs')?.addEventListener('click', e => {
    const btn = e.target.closest('.caption-persona-tab');
    if (!btn) return;
    document.querySelectorAll('.caption-persona-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const idx = parseInt(btn.dataset.idx, 10);
    regenCaption(isNaN(idx) ? undefined : idx);
  });

  // Persona focus pills
  renderPersonaFocus();

  // History modal
  document.getElementById('hm-close')?.addEventListener('click', closeHistory);
  document.getElementById('history-modal')?.addEventListener('click', e => {
    if (e.target.id === 'history-modal') closeHistory();
  });

  // Copy caption
  document.getElementById('btn-copy-caption').addEventListener('click',()=>{
    const ta=document.getElementById('caption-text'); if (!ta?.value) return;
    navigator.clipboard.writeText(ta.value).then(()=>{
      const btn=document.getElementById('btn-copy-caption'); btn.textContent='Copiado ✓';
      setTimeout(()=>{ btn.textContent='Copiar'; },2000);
    });
  });

  updateTypeUI();
  initDashboard();
  showClientView();
}

// ─── STRATEGY CONTEXT HELPER ─────────────────────────────────────────────────

function _getStrategyNote(etapaNums) {
  const strat = _loadStrat();
  if (!strat?.content) return '';
  const titles = {
    2:'Identidade da Marca', 3:'Análise de Mercado',
    4:'Público & Conversão', 5:'Estratégia de Conteúdo',
    6:'Plano de Execução 30 Dias', 7:'Plano de Longo Prazo',
  };
  const limits = { 2:500, 3:500, 4:700, 5:900, 6:600, 7:400 };
  const parts = [];
  for (const n of etapaNums) {
    const c = strat.content[n]; if (!c) continue;
    const lim = limits[n] || 600;
    parts.push(`[${titles[n]}]\n${c.length > lim ? c.slice(0, lim) + '…' : c}`);
  }
  if (!parts.length) return '';
  return '\n\n════ ESTRATÉGIA DA MARCA (use as referência) ════\n' + parts.join('\n\n') + '\n══════════════════════════════════════════';
}

function _getClientBriefNote() {
  const q = _loadStrat()?.q;
  if (!q) return '';
  const parts = [];
  if (q.dl1 && q.dl2 && q.dl3 && q.dl4)
    parts.push(`DIFERENCIAL: Somos a única ${q.dl1} que ${q.dl2} para ${q.dl3} sem ${q.dl4}`);
  const obj = STRAT_OBJETIVOS.find(o => o.id === q.objetivo);
  if (obj) parts.push(`OBJETIVO DE NEGÓCIO: ${obj.label}`);
  const pricing = [q.posicPreco, q.ticketMedio ? `Ticket ${q.ticketMedio}` : ''].filter(Boolean).join(' · ');
  if (pricing) parts.push(`POSICIONAMENTO: ${pricing}`);
  if (q.ondeVende?.length) parts.push(`CANAL DE VENDA: ${q.ondeVende.join(', ')}`);
  if (q.meta) parts.push(`META: ${q.meta}`);
  if (!parts.length) return '';
  return '\n\n════ BRIEFING DO CLIENTE ════\n' + parts.join('\n') + '\n═══════════════════════════';
}

// ─── STRATEGY VIEW ───────────────────────────────────────────────────────────

function _stratKey() {
  const slug = (state.brandName || 'draft').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
  return `adgen_strat_${slug}`;
}
function _loadStrat() {
  try { return JSON.parse(localStorage.getItem(_stratKey()) || 'null') || { q:null, confirmed:{}, content:{} }; }
  catch { return { q:null, confirmed:{}, content:{} }; }
}
function _saveStrat(s) { localStorage.setItem(_stratKey(), JSON.stringify(s)); }

function _se(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&#34;');
}

function renderMd(text) {
  if (!text) return '';
  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const inl = s => s
    .replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/__(.+?)__/g,'<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g,'<em>$1</em>')
    .replace(/`([^`\n]+)`/g,'<code>$1</code>');
  const lines = text.split('\n');
  let out = '', inUl = false, inOl = false, tableRows = [], inTable = false;
  const flushTable = () => {
    if (!tableRows.length) return;
    let thead = '', tbody = '';
    tableRows.forEach((row, i) => {
      const cells = row.split('|').slice(1,-1).map(c => c.trim());
      if (i === 1 && cells.every(c => /^[-:]+$/.test(c))) return;
      const tag = i === 0 ? 'th' : 'td';
      const tr = '<tr>' + cells.map(c => `<${tag}>${inl(esc(c))}</${tag}>`).join('') + '</tr>';
      if (i === 0) thead = tr; else tbody += tr;
    });
    out += `<table>${thead ? `<thead>${thead}</thead>` : ''}${tbody ? `<tbody>${tbody}</tbody>` : ''}</table>`;
    tableRows = []; inTable = false;
  };
  for (const raw of lines) {
    const trim = raw.trim();
    if (trim.startsWith('|') && trim.endsWith('|') && trim.indexOf('|', 1) < trim.length - 1) {
      if (inUl) { out += '</ul>'; inUl = false; }
      if (inOl) { out += '</ol>'; inOl = false; }
      inTable = true; tableRows.push(trim); continue;
    }
    if (inTable) flushTable();
    if (inUl && !/^\s*[-*+] /.test(trim)) { out += '</ul>'; inUl = false; }
    if (inOl && !/^\s*\d+\. /.test(trim)) { out += '</ol>'; inOl = false; }
    if (/^### /.test(trim))       out += `<h3>${inl(esc(trim.slice(4)))}</h3>`;
    else if (/^## /.test(trim))   out += `<h2>${inl(esc(trim.slice(3)))}</h2>`;
    else if (/^# /.test(trim))    out += `<h2>${inl(esc(trim.slice(2)))}</h2>`;
    else if (/^> /.test(trim))    out += `<blockquote>${inl(esc(trim.slice(2)))}</blockquote>`;
    else if (/^---+$/.test(trim)) out += '<hr>';
    else if (/^\s*[-*+] /.test(trim)) {
      if (!inUl) { out += '<ul>'; inUl = true; }
      out += `<li>${inl(esc(trim.replace(/^\s*[-*+] /,'')))}</li>`;
    } else if (/^\s*\d+\. /.test(trim)) {
      if (!inOl) { out += '<ol>'; inOl = true; }
      out += `<li>${inl(esc(trim.replace(/^\s*\d+\. /,'')))}</li>`;
    } else if (!trim) {
      // blank line
    } else {
      out += `<p>${inl(esc(trim))}</p>`;
    }
  }
  if (inUl) out += '</ul>';
  if (inOl) out += '</ol>';
  if (inTable) flushTable();
  return out;
}

function showBriefingView() {
  _showView('briefing-view');
  state.currentView = 'briefing';
  renderSidebarNav('briefing');
  document.getElementById('strat-client-name').textContent = state.brandName || '';
  const s = _loadStrat();
  updateStratProgress(s);
  renderStratEtapa1(s);
  const bf3 = document.getElementById('bf-step3'), bf3n = document.getElementById('bf-step3-num');
  if (bf3) {
    if (s.confirmed?.[1]) { bf3.className = 'flow-step fs-next'; bf3.onclick = showStrategyResultsView; }
    else { bf3.className = 'flow-step'; bf3.onclick = null; }
    if (bf3n) bf3n.textContent = '3';
  }
}

function showStrategyResultsView() {
  const s = _loadStrat();
  if (!s.confirmed?.[1]) {
    toast('Complete e salve o Briefing antes de acessar a Estratégia.', 'warn');
    showBriefingView(); return;
  }
  _showView('strategy-view');
  state.currentView = 'strategy';
  renderSidebarNav('strategy');
  document.getElementById('res-client-name').textContent = state.brandName || '';
  updateResProgress(s);
  for (let n = 2; n <= 7; n++) renderResultSection(n, s);
}

function updateStratProgress(s) {
  if (state.currentView === 'briefing') renderSidebarNav('briefing');
}

const RES_SECTIONS = [
  { n:2, title:'Identidade da Marca',       sub:'Golden Circle · Arquétipo · Posicionamento · Taglines · Manifesto' },
  { n:3, title:'Análise de Mercado',         sub:'Concorrentes · Gaps · SWOT · Vantagem Competitiva' },
  { n:4, title:'Público & Conversão',        sub:'Jornada · Funil · Captação de Leads · Objeções · Fidelização' },
  { n:5, title:'Estratégia de Conteúdo',     sub:'Frequência · Pilares · Reels · Ganchos Virais · Mix Semanal · Tom · CTAs' },
  { n:6, title:'Plano de Execução 30 Dias',  sub:'Calendário · Roteiros · Posicionamento · Hashtags · KPIs · Checklist' },
  { n:7, title:'Plano de Longo Prazo',       sub:'Roadmap 6 meses · Marcos · Diversificação · Monetização · OKRs' },
];

function updateResProgress(s) {
  const el = document.getElementById('res-progress-label'); if (!el) return;
  const count = [2,3,4,5,6,7].filter(n => s.content?.[n]).length;
  if (count === 0) { el.textContent = ''; el.className = 'res-progress-label'; return; }
  el.textContent = count === 6 ? '✓ Estratégia completa' : `${count}/6 seções geradas`;
  el.className = count === 6 ? 'res-progress-label res-progress-done' : 'res-progress-label';
  if (state.currentView === 'strategy') renderSidebarNav('strategy');
}

function renderResultSection(n, s) {
  const container = document.getElementById(`res-sec-${n}`); if (!container) return;
  const sec = RES_SECTIONS.find(r => r.n === n);
  const displayNum = n - 1;
  const content = s.content?.[n];
  const personasBtn = n === 4 ? `<button type="button" class="strat-generate-btn" style="background:linear-gradient(135deg,#7c3aed,#a855f7)" onclick="genStratPersonas()">👥 Criar Personas no Perfil</button>` : '';
  const badgeClass = content ? 'strat-badge-confirmed' : 'strat-badge-pending';
  const badgeText  = content ? 'Gerado' : 'Gerar';
  const bodyHtml = content
    ? `<div class="strat-body"><div class="strat-generated">${renderMd(content)}</div><div class="strat-action-row">${personasBtn}<button type="button" class="strat-regen-btn" onclick="editResultSection(${n})">✏ Editar</button><button type="button" class="strat-regen-btn" onclick="regenResultSection(${n})">↺ Regenerar</button></div></div>`
    : `<div class="strat-body"><div class="strat-action-row"><button type="button" class="strat-generate-btn" onclick="genResultSection(${n})"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1l1.5 4h4l-3 2.5 1.5 4L7 9l-4 2.5 1.5-4L1 5h4z" fill="currentColor"/></svg> Gerar com IA</button></div></div>`;
  container.className = 'strat-etapa';
  container.innerHTML = `<div class="strat-etapa-hdr">
    <div class="strat-etapa-num${content ? ' done' : ''}">${displayNum}</div>
    <div class="strat-etapa-info">
      <div class="strat-etapa-title">${_se(sec.title)}</div>
      <div class="strat-etapa-sub">${sec.sub}</div>
    </div>
    <span class="strat-badge ${badgeClass}" id="res-badge-${n}">${badgeText}</span>
  </div><div id="res-body-${n}">${bodyHtml}</div>`;
}

async function genResultSection(n) {
  const apiKey = localStorage.getItem('adgen_key') || '';
  if (!apiKey) { toast('Adicione sua API key primeiro.', 'warn'); return; }
  const s = _loadStrat();
  const badge = document.getElementById(`res-badge-${n}`);
  const bodyEl = document.getElementById(`res-body-${n}`);
  if (badge) { badge.textContent = 'Gerando…'; badge.className = 'strat-badge strat-badge-generating'; }
  if (bodyEl) bodyEl.innerHTML = `<div class="strat-body" style="color:var(--text-dim);font-size:13px;padding:8px 0">Gerando com IA…</div>`;
  try {
    const data = await callGemini(apiKey, {
      contents: [{ role:'user', parts:[{ text: _buildStratPrompt(n, s) }] }],
      generationConfig: { temperature:0.7, maxOutputTokens:2000 },
    });
    const usage = data.usageMetadata || {};
    state.totalCost += (usage.promptTokenCount||0)*COST_IN_TOKEN + (usage.candidatesTokenCount||0)*COST_OUT_TOKEN;
    refreshCost();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) throw new Error('Resposta vazia');
    if (!s.content) s.content = {};
    s.content[n] = text;
    _saveStrat(s);
    renderResultSection(n, s);
    updateResProgress(s);
  } catch (err) {
    if (badge) { badge.textContent = 'Erro'; badge.className = 'strat-badge strat-badge-pending'; }
    if (bodyEl) bodyEl.innerHTML = `<div class="strat-body"><p style="color:var(--error);font-size:13px">Erro: ${_se(err.message)}</p><div class="strat-action-row"><button type="button" class="strat-generate-btn" onclick="genResultSection(${n})">Tentar novamente</button></div></div>`;
    toast(`Erro na seção ${n - 1}: ${err.message}`, 'err');
  }
}

async function regenResultSection(n) {
  const s = _loadStrat();
  if (!s.content) s.content = {};
  delete s.content[n];
  _saveStrat(s);
  renderResultSection(n, s);
  updateResProgress(s);
  await genResultSection(n);
}

function editResultSection(n) {
  const s = _loadStrat();
  const bodyEl = document.getElementById(`res-body-${n}`); if (!bodyEl) return;
  const content = s.content?.[n] || '';
  bodyEl.innerHTML = `<div class="strat-body">
    <textarea id="res-edit-${n}" style="width:100%;min-height:420px;font-family:monospace;font-size:13px;padding:12px;border:1px solid var(--border);border-radius:8px;background:var(--bg3);color:var(--text);resize:vertical;box-sizing:border-box">${_se(content)}</textarea>
    <div class="strat-action-row" style="margin-top:12px">
      <button type="button" class="strat-generate-btn" onclick="saveResultSectionEdit(${n})">💾 Salvar edição</button>
      <button type="button" class="strat-regen-btn" onclick="renderResultSection(${n}, _loadStrat())">✕ Cancelar</button>
    </div>
  </div>`;
  document.getElementById(`res-edit-${n}`)?.focus();
}

function saveResultSectionEdit(n) {
  const ta = document.getElementById(`res-edit-${n}`); if (!ta) return;
  const s = _loadStrat();
  if (!s.content) s.content = {};
  s.content[n] = ta.value;
  _saveStrat(s);
  toast('Conteúdo salvo!', 'ok');
  renderResultSection(n, s);
  updateResProgress(s);
}

async function generateAllSections() {
  const apiKey = localStorage.getItem('adgen_key') || '';
  if (!apiKey) { toast('Adicione sua API key primeiro.', 'warn'); return; }
  const btn = document.getElementById('res-gen-all-btn');
  const progressEl = document.getElementById('res-progress-label');
  if (btn) { btn.disabled = true; btn.textContent = 'Gerando…'; }
  for (const n of [2,3,4,5,6,7]) {
    const s = _loadStrat();
    if (!s.content?.[n]) {
      if (progressEl) progressEl.textContent = `Gerando seção ${n - 1} de 6…`;
      await genResultSection(n);
    }
  }
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1l1.5 4h4l-3 2.5 1.5 4L7 9l-4 2.5 1.5-4L1 5h4z" fill="currentColor"/></svg> Gerar Estratégia Completa`;
  }
  updateResProgress(_loadStrat());
}

// ── Etapa 1 — Questionnaire ──

const STRAT_OBJETIVOS = [
  { id:'seguidores', icon:'📈', label:'Crescer Seguidores',   desc:'Expandir alcance orgânico' },
  { id:'leads',      icon:'🎯', label:'Captar Leads',          desc:'Gerar contatos qualificados' },
  { id:'vendas',     icon:'💰', label:'Aumentar Vendas',       desc:'Conversão direta no Instagram' },
  { id:'autoridade', icon:'🏆', label:'Construir Autoridade',  desc:'Referência no nicho' },
  { id:'branding',   icon:'✨', label:'Fortalecer Marca',      desc:'Reconhecimento e posicionamento' },
];

function renderStratEtapa1(s) {
  const body = document.getElementById('strat-body-1'); if (!body) return;
  const etapa = document.getElementById('strat-etapa-1');
  const badge = document.getElementById('strat-badge-1');
  const num   = document.getElementById('strat-num-1');
  etapa.classList.remove('locked');

  const gotoBtn = document.getElementById('bf-goto-strat-btn');
  if (s.confirmed[1]) {
    badge.textContent = 'Confirmado'; badge.className = 'strat-badge strat-badge-confirmed';
    num.classList.add('done');
    if (gotoBtn) gotoBtn.style.display = 'inline-flex';
    body.innerHTML = _buildQ1Summary(s.q);
    return;
  }
  if (gotoBtn) gotoBtn.style.display = 'none';
  badge.textContent = s.q ? 'Preenchido' : 'Preencher';
  badge.className = s.q ? 'strat-badge strat-badge-done' : 'strat-badge strat-badge-pending';
  num.classList.remove('done');

  const q = s.q || {};
  const niche    = q.niche    || (ClientDB.load(state.brandName) || {}).niche || '';
  const services = q.services || (state.brandServices || []).join(', ') || '';
  const region   = q.region   || state.region || '';

  body.innerHTML = `<div class="strat-body">
  <p class="strat-etapa-desc">Preencha o briefing estratégico. As etapas seguintes usarão essas informações para gerar sua estratégia personalizada.</p>

  <p class="strat-section-title">Marca</p>
  <div class="strat-row2">
    <div class="strat-field"><label>Nicho / Setor</label><input type="text" id="sq-niche" value="${_se(niche)}" placeholder="ex: Nutrição esportiva, Advocacia trabalhista"></div>
    <div class="strat-field"><label>Cidade / Região</label><input type="text" id="sq-region" value="${_se(region)}" placeholder="ex: Cuiabá, MT"></div>
  </div>
  <div class="strat-field"><label>Principais serviços ou produtos</label><input type="text" id="sq-services" value="${_se(services)}" placeholder="ex: Consulta, Plano alimentar, Acompanhamento"><div class="strat-hint">Separe por vírgula</div></div>

  <p class="strat-section-title" style="margin-top:20px">Negócio</p>
  <div class="strat-field">
    <label>Ticket médio <span class="field-tip" data-tip="Valor médio que um cliente paga por compra ou por mês. Se você tiver vários produtos, use o mais vendido ou o principal.">?</span></label>
    <div class="btn-group" id="sq-ticket">${['Até R$100','R$100–500','R$500–2k','R$2k–5k','+R$5k'].map(v => `<button type="button" class="btn-group-btn${q.ticketMedio === v ? ' selected' : ''}" data-v="${_se(v)}">${v}</button>`).join('')}</div>
  </div>
  <div class="strat-field">
    <label>Posicionamento de preço <span class="field-tip" data-tip="Como sua marca se posiciona no mercado em relação ao preço. Premium = cobra mais e entrega diferencial percebido. Popular = volume e acessibilidade. Isso molda o tom e os argumentos dos anúncios.">?</span></label>
    <div class="btn-group" id="sq-posic-preco">${['Premium / Alto Valor','Intermediário','Popular / Acessível'].map(v => `<button type="button" class="btn-group-btn${q.posicPreco === v ? ' selected' : ''}" data-v="${_se(v)}">${v}</button>`).join('')}</div>
  </div>
  <div class="strat-field">
    <label>Onde a venda acontece <span class="field-tip" data-tip="Onde o cliente finaliza a compra depois de ver seu conteúdo. Pode selecionar mais de um.">?</span></label>
    <div class="btn-group" id="sq-onde-vende" data-multi="1">${['WhatsApp','DM Instagram','Site/Loja online','Loja física','Telefone'].map(v => `<button type="button" class="btn-group-btn${(q.ondeVende||[]).includes(v) ? ' selected' : ''}" data-v="${_se(v)}">${v}</button>`).join('')}</div>
  </div>
  <div class="strat-row2">
    <div class="strat-field">
      <label>Quem é seu cliente <span class="field-tip" data-tip="B2C = você vende para pessoas físicas (consumidor final). B2B = você vende para empresas. Isso muda completamente o tipo de conteúdo e o tom.">?</span></label>
      <div class="btn-group" id="sq-tipo-b2">${['B2C (pessoa física)','B2B (empresas)','Ambos'].map(v => `<button type="button" class="btn-group-btn${q.tipoB2 === v ? ' selected' : ''}" data-v="${_se(v)}">${v}</button>`).join('')}</div>
    </div>
    <div class="strat-field">
      <label>Abrangência</label>
      <div class="btn-group" id="sq-tipo-local">${['Local/Presencial','Online (Brasil)','Híbrido'].map(v => `<button type="button" class="btn-group-btn${q.tipoLocal === v ? ' selected' : ''}" data-v="${_se(v)}">${v}</button>`).join('')}</div>
    </div>
  </div>

  <p class="strat-section-title" style="margin-top:20px">Objetivo Principal</p>
  <div class="strat-obj-grid" id="sq-obj-grid">${STRAT_OBJETIVOS.map(o => `<button type="button" class="strat-obj-btn${q.objetivo === o.id ? ' selected' : ''}" data-obj="${o.id}"><span class="strat-obj-icon">${o.icon}</span><span class="strat-obj-label">${o.label}</span><span class="strat-obj-desc">${o.desc}</span></button>`).join('')}</div>
  <div class="strat-field" style="margin-top:12px"><label>Meta em 3 meses</label><input type="text" id="sq-meta" value="${_se(q.meta||'')}" placeholder="ex: Alcançar 5.000 seguidores e gerar 30 leads/mês"></div>

  <p class="strat-section-title" style="margin-top:20px">Concorrência e Diferencial</p>
  <div class="strat-field"><label>Concorrentes ou referências</label><input type="text" id="sq-concorrentes" value="${_se(q.concorrentes||'')}" placeholder="ex: @conta1, @conta2, Marca X"><div class="strat-hint">Cite 2–4 contas ou marcas</div></div>
  <div class="strat-field"><label>Referência de marca <span class="field-tip" data-tip="Qual marca — do seu setor ou de outro — você admira pela comunicação ou pelo visual? Ex: 'Nubank pela linguagem simples, Granado pelo estilo vintage'. Não precisa ser do mesmo nicho. A IA usa isso para calibrar o estilo.">?</span></label><input type="text" id="sq-ref-marca" value="${_se(q.refMarca||'')}" placeholder="ex: Nubank pela linguagem, Apple pela estética, @contaX pelo conteúdo"></div>
  <div class="strat-field"><label>Diferencial — complete a frase</label>
    <details class="strat-uvp-guide">
      <summary>💡 Como pensar neste diferencial?</summary>
      <div class="strat-uvp-guide-body">
        <div class="strat-uvp-step"><strong>[empresa/profissional]</strong> — O que você É. Ex: <em>nutricionista funcional, loja de moda plus size, advogado trabalhista</em></div>
        <div class="strat-uvp-step"><strong>[faz / entrega X]</strong> — O que você FAZ de diferente do mercado. Ex: <em>emagrece com prazer, veste corpos reais, resolve sem ir à Justiça</em></div>
        <div class="strat-uvp-step"><strong>[público-alvo]</strong> — Para QUEM exatamente. Ex: <em>mulheres acima de 35, mães de primeira viagem, pequenas empresas do interior</em></div>
        <div class="strat-uvp-step"><strong>[sem dor/objeção]</strong> — O que seu cliente mais teme ou quer evitar. Ex: <em>sem dieta restritiva, sem efeito sanfona, sem processos longos</em></div>
        <div class="strat-uvp-example">📝 Exemplo completo: "Somos a única <strong>nutricionista funcional</strong> que <strong>emagrece com prazer</strong> para <strong>mulheres 35+</strong> sem <strong>contar calorias</strong>."</div>
      </div>
    </details>
    <div class="madlib-wrap">Somos a única <input class="madlib-input" id="sq-dl1" value="${_se(q.dl1||'')}" placeholder="empresa/profissional" style="min-width:140px"> que <input class="madlib-input" id="sq-dl2" value="${_se(q.dl2||'')}" placeholder="faz / entrega X" style="min-width:150px"> para <input class="madlib-input" id="sq-dl3" value="${_se(q.dl3||'')}" placeholder="público-alvo" style="min-width:120px"> sem <input class="madlib-input" id="sq-dl4" value="${_se(q.dl4||'')}" placeholder="dor / objeção" style="min-width:130px">.</div>
  </div>

  <p class="strat-section-title" style="margin-top:20px">Diagnóstico Atual</p>
  <div class="strat-field"><label>Posts por semana atualmente</label><div class="btn-group" id="sq-posts-atual">${['0–1','2–3','4–5','6–7','7+'].map(v => `<button type="button" class="btn-group-btn${q.postsAtual === v ? ' selected' : ''}" data-v="${v}">${v}</button>`).join('')}</div></div>
  <div class="strat-field"><label>Taxa de engajamento estimada <span class="field-tip" data-tip="Engajamento = (curtidas + comentários + salvamentos) ÷ seguidores × 100. Se não souber, veja nas métricas do Instagram ou escolha 'Não sei'.">?</span></label><div class="btn-group" id="sq-eng">${['<1%','1–3%','3–6%','>6%','Não sei'].map(v => `<button type="button" class="btn-group-btn${q.engajamento === v ? ' selected' : ''}" data-v="${_se(v)}">${v}</button>`).join('')}</div></div>
  <div class="strat-field"><label>Investimento em tráfego pago</label><div class="btn-group" id="sq-trafego">${['Nenhum','Até R$500/mês','R$500–2000/mês','+R$2000/mês'].map(v => `<button type="button" class="btn-group-btn${q.trafegoPago === v ? ' selected' : ''}" data-v="${_se(v)}">${v}</button>`).join('')}</div></div>
  <div class="strat-field">
    <label>Maior dificuldade atual <span class="field-tip" data-tip="Escolha o problema que mais te trava hoje no Instagram. Isso direciona toda a estratégia gerada.">?</span></label>
    <div class="btn-group" id="sq-dificuldade">${['Não sei o que postar','Posto mas não converto','Crescimento travado','Sem tempo para produzir','Baixo engajamento'].map(v => `<button type="button" class="btn-group-btn${q.dificuldade === v ? ' selected' : ''}" data-v="${_se(v)}">${v}</button>`).join('')}</div>
  </div>
  <div class="strat-field">
    <label>O que já funcionou <span class="field-tip" data-tip="Algum post gerou muitos salvamentos, DMs ou comentários? Descreva o tipo de conteúdo. A IA vai dobrar o que já funciona. Se não sabe, deixe em branco.">?</span></label>
    <input type="text" id="sq-funcionou" value="${_se(q.oQueFuncionou||'')}" placeholder="ex: Reels com dicas rápidas, posts de antes e depois, bastidores">
  </div>

  <p class="strat-section-title" style="margin-top:20px">Produção de Conteúdo</p>
  <div class="strat-row2">
    <div class="strat-field">
      <label>Quem produz o conteúdo <span class="field-tip" data-tip="A frequência e o tipo de conteúdo recomendados serão adaptados à sua capacidade real de produção.">?</span></label>
      <div class="btn-group" id="sq-capacidade">${['Eu mesmo(a)','Com equipe','Terceirizo'].map(v => `<button type="button" class="btn-group-btn${q.capacidade === v ? ' selected' : ''}" data-v="${_se(v)}">${v}</button>`).join('')}</div>
    </div>
    <div class="strat-field">
      <label>Tempo disponível por dia</label>
      <div class="btn-group" id="sq-tempo-dia">${['<1h','1–2h','3–4h','+4h'].map(v => `<button type="button" class="btn-group-btn${q.tempoDia === v ? ' selected' : ''}" data-v="${_se(v)}">${v}</button>`).join('')}</div>
    </div>
  </div>

  <div class="strat-action-row"><button type="button" class="strat-save-q-btn" onclick="saveStratQ()">Salvar e continuar →</button></div>
</div>`;

  body.querySelectorAll('.btn-group').forEach(grp => {
    grp.addEventListener('click', e => {
      const btn = e.target.closest('.btn-group-btn'); if (!btn) return;
      if (grp.dataset.multi) {
        btn.classList.toggle('selected');
      } else {
        grp.querySelectorAll('.btn-group-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      }
    });
  });
  document.getElementById('sq-obj-grid').addEventListener('click', e => {
    const btn = e.target.closest('.strat-obj-btn'); if (!btn) return;
    body.querySelectorAll('.strat-obj-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });
  body.querySelectorAll('.field-tip').forEach(tip => {
    tip.addEventListener('click', e => {
      e.stopPropagation();
      const wasOpen = tip.classList.contains('tip-open');
      body.querySelectorAll('.field-tip.tip-open').forEach(t => t.classList.remove('tip-open'));
      if (!wasOpen) tip.classList.add('tip-open');
    });
  });
}

function _buildQ1Summary(q) {
  if (!q) return '<div class="strat-body"><p style="color:var(--text-dim);font-size:13px">Questionário não preenchido.</p></div>';
  const obj = STRAT_OBJETIVOS.find(o => o.id === q.objetivo);
  const positioning = [q.niche, q.tipoB2, q.tipoLocal].filter(Boolean).join(' · ') || '—';
  const hasDif = q.dl1 && q.dl2 && q.dl3 && q.dl4;
  const tags = [
    q.posicPreco, q.ticketMedio, obj ? obj.icon + ' ' + obj.label : null,
  ].filter(Boolean).map(t => `<span class="strat-brand-card-tag">${_se(t)}</span>`).join('');
  const brandCard = `<div class="strat-brand-card">
    <div class="strat-brand-card-title">📊 Perfil da Marca</div>
    <div class="strat-brand-card-positioning">${_se(positioning)}</div>
    ${hasDif ? `<div class="strat-brand-card-uvp">Somos a única ${_se(q.dl1)} que ${_se(q.dl2)} para ${_se(q.dl3)} sem ${_se(q.dl4)}.</div>` : ''}
    ${tags ? `<div class="strat-brand-card-tags">${tags}</div>` : ''}
  </div>`;
  return `<div class="strat-body">${brandCard}<div class="strat-generated">
    <p><strong>Nicho:</strong> ${_se(q.niche||'—')} &nbsp;|&nbsp; <strong>Região:</strong> ${_se(q.region||'—')}</p>
    <p><strong>Serviços:</strong> ${_se(q.services||'—')}</p>
    <p><strong>Negócio:</strong> ${_se(q.tipoB2||'—')} | ${_se(q.tipoLocal||'—')} | Ticket: ${_se(q.ticketMedio||'—')} | ${_se(q.posicPreco||'—')}</p>
    <p><strong>Venda via:</strong> ${_se((q.ondeVende||[]).join(', ')||'—')}</p>
    <p><strong>Objetivo:</strong> ${obj ? obj.icon + ' ' + obj.label : _se(q.objetivo||'—')} &nbsp;|&nbsp; <strong>Meta:</strong> ${_se(q.meta||'—')}</p>
    <p><strong>Diferencial:</strong> Somos a única ${_se(q.dl1||'…')} que ${_se(q.dl2||'…')} para ${_se(q.dl3||'…')} sem ${_se(q.dl4||'…')}.</p>
    <p><strong>Concorrentes:</strong> ${_se(q.concorrentes||'—')}${q.refMarca ? ` &nbsp;|&nbsp; <strong>Referência:</strong> ${_se(q.refMarca)}` : ''}</p>
    <p><strong>Posts/sem atual:</strong> ${_se(q.postsAtual||'—')} &nbsp;|&nbsp; <strong>Engajamento:</strong> ${_se(q.engajamento||'—')} &nbsp;|&nbsp; <strong>Tráfego pago:</strong> ${_se(q.trafegoPago||'—')}</p>
    <p><strong>Dificuldade:</strong> ${_se(q.dificuldade||'—')}${q.oQueFuncionou ? ` &nbsp;|&nbsp; <strong>Já funcionou:</strong> ${_se(q.oQueFuncionou)}` : ''}</p>
    <p><strong>Produção:</strong> ${_se(q.capacidade||'—')}, ${_se(q.tempoDia||'—')}/dia &nbsp;|&nbsp; <span style="color:var(--text-dim)">Tom será recomendado pela IA</span></p>
    <p style="color:var(--text-dim);font-size:12px">📊 Frequência e estratégia completa disponíveis na seção Estratégia</p>
  </div><div class="strat-action-row"><button type="button" class="strat-generate-btn" onclick="showStrategyResultsView()">📊 Ver Estratégia →</button><button type="button" class="strat-regen-btn" onclick="editStratQ()">✏ Editar Briefing</button></div></div>`;
}

function saveStratQ() {
  const gv = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const gs = id => { const el = document.getElementById(id); if (!el) return ''; const s = el.querySelector('.selected'); return s ? s.dataset.v : ''; };
  const gm = id => { const el = document.getElementById(id); if (!el) return []; return [...el.querySelectorAll('.btn-group-btn.selected')].map(b => b.dataset.v); };
  const objEl = document.querySelector('#sq-obj-grid .selected');
  const q = {
    niche: gv('sq-niche'), region: gv('sq-region'), services: gv('sq-services'),
    objetivo: objEl ? objEl.dataset.obj : '', meta: gv('sq-meta'),
    concorrentes: gv('sq-concorrentes'),
    dl1: gv('sq-dl1'), dl2: gv('sq-dl2'), dl3: gv('sq-dl3'), dl4: gv('sq-dl4'),
    postsAtual: gs('sq-posts-atual'), engajamento: gs('sq-eng'), trafegoPago: gs('sq-trafego'),
    ticketMedio: gs('sq-ticket'), ondeVende: gm('sq-onde-vende'),
    tipoB2: gs('sq-tipo-b2'), tipoLocal: gs('sq-tipo-local'),
    dificuldade: gs('sq-dificuldade'), oQueFuncionou: gv('sq-funcionou'),
    posicPreco: gs('sq-posic-preco'), refMarca: gv('sq-ref-marca'),
    capacidade: gs('sq-capacidade'), tempoDia: gs('sq-tempo-dia'),
  };
  const s = _loadStrat();
  s.q = q; s.confirmed[1] = true;
  _saveStrat(s);
  toast('Briefing salvo!', 'ok');
  updateStratProgress(s);
  renderStratEtapa1(s);
  const bf3 = document.getElementById('bf-step3');
  if (bf3) { bf3.className = 'flow-step fs-next'; bf3.onclick = showStrategyResultsView; }
  const bfBtn = document.getElementById('bf-goto-strat-btn');
  if (bfBtn) bfBtn.style.display = 'inline-flex';
}

function editStratQ() {
  const s = _loadStrat();
  s.confirmed[1] = false;
  _saveStrat(s);
  updateStratProgress(s);
  renderStratEtapa1(s);
}

// ── Strategy Context & Prompts ──

function _buildStratContext(s) {
  const q = s.q || {};
  const personas = state.personas.length
    ? state.personas.map((p, i) =>
        `${i+1}. ${p.name}${p.ageRange ? ` (${p.ageRange})` : ''}`
        + (p.interests?.length ? `: interesses em ${p.interests.slice(0,3).join(', ')}` : '')
        + (p.painPoints?.length ? ` / dores: ${p.painPoints.slice(0,2).join(', ')}` : '')
      ).join('\n')
    : '(não definidas)';
  const dif = q.dl1 ? `Somos a única ${q.dl1} que ${q.dl2} para ${q.dl3} sem ${q.dl4}` : '(não definido)';
  return `CLIENTE: ${state.brandName||'—'}
NICHO: ${q.niche||'—'}
SERVIÇOS: ${q.services||(state.brandServices||[]).join(', ')||'—'}
REGIÃO: ${q.region||state.region||'Brasil'}
OBJETIVO: ${STRAT_OBJETIVOS.find(o => o.id === q.objetivo)?.label || q.objetivo || '—'}
META 3 MESES: ${q.meta||'—'}
DIFERENCIAL: ${dif}
CONCORRENTES: ${q.concorrentes||'—'}
PERSONAS:\n${personas}
TIPO DE NEGÓCIO: ${q.tipoB2||'—'} | ${q.tipoLocal||'—'}
TICKET MÉDIO: ${q.ticketMedio||'—'}
ONDE VENDE: ${(q.ondeVende||[]).join(', ')||'—'}
POSTS ATUAIS/SEM: ${q.postsAtual||'—'} | ENGAJAMENTO: ${q.engajamento||'—'} | TRÁFEGO PAGO: ${q.trafegoPago||'—'}
MAIOR DIFICULDADE: ${q.dificuldade||'—'}
O QUE JÁ FUNCIONOU: ${q.oQueFuncionou||'—'}
POSICIONAMENTO DE PREÇO: ${q.posicPreco||'—'}
REFERÊNCIA DE MARCA: ${q.refMarca||'—'}
TOM DE VOZ: a ser definido pela IA com base no nicho, público, posicionamento e objetivo
CAPACIDADE DE PRODUÇÃO: ${q.capacidade||'—'}, ${q.tempoDia||'—'} por dia
FREQUÊNCIA IDEAL: a ser recomendada pela IA com base no perfil e objetivo`;
}

function _buildStratPrompt(n, s) {
  const ctx = _buildStratContext(s);
  const prev = (n > 2 && s.content?.[n-1]) ? `\n\nRESUMO DA ETAPA ${n-1}:\n${s.content[n-1].slice(0,800)}…` : '';
  const prompts = {
    2: `Você é consultor de branding estratégico especializado em negócios brasileiros. Crie a identidade de marca com base no briefing.

BRIEFING:
${ctx}

Responda APENAS com markdown nas seções abaixo. Seja específico para este cliente.

## Golden Circle
**Por quê** (propósito profundo — razão de existir além do lucro):
**Como** (abordagem única — o que diferencia a forma de trabalhar):
**O quê** (produtos e serviços concretos):

## Arquétipo da Marca
**Arquétipo principal**: [nome] — *[1 frase explicando por quê]*
**Arquétipo secundário**: [nome] — *[1 frase]*
**Como isso aparece no conteúdo**: [2-3 exemplos de tom, visual e linguagem]

## Declaração de Posicionamento
> Para [público-alvo específico] que [necessidade real], [marca] é [categoria] que [diferencial único] porque [prova ou razão de crer].

## Taglines Sugeridas
1. [foco no benefício]
2. [foco no diferencial]
3. [foco emocional]

## Manifesto da Marca
[4-6 linhas na voz da marca — imperativo, inspirador, direto]`,

    3: `Você é analista de inteligência competitiva especializado em mercados locais brasileiros.

BRIEFING:
${ctx}${prev}

Responda APENAS com markdown nas seções abaixo.

## Análise dos Concorrentes
Para cada concorrente (ou os mais prováveis no nicho): posicionamento, pontos fortes, pontos fracos, gap que deixam.

## Oportunidades de Diferenciação
5 gaps específicos e acionáveis. Para cada um: como explorar em 1 frase.

## Análise SWOT

| Dimensão | Fatores |
|---|---|
| **Forças** | [3-4 forças internas reais] |
| **Fraquezas** | [2-3 fraquezas honestas] |
| **Oportunidades** | [3-4 oportunidades externas] |
| **Ameaças** | [2-3 ameaças externas] |

## Vantagem Competitiva Principal
[1 parágrafo específico: onde esta marca pode genuinamente ganhar e por quê]`,

    4: `Você é especialista em jornada do cliente e conversão para negócios no Instagram.

BRIEFING:
${ctx}${prev}

Responda APENAS com markdown nas seções abaixo.

## Jornada do Cliente
**Fase 1 — Descoberta (Topo)**: [quem é o cliente nesta fase, dores, tipo de conteúdo que o atrai]
**Fase 2 — Consideração (Meio)**: [o que busca, objeções, tipo de conteúdo que convence]
**Fase 3 — Decisão (Fundo)**: [o que falta para decidir, tipo de conteúdo que converte]

## Funil de Conteúdo

| Fase | % do Conteúdo | Tipos de Post | Objetivo |
|---|---|---|---|
| Topo | ~40% | [tipos] | [objetivo] |
| Meio | ~40% | [tipos] | [objetivo] |
| Fundo | ~20% | [tipos] | [objetivo] |

## Captação de Leads
[Mecanismos específicos: lead magnet, link na bio, DM, stories com CTA — específico para o nicho.]

## Principais Objeções e Como Quebrar
[5 objeções mais comuns + conteúdo ou argumento que quebra cada uma]

## Estratégia de Fidelização
[3-4 ações concretas para transformar seguidores em clientes recorrentes]`,

    5: `Você é estrategista digital especialista em crescimento no Instagram, com foco em alcance orgânico e viralização para negócios brasileiros.

BRIEFING:
${ctx}${prev}

Analise o perfil e o objetivo. Seja direto, estratégico e focado em crescimento rápido.
Responda APENAS com markdown nas seções abaixo.

## Frequência Recomendada
**Posts por semana**: [número exato com justificativa]
**Divisão por formato**: [X Reels + Y Carrosséis + Z Posts estáticos/semana]
**Por quê essa frequência**: [argumento direto baseado no objetivo e situação atual]

## Pilares de Conteúdo
5-6 pilares. Para cada: nome, o que cobre, 2 exemplos reais de post com ângulo viral.

## Reels com Alto Potencial de Alcance
5 ideias de Reels específicas para este nicho. Para cada:
- **Hook (0–3s)**: [frase exata que para o scroll — curiosidade, controvérsia ou impacto]
- **Estrutura**: [duração + ritmo + o que mostrar]
- **Por quê vai viralizar**: [gatilho psicológico ou tendência que aproveita]

## 10 Ganchos Virais
Hooks para os primeiros 3 segundos (texto na tela ou fala). Menos de 10 palavras cada. Use curiosidade, controvérsia ou impacto. Específicos para este nicho.

## Formatos Priorizados pelo Algoritmo
[Quais formatos o Instagram prioriza atualmente + como este negócio deve usá-los na prática]

## Mix Semanal Modelo
Baseado na frequência recomendada acima:

| Dia | Formato | Pilar | Hook inicial |
|---|---|---|---|
[preencher todos os dias com posts — semana completa]

## Tom de Voz
**Palavras frequentes**: [lista]
**Palavras a evitar**: [lista]
**Como a marca fala**: [formal/informal, técnico/simples — com exemplos]
**Exemplo de abertura de caption**: [2 aberturas reais prontas para usar]

## Banco de CTAs
10 CTAs específicos para este nicho, divididos por objetivo: salvar, comentar, compartilhar, DM, link na bio.

## Estratégia de Engajamento
Foco em comentários, salvamentos e compartilhamentos — os sinais que o algoritmo mais valoriza:
[5 táticas concretas com instruções de execução]`,

    6: `Você é consultor de crescimento do Instagram especializado em execução e resultados mensuráveis para negócios brasileiros.

BRIEFING:
${ctx}${prev}

Seja direto e focado em ação. Responda APENAS com markdown nas seções abaixo.

## Plano de Execução Simples
O que, como e quando postar para maximizar alcance e consistência:

| Dia da semana | O que postar | Como produzir | Melhor horário |
|---|---|---|---|
[semana completa — todos os dias]

## 3 Roteiros Prontos para Reels
Roteiros curtos e diretos para adaptar, específicos para este nicho:

**Roteiro 1**
- Hook (0–3s): [texto exato]
- Corpo (3–30s): [desenvolvimento em tópicos]
- CTA final: [instrução direta]

**Roteiro 2**
- Hook (0–3s): [texto exato]
- Corpo (3–30s): [desenvolvimento em tópicos]
- CTA final: [instrução direta]

**Roteiro 3**
- Hook (0–3s): [texto exato]
- Corpo (3–30s): [desenvolvimento em tópicos]
- CTA final: [instrução direta]

## Melhorias de Posicionamento
5 mudanças concretas e imediatas para aumentar autoridade e atrair seguidores qualificados — bio, destaques, consistência visual, linguagem.

## Como Usar Prova Social
[5 formas com formatos, frequência e script de solicitação de depoimento — específico para este nicho]

## Estratégia de Hashtags
**Grupo 1 — Nicho**: [8-10 hashtags]
**Grupo 2 — Local / Regional**: [5-7 hashtags para a região]
**Grupo 3 — Branded**: [3-5 sugestões exclusivas da marca]
*Como alternar*: [dica de rotação e uso]

## Plano de 30 Dias (Foco em Crescimento)

| Semana | Foco | Meta de Alcance | Ações Prioritárias |
|---|---|---|---|
| Semana 1 | [tema] | [meta visualizações] | [3-4 ações concretas] |
| Semana 2 | [tema] | [meta visualizações] | [3-4 ações concretas] |
| Semana 3 | [tema] | [meta visualizações] | [3-4 ações concretas] |
| Semana 4 | [tema] | [meta visualizações] | [3-4 ações concretas] |

## KPIs e Metas

| Métrica | Atual | Meta 30 dias | Meta 90 dias |
|---|---|---|---|
| Seguidores | — | +X% | +X% |
| Visualizações/post | — | [meta] | [meta] |
| Engajamento | ${s.q?.engajamento||'—'} | [meta] | [meta] |
| Posts/semana | ${s.q?.postsAtual||'—'} | [recomendado pela IA] | [recomendado pela IA] |
| Leads/mês | — | [meta] | [meta] |

## Checklist Semanal
[12 itens específicos e acionáveis para este negócio]`,

    7: `Você é estrategista de crescimento para negócios no Instagram com foco em resultados sustentáveis a longo prazo.

BRIEFING:
${ctx}${prev}

Seja ambicioso mas realista. Responda APENAS com markdown nas seções abaixo.

## Roadmap de 6 Meses

| Mês | Fase | Foco | Meta mensurável |
|---|---|---|---|
| Mês 1 | Fundação | [foco] | [meta] |
| Mês 2 | Aquecimento | [foco] | [meta] |
| Mês 3 | Crescimento | [foco] | [meta] |
| Mês 4 | Consolidação | [foco] | [meta] |
| Mês 5 | Escala | [foco] | [meta] |
| Mês 6 | Autoridade | [foco] | [meta] |

## Marcos de Crescimento
6 marcos específicos, mensuráveis e realistas para este negócio. Para cada: o que alcançar, quando, e como saber que chegou lá.

## Evolução da Estratégia de Conteúdo
Como o conteúdo deve evoluir ao longo dos 6 meses: profundidade, formatos, tom, frequência, temas e complexidade técnica. Seja específico para este nicho.

## Diversificação de Canais
Quando e como expandir além do feed do Instagram — Stories, WhatsApp Business, YouTube Shorts, Threads, e-mail, etc. Ordem de prioridade para este perfil com justificativa.

## Estratégia de Monetização a Longo Prazo
Como aumentar ticket médio, criar recorrência e expandir o funil após os primeiros 6 meses. Específico para o modelo de negócio deste cliente.

## OKRs — Objetivos e Resultados-Chave

| Objetivo | Resultado-Chave 1 | Resultado-Chave 2 | Resultado-Chave 3 |
|---|---|---|---|
[3-4 objetivos estratégicos com KRs mensuráveis]

## Sinais de Alerta
5 indicadores de que a estratégia precisa ser revisada — o que monitorar mês a mês para detectar desvios antes que se tornem problemas.`,
  };
  return prompts[n] || '';
}

async function genStratPersonas() {
  const apiKey = localStorage.getItem('adgen_key') || '';
  if (!apiKey) { toast('Adicione sua API key primeiro.', 'warn'); return; }
  const s = _loadStrat();
  const ctx = _buildStratContext(s);
  const pub = s.content?.[4] ? s.content[4].slice(0, 1500) : '';
  const mer = s.content?.[3] ? s.content[3].slice(0, 800) : '';
  if (!pub) { toast('Gere a seção Público & Conversão antes de criar personas.', 'warn'); return; }

  toast('Criando personas com IA…', 'ok');

  const prompt = `Você é especialista em pesquisa de personas para marketing digital no Instagram.

Com base na estratégia completa abaixo, crie EXATAMENTE 3 personas detalhadas e distintas para este negócio.

BRIEFING:
${ctx}
${mer ? `\nANÁLISE DE MERCADO:\n${mer}` : ''}

ANÁLISE DE PÚBLICO E CONVERSÃO:
${pub}

Retorne APENAS um JSON array. Sem markdown, sem explicação, sem texto extra.
[
  {
    "name": "Nome representativo (ex: Ana, a Empreendedora)",
    "ageRange": "25–35",
    "trait": "Uma frase curta que captura a essência desta persona",
    "interests": ["interesse 1", "interesse 2", "interesse 3", "interesse 4"],
    "painPoints": ["dor principal", "segunda dor"]
  }
]`;

  try {
    const data = await callGemini(apiKey, {
      contents: [{ role:'user', parts:[{ text: prompt }] }],
      generationConfig: { temperature:0.7, maxOutputTokens:1024 },
    });
    const usage = data.usageMetadata || {};
    state.totalCost += (usage.promptTokenCount||0)*COST_IN_TOKEN + (usage.candidatesTokenCount||0)*COST_OUT_TOKEN;
    refreshCost();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = JSON.parse(raw.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim());
    if (!Array.isArray(parsed) || !parsed.length) throw new Error('Resposta inválida');

    state.personas = parsed.map(p => ({
      id: uid(),
      name: p.name || '',
      ageRange: p.ageRange || '',
      trait: p.trait || '',
      interests: Array.isArray(p.interests) ? p.interests : [],
      painPoints: Array.isArray(p.painPoints) ? p.painPoints : [],
    }));
    renderPersonas();
    renderPersonaFocus();
    if (state.brandName) {
      const db = ClientDB.load(state.brandName) || {};
      ClientDB.save(state.brandName, { ...db, personas: state.personas });
    }
    toast(`${state.personas.length} personas criadas e salvas no perfil!`, 'ok');
  } catch (err) {
    toast(`Erro ao criar personas: ${err.message}`, 'err');
  }
}

function exportStrategy() {
  const s = _loadStrat();
  const q = s.q || {};
  const lines = [
    `# Estratégia de Marketing — ${state.brandName||'Cliente'}`,
    `*Gerado em ${new Date().toLocaleDateString('pt-BR')}*`,
    '', '---', '',
    '## Briefing',
    `- **Nicho:** ${q.niche||'—'}`,
    `- **Região:** ${q.region||'—'}`,
    `- **Serviços:** ${q.services||'—'}`,
    `- **Objetivo:** ${STRAT_OBJETIVOS.find(o => o.id === q.objetivo)?.label || q.objetivo || '—'}`,
    `- **Meta 3 meses:** ${q.meta||'—'}`,
    `- **Diferencial:** Somos a única ${q.dl1||'…'} que ${q.dl2||'…'} para ${q.dl3||'…'} sem ${q.dl4||'…'}.`,
    `- **Posicionamento:** ${q.posicPreco||'—'} · Ticket: ${q.ticketMedio||'—'}`,
    `- **Concorrentes:** ${q.concorrentes||'—'}`,
    '',
  ];
  RES_SECTIONS.forEach(sec => {
    if (s.content?.[sec.n]) lines.push('---', '', `## ${sec.n - 1}. ${sec.title}`, '', s.content[sec.n], '');
  });
  const blob = new Blob([lines.join('\n')], { type:'text/markdown' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `estrategia-${(state.brandName||'cliente').toLowerCase().replace(/\s+/g,'-')}.md`;
  a.click(); URL.revokeObjectURL(url);
  toast('Estratégia exportada!', 'ok');
}

async function exportStrategyPDF() {
  const apiKey = localStorage.getItem('adgen_key') || '';
  if (!apiKey) { toast('Adicione sua API key primeiro.', 'warn'); return; }
  const s = _loadStrat();
  if (!s.confirmed?.[1]) { toast('Complete o Briefing antes de salvar o PDF.', 'warn'); return; }

  const btn = document.getElementById('btn-pdf');
  const orig = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Gerando carta…'; }

  try {
    const ctx = _buildStratContext(s);
    const secsSummary = RES_SECTIONS
      .filter(sec => s.content?.[sec.n])
      .map(sec => `## ${sec.title}\n${s.content[sec.n].slice(0, 600)}`)
      .join('\n\n---\n\n');

    const letterPrompt = `Você é um consultor de marketing digital especialista em Instagram para negócios brasileiros. Com base no briefing e na estratégia completa abaixo, escreva uma CARTA DE DIRECIONAMENTO personalizada para o cliente.

BRIEFING:
${ctx}

ESTRATÉGIA (resumo):
${secsSummary.slice(0, 2800)}

A carta deve:
- Ser escrita em primeira pessoa do plural ("analisamos", "recomendamos", "identificamos")
- Tom: especialista, direto e acessível — sem jargão técnico
- Começar com um diagnóstico honesto e preciso da situação atual do cliente
- Apresentar 4-5 prioridades numeradas com explicação clara do PORQUÊ de cada uma
- Incluir um plano de ação para as próximas 4 semanas (Semana 1, Semana 2, Semana 3, Semana 4)
- Terminar com uma mensagem motivacional objetiva
- Extensão: 480-600 palavras
- Sem formatação markdown — texto corrido com parágrafos separados por linha em branco

Escreva a carta completa:`;

    const letterData = await callGemini(apiKey, {
      contents: [{ role:'user', parts:[{ text: letterPrompt }] }],
      generationConfig: { temperature: 0.65, maxOutputTokens: 1400 },
    });
    const letter = letterData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    _openPdfWindow(s, letter);
    toast('PDF pronto — use Ctrl+P (ou ⌘+P) para salvar.', 'ok');
  } catch(err) {
    toast('Erro ao gerar PDF: ' + err.message, 'err');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = orig; }
  }
}

function _openPdfWindow(s, letter) {
  const q = s.q || {};
  const brand = state.brandName || 'Cliente';
  const date = new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' });
  const obj = STRAT_OBJETIVOS.find(o => o.id === q.objetivo)?.label || q.objetivo || '—';
  const dif = q.dl1 ? `Somos a única ${q.dl1} que ${q.dl2} para ${q.dl3} sem ${q.dl4}.` : '';

  const secHtml = RES_SECTIONS.map(sec => {
    const content = s.content?.[sec.n];
    if (!content) return '';
    return `<div class="ps"><div class="ps-hdr"><span class="ps-num">${sec.n - 1}</span><div><div class="ps-title">${_se(sec.title)}</div><div class="ps-sub">${_se(sec.sub)}</div></div></div><div class="ps-body">${renderMd(content)}</div></div>`;
  }).filter(Boolean).join('');

  const briefHtml = `<div class="pb"><div class="pb-label">Resumo do Briefing</div><table class="pb-tbl"><tr><td>Nicho</td><td>${_se(q.niche||'—')}</td><td>Região</td><td>${_se(q.region||state.region||'—')}</td></tr><tr><td>Serviços</td><td colspan="3">${_se(q.services||'—')}</td></tr><tr><td>Objetivo</td><td>${_se(obj)}</td><td>Ticket</td><td>${_se(q.ticketMedio||'—')}</td></tr><tr><td>Meta 3 meses</td><td colspan="3">${_se(q.meta||'—')}</td></tr>${dif?`<tr><td>Diferencial</td><td colspan="3" style="font-style:italic">${_se(dif)}</td></tr>`:''}</table></div>`;

  const letterHtml = letter ? `<div class="pl"><div class="pl-label">Carta de Direcionamento</div><div class="pl-body"><p>${letter.replace(/\n\n+/g,'</p><p>').replace(/\n/g,'<br>')}</p></div><div class="pl-sig">Equipe NZRK &nbsp;·&nbsp; ${date}</div></div>` : '';

  const w = window.open('', '_blank', 'width=960,height=720');
  if (!w) { toast('Permita pop-ups para gerar o PDF.', 'warn'); return; }
  w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Estratégia — ${_se(brand)}</title><style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Georgia,serif;color:#1a1a2e;background:#fff;line-height:1.7;font-size:13px}
.cover{padding:56px 52px 36px;border-bottom:4px solid #6C3CE1}
.cover-brand{font-size:32px;font-weight:700;color:#6C3CE1;letter-spacing:-.5px}
.cover-title{font-size:16px;color:#444;margin-top:7px}
.cover-date{color:#aaa;font-size:11px;margin-top:6px;font-family:Arial,sans-serif}
.pb{padding:18px 52px;background:#f7f4ff;border-bottom:1px solid #ddd6ff}
.pb-label{font-size:9px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#6C3CE1;margin-bottom:10px;font-family:Arial,sans-serif}
.pb-tbl{width:100%;border-collapse:collapse;font-size:12px}
.pb-tbl td{padding:4px 8px;vertical-align:top}
.pb-tbl td:first-child,.pb-tbl td:nth-child(3){font-weight:600;color:#555;width:110px}
.ps{padding:28px 52px;border-bottom:1px solid #eee}
.ps-hdr{display:flex;align-items:flex-start;gap:14px;margin-bottom:16px}
.ps-num{width:34px;height:34px;min-width:34px;border-radius:50%;background:#f0ebff;border:2px solid #6C3CE1;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#6C3CE1;font-family:Arial,sans-serif}
.ps-title{font-size:15px;font-weight:700;color:#1a1a2e}
.ps-sub{font-size:10px;color:#999;margin-top:2px;font-family:Arial,sans-serif}
.ps-body h2{font-size:10px;font-weight:700;color:#6C3CE1;text-transform:uppercase;letter-spacing:.1em;margin:18px 0 7px;padding-bottom:5px;border-bottom:1px solid #e0d8ff;font-family:Arial,sans-serif}
.ps-body h2:first-child{margin-top:0}
.ps-body h3{font-size:13px;font-weight:700;color:#2a1a5e;margin:12px 0 5px}
.ps-body p{margin-bottom:8px;color:#333}
.ps-body ul,.ps-body ol{padding-left:20px;margin-bottom:8px}
.ps-body li{margin-bottom:3px;color:#333}
.ps-body strong{color:#1a1a2e;font-weight:700}
.ps-body em{font-style:italic;color:#555}
.ps-body blockquote{border-left:3px solid #6C3CE1;padding:6px 14px;margin:10px 0;color:#444;font-style:italic;background:#f9f7ff}
.ps-body table{width:100%;border-collapse:collapse;margin:10px 0;font-size:12px}
.ps-body th{background:#f0ebff;color:#6C3CE1;padding:7px 10px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.08em;border-bottom:2px solid #d8cfff;font-family:Arial,sans-serif}
.ps-body td{padding:7px 10px;border-bottom:1px solid #eee;color:#333}
.ps-body code{font-family:monospace;background:#f0ebff;padding:1px 5px;border-radius:3px;font-size:12px;color:#5b21b6}
.pl{padding:44px 52px}
.pl-label{font-size:9px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#6C3CE1;margin-bottom:22px;font-family:Arial,sans-serif}
.pl-body{font-size:13.5px;line-height:1.85;color:#222}
.pl-body p{margin-bottom:14px}
.pl-sig{margin-top:36px;font-size:11px;color:#aaa;font-family:Arial,sans-serif}
@media print{@page{margin:14mm 18mm;size:A4}body{font-size:12px}.ps{page-break-inside:avoid}.pl{page-break-before:always}}
</style></head><body>
<div class="cover"><div class="cover-brand">${_se(brand)}</div><div class="cover-title">Estratégia de Marketing Digital · Instagram</div><div class="cover-date">Gerado em ${date}</div></div>
${briefHtml}
${secHtml}
${letterHtml}
<script>window.onload=function(){window.focus();window.print();}<\/script>
</body></html>`);
  w.document.close();
}

init();
