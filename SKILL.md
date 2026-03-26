---
name: court-auction-scraper
description: "대한민국 법원경매정보(courtauction.go.kr) 사이트에서 경매 매물을 검색하고 엑셀로 정리하는 스킬. 브라우저 자동화 도구(Chrome DevTools MCP, OpenClaw browser, 또는 Antigravity browser)를 사용하여 WebSquare 기반 동적 사이트를 자동 탐색한다. 사용 시점: (1) 경매 매물 찾아줘, (2) 법원경매 검색, (3) courtauction, (4) 지역+용도+가격 조건으로 경매 물건 검색 요청 시 활성화. 브라우저 자동화 도구 필수."
---

# 법원경매정보 스크래핑 스킬 v2

법원경매정보(courtauction.go.kr)에서 경매 매물을 검색하고 엑셀로 정리한다.
이 사이트는 WebSquare 프레임워크 SPA로, WebFetch로는 데이터 접근이 불가하다. **브라우저 자동화 도구 필수.**

사이트 구조 상세: [references/site-structure.md](references/site-structure.md)

---

## ⚠️ 절대 규칙

1. **항상 새 페이지(새 탭)로 시작한다.** 기존 탭 재사용 금지.
2. **모든 검색 조건을 설정한 후 검색 버튼을 누른다.** 조건 일부만 넣고 검색하지 않는다.
3. **뒤로가기/초기화를 사용하지 않는다.** 실패 시 새 페이지를 열고 처음부터 다시 시작.
4. **페이지 크기를 반드시 40으로 변경한다.**
5. **데이터 추출은 반드시 JS 실행(evaluate)으로 한다.** 스냅샷 텍스트를 수동으로 읽지 않는다.
6. **최종 결과는 JSON 저장 → 엑셀 변환까지 완료한다.**

---

## ⚡ 성능 핵심 원칙 (v2 신규)

> **스냅샷(a11y 트리)은 컨텍스트 윈도우와 Chrome 메모리를 폭발시키는 주범이다.**

| 원칙 | 이유 |
|------|------|
| **스냅샷은 폼 조작 시에만 (최대 2회)** | 검색 결과의 a11y 트리는 700+ 노드, 수만 토큰 |
| **데이터 추출은 무조건 evaluate_script** | JS 반환값은 필요한 데이터만 포함 |
| **wait_for 대신 JS polling 사용** | wait_for는 전체 스냅샷을 반환하여 컨텍스트 소진 |
| **페이지 순회는 async JS 일괄 실행** | 10페이지 × 호출 3회 = 30회 → **1~2회로 축소** |
| **filePath 옵션 활용 (지원 시)** | 스냅샷을 파일로 저장하면 컨텍스트를 먹지 않음 |
| **Subagent 위임 금지** | MCP/browser 툴은 메인 세션 전용, subagent 접근 불가 |

### v1 vs v2 MCP 호출 횟수 비교

| 단계 | v1 (기존) | v2 (개선) |
|------|----------|----------|
| 메인→검색폼 | snapshot×2, click×1, wait×1 = **4** | snapshot×2, click×1, JS poll×1 = **4** |
| 조건 입력 | fill×4, click×1, snapshot×1, wait×2 = **8** | fill×4, click×1, JS×2 = **7** |
| 페이지크기 변경 | snapshot×1, fill×1, wait×1 = **3** | JS×2 = **2** |
| 데이터 추출 (10p) | (navigate+wait+extract)×10 = **30** | **JS 1~2회** (async 일괄) |
| **합계** | **~45회** | **~14회** |

---

## 브라우저 환경 감지

이 스킬은 3가지 브라우저 환경을 지원한다:

