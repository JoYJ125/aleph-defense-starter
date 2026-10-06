# BYTE BACK 방어전 시작 틀 R5

이 저장소는 1단계에서 학생 본인이 GitHub 저장소와 Vercel 배포를 만드는 출발점입니다. 실제 학생 자료, 토큰, 비밀키를 넣지 마세요.

## 학생이 하는 일: 세 걸음

1. GitHub 계정을 만듭니다.
2. 방어전 1단계 카드의 **Deploy** 버튼을 누릅니다. Vercel에 GitHub로 로그인하고, 새 저장소가 **본인 계정의 Public 저장소**인지 확인한 뒤 Deploy를 누릅니다.
3. 배포가 끝나면 화면에 나온 `https://…vercel.app` 주소를 방어전 1단계 카드에 붙여넣고 제출합니다. 저장소 주소나 설정 파일은 적지 않습니다.

배포가 끝나면 `/`은 Vercel 함수 `/api/learning-memos`에서 현재 Supabase `learning_memos` 행을 읽습니다. 함수는 Vercel 환경변수 `SUPABASE_URL`과 서버 전용 `SUPABASE_SECRET_KEY`를 사용하며, 비밀 키는 브라우저·응답·로그로 보내지 않습니다. Supabase 공개 키를 이용한 직접 읽기 요청은 허용되지 않습니다.

주의: `/api/learning-memos`는 로그인이나 권한 검사가 없는 공개 주소입니다. 현재 테이블은 비어 있지만, 행이 추가되면 누구나 이 주소를 직접 호출해 읽을 수 있습니다. 서버 키를 숨겨도 공개 API의 접근 약점은 해소되지 않습니다.

## 시작 틀의 자동 처리

`vercel.json`은 정적 결과물 `public`을 배포합니다. 빌드 명령 `npm run build`는 Vercel이 제공하는 GitHub 저장소 소유자·이름, 커밋 SHA, 배포 URL을 검증하고 `public/aleph.json`을 생성합니다. 이 값이 없으면 빌드가 실패하므로, 성공한 것처럼 빈 주소를 내보내지 않습니다. `aleph.json`의 내용만으로 저장소 소유권이나 방어 성공을 인정하지 않습니다. 심판이 공개 저장소의 실제 커밋과 배포된 자료를 따로 대조해야 합니다.

`aleph.config.json`의 `repoUrl`과 `publicAppUrl`은 이전 제출 묶음 방식의 자리표시자입니다. 1단계에서는 학생이 편집하지 않습니다. 2단계 이후 코딩 도구가 필요한 설정과 보호 기능을 단계별로 작성합니다. `npm run bundle`과 `bundle-notes.json`도 1단계의 세 걸음에는 포함되지 않습니다.

로컬에서 정적 파일만 빌드할 때는 `npm run build -- --local`을 사용합니다. Vercel API 함수 실행에는 배포 및 `SUPABASE_URL`, `SUPABASE_SECRET_KEY` 환경변수가 필요합니다. 로컬 빌드는 배포나 심판 접수를 증명하지 않습니다.

## 메모 노출 확인

현재 배포와 저장소의 검색 결과만 기록합니다. Git 이력 재작성은 이미 내려받은 clone/fork와 GitHub 캐시를 회수하지 않습니다. 기존 Vercel 배포는 별도로 삭제했지만, Vercel의 최근 삭제 보존이나 외부 사본까지 물리적으로 제거됐다고 단정하지 않습니다.

### 현재 확인 기록 (2026-10-06)

- Production 커밋 `6dfac2c`: `/`, `/data.json`, `/aleph.json`, `/api/learning-memos`는 모두 `200`입니다. 정적 메모와 API 반환은 0건이며 `SAMPLE_NOTE_1`은 정적 응답에 없습니다. 첫 화면 응답에는 `X-Content-Type-Options: nosniff`가 붙고, 화면은 빈 상태 안내를 표시합니다.
- Supabase `learning_memos`는 0행입니다. `owner_id`는 UUID, RLS는 활성화되어 있고 anon·authenticated 읽기는 거부됩니다.
- GitHub `main` 이력을 재작성해 최신 커밋은 `6dfac2c`입니다. 최신 도달 가능 이력에서 메모 본문 검색은 0건입니다.
- Vercel에서 과거 배포 `8a09274`, `1203cc6`, `c9df70c`, `669d3bb`, `8300e2a`와 PR #3 배포를 삭제했고 현재 `6dfac2c`만 배포 목록에 남아 있습니다.
- 이전 clone/fork 및 GitHub 캐시는 제어할 수 없습니다. 이 조치만으로 과거 노출이 완전히 해소됐다고 단정하지 않습니다.

## 다음 단계의 코딩 도구에 전달할 규칙

[AGENTS.md](AGENTS.md)를 먼저 읽히고 한 번에 한 제작 단위만 요청하세요. 이후 자료 보호를 강화할 때는 `api/learning-memos.js`의 공개 무인증 접근을 로그인·권한 검사로 제한해야 합니다. 3단계 이후의 로그인, 허용 경로, 5단계의 원본 API 주소, 6단계 이후 정책 규칙은 해당 단계 원고와 계약에 맞춰 추가합니다. 비밀번호·토큰·서버 전용 키·실제 학생 기록을 코드, Git, 제출 묶음에 넣지 않습니다.

`src/decider.mjs`와 `src/detect.mjs`의 로컬 시험은 반 엔진이나 운영 심판의 결과가 아닙니다. 1단계 이후 제출 묶음 계약 `aleph.defense.submission.v2`는 `scripts/bundle.mjs`에 남아 있으며, 코딩 도구가 해당 단계의 최신 배포 주소와 Git 원격을 맞춘 뒤 사용합니다.
