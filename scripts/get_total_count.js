// Get total item count and calculate actual page count
// Run after clicking 검색 and waiting for results
// pageSize: pass current page size as argument (default 40)
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
