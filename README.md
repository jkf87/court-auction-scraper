# court-auction-scraper v2

법원경매정보(courtauction.go.kr)에서 경매 매물을 자동 검색하고 엑셀로 정리하는 AI 에이전트 스킬.

## 지원 플랫폼

| 플랫폼 | 브라우저 도구 | 상태 |
|--------|-------------|------|
| **Claude Code** | Chrome DevTools MCP (`--autoConnect`) | ✅ 검증됨 |
| **OpenClaw / Pi** | browser tool (`evaluateEnabled=true`) | ✅ 지원 |
| **Antigravity** | Gemini + CDP | ✅ 지원 |

## v2 개선사항

v1에서 **브라우저가 자주 팅기던 근본 원인을 해결**했습니다:

| 병목 | 원인 | v2 해결 |
|------|------|---------|
| 스냅샷 폭탄 | 검색 결과의 a11y 트리가 700+ 노드 (수만 토큰) | 검색 결과 후 **스냅샷 금지**, JS evaluate만 사용 |
| MCP 호출 과다 | 페이지당 navigate+wait+extract = 3회 × 10페이지 | **async JS 일괄 순회** (1~2회로 축소) |
| `wait_for` 부작용 | 텍스트 확인만 하면 되는데 전체 트리 반환 | **JS polling으로 대체** |
| Subagent 실패 | MCP 툴은 메인 세션 전용, subagent 접근 불가 | **메인 세션 직접 실행** 명시 |

**MCP 호출 횟수: ~45회 → ~14회 (70% 감소)**

## 설치

### Claude Code
```bash
claude install-skill court-auction-scraper.skill
```

### OpenClaw
```bash
# .skill 파일 설치
unzip court-auction-scraper.skill -d ~/.openclaw/skills/court-auction-scraper

# browser evaluate 활성화 필수
# gateway.json에서 browser.evaluateEnabled=true 설정
```

### 수동 설치
`SKILL.md`, `references/`, `scripts/` 폴더를 프로젝트에 복사.

## 사용법

```
경매 매물 찾아줘
- 법원: 대전지방법원
- 용도: 건물
- 감정평가액: 10억원 이하
```

## 핵심 스크립트

| 파일 | 역할 |
|------|------|
| `scripts/batch_extract_all_pages.js` | **v2 핵심** — async로 전 페이지 일괄 순회+추출 |
| `scripts/extract_grid_data.js` | 단일 페이지 그리드 데이터 추출 |
| `scripts/navigate_to_page.js` | 페이지 이동 (그룹 넘김 자동 처리) |
| `scripts/get_total_count.js` | 총 건수 및 페이지 수 계산 |
| `scripts/create_auction_excel.py` | JSON → 엑셀 변환 (openpyxl) |

## 워크플로우 요약

```
1. 새 탭 열기 → 메인 페이지
2. [스냅샷 2회만] → 검색 폼 진입 + 조건 입력
3. 검색 실행
4. ─── 이후 스냅샷 금지 ───
5. [JS] 페이지 크기 40 설정
6. [JS] batch_extract_all_pages.js 실행 (전 페이지 일괄)
7. JSON 저장 → 엑셀 변환
```

## License

MIT
