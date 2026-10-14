# BYTE BACK 방어전 시작 틀 R5

이 저장소는 1단계에서 학생 본인이 GitHub 저장소와 Vercel 배포를 만드는 출발점입니다. 실제 학생 자료, 토큰, 비밀키를 넣지 마세요.

## 현재 저장점: 11단계 승인 전 차단 화면 (2026-10-14)

- PWA manifest 및 설치 안내를 유지하면서 로그인 후 기기 승인 요청·상태 확인 화면을 추가했습니다.
- 운영 엔진의 신뢰할 수 있는 기기 승인 API 계약이 아직 없어 요청·확인 엔드포인트는 503을 반환합니다. 승인되었다고 표시하지 않습니다.
- 승인 검증 전에는 프런트엔드 메모 표시를 막고 학생 메모 API도 403 `DEVICE_APPROVAL_NOT_VERIFIED`로 차단합니다. **승인된 기기의 실제 자료실 개방은 아직 미구현**입니다.
- 기존 메모 코드·정책 규칙·시험 기록은 보존했습니다. 로그인 사용자 CRUD는 신뢰 기기 승인 연동 전까지 잠깁니다.
- 로컬 확인: `npm install`, `npm run test:r5`, `npm run decider:test`. 이 명령은 실행 전까지 미실행이며, 기존 R5 정상 요청 기대와 11단계 차단 정책이 달라 테스트 조정이 필요할 수 있습니다.

## 이전 저장점: 10단계 기능 포함 (2026-10-14)

- 비공개 가상 메모 사본의 Ed25519 서명·침해 전 검증 시각·ID·소유자·SHA-256을 확인하고, Preview에서 시험 계정 B의 기존 메모 한 건만 복원하는 API를 추가했습니다. Production에서는 비활성화합니다.
- 안전 정책 사본의 변경 미리보기와 명시적 확인을 요구하는 시험 정책 복원 절차를 추가했습니다. 다른 서비스 규칙·감사 기록·운영 정책은 변경 대상이 아닙니다.
- 복원 후 1~9단계 정상·금지 요청 회귀 점검 순서를 아래에 기록했습니다. **모든 회귀 점검은 미실행**이며 실제 DB 복원·심판 통과를 주장하지 않습니다.
- `aleph.config.json`의 `restoreRoute`는 현재 Production URL의 `/api/test-restore/:id`로 설정되어 있으나 복원 엔드포인트 자체는 Preview 전용으로 제한됩니다.

## 이전 저장점: 9단계 기능 포함 (2026-10-14)

- 9단계 탐지기(`src/detect.mjs`)는 검증된 가상 사건 계약의 `at`, `method`, `identity.sub`만 사용합니다. 메모 본문·토큰·실명은 저장하거나 출력하지 않습니다.
- 같은 가명 주체의 GET 요청이 어느 10분 구간에서든 120건을 초과할 때만 `{ action: 'propose_revocation', reasonCode: 'burst_read', subject }`를 반환합니다. 정상 사건과 정확히 120건은 `{ action: 'observe' }`입니다.
- 현재 9단계 사건 계약에는 검증된 기기 ID와 네트워크 변화 정보가 없습니다. 따라서 이 구현은 특정 기기 한 개의 회수를 제안하거나 네트워크·다량 조회 복합 탐지를 검증하지 못합니다. 실제 회수 API, 기기 권한 변경, 심판 회수 시간 측정은 구현하지 않았습니다.
- 로컬 가상 사건 확인: `npm run detect:test` (정상 사건 `observe`, 121건 이상 폭주 사건 `propose_revocation`). 기존 접속 판정 확인: `npm run decider:test`, `npm run fixture:7`. 제출 묶음은 커밋 후 별도로 `bundle-notes.json`을 작성하고 `npm run bundle`을 실행합니다. 로컬 연습 결과는 실제 심판 판정이 아닙니다.

## 이전 저장점: 8단계 기능 포함 (2026-10-13)

- SDP 판정기(`src/decider.mjs`)에 자원별 구역 접근을 통제하는 `zone_rules` 규칙을 추가했습니다.
  - 내 자료실 메모(`notes`)와 강사 공지(`notices`) 구역을 구분하고, 알 수 없는 서비스나 경로 요청은 `route_not_allowed`로 차단합니다.
  - `:id` 위치나 경로에 `export` 등 기능 경로를 두지 못하게 하여 `route_not_allowed`로 차단합니다.
  - 요청 계약에는 역할(`role`)이 없으므로 판정기는 공지/강사 자료 쓰기(`POST`, `PUT`, `DELETE`, `PATCH`)를 누구에게나 `zone_not_allowed`로 거부합니다.
  - 메모 구역에서는 여러 사람의 자료를 한꺼번에 여는 목록 경로를 `zone_not_allowed`로 차단하고, 경로에 타 사용자 식별자가 지정된 경우에도 `zone_not_allowed`로 차단합니다.
