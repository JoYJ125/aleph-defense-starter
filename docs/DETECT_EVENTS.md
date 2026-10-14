# 9단계 탐지 연습 사건 계약

`npm run detect:test`는 학생이 작성한 `src/detect.mjs`의 `detect(events)`에 가상 조회 사건을 전달합니다. 각 사건은 다음 세 값만 가집니다.

```js
{ at: '2026-10-01T00:00:00.000Z', method: 'GET', identity: { sub: 'learner_fixture' } }
```

같은 `identity.sub`의 `GET` 사건이 어느 10분 구간에서든 **120건을 넘을 때만** `{ action: 'propose_revocation', reasonCode: 'burst_read', subject: '해당 sub' }`를 돌려줍니다. 그 밖에는 `{ action: 'observe' }`입니다. 정확히 120건은 회수 제안 대상이 아닙니다. 다른 사용자의 사건을 합산하거나 10분 밖의 사건을 같은 묶음으로 세지 않습니다.

이 파일의 사건 모양은 **로컬 연습용**입니다. 브라우저가 보낸 사용자 번호를 신원으로 취급하지 않습니다. 운영 반 엔진이 검증한 사건을 전달하고 회수 제안을 집행하는 경로는 별도로 연결·시험해야 합니다. 이 명령의 통과를 실제 접속 차단이나 심판 판정으로 표시하지 않습니다.

## 합성 도플갱어 복합 의심 사건 (추가 로컬 연습)

별도 가상 사건에는 운영 요청 계약의 `deviceId`(16자리 소문자 16진수), `signals` 및 `recentEvents`를 사용합니다. `detect(events)`는 검증 출처(`source`가 `none`/`unknown`이 아님), 심야 시간, `network: 'unusual'`, GET 조회 10건 이상이 함께 있을 때 `{ action: 'propose_revocation', reasonCode: 'compound_anomaly', deviceId: '해당 가상 기기' }`를 반환합니다. 기기 ID가 없거나 조건이 빠지면 `observe`입니다. `judge_fixture`는 실제 위치·기기 증명이 아니며 회수 API나 실제 접속 차단은 수행하지 않습니다.
