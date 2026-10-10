# 파얼끄투 P1.1.0 — GitHub 공개용 소스

이 배포본은 사용자가 제공한 `KKuTu-master(P1.1.0).zip`에 **개인 음원 폴더 일괄 업로드 패치와 목록 표시 수정 패치**를 순서대로 적용한 다음, 운영자 전용 정보를 제거한 소스 배포본입니다.

## 공개 전에 처리한 항목

- 실제 OAuth Client ID / Client Secret, DB 비밀번호, 관리자 계정 식별자, reCAPTCHA 키는 공개 ZIP에서 제외했습니다.
- `Server/lib/sub/auth.json`, `global.json`, `unified.json` 원본은 포함하지 않았습니다. 대신 각 `*.example.json`을 제공합니다.
- Cloudflare Origin 개인키와 인증서(`ssl/origin.key`, `origin.crt`), 로그, OAuth 심사용 동영상, 중복 백업 파일은 제외했습니다.
- `node_modules`는 제외했습니다. `npm install`로 의존성을 설치하세요.
- 운영 도메인을 사용하는 코드 부분은 일반적인 경로/환경변수/`example.com` 예제로 교체했습니다.
- 기존 코드에 고정됐던 세션 암호는 `KKUTU_SESSION_SECRET`을 사용하게 변경했습니다. 미설정 시 임시 랜덤 값을 생성하므로 서버 재시작 시 로그인이 해제됩니다.
- 프록시 신뢰/IP 헤더 신뢰는 운영 환경에서 명시적으로 설정해야 사용하게 했습니다.
- SQL 사전 덤프는 유지했습니다. 원본 덤프의 `users`, `session`, `ip_block` COPY 데이터 행이 **0개**임을 확인했습니다. 배포 시에는 사전 데이터의 저작권·배포 조건을 별도로 확인하세요.

## 설정 복원 (새 설치 또는 테스트 환경)

1. 아래 예시 파일을 복사해서 원본 이름으로 바꿉니다. **복사본에는 실제 비밀정보만 추가하고 절대 Git에 넣지 마세요.**
   - `Server/lib/sub/auth.example.json` → `auth.json` (OAuth 설정)
   - `Server/lib/sub/global.example.json` → `global.json` (DB·서버·관리자·포트·TLS)
   - `Server/lib/sub/unified.example.json` → `unified.json` (통합 서버 기능 사용 시)
2. 사용하려는 Google/Roblox/Discord/Naver 인증의 새로운 클라이언트 ID·비밀키를 `auth.json`에 넣고, 각 서비스 콘솔에서 OAuth 콜백 주소를 실제 도메인에 맞춥니다.
3. `global.json`에 운영 환경 DB 설정을 입력합니다. DB 비밀번호는 공백 그대로 두면 안 됩니다. SSL/WAF를 쓰는 경우에도 본인의 인증서 경로를 설정합니다.
4. OS 환경변수 `KKUTU_SESSION_SECRET`에 충분히 긴 무작위 문자열을 지정하세요(권장 32바이트 이상).
5. 서버에서는 각 모듈의 `package.json`과 lockfile을 기준으로 `npm install` 또는 `npm ci`를 수행하세요. 기존 Node/Grunt 버전 호환성을 확인하세요.

## 공개용 배포에서 추가로 설정 가능한 환경변수

- `KKUTU_SESSION_SECRET`: 세션 서명용 고정 비밀키 (필수 권장)
- `KKUTU_PUBLIC_URL`: 공개 홈페이지 기본 주소 (기본값 `https://example.com`, OpenGraph 메타데이터용)
- `KKUTU_CHAT_ALLOWED_HOSTS`: 채팅에서 허용할 추가 도메인 (쉼표 구분)
- `KKUTU_TRUST_PROXY=1`: 신뢰하는 역방향 프록시 바로 뒤에 놓인 서버에 한해서 사용
- `KKUTU_TRUST_CF_IP_HEADER=1`: 서버로의 직접 접속이 차단된 신뢰 가능한 Cloudflare/프록시 배치에서만 사용
- `KKUTU_DB_PASSWORD`: `docker-compose.yml`을 이용하는 경우 PostgreSQL 초기 비밀번호
- `KKUTU_UNIFIED_SECRET`: 통합 서버를 사용하는 경우 실제 공유 비밀키 (`unified.example.json` 기본값은 비활성)
- 브라우저 검색 주소는 `window.KKUTU_SEARCH_BASE_URL`로 지정 가능 (미설정 시 예시 URL)

## 보안·라이선스 참고

- 이 배포본은 **비밀정보 제거 및 공개 시 개인정보 유출 예방을 위한 정리**입니다. 전체 보안 취약점 해결이나 운영환경에서의 무결성을 보증하는 보안 감사를 의미하지 않습니다.
- 원본 프로젝트는 오래된 Node.js 및 여러 의존성을 포함할 수 있습니다. `npm audit` 결과를 별도로 검토하세요. `npm audit fix --force`는 기존 게임 기능을 깨뜨릴 수 있습니다.
- 이 ZIP을 기존 **운영 중인 서버**에 통째로 덮어쓰지 마세요. 개인 설정은 별도로 백업하고, 공개 저장소에 올릴 소스로만 사용하세요.
- 인증 비밀키나 인증서가 이전 Git 커밋/릴리스에 포함된 적이 있다면 해당 키는 반드시 재발급/교체하고, **이전 Git 기록도 별도로 정리**해야 합니다. `.gitignore`만 추가해서는 기존 기록에서 삭제되지 않습니다.
- 오디오·이미지·사전 DB 등 제삼자 에셋의 재배포 권리는 별도로 확인해야 합니다. 원본 라이선스 표시는 보존했습니다.

## Git에서 이미 추적 중인 운영 파일 제거

Git 저장소에서 아래 파일들이 이미 커밋된 경우, 운영 데이터의 로컬 파일을 삭제하지 않고 Git 추적만 해제하세요.

```bash
git rm --cached --ignore-unmatch Server/lib/sub/auth.json Server/lib/sub/global.json Server/lib/sub/unified.json ssl/origin.key ssl/origin.crt KKUTU_ERROR.log Server/lib/Web/public/roblox-oauth-review.mp4
git add -A
git status
```

**주의:** Git 기록에 이전에 노출된 인증키는 별도 회전해야 합니다.
