/* 짤·카드 스튜디오 — 핵심 엔진 (화면 미리보기와 내려받기가 같은 drawScene을 쓴다) */
(function (g) {
  'use strict';

  const RATIOS = { '1:1': [1080, 1080], '4:5': [1080, 1350], '9:16': [1080, 1920] };
  const FONT = '"Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo","Segoe UI",sans-serif,"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji"';
  const MAX_TEXTS = 6;
  const MAX_CHARS = 2000;
  const MAX_TEMPLATES = 50;
  const MAX_FILE_BYTES = 20 * 1024 * 1024;
  const MAX_PIXELS = 40e6;
  const MAX_JSON_BYTES = 1024 * 1024;
  const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const HEX = /^#[0-9a-fA-F]{6}$/;

  const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  const graphemes = (s) => (segmenter ? Array.from(segmenter.segment(s), (x) => x.segment) : Array.from(s));

  function newId(p) {
    return (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function makeText(o) {
    return Object.assign({ id: newId('t'), text: '새 문구', x: 0.5, y: 0.5, size: 0.07, width: 0.84, color: '#ffffff', stroke: true, bold: true, align: 'center' }, o || {});
  }

  function sizeCanvas(c, ratio) {
    const d = RATIOS[ratio];
    if (c.width !== d[0]) c.width = d[0];
    if (c.height !== d[1]) c.height = d[1];
  }

  /* ---------- 문구 줄바꿈: 글자(grapheme) 단위, 공백 우선 ---------- */
  function wrapText(ctx, text, maxW) {
    const out = [];
    for (const para of text.replace(/\r\n?/g, '\n').split('\n')) {
      if (para === '') { out.push(''); continue; }
      let cur = [];
      for (const ch of graphemes(para)) {
        cur.push(ch);
        if (cur.length > 1 && ctx.measureText(cur.join('')).width > maxW) {
          let sp = -1;
          for (let i = cur.length - 2; i > 0; i--) { if (/\s/.test(cur[i])) { sp = i; break; } }
          if (sp > 0) { out.push(cur.slice(0, sp).join('').trimEnd()); cur = cur.slice(sp + 1); }
          else { const last = cur.pop(); out.push(cur.join('')); cur = [last]; }
        }
      }
      out.push(cur.join('').trimEnd());
    }
    return out;
  }

  function fontStr(t, size) { return (t.bold ? '700 ' : '400 ') + size + 'px ' + FONT; }

  /* 입력이 극단이어도 항상 캔버스 안에 들어오는 배치를 돌려준다 */
  function layoutText(ctx, t, W, H) {
    const raw = String(t.text == null ? '' : t.text);
    const text = raw.slice(0, MAX_CHARS).replace(/[\uD800-\uDBFF]$/, ''); // 이모지 중간에서 끊기지 않게
    const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
    const widthFrac = clamp(num(t.width, 0.84), 0.2, 1);
    let size = clamp(num(t.size, 0.07), 0.02, 0.2) * W;
    const base = size, maxW = widthFrac * W, safeH = H * 0.96, minSize = 14;
    const res = { lines: [], size, lh: size * 1.25, rect: { x: 0, y: 0, w: 0, h: 0 }, shrunk: false, truncated: raw.length > MAX_CHARS, empty: !text.trim() };
    if (res.empty) { res.lines = []; return res; }
    let lines, lh;
    for (;;) {
      ctx.font = fontStr(t, size);
      lines = wrapText(ctx, text, maxW);
      lh = size * 1.25;
      if (lines.length * lh <= safeH || size <= minSize) break;
      size = Math.max(minSize, Math.floor(size * 0.9));
    }
    const maxLines = Math.max(1, Math.floor(safeH / lh));
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      let last = graphemes(lines[maxLines - 1]);
      while (last.length > 1 && ctx.measureText(last.join('') + '…').width > maxW) last.pop();
      lines[maxLines - 1] = last.join('') + '…';
      res.truncated = true;
    }
    let bw = 0;
    for (const l of lines) bw = Math.max(bw, ctx.measureText(l).width);
    bw = Math.min(bw, W);
    const bh = Math.min(lines.length * lh, H);
    const cx = clamp(num(t.x, 0.5) * W, bw / 2, W - bw / 2);
    const cy = clamp(num(t.y, 0.5) * H, bh / 2, H - bh / 2);
    res.lines = lines; res.size = size; res.lh = lh; res.shrunk = size < base - 0.5;
    res.rect = { x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh };
    return res;
  }

  function lum(hex) {
    const n = parseInt(hex.slice(1), 16);
    return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  }

  function drawLayout(ctx, t, L) {
    if (L.empty || !L.lines.length) return;
    ctx.save();
    ctx.font = fontStr(t, L.size);
    ctx.textBaseline = 'middle';
    ctx.textAlign = t.align === 'left' ? 'left' : t.align === 'right' ? 'right' : 'center';
    const ax = t.align === 'left' ? L.rect.x : t.align === 'right' ? L.rect.x + L.rect.w : L.rect.x + L.rect.w / 2;
    const color = HEX.test(t.color) ? t.color : '#ffffff';
    ctx.lineJoin = 'round';
    ctx.lineWidth = L.size * 0.14;
    ctx.strokeStyle = lum(color) > 0.55 ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)';
    ctx.fillStyle = color;
    L.lines.forEach((line, i) => {
      const y = L.rect.y + L.lh * (i + 0.5);
      if (t.stroke) ctx.strokeText(line, ax, y);
      ctx.fillText(line, ax, y);
    });
    ctx.restore();
  }

  function drawImage(ctx, s, W, H) {
    const im = s.img;
    if (!im || !im.width || !im.height) return;
    const fit = s.fit === 'contain' ? Math.min(W / im.width, H / im.height) : Math.max(W / im.width, H / im.height);
    const sc = fit * clamp(s.zoom || 1, 1, 3);
    const dw = im.width * sc, dh = im.height * sc;
    const x = (W - dw) / 2 + clamp(s.imgX || 0, -1, 1) * Math.abs(dw - W) / 2;
    const y = (H - dh) / 2 + clamp(s.imgY || 0, -1, 1) * Math.abs(dh - H) / 2;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(im, x, y, dw, dh);
  }

  /* 배경 → 이미지 → 문구. 화면 미리보기·PNG·JPEG 모두 이 함수 하나만 쓴다. */
  function drawScene(ctx, s) {
    const [W, H] = RATIOS[s.ratio];
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = HEX.test(s.bg) ? s.bg : '#000000';
    ctx.fillRect(0, 0, W, H);
    drawImage(ctx, s, W, H);
    const layouts = s.texts.map((t) => {
      const L = layoutText(ctx, t, W, H);
      drawLayout(ctx, t, L);
      L.id = t.id;
      return L;
    });
    ctx.restore();
    return layouts;
  }

  /* ---------- 이미지 파일 검사·교체 (실패 시 상태를 건드리지 않는다) ---------- */
  async function sniff(file) {
    const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const at = (arr, off) => arr.every((v, i) => b[(off || 0) + i] === v);
    if (at([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
    if (at([0xff, 0xd8, 0xff])) return 'jpeg';
    if (at([0x47, 0x49, 0x46, 0x38])) return 'gif';
    if (at([0x52, 0x49, 0x46, 0x46]) && at([0x57, 0x45, 0x42, 0x50], 8)) return 'webp';
    if (at([0x42, 0x4d])) return 'bmp';
    if (at([0x25, 0x50, 0x44, 0x46])) return 'pdf';
    const head = new TextDecoder('utf-8', { fatal: false }).decode(b).trimStart().toLowerCase();
    if (head.startsWith('<svg') || head.startsWith('<?xml')) return 'svg';
    return 'unknown';
  }

  async function loadImageFile(file) {
    if (!file) return { ok: false, reason: '파일이 선택되지 않았습니다.' };
    if (file.size === 0) return { ok: false, reason: '빈 파일(0바이트)입니다.' };
    if (file.size > MAX_FILE_BYTES) return { ok: false, reason: '파일이 너무 큽니다 (' + (file.size / 1048576).toFixed(1) + 'MB). 20MB 이하만 가능합니다.' };
    const kind = await sniff(file);
    if (kind !== 'png' && kind !== 'jpeg') {
      const names = { gif: 'GIF', webp: 'WebP', bmp: 'BMP', pdf: 'PDF', svg: 'SVG', unknown: '알 수 없는 형식' };
      return { ok: false, reason: '지원하지 않는 파일입니다 (' + names[kind] + '). PNG 또는 JPEG만 불러올 수 있습니다.' };
    }
    const tooBig = (w, h) => '해상도가 너무 큽니다 (' + w + '×' + h + '). 4천만 화소 이하만 가능합니다.';
    const hd = await headerSize(file, kind); // 디코드 전에 헤더로 먼저 거른다
    if (hd && hd.w * hd.h > MAX_PIXELS) return { ok: false, reason: tooBig(hd.w, hd.h) };
    let bmp;
    try {
      bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (e) {
      return { ok: false, reason: '이미지가 손상되어 읽을 수 없습니다. 다른 ' + kind.toUpperCase() + ' 파일을 사용해 주세요.' };
    }
    const w = bmp.width, h = bmp.height; // close() 뒤에는 0이 되므로 먼저 저장
    if (w * h > MAX_PIXELS) {
      bmp.close && bmp.close();
      return { ok: false, reason: tooBig(w, h) };
    }
    return { ok: true, bitmap: bmp, kind, w, h, name: file.name || '이미지' };
  }

  /* PNG(IHDR)·JPEG(SOF) 헤더에서 폭·높이만 읽는다. 못 읽으면 null */
  async function headerSize(file, kind) {
    try {
      const b = new Uint8Array(await file.slice(0, kind === 'png' ? 32 : 524288).arrayBuffer());
      if (kind === 'png') {
        if (b.length < 24) return null;
        const dv = new DataView(b.buffer);
        return { w: dv.getUint32(16), h: dv.getUint32(20) };
      }
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1];
        if (m === 0xff) { i++; continue; }
        if (m === 0x01 || (m >= 0xd0 && m <= 0xd9)) { i += 2; continue; }
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
        i += 2 + ((b[i + 2] << 8) | b[i + 3]);
      }
    } catch (e) { /* 디코드 후 검사에 맡긴다 */ }
    return null;
  }

  /* 불러오기에 성공한 결과를 상태에 반영한다 */
  function applyImage(state, r) {
    if (state.img && state.img.close) state.img.close();
    state.img = r.bitmap;
    state.imgName = r.name || '이미지';
    state.imgInfo = r.kind.toUpperCase() + ' ' + r.w + '×' + r.h;
    state.imgX = 0; state.imgY = 0; state.zoom = 1;
  }

  async function replaceImage(state, file) {
    const r = await loadImageFile(file);
    if (r.ok) applyImage(state, r);
    return r;
  }

  /* 합성 샘플 이미지 (외부 출처 없음, 메타데이터 없음) */
  function makeSampleCanvas(kind) {
    const dims = { square: [1200, 1200], landscape: [1600, 900], portrait: [900, 1600], alpha: [1000, 1000] }[kind] || [1200, 1200];
    const c = document.createElement('canvas');
    c.width = dims[0]; c.height = dims[1];
    const x = c.getContext('2d');
    if (kind !== 'alpha') {
      const gr = x.createLinearGradient(0, 0, c.width, c.height);
      gr.addColorStop(0, '#ff9a8b'); gr.addColorStop(0.5, '#ff6a88'); gr.addColorStop(1, '#6a5acd');
      x.fillStyle = gr; x.fillRect(0, 0, c.width, c.height);
    }
    x.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(c.width * (0.1 + 0.16 * i), c.height * (0.2 + 0.12 * ((i * 5) % 6)), Math.min(c.width, c.height) * 0.09, 0, 7); x.fill(); }
    x.fillStyle = kind === 'alpha' ? '#2ecc71' : 'rgba(0,0,0,0.25)';
    x.fillRect(c.width * 0.5, 0, c.width * 0.5, c.height);
    x.strokeStyle = '#fff'; x.lineWidth = 8; x.strokeRect(4, 4, c.width - 8, c.height - 8);
    x.fillStyle = '#fff'; x.font = '700 ' + Math.round(c.width * 0.06) + 'px ' + FONT; x.textAlign = 'center';
    x.fillText('SAMPLE ' + c.width + '×' + c.height, c.width / 2, c.height * 0.92);
    return c;
  }

  /* ---------- 템플릿 검증 (저장 전에 전부 검사) ---------- */
  const isNum = (v, lo, hi) => typeof v === 'number' && isFinite(v) && v >= lo && v <= hi;

  function validateTemplate(o, idx) {
    const p = '템플릿 ' + (idx + 1);
    const errs = [];
    if (!o || typeof o !== 'object' || Array.isArray(o)) return { errors: [p + ': 객체가 아닙니다'] };
    if (typeof o.name !== 'string' || !o.name.trim()) errs.push(p + ': 필수 항목 name(이름)이 없습니다');
    else if (o.name.length > 40) errs.push(p + ': name이 40자를 넘습니다');
    if (typeof o.ratio !== 'string' || !hasOwn(RATIOS, o.ratio)) errs.push(p + ': 필수 항목 ratio가 없거나 1:1·4:5·9:16이 아닙니다');
    if (!Array.isArray(o.texts)) errs.push(p + ': 필수 항목 texts(문구 목록)가 없습니다');
    else if (o.texts.length > MAX_TEXTS) errs.push(p + ': 문구는 최대 ' + MAX_TEXTS + '개입니다');
    else o.texts.forEach((t, i) => {
      const q = p + ' 문구 ' + (i + 1);
      if (!t || typeof t !== 'object') { errs.push(q + ': 객체가 아닙니다'); return; }
      if (typeof t.text !== 'string') errs.push(q + ': 필수 항목 text가 없습니다');
      else if (t.text.length > MAX_CHARS) errs.push(q + ': text가 ' + MAX_CHARS + '자를 넘습니다');
      if (!isNum(t.x, 0, 1)) errs.push(q + ': 필수 항목 x(0~1)가 없거나 범위 밖입니다');
      if (!isNum(t.y, 0, 1)) errs.push(q + ': 필수 항목 y(0~1)가 없거나 범위 밖입니다');
      if (!isNum(t.size, 0.02, 0.2)) errs.push(q + ': 필수 항목 size(0.02~0.2)가 없거나 범위 밖입니다');
      if (typeof t.color !== 'string' || !HEX.test(t.color)) errs.push(q + ': 필수 항목 color(#rrggbb)가 없거나 형식이 틀립니다');
      if (hasOwn(t, 'width') && !isNum(t.width, 0.2, 1)) errs.push(q + ': width는 0.2~1이어야 합니다');
      if (hasOwn(t, 'align') && !['left', 'center', 'right'].includes(t.align)) errs.push(q + ': align이 올바르지 않습니다');
    });
    if (hasOwn(o, 'bg') && !(typeof o.bg === 'string' && HEX.test(o.bg))) errs.push(p + ': bg 형식이 틀립니다');
    if (hasOwn(o, 'fit') && !['cover', 'contain'].includes(o.fit)) errs.push(p + ': fit이 올바르지 않습니다');
    if (hasOwn(o, 'zoom') && !isNum(o.zoom, 1, 3)) errs.push(p + ': zoom은 1~3이어야 합니다');
    if (hasOwn(o, 'imgX') && !isNum(o.imgX, -1, 1)) errs.push(p + ': imgX는 -1~1이어야 합니다');
    if (hasOwn(o, 'imgY') && !isNum(o.imgY, -1, 1)) errs.push(p + ': imgY는 -1~1이어야 합니다');
    if (errs.length) return { errors: errs };
    const seen = new Set();
    const uniq = (id, p) => { const ok = typeof id === 'string' && /^[\w-]{1,64}$/.test(id) && !seen.has(id); const v = ok ? id : newId(p); seen.add(v); return v; };
    return {
      errors: [],
      value: {
        id: typeof o.id === 'string' && /^[\w-]{1,64}$/.test(o.id) ? o.id : newId('tpl'),
        name: o.name.trim(),
        ratio: o.ratio,
        bg: o.bg || '#1f2a44',
        fit: o.fit || 'cover',
        zoom: o.zoom == null ? 1 : o.zoom,
        imgX: o.imgX || 0,
        imgY: o.imgY || 0,
        texts: o.texts.map((t) => makeText({
          id: uniq(t.id, 't'), // 중복 id는 새 id로 교체
          text: t.text, x: t.x, y: t.y, size: t.size, color: t.color,
          width: t.width == null ? 0.84 : t.width, stroke: t.stroke !== false, bold: t.bold !== false, align: t.align || 'center'
        })),
        createdAt: typeof o.createdAt === 'number' ? o.createdAt : Date.now(),
        updatedAt: typeof o.updatedAt === 'number' ? o.updatedAt : Date.now()
      }
    };
  }

  /* 가져오기: 전체를 검증한 뒤에만 결과를 돌려준다. 하나라도 틀리면 아무것도 바뀌지 않는다. */
  function parseImport(text, existing) {
    if (typeof text !== 'string' || !text.trim()) return { ok: false, errors: ['내용이 비어 있습니다'] };
    if (text.length > MAX_JSON_BYTES) return { ok: false, errors: ['JSON이 너무 큽니다 (1MB 이하만 가능)'] };
    let data;
    try { data = JSON.parse(text); } catch (e) { return { ok: false, errors: ['JSON 문법이 손상되었습니다: ' + e.message] }; }
    const arr = Array.isArray(data) ? data : data && typeof data === 'object' && Array.isArray(data.templates) ? data.templates : null;
    if (!arr) return { ok: false, errors: ['필수 항목 templates(템플릿 목록)가 없습니다'] };
    if (!arr.length) return { ok: false, errors: ['가져올 템플릿이 0개입니다'] };
    if (existing.length + arr.length > MAX_TEMPLATES) return { ok: false, errors: ['템플릿은 최대 ' + MAX_TEMPLATES + '개까지 저장됩니다'] };
    const errors = [], values = [];
    const used = new Set(existing.map((t) => t.id));
    arr.forEach((o, i) => {
      const r = validateTemplate(o, i);
      if (r.errors.length) errors.push(...r.errors);
      else {
        const v = r.value;
        if (used.has(v.id)) { v.id = newId('tpl'); v.name = (v.name + ' (가져옴)').slice(0, 40); }
        used.add(v.id); values.push(v);
      }
    });
    if (errors.length) return { ok: false, errors };
    return { ok: true, templates: values };
  }

  /* ---------- 템플릿 저장소 (localStorage, 안정된 id로만 접근) ---------- */
  const Store = {
    KEY: 'jjal-studio.templates.v1',
    /* 저장 원문을 검사: 읽을 수 없거나 무효 항목·id 문제가 있으면 problems가 0보다 크다 */
    inspect(raw) {
      let data;
      try { data = JSON.parse(raw); } catch (e) { return { templates: [], problems: 1, corrupt: true }; }
      if (!data || !Array.isArray(data.templates)) return { templates: [], problems: 1, corrupt: true };
      const out = [], used = new Set();
      let dropped = 0, idFixed = 0;
      data.templates.forEach((o, i) => {
        const r = validateTemplate(o, i);
        if (r.errors.length) { dropped++; return; }
        const v = r.value;
        if (used.has(v.id)) { v.id = newId('tpl'); }
        if (!o || o.id !== v.id) idFixed++;
        used.add(v.id); out.push(v);
      });
      return { templates: out, dropped, idFixed, problems: dropped + idFixed, corrupt: false };
    },
    load() {
      let raw;
      try { raw = localStorage.getItem(this.KEY); } catch (e) { return { templates: [], error: '브라우저 저장소를 읽을 수 없습니다' }; }
      if (!raw) return { templates: [] };
      const r = this.inspect(raw);
      if (r.corrupt) return { templates: [], error: '저장된 템플릿이 손상되어 읽지 못했습니다. 원본은 지우지 않고 보관합니다.', corrupt: true };
      let error;
      if (r.problems) {
        // id를 한 번만 확정해 저장(안정된 id). 원본은 save()가 .bak 에 보관한다.
        const s = this.save(r.templates);
        if (r.dropped) error = r.dropped + '개 항목은 형식이 맞지 않아 목록에서 제외했습니다. 원본은 ' + this.KEY + '.bak 에 보관했습니다.';
        if (!s.ok) error = (error ? error + ' ' : '') + s.error;
      }
      return { templates: r.templates, error };
    },
    save(list) {
      try {
        const cur = localStorage.getItem(this.KEY);
        if (cur) {
          const r = this.inspect(cur);
          if (r.problems) localStorage.setItem(this.KEY + '.bak', cur); // 덮어쓰기 전에 문제 있는 원본 보관
        }
        localStorage.setItem(this.KEY, JSON.stringify({ app: 'jjal-card-studio', version: 1, templates: list }));
        return { ok: true };
      } catch (e) { return { ok: false, error: '브라우저 저장소에 쓸 수 없습니다 (사생활 보호 모드이거나 용량 초과)' }; }
    },
    create(fields) {
      const list = this.load().templates;
      if (list.length >= MAX_TEMPLATES) return { ok: false, error: '템플릿은 최대 ' + MAX_TEMPLATES + '개입니다' };
      const r = validateTemplate(Object.assign({}, fields, { id: undefined }), 0);
      if (r.errors.length) return { ok: false, error: r.errors[0] };
      list.push(r.value);
      const s = this.save(list);
      return s.ok ? { ok: true, template: r.value } : s;
    },
    update(id, fields) {
      const list = this.load().templates;
      const i = list.findIndex((t) => t.id === id);
      if (i < 0) return { ok: false, error: '대상 템플릿을 찾을 수 없습니다' };
      const r = validateTemplate(Object.assign({}, list[i], fields, { id }), i);
      if (r.errors.length) return { ok: false, error: r.errors[0] };
      r.value.createdAt = list[i].createdAt; r.value.updatedAt = Date.now();
      list[i] = r.value;
      const s = this.save(list);
      return s.ok ? { ok: true, template: r.value } : s;
    },
    remove(id) {
      const list = this.load().templates;
      const next = list.filter((t) => t.id !== id);
      if (next.length === list.length) return { ok: false, error: '대상 템플릿을 찾을 수 없습니다' };
      return this.save(next);
    }
  };

  /* ---------- 출처·사용 권한 메타데이터 (PNG iTXt / JPEG COM, EXIF·XMP는 쓰지 않는다) ---------- */
  const Meta = (function () {
    const KEY = 'jjal-provenance';
    const TYPES = { license: '라이선스명', tos: '이용약관', class: '수업 제공 표기' };
    let crcT = null;
    function crc32(u8) {
      if (!crcT) { crcT = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; } }
      let c = 0xffffffff;
      for (let i = 0; i < u8.length; i++) c = crcT[(c ^ u8[i]) & 255] ^ (c >>> 8);
      return (c ^ 0xffffffff) >>> 0;
    }
    const enc = (s) => new TextEncoder().encode(s);

    /* 입력 검증: 본인 제작이면 own:true, 아니면 URL + 허가 근거(종류·내용)가 모두 필요 */
    function validate(p) {
      if (!p || typeof p !== 'object') return { ok: false, errors: ['출처 정보가 없습니다'] };
      if (p.own === true) return { ok: true, value: { own: true } };
      const errors = [];
      let url = String(p.url || '').trim();
      try {
        const u = new URL(url);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') errors.push('원본 출처 URL은 http:// 또는 https:// 로 시작해야 합니다');
        else if (u.username || u.password) errors.push('URL에 아이디·비밀번호가 들어 있습니다. 제거해 주세요');
        else if (url.length > 500) errors.push('URL이 너무 깁니다 (500자 이하)');
        else {
          // 서명·토큰이 든 URL은 공개 파일에 영구 기록되므로 막는다
          const secretKey = /^(token|access_?token|auth|authorization|key|api_?key|apikey|secret|sig|signature|session|sid|password|pwd|x-amz-.*|x-goog-.*)$/i;
          for (const [k, val] of u.searchParams) {
            if (secretKey.test(k) || /^[A-Za-z0-9_\-+/=.]{24,}$/.test(val)) { errors.push('URL의 주소 뒤 인자(' + k + ')에 토큰·서명으로 보이는 값이 있습니다. 공개 파일에 남으므로 해당 부분을 지우고 입력해 주세요'); break; }
          }
          if (u.hash) url = url.slice(0, url.indexOf('#')); // 조각(#...)은 출처 식별에 필요 없어 제거
        }
      } catch (e) { errors.push('원본 출처 URL을 올바르게 입력해 주세요 (예: https://example.org/photo)'); }
      if (!hasOwn(TYPES, p.type)) errors.push('사용 허가 근거 종류를 선택해 주세요');
      const basis = String(p.basis || '').trim();
      if (basis.length < 2) errors.push('사용 허가 근거 내용을 입력해 주세요 (예: CC BY 4.0)');
      else if (basis.length > 200) errors.push('근거 내용은 200자 이하로 적어 주세요');
      if (errors.length) return { ok: false, errors };
      return { ok: true, value: { own: false, url, type: p.type, basis } };
    }

    function text(v, date) {
      const o = { schema: KEY, version: 1, tool: 'jjal-card-studio', created: date || new Date().toISOString().slice(0, 10) };
      if (v.own) o.creator = 'self';
      else { o.creator = 'third-party'; o.source_url = v.url; o.permission_type = v.type; o.permission_label = TYPES[v.type]; o.permission = v.basis; }
      return JSON.stringify(o);
    }

    function embedPng(u8, txt) {
      const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
      if (u8.length < 33 || sig.some((v, i) => u8[i] !== v)) throw new Error('PNG가 아닙니다');
      const body = enc(txt), k = enc(KEY);
      const data = new Uint8Array(k.length + 5 + body.length);
      data.set(k, 0); data.set(body, k.length + 5); // keyword\0 flag\0 method\0 lang\0 translated\0 text
      const chunk = new Uint8Array(12 + data.length), dv = new DataView(chunk.buffer);
      dv.setUint32(0, data.length); chunk.set(enc('iTXt'), 4); chunk.set(data, 8);
      dv.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
      const out = new Uint8Array(u8.length + chunk.length);
      out.set(u8.subarray(0, 33), 0); out.set(chunk, 33); out.set(u8.subarray(33), 33 + chunk.length); // IHDR 바로 뒤
      return out;
    }

    function embedJpeg(u8, txt) {
      if (u8[0] !== 0xff || u8[1] !== 0xd8) throw new Error('JPEG가 아닙니다');
      const payload = enc(KEY + ':' + txt);
      if (payload.length + 2 > 65535) throw new Error('메타데이터가 너무 깁니다');
      const seg = new Uint8Array(4 + payload.length);
      seg[0] = 0xff; seg[1] = 0xfe; seg[2] = (payload.length + 2) >> 8; seg[3] = (payload.length + 2) & 255; seg.set(payload, 4);
      // JFIF APP0는 SOI 바로 뒤에 있어야 하므로, 있으면 그 뒤에 넣는다
      let at = 2;
      if (u8[2] === 0xff && u8[3] === 0xe0) at = Math.min(u8.length, 4 + ((u8[4] << 8) | u8[5]));
      const out = new Uint8Array(u8.length + seg.length);
      out.set(u8.subarray(0, at), 0); out.set(seg, at); out.set(u8.subarray(at), at + seg.length);
      return out;
    }

    function embed(u8, type, txt) { return type === 'image/png' ? embedPng(u8, txt) : embedJpeg(u8, txt); }

    /* 파일에서 기록을 다시 읽는다(검증·확인용). 없으면 null */
    function read(u8) {
      const dec = (a) => new TextDecoder().decode(a);
      if (u8[0] === 0x89) {
        let i = 8;
        while (i + 12 <= u8.length) {
          const dv = new DataView(u8.buffer, u8.byteOffset + i), len = dv.getUint32(0), type = dec(u8.subarray(i + 4, i + 8));
          if (type === 'iTXt') {
            const d = u8.subarray(i + 8, i + 8 + len), z = d.indexOf(0);
            if (dec(d.subarray(0, z)) === KEY) return dec(d.subarray(z + 5));
          }
          if (type === 'IEND') break;
          i += 12 + len;
        }
      } else if (u8[0] === 0xff && u8[1] === 0xd8) {
        let i = 2;
        while (i + 4 <= u8.length && u8[i] === 0xff) {
          const m = u8[i + 1], len = (u8[i + 2] << 8) | u8[i + 3];
          if (m === 0xfe) { const s = dec(u8.subarray(i + 4, i + 2 + len)); if (s.startsWith(KEY + ':')) return s.slice(KEY.length + 1); }
          if (m === 0xda) break;
          i += 2 + len;
        }
      }
      return null;
    }

    return { KEY, TYPES, validate, text, embed, read };
  })();

  g.StudioCore = { Meta, RATIOS, FONT, MAX_TEXTS, MAX_CHARS, MAX_TEMPLATES, newId, makeText, sizeCanvas, wrapText, layoutText, drawLayout, drawScene, sniff, loadImageFile, applyImage, replaceImage, makeSampleCanvas, validateTemplate, parseImport, Store, graphemes };
})(window);