- 자료 API(`api/learning-memos.js`)에서도 요청 본문이나 클라이언트의 임의 역할 조작(`role`, `is_instructor` 등)을 감지해 `ROLE_OVERRIDE_NOT_ALLOWED`로 거부하며, 검증된 사용자 ID와 DB의 `owner_id`만을 대조합니다.
- 이전 6단계 기기 등록(`device_registered`) 및 7단계 복합 이상 접속 재인증(`step_up_required`) 규칙을 함께 유지합니다.

## 이전 저장점: 7단계 기능 포함 (2026-10-13)

- SDP 판정기(`src/decider.mjs`)에 등록된 기기 검증(`device_registered`)과 함께 평소와 다른 복합 이상 접속에 추가 본인 확인을 요청하는 `step_up_required` 규칙을 구현했습니다.
- 검증된 엔진 신호(`source !== 'none'`)를 바탕으로 심야/새벽 시간대, 낯선 네트워크, 대량 읽기 사건이 결합된 요청에 대해 재인증(`stepUp`)이 없으면 `decision: 'step_up'`, `reasonCode: 'step_up_required'`를 반환합니다.
- 재인증이 완료된 요청이나 일반 정상 요청은 `decision: 'allow'`, `reasonCode: 'approved'`로 통과하며, 미등록 기기는 기존대로 `deny` 및 `device_not_registered`로 차단합니다.
- 가상 사건 및 판정기 확인 순서:
  1. `node scripts/fixture-7.mjs` 명령으로 정상 사건(`allow`)과 복합 이상 사건(`step_up`) 판정을 확인합니다.
  2. `npm run decider:test` 명령으로 4가지 가상 요청(등록 기기, 미등록 기기, 복합 이상, 재인증 통과)이 모두 통과하는지 확인합니다.
  (※ 이 명령은 가상 사건 로컬 연습이며 심판 통과 증거가 아닙니다. 실제 재인증 전 자료 차단과 재인증 후 접근 허용 실측은 계약이 준비된 환경에서만 동작합니다.)

## 이전 저장점: 6단계 기능 포함 (2026-10-13)

- SDP 판정기(`src/decider.mjs`)에 등록된 기기만 자료실 접근을 허용하는 `device_registered` 규칙을 적용했습니다.
- 요청의 `deviceRegistered`가 `true`일 때만 접근을 허용(`decision: 'allow'`, `reasonCode: 'approved'`)합니다.
- 미등록 기기(`deviceRegistered: false`)이거나 값이 누락된 경우 차단(`decision: 'deny'`, `reasonCode: 'device_not_registered'`)합니다.
- 판정기 가상 요청 확인 순서:
  1. `npm run decider:test` 명령을 실행합니다.
  2. 출력 결과에서 `통과 · 등록 기기의 정상 요청`과 `통과 · 미등록 기기의 가상 요청`을 확인합니다.
  (※ 이 명령은 가상 요청을 통한 로컬 연습이며 심판 통과 증거가 아닙니다. 실제 미등록 기기 공격 판정은 심판이 수행하며, 별도의 접속 프로그램 설치는 필요하지 않습니다.)

## 이전 저장점: 4단계 기능 포함 (2026-10-07)

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

## 보너스 xdr-02 저장점: 웹 주입 공격 (2026-10-08)

- `xdr/web-injection/decide.mjs`의 `decide(alert)`가 연습 경보 26건을 `block`/`alert`/`record`로 나눕니다. 다시 실행: `npm run xdr:run -- web-injection` → `xdr/web-injection/result.json`.
- 마지막 실행 결과: block 8, alert 9, record 9. 정상 이벤트(wi-18~26)는 모두 `record`입니다. 정답표가 없어 이 구분은 학생의 자기 점검이며 심판 판정이 아닙니다.
- `patterns.json`은 MITRE ATT&CK T1190 근거 패턴 세 개, `read-alerts.mjs`는 확인용 읽기 모듈입니다. `decide.mjs`는 import가 없고 파일·네트워크를 쓰지 않습니다.
- `respond.mjs`는 `block` 후보만 만료 시각·근거 경보 번호가 붙은 거부 규칙(`xdr/web-injection/deny-rules.json`, Git 제외)과 `xdr/alerts.log`(Git 제외)에 기록합니다. 실행: `node xdr/web-injection/respond.mjs`. Supabase 저장은 연결하지 않았고, 사이트(Vercel)는 이 규칙을 읽지 않으며 `src/decider.mjs`에도 연결하지 않아 실제 접속 차단은 아직 아닙니다.

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
## 10단계: 비공개 가상 메모 한 건 시험 복원 (2026-10-14)

