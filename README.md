기존의 3·4단계 기능이 포함된 상세한 저장점 설명과 원본 1단계 중심의 명쾌한 가이드 구조를 조화롭게 버무려, 학생들이 혼동하지 않으면서도 현재 저장점의 상태(3·4단계)와 규칙을 정확히 파악할 수 있도록 다듬은 버전입니다.

BYTE BACK 방어전 시작 틀 R5
이 저장소는 1단계에서 학생 본인이 GitHub 저장소와 Vercel 배포를 만드는 출발점입니다. 실제 학생 자료, 토큰, 비밀키를 넣지 마세요.

<<<<<<< HEAD
현재 저장점: 3단계 및 4단계 기능 포함 (2026-10-07)
인증 및 소유권 보호: Supabase Auth 이메일·비밀번호 로그인과 로그아웃을 제공하며, src/verify-login.mjs가 확인한 로그인 사용자 ID를 기준으로 자료 API를 처리합니다.
=======
## 현재 저장점: 3단계 (2026-10-07)

- Supabase Auth 이메일·비밀번호 로그인과 로그아웃을 제공하며, 자료 API는 `src/verify-login.mjs`가 확인한 학생 토큰만 받습니다.
- 메모 생성 시 서버가 검증한 사용자 ID를 `owner_id`로 저장하고, 목록은 해당 사용자 메모만 반환합니다. 단건 GET·PUT·DELETE에는 의도적으로 소유자 검사를 아직 적용하지 않았습니다. 이 허점은 4단계에서 확인합니다.
- `npm run test:package`와 `npm run test:r5`로 API 계약 및 무인증 거부 점검을 실행합니다. `npm run bundle`은 `aleph.config.json`의 실제 Production 주소로 무인증 목록 GET을 보내 결과를 기록하며, 심판 판정은 아닙니다.
- 현재 코드는 [보호된 Vercel Preview](https://aleph-defense-starter-exfvfhdgv-joyj125.vercel.app/)에 배포되어 있습니다. `aleph.config.json`의 `publicAppUrl`은 Production 주소이며 Production에는 이전 코드가 남아 있습니다. Preview에는 `SUPABASE_URL`, `SUPABASE_SECRET_KEY` 환경변수가 없어 로그인 후 CRUD 왕복은 아직 확인되지 않았습니다.

## 1단계 시작 절차: 세 걸음
>>>>>>> b19d355 (3단계 저장점)

메모 데이터 격리: 메모 목록과 단건 GET·PUT·DELETE는 로그인 사용자 본인의 메모에만 적용됩니다. 첫 목록 요청 시 사용자별 기본 메모 네 건을 준비하며, 사용자별 메모 ID를 분리하여 기존 수정 내용이 덮어쓰이지 않도록 보호합니다. (URL이나 요청 본문의 owner_id를 신뢰하지 않고 서버가 검증한 사용자 ID를 저장합니다.)

<<<<<<< HEAD
API 형식: 한 건 응답은 {id, title, body}, 수정 요청 본문은 {title, body} 형식입니다.

점검 스크립트: npm run test:package와 npm run test:r5로 API 계약 및 무인증 거부 점검을 실행합니다. npm run bundle은 aleph.config.json의 실제 Production 주소로 무인증 목록 GET을 보내 결과를 기록하며, 심판 판정은 아닙니다.
=======
초기 1단계 화면은 보호 장치가 없는 공개 자료실이었습니다. 현재 저장점의 로그인 및 API 접근 상태는 위의 **현재 저장점: 3단계**를 기준으로 확인하세요.
>>>>>>> b19d355 (3단계 저장점)

배포 상태: 현재 코드는 보호된 Vercel Preview에 배포되어 있습니다. aleph.config.json의 publicAppUrl은 Production 주소이며 Production에는 이전 코드가 남아 있습니다. Preview에는 SUPABASE_URL, SUPABASE_SECRET_KEY 환경변수가 없어 로그인 후 CRUD 왕복은 아직 확인되지 않았습니다.

학생이 하는 일: 세 걸음 (1단계 시작 절차)
GitHub 계정을 만듭니다.

<<<<<<< HEAD
방어전 1단계 카드의 Deploy 버튼을 누릅니다. Vercel에 GitHub로 로그인하고, 새 저장소가 본인 계정의 Public 저장소인지 확인한 뒤 Deploy를 누릅니다.

배포가 끝나면 화면에 나온 https://…vercel.app 주소를 방어전 1단계 카드에 붙여넣고 제출합니다. 저장소 주소나 설정 파일은 적지 않습니다.
=======
`aleph.config.json`에는 현재 저장소·Production 주소와 Supabase Auth 공개 issuer 정보가 있습니다. `judgeIssuer`는 운영 측 설정이므로 바꾸지 마세요. `npm run bundle`은 커밋 후 실행하며 `bundle-notes.json`은 설명 입력용 파일입니다. 둘 다 1단계 초기 절차와는 별개입니다.

로컬에서 정적 파일만 빌드할 때는 `npm run build -- --local`을 사용합니다. Vercel API 함수 실행에는 `SUPABASE_URL`, 서버 전용 `SUPABASE_SECRET_KEY` 환경변수가 필요합니다. 로컬 빌드는 배포나 심판 접수를 증명하지 않습니다.
>>>>>>> b19d355 (3단계 저장점)

시작 틀의 자동 처리 및 설정 안내
vercel.json은 정적 결과물 public을 배포합니다. 빌드 명령 npm run build는 Vercel이 제공하는 GitHub 저장소 소유자·이름, 커밋 SHA, 배포 URL을 검증하고 public/aleph.json을 생성합니다. 이 값이 없으면 빌드가 실패하므로, 성공한 것처럼 빈 주소를 내보내지 않습니다. aleph.json의 내용만으로 저장소 소유권이나 방어 성공을 인정하지 않습니다. 심판이 공개 저장소의 실제 커밋과 배포된 자료를 따로 대조해야 합니다.

aleph.config.json에는 현재 저장소·Production 주소와 Supabase Auth 공개 issuer 정보가 있습니다. judgeIssuer는 운영 측 설정이므로 바꾸지 마세요. npm run bundle과 bundle-notes.json은 1단계 초기 절차와는 별개의 설명 입력용/기록용 도구입니다.

로컬에서 정적 파일만 빌드할 때는 npm run build -- --local을 사용합니다. Vercel API 함수 실행에는 SUPABASE_URL, 서버 전용 SUPABASE_SECRET_KEY 환경변수가 필요합니다. 로컬 빌드는 배포나 심판 접수를 증명하지 않습니다.

메모 노출 확인 및 조치 이력
현재 배포와 저장소의 검색 결과만 기록합니다. Git 이력 재작성은 이미 내려받은 clone/fork와 GitHub 캐시를 회수하지 않습니다. 기존 Vercel 배포는 별도로 삭제했지만, Vercel의 최근 삭제 보존이나 외부 사본까지 물리적으로 제거됐다고 단정하지 않습니다.

현재 확인 기록 (2026-10-06)
Production 커밋 6dfac2c: /, /data.json, /aleph.json, /api/learning-memos는 모두 200입니다. 정적 메모와 API 반환은 0건이며 SAMPLE_NOTE_1은 정적 응답에 없습니다. 첫 화면 응답에는 X-Content-Type-Options: nosniff가 붙고, 화면은 빈 상태 안내를 표시합니다.

Supabase: learning_memos는 0행입니다. owner_id는 UUID, RLS는 활성화되어 있고 anon·authenticated 읽기는 거부됩니다.

GitHub: main 이력을 재작성해 최신 커밋은 6dfac2c입니다. 최신 도달 가능 이력에서 메모 본문 검색은 0건입니다.

<<<<<<< HEAD
Vercel: 과거 배포 8a09274, 1203cc6, c9df70c, 669d3bb, 8300e2a와 PR #3 배포를 삭제했고 현재 6dfac2c만 배포 목록에 남아 있습니다.
=======
[AGENTS.md](AGENTS.md)를 먼저 읽히고 한 번에 한 제작 단위만 요청하세요. 4단계에서는 `api/learning-memos.js`의 단건 GET·PUT·DELETE가 로그인 사용자 본인 메모에만 적용되도록 소유자 검사를 추가하고, B의 타인 메모 접근 거부를 점검하세요. 5단계의 원본 API 주소와 6단계 이후 정책 규칙은 해당 단계 원고와 계약을 따릅니다. 비밀번호·토큰·서버 전용 키·실제 학생 기록을 코드, Git, 제출 묶음에 넣지 않습니다.
>>>>>>> b19d355 (3단계 저장점)

이전 clone/fork 및 GitHub 캐시는 제어할 수 없습니다. 이 조치만으로 과거 노출이 완전히 해소됐다고 단정하지 않습니다.
