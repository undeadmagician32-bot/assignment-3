/* 짤·카드 스튜디오 — 화면 로직 */
(function () {
  'use strict';
  const C = window.StudioCore, Store = C.Store;
  const $ = (id) => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d');
  const DRAFT_KEY = 'jjal-studio.draft.v1';

  const S = {
    ratio: '1:1', bg: '#1f2a44', img: null, imgName: '', imgInfo: '', fit: 'cover', zoom: 1, imgX: 0, imgY: 0,
    texts: [C.makeText({ text: '여기에 문구를 입력하세요', y: 0.5 })], sel: null, activeTpl: null,
    imgSynth: true, prov: null // 합성 이미지 여부, 사용자가 입력한 출처·권한
  };
  S.sel = S.texts[0].id;
  let layouts = [];
  let editingId = null, confirmId = null;

  const sel = () => S.texts.find((t) => t.id === S.sel) || S.texts[0] || null;
  const pct = (v) => Math.round(v * 100) + '%';

  function say(msg, err) { const s = $('status'); s.textContent = msg; s.classList.toggle('err', !!err); }

  /* ---------- 그리기 ---------- */
  function draw() {
    C.sizeCanvas(cv, S.ratio);
    layouts = C.drawScene(ctx, S);
    const [W, H] = C.RATIOS[S.ratio];
    $('dim').textContent = '출력 크기 ' + W + '×' + H + ' px · 미리보기와 내려받은 파일은 같은 그림입니다';
    updateOverlay(W, H);
    updateWarn();
    saveDraftSoon();
  }

  function updateOverlay(W, H) {
    const t = sel(), L = t && layouts.find((l) => l.id === t.id), b = $('selBox');
    if (!L || L.empty) { b.hidden = true; return; }
    b.hidden = false;
    b.style.left = (L.rect.x / W) * 100 + '%'; b.style.top = (L.rect.y / H) * 100 + '%';
    b.style.width = (L.rect.w / W) * 100 + '%'; b.style.height = (L.rect.h / H) * 100 + '%';
  }

  function updateWarn() {
    const t = sel(), L = t && layouts.find((l) => l.id === t.id), w = $('textWarn');
    const msgs = [];
    if (L) {
      if (L.empty) msgs.push('문구가 비어 있어 이 문구는 그려지지 않습니다.');
      if (L.shrunk) msgs.push('문구가 길어 크기를 자동으로 줄였습니다 (' + Math.round(L.size) + 'px).');
      if (L.truncated) msgs.push('문구가 너무 길어 일부가 … 로 잘렸거나 2000자를 넘은 부분은 제외됩니다.');
    }
    w.hidden = !msgs.length; w.textContent = msgs.join(' ');
  }

  /* ---------- 컨트롤 ↔ 상태 ---------- */
  function syncControls() {
    document.querySelectorAll('.segbtn').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.ratio === S.ratio)));
    $('fit').value = S.fit; $('bg').value = S.bg;
    $('zoom').value = S.zoom; $('zoomO').textContent = S.zoom.toFixed(1) + '×';
    $('imgX').value = S.imgX; $('imgY').value = S.imgY;
    $('provInfo').textContent = provLabel();
    $('imgInfo').textContent = S.img ? '현재 이미지: ' + S.imgName + ' (' + S.imgInfo + ')' : '현재 이미지: 없음 (배경색만 사용)';
    renderLayers();
    const t = sel();
    for (const id of ['tText', 'tX', 'tY', 'tSize', 'tWidth', 'tColor', 'tAlign', 'tBold', 'tStroke', 'delText']) $(id).disabled = !t;
    if (!t) { $('count').textContent = ''; return; }
    $('tText').value = t.text;
    $('count').textContent = '(' + C.graphemes(t.text).length + '자)';
    $('tX').value = Math.round(t.x * 100); $('xO').textContent = pct(t.x);
    $('tY').value = Math.round(t.y * 100); $('yO').textContent = pct(t.y);
    $('tSize').value = t.size * 100; $('sO').textContent = (t.size * 100).toFixed(1) + '%';
    $('tWidth').value = Math.round(t.width * 100); $('wO').textContent = pct(t.width);
    $('tColor').value = t.color; $('tAlign').value = t.align;
    $('tBold').checked = !!t.bold; $('tStroke').checked = !!t.stroke;
  }

  function renderLayers() {
    const box = $('layerList');
    box.textContent = '';
    S.texts.forEach((t, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(t.id === S.sel));
      b.dataset.id = t.id;
      b.textContent = (i + 1) + '. ' + (C.graphemes(t.text.trim().replace(/\s+/g, ' ')).slice(0, 10).join('') || '(빈 문구)');
      box.appendChild(b);
    });
    $('addText').disabled = S.texts.length >= C.MAX_TEXTS;
  }

  function bindText(id, ev, fn) {
    $(id).addEventListener(ev, () => { const t = sel(); if (!t) return; fn(t, $(id)); syncMini(t); draw(); });
  }
  function syncMini(t) {
    $('xO').textContent = pct(t.x); $('yO').textContent = pct(t.y);
    $('sO').textContent = (t.size * 100).toFixed(1) + '%'; $('wO').textContent = pct(t.width);
    $('count').textContent = '(' + C.graphemes(t.text).length + '자)';
  }
  bindText('tText', 'input', (t, e) => { t.text = e.value; const chip = document.querySelector('.chip[data-id="' + t.id + '"]'); if (chip) renderLayers(); });
  bindText('tX', 'input', (t, e) => { t.x = e.value / 100; });
  bindText('tY', 'input', (t, e) => { t.y = e.value / 100; });
  bindText('tSize', 'input', (t, e) => { t.size = e.value / 100; });
  bindText('tWidth', 'input', (t, e) => { t.width = e.value / 100; });
  bindText('tColor', 'input', (t, e) => { t.color = e.value; });
  bindText('tAlign', 'change', (t, e) => { t.align = e.value; });
  bindText('tBold', 'change', (t, e) => { t.bold = e.checked; });
  bindText('tStroke', 'change', (t, e) => { t.stroke = e.checked; });

  $('layerList').addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    S.sel = b.dataset.id; syncControls(); draw();
  });
  $('addText').addEventListener('click', () => {
    if (S.texts.length >= C.MAX_TEXTS) return;
    const t = C.makeText({ text: '새 문구', y: Math.min(0.9, 0.3 + S.texts.length * 0.15) });
    S.texts.push(t); S.sel = t.id; syncControls(); draw();
  });
  $('delText').addEventListener('click', () => {
    const t = sel(); if (!t) return;
    S.texts = S.texts.filter((x) => x.id !== t.id); S.sel = S.texts.length ? S.texts[0].id : null;
    syncControls(); draw(); say('문구를 삭제했습니다.');
  });
  $('probe').addEventListener('click', () => {
    const probe = '▌가장자리 검사▐\n이 줄은 일부러 길게 써서 줄바꿈 위치를 확인합니다 ABCDEFGHIJKLMNOPQRSTUVWXYZ 😀👨‍👩‍👧‍👦\n끝줄 ▼';
    let t = sel();
    if (!t) { t = C.makeText({}); S.texts.push(t); S.sel = t.id; }
    Object.assign(t, { text: probe, x: 0.5, y: 0.5, size: 0.05, width: 0.9 });
    syncControls(); draw(); say('검사 문구를 넣었습니다. 비율을 바꾸거나 ‘화면↔파일 대조’를 눌러 확인하세요.');
  });

  /* 이미지 도구 */
  $('fit').addEventListener('change', (e) => { S.fit = e.target.value; draw(); });
  $('bg').addEventListener('input', (e) => { S.bg = e.target.value; draw(); });
  $('zoom').addEventListener('input', (e) => { S.zoom = +e.target.value; $('zoomO').textContent = S.zoom.toFixed(1) + '×'; draw(); });
  $('imgX').addEventListener('input', (e) => { S.imgX = +e.target.value; draw(); });
  $('imgY').addEventListener('input', (e) => { S.imgY = +e.target.value; draw(); });
  let loadSeq = 0; // 가장 나중에 요청한 불러오기만 반영한다
  $('rmImg').addEventListener('click', () => {
    loadSeq++; // 로드 중이던 이미지가 되살아나지 않게
    if (S.img && S.img.close) S.img.close();
    S.img = null; S.imgName = ''; S.imgInfo = ''; S.imgSynth = false; S.prov = null; syncControls(); draw(); say('이미지를 제거했습니다.');
  });
  $('guide').addEventListener('change', (e) => $('stage').classList.toggle('guide', e.target.checked));
  document.querySelectorAll('.segbtn').forEach((b) => b.addEventListener('click', () => { S.ratio = b.dataset.ratio; syncControls(); draw(); }));

  async function handleFile(file, synth) {
    const err = $('imgError'), seq = ++loadSeq;
    let r;
    try { r = await C.loadImageFile(file); } // 읽기만 하고 S는 건드리지 않는다
    catch (e) { r = { ok: false, reason: '파일을 읽는 중 오류가 발생했습니다.' }; }
    if (seq !== loadSeq) { if (r.ok && r.bitmap.close) r.bitmap.close(); return; } // 더 새로운 요청이 있음
    if (!r.ok) {
      err.hidden = false; err.textContent = '불러오지 못했습니다: ' + r.reason + ' (기존 작업은 그대로 유지됩니다)';
      say('파일을 거부했습니다. 기존 작업은 그대로입니다.', true);
      return;
    }
    C.applyImage(S, r);
    S.imgSynth = !!synth; S.prov = null; // 새 이미지마다 출처를 다시 확인한다
    err.hidden = true; err.textContent = '';
    syncControls(); draw(); say('이미지를 불러왔습니다: ' + S.imgInfo);
  }
  $('file').addEventListener('change', async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) await handleFile(f); });

  const stage = $('stage');
  ['dragenter', 'dragover'].forEach((ev) => stage.addEventListener(ev, (e) => { e.preventDefault(); stage.classList.add('drop'); }));
  ['dragleave', 'drop'].forEach((ev) => stage.addEventListener(ev, (e) => { e.preventDefault(); stage.classList.remove('drop'); }));
  stage.addEventListener('drop', async (e) => { const f = e.dataTransfer && e.dataTransfer.files[0]; if (f) await handleFile(f); });
  // 스테이지 밖에 놓아도 브라우저가 파일을 열어 앱을 벗어나지 않게 막는다
  ['dragover', 'drop'].forEach((ev) => window.addEventListener(ev, (e) => {
    if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
    e.preventDefault();
    if (ev === 'drop' && !stage.contains(e.target)) say('이미지는 미리보기 위에 놓아 주세요.', true);
  }));

  function sample(kind, type, ext) {
    const c = C.makeSampleCanvas(kind);
    c.toBlob((b) => { if (!b) { say('샘플 이미지를 만들지 못했습니다.', true); return; } handleFile(new File([b], 'sample-' + kind + '.' + ext, { type }), true); }, type, 0.92);
  }
  $('sampleSquare').addEventListener('click', () => sample('square', 'image/png', 'png'));
  $('sampleLandscape').addEventListener('click', () => sample('landscape', 'image/jpeg', 'jpg'));
  $('samplePortrait').addEventListener('click', () => sample('portrait', 'image/jpeg', 'jpg'));
  $('sampleAlpha').addEventListener('click', () => sample('alpha', 'image/png', 'png'));

  /* 미리보기 위에서 끌어 문구 이동 */
  let drag = null;
  $('ov').addEventListener('pointerdown', (e) => {
    const r = cv.getBoundingClientRect(), [W, H] = C.RATIOS[S.ratio];
    const px = ((e.clientX - r.left) / r.width) * W, py = ((e.clientY - r.top) / r.height) * H;
    const hit = layouts.slice().reverse().find((l) => !l.empty && px >= l.rect.x && px <= l.rect.x + l.rect.w && py >= l.rect.y && py <= l.rect.y + l.rect.h);
    if (!hit) return;
    S.sel = hit.id; const t = sel();
    drag = { dx: t.x - px / W, dy: t.y - py / H };
    $('ov').setPointerCapture(e.pointerId); syncControls(); draw();
  });
  $('ov').addEventListener('pointermove', (e) => {
    if (!drag) return;
    const r = cv.getBoundingClientRect(), t = sel();
    t.x = Math.min(1, Math.max(0, drag.dx + (e.clientX - r.left) / r.width));
    t.y = Math.min(1, Math.max(0, drag.dy + (e.clientY - r.top) / r.height));
    syncControls(); draw();
  });
  const endDrag = () => { drag = null; };
  $('ov').addEventListener('pointerup', endDrag); $('ov').addEventListener('pointercancel', endDrag);

  /* ---------- 내려받기 · 대조 ---------- */
  async function renderBlob(ratio, type) {
    try { await document.fonts.ready; } catch (e) { /* 시스템 글꼴만 사용 */ }
    const c = document.createElement('canvas');
    C.sizeCanvas(c, ratio);
    C.drawScene(c.getContext('2d'), Object.assign({}, S, { ratio }));
    return new Promise((res) => c.toBlob(res, type, 0.92));
  }
  function stamp() { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()); }
  function save(blob, name) {
    const a = document.createElement('a'), u = URL.createObjectURL(blob);
    a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 4000);
  }
  /* ---------- 출처·사용 권한 (파일마다 메타데이터로 기록) ---------- */
  // 직접 입력한 값이 우선, 없으면 합성 이미지·이미지 없음은 자동으로 '본인 제작'
  function currentProv() {
    if (S.prov) return S.prov;
    if (!S.img || S.imgSynth) return { own: true, auto: true };
    return null;
  }
  function provLabel() {
    const p = currentProv();
    if (!p) return '출처 기록: 미입력 (내려받을 때 묻습니다)';
    if (p.own) return '출처 기록: 본인 제작' + (p.auto ? ' (자동)' : '');
    return '출처 기록: 원본 ' + p.url + ' · ' + C.Meta.TYPES[p.type] + ' ' + p.basis;
  }
  let provResolve = null;
  function askProv() {
    const dlg = $('provDlg'), p = S.prov;
    const radios = document.getElementsByName('provOwn');
    const own = p ? p.own : !S.img || S.imgSynth;
    radios[0].checked = own; radios[1].checked = !own;
    $('provOther').hidden = own;
    $('provUrl').value = p && !p.own ? p.url : ''; $('provType').value = p && !p.own ? p.type : 'license'; $('provBasis').value = p && !p.own ? p.basis : '';
    $('provErr').hidden = true;
    if (provResolve) provResolve(null);
    return new Promise((res) => { provResolve = res; if (!dlg.open) dlg.showModal(); });
  }
  function closeProv(val) { const r = provResolve; provResolve = null; if ($('provDlg').open) $('provDlg').close(); if (r) r(val); }
  document.getElementsByName('provOwn').forEach((r) => r.addEventListener('change', () => { $('provOther').hidden = document.getElementsByName('provOwn')[0].checked; }));
  $('provOk').addEventListener('click', () => {
    const own = document.getElementsByName('provOwn')[0].checked;
    const v = C.Meta.validate(own ? { own: true } : { own: false, url: $('provUrl').value, type: $('provType').value, basis: $('provBasis').value });
    if (!v.ok) { $('provErr').hidden = false; $('provErr').textContent = v.errors.join(' · '); return; }
    S.prov = v.value; syncControls(); closeProv(v.value);
  });
  $('provCancel').addEventListener('click', () => closeProv(null));
  $('provDlg').addEventListener('cancel', () => { const r = provResolve; provResolve = null; if (r) r(null); });
  $('provBtn').addEventListener('click', () => askProv());
  async function ensureProv() { return currentProv() || (await askProv()); }

  /* PNG·JPEG 파일 바이트 안에 출처·권한 기록을 넣는다 */
  async function withProvenance(blob, type, prov) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return new Blob([C.Meta.embed(bytes, type, C.Meta.text(prov))], { type });
  }

  async function download(ratio, type, ext) {
    const prov = await ensureProv();
    if (!prov) { say('출처·사용 권한을 기록해야 내려받을 수 있습니다. 입력하지 않아 내려받지 않았습니다.', true); return false; }
    let b = await renderBlob(ratio, type);
    if (!b) { say('파일을 만들지 못했습니다.', true); return false; }
    try { b = await withProvenance(b, type, prov); } catch (e) { say('출처 기록을 파일에 넣지 못해 내려받지 않았습니다: ' + e.message, true); return false; }
    save(b,'jjal-' + ratio.replace(':', 'x') + '-' + stamp() + '.' + ext);
    return true;
  }
  $('dlPng').addEventListener('click', async () => { if (await download(S.ratio, 'image/png', 'png')) say('PNG를 내려받았습니다 (' + S.ratio + ').'); });
  $('dlJpg').addEventListener('click', async () => { if (await download(S.ratio, 'image/jpeg', 'jpg')) say('JPEG를 내려받았습니다 (' + S.ratio + ').'); });
  $('dlAll').addEventListener('click', async () => {
    if (!(await ensureProv())) { say('출처·사용 권한을 기록해야 내려받을 수 있습니다. 입력하지 않아 내려받지 않았습니다.', true); return; }
    const failed = [];
    for (const r of Object.keys(C.RATIOS)) { if (!(await download(r, 'image/png', 'png'))) failed.push(r); await new Promise((x) => setTimeout(x, 250)); }
    if (failed.length) say('내려받지 못한 비율이 있습니다: ' + failed.join(', '), true);
    else say('세 비율 PNG를 내려받았습니다. 브라우저가 여러 파일 허용을 물으면 허용해 주세요.');
  });

  async function compare(ratio) {
    const P = document.createElement('canvas'); C.sizeCanvas(P, ratio);
    const Lp = C.drawScene(P.getContext('2d'), Object.assign({}, S, { ratio }));
    const blob = await renderBlob(ratio, 'image/png');
    const bmp = await createImageBitmap(blob);
    const F = document.createElement('canvas'); F.width = bmp.width; F.height = bmp.height;
    F.getContext('2d').drawImage(bmp, 0, 0);
    let diff = -1;
    if (F.width === P.width && F.height === P.height) {
      const a = P.getContext('2d').getImageData(0, 0, P.width, P.height).data, b = F.getContext('2d').getImageData(0, 0, F.width, F.height).data;
      diff = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) diff++;
    }
    return { ratio, P, F, diff, lines: Lp.map((l) => l.lines.length).join('/') };
  }
  $('verify').addEventListener('click', async () => {
    const out = $('verifyOut'); out.textContent = '대조 중…';
    const rows = [];
    for (const r of Object.keys(C.RATIOS)) rows.push(await compare(r));
    out.textContent = '';
    rows.forEach((r) => {
      const row = document.createElement('div'); row.className = 'vrow';
      const ok = r.diff === 0;
      const s = document.createElement('span');
      const b = document.createElement('b'); b.className = ok ? 'pass' : 'fail'; b.textContent = ok ? 'PASS' : 'FAIL';
      s.append(r.ratio + ' ', b, ' · 다른 픽셀 ' + r.diff + ' · 문구별 줄 수 ' + (r.lines || '-'));
      row.append(s);
      for (const [label, c] of [['미리보기', r.P], ['내려받은 파일', r.F]]) {
        const w = document.createElement('figure'); w.style.margin = 0;
        const cap = document.createElement('figcaption'); cap.className = 'hint'; cap.textContent = label;
        w.append(c, cap); row.append(w);
      }
      out.append(row);
    });
    const allOk = rows.every((r) => r.diff === 0);
    say(allOk ? '세 화면비 모두 미리보기와 파일이 일치합니다.' : '일치하지 않는 비율이 있습니다.', !allOk);
  });

  /* ---------- 템플릿 ---------- */
  function snapshot() {
    return {
      ratio: S.ratio, bg: S.bg, fit: S.fit, zoom: S.zoom, imgX: S.imgX, imgY: S.imgY,
      texts: S.texts.map((t) => ({ id: t.id, text: t.text, x: t.x, y: t.y, size: t.size, width: t.width, color: t.color, stroke: t.stroke, bold: t.bold, align: t.align }))
    };
  }
  function applyTemplate(tp) {
    S.ratio = tp.ratio; S.bg = tp.bg; S.fit = tp.fit; S.zoom = tp.zoom; S.imgX = tp.imgX; S.imgY = tp.imgY;
    S.texts = tp.texts.map((t) => C.makeText(t));
    S.sel = S.texts.length ? S.texts[0].id : null; S.activeTpl = tp.id;
  }
  const tplMsg = (m, err) => { const e = $('tplMsg'); e.textContent = m; e.style.color = err ? 'var(--err)' : ''; };

  function renderTemplates() {
    const { templates, error } = Store.load();
    $('tplCount').textContent = '(' + templates.length + '개)';
    const ul = $('tplList'); ul.textContent = '';
    if (error) tplMsg(error, true);
    if (!templates.length) { const li = document.createElement('li'); li.className = 'hint'; li.textContent = '저장된 템플릿이 없습니다. 현재 편집 내용을 ‘새로 저장’해 보세요.'; ul.append(li); return; }
    templates.forEach((tp) => {
      const li = document.createElement('li'); li.dataset.id = tp.id; if (tp.id === S.activeTpl) li.classList.add('active');
      const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = tp.name;
      const meta = document.createElement('div'); meta.className = 'meta';
      meta.textContent = tp.ratio + ' · 문구 ' + tp.texts.length + '개' + (tp.id === S.activeTpl ? ' · 편집 중' : '');
      li.append(nm, meta);
      const acts = document.createElement('div'); acts.className = 'acts';
      const mk = (act, label, cls) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ' + (cls || ''); b.dataset.act = act; b.dataset.id = tp.id; b.textContent = label; acts.append(b); };
      if (editingId === tp.id) {
        const inp = document.createElement('input'); inp.type = 'text'; inp.maxLength = 40; inp.value = tp.name; inp.dataset.rename = tp.id; inp.setAttribute('aria-label', '새 이름');
        li.insertBefore(inp, meta); mk('rename-ok', '이름 저장', 'primary'); mk('rename-cancel', '취소');
      } else if (confirmId === tp.id) {
        mk('del-ok', '정말 삭제', 'danger'); mk('del-cancel', '취소');
      } else {
        mk('load', '불러오기'); mk('overwrite', '현재 내용으로 수정'); mk('rename', '이름 변경'); mk('delete', '삭제', 'danger');
      }
      li.append(acts); ul.append(li);
    });
  }

  $('tplSave').addEventListener('click', () => {
    const n = Store.load().templates.length;
    const name = $('tplName').value.trim() || '템플릿 ' + (n + 1);
    const r = Store.create(Object.assign({ name }, snapshot()));
    if (!r.ok) { tplMsg('저장하지 못했습니다: ' + r.error, true); return; }
    S.activeTpl = r.template.id; $('tplName').value = '';
    tplMsg('저장했습니다: ' + name + ' (총 ' + (n + 1) + '개)'); renderTemplates();
  });

  $('tplList').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const id = b.dataset.id, act = b.dataset.act;
    const list = Store.load().templates, tp = list.find((x) => x.id === id);
    if (!tp) { tplMsg('대상 템플릿을 찾을 수 없습니다 (이미 삭제되었을 수 있어요).', true); renderTemplates(); return; }
    if (act === 'load') { applyTemplate(tp); syncControls(); draw(); tplMsg('불러왔습니다: ' + tp.name); }
    else if (act === 'overwrite') { const r = Store.update(id, snapshot()); if (r.ok) { S.activeTpl = id; tplMsg('수정했습니다: ' + tp.name); } else tplMsg('수정 실패: ' + r.error, true); }
    else if (act === 'rename') { editingId = id; confirmId = null; }
    else if (act === 'rename-cancel') { editingId = null; }
    else if (act === 'rename-ok') {
      const inp = document.querySelector('input[data-rename="' + id + '"]'), nm = inp ? inp.value.trim() : '';
      if (!nm) { tplMsg('이름을 입력해 주세요.', true); return; }
      const r = Store.update(id, { name: nm }); if (r.ok) { editingId = null; tplMsg('이름을 바꿨습니다: ' + nm); } else tplMsg('수정 실패: ' + r.error, true);
    }
    else if (act === 'delete') { confirmId = id; editingId = null; }
    else if (act === 'del-cancel') { confirmId = null; }
    else if (act === 'del-ok') {
      const r = Store.remove(id); confirmId = null;
      if (r.ok) { if (S.activeTpl === id) S.activeTpl = null; tplMsg('삭제했습니다: ' + tp.name + ' (남은 ' + (list.length - 1) + '개)'); } else tplMsg('삭제 실패: ' + r.error, true);
    }
    renderTemplates();
  });

  /* ---------- JSON 가져오기·내보내기 ---------- */
  function doImport(text) {
    const before = Store.load().templates, err = $('jsonErr'), msg = $('jsonMsg');
    err.textContent = '';
    const r = C.parseImport(text, before);
    if (!r.ok) {
      msg.textContent = '가져오지 않았습니다. 저장된 템플릿은 그대로 ' + before.length + '개입니다.'; msg.style.color = 'var(--err)';
      r.errors.slice(0, 6).forEach((m) => { const li = document.createElement('li'); li.textContent = m; err.append(li); });
      if (r.errors.length > 6) { const li = document.createElement('li'); li.textContent = '… 외 ' + (r.errors.length - 6) + '건'; err.append(li); }
      return;
    }
    const s = Store.save(before.concat(r.templates));
    if (!s.ok) { msg.textContent = '저장 실패: ' + s.error + ' (기존 ' + before.length + '개 유지)'; msg.style.color = 'var(--err)'; return; }
    msg.textContent = '가져오기 완료: ' + r.templates.length + '개 추가 (이전 ' + before.length + '개 → 이후 ' + (before.length + r.templates.length) + '개)'; msg.style.color = '';
    $('jsonText').value = ''; renderTemplates();
  }
  $('jsonIn').addEventListener('click', () => doImport($('jsonText').value));
  $('jsonFile').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    $('jsonErr').textContent = '';
    if (f.size > 1048576) { $('jsonMsg').textContent = '가져오지 않았습니다. 파일이 1MB를 넘습니다.'; $('jsonMsg').style.color = 'var(--err)'; return; }
    doImport(await f.text());
  });
  $('jsonOut').addEventListener('click', () => {
    const list = Store.load().templates;
    if (!list.length) { $('jsonMsg').textContent = '내보낼 템플릿이 없습니다.'; return; }
    const body = JSON.stringify({ app: 'jjal-card-studio', version: 1, templates: list }, null, 2);
    save(new Blob([body], { type: 'application/json' }), 'jjal-templates-' + stamp() + '.json');
    $('jsonMsg').textContent = list.length + '개 템플릿을 JSON으로 내보냈습니다.'; $('jsonMsg').style.color = '';
  });

  /* ---------- 작업 초안 자동 저장(이미지 제외) ---------- */
  let timer = null;
  function saveDraftSoon() { clearTimeout(timer); timer = setTimeout(() => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(Object.assign({ name: '초안' }, snapshot()))); } catch (e) { /* 저장소 사용 불가 */ } }, 400); }
  function loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY); if (!raw) return;
      const r = C.validateTemplate(JSON.parse(raw), 0);
      if (!r.errors.length) { applyTemplate(r.value); S.activeTpl = null; }
    } catch (e) { /* 초안 무시 */ }
  }

  /* ---------- 시작 ---------- */
  loadDraft();
  syncControls(); renderTemplates();
  const c0 = C.makeSampleCanvas('square');
  createImageBitmap(c0).then((bm) => { if (!S.img) { S.img = bm; S.imgName = '기본 샘플(합성)'; S.imgInfo = 'PNG 1200×1200'; } syncControls(); draw(); });
  draw();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  window.__studio = { S, draw }; // 검사용
})();