- 서비스: `test-memo-restore` (시험 Preview 전용), 경로: `POST /api/test-restore/:id`. 기존 `GET/POST /api/learning-memos` 및 `GET/PUT/DELETE /api/learning-memos/:id`는 유지합니다.
- Vercel **Preview에서만** `TEST_MEMO_RESTORE_ENABLED=true`를 설정해야 활성화됩니다. Production에서는 403으로 거부합니다. 요청자는 Supabase로 검증된 **시험 계정 B**여야 하며 서버 환경변수 `TEST_ACCOUNT_B_USER_ID`와 일치해야 합니다. 브라우저에서 전달한 소유자·사본은 신뢰하지 않습니다.
- 비공개 서버 환경변수 `PRIVATE_TEST_MEMO_SNAPSHOT_JSON`은 `{payload:{version,verifiedAt,id,owner_id,title,content,contentSha256},signature}` 형식의 Ed25519 서명 사본입니다. `TEST_MEMO_SNAPSHOT_PUBLIC_KEY_PEM`은 독립적으로 확보한 신뢰 공개키, `TEST_MEMO_INCIDENT_AT`은 침해 시각입니다. 사본/키가 없거나 서명·시각·ID·소유자·SHA-256이 일치하지 않으면 중단합니다. **실제 메모 내용과 비밀키는 Git에 넣지 않습니다.**
- 기존에 존재하는 B 소유 메모 **한 행**의 제목·내용만 조건부 갱신하고 ID·소유자·내용 SHA-256을 재검증합니다. 다른 메모 및 감사 기록은 건드리지 않으며, 삭제된 행의 재생성은 지원하지 않습니다. 실 운영 복원 경로가 아닙니다.
- 로컬 가상 시험: `node --test test/restore-one-test-memo.test.mjs`. B의 메모 복원, 다른 행 보존, 잘못된 ID·소유자·변조 사본 거부를 확인합니다. 운영 환경 시험이나 심판 판정 증거는 아닙니다.


## 10단계: 복구 후 1~9단계 회귀 점검 순서 (체크리스트)

> **실행 기록: 아래 모든 항목 미실행.** 이 표의 '예상'은 통과 결과가 아닙니다. 복구 전 검증된 사본의 버전·서명·대상 ID·소유자·내용 SHA-256을 확인하고, 시험 정책의 변경 범위를 미리보기에서 확인한 뒤 **시험 환경**에서만 복원하세요. 실제 운영 정책·다른 서비스 규칙·감사 이력은 변경하지 않습니다. 비밀값·토큰·메모 본문은 README·Git·출력 로그에 남기지 마세요.

| 순서 / 이전 단계 | 실행 위치·확인 요청 | 정상 기대 | 금지 기대 | 실행 상태 |
|---|---|---|---|---|
| 0 / 복원 무결성 | 시험 계정 B의 `POST /api/test-restore/:id` 복원 후 응답과 비공개 사본의 ID·owner_id·contentSha256 비교. 복원 전후 다른 메모 건수/식별자와 감사 기록을 별도로 비교 | 지정한 B의 **한 건**만 ID·소유자·내용 해시가 일치; 다른 메모·감사 이력 보존 | 사본 누락, 서명·해시·ID·소유자 불일치, 타 계정, Production 호출은 거부 | **미실행** |
| 1 / 배포·공개 자료 | Production URL의 `/`, `/aleph.json`, `/data.json` 응답과 GitHub 커밋 대조 | 화면 표시, 배포 식별자 일치, 공개 응답에 비공개 메모 없음 | 잘못된 배포 식별자·비공개 내용 노출은 실패 | **미실행** |
| 2 / 인증 | 시험 계정 A·B로 각각 로그인 후 로그아웃; `GET /api/learning-memos` | 유효한 로그인에서 본인 자료만 표시 | 토큰 없는 요청과 로그아웃 뒤 무효 세션은 401 기대 | **미실행** |
| 3 / 메모 CRUD | A 본인 메모 단건 GET→PUT→GET, 필요하면 별도 **가상 시험 메모** POST→DELETE | A 소유 메모만 조회·변경되고 다른 건은 그대로 유지 | B가 A의 메모 ID로 GET·PUT·DELETE하면 404; 본문 `owner_id` 위조는 403 | **미실행** |
| 4 / 자료 격리 | A·B의 목록 및 단건 GET을 비교; 복원된 B 한 건의 ID·owner_id·SHA-256 재대조 | A 정상 요청 유지, B 복구 자료 유지, 서로 다른 자료 분리 | A가 B 자료 또는 B가 A 자료 요청 시 거부 | **미실행** |
| 5 / 무인증·원본 API | `npm run test:r5` 및 `npm run test:package`; `aleph.config.json`의 `originalApiUrl`과 허용 경로 확인 | 테스트에서 정상 API 계약 유지 | 무인증 자료 요청·원본 API 우회로 다른 사람 자료 조회 불가 | **미실행** |
| 6 / 기기 등록 | `npm run decider:test`의 등록·미등록 가상 요청 | 등록 기기 `allow` | 미등록 기기 `deny/device_not_registered` | **미실행** |
| 7 / 복합 이상 접속 | `npm run fixture:7`, `npm run decider:test` | 정상 접속·검증된 재인증 `allow` | 복합 의심 접속은 `step_up/step_up_required` | **미실행** |
| 8 / 구역·경로 정책 | `src/decider.mjs` 계약에 맞춘 시험 요청: 메모 단건, 공지 읽기, 공지 쓰기, 메모 목록, 알 수 없는 경로, `export` 경로 | 허용된 단건 및 공지 읽기 `allow` | 공지 쓰기·메모 목록은 `zone_not_allowed`, 알 수 없는 경로·기능 경로는 `route_not_allowed` | **미실행** |
| 9 / 사건 탐지 | `npm run detect:test`의 정상 사건·120건·121건 이상 및 복합 사건 가상 점검 | 정상·임계값 이하 사건 `observe` | 초과 조회·검증된 복합 의심 사건은 해당 회수 **제안** 기대; 실제 세션 회수 여부는 별도 확인 필요 | **미실행** |

