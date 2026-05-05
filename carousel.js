'use strict';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const API_BASE    = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL       = 'gemini-3.1-flash-image-preview';

const COST_IMG_FIXED   = 0.10;
const COST_IN_TOKEN    = 0.000000075;
const COST_OUT_TOKEN   = 0.0000003;

const SLIDE_TYPES = [
  { id: 'hero',     label: 'Hero',          desc: 'Hook de abertura que prende atenção' },
  { id: 'problema', label: 'Problema',      desc: 'A dor principal do público' },
  { id: 'solucao',  label: 'Solução',       desc: 'A solução oferecida' },
  { id: 'aprende',  label: 'O que aprende', desc: 'O que o leitor ganha ou aprende' },
  { id: 'funciona', label: 'Como funciona', desc: 'Mecanismo ou passo a passo' },
  { id: 'prova',    label: 'Prova social',  desc: 'Resultado, dado ou depoimento' },
  { id: 'cta',      label: 'CTA',           desc: 'Chamada para ação clara' },
];

const BUILTIN_MODIFIERS = {
  'nazarko-engenharia': 'Deep engineering brand aesthetic built on dark backgrounds (#0D0E12, #1A1F2E), with rich cobalt blue (#1F4788) and electric azure (#4A90E2) as structural colors, and energetic orange (#F39C12) as focal accent. Typography pairs bold geometric Roboto headlines with IBM Plex Mono monospaced technical labels, conveying precision and data clarity. Photography direction: dramatic low-angle shots of construction sites, structural blueprints, and field details under high-contrast directional lighting. Glassmorphism overlays used sparingly on dark surfaces. Mood: authoritative, precise, field-ready — regional Brazilian engineering with modern technical confidence.',
};

// ─── STATE ───────────────────────────────────────────────────────────────────

const state = {
  slides:           [],
  caption:          '',
  currentSlide:     0,
  totalCost:        0,
  generating:       false,
  slideCount:       7,
  region:           'Rondônia (RO), Brasil',
  ideaMode:         'manual',    // 'manual' | 'ideas'
  selectedIdea:     '',
  imageSource:      'surprise',  // 'surprise' | 'describe' | 'attach'
  attachedImage:    null,        // { b64, mime }
  imageDescription: '',
};

// ─── CRC-32 ──────────────────────────────────────────────────────────────────

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

// ─── ZIP WRITER (pure JS, STORE method, no external libs) ────────────────────

class ZipWriter {
  constructor() {
    this.localParts   = [];
    this.centralParts = [];
    this.count  = 0;
    this.offset = 0;
  }

  addFile(filename, data /* Uint8Array */) {
    const enc  = new TextEncoder();
    const name = enc.encode(filename);
    const crc  = crc32(data);
    const size = data.length;

    const lh = new Uint8Array(30 + name.length);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0,  0x04034B50, true);
    lv.setUint16(4,  20,         true);
    lv.setUint16(6,  0,          true);
    lv.setUint16(8,  0,          true);
    lv.setUint16(10, 0,          true);
    lv.setUint16(12, 0,          true);
    lv.setUint32(14, crc,        true);
    lv.setUint32(18, size,       true);
    lv.setUint32(22, size,       true);
    lv.setUint16(26, name.length,true);
    lv.setUint16(28, 0,          true);
    lh.set(name, 30);

    const cd = new Uint8Array(46 + name.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0,  0x02014B50,   true);
    cv.setUint16(4,  20,           true);
    cv.setUint16(6,  20,           true);
    cv.setUint16(8,  0,            true);
    cv.setUint16(10, 0,            true);
    cv.setUint16(12, 0,            true);
    cv.setUint16(14, 0,            true);
    cv.setUint32(16, crc,          true);
    cv.setUint32(20, size,         true);
    cv.setUint32(24, size,         true);
    cv.setUint16(28, name.length,  true);
    cv.setUint16(30, 0,            true);
    cv.setUint16(32, 0,            true);
    cv.setUint16(34, 0,            true);
    cv.setUint16(36, 0,            true);
    cv.setUint32(38, 0,            true);
    cv.setUint32(42, this.offset,  true);
    cd.set(name, 46);

