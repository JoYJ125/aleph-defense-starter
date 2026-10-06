# BYTE BACK 방어전 시작 틀 R5

이 저장소는 1단계에서 학생 본인이 GitHub 저장소와 Vercel 배포를 만드는 출발점입니다. 포함된 메모 네 건은 가상 자료입니다. 실제 학생 자료, 토큰, 비밀키를 넣지 마세요.

## 학생이 하는 일: 세 걸음

1. GitHub 계정을 만듭니다.
2. 방어전 1단계 카드의 **Deploy** 버튼을 누릅니다. Vercel에 GitHub로 로그인하고, 새 저장소가 **본인 계정의 Public 저장소**인지 확인한 뒤 Deploy를 누릅니다.
3. 배포가 끝나면 화면에 나온 `https://…vercel.app` 주소를 방어전 1단계 카드에 붙여넣고 제출합니다. 저장소 주소나 설정 파일은 적지 않습니다.

배포가 끝나면 `/`에서 Vercel 함수 `/api/learning-memos`를 통해 Supabase `learning_memos` 테이블의 가상 메모 네 건을 봅니다. 함수는 Vercel 환경변수 `SUPABASE_URL`과 서버 전용 `SUPABASE_SECRET_KEY`를 사용하며, 비밀 키는 브라우저·응답·로그로 보내지 않습니다. Supabase 공개 키를 이용한 직접 읽기 요청은 허용되지 않습니다.

주의: `/api/learning-memos`는 로그인이나 권한 검사가 없는 공개 주소입니다. 누구나 이 주소를 직접 호출해 메모 네 건을 받을 수 있으므로, 서버 키를 숨겨도 메모 접근 자체가 보호되는 것은 아닙니다. 이 공개 함수 주소의 약점과 공개 키 직접 요청 거부는 심판이 별도로 확인합니다.

## 시작 틀의 자동 처리

`vercel.json`은 정적 결과물 `public`을 배포합니다. 빌드 명령 `npm run build`는 Vercel이 제공하는 GitHub 저장소 소유자·이름, 커밋 SHA, 배포 URL을 검증하고 `public/aleph.json`을 생성합니다. 이 값이 없으면 빌드가 실패하므로, 성공한 것처럼 빈 주소를 내보내지 않습니다. `aleph.json`의 내용만으로 저장소 소유권이나 방어 성공을 인정하지 않습니다. 심판이 공개 저장소의 실제 커밋과 배포된 자료를 따로 대조해야 합니다.

`aleph.config.json`의 `repoUrl`과 `publicAppUrl`은 이전 제출 묶음 방식의 자리표시자입니다. 1단계에서는 학생이 편집하지 않습니다. 2단계 이후 코딩 도구가 필요한 설정과 보호 기능을 단계별로 작성합니다. `npm run bundle`과 `bundle-notes.json`도 1단계의 세 걸음에는 포함되지 않습니다.

로컬에서 정적 파일만 빌드할 때는 `npm run build -- --local`을 사용합니다. Vercel API 함수 실행과 화면의 메모 네 건 확인에는 Vercel 배포 및 `SUPABASE_URL`, `SUPABASE_SECRET_KEY` 환경변수가 필요합니다. 로컬 빌드는 배포나 심판 접수를 증명하지 않습니다.

## 메모 노출 확인

현재 배포와 저장소 최신 트리만 확인하며, 과거 공개 커밋이나 과거 Vercel 배포가 삭제·비공개화된 것으로 간주하지 않습니다. 따라서 현재 검색에 일치 항목이 없더라도 과거 노출이 해소됐다고 기록하지 않습니다.

### 반복 절차

1. Vercel의 **Deployments**에서 현재 Production 배포와 소스 커밋 SHA를 확인합니다. 공개 API 응답에서 검색어를 메모리로 가져와 해당 배포 커밋의 정적 입력 파일을 검색합니다. 검색어와 응답 본문은 출력하지 않습니다.

   ```powershell
   git fetch origin main
   $deploySha = '<Production 배포의 소스 커밋 SHA>'
   $production = 'https://<현재 Production 도메인>'
   $apiResponse = Invoke-WebRequest -Uri ($production + '/api/learning-memos') -UseBasicParsing
   $apiRows = ConvertFrom-Json -InputObject $apiResponse.Content
   $phrases = @($apiRows | ForEach-Object { $_.content })
   if ($phrases.Count -ne 4) { throw 'Could not read all four search terms from the API response.' }
   git grep -c -F -e $phrases[0] -e $phrases[1] -e $phrases[2] -e $phrases[3] $deploySha -- public
   ```

