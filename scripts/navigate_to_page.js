// Navigate to a specific page in the auction grid (v2 — with async wait)
// Handles page group boundaries (e.g., page 11+ when only 1-10 buttons visible)
// Usage: evaluate_script with args: ["3"]
async (pageNum) => {
  const pg = parseInt(pageNum);
  const el = document.getElementById('mf_wfm_mainFrame_pgl_gdsDtlSrchPage_page_' + pg);
  if (el) {
    el.click();
  } else {
    // Page button not visible — click "next group" first
    const nextBtns = document.querySelectorAll('[id*="gdsDtlSrchPage"] img[alt*="다음"]');
    if (nextBtns.length) {
      (nextBtns[0].closest('a,button') || nextBtns[0]).click();
      await new Promise(r => setTimeout(r, 2000));
      const el2 = document.getElementById('mf_wfm_mainFrame_pgl_gdsDtlSrchPage_page_' + pg);
      if (el2) el2.click();
      else return 'page ' + pg + ' not found after group advance';
    } else {
      return 'page ' + pg + ' not found';
    }
  }
  // Wait for page to load
  for (let i = 0; i < 16; i++) {
    const sel = document.querySelector('[class*="label_selected"]');
    if (sel && parseInt(sel.textContent.trim()) === pg) return 'navigated to page ' + pg;
    await new Promise(r => setTimeout(r, 500));
  }
  return 'navigation timeout for page ' + pg;
}
