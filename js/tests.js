/* 극단 입력 12건 + 보조 검사. 같은 입력을 '수정 전(legacy)'과 '수정 후(현재)'에 모두 돌린다. */
(function () {
  'use strict';
  const C = window.StudioCore;
  const W = 1080;
  const mk = (o) => C.makeText(o);
  const tc = document.createElement('canvas'); tc.width = 1080; tc.height = 1920;
  const mctx = tc.getContext('2d');

  const inside = (L, w, h) => L.rect.x >= -0.5 && L.rect.y >= -0.5 && L.rect.x + L.rect.w <= w + 0.5 && L.rect.y + L.rect.h <= h + 0.5;
  const broken = (lines) => lines.some((l) => /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(l) || /^[‍️\u{1F3FB}-\u{1F3FF}]/u.test(l) || /‍$/.test(l));
  const rep = (s, n) => new Array(n + 1).join(s);

  /* 텍스트 배치 12건 중 이미지·파일 검사가 필요한 것은 run 에서 직접 처리 */
  const KO400 = rep('가나다 라마바사 아자차카 타파하 ', 20).slice(0, 400);
  const MIX = 'Hello 안녕하세요 ' + rep('Supercalifragilistic', 4) + ' 끝';
  const ZWJ = rep('👨‍👩‍👧‍👦🇰🇷👍🏽', 8);

  const cases = [
    { n: 1, name: '긴 한글 400자(공백 포함)', input: '한글 400자, 1:1, 크기 6%', expect: '문구 전체가 캔버스 안에 들어오고 잘리지 않음', layout: true,
      t: () => mk({ text: KO400, size: 0.06 }), ratio: '1:1', ok: (L, w, h) => inside(L, w, h) && !L.truncated },
    { n: 2, name: '영문·한글 혼합 + 공백 없는 80자 단어', input: MIX, expect: '모든 줄이 줄 너비 안, 캔버스 안', layout: true,
      t: () => mk({ text: MIX, size: 0.07, width: 0.8 }), ratio: '4:5', ok: (L, w, h) => inside(L, w, h) && L.lines.every((l) => { mctx.font = '700 ' + L.size + 'px ' + C.FONT; return mctx.measureText(l).width <= 0.8 * w + 1; }) },
    { n: 3, name: '줄바꿈·빈 줄 포함', input: '"첫째\\n\\n셋째\\n넷째"', expect: '정확히 4줄, 둘째 줄은 빈 줄', layout: true,
      t: () => mk({ text: '첫째\n\n셋째\n넷째' }), ratio: '1:1', ok: (L) => L.lines.length === 4 && L.lines[1] === '' },
    { n: 4, name: '이모지(가족 ZWJ·국기·피부톤) 좁은 폭', input: '이모지 8세트, 줄 너비 20%', expect: '이모지가 중간에서 쪼개지지 않음, 글자 보존', layout: true,
      t: () => mk({ text: ZWJ, size: 0.1, width: 0.2 }), ratio: '9:16', ok: (L, w, h) => !broken(L.lines) && L.lines.join('') === ZWJ && inside(L, w, h) },
    { n: 5, name: '빈 문구', input: '""', expect: '오류 없이 아무것도 그리지 않음', layout: true,
      t: () => mk({ text: '' }), ratio: '1:1', ok: (L) => L.lines.every((l) => l === '') },
    { n: 6, name: '공백·줄바꿈만 있는 문구', input: '"   \\n  "', expect: '오류 없이 아무것도 그리지 않음', layout: true,
      t: () => mk({ text: '   \n  ' }), ratio: '1:1', ok: (L) => L.lines.every((l) => l.trim() === '') },
    { n: 7, name: '세로 이미지(600×1200)를 1:1에 꽉 채우기', input: '위 절반 빨강/아래 절반 파랑 이미지', expect: '비율 유지·가장자리까지 채움(위 빨강·아래 파랑, 배경색 안 보임)', pixel: true },
    { n: 8, name: '가로 이미지(1600×400)를 9:16에 꽉 채우기', input: '단색(초록) 가로 이미지', expect: '네 모서리까지 이미지로 채워짐(배경색 없음)', pixel: true },
    { n: 9, name: '투명 PNG(왼쪽 투명)', input: '왼쪽 절반 알파 0인 PNG, 배경 #1f2a44', expect: 'PNG·JPEG 모두 투명 영역이 배경색으로 채워짐(검은색 아님)', pixel: true },
    { n: 10, name: '1만 자 붙여넣기', input: '가나다 ×3,334 = 10,002자', expect: '3초 안에 끝나고, 2000자로 제한되며 캔버스 안', layout: true, timed: true,
      t: () => mk({ text: rep('가나다 ', 3334) }), ratio: '1:1', ok: (L, w, h) => inside(L, w, h) && L.truncated },
    { n: 11, name: '잘못된 파일 연속 투입(GIF·텍스트·손상 PNG)', input: 'GIF 헤더, 텍스트 파일, PNG 헤더만 있는 손상 파일', expect: '모두 거부 사유를 돌려주고 기존 이미지·문구는 그대로', pixel: true },
    { n: 12, name: '극단 좌표·크기(x=-5, y=9, 크기 500%, 너비 900%)', input: '화면 밖 좌표와 범위 밖 값', expect: '문구가 캔버스 안으로 보정됨', layout: true,
      t: () => mk({ text: '가장자리 탈출 시도', x: -5, y: 9, size: 5, width: 9 }), ratio: '1:1', ok: (L, w, h) => inside(L, w, h) }
  ];

  const results = [];
  const px = (c, x, y) => Array.from(c.getContext('2d').getImageData(x, y, 1, 1).data);
  const near = (a, b, tol) => a.slice(0, 3).every((v, i) => Math.abs(v - b[i]) <= tol);
  const blobOf = (c, type) => new Promise((r) => c.toBlob(r, type, 0.92));
  const solid = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; };

  function runLayout(cs, fn) {
    const [w, h] = C.RATIOS[cs.ratio];
    const t0 = performance.now();
    let L, err = '';
    try { L = fn(mctx, cs.t(), w, h); } catch (e) { err = String(e); }
    const ms = Math.round(performance.now() - t0);
    if (!L) return { pass: false, detail: '예외: ' + err };
    let pass = cs.ok(L, w, h);
    if (cs.timed && ms > 3000) pass = false;
    return { pass, detail: '줄 ' + L.lines.length + ' · 박스 ' + Math.round(L.rect.x) + ',' + Math.round(L.rect.y) + ' ' + Math.round(L.rect.w) + '×' + Math.round(L.rect.h) + ' · ' + ms + 'ms' };
  }

  async function runPixel(n) {
    const base = { ratio: '1:1', bg: '#1f2a44', fit: 'cover', zoom: 1, imgX: 0, imgY: 0, texts: [] };
    const render = (s) => { const c = document.createElement('canvas'); C.sizeCanvas(c, s.ratio); C.drawScene(c.getContext('2d'), s); return c; };
    if (n === 7) {
      const img = solid(600, 1200, (x, w, h) => { x.fillStyle = '#ff0000'; x.fillRect(0, 0, w, h / 2); x.fillStyle = '#0000ff'; x.fillRect(0, h / 2, w, h / 2); });
      const c = render(Object.assign({}, base, { img }));
      const a = px(c, 540, 270), b = px(c, 540, 810), l = px(c, 1, 540), r = px(c, 1078, 540);
      const ok = near(a, [255, 0, 0], 4) && near(b, [0, 0, 255], 4) && !near(l, [0x1f, 0x2a, 0x44], 8) && !near(r, [0x1f, 0x2a, 0x44], 8);
      return { pass: ok, detail: '위 ' + a.slice(0, 3) + ' · 아래 ' + b.slice(0, 3) + ' · 좌 ' + l.slice(0, 3) };
    }
    if (n === 8) {
      const img = solid(1600, 400, (x, w, h) => { x.fillStyle = '#00ff00'; x.fillRect(0, 0, w, h); });
      const c = render(Object.assign({}, base, { ratio: '9:16', img }));
      const pts = [[1, 1], [1078, 1], [1, 1918], [1078, 1918], [540, 960]].map(([x, y]) => px(c, x, y));
      return { pass: pts.every((p) => near(p, [0, 255, 0], 4)), detail: '모서리·중앙 ' + pts.map((p) => p.slice(0, 3).join(',')).join(' | ') };
    }
    if (n === 9) {
      const img = solid(1000, 1000, (x) => { x.fillStyle = '#2ecc71'; x.fillRect(500, 0, 500, 1000); });
      const s = Object.assign({}, base, { img });
      const c = render(s), bg = [0x1f, 0x2a, 0x44];
      const pngB = await blobOf(c, 'image/png'), jpgB = await blobOf(c, 'image/jpeg');
      const dec = async (b) => { const bm = await createImageBitmap(b); const d = document.createElement('canvas'); d.width = bm.width; d.height = bm.height; d.getContext('2d').drawImage(bm, 0, 0); return px(d, 100, 540); };
      const p = await dec(pngB), j = await dec(jpgB);
      return { pass: near(p, bg, 2) && near(j, bg, 14), detail: 'PNG ' + p.slice(0, 3) + ' · JPEG ' + j.slice(0, 3) + ' · 기대 ' + bg };
    }
    if (n === 11) {
      const state = { img: { width: 7, height: 7, tag: 'KEEP' }, imgName: 'keep', imgInfo: 'x', texts: [mk({ text: '유지돼야 함' })], zoom: 1.5, imgX: 0.3, imgY: 0.1 };
      const before = JSON.stringify(state);
      const files = [
        new File([new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0, 0, 0, 0x3b])], 'a.png', { type: 'image/png' }),
        new File(['그냥 텍스트 파일입니다'], 'b.jpg', { type: 'image/jpeg' }),
        new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])], 'c.png', { type: 'image/png' }),
        new File([], 'empty.png', { type: 'image/png' })
      ];
      const reasons = [];
      for (const f of files) { const r = await C.replaceImage(state, f); if (r.ok) return { pass: false, detail: '거부되지 않음: ' + f.name }; reasons.push(r.reason.slice(0, 22)); }
      return { pass: JSON.stringify(state) === before, detail: '거부 ' + reasons.length + '건 · 상태 ' + (JSON.stringify(state) === before ? '변동 없음' : '변경됨') };
    }
  }

  async function main() {
    try { await document.fonts.ready; } catch (e) { /* */ }
    for (const cs of cases) {
      let before, after;
      if (cs.layout) { before = runLayout(cs, window.legacyLayout); after = runLayout(cs, C.layoutText); }
      else { before = { pass: null, detail: '수정 전 구현에 해당 기능이 없어 비교 생략' }; after = await runPixel(cs.n); }
      results.push({ n: cs.n, name: cs.name, input: cs.input, expect: cs.expect, before, after });
    }
    /* 보조 검사 */
    const extra = [];
    const stress = { bg: '#1f2a44', fit: 'cover', zoom: 1, imgX: 0, imgY: 0, img: C.makeSampleCanvas('landscape'),
      texts: [mk({ text: '▌검사▐\nLONG LINE ' + rep('가나다라마바사', 6) + ' 😀👨‍👩‍👧‍👦\n끝 ▼', size: 0.05, width: 0.9 })] };
    for (const r of Object.keys(C.RATIOS)) {
      const s = Object.assign({}, stress, { ratio: r });
      const P = document.createElement('canvas'); C.sizeCanvas(P, r); const Lp = C.drawScene(P.getContext('2d'), s);
      const blob = await blobOf(P, 'image/png');
      const bm = await createImageBitmap(blob);
      const F = document.createElement('canvas'); F.width = bm.width; F.height = bm.height; F.getContext('2d').drawImage(bm, 0, 0);
      const same = F.width === P.width && F.height === P.height;
      let diff = -1;
      if (same) { const a = P.getContext('2d').getImageData(0, 0, P.width, P.height).data, b = F.getContext('2d').getImageData(0, 0, F.width, F.height).data; diff = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) diff++; }
      extra.push({ id: 'T03-C' + { '1:1': 11, '4:5': 12, '9:16': 13 }[r], name: r + ' 미리보기↔파일 픽셀 대조', pass: diff === 0, detail: bm.width + '×' + bm.height + ' · 다른 픽셀 ' + diff + ' · 줄 수 ' + Lp[0].lines.length });
    }
    /* 메타데이터 */
    const mc = solid(300, 300, (x) => { x.fillStyle = '#abc'; x.fillRect(0, 0, 300, 300); });
    for (const [type, label] of [['image/png', 'PNG'], ['image/jpeg', 'JPEG']]) {
      const bytes = new Uint8Array(await (await blobOf(mc, type)).arrayBuffer());
      const txt = new TextDecoder('latin1').decode(bytes);
      const hits = ['Exif', 'GPS', 'eXIf', 'XMP', 'http://ns.adobe.com'].filter((k) => txt.includes(k));
      extra.push({ id: 'T03-C28', name: label + ' 내보내기 파일의 EXIF/GPS/XMP 표지', pass: hits.length === 0, detail: '발견 ' + hits.length + '건 ' + hits.join(',') });
    }
    /* 템플릿 CRUD·가져오기 (시험용 키 사용) */
    const St = C.Store, realKey = St.KEY; St.KEY = 'jjal-test.templates';
    try {
      localStorage.removeItem(St.KEY);
      const f = (name) => ({ name, ratio: '4:5', texts: [{ text: name, x: 0.5, y: 0.5, size: 0.07, color: '#ffffff' }] });
      const ids = ['A', 'B', 'C'].map((n) => St.create(f('템플릿' + n)).template.id);
      extra.push({ id: 'T03-C17', name: '템플릿 3개 생성', pass: St.load().templates.length === 3, detail: St.load().templates.length + '개' });
      St.update(ids[1], { name: 'B수정' });
      let l = St.load().templates;
      extra.push({ id: 'T03-C19', name: '수정이 대상 id에만 반영', pass: l.find((t) => t.id === ids[1]).name === 'B수정' && l.find((t) => t.id === ids[0]).name === '템플릿A', detail: l.map((t) => t.name).join(',') });
      St.remove(ids[0]); l = St.load().templates;
      extra.push({ id: 'T03-C20/21', name: '삭제 후 재로딩(새로고침 대용) 유지', pass: l.length === 2 && !l.find((t) => t.id === ids[0]), detail: l.map((t) => t.name).join(',') });
      const bad = [['문법 손상', '{"templates":[{"name":"x",'], ['필수 누락(texts)', JSON.stringify({ templates: [{ name: 'n', ratio: '1:1' }] })], ['필수 누락(name)', JSON.stringify([{ ratio: '1:1', texts: [] }])]];
      for (const [label, txt] of bad) { const r = C.parseImport(txt, St.load().templates); extra.push({ id: label === '문법 손상' ? 'T03-C23' : 'T03-C24', name: 'JSON ' + label + ' → 거부, 기존 유지', pass: !r.ok && St.load().templates.length === 2, detail: (r.errors || [])[0] }); }
      const good = C.parseImport(JSON.stringify({ templates: [f('복원1'), f('복원2')] }), St.load().templates);
      if (good.ok) St.save(St.load().templates.concat(good.templates));
      extra.push({ id: 'T03-C22', name: '정상 JSON 가져오기 → 복원', pass: good.ok && St.load().templates.length === 4, detail: '2개 → 4개' });
    } finally { localStorage.removeItem(St.KEY); St.KEY = realKey; }
    /* C27 출처·권한 메타데이터 */
    const M = C.Meta;
    const provCases = [
      ['본인 제작', { own: true }, true],
      ['타인 이미지: URL+라이선스', { own: false, url: 'https://example.org/p/1', type: 'license', basis: 'CC BY 4.0' }, true],
      ['타인 이미지: URL 없음', { own: false, type: 'license', basis: 'CC BY 4.0' }, false],
      ['타인 이미지: javascript: URL', { own: false, url: 'javascript:alert(1)', type: 'tos', basis: '약관' }, false],
      ['타인 이미지: 근거 종류 없음', { own: false, url: 'https://example.org/', basis: 'CC0' }, false],
      ['타인 이미지: 근거 내용 없음', { own: false, url: 'https://example.org/', type: 'class', basis: ' ' }, false],
      ['타인 이미지: URL에 비밀번호', { own: false, url: 'https://u:p@example.org/', type: 'class', basis: '수업' }, false],
      ['타인 이미지: URL에 token 인자', { own: false, url: 'https://cdn.example/p.jpg?token=abc', type: 'license', basis: 'CC0' }, false],
      ['타인 이미지: URL에 서명처럼 긴 값', { own: false, url: 'https://cdn.example/p.jpg?v=AbCdEfGhIjKlMnOpQrStUvWxYz0123', type: 'license', basis: 'CC0' }, false],
      ['타인 이미지: 평범한 쿼리(id=123)는 허용', { own: false, url: 'https://example.org/photo?id=123', type: 'license', basis: 'CC0' }, true]
    ];
    const frag = M.validate({ own: false, url: 'https://example.org/p#section-2', type: 'license', basis: 'CC0' });
    extra.push({ id: 'T03-C27', name: 'URL의 #조각은 제거되어 기록', pass: frag.ok && frag.value.url === 'https://example.org/p', detail: frag.value && frag.value.url });
    for (const [label, p, want] of provCases) extra.push({ id: 'T03-C27', name: '입력 검증: ' + label, pass: M.validate(p).ok === want, detail: want ? '허용' : '거부: ' + (M.validate(p).errors || [''])[0] });
    for (const [type, label] of [['image/png', 'PNG'], ['image/jpeg', 'JPEG']]) {
      const v = M.validate({ own: false, url: 'https://example.org/p/한글?x=1', type: 'tos', basis: '이용약관 제3조 (비영리 사용 허용)' }).value;
      const src = new Uint8Array(await (await blobOf(mc, type)).arrayBuffer());
      const out = M.embed(src, type, M.text(v, '2026-10-05'));
      const back = M.read(out), obj = back ? JSON.parse(back) : {};
      let decodes = true; try { const bm = await createImageBitmap(new Blob([out], { type })); decodes = bm.width === 300; } catch (e) { decodes = false; }
      const own = JSON.parse(M.read(M.embed(src, type, M.text({ own: true }, '2026-10-05'))));
      const txt = new TextDecoder('latin1').decode(out);
      const hits = ['Exif', 'GPS', 'eXIf', 'XMP', 'http://ns.adobe.com'].filter((k) => txt.includes(k));
      extra.push({ id: 'T03-C27', name: label + ' 파일 안에 출처·권한 삽입 → 다시 읽기·열림', pass: decodes && obj.source_url === v.url && obj.permission_type === 'tos' && obj.permission === v.basis && own.creator === 'self', detail: '열림 ' + decodes + ' · ' + back });
      if (type === 'image/jpeg') {
        const hasApp0 = src[2] === 0xff && src[3] === 0xe0;
        extra.push({ id: 'T03-C27', name: 'JPEG: JFIF APP0가 SOI 바로 뒤에 유지되고 그 다음에 주석 삽입', pass: hasApp0 && out[2] === 0xff && out[3] === 0xe0 && out[2 + 2 + ((out[4] << 8) | out[5])] === 0xff && out[2 + 2 + ((out[4] << 8) | out[5]) + 1] === 0xfe, detail: '원본 APP0 ' + hasApp0 });
      }
      extra.push({ id: 'T03-C28', name: label + ' 출처 삽입 후에도 EXIF/GPS/XMP 표지 없음', pass: hits.length === 0, detail: '발견 ' + hits.length + '건' });
    }
    /* 코드 리뷰 수정 검증 */
    const png = (w, h) => { const b = new Uint8Array(33); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]); const dv = new DataView(b.buffer); dv.setUint32(16, w); dv.setUint32(20, h); b[24] = 8; b[25] = 6; return new File([b], 'big.png', { type: 'image/png' }); };
    const big = await C.loadImageFile(png(6000, 8000));
    extra.push({ id: '리뷰2', name: '초과 해상도 PNG는 디코드 전에 거부, 크기 문구 정상', pass: !big.ok && big.reason.includes('6000×8000'), detail: big.reason });
    const dup = C.validateTemplate({ name: 'd', ratio: '1:1', texts: [0.3, 0.7].map((x) => ({ id: 'a', text: 'x', x, y: 0.5, size: 0.07, color: '#ffffff' })) }, 0);
    extra.push({ id: '리뷰3', name: '중복 문구 id는 새 id로 교체', pass: !dup.errors.length && dup.value.texts[0].id !== dup.value.texts[1].id, detail: dup.value.texts.map((t) => t.id).join(' / ') });
    extra.push({ id: '리뷰5', name: '2000자 경계에서 이모지가 쪼개지지 않음', pass: !broken([C.layoutText(mctx, mk({ text: rep('a', 1999) + '😀' }), 1080, 1080).lines.join('')]), detail: '1999자 + 이모지' });
    const St2 = C.Store, key0 = St2.KEY; St2.KEY = 'jjal-test2.templates';
    try {
      localStorage.removeItem(St2.KEY); localStorage.removeItem(St2.KEY + '.bak');
      const good = { name: 'g', ratio: '1:1', texts: [] };
      const bad = { name: 'b', ratio: '2:1', texts: [] };
      const noId = JSON.stringify({ templates: [Object.assign({ id: 'keep1' }, good), bad, good] });
      localStorage.setItem(St2.KEY, noId);
      const a = St2.load().templates, b2 = St2.load().templates;
      extra.push({ id: '리뷰1', name: '일부 무효·id 없는 저장 항목: id가 로드마다 같고 원본이 .bak 에 보관됨', pass: a.length === 2 && a.map((t) => t.id).join() === b2.map((t) => t.id).join() && localStorage.getItem(St2.KEY + '.bak') === noId, detail: 'id ' + a.map((t) => t.id).join(',') });
      localStorage.removeItem(St2.KEY + '.bak'); localStorage.setItem(St2.KEY, '{"templates":[{"name":"x"}');
      const l = St2.load(); St2.create({ name: 'new', ratio: '1:1', texts: [] });
      extra.push({ id: '리뷰1', name: '손상된 JSON 위에 저장해도 원본이 .bak 에 남음', pass: l.corrupt === true && localStorage.getItem(St2.KEY + '.bak') === '{"templates":[{"name":"x"}', detail: '손상 감지 ' + l.corrupt });
    } finally { localStorage.removeItem(St2.KEY); localStorage.removeItem(St2.KEY + '.bak'); St2.KEY = key0; }
    window.__results = { cases: results, extra };
    render();
  }

  function badge(p) { if (p === null) return '<span class="na">N/A</span>'; return p ? '<span class="pass">PASS</span>' : '<span class="fail">FAIL</span>'; }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  function render() {
    const R = window.__results, t = document.getElementById('t12'), x = document.getElementById('tx');
    t.innerHTML = '<tr><th>#</th><th>검사 입력</th><th>예상값</th><th>수정 전</th><th>수정 후</th><th>실측(수정 후)</th></tr>' +
      R.cases.map((r) => '<tr><td>' + r.n + '</td><td><b>' + esc(r.name) + '</b><br><small>' + esc(r.input) + '</small></td><td>' + esc(r.expect) + '</td><td>' + badge(r.before.pass) + '<br><small>' + esc(r.before.detail) + '</small></td><td>' + badge(r.after.pass) + '</td><td><small>' + esc(r.after.detail) + '</small></td></tr>').join('');
    x.innerHTML = '<tr><th>기준</th><th>검사</th><th>결과</th><th>실측</th></tr>' + R.extra.map((r) => '<tr><td>' + r.id + '</td><td>' + esc(r.name) + '</td><td>' + badge(r.pass) + '</td><td><small>' + esc(r.detail) + '</small></td></tr>').join('');
    const total = R.cases.length, ap = R.cases.filter((r) => r.after.pass).length, bf = R.cases.filter((r) => r.before.pass === false && r.after.pass).length;
    document.getElementById('sum').textContent = '12건 중 수정 후 PASS ' + ap + '건 · 수정 전 FAIL → 수정 후 PASS ' + bf + '건 · 보조 검사 ' + R.extra.filter((r) => r.pass).length + '/' + R.extra.length + ' PASS';
    document.body.dataset.done = '1';
  }
  main();
})();