2. 현재 Production의 정적 응답도 검색하고 `/data.json`의 `notes` 개수를 기록합니다.

   ```powershell
   $paths = @('/', '/aleph.json') + @(git ls-tree -r --name-only $deploySha -- public | ForEach-Object { '/' + $_.Substring(7) })
   foreach ($path in ($paths | Sort-Object -Unique)) {
     $body = (Invoke-WebRequest -Uri ($production + $path) -UseBasicParsing).Content
     $hits = @($phrases | Where-Object { $body.Contains($_) })
     if ($hits.Count -eq 0) { "$path : 0 hits" } else { "$path : $($hits.Count) hits" }
   }
   $data = Invoke-RestMethod -Uri ($production + '/data.json')
   "/data.json notes: $($data.notes.Count)"
   ```

3. GitHub 최신 `main` 전체 파일을 같은 검색어로 확인하고, 결과 경로와 건수를 기록합니다.

   ```powershell
   $gitArgs = @('grep', '-c', '-F')
   foreach ($phrase in $phrases) { $gitArgs += @('-e', $phrase) }
   $gitArgs += @('origin/main', '--', '.')
   & git @gitArgs
   ```

4. 공개 API는 문장 검색과 별도로 HTTP 상태와 반환 건수를 기록합니다. 아래 요청은 응답 본문을 출력하지 않습니다.

   ```powershell
   try {
     $apiResponse = Invoke-WebRequest -Uri ($production + '/api/learning-memos') -UseBasicParsing
     $rows = @($apiResponse.Content | ConvertFrom-Json)
     "API: HTTP $([int]$apiResponse.StatusCode), rows=$($rows.Count)"
   } catch {
     $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 'request failed' }
     "API: HTTP $status"
   }
   ```

   이 주소에는 로그인·권한 검사가 없으므로, 배포되면 누구나 메모 네 건을 요청할 수 있습니다. 서버 전용 키를 숨기는 것만으로 이 공개 접근 약점은 해소되지 않습니다.

### 현재 확인 기록 (2026-10-06)

- Production 커밋 `669d3bb`: `/`와 `/api/learning-memos`가 `200`, API가 메모 네 건을 반환합니다. `/data.json`은 `200`이며 `notes` 0건입니다. 첫 화면 응답에는 `X-Content-Type-Options: nosniff`가 붙습니다.
- 최신 GitHub 트리의 정적 파일과 tracked source에서 메모 본문 문장이 검색되지 않습니다. 현재 Supabase 데이터는 유지되며, tracked migration은 테이블과 접근 정책만 준비합니다. 새 DB에는 이 파일만으로 메모 seed가 자동 생성되지 않습니다.
- 이전 공개 커밋 `1203cc6`와 과거 배포는 남아 있을 수 있습니다. 최신 트리의 검색 결과는 과거 노출 해결이나 이전 배포 삭제를 뜻하지 않습니다.

## 다음 단계의 코딩 도구에 전달할 규칙

[AGENTS.md](AGENTS.md)를 먼저 읽히고 한 번에 한 제작 단위만 요청하세요. 이후 자료 보호를 강화할 때는 `api/learning-memos.js`의 공개 무인증 접근을 로그인·권한 검사로 제한해야 합니다. 3단계 이후의 로그인, 허용 경로, 5단계의 원본 API 주소, 6단계 이후 정책 규칙은 해당 단계 원고와 계약에 맞춰 추가합니다. 비밀번호·토큰·서버 전용 키·실제 학생 기록을 코드, Git, 제출 묶음에 넣지 않습니다.

`src/decider.mjs`와 `src/detect.mjs`의 로컬 시험은 반 엔진이나 운영 심판의 결과가 아닙니다. 1단계 이후 제출 묶음 계약 `aleph.defense.submission.v2`는 `scripts/bundle.mjs`에 남아 있으며, 코딩 도구가 해당 단계의 최신 배포 주소와 Git 원격을 맞춘 뒤 사용합니다.