### 실행 순서와 결과 기록 규칙

1. **복원 전:** `git status --short`, `git log -1 --oneline`으로 로컬 변경을 확인합니다. 안전 사본·신뢰 공개키·침해 시각과 시험 계정 B의 복원 대상 한 건을 검증합니다. 사본이 없거나 검증에 실패하면 **중단**합니다.
2. **복원 직후:** 표의 0번부터 시작하여 B의 한 건에 대해 **ID·소유자·내용 SHA-256**을 비교합니다. A/B의 다른 메모와 감사 이력은 전후 상태를 비교합니다. 복원 검증에 실패하면 이후 점검도 중단합니다.
3. **배포·API:** 1~5번을 순서대로 확인합니다. A·B의 요청은 **시험 계정/가상 메모**만 사용하고, 타인 메모를 변경하는 공격 시험은 실제 운영 데이터에 수행하지 않습니다. 5번 원본 API의 실제 접근 결과는 별도로 기록합니다.
4. **정책·탐지:** 6~9번은 로컬 가상 요청 점검을 먼저 실행합니다. `npm run decider:test`, `npm run fixture:7`, `npm run detect:test`는 **실제 운영 엔진·심판 통과 증거가 아닙니다**. 실제 서비스의 거부 여부는 엔진에서 별도로 검증해야 합니다.
5. **기록:** 각 항목의 '미실행'을 실제 수행 후에만 '통과/실패'로 바꾸고, 실행 시각·환경(로컬/Preview/Production)·HTTP 상태 또는 판정 코드·커밋 SHA를 **비밀값 없이** 적습니다. 실패하면 첫 오류를 기록하고 후속 단계를 보류합니다. 확인하지 않은 정상·금지 결과는 추정으로 채우지 않습니다.

로컬 점검 명령(Windows PowerShell, **직접 실행 전까지 미실행**):

```powershell
npm.cmd run test:package
npm.cmd run test:r5
npm.cmd run decider:test
npm.cmd run fixture:7
npm.cmd run detect:test
node --test test/policy-restore-preview.test.mjs test/restore-test-policy.test.mjs test/restore-one-test-memo.test.mjs
```

**주의:** 이 명령만으로 B의 복구된 DB 메모·A/B 접근 격리·감사 기록 보존·Production 동작이 검증되지는 않습니다. 해당 항목은 실제 시험 환경의 관측 결과가 필요합니다.

### 10단계 복구 안전 확인 절차 (S10_BACKUP_UNVERIFIED 보완)

- Preview 시험 계정 B에서 먼저 `GET /api/test-restore/:id`를 호출합니다. 서버가 비공개 서명 사본을 검증하고 복구 버전·변경될 필드·확인 토큰만 반환합니다. 이때 DB는 수정하지 않습니다.
- 확인 후 `POST /api/test-restore/:id`에 `{"confirmationToken":"<미리보기 확인 토큰>"}`을 보냅니다. 서버는 서명·시각·소유자·해시를 재검증하고 현재 메모 상태를 대조한 뒤 B의 기존 한 건만 복원합니다. 토큰 누락은 HTTP 428, 불일치·사본 검증 실패는 거부합니다.
- 운영 정책·다른 메모·감사 기록은 수정하지 않습니다. 실제 심판 재시험은 **미실행**입니다. 로컬 테스트 명령: `node --test test/restore-one-test-memo.test.mjs` (**미실행**).
