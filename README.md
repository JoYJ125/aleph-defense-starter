# BYTE BACK 방어전 시작 틀 R5

이 저장소는 1단계에서 학생 본인이 GitHub 저장소와 Vercel 배포를 만드는 출발점입니다. 실제 학생 자료, 토큰, 비밀키를 넣지 마세요.

## 현재 저장점: 4단계 기능 포함 (2026-10-07)

- Supabase Auth 이메일·비밀번호 로그인과 로그아웃을 제공합니다. 자료 API는 `src/verify-login.mjs`가 확인한 로그인 사용자 ID를 기준으로 처리합니다.
- 메모 목록과 단건 GET·PUT·DELETE는 로그인 사용자 본인의 메모에만 적용됩니다. URL이나 요청 본문의 `owner_id`를 소유권 판단에 사용하지 않으며, 추가 시 서버가 검증한 사용자 ID를 저장합니다.
- 첫 목록 요청 때 사용자별 기본 메모 네 건을 준비합니다. 사용자별 메모 ID를 분리하고, 이후 목록 요청으로 기존 수정 내용을 덮어쓰지 않습니다.
- 한 건 응답은 `{id,title,body}`, 수정 요청 본문은 `{title,body}` 형식입니다.
- `npm run test:package`와 `npm run test:r5`로 API 계약 및 무인증 거부 점검을 실행합니다. `npm run bundle`은 `aleph.config.json`의 실제 Production 주소로 무인증 목록 GET을 보내 결과를 기록하며, 심판 판정은 아닙니다. 소유자 검사와 데이터 분리 동작은 테스트를 실행한 결과를 별도로 기록하세요.
- 현재 코드는 보호된 Vercel Preview에 배포되어 있습니다. `aleph.config.json`의 `publicAppUrl`은 Production 주소이며 Production에는 이전 코드가 남아 있습니다. Preview에는 `SUPABASE_URL`, `SUPABASE_SECRET_KEY` 환경변수가 없어 로그인 후 CRUD 왕복은 아직 확인되지 않았습니다.

## 보너스 xdr-01 저장점: 무차별 로그인 공격 (2026-10-08)

- `xdr/brute-force/decide.mjs`의 `decide(alert)`가 연습 경보 28건을 `block`/`alert`/`record`로 나눕니다. 다시 실행: `npm run xdr:run -- brute-force` → `xdr/brute-force/result.json`.
- 마지막 실행 결과: block 10, alert 9, record 9. 정상 이벤트(bf-20~28)는 모두 `record`입니다. 정답표가 없어 이 구분은 학생의 자기 점검이며 심판 판정이 아닙니다.
- `patterns.json`은 MITRE ATT&CK T1110 근거 패턴 두 개, `read-alerts.mjs`는 확인용 읽기 모듈입니다.
- `respond.mjs`는 `block` 후보를 만료 시각·근거 경보 번호가 붙은 거부 규칙(`deny-rules.json`, Git 제외)과 `xdr/alerts.log`(Git 제외)에 기록합니다. Supabase에 기록하려면 `docs/xdr-supabase.sql`을 SQL Editor에서 한 번 실행하고, 이 컴퓨터 터미널에 `SUPABASE_URL`·`SUPABASE_SECRET_KEY`를 직접 설정한 뒤 `node xdr/brute-force/respond.mjs --supabase`를 실행합니다(키는 파일·Git에 넣지 않습니다). 사이트(Vercel)에는 XDR 서버 함수를 두지 않아 사이트가 이 규칙을 읽지는 않으며, 판정기 요청 계약에 출발 주소가 없어 `src/decider.mjs`에도 연결하지 않았으므로 실제 접속 차단은 아직 아닙니다.

## 1단계 시작 절차: 세 걸음

1. GitHub 계정을 만듭니다.
2. 방어전 1단계 카드의 Deploy 버튼을 누릅니다. Vercel에 GitHub로 로그인하고, 새 저장소가 본인 계정의 Public 저장소인지 확인한 뒤 Deploy를 누릅니다.
3. 배포가 끝나면 화면에 나온 `https://…vercel.app` 주소를 방어전 1단계 카드에 붙여넣고 제출합니다. 저장소 주소나 설정 파일은 적지 않습니다.

## 시작 틀의 자동 처리 및 설정 안내

- `vercel.json`은 정적 결과물 `public`을 배포합니다. 빌드 명령 `npm run build`는 Vercel이 제공하는 GitHub 저장소 소유자·이름, 커밋 SHA, 배포 URL을 검증하고 `public/aleph.json`을 생성합니다. 이 값이 없으면 빌드가 실패하므로, 성공한 것처럼 빈 주소를 내보내지 않습니다. `aleph.json`의 내용만으로 저장소 소유권이나 방어 성공을 인정하지 않습니다. 심판이 공개 저장소의 실제 커밋과 배포된 자료를 따로 대조해야 합니다.
- `aleph.config.json`에는 현재 저장소·Production 주소와 Supabase Auth 공개 issuer 정보가 있습니다. `judgeIssuer`는 운영 측 설정이므로 바꾸지 마세요. `npm run bundle`은 커밋 후 실행하며 `bundle-notes.json`은 설명 입력용 파일입니다. 둘 다 1단계 초기 절차와는 별개입니다.
- 로컬에서 정적 파일만 빌드할 때는 `npm run build -- --local`을 사용합니다. Vercel API 함수 실행에는 `SUPABASE_URL`, 서버 전용 `SUPABASE_SECRET_KEY` 환경변수가 필요합니다. 로컬 빌드는 배포나 심판 접수를 증명하지 않습니다.

## 메모 노출 확인 및 조치 이력

현재 배포와 저장소의 검색 결과만 기록합니다. Git 이력 재작성은 이미 내려받은 clone/fork와 GitHub 캐시를 회수하지 않습니다. 기존 Vercel 배포는 별도로 삭제했지만, Vercel의 최근 삭제 보존이나 외부 사본까지 물리적으로 제거됐다고 단정하지 않습니다.

현재 확인 기록 (2026-10-06):

- Production 커밋 `6dfac2c`: `/`, `/data.json`, `/aleph.json`, `/api/learning-memos`는 모두 200입니다. 정적 메모와 API 반환은 0건이며 `SAMPLE_NOTE_1`은 정적 응답에 없습니다. 첫 화면 응답에는 `X-Content-Type-Options: nosniff`가 붙고, 화면은 빈 상태 안내를 표시합니다.
- Supabase: `learning_memos`는 0행입니다. `owner_id`는 UUID, RLS는 활성화되어 있고 anon·authenticated 읽기는 거부됩니다.
- GitHub: main 이력을 재작성해 최신 커밋은 `6dfac2c`입니다. 최신 도달 가능 이력에서 메모 본문 검색은 0건입니다.
- Vercel: 과거 배포 `8a09274`, `1203cc6`, `c9df70c`, `669d3bb`, `8300e2a`와 PR #3 배포를 삭제했고 당시에는 `6dfac2c`만 배포 목록에 남아 있었습니다.

이전 clone/fork 및 GitHub 캐시는 제어할 수 없습니다. 이 조치만으로 과거 노출이 완전히 해소됐다고 단정하지 않습니다.

## 다음 단계 안내

[AGENTS.md](AGENTS.md)를 먼저 읽히고 한 번에 한 제작 단위만 요청하세요. 5단계의 원본 API 주소와 6단계 이후 정책 규칙은 해당 단계 원고와 계약을 따릅니다. 비밀번호·토큰·서버 전용 키·실제 학생 기록을 코드, Git, 제출 묶음에 넣지 않습니다.