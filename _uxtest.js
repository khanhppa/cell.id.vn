/**
 * Harness test cho 4 hạng mục UX (public/app.js + public/index.html).
 * Chạy: node _uxtest.js
 *
 *  1. Phiên làm việc giữ qua F5 (sessionStorage 'ct_session_logs')
 *  2. Nút bật/tắt lớp cell trên bản đồ (L.control.layers nhận overlayMaps)
 *  3. Click dòng kết quả tra cứu → highlightCellOnMap
 *  4. Lịch sử hàng loạt → nạp sang tab Xem rút list (switchTab('calllogs'))
 */
const fs = require('fs');
const path = require('path');

const appSrc = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf8');
const htmlSrc = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''}`); }
}
// Trích thân hàm (cân bằng ngoặc nhọn) để assert theo phạm vi hẹp.
function fnBody(name) {
  const idx = appSrc.indexOf('function ' + name + '(');
  if (idx === -1) return '';
  const open = appSrc.indexOf('{', idx);
  let depth = 0;
  for (let i = open; i < appSrc.length; i++) {
    if (appSrc[i] === '{') depth++;
    else if (appSrc[i] === '}') { depth--; if (depth === 0) return appSrc.slice(open, i + 1); }
  }
  return appSrc.slice(open);
}

console.log('\n== 1. Phiên làm việc giữ qua F5 ==');
ok('có hằng SESSION_LOGS_KEY = ct_session_logs', /SESSION_LOGS_KEY\s*=\s*'ct_session_logs'/.test(appSrc));
ok('có hàm saveCallSession', /function saveCallSession\(\)/.test(appSrc));
ok('có hàm loadCallSession', /function loadCallSession\(\)/.test(appSrc));
ok('có hàm clearCallSession', /function clearCallSession\(\)/.test(appSrc));
ok('saveCallSession ghi sessionStorage.setItem', /sessionStorage\.setItem\(SESSION_LOGS_KEY/.test(appSrc));
ok('loadCallSession đọc sessionStorage.getItem', /sessionStorage\.getItem\(SESSION_LOGS_KEY/.test(appSrc));
ok('clearCallSession xoá key', /sessionStorage\.removeItem\(SESSION_LOGS_KEY/.test(appSrc));
ok('saveCallSession bọc try/catch (quota)', /function saveCallSession\(\)\s*\{\s*try\s*\{/.test(appSrc));
ok('có giới hạn số dòng lưu phiên', /SESSION_LOGS_MAX\s*=\s*\d+/.test(appSrc));
const loadBody = fnBody('loadCallLogs');
ok('loadCallLogs khôi phục từ session khi server rỗng', /loadCallSession\(\)/.test(loadBody));
ok('loadCallLogs lưu phiên khi có dữ liệu', /saveCallSession\(\)/.test(loadBody));
ok('resolveUnmatchedCells lưu lại phiên sau khi tra xong', /renderCallLogs\(\);\s*saveCallSession\(\);/.test(fnBody('resolveUnmatchedCells')));

console.log('\n== 2. Nút bật/tắt lớp cell trên bản đồ ==');
ok('có cellOverlay = L.layerGroup()', /const cellOverlay\s*=\s*L\.layerGroup\(\)/.test(appSrc));
ok('có overlayMaps', /const overlayMaps\s*=/.test(appSrc));
ok('L.control.layers nhận overlayMaps (không còn null)', /L\.control\.layers\(baseMaps,\s*overlayMaps,/.test(appSrc));
ok('KHÔNG còn L.control.layers(baseMaps, null', !/L\.control\.layers\(baseMaps,\s*null/.test(appSrc));
ok('plotCallLogs thêm marker vào cellOverlay', /cellMarkers\.forEach\(m\s*=>\s*cellOverlay\.removeLayer\(m\)\)/.test(appSrc));
ok('plotCallLogs thêm circle vào cellOverlay', /cellOverlay\.addLayer\(circle\)/.test(appSrc));
ok('showCellOnMap dùng cellOverlay', /cellOverlay\.addLayer\(lookupCircle\)/.test(appSrc));
ok('histOpenBatchOnMap dùng cellOverlay', /cellOverlay\.addLayer\(histBatchGroup\)/.test(appSrc));
ok('histOpenBatchOnMap gỡ group khỏi cellOverlay', /cellOverlay\.removeLayer\(histBatchGroup\)/.test(appSrc));
ok('histChildClick gỡ group khỏi cellOverlay', /cellOverlay\.removeLayer\(histBatchGroup\)/.test(appSrc));

console.log('\n== 3. Click dòng kết quả tra cứu → highlight ==');
ok('có hàm highlightCellOnMap', /function highlightCellOnMap\(lat, lon, range, radio, label\)/.test(appSrc));
ok('có hàm clearHighlight', /function clearHighlight\(\)/.test(appSrc));
const hlBody = fnBody('highlightCellOnMap');
ok('highlightCellOnMap gọi clearHighlight', /clearHighlight\(\)/.test(hlBody));
ok('highlightCellOnMap setView zoom động theo bán kính', /map\.setView\(\[lat, lon\], zoomForRadius\(lat, lon, radius\)\)/.test(hlBody));
ok('có hàm zoomForRadius', /function zoomForRadius\(lat, lon, radiusM\)/.test(appSrc));
const zfrBody = fnBody('zoomForRadius');
ok('zoomForRadius dùng getBoundsZoom của Leaflet', /map\.getBoundsZoom\(/.test(zfrBody));
ok('zoomForRadius clamp zoom 11..18', /Math\.max\(11,\s*Math\.min\(18,/.test(zfrBody));
ok('highlightCellOnMap thêm layer vào cellOverlay', /cellOverlay\.addLayer\(highlightLayer\)/.test(hlBody));
ok('highlightCellOnMap có class cell-hl-ring', /cell-hl-ring/.test(hlBody));
ok('highlightCellOnMap chặn toạ độ không hợp lệ', /isFinite\(lat\)/.test(hlBody));
const searchBody = fnBody('searchCells');
ok('searchCells render onclick highlightCellOnMap', /onclick=\\?"highlightCellOnMap\(/.test(searchBody));
ok('searchCells chỉ gắn click khi có toạ độ', /hasCoord/.test(searchBody));
ok('histOpenOnMap dùng highlightCellOnMap cho cell đơn', /function histOpenOnMap[\s\S]{0,1200}highlightCellOnMap\(/.test(appSrc));
ok('histChildClick dùng highlightCellOnMap', /function histChildClick[\s\S]{0,900}highlightCellOnMap\(/.test(appSrc));
ok('plotCallLogs xoá highlight cũ', /clearHighlight\(\);/.test(fnBody('plotCallLogs')));
const renderBody = fnBody('renderCallLogs');
ok('renderCallLogs dòng có toạ độ gắn onclick highlightCellOnMap', /onclick=\\?"highlightCellOnMap\(/.test(renderBody));
ok('renderCallLogs nút xoá có event.stopPropagation', /event\.stopPropagation\(\);deleteCallLog\(/.test(renderBody));

console.log('\n== 4. Lịch sử hàng loạt → tab Xem rút list ==');
ok('có hàm openCallLogsFromHistory', /function openCallLogsFromHistory\(rows, fileName\)/.test(appSrc));
const ocBody = fnBody('openCallLogsFromHistory');
ok('openCallLogsFromHistory gọi switchTab(calllogs)', /switchTab\('calllogs'\)/.test(ocBody));
ok('map lng -> lon', /lon:\s*r\.lng/.test(ocBody));
ok('map created_at -> timestamp', /timestamp:\s*r\.created_at/.test(ocBody));
ok('map range -> cell_range', /cell_range:\s*r\.range/.test(ocBody));
ok('đánh dấu _fromHistory', /_fromHistory:\s*true/.test(ocBody));
ok('đánh dấu _fromHistoryOpened', /_fromHistoryOpened\s*=\s*true/.test(ocBody));
ok('reset chip lọc hành động về all', /clActionFilter\s*=\s*'all'/.test(ocBody));
ok('reset ô tìm kiếm logSearchInput', /logSearchInput[\s\S]{0,80}value = ''/.test(ocBody));
ok('openCallLogsFromHistory KHÔNG ghi sessionStorage', !/sessionStorage/.test(ocBody));
ok('histOpenOnMap batch KHÔNG còn gọi histOpenBatchOnMap', !/function histOpenOnMap[\s\S]{0,900}histOpenBatchOnMap\(r\.batch_id\)/.test(appSrc));
ok('histOpenOnMap batch gọi openCallLogsFromHistory', /function histOpenOnMap[\s\S]{0,1200}openCallLogsFromHistory\(/.test(appSrc));
ok('resolveUnmatchedCells bỏ qua row _fromHistory (không tiêu credit)', /r\._fromHistory\)\s*continue/.test(fnBody('resolveUnmatchedCells')));
ok('renderCallLogs ẩn nút xoá với bản ghi từ lịch sử', /l\._fromHistory\s*\?\s*''/.test(renderBody));

console.log('\n== 5. Phiên rút list (upload Excel) — xoá / xem lại ==');
ok('có hàm deleteCallLogSession', /async function deleteCallLogSession\(batchId\)/.test(appSrc));
ok('deleteCallLogSession gọi DELETE /api/call-log-sessions/', /apiRequest\('DELETE', '\/api\/call-log-sessions\/'/.test(appSrc));
ok('deleteCallLogSession có confirm', /confirm\(t\('hist\.clSessionConfirmDelete'\)\)/.test(appSrc));
ok('deleteCallLogSession dọn list khi xoá phiên đang mở', /currentCallLogBatchId\(\)\s*===\s*batchId/.test(appSrc));
ok('deleteCallLogBatch là alias của deleteCallLogSession', /function deleteCallLogBatch\(batchId\)\s*\{\s*return deleteCallLogSession\(batchId\)/.test(appSrc));
ok('có hàm batchLabelText', /function batchLabelText\(bId\)/.test(appSrc));
ok('renderCallLogs khong con header batch trong list', !/deleteCallLogBatch\('/.test(renderBody));
ok('renderCallLogs gọi renderCurrentSessionBar', /renderCurrentSessionBar\(\)/.test(renderBody));
ok('renderCallLogs gọi updateClFilterBadge', /updateClFilterBadge\(\)/.test(renderBody));
ok('có hàm renderCurrentSessionBar', /function renderCurrentSessionBar\(\)/.test(appSrc));
ok('dòng phiên hiện tại có nút xoá phiên', /deleteCallLogSession\('\$\{histJsSafe\(bId\)\}'\)/.test(fnBody('renderCurrentSessionBar')));
ok('có hàm currentCallLogBatchId', /function currentCallLogBatchId\(\)/.test(appSrc));
ok('currentCallLogBatchId bỏ qua row _fromHistory', /!l\._fromHistory\s*&&\s*l\.batch_id/.test(fnBody('currentCallLogBatchId')));
ok('có hàm loadCallLogSessions', /async function loadCallLogSessions\(\)/.test(appSrc));
ok('loadCallLogSessions gọi GET /api/call-log-sessions', /apiRequest\('GET', '\/api\/call-log-sessions\?page=1/.test(fnBody('loadCallLogSessions')));
ok('có hàm renderCallLogSessions', /function renderCallLogSessions\(\)/.test(appSrc));
ok('renderCallLogSessions render mỗi phiên 1 card', /cl-session-card/.test(fnBody('renderCallLogSessions')));
ok('renderCallLogSessions có nút mở lại phiên', /openCallLogSession\('/.test(fnBody('renderCallLogSessions')));
ok('renderCallLogSessions có nút xoá phiên', /deleteCallLogSession\('/.test(fnBody('renderCallLogSessions')));
ok('có hàm openCallLogSession', /async function openCallLogSession\(batchId\)/.test(appSrc));
ok('openCallLogSession gọi GET /api/call-log-sessions/', /apiRequest\('GET', '\/api\/call-log-sessions\/'/.test(fnBody('openCallLogSession')));
ok('openCallLogSession đánh dấu _fromHistory', /_fromHistory:\s*true/.test(fnBody('openCallLogSession')));
ok('openCallLogSession chuyển sang tab calllogs', /switchTab\('calllogs'\)/.test(fnBody('openCallLogSession')));
ok('loadLookupHistory nạp luôn danh sách phiên', /loadCallLogSessions\(\)/.test(fnBody('loadLookupHistory')));
ok('loadCallLogs lấy limit rộng hơn 500 (không mất bản ghi)', /api\/call-logs\?page=1&limit=2000/.test(fnBody('loadCallLogs')));

console.log('\n== 5b. Bộ lọc tab Xem rút list (collapse + chip) ==');
ok('có hàm toggleCallLogFilters', /function toggleCallLogFilters\(\)/.test(appSrc));
ok('toggleCallLogFilters toggle #callLogFilterPanel', /getElementById\('callLogFilterPanel'\)/.test(fnBody('toggleCallLogFilters')));
ok('có state clActionFilter', /let clActionFilter = 'all'/.test(appSrc));
ok('getFilteredLogs đọc clActionFilter', /const actionFilter = clActionFilter/.test(fnBody('getFilteredLogs')));
ok('KHÔNG còn getElementById actionFilter trong app.js', !/getElementById\('actionFilter'\)/.test(appSrc));
ok('có hàm setClActionFilter', /function setClActionFilter\(action, chipEl\)/.test(appSrc));
ok('có hàm updateClFilterBadge', /function updateClFilterBadge\(\)/.test(appSrc));
ok('bắt click chip qua delegation #clActionChips', /closest\('#clActionChips \.cl-chip'\)/.test(appSrc));

console.log('\n== 6. Draw layer persist (created/edited/deleted) ==');
ok('drawnItems và logShapeGroup là 2 group riêng', /const logShapeGroup = new L\.FeatureGroup\(\)/.test(appSrc));
ok('plotCallLogs clear logShapeGroup (không clear drawnItems)', /logShapeGroup\.clearLayers\(\)/.test(fnBody('plotCallLogs')));
ok('plotCallLogs KHÔNG clear drawnItems', !/drawnItems\.clearLayers\(\)/.test(fnBody('plotCallLogs')));
ok('có handler L.Draw.Event.DELETED', /map\.on\(L\.Draw\.Event\.DELETED/.test(appSrc));
ok('handler DELETED gọi deleteAnnotation', /L\.Draw\.Event\.DELETED[\s\S]{0,300}deleteAnnotation\(/.test(appSrc));
ok('handler EDITED gọi saveAnnotation', /L\.Draw\.Event\.EDITED[\s\S]{0,600}saveAnnotation\(/.test(appSrc));
ok('handler EDITED xoá bản ghi cũ (delete+insert)', /L\.Draw\.Event\.EDITED[\s\S]{0,900}deleteAnnotation\(oldId\)/.test(appSrc));
ok('handler CREATED gắn _annotationId qua saveAnnotationForLayer', /L\.Draw\.Event\.CREATED[\s\S]{0,400}saveAnnotationForLayer\(/.test(appSrc));
ok('có hàm deleteAnnotation gọi DELETE /api/annotations/', /function deleteAnnotation\(id\)[\s\S]{0,400}\/api\/annotations\/' \+ id/.test(appSrc));
ok('loadAnnotations gán _annotationId vào layer', /l\._annotationId = a\.id/.test(fnBody('loadAnnotations')));

console.log('\n== i18n ==');
ok("có key 'calllogs.resetSession' (vi+en)", (appSrc.match(/'calllogs\.resetSession'/g) || []).length >= 2);
ok("có key 'calllogs.sessionCleared' (vi+en)", (appSrc.match(/'calllogs\.sessionCleared'/g) || []).length >= 2);
ok("có key 'calllogs.restored' (vi+en)", (appSrc.match(/'calllogs\.restored'/g) || []).length >= 2);
ok("có key 'hist.openedAsCallLogs' (vi+en)", (appSrc.match(/'hist\.openedAsCallLogs'/g) || []).length >= 2);
ok("có key 'calllogs.batchDelete' (vi+en)", (appSrc.match(/'calllogs\.batchDelete'/g) || []).length >= 2);
ok("có key 'calllogs.batchLabel' (vi+en)", (appSrc.match(/'calllogs\.batchLabel'/g) || []).length >= 2);
ok("có key 'hist.clSessions' (vi+en)", (appSrc.match(/'hist\.clSessions'/g) || []).length >= 2);
ok("có key 'hist.clSessionDelete' (vi+en)", (appSrc.match(/'hist\.clSessionDelete'/g) || []).length >= 2);
ok("có key 'hist.clSessionConfirmDelete' (vi+en)", (appSrc.match(/'hist\.clSessionConfirmDelete'/g) || []).length >= 2);
ok("có key 'calllogs.filters' (vi+en)", (appSrc.match(/'calllogs\.filters'/g) || []).length >= 2);
ok("có key 'calllogs.deleteThisSession' (vi+en)", (appSrc.match(/'calllogs\.deleteThisSession'/g) || []).length >= 2);
ok('có hàm fmtTpl nội suy {n}', /function fmtTpl\(key, vars\)/.test(appSrc));

console.log('\n== UI (index.html) ==');
ok('có banner phiên #callSessionBanner', /id="callSessionBanner"/.test(htmlSrc));
ok('banner có nút Xoá phiên gọi resetCallSession', /onclick="resetCallSession\(\)"/.test(htmlSrc));
ok('có thanh tổng kết #callLogSummaryBar', /id="callLogSummaryBar"/.test(htmlSrc));
ok('CSS có @keyframes cellPulse', /@keyframes cellPulse/.test(htmlSrc));
ok('CSS có .cell-hl-ring', /\.cell-hl-ring\s*\{/.test(htmlSrc));
ok('CSS có .call-session-banner', /\.call-session-banner\s*\{/.test(htmlSrc));
ok('CSS có .call-log-summary', /\.call-log-summary\s*\{/.test(htmlSrc));
ok('<td>/<tr> mở = đóng (không lệch thẻ)', (htmlSrc.match(/<td\b/g) || []).length === (htmlSrc.match(/<\/td>/g) || []).length);
ok('có khối phiên #clSessionsList trong tab Lịch sử', /id="clSessionsList"/.test(htmlSrc));
ok('có #clSessionsBox (details)', /id="clSessionsBox"/.test(htmlSrc));
ok('có panel bộ lọc #callLogFilterPanel', /id="callLogFilterPanel"/.test(htmlSrc));
ok('panel bộ lọc mặc định ẩn (class hidden)', /id="callLogFilterPanel" class="cl-filter-panel hidden"/.test(htmlSrc));
ok('có nút toggle bộ lọc #clFilterToggle', /id="clFilterToggle"/.test(htmlSrc));
ok('có dãy chip lọc #clActionChips', /id="clActionChips"/.test(htmlSrc));
ok('chip lọc có đủ 5 loại hành động', ['all','CALL_IN','CALL_OUT','SMS_IN','SMS_OUT'].every(a => htmlSrc.includes('data-action="' + a + '"')));
ok('KHÔNG còn <select id="actionFilter">', !/id="actionFilter"/.test(htmlSrc));
ok('có dòng phiên đang xem #clCurrentSession', /id="clCurrentSession"/.test(htmlSrc));
ok('CSS có .cl-chip', /\.cl-chip\s*\{/.test(htmlSrc));
ok('CSS có .cl-session-card', /\.cl-session-card\s*\{/.test(htmlSrc));
ok('CSS có .cl-cur-session', /\.cl-cur-session\s*\{/.test(htmlSrc));
ok('CSS có .cl-sessions', /\.cl-sessions\s*\{/.test(htmlSrc));

console.log('\n== Phím tắt phát lại ==');
ok('có listener keydown cho play', /addEventListener\('keydown'/.test(appSrc));
ok('ArrowLeft -> playStep(-1)', /ArrowLeft'[\s\S]{0,60}playStep\(-1\)/.test(appSrc));
ok('ArrowRight -> playStep(1)', /ArrowRight'[\s\S]{0,60}playStep\(1\)/.test(appSrc));
ok('Space -> playToggle', /e\.code === 'Space'[\s\S]{0,60}playToggle\(\)/.test(appSrc));
ok('bỏ qua khi focus vào input/select/textarea', /tag === 'input' \|\| tag === 'select' \|\| tag === 'textarea'/.test(appSrc));
ok('showPlayNav toggle class play-active', /classList\.toggle\('play-active'/.test(appSrc));

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