    this.localParts.push(lh, data);
    this.centralParts.push(cd);
    this.offset += lh.length + size;
    this.count++;
  }

  generate() {
    const cdOffset = this.offset;
    let   cdSize   = 0;
    for (const p of this.centralParts) cdSize += p.length;

    const eocd = new Uint8Array(22);
    const ev   = new DataView(eocd.buffer);
    ev.setUint32(0,  0x06054B50,   true);
    ev.setUint16(4,  0,            true);
    ev.setUint16(6,  0,            true);
    ev.setUint16(8,  this.count,   true);
    ev.setUint16(10, this.count,   true);
    ev.setUint32(12, cdSize,       true);
    ev.setUint32(16, cdOffset,     true);
    ev.setUint16(20, 0,            true);

    return new Blob([...this.localParts, ...this.centralParts, eocd],
                    { type: 'application/zip' });
  }
}

// ─── BRAND / MODIFIER HELPERS ────────────────────────────────────────────────

function slugify(name) {
  return name.toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function getModifier(brandName) {
  const slug = slugify(brandName);
  return BUILTIN_MODIFIERS[slug] || localStorage.getItem(`adgen_mod_${slug}`) || '';
}

function saveModifier(brandName, modifier) {
  localStorage.setItem(`adgen_mod_${slugify(brandName)}`, modifier.trim());
}

function parseBrandDna(text) {
  const m = text.match(/##\s*6\.\s*IMAGE GENERATION PROMPT MODIFIER[\s\S]*?\n+([\s\S]+?)(?:\n---|\n##|$)/i);
  if (!m) return '';
  return m[1].replace(/^>\s*/gm, '').trim();
}

// ─── CANVAS / INSTAGRAM FORMAT ───────────────────────────────────────────────

async function normalizeToInstagram(b64, mime, targetW = 1080, targetH = 1350) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const tmp = document.createElement('canvas');
      tmp.width = img.width; tmp.height = img.height;
      const tctx = tmp.getContext('2d');
      tctx.drawImage(img, 0, 0);
      const corners = [
        tctx.getImageData(0, 0, 1, 1).data,
        tctx.getImageData(img.width - 1, 0, 1, 1).data,
        tctx.getImageData(0, img.height - 1, 1, 1).data,
        tctx.getImageData(img.width - 1, img.height - 1, 1, 1).data,
      ];
      const r = Math.round(corners.reduce((s, d) => s + d[0], 0) / 4);
      const g = Math.round(corners.reduce((s, d) => s + d[1], 0) / 4);
      const b = Math.round(corners.reduce((s, d) => s + d[2], 0) / 4);

      const c = document.createElement('canvas');
      c.width = targetW; c.height = targetH;
      const ctx = c.getContext('2d');
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(0, 0, targetW, targetH);

      // CONTAIN: scale to fit entirely within bounds — no cropping, all text preserved
      const scale = Math.min(targetW / img.width, targetH / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.drawImage(img, (targetW - dw) / 2, (targetH - dh) / 2, dw, dh);

      resolve({ b64: c.toDataURL('image/png').split(',')[1], mime: 'image/png' });
    };
    img.onerror = () => resolve({ b64, mime });
    img.src = `data:${mime};base64,${b64}`;
  });
}

// ─── GEMINI API ──────────────────────────────────────────────────────────────

