// Batch Extract All Pages — v2 core script
// Runs as a single async evaluate_script call.
// Navigates all pages, extracts grid data, returns combined JSON.
// Eliminates per-page MCP calls (snapshot, wait_for, navigate).
//
// Usage (Chrome DevTools MCP):
//   mcp__chrome-devtools__evaluate_script(function: "<this entire script>")
//
// Usage (OpenClaw):
//   browser act { kind: "evaluate", fn: "<this entire script>" }
//
// Optional: Pass ["startPage", "endPage"] as args to extract a subset.
//   e.g., args: ["1", "5"] for pages 1-5 only
//
async (startPageArg, endPageArg) => {
  function extractPage() {
    const table = document.getElementById('mf_wfm_mainFrame_grd_gdsDtlSrchResult_body_table');
    if (!table) return [];
    const rows = table.querySelectorAll('tr.grid_body_row');
    const items = [];
    for (let i = 0; i < rows.length; i += 2) {
      const r1 = rows[i].querySelectorAll('td');
      const r2 = (i + 1 < rows.length) ? rows[i + 1].querySelectorAll('td') : [];
      const ci = r1[1]?.innerText?.trim() || ''; const p = ci.split('\n');
      const lt = r1[3]?.innerText?.trim() || ''; const lp = lt.split('\n');
      const dd = r1[7]?.innerText?.trim() || ''; const dp = dd.split('\n');
      const mp = r2[1]?.innerText?.trim() || ''; const mpp = mp.split('\n');
      items.push({
        court: p[0] || '', caseNo: p[1] || '',
        itemNo: r1[2]?.innerText?.trim() || '',
        address: lp[0] || '', detail: lp.slice(1).join(' ') || '',
        note: r1[5]?.innerText?.trim() || '',
        appraisal: r1[6]?.innerText?.trim() || '',
        dept: dp[0] || '', saleDate: dp[1] || '',
        usage: r2[0]?.innerText?.trim() || '',
        minPrice: mpp[0] || '', ratio: mpp[1] || '',
        status: r2[2]?.innerText?.trim() || ''
      });
    }
    return items;
  }

  function goToPage(n) {
    const el = document.getElementById('mf_wfm_mainFrame_pgl_gdsDtlSrchPage_page_' + n);
    if (el) { el.click(); return true; }
    // Try "next group" button when page button is not visible
    const nextBtns = document.querySelectorAll('[id*="gdsDtlSrchPage"] img[alt*="다음"]');
    if (nextBtns.length) {
      (nextBtns[0].closest('a,button') || nextBtns[0]).click();
      return true;
    }
    return false;
  }

  async function waitForPage(targetPage) {
    for (let i = 0; i < 16; i++) { // max 8 seconds
      const sel = document.querySelector('[class*="label_selected"]');
      if (sel && parseInt(sel.textContent.trim()) === targetPage) return true;
      await new Promise(r => setTimeout(r, 500));
    }
    return false;
  }

  // Calculate total pages
  const match = document.body.innerText.match(/총 물건수\s*(\d+)건/);
  const total = match ? parseInt(match[1]) : 0;
  const pageSize = 40;
  const totalPages = Math.ceil(total / pageSize);

  const startPage = parseInt(startPageArg) || 1;
  const endPage = Math.min(parseInt(endPageArg) || totalPages, totalPages);

  const allItems = [];
  const log = [];

  for (let pg = startPage; pg <= endPage; pg++) {
    const sel = document.querySelector('[class*="label_selected"]');
    const curPage = sel ? parseInt(sel.textContent.trim()) : 0;

    if (curPage !== pg) {
      goToPage(pg);
      const landed = await waitForPage(pg);
      if (!landed) {
        // Page group might have changed; retry
        goToPage(pg);
        await waitForPage(pg);
      }
    }

    const items = extractPage();
    allItems.push(...items);
    log.push('p' + pg + ':' + items.length);
  }

  return JSON.stringify({
    total: total,
    extracted: allItems.length,
    pages: totalPages,
    range: startPage + '-' + endPage,
    log: log,
    items: allItems
  });
}
