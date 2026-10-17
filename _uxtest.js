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
ok('có hàm openCallLogsFromHistory', /async function openCallLogsFromHistory\(rows, fileName, batchId\)/.test(appSrc));
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
ok('countResolveNeeded bỏ qua row _fromHistory (không tiêu credit)', /r\._fromHistory\)\s*continue/.test(fnBody('countResolveNeeded')));
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
ok('currentCallLogBatchId trả batch_id kể cả row _fromHistory', /l\.batch_id\)\s*return\s*l\.batch_id/.test(fnBody('currentCallLogBatchId')));
ok('currentCallLogBatchId ưu tiên currentOpenBatchId', /if \(currentOpenBatchId\) return currentOpenBatchId/.test(fnBody('currentCallLogBatchId')));
ok('currentCallLogBatchId KHÔNG còn loại row _fromHistory', !/_fromHistory/.test(fnBody('currentCallLogBatchId')));
ok('có biến currentOpenBatchId', /let currentOpenBatchId = ''/.test(appSrc));
ok('openCallLogSession lưu currentOpenBatchId', /currentOpenBatchId = batchId/.test(fnBody('openCallLogSession')));
ok('openCallLogSession giữ batch_id trong row', /batch_id: r\.batch_id \|\| batchId/.test(fnBody('openCallLogSession')));
ok('openCallLogsFromHistory reset currentOpenBatchId (dữ liệu lookup không xoá được)', /currentOpenBatchId = ''/.test(fnBody('openCallLogsFromHistory')));
ok('resetCallSession xoá currentOpenBatchId', /myLogsCache = \[\];[\s\S]{0,60}currentOpenBatchId = ''/.test(fnBody('resetCallSession')));
ok('loadCallLogs gán currentOpenBatchId từ phiên mới nhất', /currentOpenBatchId = \(myLogsCache\[0\] && myLogsCache\[0\]\.batch_id\)/.test(fnBody('loadCallLogs')));
ok('saveCallSession lưu batchId', /batchId: currentOpenBatchId/.test(fnBody('saveCallSession')));
ok('loadCallLogs khôi phục currentOpenBatchId từ sessionStorage', /currentOpenBatchId = sess\.batchId/.test(fnBody('loadCallLogs')));
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
ok('chip SMS dùng icon free fa-comment-sms (không còn Pro-only)', /data-action="SMS_IN"[\s\S]{0,160}fa-comment-sms/.test(htmlSrc) && /data-action="SMS_OUT"[\s\S]{0,160}fa-comment-sms/.test(htmlSrc));
ok('KHÔNG còn icon Pro fa-envelope-arrow-* trong index.html', !/fa-envelope-arrow-(down|up)/.test(htmlSrc));
ok('chip SMS có mũi tên đến/đi (.cl-chip-dir + fa-arrow-down/up)', /fa-arrow-down cl-chip-dir/.test(htmlSrc) && /fa-arrow-up cl-chip-dir/.test(htmlSrc));
ok('chip gọi đến/đi dùng fa-phone + mũi tên (không còn Pro-only)', /data-action="CALL_IN"[\s\S]{0,160}fa-phone"[\s\S]{0,120}fa-arrow-down cl-chip-dir/.test(htmlSrc) && /data-action="CALL_OUT"[\s\S]{0,160}fa-phone"[\s\S]{0,120}fa-arrow-up cl-chip-dir/.test(htmlSrc));
ok('KHÔNG còn icon Pro fa-phone-arrow-* trong index.html', !/fa-phone-arrow-(down-left|up-right)/.test(htmlSrc));
ok('có hàm clearCallLogDate xoá 1 đầu khoảng', /function clearCallLogDate\(which\)/.test(appSrc));
ok('có hàm syncClDateButtons', /function syncClDateButtons\(\)/.test(appSrc));
ok('applyCallLogFilters gọi syncClDateButtons', /syncClDateButtons\(\)/.test(fnBody('applyCallLogFilters')));
ok('dateTo so sánh trọn ngày cuối (<= 23:59:59)', /23:59:59/.test(fnBody('getFilteredLogs')));

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
ok('KHÔNG còn banner phiên #callSessionBanner (gộp vào #clCurrentSession)', !/id="callSessionBanner"/.test(htmlSrc));
ok('KHÔNG còn nút topbar gọi resetCallSession (đã gỡ khỏi HTML)',
  !/onclick="resetCallSession\(\)"/.test(htmlSrc));
ok('vẫn còn hàm resetCallSession (dùng lại được)',
  /async function resetCallSession/.test(appSrc));
ok('topbar KHÔNG còn nút mở tab Lịch sử tra cứu',
  !/cl-topbar[\s\S]{0,600}switchTab\('lookuphistory'\)/.test(htmlSrc));
ok('topbar có nút Hướng dẫn mở #clGuideModal',
  /cl-topbar[\s\S]{0,600}onclick="openClGuideModal\(\)"/.test(htmlSrc));
ok('có popup #clGuideModal (modal-overlay)', /<div class="modal-overlay" id="clGuideModal">/.test(htmlSrc));
ok('có hàm openClGuideModal/closeClGuideModal',
  /function openClGuideModal\(\)[\s\S]{0,160}classList\.add\('show'\)/.test(appSrc) &&
  /function closeClGuideModal\(\)[\s\S]{0,160}classList\.remove\('show'\)/.test(appSrc));
ok('search row: .cl-search-row chứa #logSearchInput + #clFilterToggle',
  /class="cl-search-row"[\s\S]{0,600}id="logSearchInput"/.test(htmlSrc) &&
  /class="cl-search-row"[\s\S]{0,900}id="clFilterToggle"/.test(htmlSrc));
ok('tab calllogs KHÔNG còn nhãn cells.search',
  !/id="tab-calllogs"[\s\S]{0,600}data-i18n="cells\.search"/.test(htmlSrc));
