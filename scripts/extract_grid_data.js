// Court Auction Grid Data Extractor
// Run via Chrome DevTools MCP: mcp__chrome-devtools__evaluate_script
// Returns JSON with {count, items, oddRows} from the current page
//
// r1 columns: [0]=checkbox, [1]=caseInfo(법원+사건번호), [2]=itemNo, [3]=location+detail,
//             [4]=mapBtn, [5]=note(비고), [6]=appraisal(감정평가액), [7]=dept+saleDate
// r2 columns: [0]=usage(용도), [1]=minPrice+ratio, [2]=status(진행상태)
() => {
  const table = document.getElementById('mf_wfm_mainFrame_grd_gdsDtlSrchResult_body_table');
  if (!table) return JSON.stringify({error: 'Grid table not found'});
  const rows = table.querySelectorAll('tr.grid_body_row');
  const oddRows = rows.length % 2 !== 0;
  const items = [];
  for (let i = 0; i < rows.length; i += 2) {
    const r1 = rows[i].querySelectorAll('td');
    const r2 = (i+1 < rows.length) ? rows[i+1].querySelectorAll('td') : [];
    const caseInfo = r1[1]?.innerText?.trim() || '';
    const parts = caseInfo.split('\n');
    const locText = r1[3]?.innerText?.trim() || '';
    const locParts = locText.split('\n');
    const deptDate = r1[7]?.innerText?.trim() || '';
    const ddParts = deptDate.split('\n');
    const minPriceText = r2[1]?.innerText?.trim() || '';
    const mpParts = minPriceText.split('\n');
    items.push({
      court: parts[0] || '',
      caseNo: parts[1] || '',
      itemNo: r1[2]?.innerText?.trim() || '',
      address: locParts[0] || '',
      detail: locParts.slice(1).join(' ') || '',
      note: r1[5]?.innerText?.trim() || '',
      appraisal: r1[6]?.innerText?.trim() || '',
      dept: ddParts[0] || '',
      saleDate: ddParts[1] || '',
      usage: r2[0]?.innerText?.trim() || '',
      minPrice: mpParts[0] || '',
      ratio: mpParts[1] || '',
      status: r2[2]?.innerText?.trim() || ''
    });
  }
  return JSON.stringify({count: items.length, items: items, oddRows: oddRows});
}