async function callGemini(apiKey, body) {
  const url = `${API_BASE}/${MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

async function callGeminiWithRetry(apiKey, body, label = '') {
  const DELAYS = [4000, 8000, 15000];
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await callGemini(apiKey, body);
    } catch (err) {
      const retryable = /high demand|503|overload|unavailable/i.test(err.message);
      if (retryable && attempt < 2) {
        const wait = DELAYS[attempt];
        setProgress(`${label} — sobrecarga, nova tentativa em ${wait / 1000}s… (${attempt + 2}/3)`);
        await new Promise(r => setTimeout(r, wait));
      } else {
        throw err;
      }
    }
  }
}

async function generatePrompts(marca, tema, modifier, apiKey) {
  const N = state.slideCount;
  const region = state.region;
  const { imageSource, imageDescription, attachedImage } = state;

  const imageNote = imageSource === 'describe' && imageDescription
    ? `\nIMAGEM DE REFERÊNCIA: Incorpore esta descrição visual em slides relevantes: "${imageDescription}"`
    : imageSource === 'attach' && attachedImage
    ? '\nIMAGEM DE REFERÊNCIA: Uma imagem de referência foi fornecida. Analise seus elementos visuais (composição, objetos, ambiente, estilo) e incorpore-os organicamente nos slides.'
    : '';

  const narrativeGuide =
    N === 1 ? 'Single slide: one powerful message.' :
    N === 2 ? '2 slides: bold hook → CTA.' :
    N === 3 ? '3 slides: hook → core insight → CTA.' :
    N <= 5  ? `${N} slides: hook → problem → solution → key proof → CTA.` :
              `${N} slides: design the richest narrative arc. Start with hook, end with CTA, fill middle with problem/solution/data/proof/how-it-works.`;

  const prompt = `You are an expert Instagram carousel strategist and visual prompt engineer.

TASK: Generate exactly ${N} image generation prompts for a ${N}-slide Instagram carousel.
Brand: ${marca}
Topic: ${tema}
Geographic context: ${region}
${imageNote}

════ IMAGE GENERATION PROMPT MODIFIER ════
Prepend this VERBATIM to every single prompt (this describes visual STYLE — do NOT render color codes or font names as visible text):
"${modifier}"
══════════════════════════════════════════

⚠️ ABSOLUTE RULES — follow every single one:
1. PORTRAIT: Every image is VERTICAL portrait (taller than wide). Compose everything vertically.
2. SAFE ZONE: All text overlays and critical visual elements must stay inside the central 70% of the image (at least 15% margin from EVERY edge). NEVER place text near any border.
3. MODIFIER IS STYLE ONLY: Never render hex color codes (#XXXXXX), font names, or technical specs as visible text. They describe the visual mood only.
4. GEOGRAPHY: All location/context references must say "${region}". NEVER mention São Paulo, Rio de Janeiro, Minas Gerais, or any other Brazilian state.
5. TEXT IN PORTUGUESE: Every word visible in the image must be Brazilian Portuguese (pt-BR). No English visible in slides.
6. TEXT RELEVANCE: Text overlaid on the image must be directly related to what is visually shown. No generic captions on unrelated images.
7. VISUAL COHESION: All ${N} slides form ONE unified carousel. Use the same color palette, same lighting temperature, same composition style across every slide.
8. NO GIBBERISH: All rendered text must be real, meaningful Brazilian Portuguese words. No placeholder text, no random characters, no partial words, no nonsense syllables.
9. TEXT QUALITY: Maximum 5 words per text element on screen. Use only simple, common, everyday Brazilian Portuguese vocabulary. NEVER invent, distort, approximate, or truncate words — use only real dictionary words. All text must be grammatically correct standard pt-BR. When in doubt about a word, use a simpler one or a number instead.
10. LOGO RULE: NEVER invent, draw, or approximate any brand logo, symbol, emblem, or icon. No gear icons, house shapes, shields, letter marks, monograms, or abstract brand symbols. Represent the brand by its name as clean plain text ONLY.

SLIDE FORMAT FREEDOM (choose per slide what serves it best):
- "photo": Real engineering/construction/field photography with branded text overlay
- "graphic": Pure dark background + large bold typography + geometric accents (no photo)
- "icon": Dark background + single large icon or symbol + one punchy line (no photo)
- "stat": Dark background + one enormous number/percentage as hero + brief label (no photo)
For each slide, decide which format creates the most impact for that specific message.

Narrative arc: ${narrativeGuide}

Return ONLY a valid JSON array — no markdown fences, no extra text:
[{"slide":1,"tipo":"hero","format":"photo","prompt":"..."},{"slide":2,...},...]
The "prompt" value for each object must start with the complete IMAGE GENERATION PROMPT MODIFIER verbatim, then describe the scene.`;

  const contents = imageSource === 'attach' && attachedImage
    ? [{ role: 'user', parts: [
        { inlineData: { mimeType: attachedImage.mime, data: attachedImage.b64 } },
        { text: prompt },
      ]}]
    : [{ role: 'user', parts: [{ text: prompt }] }];

  const data = await callGemini(apiKey, {
    contents,
    generationConfig: { temperature: 0.72, maxOutputTokens: 8192 },
  });

  const usage = data.usageMetadata || {};
  state.totalCost += (usage.promptTokenCount || 0) * COST_IN_TOKEN
                   + (usage.candidatesTokenCount || 0) * COST_OUT_TOKEN;
  refreshCost();

  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  return JSON.parse(clean);
}

async function generateCaption(marca, tema, prompts, apiKey) {
  const N = state.slideCount;
  const region = state.region;
  const arc = prompts.map((p, i) => `Slide ${i + 1} (${p.tipo}): ${p.prompt.replace(/^.*?(?=\.\s[A-Z]|,\s[A-Z])/, '').slice(0, 120).trim()}…`).join('\n');

  const prompt = `Write a perfect Instagram caption for this carousel post. Ready to paste, no labels.

Brand: ${marca}
Topic: ${tema}
Geographic context: ${region}
Number of slides: ${N}
Carousel narrative:
${arc}

CAPTION STRUCTURE (follow exactly, in this order):

1. HOOK (lines 1–2): The scroll-stopper. Must be bold, specific, urgent — make the reader stop. Max 10 words per line. Do NOT start with emoji. This is what appears BEFORE "ver mais".

[blank line]

2. BODY (3 short paragraphs, 2 lines max each):
   - What is the problem or context
   - What this carousel reveals or teaches
   - Why this matters right now in ${region}

[blank line]

3. CTA: One direct question OR one specific instruction to drive comments. Be concrete, not generic.

[blank line]

4. HASHTAGS (one block): 10–14 hashtags total. Mix: 3 broad category + 4 topic-specific + 3 regional (${region.split(',')[0]}-focused) + 1 brand name. Keep together.

STYLE RULES:
- Language: Brazilian Portuguese, direct and authoritative (matching ${marca} tone)
- Max 4 emojis total, only where they add meaning (none in hook line 1)
- Short sentences. Punchy. No corporate jargon.
- Geographic references: always ${region}`;

  const data = await callGemini(apiKey, {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.68, maxOutputTokens: 1024 },
  });

  const usage = data.usageMetadata || {};
  state.totalCost += (usage.promptTokenCount || 0) * COST_IN_TOKEN
                   + (usage.candidatesTokenCount || 0) * COST_OUT_TOKEN;
  refreshCost();

  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

async function generateIdeas(marca, modifier, apiKey) {
  const region = state.region;
  const prompt = `Você é um estrategista de conteúdo especializado em Instagram para marcas brasileiras.

Marca: ${marca}
Estética visual da marca: "${modifier}"
Região: ${region}

Gere exatamente 5 ideias de tema para carrossel no Instagram. Cada ideia deve ser:
- Altamente relevante para o público e serviços da marca
- Específica o suficiente para gerar um carrossel coerente (não genérica demais)
- Atrativa e engajante — algo que o público vai querer salvar ou compartilhar
- Concisa: máximo 8 palavras por ideia
- Em português brasileiro

Retorne APENAS um JSON array de 5 strings — sem markdown, sem texto extra:
["Ideia 1", "Ideia 2", "Ideia 3", "Ideia 4", "Ideia 5"]`;

  const data = await callGemini(apiKey, {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.85, maxOutputTokens: 512 },
  });

  const usage = data.usageMetadata || {};
  state.totalCost += (usage.promptTokenCount || 0) * COST_IN_TOKEN
                   + (usage.candidatesTokenCount || 0) * COST_OUT_TOKEN;
  refreshCost();

  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  return JSON.parse(clean);
}

async function generateImage(prompt, apiKey, label = '') {
  const data = await callGeminiWithRetry(apiKey, {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['image', 'text'] },
  }, label);

  state.totalCost += COST_IMG_FIXED;
  refreshCost();

  const parts   = data.candidates?.[0]?.content?.parts || [];
  const imgPart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));
  if (!imgPart) throw new Error('Resposta sem imagem');

  return { b64: imgPart.inlineData.data, mime: imgPart.inlineData.mimeType };
}

// ─── CAROUSEL UI ─────────────────────────────────────────────────────────────

function initSlots() {
  const track = document.getElementById('c-track');
  track.innerHTML = '';
  for (let i = 0; i < state.slideCount; i++) {
    const el = document.createElement('div');
    el.className = 'c-slide';
    el.dataset.i = i;
    el.innerHTML = `<div class="slide-spinner" style="opacity:.2"><div class="spinner"></div></div>`;
    track.appendChild(el);
  }
}

function initSegBar() {
  const bar = document.getElementById('seg-bar');
  bar.innerHTML = '';
  for (let i = 0; i < state.slideCount; i++) {
    const seg = document.createElement('div');
    seg.className = 'seg';
    seg.dataset.i = i;
    seg.addEventListener('click', () => goTo(i));
    bar.appendChild(seg);
  }
}

function refreshSegs() {
  document.querySelectorAll('.seg').forEach((seg, i) => {
    const s = state.slides[i];
    let cls = 'seg';
    if (i === state.currentSlide) cls += ' active';
    else if (s === 'loading')     cls += ' loading';
    else if (s?.b64)              cls += ' done';
    else if (s?.error)            cls += ' err';
    seg.className = cls;
  });
}

function setSlide(index, data) {
  const slides = document.querySelectorAll('.c-slide');
  const el = slides[index];
  if (!el) return;

  if (data === 'loading') {
    el.innerHTML = `<div class="slide-spinner"><div class="spinner"></div><p>Gerando slide ${index + 1}…</p></div>`;
  } else if (data?.error) {
    el.innerHTML = `<div class="slide-err"><span class="ico">⚠</span><p>Erro no slide ${index + 1}</p><small>${data.error}</small></div>`;
  } else if (data?.b64) {
    const img = new Image();
    img.alt = `Slide ${index + 1}`;
    img.draggable = false;
    img.addEventListener('load', () => { el.innerHTML = ''; el.appendChild(img); });
    img.src = `data:${data.mime};base64,${data.b64}`;
  }
  refreshSegs();
}

function goTo(index) {
  const N = state.slideCount;
  index = Math.max(0, Math.min(N - 1, index));
  state.currentSlide = index;
  document.getElementById('c-track').style.transform = `translateX(-${index * 100}%)`;
  document.getElementById('cnt-cur').textContent = index + 1;
  document.getElementById('nav-prev').classList.toggle('hidden', index === 0);
  document.getElementById('nav-next').classList.toggle('hidden', index === N - 1);
  refreshSegs();
}

function showCarousel() {
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('carousel-wrap').style.display = 'block';
}

// ─── DRAG / TOUCH NAVIGATION ─────────────────────────────────────────────────

function initCarouselNav() {
  document.getElementById('nav-prev').addEventListener('click', () => goTo(state.currentSlide - 1));
  document.getElementById('nav-next').addEventListener('click', () => goTo(state.currentSlide + 1));

  document.addEventListener('keydown', e => {
    if (!state.slides.some(s => s !== null)) return;
    if (e.key === 'ArrowLeft')  goTo(state.currentSlide - 1);
    if (e.key === 'ArrowRight') goTo(state.currentSlide + 1);
  });

  const vp = document.getElementById('carousel-vp');
  let startX = null;

  function onStart(x) { startX = x; vp.classList.add('dragging'); }
  function onEnd(x) {
    vp.classList.remove('dragging');
    if (startX === null) return;
    const delta = startX - x;
    if (Math.abs(delta) > 48) goTo(state.currentSlide + (delta > 0 ? 1 : -1));
    startX = null;
  }

  vp.addEventListener('mousedown',  e => onStart(e.clientX));
  vp.addEventListener('mouseup',    e => onEnd(e.clientX));
  vp.addEventListener('mouseleave', () => { vp.classList.remove('dragging'); startX = null; });
  vp.addEventListener('touchstart', e => onStart(e.touches[0].clientX),       { passive: true });
  vp.addEventListener('touchend',   e => onEnd(e.changedTouches[0].clientX),  { passive: true });
}

// ─── PROGRESS & COST ─────────────────────────────────────────────────────────

function setProgress(text, hide = false) {
  const el = document.getElementById('prog-text');
  el.textContent = text;
  el.classList.toggle('hide', hide);
}

function refreshCost() {
  document.getElementById('cost-val').textContent = `$${state.totalCost.toFixed(4)}`;
}

// ─── TOAST ───────────────────────────────────────────────────────────────────

function toast(msg, type = '') {
  const c = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

// ─── DOWNLOAD (ZIP) ──────────────────────────────────────────────────────────

function b64ToBytes(b64) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

async function downloadZip(tema) {
  const btn = document.getElementById('btn-dl');
  btn.disabled = true;
  const zip = new ZipWriter();
  let n = 0;

  for (let i = 0; i < state.slideCount; i++) {
    const s = state.slides[i];
    if (!s?.b64) continue;
    n++;
    btn.textContent = `Empacotando ${n}/${state.slideCount}…`;
    zip.addFile(`slide-${String(i + 1).padStart(2, '0')}_1080x1350.png`, b64ToBytes(s.b64));
    await new Promise(r => setTimeout(r, 0));
  }

  const slug = slugify(tema || 'carousel');
  const blob = zip.generate();
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: `${slug}.zip` }).click();
  URL.revokeObjectURL(url);

  btn.textContent = 'Download pronto ✓';
  btn.disabled = false;
  setTimeout(() => { btn.textContent = 'Baixar todos os slides'; }, 3500);
}

// ─── MAIN GENERATION FLOW ────────────────────────────────────────────────────

async function generate(marca, tema, modifier, apiKey) {
  const N = state.slideCount;

  state.generating   = true;
  state.totalCost    = 0;
  state.slides       = new Array(N).fill(null);
  state.caption      = '';
  state.currentSlide = 0;

  const btnGen   = document.getElementById('btn-gen');
  const btnDl    = document.getElementById('btn-dl');
  const captCard = document.getElementById('caption-card');

  btnGen.disabled = true;
  btnGen.textContent = 'Gerando…';
  btnDl.classList.remove('show');
  if (captCard) captCard.style.display = 'none';
  document.getElementById('cnt-tot').textContent = N;
  refreshCost();

  showCarousel();
  initSlots();
  initSegBar();
  goTo(0);

  // ETAPA 1 — gerar N prompts
  setProgress('Gerando prompts…');
  let prompts;
  try {
    prompts = await generatePrompts(marca, tema, modifier, apiKey);
  } catch (err) {
    toast(`Erro ao gerar prompts: ${err.message}`, 'err');
    setProgress(`Erro: ${err.message}`);
    btnGen.disabled = false;
    btnGen.textContent = 'Gerar carrossel';
    state.generating = false;
    return;
  }

  // Marca todos como carregando
  for (let i = 0; i < N; i++) {
    state.slides[i] = 'loading';
    setSlide(i, 'loading');
  }

  // ETAPA 2 — gerar + normalizar imagens uma a uma (com retry automático em sobrecarga)
  for (let i = 0; i < N; i++) {
    const item = prompts[i];
    if (!item) continue;
    const label = `Slide ${i + 1}/${N}`;
    setProgress(`Gerando ${label}…`);
    try {
      const raw    = await generateImage(item.prompt, apiKey, label);
      setProgress(`Normalizando ${label}…`);
      const normed = await normalizeToInstagram(raw.b64, raw.mime);
      state.slides[i] = normed;
      setSlide(i, normed);
    } catch (err) {
      state.slides[i] = { error: err.message };
      setSlide(i, { error: err.message });
      toast(`Slide ${i + 1}: ${err.message}`, 'err');
    }
  }

  // ETAPA 3 — gerar legenda
  if (state.slides.some(s => s?.b64)) {
    setProgress('Gerando legenda…');
    try {
      state.caption = await generateCaption(marca, tema, prompts, apiKey);
      const ta = document.getElementById('caption-text');
      if (ta) {
        ta.value = state.caption;
        if (captCard) captCard.style.display = 'block';
      }
    } catch (err) {
      toast(`Legenda não gerada: ${err.message}`, 'warn');
    }
  }

  setProgress('', true);
  btnGen.textContent = 'Gerar carrossel';
  btnGen.disabled = false;
  state.generating = false;

  if (state.slides.some(s => s?.b64)) {
    btnDl.classList.add('show');
    toast('Carrossel gerado com sucesso!', 'ok');
  }
}

// ─── MODIFIER UI ─────────────────────────────────────────────────────────────

function syncModifier(brandName) {
  const mod    = getModifier(brandName);
  const badge  = document.getElementById('mod-badge');
  const detail = document.getElementById('mod-details');
  const ta     = document.getElementById('mod-textarea');

  ta.value = mod;
  if (mod) {
    badge.textContent = 'Carregado';
    badge.className   = 'modifier-badge badge-ok';
    detail.removeAttribute('open');
  } else {
    badge.textContent = 'Não encontrado';
    badge.className   = 'modifier-badge badge-miss';
    detail.setAttribute('open', '');
  }
}

// ─── API KEY UI ──────────────────────────────────────────────────────────────

function syncApiKey() {
  const key = localStorage.getItem('adgen_key') || '';
  const inp = document.getElementById('api-key-input');
  const dot = document.getElementById('api-key-dot');
  const btn = document.getElementById('btn-gen');
  inp.value = key;
  const ok  = key.length > 10;
  dot.classList.toggle('ok', ok);
  btn.disabled = !ok;
}

// ─── INIT ────────────────────────────────────────────────────────────────────

function init() {
  syncApiKey();
  initCarouselNav();

  // API key persistence
  document.getElementById('api-key-input').addEventListener('input', e => {
    localStorage.setItem('adgen_key', e.target.value.trim());
    syncApiKey();
  });

  // Auto-load modifier when brand name is typed
  let brandTimer;
  document.getElementById('in-brand').addEventListener('input', e => {
    clearTimeout(brandTimer);
    brandTimer = setTimeout(() => {
      const name = e.target.value.trim();
      if (name.length >= 2) syncModifier(name);
    }, 380);
  });

  // Load brand-dna.md file
  document.getElementById('btn-load-dna').addEventListener('click', () => {
    document.getElementById('file-dna').click();
  });

  document.getElementById('file-dna').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const mod = parseBrandDna(ev.target.result);
      if (mod) {
        document.getElementById('mod-textarea').value = mod;
        document.getElementById('mod-badge').textContent = 'Carregado';
        document.getElementById('mod-badge').className  = 'modifier-badge badge-ok';
        toast('Modifier carregado do brand-dna.md', 'ok');
      } else {
        toast('Seção IMAGE GENERATION PROMPT MODIFIER não encontrada.', 'warn');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // Save modifier to localStorage
  document.getElementById('btn-save-mod').addEventListener('click', () => {
    const brand = document.getElementById('in-brand').value.trim();
    const mod   = document.getElementById('mod-textarea').value.trim();
    if (!brand) { toast('Preencha o nome da marca primeiro.', 'warn'); return; }
    if (!mod)   { toast('O modifier está vazio.', 'warn'); return; }
    saveModifier(brand, mod);
    syncModifier(brand);
    toast('Modifier salvo no navegador.', 'ok');
  });

  // Slide count input
  document.getElementById('in-count').addEventListener('input', e => {
    const v = parseInt(e.target.value, 10);
    if (v >= 1 && v <= 15) {
      state.slideCount = v;
      document.getElementById('cnt-tot').textContent = v;
    }
  });

  // Regional context input
  document.getElementById('in-region').addEventListener('input', e => {
    state.region = e.target.value.trim() || 'Rondônia (RO), Brasil';
  });

  // ── IDEA MODE TOGGLE ──────────────────────────────────────────────────────

  document.querySelectorAll('.idea-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.idea-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.ideaMode = btn.dataset.mode;
      document.getElementById('tema-manual').style.display = state.ideaMode === 'manual' ? 'block' : 'none';
      document.getElementById('tema-ideas').style.display  = state.ideaMode === 'ideas'  ? 'block' : 'none';
    });
  });

  document.getElementById('btn-ideas').addEventListener('click', async () => {
    const apiKey   = localStorage.getItem('adgen_key') || '';
    const marca    = document.getElementById('in-brand').value.trim();
    const modifier = document.getElementById('mod-textarea').value.trim();
    if (!apiKey) { toast('Adicione sua API key primeiro.', 'warn'); return; }
    if (!marca)  { toast('Preencha o nome da marca primeiro.', 'warn'); return; }

    const btn = document.getElementById('btn-ideas');
    btn.disabled = true;
    btn.textContent = 'Gerando ideias…';

    try {
      const ideas = await generateIdeas(marca, modifier, apiKey);
      const chipsEl = document.getElementById('ideas-chips');
      chipsEl.innerHTML = '';
      state.selectedIdea = '';
      ideas.forEach(idea => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'idea-chip';
        chip.textContent = idea;
        chip.addEventListener('click', () => {
          document.querySelectorAll('.idea-chip').forEach(c => c.classList.remove('selected'));
          chip.classList.add('selected');
          state.selectedIdea = idea;
        });
        chipsEl.appendChild(chip);
      });
    } catch (err) {
      toast(`Erro ao gerar ideias: ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Gerar ideias';
    }
  });

  // ── IMAGE SOURCE TOGGLE ───────────────────────────────────────────────────

  document.querySelectorAll('.source-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.source-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.imageSource = btn.dataset.source;
      document.getElementById('source-describe').style.display = state.imageSource === 'describe' ? 'block' : 'none';
      document.getElementById('source-attach').style.display   = state.imageSource === 'attach'   ? 'block' : 'none';
    });
  });

  document.getElementById('in-img-desc').addEventListener('input', e => {
    state.imageDescription = e.target.value.trim();
  });

  document.getElementById('btn-attach-img').addEventListener('click', () => {
    document.getElementById('file-img').click();
  });

  document.getElementById('file-img').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target.result;
      const [header, b64] = dataUrl.split(',');
      const mime = header.match(/data:(.*);base64/)?.[1] || 'image/png';
      state.attachedImage = { b64, mime };
      const preview = document.getElementById('attach-preview');
      preview.innerHTML = '';
      const img = document.createElement('img');
      img.src = dataUrl;
      img.alt = 'Imagem de referência';
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn-sm';
      removeBtn.style.marginTop = '6px';
      removeBtn.textContent = 'Remover imagem';
      removeBtn.addEventListener('click', () => {
        state.attachedImage = null;
        preview.innerHTML = '';
        document.getElementById('file-img').value = '';
      });
      preview.appendChild(img);
      preview.appendChild(removeBtn);
    };
    reader.readAsDataURL(file);
  });

  // Copy caption
  document.getElementById('btn-copy-caption').addEventListener('click', () => {
    const ta = document.getElementById('caption-text');
    if (!ta?.value) return;
    navigator.clipboard.writeText(ta.value).then(() => {
      const btn = document.getElementById('btn-copy-caption');
      btn.textContent = 'Copiado ✓';
      setTimeout(() => { btn.textContent = 'Copiar'; }, 2000);
    });
  });

  // Form submit
  document.getElementById('gen-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (state.generating) return;

    const apiKey   = localStorage.getItem('adgen_key') || '';
    const marca    = document.getElementById('in-brand').value.trim();
    const modifier = document.getElementById('mod-textarea').value.trim();

    let tema;
    if (state.ideaMode === 'ideas') {
      tema = state.selectedIdea;
      if (!tema) { toast('Selecione uma das ideias antes de gerar.', 'warn'); return; }
    } else {
      tema = document.getElementById('in-tema').value.trim();
      if (!tema) { toast('Preencha o tema do carrossel.', 'warn'); return; }
    }

    state.slideCount = parseInt(document.getElementById('in-count').value, 10) || 7;
    state.region = document.getElementById('in-region').value.trim() || 'Rondônia (RO), Brasil';

    if (!apiKey)   { toast('Adicione sua API key do Google AI Studio.', 'warn'); return; }
    if (!marca)    { toast('Preencha o nome da marca.', 'warn'); return; }
    if (!modifier) { toast('Adicione o IMAGE GENERATION PROMPT MODIFIER.', 'warn'); return; }

    if (state.imageSource === 'attach' && !state.attachedImage) {
      toast('Anexe uma imagem ou escolha outra opção de imagem.', 'warn'); return;
    }
    if (state.imageSource === 'describe') {
      state.imageDescription = document.getElementById('in-img-desc').value.trim();
    }

    await generate(marca, tema, modifier, apiKey);
  });

  // Download ZIP
  document.getElementById('btn-dl').addEventListener('click', () => {
    const tema = state.ideaMode === 'ideas'
      ? state.selectedIdea
      : document.getElementById('in-tema').value.trim();
    downloadZip(tema);
  });
}

init();
