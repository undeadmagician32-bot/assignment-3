/* 수정 전(개발 초기) 단순 배치 구현 — "수정 전 FAIL" 기록용으로 보관.
   공백 기준으로만 줄바꿈하고, 긴 단어는 UTF-16 코드 단위로 자르며, 크기 자동 맞춤·좌표 보정·글자 수 제한이 없다. */
(function (g) {
  'use strict';
  function legacyLayout(ctx, t, W, H) {
    const size = t.size * W, maxW = t.width * W;
    ctx.font = (t.bold ? '700 ' : '400 ') + size + 'px ' + g.StudioCore.FONT;
    const lines = [];
    for (const para of String(t.text).split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        const trial = line ? line + ' ' + word : word;
        if (ctx.measureText(trial).width > maxW && line) { lines.push(line); line = word; } else line = trial;
        while (ctx.measureText(line).width > maxW && line.length > 1) {
          let i = line.length;
          while (i > 1 && ctx.measureText(line.slice(0, i)).width > maxW) i--;
          lines.push(line.slice(0, i)); line = line.slice(i);
        }
      }
      lines.push(line);
    }
    let bw = 0; lines.forEach((l) => { bw = Math.max(bw, ctx.measureText(l).width); });
    const lh = size * 1.25, bh = lines.length * lh;
    return { lines, size, lh, empty: !String(t.text).trim(), shrunk: false, truncated: false, rect: { x: t.x * W - bw / 2, y: t.y * H - bh / 2, w: bw, h: bh } };
  }
  g.legacyLayout = legacyLayout;
})(window);