ok('CSS có .cl-search-row', /\.cl-search-row\s*\{/.test(htmlSrc));
ok('KHÔNG còn thanh tổng kết #callLogSummaryBar', !/id="callLogSummaryBar"/.test(htmlSrc));
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
ok('có ô ngày from/to #clDateFromField/#clDateToField', /id="clDateFromField"/.test(htmlSrc) && /id="clDateToField"/.test(htmlSrc));
ok('giữ input #dateFrom/#dateTo (phủ trong suốt, type=date)', /id="dateFrom"[^>]*class="cl-date-native"/.test(htmlSrc) && /id="dateTo"[^>]*class="cl-date-native"/.test(htmlSrc));
ok('input date nằm trong .cl-date-field để nhận click mở picker', /<div class="cl-date-field"[\s\S]{0,200}id="dateFrom"/.test(htmlSrc) && /<div class="cl-date-field"[\s\S]{0,200}id="dateTo"/.test(htmlSrc));
ok('KHÔNG còn input datetime-local trong index.html', !/type="datetime-local"/.test(htmlSrc));
ok('CSS có .cl-date-range/.cl-date-field/.cl-date-native/.cl-chip-dir', /\.cl-date-range\s*\{/.test(htmlSrc) && /\.cl-date-field\s*\{/.test(htmlSrc) && /\.cl-date-native\s*\{/.test(htmlSrc) && /\.cl-chip-dir\s*\{/.test(htmlSrc));
ok("i18n calllogs.dateFrom/dateTo (vi+en)", (appSrc.match(/'calllogs\.dateFrom'/g) || []).length >= 2 && (appSrc.match(/'calllogs\.dateTo'/g) || []).length >= 2);
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

console.log('\n== Popup nạp Excel (modal) ==');
ok('KHÔNG còn <details id="clUploadTools"> trong index.html', !/<details id="clUploadTools"/.test(htmlSrc));
ok('có popup #clUploadModal (modal-overlay)', /<div class="modal-overlay" id="clUploadModal">/.test(htmlSrc));
ok('popup có 3 bước pick/busy/confirm', /id="clUpStepPick"/.test(htmlSrc) &&
  /id="clUpStepBusy"/.test(htmlSrc) && /id="clUpStepConfirm"/.test(htmlSrc));
ok('bước pick có dropzone + input file', /id="clUpDrop"[\s\S]{0,600}<input type="file"/.test(htmlSrc));
ok('bước confirm có #clUpStats + #clUpResolve + nút confirmClResolve',
  /id="clUpStats"/.test(htmlSrc) && /id="clUpResolve"/.test(htmlSrc) &&
  /onclick="confirmClResolve\(\)"/.test(htmlSrc));
ok('CSS có .cl-topbar / .cl-up-drop / .cl-up-stat / .cl-up-resolve',
  /\.cl-topbar\s*\{/.test(htmlSrc) && /\.cl-up-drop\s*\{/.test(htmlSrc) &&
  /\.cl-up-stat\s*\{/.test(htmlSrc) && /\.cl-up-resolve\s*\{/.test(htmlSrc));
ok('CSS KHÔNG còn .cl-tools / .cl-prompt', !/\.cl-tools\s*\{/.test(htmlSrc) && !/\.cl-prompt\s*\{/.test(htmlSrc));
ok('tab-calllogs có thanh hành động mở overlay bảng cell + giữ popup cũ cho luồng Lịch sử',
  /id="tab-calllogs"[\s\S]{0,900}onclick="openClTableOverlay\(\)"/.test(htmlSrc) &&
  /function openClUploadModal\(\)/.test(appSrc) && /function closeClUploadModal\(\)/.test(appSrc));
ok('có hàm openClUploadModal mở modal (.show)', /function openClUploadModal\(\)[\s\S]{0,160}classList\.add\('show'\)/.test(appSrc));
ok('có hàm closeClUploadModal đóng modal', /function closeClUploadModal\(\)[\s\S]{0,160}classList\.remove\('show'\)/.test(appSrc));
ok('có hàm setClUpStep chuyển 3 bước', /function setClUpStep\(name\)[\s\S]{0,400}clUpStepConfirm/.test(appSrc));
ok('có hàm confirmClResolve tra sau khi đóng popup',
  /function confirmClResolve\(\)[\s\S]{0,200}resolveUnmatchedCells\(\)/.test(appSrc));
ok('có hàm skipClResolve đóng popup không tra',
  /function skipClResolve\(\)[\s\S]{0,160}closeClUploadModal\(\)/.test(appSrc));
ok('renderClConfirm dùng countResolveNeeded + Auth.getCreditConfig',
  /countResolveNeeded\(\)/.test(fnBody('renderClConfirm')) && /Auth\.getCreditConfig\(\)/.test(fnBody('renderClConfirm')));
ok('renderClConfirm ẩn nút khi không có cell cần tra (n === 0)',
  /n === 0[\s\S]{0,300}confirmBtn\.style\.display = 'none'/.test(fnBody('renderClConfirm')));
ok('renderClConfirm disable nút khi không đủ điểm', /confirmBtn\.disabled = !enough/.test(fnBody('renderClConfirm')));
ok('uploadCallLogExcel gọi loadCallLogs({ prompt: false }) rồi renderClConfirm',
  /loadCallLogs\(\{ prompt: false \}\)/.test(fnBody('uploadCallLogExcel')) &&
  /renderClConfirm\(/.test(fnBody('uploadCallLogExcel')));
ok('empty-state chỉ còn hint (bỏ nút Load Excel + Hướng dẫn)',
  !/openClUploadModal\(\)/.test(fnBody('renderCallLogs')) &&
  !/openClGuideModal\(\)/.test(fnBody('renderCallLogs')) &&
  /calllogs\.emptyHint/.test(fnBody('renderCallLogs')));
ok('empty-state KHÔNG còn nút mở tab Lịch sử tra cứu',
  !/switchTab\('lookuphistory'\)/.test(fnBody('renderCallLogs')));
ok('có hàm openClResolveForRestore (hiện ngay, không mở popup)',
  /function openClResolveForRestore\(\)/.test(appSrc));
ok('openClResolveForRestore bỏ cờ hoãn map + vẽ lại (không popup)',
  /function openClResolveForRestore\(\)[\s\S]{0,200}clMapDeferred = false[\s\S]{0,80}renderCallLogs\(\)/.test(appSrc));
ok('openCallLogsFromHistory KHÔNG mở popup xác nhận',
  !/openClUploadModal\(\)/.test(fnBody('openCallLogsFromHistory')) &&
  !/openClResolveForRestore[\s\S]{0,0}setClUpStep/.test(fnBody('openCallLogsFromHistory')) &&
  /renderCallLogs\(\)|openClResolveForRestore\(\)/.test(fnBody('openCallLogsFromHistory')) &&
  !/resolveUnmatchedCells\(/.test(fnBody('openCallLogsFromHistory')));
ok('openClResolveForRestore KHÔNG còn mở popup (không setClUpStep/classList.add)',
  !/setClUpStep/.test(fnBody('openClResolveForRestore')) &&
  !/classList\.add\('show'\)/.test(fnBody('openClResolveForRestore')));
ok('openCallLogSession KHÔNG mở popup xác nhận (hiện ngay)',
  !/openClUploadModal\(\)/.test(fnBody('openCallLogSession')) &&
  !/resolveUnmatchedCells\(/.test(fnBody('openCallLogSession')));
ok('countResolveNeeded bỏ qua dòng _fromHistory (không trừ điểm khi phục hồi)',
  /if \(r\._fromHistory\) continue;/.test(fnBody('countResolveNeeded')));
ok('i18n calllogs.loadExcel/uploadTitle/chooseFile/confirmResolve (vi+en)',
  (appSrc.match(/'calllogs\.loadExcel'/g) || []).length >= 2 &&
  (appSrc.match(/'calllogs\.uploadTitle'/g) || []).length >= 2 &&
  (appSrc.match(/'calllogs\.chooseFile'/g) || []).length >= 2 &&
  (appSrc.match(/'calllogs\.confirmResolve'/g) || []).length >= 2);

console.log('\n== Cảnh báo điểm trước khi tra ==');
ok('có hàm countResolveNeeded', /function countResolveNeeded\(\)/.test(appSrc));
ok('renderClConfirm cảnh báo khi số dư < tổng điểm (notEnoughTotal)',
  /calllogs\.notEnoughTotal/.test(fnBody('renderClConfirm')));
ok('renderClConfirm có nút Nạp điểm → /topup.html',
  /renderClConfirm[\s\S]{0,2600}href="\/topup\.html"/.test(appSrc));
ok('i18n calllogs.notEnoughTotal/topupBtn (vi+en)',
  (appSrc.match(/'calllogs\.notEnoughTotal'/g) || []).length >= 2 &&
  (appSrc.match(/'calllogs\.topupBtn'/g) || []).length >= 2);

console.log('\n== Hoãn vẽ bản đồ (clMapDeferred) ==');
ok('có state clMapDeferred', /let clMapDeferred = false;/.test(appSrc));
ok('plotCallLogs defer: return sớm khi clMapDeferred',
  /function plotCallLogs\(records\)[\s\S]{0,700}if \(clMapDeferred\) return;/.test(appSrc));
ok('uploadCallLogExcel bật clMapDeferred = true',
  /function uploadCallLogExcel\(event\)[\s\S]{0,2200}clMapDeferred = true;/.test(appSrc));
ok('confirmClResolve tắt cờ hoãn (clMapDeferred = false)',
  /function confirmClResolve\(\)[\s\S]{0,200}clMapDeferred = false;/.test(appSrc));
ok('skipClResolve tắt cờ hoãn + vẽ lại',
  /function skipClResolve\(\)[\s\S]{0,200}clMapDeferred = false;[\s\S]{0,80}renderCallLogs\(\)/.test(appSrc));
ok('resolveUnmatchedCells tắt cờ hoãn khi bắt đầu tra',
  /async function resolveUnmatchedCells\(\)[\s\S]{0,400}clMapDeferred = false;/.test(appSrc));
ok('resolveUnmatchedCells break khi credit.insufficient (không gọi vòng kế)',
  /if \(credit\.insufficient\) break;/.test(fnBody('resolveUnmatchedCells')));

console.log('\n== Popup marker dùng chung (buildCellPopupHtml) ==');
ok('có hàm buildCellPopupHtml', /function buildCellPopupHtml\(opts\)/.test(appSrc));
ok('plotCallLogs dùng buildCellPopupHtml', /buildCellPopupHtml\(/.test(fnBody('plotCallLogs')));
ok('showCellOnMap dùng buildCellPopupHtml', /buildCellPopupHtml\(/.test(fnBody('showCellOnMap')));
ok('buildCellPopupHtml nhận opts.extra (list bản ghi)',
  /opts\.extra/.test(fnBody('buildCellPopupHtml')));
ok('plotCallLogs extra có "Số bản ghi"/records + list timestamp',
  /histEsc\(t\('upload\.records'\)\)/.test(fnBody('plotCallLogs')) &&
  /lineItems/.test(fnBody('plotCallLogs')));
ok('plotCallLogs đọc toạ độ cả r.lat/lon (không đổi shape)',
  /r\.lat && r\.lon/.test(fnBody('plotCallLogs')));
ok('SOURCE_LABELS là hằng global (dùng chung)',
  /^const SOURCE_LABELS = \{/m.test(appSrc));
ok('i18n calllogs.guideBtn/guideTitle/guide1..7 (vi+en)',
  (appSrc.match(/'calllogs\.guideBtn'/g) || []).length >= 2 &&
  (appSrc.match(/'calllogs\.guideTitle'/g) || []).length >= 2 &&
  (appSrc.match(/'calllogs\.guide3'/g) || []).length >= 2);
ok('có hàm showResolvePrompt mở popup bước confirm', /async function showResolvePrompt\(\)/.test(appSrc) &&
  /setClUpStep\('confirm'\)/.test(fnBody('showResolvePrompt')));
ok('có hàm startResolveFromPrompt', /function startResolveFromPrompt\(\)/.test(appSrc));
ok('có hàm skipResolve', /function skipResolve\(\)/.test(appSrc));
ok('có hàm showResolveResult', /function showResolveResult\(credit\)/.test(appSrc));
ok('loadCallLogs hỏi prompt khi không truyền prompt:false', /showResolvePrompt\(\)/.test(fnBody('loadCallLogs')) &&
  /opts\.prompt === false/.test(fnBody('loadCallLogs')));
ok('loadCallLogs KHÔNG còn auto gọi resolveUnmatchedCells', !/await resolveUnmatchedCells\(\)/.test(fnBody('loadCallLogs')));
ok('renderClConfirm dùng countResolveNeeded để ước tính', /countResolveNeeded\(\)/.test(fnBody('renderClConfirm')));
ok('renderClConfirm đọc cost từ Auth.getCreditConfig', /Auth\.getCreditConfig\(\)/.test(fnBody('renderClConfirm')));
ok('renderClConfirm đọc số dư qua Auth.getCreditBalance', /getCreditBalance\(\)/.test(fnBody('renderClConfirm')));
ok('renderClConfirm disable nút khi không đủ điểm (popup)', /confirmBtn\.disabled = !enough/.test(fnBody('renderClConfirm')));
ok('renderClConfirm LUÔN refresh số dư (nạp điểm ở tab khác vẫn dùng được)',
  /balance = await Auth\.refreshCreditBalance\(\)/.test(fnBody('renderClConfirm')) &&
  !/balance == null && typeof Auth\.refreshCreditBalance/.test(fnBody('renderClConfirm')));
ok('renderClConfirm có fallback cache khi refresh lỗi',
  /if \(balance == null\) balance = Auth\.getCreditBalance\(\)/.test(fnBody('renderClConfirm')));
ok('có refresh số dư khi cửa sổ focus lại (quay về từ /topup.html)',
  /window\.addEventListener\('focus', rebind\)/.test(appSrc) &&
  /visibilitychange/.test(appSrc));
ok('có nút #clResolveNowBtn ở topbar gọi confirmClResolve',
  /id="clResolveNowBtn"/.test(htmlSrc) && /onclick="confirmClResolve\(\)"/.test(htmlSrc));
ok('có helper updateClResolveNowBtn + gọi trong renderCallLogs',
  /function updateClResolveNowBtn\(\)/.test(appSrc) &&
  /updateClResolveNowBtn\(\)/.test(fnBody('renderCallLogs')));
ok('updateClResolveNowBtn hiện nút khi còn cell cần tra',
  /countResolveNeeded\(\)\.length/.test(fnBody('updateClResolveNowBtn')) &&
  /btn\.style\.display = 'none'/.test(fnBody('updateClResolveNowBtn')));
ok('showResolveResult mở filter panel để thấy thông báo điểm',
  /toggleCallLogFilters\(\)/.test(fnBody('showResolveResult')));
ok('auth.js có Auth.getCreditConfig gọi /api/credits/config',
  (() => { const a = fs.readFileSync(path.join(__dirname, 'public', 'auth.js'), 'utf8');
    return /Auth\.getCreditConfig = async function[\s\S]{0,300}\/api\/credits\/config/.test(a); })());
ok('i18n calllogs.resolveNeed/skipBtn/notEnough (vi+en)',
  (appSrc.match(/'calllogs\.resolveNeed'/g) || []).length >= 2 &&
  (appSrc.match(/'calllogs\.skipBtn'/g) || []).length >= 2 &&
  (appSrc.match(/'calllogs\.notEnough'/g) || []).length >= 2);

console.log('\n== Trừ điểm một phần ==');
const resolveBody = fnBody('resolveUnmatchedCells');
ok('resolveUnmatchedCells tích luỹ resp.credit.charged', /credit\.charged \+= Number\(resp\.credit\.charged\)/.test(resolveBody));
ok('resolveUnmatchedCells ghi nhận insufficient', /resp\.credit\.insufficient/.test(resolveBody));
ok('resolveUnmatchedCells dùng countResolveNeeded', /countResolveNeeded\(\)/.test(resolveBody));
ok('resolveUnmatchedCells gọi showResolveResult sau khi tra', /showResolveResult\(credit\)/.test(resolveBody));
ok('i18n calllogs.creditCharged/creditPartial/notEnough (vi+en)',
  (appSrc.match(/'calllogs\.creditCharged'/g) || []).length >= 2 &&
  (appSrc.match(/'calllogs\.creditPartial'/g) || []).length >= 2 &&
  (appSrc.match(/'calllogs\.notEnough'/g) || []).length >= 2);

console.log('\n== Tra lần lượt khi thiếu điểm + thông báo 3 số ==');
// Client tích luỹ đủ found/missed/unpaid từ server.
ok('resolveUnmatchedCells tích luỹ credit.found', /credit\.found \+= Number\(resp\.credit\.found\)/.test(resolveBody));
ok('resolveUnmatchedCells tích luỹ credit.missed', /credit\.missed \+= Number\(resp\.credit\.missed\)/.test(resolveBody));
ok('resolveUnmatchedCells ghi nhận credit.unpaid', /credit\.unpaid = Math\.max\(credit\.unpaid, Number\(resp\.credit\.unpaid\)/.test(resolveBody));
ok('resolveUnmatchedCells bỏ qua cell unpaid (không nhận toạ độ chưa trả phí)',
  /if \(r\.unpaid\) \{ continue; \}/.test(resolveBody));
// Thông báo 3 số: tra được / không ra kết quả / chưa tra vì hết điểm.
const resultBody = fnBody('showResolveResult');
ok('showResolveResult dùng {m} = số cell không ra kết quả', /replace\('\{m\}', missed\)/.test(resultBody));
ok('showResolveResult dùng {z} = số cell chưa tra vì hết điểm', /replace\('\{z\}', left\)/.test(resultBody));
ok('showResolveResult đọc credit.missed/credit.unpaid',
  /credit\.missed/.test(resultBody) && /credit\.unpaid/.test(resultBody));
ok('i18n creditCharged/creditPartial có placeholder {m} (vi+en)',
  (appSrc.match(/'calllogs\.creditCharged': '[^']*\{m\}/g) || []).length >= 2 &&
  (appSrc.match(/'calllogs\.creditPartial': '[^']*\{m\}/g) || []).length >= 2);
ok('i18n creditPartial báo "không ra kết quả" + "chưa tra" (vi)',
  /Đã tra \{f\}\/\{n\} cell[^']*\{m\} cell không ra kết quả[^']*\{z\} cell chưa tra/.test(appSrc));

const srvSrc2 = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
ok('server trả credit.found/missed/unpaid', /creditInfo\.found = foundCount/.test(srvSrc2) &&
  /creditInfo\.missed = missCount/.test(srvSrc2) && /creditInfo\.unpaid = unpaidCount/.test(srvSrc2));
ok('server gán charged theo THỨ TỰ (tra lần lượt đến khi hết điểm)',
  /let paidLeft = affordable/.test(srvSrc2) && /if \(paidLeft > 0\) \{[\s\S]{0,120}results\[i\]\.charged = true/.test(srvSrc2));
ok('server ẩn toạ độ cell found vượt điểm (unpaid:true, lat/lon null)',
  /results\[i\]\.unpaid = true;[\s\S]{0,200}results\[i\]\.lat = null;[\s\S]{0,80}results\[i\]\.lon = null;/.test(srvSrc2));
ok('server: retry cùng vòng (duplicate) coi như đã trả phí cả lô',
  /if \(charge\.duplicate\) affordable = foundCount;/.test(srvSrc2));

// Nguồn Google Geolocation — option B: chỉ chạy cho cell miss, gom nhóm ≤ setting.
ok("server có 'google' trong ONLINE_SOURCE_TYPES + defaults",
  /ONLINE_SOURCE_TYPES = \[[^\]]*'google'/.test(srvSrc2) && /google: \{ name: 'Google Geolocation'/.test(srvSrc2));
ok('server mặc định TẮT nguồn google (tốn phí)',
  /ONLINE_SOURCE_DEFAULT_DISABLED = \['opencellid_web', 'google'\]/.test(srvSrc2));
ok('resolver google gửi considerIp:false (không rò toạ độ theo IP server)',
  /considerIp: false/.test(srvSrc2));
ok('resolver google KHÔNG set cellId cho radio nr (dùng newRadioCellId)',
  /tower\.newRadioCellId = nid;/.test(srvSrc2) &&
  !/if \(radio === 'nr'\) \{[\s\S]{0,400}tower\.cellId = [^\n]*\n[\s\S]{0,100}\}/.test(srvSrc2));
ok('server gom nhóm google theo max_google_per_batch',
  /maxPerReq = await getGoogleMaxPerBatch\(\)/.test(srvSrc2) &&
  /missIdx\.slice\(g, g \+ maxPerReq\)/.test(srvSrc2));
ok('getGoogleKey fallback GOOGLE_MAPS_API_KEY + DB-first',
  /process\.env\.GOOGLE_MAPS_API_KEY/.test(srvSrc2) && /getGoogleKeyFromDB/.test(srvSrc2));
ok('setting max_google_per_batch nằm trong SETTING_KEYS + SETTING_DEFAULTS',
  /'max_google_per_batch'/.test(srvSrc2) && /max_google_per_batch: '10'/.test(srvSrc2) &&
  /max_google_per_batch: 1e5/.test(srvSrc2));
ok('admin: option google trong admin.html',
  /<option value="google">/.test(fs.readFileSync(path.join(__dirname, 'public', 'admin.html'), 'utf8')));
ok('admin: input max_google_per_batch + nhánh hint google + badge',
  /id="setGoogleMax"/.test(fs.readFileSync(path.join(__dirname, 'public', 'admin.html'), 'utf8')) &&
  /type === 'google'/.test(fs.readFileSync(path.join(__dirname, 'public', 'admin.js'), 'utf8')) &&
  /s === 'google'/.test(fs.readFileSync(path.join(__dirname, 'public', 'admin.js'), 'utf8')));

ok('showPlayNav toggle class play-active', /classList\.toggle\('play-active'/.test(appSrc));

console.log('\n== Fix rút list (6 hạng mục) ==');

// (1) Ô tìm kiếm đồng bộ: icon kính lúp + nút xoá + placeholder i18n.
ok('HTML có .cl-search-box bọc input + icon search',
  /class="cl-search-box"/.test(htmlSrc) && /cl-search-ico/.test(htmlSrc));
ok('HTML có nút xoá tìm kiếm #logSearchClear',
  /id="logSearchClear"/.test(htmlSrc) && /onclick="clearLogSearch\(\)"/.test(htmlSrc));
ok('CSS có .cl-search-box / .cl-search-ico / .cl-search-clear',
  /\.cl-search-box\s*\{/.test(htmlSrc) && /\.cl-search-ico\s*\{/.test(htmlSrc) &&
  /\.cl-search-clear\s*\{/.test(htmlSrc));
ok('CSS .cl-search-box có border+background+height (input không nằm trong .form-group)',
  /\.cl-search-box\s*\{[^}]*height:\s*30px[^}]*border:\s*1px solid var\(--border-color\)[^}]*background:\s*var\(--bg-surface2\)/.test(htmlSrc));
ok('CSS #logSearchInput có border:0 + transparent + color + font-size',
  /\.cl-search-box #logSearchInput\s*\{[^}]*border:\s*0[^}]*background:\s*transparent[^}]*color:\s*var\(--text-primary\)[^}]*font-size:\s*12px/.test(htmlSrc));
ok('CSS có focus-within cho ô tìm kiếm', /\.cl-search-box:focus-within\s*\{/.test(htmlSrc));
ok('CSS nút lọc có height 30px khớp ô tìm kiếm',
  /\.cl-filter-toggle\s*\{[^}]*height:\s*30px/.test(htmlSrc));
ok('input tìm kiếm dùng placeholder i18n',
  /id="logSearchInput"[^>]{0,200}data-i18n-placeholder="calllogs\.searchPlaceholder"/.test(htmlSrc));
ok('có hàm syncLogSearchClear + clearLogSearch',
  /function syncLogSearchClear\(\)/.test(appSrc) && /function clearLogSearch\(\)/.test(appSrc));
ok('renderCallLogs gọi syncLogSearchClear', /syncLogSearchClear\(\)/.test(fnBody('renderCallLogs')));
ok('i18n calllogs.searchPlaceholder/clearSearch (vi+en)',
  (appSrc.match(/'calllogs\.searchPlaceholder'/g) || []).length >= 2 &&
  (appSrc.match(/'calllogs\.clearSearch'/g) || []).length >= 2);

// (2) Kết quả tra cứu nằm TRONG panel bộ lọc (chỉ hiện khi mở filter).
const idxFilterPanel = htmlSrc.indexOf('id="callLogFilterPanel"');
const idxCreditNotice = htmlSrc.indexOf('id="clCreditNotice"');
const idxLogList = htmlSrc.indexOf('id="logRecordList"');
ok('HTML: #clCreditNotice nằm trong #callLogFilterPanel',
  idxFilterPanel !== -1 && idxCreditNotice > idxFilterPanel && idxCreditNotice < idxLogList,
  { idxFilterPanel, idxCreditNotice, idxLogList });
ok('HTML: #clCreditNotice không còn đứng trước #clCurrentSession',
  !(idxCreditNotice !== -1 && idxCreditNotice < htmlSrc.indexOf('id="clCurrentSession"')));

// (3)+(6) Trừ điểm: ref tách theo vòng.
ok('client gửi roundIdx mỗi vòng resolve',
  /roundIdx: round/.test(fnBody('resolveUnmatchedCells')));

// (4) Vào trang chủ KHÔNG tự mở popup nạp list.
ok('init gọi loadCallLogs({ prompt: false }) — không tự bật popup',
  /loadCallLogs\(\{ prompt: false \}\);\s*\n\s*loadAnnotations\(\)/.test(appSrc));

// (5) Đồng ý / Bỏ qua đều vẽ lại bản đồ.
ok('resolveUnmatchedCells tắt cờ hoãn TRƯỚC nhánh early-return',
  /async function resolveUnmatchedCells\(\)[\s\S]{0,300}clMapDeferred = false;[\s\S]{0,120}if \(unresolved\.length === 0\)/.test(appSrc));
ok('resolveUnmatchedCells vẽ map khi không còn cell cần tra',
  /if \(unresolved\.length === 0\) \{\s*\n\s*renderCallLogs\(\);/.test(appSrc));
ok('resolveUnmatchedCells catch cũng vẽ lại map (không nuốt lỗi)',
  /catch \(e\) \{[\s\S]{0,200}clMapDeferred = false;[\s\S]{0,80}renderCallLogs\(\);/.test(fnBody('resolveUnmatchedCells')));

console.log('\n== Trừ điểm cell đã có trong CSDL nội bộ ==');
// Luật: "tra ra kết quả là trừ điểm" — KHÔNG phân biệt nguồn local hay online.
// countResolveNeeded KHÔNG được bỏ qua cell đã có toạ độ (nếu chưa trả phí).
ok('countResolveNeeded KHÔNG bỏ qua cell đã có lat/lon',
  !/if \(r\.lat && r\.lon\) continue;/.test(fnBody('countResolveNeeded')));
ok('countResolveNeeded bỏ qua cell đã trả phí (_charged)',
  /if \(r\._charged\) continue;/.test(fnBody('countResolveNeeded')));
ok('countResolveNeeded vẫn bỏ qua dòng mở từ Lịch sử',
  /if \(r\._fromHistory\) continue;/.test(fnBody('countResolveNeeded')));
// Server trả cờ `charged` theo từng cell.
ok('client đọc resp.results[].charged để đánh dấu _charged',
  /r\.charged/.test(fnBody('resolveUnmatchedCells')) && /_charged = true;/.test(fnBody('resolveUnmatchedCells')));

// =====================================================
// Popup full-window: bảng CELL sau khi nạp Excel
// =====================================================
console.log('\n== Popup bảng cell (overlay full-window) ==');
ok('HTML có overlay #clTableOverlay (.cl-fullsheet)',
  /<div class="cl-fullsheet" id="clTableOverlay">/.test(htmlSrc));
ok('overlay có 3 bước pick/busy/table',
  /id="clSheetStepPick"/.test(htmlSrc) && /id="clSheetStepBusy"/.test(htmlSrc) &&
  /id="clSheetStepTable"/.test(htmlSrc));
ok('bước pick có dropzone #clSheetDrop + input file gọi uploadCallLogAnalyze',
  /id="clSheetDrop"[\s\S]{0,700}onchange="uploadCallLogAnalyze\(event\)"/.test(htmlSrc));
ok('có bảng #clTableHead + #clTableBody + khối meta',
  /id="clTableHead"/.test(htmlSrc) && /id="clTableBody"/.test(htmlSrc) && /id="clSheetMeta"/.test(htmlSrc));
ok('footer có chọn tất cả + đếm + nút map + nút tra',
  /id="clSelectAll"/.test(htmlSrc) && /id="clSheetCount"/.test(htmlSrc) &&
  /id="clMapAllBtn"/.test(htmlSrc) && /id="clResolveSelectedBtn"/.test(htmlSrc) &&
  /onclick="plotClTableOnMap\(\)"/.test(htmlSrc) && /onclick="resolveClSelectedClick\(\)"/.test(htmlSrc));
ok('nút topbar Load Excel mở overlay mới (openClTableOverlay)',
  /id="tab-calllogs"[\s\S]{0,600}onclick="openClTableOverlay\(\)"/.test(htmlSrc));
ok('CSS .cl-fullsheet nằm DƯỚI navbar (inset top 48px) + z-index 4900',
  /\.cl-fullsheet\s*\{[^}]*position:\s*fixed[^}]*inset:\s*48px 0 0 0[^}]*z-index:\s*4900/.test(htmlSrc));
ok('CSS có .cl-fullsheet.show hiện overlay',
  /\.cl-fullsheet\.show\s*\{\s*display:\s*flex/.test(htmlSrc));
ok('CSS có .cl-sheet-head/.cl-sheet-body/.cl-tbl-wrap/.cl-sheet-foot',
  /\.cl-sheet-head\s*\{/.test(htmlSrc) && /\.cl-sheet-body\s*\{/.test(htmlSrc) &&
  /\.cl-tbl-wrap\s*\{/.test(htmlSrc) && /\.cl-sheet-foot\s*\{/.test(htmlSrc));
ok('CSS có cột sort + trạng thái dòng',
  /\.cl-tbl thead th\.cl-tbl-sort\s*\{/.test(htmlSrc) && /\.cl-row-status\.found\s*\{/.test(htmlSrc) &&
  /\.cl-row-status\.miss\s*\{/.test(htmlSrc) && /\.cl-row-status\.unpaid\s*\{/.test(htmlSrc));
ok('CSS cột Vị trí có icon copy', /\.cl-tbl-loc \.cl-loc-copy\s*\{/.test(htmlSrc));
ok('KHÔNG đổi popup cũ #clUploadModal (2 luồng song song)',
  /<div class="modal-overlay" id="clUploadModal">/.test(htmlSrc) &&
  /function openClUploadModal\(\)/.test(appSrc) && /function closeClUploadModal\(\)/.test(appSrc));

console.log('\n== Hàm overlay bảng cell ==');
ok('có state clAnalyze', /let clAnalyze = null;/.test(appSrc));
ok('có hằng CL_TBL_COLS với 9 cột', /const CL_TBL_COLS = \[/.test(appSrc) &&
  (appSrc.match(/key: '(idx|cell|sector|rowCount|radio|time|address|loc|status)'/g) || []).length >= 9);
ok('có hàm openClTableOverlay mở .show', /function openClTableOverlay\(\)[\s\S]{0,220}classList\.add\('show'\)/.test(appSrc));
ok('có hàm closeClTableOverlay đóng (.remove show)', /function closeClTableOverlay\(\)[\s\S]{0,160}classList\.remove\('show'\)/.test(appSrc));
ok('có hàm clSheetStep chuyển 3 bước', /function clSheetStep\(name\)[\s\S]{0,420}clSheetStepTable/.test(appSrc));
ok('uploadCallLogAnalyze POST /api/call-logs/analyze',
  /async function uploadCallLogAnalyze\(event\)[\s\S]{0,1400}'\/api\/call-logs\/analyze'/.test(appSrc));
ok('uploadCallLogAnalyze tạo clAnalyze qua clCellsFromSource + chọn hết mặc định',
  /clAnalyze = clCellsFromSource\(/.test(fnBody('uploadCallLogAnalyze')) &&
  /clAnalyze\.selected\.add\(c\.key\)/.test(fnBody('uploadCallLogAnalyze')));
ok('uploadCallLogAnalyze KHÔNG gọi resolve/trừ điểm khi nạp',
  !/resolve-batch/.test(fnBody('uploadCallLogAnalyze')) &&
  !/resolveUnmatchedCells/.test(fnBody('uploadCallLogAnalyze')));
ok('có hàm renderClTable + clTableRowHtml', /function renderClTable\(\)/.test(appSrc) &&
  /function clTableRowHtml\(cell, index\)/.test(appSrc));
ok('cột Sóng hiện "?" khi không khẳng định được',
  /calllogs\.unknown/.test(fnBody('clTableRowHtml')) && /cell\.radio \?/.test(fnBody('clTableRowHtml')));
ok('sortClTable là sort phía client (JS-side)', /function sortClTable\(key\)/.test(appSrc) &&
  /clAnalyze\.sort = \{ key/.test(fnBody('sortClTable')) && /renderClTable\(\)/.test(fnBody('sortClTable')));
ok('sortClTable dùng clSortValue (không đụng server)', /function clSortValue\(cell, key\)/.test(appSrc) &&
  /clSortValue\(a, key\)/.test(fnBody('clSortedRows')));
ok('clSelectAll chọn/bỏ chọn toàn bộ rồi render lại', /function clSelectAll\(checked\)/.test(appSrc) &&
  /clAnalyze\.selected = new Set\(\)/.test(fnBody('clSelectAll')));
ok('clToggleRow cập nhật 1 dòng tại chỗ', /function clToggleRow\(key, checked\)/.test(appSrc) &&
  /classList\.toggle\('cl-row-sel'/.test(fnBody('clToggleRow')));
ok('updateClTableRow cập nhật toạ độ + trạng thái tại chỗ',
  /function updateClTableRow\(key\)/.test(appSrc) && /clRowLocHtml\(cell\)/.test(fnBody('updateClTableRow')));

// F5 sau khi trả phí: khôi phục cờ `_charged` từ sessionStorage.

ok('resolveClSelected tra tuần tự theo THỨ TỰ bảng (clSortedRows)',
  /async function resolveClSelected\(opts\)/.test(appSrc) &&
  /clSortedRows\(\)\.filter\(c => \{/.test(fnBody('resolveClSelected')));
ok('resolveClSelected dừng khi hết điểm (insufficient)',
  /resp\.credit\.insufficient/.test(fnBody('resolveClSelected')) &&
  /state: 'unpaid'/.test(fnBody('resolveClSelected')));
ok('resolveClSelected gửi roundIdx + uploadId bền vững (không Date.now/random)',
  /roundIdx: round/.test(fnBody('resolveClSelected')) &&
  /clBatchUploadId\(/.test(fnBody('resolveClSelected')) &&
  !/Date\.now\(\)/.test(fnBody('resolveClSelected')));
ok('resolveClSelected truyền các cell đang chọn vào /api/cells/resolve-batch',
  /'\/api\/cells\/resolve-batch'/.test(fnBody('resolveClSelected')));
ok('plotClTableOnMap đẩy cell đã tra vào myLogsCache',
  /function plotClTableOnMap\(\)/.test(appSrc) && /myLogsCache\.push\(r\)/.test(fnBody('plotClTableOnMap')));
ok('plotClTableOnMap chỉ lấy cell state found (không rò cell chưa trả phí)',
  /r\.state === 'found' && r\.lat != null/.test(fnBody('plotClTableOnMap')));
ok('plotClTableOnMap đánh dấu _charged true → qua canViewRecord',
  /_charged: true/.test(fnBody('plotClTableOnMap')) && /canViewRecord/.test(appSrc));
ok('plotClTableOnMap bỏ cờ hoãn map rồi renderCallLogs',
  /clMapDeferred = false;/.test(fnBody('plotClTableOnMap')) &&
  /renderCallLogs\(\)/.test(fnBody('plotClTableOnMap')));
ok('canViewRecord vẫn là cổng chặn duy nhất khi vẽ (không nới lỏng)',
  /function canViewRecord\(r\) \{\s*\n\s*return !!\(r && r\.lat && r\.lon && \(r\._charged \|\| r\._fromHistory\)\);/.test(appSrc));
ok('renderClSheetResolve ước tính điểm (resolveNeed + notEnoughTotal)',
  /calllogs\.resolveNeed/.test(fnBody('renderClSheetResolve')) &&
  /calllogs\.notEnoughTotal/.test(fnBody('renderClSheetResolve')));
ok('renderClSheetResolve refresh số dư từ server',
  /Auth\.refreshCreditBalance\(\)/.test(fnBody('renderClSheetResolve')));
ok('overlay cập nhật điểm khi quay lại từ /topup.html',
  /clTableOverlay[\s\S]{0,200}renderClSheetResolve\(\)\.catch/.test(appSrc));
ok('entry point /topup.html có trong luồng bảng cell',
  /calllogs\.topupBtn/.test(fnBody('renderClSheetResolve')));
ok('có hằng CSS class trạng thái dùng đúng tên (pending/busy/found/miss/unpaid)',
  /state: 'found'/.test(appSrc) && /state: 'miss'/.test(appSrc) &&
  /state: 'unpaid'/.test(appSrc) && /state: 'busy'/.test(appSrc));

console.log('\n== i18n bảng cell (vi+en) ==');
for (const k of ['tblTitle', 'colCell', 'colSector', 'colRows', 'colRadio', 'colTime',
  'colAddress', 'colLoc', 'colStatus', 'selectAll', 'selectedN', 'resolveN', 'mapAllBtn',
  'analyzing', 'statusPending', 'statusFound', 'statusMiss',
  'statusUnpaid', 'statusLocal', 'unknown', 'noCells', 'noSelection', 'noResolved',
  'mapAllDone', 'netLabel', 'stepPick', 'stepDone']) {
  const re = new RegExp("'calllogs\\." + k + "'", 'g');
  ok(`i18n calllogs.${k} (vi+en)`, (appSrc.match(re) || []).length >= 2);
}

// =====================================================
// Nạp Excel để PHÂN TÍCH không được trừ điểm / đốt quota (server-side)
// =====================================================
console.log('\n== Analyze chỉ đọc (server) ==');
const srvAnalyze = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
function srvBody(marker) {
  const idx = srvAnalyze.indexOf(marker);
  if (idx === -1) return '';
  const open = srvAnalyze.indexOf('{', idx);
  let depth = 0;
  for (let i = open; i < srvAnalyze.length; i++) {
    if (srvAnalyze[i] === '{') depth++;
    else if (srvAnalyze[i] === '}') { depth--; if (depth === 0) return srvAnalyze.slice(open, i + 1); }
  }
  return srvAnalyze.slice(open);
}
const analyzeRoute = srvBody("app.post('/api/call-logs/analyze'");
ok('có route POST /api/call-logs/analyze (requireAuth + multer)',
  /app\.post\('\/api\/call-logs\/analyze', requireAuth, upload\.single\('file'\)/.test(srvAnalyze));
ok('analyze KHÔNG chèn DB (không INSERT INTO call_logs/batches)',
  !/INSERT INTO call_logs/.test(analyzeRoute) && !/INSERT OR REPLACE INTO call_log_batches/.test(analyzeRoute));
ok('analyze KHÔNG trừ điểm (không chargeLookup*)', !/chargeLookup/.test(analyzeRoute));
ok('analyze KHÔNG gọi nguồn online (không getEnabledOnlineSources / gọi cells/resolve-batch)',
  !/getEnabledOnlineSources/.test(analyzeRoute) && !/apiRequest|fetch\(/.test(analyzeRoute) &&
  !/'\/api\/cells\/resolve-batch'/.test(analyzeRoute));
ok('analyze chỉ ĐỌC bảng cells để gắn toạ độ có sẵn',
  /SELECT[^`]*FROM cells/.test(analyzeRoute) && /localLat/.test(analyzeRoute));
ok('analyze xoá file tạm (fs.unlinkSync)', /fs\.unlinkSync\(req\.file\.path\)/.test(analyzeRoute));
ok('analyze dùng aggregateCellsFromRecords + canonicalCellKey',
  /aggregateCellsFromRecords\(/.test(analyzeRoute) && /canonicalKey: canonicalCellKey/.test(analyzeRoute));
ok('analyze trả network/totalRows/cellCount/cells',
  /network: network\.name/.test(analyzeRoute) && /cellCount: cells\.length/.test(analyzeRoute) &&
  /cells,/.test(analyzeRoute));

ok('loadCallLogs gọi restoreChargedFlags sau khi nạp rows',
  /restoreChargedFlags\(\)/.test(fnBody('loadCallLogs')));
ok('có hàm restoreChargedFlags đọc từ phiên sessionStorage',
  /function restoreChargedFlags\(\)/.test(appSrc) &&
  /loadCallSession\(\)/.test(fnBody('restoreChargedFlags')));
ok('resolveUnmatchedCells cập nhật cả row đã có toạ độ (để nhận _resolvedOnline)',
  !/if \(row\.lat && row\.lon\) continue;/.test(fnBody('resolveUnmatchedCells')));
// Nút "Đóng" không lộ toạ độ cell chưa trả phí.
ok('có helper canViewRecord (_charged || _fromHistory)',
  /function canViewRecord\(r\)/.test(appSrc) &&
  /r\._charged \|\| r\._fromHistory/.test(fnBody('canViewRecord')));
ok('plotCallLogs chỉ vẽ group canViewRecord',
  /if \(!group\.some\(canViewRecord\)\) return;/.test(fnBody('plotCallLogs')));
ok('renderCallLogs chặn click/highlight cell chưa trả phí',
  /const canView = canViewRecord\(l\);/.test(fnBody('renderCallLogs')));
ok('playCallLogs lọc canViewRecord',
  /\.filter\(canViewRecord\)/.test(fnBody('playCallLogs')));
ok('updatePlayBtn đếm canViewRecord',
  /getFilteredLogs\(\)\.some\(canViewRecord\)/.test(fnBody('updatePlayBtn')));
ok('updateCallSessionUi đếm located bằng canViewRecord',
  /return l && canViewRecord\(l\);/.test(fnBody('updateCallSessionUi')));
ok('KHÔNG còn cờ clPlotOnlyPaid',
  !/clPlotOnlyPaid/.test(appSrc));

console.log('\n== Kéo giãn sidebar panel trái ==');
ok('index.html có handle #sidebarResizer',
  /id="sidebarResizer"/.test(htmlSrc) && /class="sidebar-resizer"/.test(htmlSrc));
ok('handle dùng icon grip dọc (fa-grip-vertical)',
  /class="fas fa-grip-vertical"/.test(htmlSrc));
ok('handle nằm trong .sidebar, sau panel-foot',
  htmlSrc.indexOf('id="sidebarResizer"') > htmlSrc.indexOf('id="guestPanelFoot"'));
ok('handle là con của .sidebar (trước </div> đóng sidebar)',
  (function () {
    const iHandle = htmlSrc.indexOf('id="sidebarResizer"');
    if (iHandle === -1) return false;
    // .sidebar kết thúc trước #legendBtn (sibling ngoài sidebar).
    const iAfter = htmlSrc.indexOf('id="legendBtn"');
    return iAfter > iHandle;
  })());
ok('handle có data-i18n-title="sidebar.resize"',
  /data-i18n-title="sidebar\.resize"/.test(htmlSrc));
ok('CSS .sidebar-resizer dùng cursor col-resize',
  /\.sidebar-resizer\s*\{[^}]*cursor:\s*col-resize/.test(htmlSrc));
ok('CSS .sidebar-resizer bám mép phải (right: 0)',
  /\.sidebar-resizer\s*\{[^}]*right:\s*0/.test(htmlSrc));
ok('CSS ẩn handle khi panel thu gọn',
  /\.sidebar\.collapsed\s+\.sidebar-resizer\s*\{\s*display:\s*none/.test(htmlSrc));
ok('CSS body.resizing-sidebar chặn chọn text',
  /body\.resizing-sidebar\s*\{[^}]*user-select:\s*none/.test(htmlSrc));
ok('CSS body.resizing-sidebar chặn map nhận pointer',
  /body\.resizing-sidebar\s+#map\s*\{\s*pointer-events:\s*none/.test(htmlSrc));
ok('--sidebar-width vẫn khai báo trong :root',
  /--sidebar-width:\s*340px/.test(htmlSrc));
ok('--sidebar-collapsed vẫn khai báo trong :root',
  /--sidebar-collapsed:\s*-340px/.test(htmlSrc));
ok('có hàm initSidebarResize',
  /function initSidebarResize\(\)/.test(appSrc));
ok('initSidebarResize gọi ở cuối file (init)',
  /\ninitSidebarResize\(\);\s*\ninitSidebarResizeBlock\(\);/.test(appSrc));
ok('có hàm applySidebarWidth ghi --sidebar-width',
  /function applySidebarWidth\(/.test(appSrc) &&
  /setProperty\('--sidebar-width',\s*w\s*\+\s*'px'\)/.test(fnBody('applySidebarWidth')));
ok('applySidebarWidth cập nhật cả --sidebar-collapsed',
  /setProperty\('--sidebar-collapsed',\s*\(-w\)\s*\+\s*'px'\)/.test(fnBody('applySidebarWidth')));
ok('applySidebarWidth gọi updateSidebarState (đồng bộ nút)',
  /updateSidebarState\(\)/.test(fnBody('applySidebarWidth')));
ok('có hàm clampSidebarWidth ép trong min/max',
  /function clampSidebarWidth\(/.test(appSrc) &&
  /Math\.min\(max,\s*Math\.max\(SIDEBAR_MIN_WIDTH/.test(fnBody('clampSidebarWidth')));
ok('có hằng SIDEBAR_MIN_WIDTH = 260',
  /SIDEBAR_MIN_WIDTH\s*=\s*260/.test(appSrc));
ok('có hằng SIDEBAR_DEFAULT_WIDTH = 340',
  /SIDEBAR_DEFAULT_WIDTH\s*=\s*340/.test(appSrc));
ok('có hằng SIDEBAR_WIDTH_KEY = sidebarWidth',
  /SIDEBAR_WIDTH_KEY\s*=\s*'sidebarWidth'/.test(appSrc));
ok('có hàm savedSidebarWidth đọc localStorage',
  /function savedSidebarWidth\(\)/.test(appSrc) &&
  /localStorage\.getItem\(SIDEBAR_WIDTH_KEY\)/.test(fnBody('savedSidebarWidth')));
ok('initSidebarResize khôi phục độ rộng đã lưu',
  /savedSidebarWidth\(\)/.test(fnBody('initSidebarResize')) &&
  /applySidebarWidth\(saved\)/.test(fnBody('initSidebarResize')));
ok('initSidebarResize lưu độ rộng khi thả chuột',
  /localStorage\.setItem\(SIDEBAR_WIDTH_KEY/.test(fnBody('initSidebarResize')));
ok('initSidebarResize bọc try/catch khi ghi localStorage',
  /try\s*\{\s*localStorage\.setItem\(SIDEBAR_WIDTH_KEY/.test(fnBody('initSidebarResize')));
ok('initSidebarResize nghe mousedown + touchstart',
  /addEventListener\('mousedown',\s*onDown\)/.test(fnBody('initSidebarResize')) &&
  /addEventListener\('touchstart',\s*onDown/.test(fnBody('initSidebarResize')));
ok('initSidebarResize chặn kéo khi panel đang thu gọn',
  /if \(sidebar\.classList\.contains\('collapsed'\)\) return;/.test(fnBody('initSidebarResize')));
ok('onUp gỡ hết listener (không rò rỉ)',
  (fnBody('initSidebarResize').match(/removeEventListener\(/g) || []).length >= 4);
ok('có hàm resetSidebarWidth (nháy đúp)',
  /function resetSidebarWidth\(\)/.test(appSrc));
ok('resetSidebarWidth xoá key localStorage',
  /localStorage\.removeItem\(SIDEBAR_WIDTH_KEY\)/.test(fnBody('resetSidebarWidth')));
ok('handle nghe dblclick -> resetSidebarWidth',
  /addEventListener\('dblclick',\s*resetSidebarWidth\)/.test(fnBody('initSidebarResize')));
ok('handle có tabindex + role=separator (bàn phím)',
  /setAttribute\('tabindex',\s*'0'\)/.test(fnBody('initSidebarResize')) &&
  /setAttribute\('role',\s*'separator'\)/.test(fnBody('initSidebarResize')));
ok('handle hỗ trợ ArrowLeft/ArrowRight',
  /e\.key === 'ArrowLeft'/.test(fnBody('initSidebarResize')) &&
  /e\.key === 'ArrowRight'/.test(fnBody('initSidebarResize')));
ok('handle hỗ trợ Home để đặt lại',
  /e\.key === 'Home'/.test(fnBody('initSidebarResize')));
ok('có hàm invalidateMapSize gọi map.invalidateSize',
  /function invalidateMapSize\(\)/.test(appSrc) &&
  /window\.map\.invalidateSize\(\)/.test(fnBody('invalidateMapSize')));
ok('onUp gọi invalidateMapSize sau khi kéo',
  /invalidateMapSize\(\)/.test(fnBody('initSidebarResize')));
ok('nút toggle gọi invalidateMapSize sau transition',
  /setTimeout\(invalidateMapSize,\s*320\)/.test(fnBody('initSidebarResize')));
ok('cửa sổ resize thì clamp lại độ rộng',
  /window\.addEventListener\('resize'/.test(fnBody('initSidebarResize')));
ok('i18n sidebar.resize có ở cả vi + en',
  (appSrc.match(/'sidebar\.resize':/g) || []).length === 2);
ok('i18n sidebar.resizeReset có ở cả vi + en',
  (appSrc.match(/'sidebar\.resizeReset':/g) || []).length === 2);
ok('sidebarMaxWidth chừa chỗ cho map (SIDEBAR_MIN_MAP_WIDTH)',
  /function sidebarMaxWidth\(\)/.test(appSrc) &&
  /window\.innerWidth\s*-\s*SIDEBAR_MIN_MAP_WIDTH/.test(fnBody('sidebarMaxWidth')));
ok('sidebarMaxWidth không trả dưới MIN_WIDTH kể cả màn hình hẹp',
  /Math\.max\(SIDEBAR_MIN_WIDTH/.test(fnBody('sidebarMaxWidth')));

console.log('\n== Handle kéo panel không nuốt chuột khi overlay đang phủ ==');
ok('index.html có CSS .sidebar-resizer.blocked tắt pointer-events',
  /\.sidebar-resizer\.blocked\s*\{\s*pointer-events:\s*none/.test(htmlSrc));
ok('có hàm syncSidebarResizeBlock', /function syncSidebarResizeBlock\(\)/.test(appSrc));
ok('syncSidebarResizeBlock toggle class blocked theo overlay đang mở',
  (function () {
    const b = fnBody('syncSidebarResizeBlock');
    return /cl-fullsheet\.show/.test(b) && /modal-overlay\.show/.test(b) &&
      /classList\.toggle\('blocked'/.test(b);
  })());
ok('có hàm initSidebarResizeBlock theo dõi overlay bằng MutationObserver',
  /function initSidebarResizeBlock\(\)/.test(appSrc) &&
  /new MutationObserver\(/.test(fnBody('initSidebarResizeBlock')));
ok('MutationObserver theo dõi class của overlay bảng cell + body',
  (function () {
    const b = fnBody('initSidebarResizeBlock');
    return /attributeFilter:\s*\['class'\]/.test(b) &&
      /document\.body/.test(b) && /clTableOverlay/.test(b);
  })());
ok('initSidebarResizeBlock được gọi khi khởi động (sau initSidebarResize)',
  /initSidebarResize\(\);\s*\ninitSidebarResizeBlock\(\);/.test(appSrc));
ok('initSidebarResizeBlock chỉ dùng MutationObserver khi có (không crash vm thiếu DOM)',
  (function () {
    const b = fnBody('initSidebarResizeBlock');
    return /typeof MutationObserver === 'function'/.test(b) &&
      /^\s*if \(typeof MutationObserver === 'function'\) \{$/m.test(b);
  })());

// ==========================================================
// 5. Tra cứu chuyển mạng giữ số: số liệu khớp, không trừ điểm 2 lần,
//    không rò toạ độ cell chưa trả phí, màu theo RAT, bảng gọn + modal xác nhận.
// ==========================================================
console.log('\n== 5. Call-log import → resolve → map/table ==');

// --- 1 nguồn số duy nhất cho bảng / footer / bản đồ ---
ok('có hàm clCellsFromSource (pipeline dựng bảng dùng chung)',
  /function clCellsFromSource\(src, opts\)/.test(appSrc));
ok('clCellsFromSource map state found/miss/unpaid từ server',
  /c\.state === 'found'/.test(fnBody('clCellsFromSource')) &&
  /c\.state === 'miss'/.test(fnBody('clCellsFromSource')) &&
  /c\.state === 'unpaid'/.test(fnBody('clCellsFromSource')));
ok('clCellsFromSource chuẩn hoá key (canonicalClientKey) — không nhân đôi cell',
  /canonicalClientKey\(keyToCell\(c\.key\)\)/.test(fnBody('clCellsFromSource')));
ok('có hàm clCellsSummary (đếm total/found/miss/unpaid)',
  /function clCellsSummary\(\)/.test(appSrc) && /s\.unpaid\+\+/.test(fnBody('clCellsSummary')));
ok('renderClTableSummary dùng clCellsSummary + sumFound/sumMiss/sumUnpaid',
  /clCellsSummary\(\)/.test(fnBody('renderClTableSummary')) &&
  /calllogs\.sumFound/.test(fnBody('renderClTableSummary')) &&
  /calllogs\.sumMiss/.test(fnBody('renderClTableSummary')) &&
  /calllogs\.sumUnpaid/.test(fnBody('renderClTableSummary')));
ok('plotClTableOnMap báo "f/t" khi còn cell chưa có kết quả (không im lặng bỏ)',
  /calllogs\.mapAllPartial/.test(fnBody('plotClTableOnMap')) &&
  /clCellsSummary\(\)/.test(fnBody('plotClTableOnMap')));
ok('i18n calllogs.sumFound/sumMiss/sumUnpaid/mapAllPartial/showMore/allResolved (vi+en)',
  ['sumFound', 'sumMiss', 'sumUnpaid', 'mapAllPartial', 'showMore', 'allResolved'].every(k =>
    (appSrc.match(new RegExp("'calllogs\\." + k + "'", 'g')) || []).length >= 2));

// --- 3 đường mở đều qua clCellsFromSource ---
ok('uploadCallLogAnalyze dựng clAnalyze qua clCellsFromSource',
  /clAnalyze = clCellsFromSource\(/.test(fnBody('uploadCallLogAnalyze')));
ok('openCallLogsFromHistory dựng clAnalyze qua clCellsFromSource + mở overlay',
  /clAnalyze = clCellsFromSource\(/.test(fnBody('openCallLogsFromHistory')) &&
  /clSheetStep\('table'\)/.test(fnBody('openCallLogsFromHistory')));
ok('openCallLogSession dựng clAnalyze qua clCellsFromSource + mở overlay',
  /clAnalyze = clCellsFromSource\(/.test(fnBody('openCallLogSession')) &&
  /clSheetStep\('table'\)/.test(fnBody('openCallLogSession')));
ok('có helper clLoadBatchCells gọi endpoint /cells của phiên + lịch sử',
  /function clLoadBatchCells\(batchId, kind\)/.test(appSrc) &&
  /call-log-sessions\/' \+[\s\S]{0,90}\/cells/.test(fnBody('clLoadBatchCells')) &&
  /lookup-history\/batch\/' \+[\s\S]{0,90}\/cells/.test(fnBody('clLoadBatchCells')));

// --- Không rò toạ độ cell chưa trả phí ---
ok('openCallLogSession KHÔNG tự gắn toạ độ nội bộ (_fromHistory bypass)',
  !/attachCellCoords|localLat/.test(fnBody('openCallLogSession')));
ok('openCallLogSession chỉ nhận toạ độ từ cell state=found',
  /c\.state === 'found' && c\.lat != null/.test(fnBody('openCallLogSession')));
ok('openCallLogsFromHistory lọc bản ghi có toạ độ (đã trả phí)',
  /filter\(r => r\.lat != null && r\.lng != null\)/.test(fnBody('openCallLogsFromHistory')));

// --- Không trừ điểm 2 lần ---
ok('có hàm clBatchUploadId (uploadId bền vững theo nội dung lô)',
  /function clBatchUploadId\(fileName, cells\)/.test(appSrc) &&
  /clHash\(/.test(fnBody('clBatchUploadId')));
ok('resolveClSelected bỏ qua cell đã found (không trả phí lại)',
  /return !\(r && r\.state === 'found'\)/.test(fnBody('resolveClSelected')));
ok('resolveClSelected tăng roundsDone (ref batchId:rN không trùng)',
  /roundsDone/.test(fnBody('resolveClSelected')));
ok('resolveClSelected ghi toạ độ ngược vào dòng cell (cell.lat = r.lat)',
  /cell\.lat = r\.lat/.test(fnBody('resolveClSelected')));
ok('resolveClSelected tích luỹ credit.reused (cell trả lại miễn phí)',
  /credit\.reused/.test(fnBody('resolveClSelected')));
ok('renderClSheetResolve chỉ tính cell CHƯA có kết quả (clClSelectedNeed)',
  /clClSelectedNeed\(\)/.test(fnBody('renderClSheetResolve')));
ok('saveCallSession giữ lat/lon/_charged khi lưu phiên',
  /lat: r\.lat, lon: r\.lon/.test(fnBody('saveCallSession')) &&
  /_charged: !!r\._charged/.test(fnBody('saveCallSession')) &&
  /_fromHistory: !!r\._fromHistory/.test(fnBody('saveCallSession')));
ok('có restoreSessionCoords + gọi trong loadCallLogs',
  /function restoreSessionCoords\(\)/.test(appSrc) &&
  /restoreSessionCoords\(\)/.test(fnBody('loadCallLogs')));

// --- Màu vòng tròn theo RAT ---
ok('plotCallLogs tô vòng tròn theo radioStyle(r.radio)',
  /radioStyle\(r\.radio\)/.test(fnBody('plotCallLogs')) &&
  /rs\.key \? rs\.color/.test(fnBody('plotCallLogs')));

// --- Bảng gọn + modal xác nhận ---
ok('renderClTable có <colgroup id="clTableCols">',
  /id="clTableCols"/.test(htmlSrc) && /clTableCols/.test(fnBody('renderClTable')));
ok('renderClTable giới hạn CL_TBL_PAGE dòng + nút "Xem thêm"',
  /const CL_TBL_PAGE = 300/.test(appSrc) &&
  /slice\(0, limit\)/.test(fnBody('renderClTable')) &&
  /clShowMore/.test(fnBody('renderClTable')) &&
  /id="clShowMoreWrap"/.test(htmlSrc) && /function clShowMore\(\)/.test(appSrc));
ok('dòng bảng có class trạng thái st-found/st-miss/st-unpaid (viền màu)',
  /cl-row st-\$\{st\.cls\}/.test(fnBody('clTableRowHtml')) &&
  /\.cl-tbl tbody tr\.st-found/.test(htmlSrc) &&
  /\.cl-tbl tbody tr\.st-miss/.test(htmlSrc));
ok('bảng có hàng kẻ sọc (nth-child(even)) + cột số tabular-nums',
  /tr\.cl-row:nth-child\(even\)/.test(htmlSrc) &&
  /font-variant-numeric: tabular-nums/.test(htmlSrc));
ok('có modal xác nhận #clConfirmResolveModal + body + nút OK/Cancel',
  /class="modal-overlay" id="clConfirmResolveModal"/.test(htmlSrc) &&
  /id="clConfirmResolveBody"/.test(htmlSrc) &&
  /id="clConfirmResolveOk"/.test(htmlSrc) && /id="clConfirmResolveCancel"/.test(htmlSrc));
ok('nút Tra cứu mở modal trước khi trừ điểm (resolveClSelectedClick)',
  /onclick="resolveClSelectedClick\(\)"/.test(htmlSrc) &&
  /function resolveClSelectedClick\(\)/.test(appSrc) &&
  /openClConfirmResolveModal\(\)/.test(fnBody('resolveClSelectedClick')));
ok('openClConfirmResolveModal hiện chi phí mới/miễn phí/tổng/số dư',
  ['confirmNew', 'confirmFree', 'confirmCost', 'confirmBalance'].every(k =>
    new RegExp('calllogs\\.' + k).test(fnBody('openClConfirmResolveModal'))));
ok('modal xác nhận: không đủ điểm → nút chuyển sang nạp điểm',
  /topup\.html/.test(fnBody('openClConfirmResolveModal')) &&
  /okBtn\.disabled/.test(fnBody('openClConfirmResolveModal')));
ok('confirmClResolveModal đóng modal rồi chạy resolveClSelected',
  /closeClConfirmResolveModal\(\)/.test(fnBody('confirmClResolveModal')) &&
  /resolveClSelected\(/.test(fnBody('confirmClResolveModal')));
ok('i18n calllogs.confirm* (vi+en)',
  ['confirmTitle', 'confirmOk', 'confirmCancel', 'confirmNew', 'confirmFree', 'confirmCost', 'confirmBalance']
    .every(k => (appSrc.match(new RegExp("'calllogs\\." + k + "'", 'g')) || []).length >= 2));


console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
