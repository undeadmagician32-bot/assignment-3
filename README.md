# 짤·카드 스튜디오

이미지와 문구를 조합해 밈·카드·SNS 이미지를 만들고 PNG/JPEG로 내려받는 정적 웹앱입니다. 서버·빌드·로그인이 없습니다.

## 실행
- 정적 파일이므로 아무 정적 호스팅에 폴더째 올리면 됩니다. 로컬에서는 폴더에서 간단한 서버를 띄워 `index.html`을 여세요
  (예: `python -m http.server`). 파일을 더블클릭(file://)해도 동작합니다.
- 배포(로그인 없이 열리게): GitHub Pages / Netlify / Cloudflare Pages 등에서 이 폴더를 그대로 공개. `_headers`는 Netlify·Cloudflare용 보안 헤더입니다.

## 구조
- `js/core.js` — 그리기(`drawScene`), 줄바꿈·배치(`layoutText`), 파일 검사(`replaceImage`), 템플릿 검증·저장(`Store`, `parseImport`)
- `js/app.js` — 화면. 미리보기와 내려받기가 **같은 `drawScene`** 을 쓰므로 결과가 같다
- `tests.html` + `js/tests.js` — 극단 입력 12건·보조 검사(열면 자동 실행)
- `js/legacy-layout.js` — “수정 전 FAIL” 기록용 초기 구현(앱에서는 쓰지 않음)
- `samples/` 시험 입력, `finished/` 완성 이미지, `tools/make-samples.html` 생성기

## 설계 메모
- 좌표는 캔버스 비율(0~1), 템플릿은 안정된 `id`로만 수정·삭제
- 가져오기는 전체 검증 → 통과 시에만 저장(실패 시 기존 목록 불변)
- 템플릿에는 이미지를 저장하지 않음(저작권·용량·개인정보 이유)

※ 배포 시 CSP(_headers) 때문에 tools/make-samples.html(인라인 스크립트)은 동작하지 않으니 로컬에서만 쓰거나 배포에서 제외하세요.