| 동작 | Claude Code (Chrome DevTools MCP) | OpenClaw/Pi (browser tool) | Antigravity (Gemini + CDP) |
|------|-----------------------------------|---------------------------|---------------------------|
| 페이지 열기 | `mcp__chrome-devtools__new_page(url=URL)` | `browser open URL` | `browser.new_page(url=URL)` |
| 스냅샷 | `mcp__chrome-devtools__take_snapshot()` | `browser snapshot` | `browser.snapshot()` |
| 클릭 | `mcp__chrome-devtools__click(uid=REF)` | `browser act {kind:"click", ref:REF}` | `browser.click(uid=REF)` |
| 드롭다운 | `mcp__chrome-devtools__fill(uid=REF, value=VAL)` | `browser act {kind:"select", ref:REF, values:[VAL]}` | `browser.fill(uid=REF, value=VAL)` |
| **JS 실행** | `mcp__chrome-devtools__evaluate_script(function=FN)` | `browser act {kind:"evaluate", fn:FN}` | `browser.evaluate(function=FN)` |

**요소 참조(ref) 시스템 차이:**
- Chrome DevTools MCP: `uid="2_163"` (a11y 트리 경로)
- OpenClaw: `ref="e3"` (스냅샷의 `[ref=eN]` 태그)
- Antigravity: CDP uid 기반 (플랫폼 문서 참조)

---

## 워크플로우

### 1. 사용자 요구사항 파악

필수 파라미터 확인 (없으면 질문):
- **법원** (예: 대전지방법원) — 기본값: 없음
- **용도** (예: 아파트, 건물 전체) — 기본값: 전체
- **가격 상한** (예: 10억원) — 기본값: 전체
- **출력 파일명** — 기본값: `{지역}_경매매물_{날짜}.xlsx`

### 2. 사이트 접속 및 검색 폼 진입

> ⚠️ 반드시 **새 탭**으로 URL을 연다.

```
1. [페이지 열기] → https://www.courtauction.go.kr/pgj/index.on
2. [스냅샷 ①] → "물건상세검색" 링크의 ref 확인 → [클릭]
3. [JS polling] → "법원 선택" 텍스트 대기
4. [스냅샷 ②] → 검색 폼의 모든 요소 ref 확인
```

**스냅샷은 여기서 2회만 사용. 이후 검색 결과부터는 스냅샷 절대 금지.**

### 3. 검색 조건 입력

스냅샷 ②에서 확인한 ref로 **아래 순서대로** 설정:

```
STEP 1. 법원 콤보박스 (description="법원 선택") → [드롭다운 선택]
STEP 2. 입찰구분 "전체" → [클릭] (실패 시 아래 JS)
STEP 3. 용도 대분류 (description="대분류 선택") → [드롭다운 선택] "건물"
STEP 4. [JS polling] → "주거용건물" 대기 (중분류 동적 로딩)
STEP 5. (필요 시) 중분류/소분류 설정
STEP 6. 감정평가액 최대 (description="감정평가액 최대금액 선택") → [드롭다운 선택]
STEP 7. 검색 버튼 (description="부동산 물건상세 검색 버튼") → [클릭]
```

**입찰구분 "전체" JS 클릭** (라디오 버튼 클릭 실패 시):
```javascript
() => {
  const radios = document.querySelectorAll('input[type="radio"]');
  for (const r of radios) {
    const label = r.closest('td')?.innerText || '';
    if (label.includes('전체') && label.includes('기일입찰')) {
      const tds = r.closest('tr')?.querySelectorAll('input[type="radio"]') || [];
      for (const td of tds) {
        const nextText = td.nextSibling?.textContent || td.parentElement?.textContent || '';
        if (nextText.includes('전체') && !nextText.includes('기일') && !nextText.includes('기간')) {
          td.click(); return 'clicked 전체';
        }
      }
    }
  }
  return 'not found';
}
```

### 4. 페이지 크기 변경 및 총 건수 확인

> ⚡ **검색 결과 이후 스냅샷 금지 구간 — JS만 사용**

```
STEP 1. [JS polling] → "총 물건수" 텍스트 대기
STEP 2. [JS 실행] → 페이지 크기 40으로 변경
STEP 3. [JS polling] → "총 물건수" 텍스트 대기 (리로딩)
STEP 4. [JS 실행] → get_total_count → {total, actualPages} 확인
```

**JS polling (범용 텍스트 대기):**
```javascript
async () => {
  for (let i = 0; i < 30; i++) {
    if (document.body.innerText.includes('총 물건수')) return 'found';
    await new Promise(r => setTimeout(r, 500));
  }
  return 'timeout';
}
```

**페이지 크기 40 설정:**
```javascript
async () => {
  const selects = document.querySelectorAll('select');
  for (const s of selects) {
    const opts = [...s.options].map(o => o.value);
    if (opts.includes('40') && opts.includes('10')) {
      s.value = '40';
      s.dispatchEvent(new Event('change', {bubbles: true}));
      await new Promise(r => setTimeout(r, 3000));
      return 'set to 40';
    }
  }
  return 'combo not found';
}
```

**총 건수 확인** (`scripts/get_total_count.js`):
```javascript
(pageSize) => {
  const ps = parseInt(pageSize) || 40;
  const bodyText = document.body.innerText;
  const match = bodyText.match(/총 물건수\s*(\d+)건/);
  const total = match ? parseInt(match[1]) : 0;
  const actualPages = Math.ceil(total / ps);
  const selected = document.querySelector('[class*="label_selected"]');
  const currentPage = selected ? parseInt(selected.textContent.trim()) : 1;
  return JSON.stringify({total, actualPages, currentPage, pageSize: ps});
}
```

### 5. 데이터 추출 — 전 페이지 일괄 수집 ⚡

> **v2 핵심**: 한 번의 async JS로 모든 페이지를 순회하여 데이터 수집.

**[JS 실행]** → `scripts/batch_extract_all_pages.js`:

```javascript
async () => {
  function extractPage() {
    const table = document.getElementById('mf_wfm_mainFrame_grd_gdsDtlSrchResult_body_table');
    if (!table) return [];
    const rows = table.querySelectorAll('tr.grid_body_row');
    const items = [];
    for (let i = 0; i < rows.length; i += 2) {
      const r1 = rows[i].querySelectorAll('td');
      const r2 = (i+1 < rows.length) ? rows[i+1].querySelectorAll('td') : [];
      const ci = r1[1]?.innerText?.trim()||''; const p = ci.split('\n');
      const lt = r1[3]?.innerText?.trim()||''; const lp = lt.split('\n');
      const dd = r1[7]?.innerText?.trim()||''; const dp = dd.split('\n');
      const mp = r2[1]?.innerText?.trim()||''; const mpp = mp.split('\n');
      items.push({
        court:p[0]||'', caseNo:p[1]||'', itemNo:r1[2]?.innerText?.trim()||'',
        address:lp[0]||'', detail:lp.slice(1).join(' ')||'',
        note:r1[5]?.innerText?.trim()||'', appraisal:r1[6]?.innerText?.trim()||'',
        dept:dp[0]||'', saleDate:dp[1]||'',
        usage:r2[0]?.innerText?.trim()||'',
        minPrice:mpp[0]||'', ratio:mpp[1]||'', status:r2[2]?.innerText?.trim()||''
      });
    }
    return items;
  }
  function goToPage(n) {
    const el = document.getElementById('mf_wfm_mainFrame_pgl_gdsDtlSrchPage_page_' + n);
    if (el) { el.click(); return true; }
    const next = document.querySelectorAll('[id*="gdsDtlSrchPage"] img[alt*="다음"]');
    if (next.length) { (next[0].closest('a,button')||next[0]).click(); return true; }
    return false;
  }
  async function waitForPage(pg) {
    for (let i = 0; i < 16; i++) {
      const s = document.querySelector('[class*="label_selected"]');
      if (s && parseInt(s.textContent.trim()) === pg) return true;
      await new Promise(r => setTimeout(r, 500));
    }
    return false;
  }

  const match = document.body.innerText.match(/총 물건수\s*(\d+)건/);
  const total = match ? parseInt(match[1]) : 0;
  const totalPages = Math.ceil(total / 40);
  const allItems = [];
  const log = [];

  for (let pg = 1; pg <= totalPages; pg++) {
    const s = document.querySelector('[class*="label_selected"]');
    const cur = s ? parseInt(s.textContent.trim()) : 0;
    if (cur !== pg) {
      goToPage(pg);
      if (!await waitForPage(pg)) { goToPage(pg); await waitForPage(pg); }
    }
    const items = extractPage();
    allItems.push(...items);
    log.push('p'+pg+':'+items.length);
  }

  return JSON.stringify({total, extracted: allItems.length, pages: totalPages, log, items: allItems});
}
```

**반환값이 너무 크면** (토큰 초과 시), `startPage`/`endPage`로 분할:
```javascript
// 1~5페이지만: 위 스크립트에서 for문을 pg=1; pg<=5 로 수정
// 6~10페이지: pg=6; pg<=totalPages 로 수정
```

### 6. JSON 저장 → 엑셀 변환

수집한 items를 JSON 파일로 저장 후 엑셀 변환:

```bash
# openpyxl 설치 (최초 1회)
python3 -m venv /tmp/auction_venv && source /tmp/auction_venv/bin/activate && pip install openpyxl

# 엑셀 생성
python3 scripts/create_auction_excel.py data.json output.xlsx --region "대전" --usage "아파트"
```

---

## 실패 시 복구

| 상황 | 하지 말 것 | 해야 할 것 |
|------|-----------|-----------|
| 잘못된 페이지 | 뒤로가기, 초기화 | **새 탭으로 URL 다시 열기** |
| 검색 조건 오류 | 초기화 후 같은 탭 재사용 | **새 탭으로 URL 다시 열기** |
| 드롭다운 실패 | 반복 클릭 | **JS로 직접 값 설정** |
| 데이터 안 읽힘 | 스냅샷 파싱 | **JS로 extract_grid_data 실행** |
| JS 반환값 너무 큼 | 한 번에 전체 추출 | **페이지 범위 분할** |
| 브라우저 크래시 | 같은 탭 재연결 | **새 탭으로 새로 시작** |
| CDP 연결 끊김 | 재연결 반복 | **Chrome 디버그 모드 재시작** |

## 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| "검색결과가 없습니다" | 기간 범위가 좁음 | 입찰구분을 "전체"로 변경 |
| 콤보박스 선택 실패 | ref 변경됨 | 스냅샷으로 최신 ref 재확인 |
| 라디오 버튼 클릭 실패 | interactive하지 않음 | JS로 직접 클릭 |
| "page N not found" | 페이지 그룹 밖 | "다음 목록" 버튼 먼저 클릭 |
| **브라우저 팅김 (OOM)** | **스냅샷 과다 호출** | **검색 결과 후 스냅샷 금지, JS만 사용** |
| **CDP 연결 끊김** | **스냅샷 생성 중 타임아웃** | **JS polling으로 대체** |
| **컨텍스트 윈도우 초과** | **스냅샷 응답이 수만 토큰** | **filePath 옵션 또는 JS 전용** |
| evaluate 비활성화 (OpenClaw) | 기본값 false | `browser.evaluateEnabled=true` 설정 |
| Subagent에서 MCP 접근 불가 | MCP 툴은 메인 세션 전용 | **메인 세션에서 직접 실행** |

---

## 플랫폼별 참고사항

### Claude Code (Chrome DevTools MCP)
- `--autoConnect` 플래그로 Chrome 자동 연결 권장
- `take_snapshot(filePath="/tmp/snap.txt")` → 컨텍스트 절약
- `evaluate_script`의 `args` 파라미터로 인자 전달

### OpenClaw / Pi
- `browser.evaluateEnabled=true` 필수 (기본 false)
- Pi에서는 Chromium 메모리가 제한적 → 스냅샷 최소화가 더욱 중요
- ref는 스냅샷의 `[ref=eN]` — Chrome DevTools의 uid와 다름
- Subagent(Worker)는 browser 툴 접근 불가 → 메인 세션에서 실행

### Antigravity (Gemini + CDP)
- Google Cloud Code Assist 환경에서 CDP 기반 브라우저 제어
- 인증: `openclaw models auth login --provider google-antigravity`
- JS evaluate 문법은 플랫폼 문서 확인

---

## 부록: 콤보박스 WebSquare 직접 제어

법원경매 사이트의 콤보박스는 표준 `<select>`가 아닌 WebSquare 커스텀 위젯이다.
일반 select 동작 실패 시:

```javascript
() => {
  const combo = document.querySelector('[id*="sbx_courtNm"]');
  if (combo && combo.setValue) {
    combo.setValue("대전지방법원");
    return 'set via WebSquare API';
  }
  return 'combo not found';
}
```
