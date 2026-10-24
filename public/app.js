// ============================================
// i18n - Internationalization (EN / VI)
// ============================================
const I18N = {
  en: {
    'app.title': 'Cell.id.vn',
    'nav.logout': 'Logout',
    'sidebar.title': 'Workspace',
    'sidebar.resize': 'Drag to resize',
    'sidebar.resizeReset': 'Double-click to reset width',
    'sidebar.widthSaved': 'Sidebar width saved',
    'tab.cells': 'Cell Lookup',
    'tab.callLogs': 'Call Logs',
    'tab.lookupHistory': 'Lookup History',
    'cells.lookupTitle': 'Cell ID Lookup',
    'cells.helpBtn': 'Single-cell lookup guide',
    'cells.helpTitle': 'Single-cell lookup guide',
    'cells.help1': 'Enter MCC (452 for Vietnam), MNC of the network (Viettel 04, MobiFone 01, VinaPhone 02, Vietnamobile 05, Gmobile 07), then LAC/TAC and CellID — both are numbers printed in the file or on the site.',
    'cells.help2': 'Sector and radio technology can be left empty: the system suggests the most likely value. Fill them in when you need an exact match (e.g. the same cell has both 2G and 4G).',
    'cells.help3': 'Press Lookup (or Enter): a result with coordinates and range means the cell exists — one credit is charged per cell that returns a result.',
    'cells.help4': 'No result means the cell is not in the database yet: retry with another radio technology, or check LAC/CellID before believing it is wrong.',
    'cells.help5': 'The "Search Cells" box below filters the local database by MCC-MNC-LAC-CellID to find a cell quickly without spending credit; click a found cell to jump to the map.',
    'cells.helpNoteTitle': 'Note',
    'cells.helpN1': 'Values are not typed here first: results are the database match only, so a correct cell can still be missing if it has never been resolved.',
    'cells.helpN2': 'For a whole file, use the "List lookup" tab: read the file for free, then look up many cells at once.',
    'cells.helpN3': 'Every single lookup is saved in Lookup History and can be re-opened without being charged again.',
    'cells.lookup': 'Lookup',
    'cells.search': 'Search Cells',
    'cells.typeToSearch': 'Type to search...',
    'cells.enbId': 'eNB ID',
    'cells.sector': 'Sector',
    'cells.radio': 'Network technology',
    'cells.radioAuto': 'Auto (recommended)',
    'cells.radioWarn': 'Inferred network technology may be wrong — enter Sector (LTE) or pick the technology for an exact result.',
    'cells.eci': 'ECI (Long)',
    'cells.cellIdShort': 'Cell ID (Short)',
    'subscribers.from': 'From',
    'subscribers.to': 'To',
    'subscribers.applyFilter': 'Apply Filters',
    'subscribers.noData': 'No subscriber data loaded',
    'cells.clearAll': 'Clear All Cells',
    'upload.records': 'records',
    'legend.title': 'Legend',
    'legend.towerRange': 'Cell Tower (with range)',
    'legend.towerNoRange': 'Cell Tower (no range)',
    'legend.callIn': 'Call In',
    'legend.callOut': 'Call Out',
    'legend.smsIn': 'SMS In',
    'legend.smsOut': 'SMS Out',
    'legend.annotations': 'Draw Annotations',
    'legend.towerHint': 'Tower colour = network technology (RAT). Click a tower for details.',
    'legend.radio': 'Network technology',
    'legend.radioUnknown': 'Unknown',
    'filter.all': 'All',
    'filter.cellStatusAll': 'All',
    'filter.cellFound': 'Resolved',
    'filter.cellUnpaid': 'Unresolved',
    'filter.cellMiss': 'No match',
    'filter.cellStatusAllTip': 'Any cell status',
    'filter.cellFoundTip': 'Cell resolved to coordinates',
    'filter.cellUnpaidTip': 'Cell not looked up yet (unpaid / no credits)',
    'filter.cellMissTip': 'Cell looked up but no source has it',
    'filter.callIn': 'Call In',
    'filter.callOut': 'Call Out',
    'filter.smsIn': 'SMS In',
    'filter.smsOut': 'SMS Out',
    'toast.loading': 'Loading...',
    'toast.success': 'Success!',
    'toast.error': 'Error',
    'play.viewHistory': 'View Movement History',
    'play.exitHistory': 'Exit Movement History',
    'play.stop': 'Stop',
    'play.resume': 'Resume',
    'map.streets': 'Streets',
    'map.satellite': 'Satellite',
    'map.dark': 'Dark',
    'map.terrain': 'Terrain',
    // Nút điều khiển trên bản đồ (leaflet-locate + toolbar leaflet-draw + nút đo)
    'map.myLocation': 'My location',
    'map.yourLocation': 'Your location',
    'map.outsideBounds': 'Outside map bounds',
    'map.locateFailed': 'Cannot determine location: {err}',
    'map.geoUnsupported': 'Browser does not support geolocation',
    'map.geoNotHttps': 'Geolocation requires HTTPS or localhost',
    'map.measured': 'Measured: {d}',
    'map.measureTitle': 'Measure distance (click points, double-click to finish)',
    'map.drawMarker': 'Draw a marker',
    'map.drawPolygon': 'Draw a polygon',
    'map.drawRectangle': 'Draw a rectangle',
    'map.drawPolyline': 'Draw a polyline',
    'map.editLayers': 'Edit layers',
    'map.deleteLayers': 'Delete layers',
    'map.save': 'Save',
    'map.cancel': 'Cancel',
    'map.clearAll': 'Clear all',
    'map.startOver': 'Start over',
    'map.editDisabled': 'No layers to edit',
    'map.deleteDisabled': 'No layers to delete',
    'map.finishDrawing': 'Finish drawing',
    'map.deleteLastPoint': 'Delete last point',
    'map.tipMarker': 'Click map to place marker.',
    'map.tipPolygonStart': 'Click to start drawing shape.',
    'map.tipPolygonCont': 'Click to continue drawing shape.',
    'map.tipPolygonEnd': 'Click first point to close this shape.',
    'map.tipRect': 'Click and drag to draw rectangle.',
    'map.tipEdit': 'Drag handles or markers to edit features.',
    'map.tipRemove': 'Click on a feature to remove.',
    'map.moreLogs': '{n} more records (see the table below)',
    'hist.title': 'Lookup History',
    'hist.allModes': 'All',
    'hist.modeSingle': 'Single',
    'hist.modeBatch': 'Batch',
    'hist.loading': 'Loading...',
    'hist.empty': 'No lookup history',
    'hist.time': 'Time',
    'hist.mode': 'Mode',
    'hist.cell': 'Cell',
    'hist.result': 'Result',
    'hist.copyCoords': 'Copy coordinates',
    'hist.openGoogleMaps': 'Open in Google Maps',
    'hist.source': 'Source',
    'hist.notFound': 'Not found',
    'hist.found': 'Found',
    'hist.deleted': 'Deleted',
    'hist.needAuth': 'Please sign in to view lookup history.',
    'hist.openOnMap': 'Show on map',
    'hist.summary': 'Summary',
    'hist.cells': 'cells',
    'hist.foundCells': 'resolved',
    'hist.notFoundCells': 'no coords',
    'hist.expand': 'Expand cells',
    'hist.collapse': 'Collapse',
    'hist.range': 'Range',
    'hist.coords': 'Coords',
    'hist.batchOf': 'Batch',
    'hist.uploadBatch': 'Uploaded file',
    'hist.showAll': 'Show all cells on map',
    'hist.srcLocal': 'Source: local DB',
    'hist.srcOnline': 'Source: online API',
    'hist.radio': 'Network',
    'hist.singleSection': 'Cell lookups',
    'hist.singleEmpty': 'No cell lookups yet.',
    'hist.singleHint': 'Look up a cell in the Cells tab to see it here.',
    'hist.deleteEntry': 'Delete this entry',
    'hist.retry': 'Look up again',
    'hist.retryOk': 'Looked up again — coordinates found.',
    'hist.retryMiss': 'Looked up again — no source has this cell.',
    'hist.retryNoFunds': 'Not enough credits to look up again ({c} pt per cell · balance {b} pt).',
    'hist.retryFail': 'Look-up-again failed — try again.',
    'hist.retryBarBusy': 'Looking up again…',
    'hist.retryBarDone': 'Found coordinates',
    'hist.retryBarMiss': 'Still no source has this cell',
    'hist.retryBarNoFunds': 'Not enough credits',
    'hist.retryBarFail': 'Look-up-again failed',
    'hist.filterDate': 'Filter by date',
    'hist.clearDate': 'Clear date filter',
    'hist.calToday': 'Today',
    'hist.calAll': 'All dates',
    'rat.GSM': '2G', 'rat.CDMA': 'CDMA', 'rat.UMTS': '3G', 'rat.LTE': '4G',
    'rat.NR': '5G', 'rat.NBIOT': 'NB-IoT', 'rat.EVDO': 'EVDO', 'rat.IDEN': 'iDEN',
    'calllogs.resetSession': 'Clear session',
    'calllogs.sessionCleared': 'Session and call-log data cleared',
    'calllogs.confirmReset': 'Delete ALL your call-log data (session + server records)? This cannot be undone.',
    'calllogs.emptyHint': 'Upload an Excel file, or open a session in the Lookup History tab.',
    'calllogs.fromHistory': 'Opened from Lookup History: {f}',
    'hist.openedAsCallLogs': 'Opened session: {n} cell(s)',
    'hist.loadFailed': 'Failed to load.',
    'hist.clSessionEmpty': 'Session not found — it may have been deleted.',
    'hist.clSessionView': 'Open cell table',
    'hist.clSessionDelete': 'Delete session',
    'hist.clSessionConfirmDelete': 'Delete this list lookup session and all its records? This cannot be undone.',
    // Popup xác nhận xoá (dùng chung)
    'confirm.title': 'Confirm deletion',
    'confirm.ok': 'Delete',
    'confirm.okDelete': 'Delete permanently',
    'confirm.cancel': 'Cancel',
    'confirm.delSessionTitle': 'Delete this session',
    'confirm.delEntryTitle': 'Delete this lookup',
    'confirm.delEntryMsg': 'This lookup record will be removed from your history.',
    'confirm.fileLabel': 'File:',
    'confirm.netLabel': 'Network:',
    'confirm.cellsLabel': 'Cells:',
    'confirm.lookedLabel': 'Cells looked up:',
    'confirm.rowsLabel': 'Records:',
    'confirm.timeLabel': 'Time:',
    'confirm.cellLabel': 'Cell:',
    'confirm.coordsLabel': 'Coordinates:',
    'confirm.rangeLabel': 'Radius:',
    'confirm.warnPermanent': 'This action cannot be undone.',
    'confirm.warnAllRecords': 'All records of this session (coordinates, cell list) will be deleted.',
    'confirm.warnServerToo': 'Data is also deleted from the server, not just this browser.',
    'confirm.warnPaidPoints': 'Points already charged for looked-up cells are NOT refunded.',
    'confirm.noteCantUndo': 'Think twice — deleted data cannot be recovered.',
    'confirm.noteHistoryGone': 'The session will also disappear from lookup history.',
    'confirm.noteEntryOnly': 'Only this record is deleted; your account and points are unchanged.',
    'hist.batchSection': 'List lookups (Excel)',
    'hist.batchEmptyHistory': 'No list lookups yet. Look up a call-log Excel file to record one here.',
    'hist.prevPage': 'Previous page',
    'hist.nextPage': 'Next page',
    'hist.batchProgress': '{l}/{t} cells looked up',
    'hist.batchPending': '{n} cell(s) not looked up — open to continue',
    'hist.batchCoords': '{f} with coords',
    'hist.statNetwork': 'Network',
    'hist.statRows': 'Rows',
    'hist.statCells': 'Cells',
    'hist.statCoords': 'With coords',
    'hist.statLooked': 'Looked up',
    'hist.statPending': 'Not looked up',
    'hist.stateDone': 'Done',
    'hist.batchPendingShort': '{n} left',
    'hist.openSession': 'Open session table',
    'hist.sessions': 'sessions',
    'hist.rows2': 'rows',
    'calllogs.listSummary': '{r} records · {c} cells · {f} resolved · {x} no result · {u} not looked up',
    'calllogs.detailRange': '{n}m',
    'calllogs.detailLines': '{n} record(s)',
    'calllogs.detailMiss': 'No result from any source',
    'calllogs.detailUnpaid': 'Lookup not paid yet — open the cell table to resolve',
    'calllogs.cellOnly': 'Cell in this session',
    'calllogs.lookupCell': 'Look up this cell',
    'calllogs.lookupCellNoRow': 'Cell not found in this session',
    'calllogs.lookupCellNoResult': 'The server returned no result — try again later.',
    'calllogs.lookupCellNoFunds': 'Not enough credits ({c} pt per cell · balance {b} pt) — top up and try again.',
    'calllogs.lookupCellOk': 'Cell resolved — charged {c} pt.',
    'calllogs.lookupCellOkFree': 'Cell resolved — no charge (reused from a previous paid lookup).',
    'calllogs.lookupCellMiss': 'Looked up: no source has this cell — charged {c} pt.',
    'calllogs.lookupCellMissFree': 'Looked up: no source has this cell — no charge.',
    'calllogs.lookupCellPending': 'Still resolving online — try again in a moment.',
    'calllogs.lookupCellFail': 'Lookup failed. Your credits were not charged twice — try again.',
    'calllogs.lookupBarBusy': 'Looking up this cell…',
    'calllogs.lookupBarDone': 'Resolved — coordinates found',
    'calllogs.lookupBarMiss': 'No source has this cell',
    'calllogs.lookupBarNoFunds': 'Not enough credits to look up',
    'calllogs.lookupBarPending': 'Still resolving — try again shortly',
    'calllogs.lookupBarFail': 'Lookup failed — try again',
    'calllogs.pendingLeft': '{n} cell(s) in this session are not looked up yet (≈ {c} pt) — press Resolve in the cell table to continue.',
    'calllogs.mapResults': 'Show {n} located on map',
    'calllogs.mapNone': 'No coordinates yet',
    'calllogs.partner': 'contact',
    'calllogs.filters': 'Filters',
    'calllogs.dateFrom': 'From date',
    'calllogs.dateTo': 'To date',
    'calllogs.dateRange': 'Pick a day or a date range',
    'calllogs.dateClear': 'Clear date filter',
    'calllogs.allDates': 'All dates',
    'cal.hintPick': 'Pick one day, or two days for a range',
    'cal.hintFrom': 'From {d} — pick the end day',
    'cal.hintRange': '{a} → {b}',
    'cal.today': 'Today',
    'cal.apply': 'Apply',
    'cal.prevMonth': 'Previous month',
    'cal.nextMonth': 'Next month',
    'cal.prevYear': 'Previous year',
    'cal.nextYear': 'Next year',
    'calllogs.pickDate': 'Pick a date',
    'calllogs.tools': 'Load Excel',
    'calllogs.loadExcel': 'Load Excel',
    'calllogs.uploadTitle': 'Load call list',
    'calllogs.chooseFile': 'Choose Excel file',
    'calllogs.dropHint': 'Drag & drop .xlsx/.xls/.csv here, or click to choose',
    'calllogs.confirmResolve': 'Resolve now',
    'calllogs.closeBtn': 'Close',
    'calllogs.close': 'Close',
    'calllogs.openTable': 'Open the cells-to-resolve table',
    'calllogs.closeSession': 'Close this list and go back to file upload (the session stays in Lookup History)',
    'calllogs.netAuto': 'Auto-detect',
    'calllogs.statTotal': 'Total rows',
    'calllogs.statInserted': 'Inserted',
    'calllogs.statErrors': 'Errors',
    'calllogs.nothingToResolve': '{r} record(s) · {c} cell(s) with coordinates · {h} from Lookup History — nothing to resolve, no credits used.',
    'calllogs.resolveNeed': '{n} unique cell(s) to resolve × {c} pt = {t} pt · balance {b}',
    'calllogs.resolveBtn': 'Resolve now',
    'calllogs.skipBtn': 'Skip',
    'calllogs.notEnough': 'Not enough credits — top up at least {t} pt to resolve {n} cell(s).',
    'calllogs.resolving': 'Resolving {n} cell(s)...',
    'calllogs.creditCharged': '{f}/{n} cell(s) resolved — charged {c} pt · {m} cell(s) not found.',
    'calllogs.creditPartial': '{f}/{n} cell(s) resolved — charged {c} pt · {m} cell(s) not found · {z} cell(s) not resolved (out of credits).',
    'calllogs.topupNow': 'Top up',
    'calllogs.guideBtn': 'Guide',
    'calllogs.guideTitle': 'Cell-list lookup guide',
    'calllogs.guide1': 'Pick the network, then click the upload box (or drag & drop .xlsx/.xls/.csv onto it). The upload box disappears once a cell list is loaded.',
    'calllogs.guide2': 'The "Cells to resolve" table opens right away: tick the cells you need, then click Lookup. Credits are charged only after you confirm.',
    'calllogs.guide4': 'If your balance is short, lookup runs until credits run out, then stops and shows what was resolved; click Top up to continue.',
    'calllogs.guide5': 'To load another file, press Close on the table header — the upload box comes back. Every session is still saved in Lookup History.',
    'calllogs.guide6': 'Use the search box and the filter button (call type / date range) to narrow the list; each row shows its cell state: resolved (coords, range) / no result / not resolved; click a resolved row to zoom to the cell on the map.',
    'calllogs.guide7': 'Reopen a finished session from Lookup History → "List lookup (Excel)": press the table button on a session card, already-resolved cells are not charged again. Delete a session with the Delete button on that card.',
    'calllogs.notEnoughTotal': 'Balance {b} pt is not enough for all {n} cells ({t} pt). Resolution will run until credits run out, then stop.',
    'calllogs.topupBtn': 'Top up credits',
    'calllogs.searchPlaceholder': 'Phone no., network, type, cell...',
    'calllogs.clearSearch': 'Clear search',
    'calllogs.netLabel': 'Network',
    'calllogs.helpBtn': 'Guide & file format',
    'calllogs.netSoon': 'soon',
    'calllogs.helpTitle': 'Reading the file',
    'calllogs.helpFmt': 'The file needs MCC, MNC, LAC (or TAC) and CellID columns; Site/LAC/CellID in words is fine too. Supports .xlsx, .xls, .csv.',
    'calllogs.helpNet': 'Each network writes columns differently — pick the right one; "Auto" detects it from the file content.',
    'calllogs.helpRead': 'Reading the file only matches the local database (cells already known show coordinates for free) — no credit is charged.',
    'calllogs.helpCredit': 'Credit is charged only when you press "Lookup" and confirm in the cell table; each cell is charged once.',
    'calllogs.helpResume': 'Sessions are saved from the moment you load the file: press Close to upload another file, then reopen the old one in Lookup History — resolved cells are not charged again.',
    'calllogs.tblTitle': 'Cells to resolve',
    'calllogs.colCell': 'Cell',
    'calllogs.colSector': 'Sector',
    'calllogs.colRows': 'Rows',
    'calllogs.colRadio': 'RAT',
    'calllogs.colTime': 'Time range',
    'calllogs.colAddress': 'Address',
    'calllogs.colLoc': 'Location',
    'calllogs.colStatus': 'Status',
    'calllogs.colResize': 'Drag to resize column',
    'calllogs.selectAll': 'Select all',
    'calllogs.selectedN': '{n}/{t} selected · {r} rows',
    'calllogs.resolveN': 'Resolve {n}',
    'calllogs.resolveNone': 'Resolve',
    'calllogs.analyzing': 'Reading file...',
    'calllogs.stepPick': 'Choose the call-list Excel/CSV to analyse.',
    'calllogs.stepDone': '{c} unique cell(s) from {r} row(s) · network {net}',
    'calllogs.statusPending': 'Not resolved',
    'calllogs.statusBusy': 'Resolving...',
    'calllogs.statusFound': 'Found',
    'calllogs.statusMiss': 'No result',
    'calllogs.statusUnpaid': 'Out of credits',
    'calllogs.statusLocal': 'In local DB',
    'calllogs.unknown': '?',
    'calllogs.noCells': 'No valid cell found in this file.',
    'calllogs.noSelection': 'Select at least one cell.',
    'calllogs.noResolved': 'No cell has a coordinate yet — resolve first.',
    'calllogs.mapAllDone': 'Showing {n} cell(s) on the map.',
    'calllogs.mapAllPartial': 'Showing {f}/{t} cell(s) on the map · {m} cell(s) have no result yet.',
    'calllogs.stopNoCredit': 'Stopped: out of credits.',
    'calllogs.sumFound': '{n} found',
    'calllogs.sumMiss': '{n} no result',
    'calllogs.sumUnpaid': '{n} not resolved',
    'calllogs.showMore': 'Show more ({n} left)',
    'calllogs.allResolved': 'All selected cells already have a result in this session — no credits used.',
    'calllogs.confirmTitle': 'Confirm lookup',
    'calllogs.confirmNew': 'Cells to resolve now: {n}',
    'calllogs.confirmFree': 'Already paid in this load: {q} cell(s) (free)',
    'calllogs.confirmCost': 'Cost: {n} × {c} pt = {t} pt',
    'calllogs.confirmBalance': 'Balance: {b} pt → {a} after lookup',
    'calllogs.confirmOk': 'Confirm lookup',
    'calllogs.confirmCancel': 'Cancel',
    'calllogs.reusedNote': '{q} cell(s) already paid in this load — map shown without extra credits.',
    'calllogs.filterAll': 'All',
    'calllogs.filterFound': 'Found',
    'calllogs.filterMiss': 'No result',
    'calllogs.filterUnpaid': 'Not resolved',
    'calllogs.filterEmpty': 'No cells match the current filter.',
    'calllogs.confirmCells': 'Total cells selected',
    'calllogs.confirmNeed': 'Cells to resolve',
    'calllogs.confirmAfter': 'Balance after lookup',
    'calllogs.confirmNoCredits': 'Not enough credits — need {t} pt, balance {b} pt.',
    'calllogs.confirmFreeMode': 'Credit system is disabled — no credits charged.',
  },
  vi: {
    'app.title': 'Cell.id.vn',
    'nav.logout': 'Đăng Xuất',
    'sidebar.title': 'Công Cụ',
    'sidebar.resize': 'Kéo để thay đổi độ rộng',
    'sidebar.resizeReset': 'Nháy đúp để đặt lại độ rộng',
    'sidebar.widthSaved': 'Đã lưu độ rộng panel',
    'tab.subscribers': 'Thuê Bao',
    'tab.cells': 'Tra cứu',
    'tab.callLogs': 'Tra cứu danh sách',
    'tab.lookupHistory': 'Lịch sử tra cứu',
    'subscribers.select': 'Số Điện Thoại',
    'subscribers.selectPlaceholder': '-- Chọn số --',
    'subscribers.showOnMap': 'Hiển Thị Bản Đồ',
    'subscribers.actionFilter': 'Lọc Hành Động',
    'subscribers.from': 'Từ',
    'subscribers.to': 'Đến',
    'subscribers.applyFilter': 'Áp Dụng Lọc',
    'subscribers.noData': 'Chưa có dữ liệu thuê bao',
    'cells.lookupTitle': 'Tra Cứu Cell ID',
    'cells.helpBtn': 'Hướng dẫn tra cứu đơn lẻ',
    'cells.helpTitle': 'Hướng dẫn tra cứu đơn lẻ',
    'cells.help1': 'Nhập MCC (Việt Nam = 452), MNC của mạng (Viettel 04, MobiFone 01, VinaPhone 02, Vietnamobile 05, Gmobile 07), rồi LAC/TAC và CellID — hai số này lấy từ file hoặc từ trạm.',
    'cells.help2': 'Sector và công nghệ mạng có thể để trống: hệ thống tự đề xuất giá trị hợp lý nhất. Chỉ cần điền khi muốn khớp chính xác (vd cùng cell vừa có 2G vừa có 4G).',
    'cells.help3': 'Bấm Tra Cứu (hoặc Enter): ra toạ độ + bán kính là cell có trong dữ liệu — mỗi cell ra kết quả bị trừ 1 điểm.',
    'cells.help4': 'Không ra kết quả nghĩa là cell chưa có trong dữ liệu: thử lại với công nghệ mạng khác, hoặc kiểm tra lại LAC/CellID trước khi kết luận sai.',
    'cells.help5': 'Ô "Tìm Kiếm Cell" bên dưới lọc CSDL nội bộ theo MCC-MNC-LAC-CellID để tìm nhanh một cell mà không tốn điểm; bấm vào cell tìm được để nhảy tới bản đồ.',
    'cells.helpNoteTitle': 'Lưu ý',
    'cells.helpN1': 'Kết quả chỉ là đối chiếu CSDL nên một cell đúng vẫn có thể chưa có, nếu trước giờ chưa ai tra.',
    'cells.helpN2': 'Có cả file cần tra thì dùng tab "Tra cứu danh sách": đọc file miễn phí rồi tra nhiều cell một lượt.',
    'cells.helpN3': 'Mọi lần tra đơn lẻ đều lưu ở Lịch sử tra cứu; mở lại không bị trừ điểm lần nữa.',
    'cells.lookup': 'Tra Cứu',
    'cells.search': 'Tìm Kiếm Cell',
    'cells.typeToSearch': 'Gõ để tìm kiếm...',
    'cells.enbId': 'eNB ID',
    'cells.sector': 'Sector',
    'cells.radio': 'Công nghệ mạng',
    'cells.radioAuto': 'Tự động (đề xuất)',
    'cells.radioWarn': 'Công nghệ mạng suy luận có thể sai — nhập Sector (LTE) hoặc chọn đúng công nghệ để có kết quả chính xác.',
    'cells.eci': 'ECI (Long)',
    'cells.cellIdShort': 'Cell ID (Short)',
    'cells.clearAll': 'Xóa Tất Cả Cell',
    'upload.records': 'bản ghi',
    'legend.title': 'Chú Thích',
    'legend.towerRange': 'Trạm (có bán kính)',
    'legend.towerNoRange': 'Trạm (ko bán kính)',
    'legend.callIn': 'Gọi Đến',
    'legend.callOut': 'Gọi Đi',
    'legend.smsIn': 'Tin Nhắn Đến',
    'legend.smsOut': 'Tin Nhắn Đi',
    'legend.annotations': 'Chú Thích Bản Đồ',
    'legend.towerHint': 'Màu trạm = công nghệ mạng (RAT). Bấm vào trạm để xem chi tiết.',
    'legend.radio': 'Công nghệ mạng',
    'legend.radioUnknown': 'Không xác định',
    'filter.all': 'Tất Cả',
    'filter.callIn': 'Gọi Đến',
    'filter.cellStatusAll': 'Tất cả',
    'filter.cellFound': 'Tra được',
    'filter.cellUnpaid': 'Chưa tra',
    'filter.cellMiss': 'Không KQ',
    'filter.cellStatusAllTip': 'Mọi trạng thái cell',
    'filter.cellFoundTip': 'Cell đã tra được toạ độ',
    'filter.cellUnpaidTip': 'Cell chưa tra (chưa trả phí / hết điểm)',
    'filter.cellMissTip': 'Cell đã tra nhưng không có kết quả',
    'filter.callOut': 'Gọi Đi',
    'filter.smsIn': 'SMS Đến',
    'filter.smsOut': 'SMS Đi',
    'toast.loading': 'Đang tải...',
    'toast.success': 'Thành công!',
    'toast.error': 'Lỗi',
    'play.viewHistory': 'Xem lịch sử di chuyển',
    'play.exitHistory': 'Thoát xem lịch sử',
    'play.stop': 'Dừng lại',
    'play.resume': 'Tiếp tục phát',
    'map.streets': 'Đường phố',
    'map.satellite': 'Vệ tinh',
    'map.dark': 'Tối',
    'map.terrain': 'Địa hình',
    // Nút điều khiển trên bản đồ (leaflet-locate + toolbar leaflet-draw + nút đo)
    'map.myLocation': 'Vị trí của tôi',
    'map.yourLocation': 'Vị trí của bạn',
    'map.outsideBounds': 'Ngoài phạm vi bản đồ',
    'map.locateFailed': 'Không thể xác định vị trí: {err}',
    'map.geoUnsupported': 'Trình duyệt không hỗ trợ định vị',
    'map.geoNotHttps': 'Định vị cần HTTPS hoặc localhost',
    'map.measured': 'Đo được: {d}',
    'map.measureTitle': 'Đo khoảng cách (bấm điểm, bấm đúp để kết thúc)',
    'map.drawMarker': 'Vẽ điểm đánh dấu',
    'map.drawPolygon': 'Vẽ đa giác',
    'map.drawRectangle': 'Vẽ hình chữ nhật',
    'map.drawPolyline': 'Vẽ đường thẳng',
    'map.editLayers': 'Sửa hình vẽ',
    'map.deleteLayers': 'Xoá hình vẽ',
    'map.save': 'Lưu',
    'map.cancel': 'Huỷ',
    'map.clearAll': 'Xoá tất cả',
    'map.startOver': 'Vẽ lại',
    'map.editDisabled': 'Không có hình nào để sửa',
    'map.deleteDisabled': 'Không có hình nào để xoá',
    'map.finishDrawing': 'Hoàn tất hình vẽ',
    'map.deleteLastPoint': 'Xoá điểm vừa vẽ',
    'map.tipMarker': 'Bấm lên bản đồ để đặt điểm đánh dấu.',
    'map.tipPolygonStart': 'Bấm để bắt đầu vẽ hình.',
    'map.tipPolygonCont': 'Bấm để vẽ tiếp.',
    'map.tipPolygonEnd': 'Bấm vào điểm đầu để khép kín hình.',
    'map.tipRect': 'Bấm và kéo để vẽ hình chữ nhật.',
    'map.tipEdit': 'Kéo tay nắm hoặc điểm đánh dấu để sửa hình.',
    'map.tipRemove': 'Bấm vào hình để xoá.',
    'map.moreLogs': '… còn {n} bản ghi nữa (xem bảng bên dưới)',
    'hist.title': 'Lịch sử tra cứu',
    'hist.allModes': 'Tất cả',
    'hist.modeSingle': 'Đơn lẻ',
    'hist.modeBatch': 'Hàng loạt',
    'hist.loading': 'Đang tải...',
    'hist.empty': 'Chưa có lịch sử tra cứu',
    'hist.time': 'Thời gian',
    'hist.mode': 'Chế độ',
    'hist.cell': 'Cell',
    'hist.result': 'Kết quả',
    'hist.copyCoords': 'Copy toạ độ',
    'hist.openGoogleMaps': 'Mở trên Google Maps',
    'hist.source': 'Nguồn',
    'hist.notFound': 'Không tìm thấy',
    'hist.found': 'Tìm thấy',
    'hist.deleted': 'Đã xóa',
    'hist.needAuth': 'Vui lòng đăng nhập để xem lịch sử tra cứu.',
    'hist.openOnMap': 'Hiện trên bản đồ',
    'hist.summary': 'Tổng quan',
    'hist.cells': 'cell',
    'hist.foundCells': 'tra được',
    'hist.notFoundCells': 'không có toạ độ',
    'hist.expand': 'Mở rộng danh sách cell',
    'hist.collapse': 'Thu gọn',
    'hist.range': 'Bán kính',
    'hist.coords': 'Toạ độ',
    'hist.batchOf': 'Lần tra hàng loạt',
    'hist.uploadBatch': 'File đã tải lên',
    'hist.showAll': 'Hiện toàn bộ cell trên bản đồ',
    'hist.srcLocal': 'Nguồn: dữ liệu local',
    'hist.srcOnline': 'Nguồn: API online',
    'hist.radio': 'Công nghệ mạng',
    'hist.singleSection': 'Tra cứu cell đơn lẻ',
    'hist.singleEmpty': 'Chưa có lượt tra cứu đơn lẻ nào.',
    'hist.singleHint': 'Tra 1 cell ở tab Tra cứu — kết quả sẽ hiện ở đây.',
    'hist.deleteEntry': 'Xoá lượt tra này',
    'hist.retry': 'Tra lại',
    'hist.retryOk': 'Đã tra lại — tìm thấy toạ độ.',
    'hist.retryMiss': 'Đã tra lại — vẫn không nguồn nào có cell này.',
    'hist.retryNoFunds': 'Không đủ điểm tra lại ({c} điểm/cell · số dư {b} điểm).',
    'hist.retryFail': 'Tra lại lỗi — thử lại.',
    'hist.retryBarBusy': 'Đang tra lại…',
    'hist.retryBarDone': 'Đã tìm thấy toạ độ',
    'hist.retryBarMiss': 'Vẫn không nguồn nào có cell này',
    'hist.retryBarNoFunds': 'Không đủ điểm',
    'hist.retryBarFail': 'Tra lại lỗi',
    'hist.filterDate': 'Lọc theo ngày',
    'hist.clearDate': 'Bỏ lọc ngày',
    'hist.calToday': 'Hôm nay',
    'hist.calAll': 'Tất cả ngày',
    // Nhãn công nghệ mạng hiển thị trong danh sách lịch sử tra cứu.
    'rat.GSM': '2G', 'rat.CDMA': 'CDMA', 'rat.UMTS': '3G', 'rat.LTE': '4G',
    'rat.NR': '5G', 'rat.NBIOT': 'NB-IoT', 'rat.EVDO': 'EVDO', 'rat.IDEN': 'iDEN',
    'calllogs.resetSession': 'Xoá phiên',
    'calllogs.sessionCleared': 'Đã xoá phiên và dữ liệu rút list',
    'calllogs.confirmReset': 'Xoá TOÀN BỘ dữ liệu rút list của bạn (phiên + bản ghi trên server)? Không thể hoàn tác.',
    'calllogs.emptyHint': 'Tải file Excel, hoặc mở một phiên ở tab Lịch sử tra cứu.',
    'calllogs.fromHistory': 'Mở từ Lịch sử tra cứu: {f}',
    'hist.openedAsCallLogs': 'Đã mở phiên: {n} cell',
    'hist.loadFailed': 'Tải thất bại.',
    'hist.clSessionEmpty': 'Không tìm thấy phiên — phiên có thể đã bị xoá.',
    'hist.clSessionView': 'Mở bảng cell',
    'hist.clSessionDelete': 'Xoá phiên',
    'hist.clSessionConfirmDelete': 'Xoá phiên tra theo list này và toàn bộ bản ghi của nó? Không thể hoàn tác.',
    // Popup xác nhận xoá (dùng chung)
    'confirm.title': 'Xác nhận xoá',
    'confirm.ok': 'Xoá',
    'confirm.okDelete': 'Xoá vĩnh viễn',
    'confirm.cancel': 'Huỷ',
    'confirm.delSessionTitle': 'Xoá phiên này?',
    'confirm.delEntryTitle': 'Xoá lượt tra này?',
    'confirm.delEntryMsg': 'Bản ghi tra cứu này sẽ bị xoá khỏi lịch sử tra cứu.',
    'confirm.fileLabel': 'File:',
    'confirm.netLabel': 'Mạng:',
    'confirm.cellsLabel': 'Số cell:',
    'confirm.lookedLabel': 'Cell đã tra:',
    'confirm.rowsLabel': 'Số bản ghi:',
    'confirm.timeLabel': 'Thời gian:',
    'confirm.cellLabel': 'Cell:',
    'confirm.coordsLabel': 'Toạ độ:',
    'confirm.rangeLabel': 'Bán kính:',
    'confirm.warnPermanent': 'Thao tác này không thể hoàn tác.',
    'confirm.warnAllRecords': 'Toàn bộ bản ghi của phiên (toạ độ, danh sách cell) sẽ bị xoá.',
    'confirm.warnServerToo': 'Dữ liệu bị xoá cả trên server, không chỉ trong trình duyệt này.',
    'confirm.warnPaidPoints': 'Điểm đã trừ cho các cell đã tra sẽ KHÔNG được hoàn lại.',
    'confirm.noteCantUndo': 'Kiểm tra lại trước khi xoá — dữ liệu đã xoá không khôi phục được.',
    'confirm.noteHistoryGone': 'Phiên cũng sẽ biến mất khỏi Lịch sử tra cứu.',
    'confirm.noteEntryOnly': 'Chỉ bản ghi này bị xoá; tài khoản và điểm không thay đổi.',
    'hist.batchSection': 'Tra cứu danh sách (Excel)',
    'hist.batchEmptyHistory': 'Chưa có lần tra cứu danh sách nào. Tra cứu file Excel cuộc gọi — lần tra sẽ hiện ở đây.',
    'hist.prevPage': 'Trang trước',
    'hist.nextPage': 'Trang sau',
    'hist.batchProgress': 'đã tra {l}/{t} cell',
    'hist.batchPending': 'còn {n} cell chưa tra — mở để tra tiếp',
    'hist.batchCoords': '{f} có toạ độ',
    'hist.statNetwork': 'Mạng',
    'hist.statRows': 'Số dòng',
    'hist.statCells': 'Số cell',
    'hist.statCoords': 'Có toạ độ',
    'hist.statLooked': 'Đã tra',
    'hist.statPending': 'Chưa tra',
    'hist.stateDone': 'Xong',
    'hist.batchPendingShort': 'còn {n}',
    'hist.openSession': 'Mở bảng cell của phiên',
    'hist.sessions': 'phiên',
    'hist.rows2': 'dòng',
    'calllogs.listSummary': '{r} bản ghi · {c} cell · {f} có kết quả · {x} không ra kết quả · {u} chưa tra',
    'calllogs.detailRange': '{n}m',
    'calllogs.detailLines': '{n} dòng',
    'calllogs.detailMiss': 'Không tìm thấy trên mọi nguồn',
    'calllogs.detailUnpaid': 'Chưa tra (chưa trả phí) — mở bảng cell để tra',
    'calllogs.cellOnly': 'Cell trong phiên',
    'calllogs.lookupCell': 'Tra cứu cell này',
    'calllogs.lookupCellNoRow': 'Không tìm thấy cell này trong phiên',
    'calllogs.lookupCellNoResult': 'Máy chủ không trả kết quả — thử lại sau.',
    'calllogs.lookupCellNoFunds': 'Không đủ điểm ({c} điểm/cell · số dư {b} điểm) — nạp điểm rồi tra lại.',
    'calllogs.lookupCellOk': 'Đã tra được cell — trừ {c} điểm.',
    'calllogs.lookupCellOkFree': 'Đã tra được cell — không trừ điểm (dùng lại kết quả đã trả phí).',
    'calllogs.lookupCellMiss': 'Đã tra nhưng không nguồn nào có cell này — trừ {c} điểm.',
    'calllogs.lookupCellMissFree': 'Đã tra nhưng không nguồn nào có cell này — không trừ điểm.',
    'calllogs.lookupCellPending': 'Còn đang tra online — thử lại sau giây lát.',
    'calllogs.lookupCellFail': 'Tra cứu lỗi — điểm chưa bị trừ trùng, thử lại.',
    'calllogs.lookupBarBusy': 'Đang tra cell này…',
    'calllogs.lookupBarDone': 'Đã tra được — có toạ độ',
    'calllogs.lookupBarMiss': 'Không nguồn nào có cell này',
    'calllogs.lookupBarNoFunds': 'Không đủ điểm để tra',
    'calllogs.lookupBarPending': 'Vẫn đang tra — thử lại sau ít phút',
    'calllogs.lookupBarFail': 'Tra cứu lỗi — thử lại',
    'calllogs.pendingLeft': 'Còn {n} cell chưa tra trong phiên này (≈ {c} điểm) — bấm “Tra cứu” ở bảng cell để tra tiếp.',
    'calllogs.mapResults': 'Xem {n} toạ độ trên bản đồ',
    'calllogs.mapNone': 'Chưa có toạ độ',
    'calllogs.partner': 'đối tác',
    'calllogs.filters': 'Bộ lọc',
    'calllogs.dateFrom': 'Từ ngày',
    'calllogs.dateTo': 'Đến ngày',
    'calllogs.dateRange': 'Chọn ngày / khoảng ngày',
    'calllogs.dateClear': 'Bỏ lọc ngày',
    'calllogs.allDates': 'Mọi ngày',
    'cal.hintPick': 'Chọn 1 ngày, hoặc 2 ngày để lấy khoảng',
    'cal.hintFrom': 'Từ {d} — chọn ngày cuối',
    'cal.hintRange': '{a} → {b}',
    'cal.today': 'Hôm nay',
    'cal.apply': 'Áp dụng',
    'cal.prevMonth': 'Tháng trước',
    'cal.nextMonth': 'Tháng sau',
    'cal.prevYear': 'Năm trước',
    'cal.nextYear': 'Năm sau',
    'calllogs.pickDate': 'Chọn ngày',
    'calllogs.tools': 'Nạp Excel',
    'calllogs.loadExcel': 'Load Excel',
    'calllogs.uploadTitle': 'Nạp danh sách cuộc gọi',
    'calllogs.chooseFile': 'Chọn file Excel',
    'calllogs.dropHint': 'Kéo thả .xlsx/.xls/.csv vào đây hoặc bấm để chọn',
    'calllogs.confirmResolve': 'Đồng ý tra cứu',
    'calllogs.closeBtn': 'Đóng',
    'calllogs.close': 'Đóng',
    'calllogs.openTable': 'Mở bảng cell cần tra',
    'calllogs.closeSession': 'Đóng danh sách, quay lại nạp file (phiên vẫn lưu ở Lịch sử tra cứu)',
    'calllogs.netAuto': 'Tự động',
    'calllogs.statTotal': 'Tổng dòng',
    'calllogs.statInserted': 'Đã chèn',
    'calllogs.statErrors': 'Lỗi',
    'calllogs.nothingToResolve': '{r} bản ghi · {c} cell đã có toạ độ · {h} từ Lịch sử — không cần tra, không trừ điểm.',
    'calllogs.resolveNeed': 'Cần tra {n} cell (duy nhất) × {c} điểm = {t} điểm · số dư {b}',
    'calllogs.resolveBtn': 'Tra cứu ngay',
    'calllogs.skipBtn': 'Bỏ qua',
    'calllogs.notEnough': 'Không đủ điểm — cần ít nhất {t} điểm để tra {n} cell. Vui lòng nạp thêm.',
    'calllogs.resolving': 'Đang tra {n} cell...',
    'calllogs.creditCharged': 'Đã tra {f}/{n} cell — trừ {c} điểm · {m} cell không ra kết quả.',
    'calllogs.creditPartial': 'Đã tra {f}/{n} cell — trừ {c} điểm · {m} cell không ra kết quả · còn {z} cell chưa tra (hết điểm).',
    'calllogs.topupNow': 'Nạp thêm',
    'calllogs.guideBtn': 'Hướng dẫn',
    'calllogs.guideTitle': 'Hướng dẫn tra cứu danh sách',
    'calllogs.guide1': 'Chọn mạng, rồi bấm vào khung nạp file (hoặc kéo-thả .xlsx/.xls/.csv vào khung). Khung nạp file chỉ hiện khi chưa có danh sách cell.',
    'calllogs.guide2': 'Bảng "Cell cần tra" mở ngay: tích các cell cần tra rồi bấm Tra cứu. Chỉ khi xác nhận thì điểm mới bị trừ.',
    'calllogs.guide4': 'Số dư không đủ tra hết: hệ thống tra tới khi hết điểm rồi dừng và hiện kết quả đã tra được; bấm Nạp điểm để tra tiếp.',
    'calllogs.guide5': 'Muốn nạp file khác: bấm Đóng trên thanh của bảng — khung chọn mạng + nạp file hiện lại. Mọi phiên vẫn được lưu ở Lịch sử tra cứu.',
    'calllogs.guide6': 'Dùng ô tìm kiếm và nút bộ lọc (loại cuộc gọi / khoảng ngày) để lọc danh sách; mỗi dòng hiện trạng thái cell: đã có kết quả (toạ độ, bán kính) / không ra kết quả / chưa tra; bấm dòng đã có kết quả để zoom tới cell trên bản đồ.',
    'calllogs.guide7': 'Mở lại phiên đã làm ở Lịch sử tra cứu → mục “Tra cứu danh sách (Excel)”: bấm nút bảng cell trên card phiên, cell đã tra không bị trừ điểm lại. Xoá phiên bằng nút Xoá trên card đó.',
    'calllogs.notEnoughTotal': 'Số dư {b} điểm chưa đủ cho cả {n} cell ({t} điểm). Hệ thống sẽ tra tới khi hết điểm rồi dừng.',
    'calllogs.topupBtn': 'Nạp điểm',
    'calllogs.searchPlaceholder': 'SĐT, mạng, loại, cell...',
    'calllogs.clearSearch': 'Xoá tìm kiếm',
    'calllogs.netLabel': 'Mạng',
    'calllogs.helpBtn': 'Hướng dẫn & định dạng file',
    'calllogs.netSoon': 'sắp ra',
    'calllogs.helpTitle': 'Đọc file',
    'calllogs.helpFmt': 'File cần có cột MCC, MNC, LAC (hoặc TAC) và CellID; dùng tên cột kiểu trạm/LAC/CellID cũng được. Hỗ trợ .xlsx, .xls, .csv.',
    'calllogs.helpNet': 'Mỗi mạng ghi cột khác nhau — chọn đúng mạng; "Tự động" tự nhận diện theo nội dung file.',
    'calllogs.helpRead': 'Bước đọc file chỉ đối chiếu CSDL nội bộ (cell đã biết hiện toạ độ miễn phí) — chưa trừ điểm.',
    'calllogs.helpCredit': 'Điểm chỉ bị trừ khi bấm "Tra cứu" và xác nhận ở bảng cell; mỗi cell tra 1 lần.',
    'calllogs.helpResume': 'Phiên được lưu ngay từ lúc nạp file: bấm Đóng để nạp file khác, sau đó mở lại phiên cũ ở Lịch sử tra cứu — cell đã tra không bị trừ điểm lại.',
    'calllogs.tblTitle': 'Bảng cell cần tra',
    'calllogs.colCell': 'Cell',
    'calllogs.colSector': 'Sector',
    'calllogs.colRows': 'Số dòng',
    'calllogs.colRadio': 'Sóng',
    'calllogs.colTime': 'Khoảng thời gian',
    'calllogs.colAddress': 'Địa chỉ',
    'calllogs.colLoc': 'Vị trí',
    'calllogs.colStatus': 'Trạng thái',
    'calllogs.colResize': 'Kéo để đổi bề rộng cột',
    'calllogs.selectAll': 'Chọn tất cả',
    'calllogs.selectedN': 'Đã chọn {n}/{t} · {r} dòng',
    'calllogs.resolveN': 'Tra cứu {n}',
    'calllogs.resolveNone': 'Tra cứu',
    'calllogs.analyzing': 'Đang đọc file...',
    'calllogs.stepPick': 'Chọn file Excel/CSV danh sách cuộc gọi để phân tích.',
    'calllogs.stepDone': '{c} cell (duy nhất) từ {r} dòng · mạng {net}',
    'calllogs.statusPending': 'Chưa tra',
    'calllogs.statusBusy': 'Đang tra...',
    'calllogs.statusFound': 'Đã có kết quả',
    'calllogs.statusMiss': 'Không ra kết quả',
    'calllogs.statusUnpaid': 'Hết điểm',
    'calllogs.statusLocal': 'CSDL nội bộ',
    'calllogs.unknown': '?',
    'calllogs.noCells': 'Không tìm thấy cell hợp lệ trong file.',
    'calllogs.noSelection': 'Chọn ít nhất 1 cell.',
    'calllogs.noResolved': 'Chưa cell nào có toạ độ — hãy tra trước.',
    'calllogs.mapAllDone': 'Đang hiển thị {n} cell trên bản đồ.',
    'calllogs.mapAllPartial': 'Đang hiển thị {f}/{t} cell trên bản đồ · {m} cell chưa có kết quả.',
    'calllogs.stopNoCredit': 'Đã dừng: hết điểm.',
    'calllogs.sumFound': '{n} có kết quả',
    'calllogs.sumMiss': '{n} không ra kết quả',
    'calllogs.sumUnpaid': '{n} chưa tra',
    'calllogs.showMore': 'Xem thêm ({n} còn lại)',
    'calllogs.allResolved': 'Các cell đang chọn đều đã có kết quả trong phiên này — không trừ điểm.',
    'calllogs.confirmTitle': 'Xác nhận tra cứu',
    'calllogs.confirmNew': 'Cell cần tra lúc này: {n}',
    'calllogs.confirmFree': 'Đã trả phí trong lần nạp này: {q} cell (miễn phí)',
    'calllogs.confirmCost': 'Chi phí: {n} × {c} điểm = {t} điểm',
    'calllogs.confirmBalance': 'Số dư: {b} điểm → còn {a} điểm sau khi tra',
    'calllogs.confirmOk': 'Xác nhận tra cứu',
    'calllogs.confirmCancel': 'Huỷ',
    'calllogs.reusedNote': '{q} cell đã trả phí trong lần nạp này — hiển thị lại không tốn thêm điểm.',
    'calllogs.filterAll': 'Tất cả',
    'calllogs.filterFound': 'Đã có kết quả',
    'calllogs.filterMiss': 'Không ra kết quả',
    'calllogs.filterUnpaid': 'Chưa tra',
    'calllogs.filterEmpty': 'Không có cell nào khớp bộ lọc hiện tại.',
    'calllogs.confirmCells': 'Tổng cell đã chọn',
    'calllogs.confirmNeed': 'Cell cần tra',
    'calllogs.confirmAfter': 'Số dư còn lại',
    'calllogs.confirmNoCredits': 'Không đủ điểm — cần {t} điểm, số dư {b} điểm.',
    'calllogs.confirmFreeMode': 'Chế độ tính điểm đang tắt — không trừ điểm.',
  }
};

let currentLang = localStorage.getItem('lang') || 'vi';

function t(key) {
  return I18N[currentLang]?.[key] || I18N.en[key] || key;
}

// ============================================
// Cell ID helpers: eNB ID (short) <-> ECI (long)
// ECI = (eNB ID << 8) | sector ; eNB = ECI >> 8 ; sector = ECI & 0xFF
// ============================================
const ECI_MAX = 0xFFFFFFF;
const ENB_MAX = 0xFFFFF;             // 2^20 - 1 = 1,048,575
const SHORT_THRESHOLD = ENB_MAX + 1; // 2^20 = 1,048,576 = ECI nhỏ nhất vượt eNB
function enbToEci(enbId, sector) {
  const enb = parseInt(enbId, 10);
  const sec = parseInt(sector, 10) || 0;
  if (isNaN(enb)) return NaN;
  return enb * 256 + (sec & 0xFF);
}
function eciToEnb(eci) {
  const n = parseInt(eci, 10);
  if (isNaN(n)) return { enbId: NaN, sector: NaN };
  return { enbId: Math.floor(n / 256), sector: n & 0xFF };
}
function classifyCellId(value) {
  const n = parseInt(value, 10);
  if (isNaN(n)) return 'short';
  // >= (không phải >): 1,048,576 = 2^20 vượt eNB ID tối đa → là ECI.
  return n >= SHORT_THRESHOLD && n <= ECI_MAX ? 'long' : 'short';
}
function parseCellId(value, sectorHint) {
  const n = parseInt(value, 10);
  if (isNaN(n) || n < 0) return null;
  const kind = classifyCellId(n);
  if (kind === 'long') {
    const { enbId, sector } = eciToEnb(n);
    return { input: n, kind, isShort: false, enbId, sector, eci: n };
  }
  const sec = (sectorHint !== undefined && sectorHint !== null && sectorHint !== '')
    ? (parseInt(sectorHint, 10) || 0) : 0;
  return { input: n, kind, isShort: true, enbId: n, sector: sec, eci: enbToEci(n, sec) };
}
// Format a cell id (short eNB or long ECI) for tooltips: shows eNB + sector + ECI.
function formatCellId(cellid, enbHint, sectorHint) {
  const p = parseCellId(cellid, sectorHint);
  if (!p) return `CellID: ${cellid}`;
  const enb = enbHint || p.enbId;
  const sec = (sectorHint !== undefined && sectorHint !== null && sectorHint !== '') ? sectorHint : p.sector;
  return `${t('cells.enbId')}: ${enb} · ${t('cells.sector')}: ${sec} · ${t('cells.eci')}: ${p.eci}`;
}

// Tiêu đề popup cell: MCC-MNC-LAC/TAC-CELLID.
// CELLID hiển thị "short" (eNB/short ID) hay "long" (ECI) tùy dữ liệu mạng:
// theo classifyCellId — short khi < 2^20 (0…1.048.575), long khi 2^20 ≤ id ≤ 2^28. Cả hai in raw id.
// Trả về cả dataKind để chỗ gọi biết đang short hay long.
function cellPopupTitle(mcc, mnc, lac, cellid) {
  const id = (cellid === undefined || cellid === null || cellid === '') ? '' : String(cellid);
  const kind = classifyCellId(id);
  const dispId = id; // short => eNB/short ID, long => ECI; giữ nguyên giá trị gốc
  return {
    text: `${mcc}-${mnc}-${lac}-${dispId}`,
    kind: kind,               // 'short' | 'long'
    full: kind === 'long' ? t('cells.eci') : t('cells.cellIdShort')
  };
}
// SQLite trả 'YYYY-MM-DD HH:MM:SS' theo giờ UTC nhưng KHÔNG kèm hậu tố Z. Nếu đưa
// thẳng vào `new Date()` thì JS hiểu là giờ ĐỊA PHƯƠNG → mọi mốc thời gian lệch
// đúng bằng offset múi giờ (VN: chậm 7 giờ). Hàm này chuẩn hoá về Date đúng:
//   - Chuỗi có 'Z' / offset (±hh:mm) → để `new Date()` tự xử lý.
//   - Chuỗi 'YYYY-MM-DD[ T]HH:MM[:SS[.mmm]]' không có zone → coi là UTC.
//   - Số / Date → như cũ.
function parseServerTime(ts) {
  if (ts == null || ts === '') return new Date(NaN);
  if (ts instanceof Date) return ts;
  if (typeof ts === 'number') return new Date(ts);
  const s = String(ts).trim();
  // Đã có thông tin múi giờ → tin tưởng chuỗi.
  if (/[zZ]$/.test(s) || /[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s);
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/.exec(s);
  if (!m) return new Date(s);
  const [, y, mo, d, hh, mi, ss, ms] = m;
  return new Date(Date.UTC(
    Number(y), Number(mo) - 1, Number(d),
    Number(hh || 0), Number(mi || 0), Number(ss || 0), Number((ms || '0').padEnd(3, '0'))
  ));
}
function fmtDateTime(ts) {
  const d = parseServerTime(ts);
  if (isNaN(d.getTime())) return String(ts || '');
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Copy tọa độ "lat, lon" vào clipboard
function copyCoords(lat, lon) {
  const text = `${lat}, ${lon}`;
  const done = () => showToast('Đã copy tọa độ: ' + text, 'success');
  const fail = () => showToast('Không copy được tọa độ', 'error');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(fail);
  } else {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta); done();
    } catch (e) { fail(); }
  }
}

// Mở toạ độ trên Google Maps (tab mới). Dùng chung cho mọi popup có toạ độ cell.
// Toạ độ gửi dạng "lat,lon" (không dấu cách) — Maps hiểu đây là điểm, không phải tìm chữ.
function openInGoogleMaps(lat, lon) {
  const la = parseFloat(lat), lo = parseFloat(lon);
  if (!isFinite(la) || !isFinite(lo)) return;
  const url = `https://www.google.com/maps/search/?api=1&query=${la},${lo}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

// Icon copy + icon mở Google Maps, đứng cạnh nhau sau toạ độ (dùng chung mọi popup).
// Gắn class `cell-coord-acts` để CSS căn hàng cho đẹp. Bấm không được làm đóng popup
// của bản đồ/đóng card → luôn gọi event.stopPropagation() ngay trong onclick.
function coordActionIcons(lat, lon) {
  const la = Number(lat), lo = Number(lon);
  if (!isFinite(la) || !isFinite(lo)) return '';
  return `<span class="cell-coord-acts">`
    + `<i class="fas fa-copy" role="button" tabindex="0" aria-label="${histEsc(t('hist.copyCoords'))}"`
    + ` title="${histEsc(t('hist.copyCoords'))}"`
    + ` onclick="event.stopPropagation(); copyCoords(${la},${lo})"></i>`
    + `<i class="fas fa-map-location-dot" role="button" tabindex="0" aria-label="${histEsc(t('hist.openGoogleMaps'))}"`
    + ` title="${histEsc(t('hist.openGoogleMaps'))}"`
    + ` onclick="event.stopPropagation(); openInGoogleMaps(${la},${lo})"></i>`
    + `</span>`;
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.title = t('app.title');
  const lt = document.getElementById('langToggle');
  if (lt) lt.textContent = currentLang === 'vi' ? 'VI' : 'EN';
  if (typeof syncClDateButtons === 'function') syncClDateButtons();
  if (typeof applyMapButtonI18n === 'function') applyMapButtonI18n();
}

// Nút điều khiển trên bản đồ được TẠO MỘT LẦN lúc nạp trang (leaflet-locate,
// leaflet-draw, nút đo) nên đổi ngôn ngữ không tự cập nhật. Hàm này vẽ lại
// title/aria-label + bảng chữ của leaflet-draw theo currentLang.
function applyMapButtonI18n() {
  if (typeof L === 'undefined') return;
  // Bảng chữ leaflet-draw (plugin mặc định tiếng Anh cứng, không có cơ chế i18n).
  if (typeof L.drawLocal !== 'undefined') {
    const d = L.drawLocal.draw;
    const e = L.drawLocal.edit;
    d.toolbar.actions.title = t('map.cancel');
    d.toolbar.actions.text = t('map.cancel');
    d.toolbar.finish.title = t('map.finishDrawing');
    d.toolbar.finish.text = t('map.save');
    d.toolbar.undo.title = t('map.deleteLastPoint');
    d.toolbar.undo.text = t('map.deleteLastPoint');
    d.toolbar.buttons.marker = t('map.drawMarker');
    d.toolbar.buttons.polygon = t('map.drawPolygon');
    d.toolbar.buttons.rectangle = t('map.drawRectangle');
    d.toolbar.buttons.polyline = t('map.drawPolyline');
    if (d.handlers.marker) d.handlers.marker.tooltip.start = t('map.tipMarker');
    if (d.handlers.rectangle) d.handlers.rectangle.tooltip.start = t('map.tipRect');
    if (d.handlers.polygon) {
      d.handlers.polygon.tooltip.start = t('map.tipPolygonStart');
      d.handlers.polygon.tooltip.cont = t('map.tipPolygonCont');
      d.handlers.polygon.tooltip.end = t('map.tipPolygonEnd');
    }
    e.toolbar.buttons.edit = t('map.editLayers');
    e.toolbar.buttons.editDisabled = t('map.editDisabled');
    e.toolbar.buttons.remove = t('map.deleteLayers');
    e.toolbar.buttons.removeDisabled = t('map.deleteDisabled');
    e.toolbar.actions.save.title = t('map.save');
    e.toolbar.actions.save.text = t('map.save');
    e.toolbar.actions.cancel.title = t('map.cancel');
    e.toolbar.actions.cancel.text = t('map.cancel');
    e.toolbar.actions.clearAll.title = t('map.clearAll');
    e.toolbar.actions.clearAll.text = t('map.clearAll');
    if (e.handlers.edit) e.handlers.edit.tooltip.text = t('map.tipEdit');
    if (e.handlers.remove) e.handlers.remove.tooltip.text = t('map.tipRemove');
  }
  // Nút đã render trong DOM — plugin giữ title cũ tới khi tạo lại toolbar.
  const set = (sel, text) => {
    const el = document.querySelector(sel);
    if (!el) return;
    el.title = text;
    el.setAttribute('aria-label', text);
  };
  set('.leaflet-control-locate a', t('map.myLocation'));
  set('.leaflet-control-custom', t('map.myLocation'));
  set('.leaflet-draw-measure', t('map.measureTitle'));
  set('.leaflet-draw-draw-marker', t('map.drawMarker'));
  set('.leaflet-draw-draw-polygon', t('map.drawPolygon'));
  set('.leaflet-draw-draw-rectangle', t('map.drawRectangle'));
  set('.leaflet-draw-draw-polyline', t('map.drawPolyline'));
  // Nút edit/remove bị disable thì plugin dùng chuỗi "...Disabled" làm title.
  const canEdit = document.querySelectorAll('.leaflet-draw-edit-edit.leaflet-disabled').length === 0;
  const canRemove = document.querySelectorAll('.leaflet-draw-edit-remove.leaflet-disabled').length === 0;
  set('.leaflet-draw-edit-edit', canEdit ? t('map.editLayers') : t('map.editDisabled'));
  set('.leaflet-draw-edit-remove', canRemove ? t('map.deleteLayers') : t('map.deleteDisabled'));
}

function toggleLang() {
  currentLang = currentLang === 'en' ? 'vi' : 'en';
  localStorage.setItem('lang', currentLang);
  applyI18n();
}

// ============================================
// Theme
// ============================================
function toggleTheme() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  document.documentElement.setAttribute('data-theme', isLight ? 'dark' : 'light');
  localStorage.setItem('theme', isLight ? 'dark' : 'light');
  document.getElementById('themeToggle').innerHTML = isLight ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
}

function loadTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  document.getElementById('themeToggle').innerHTML = saved === 'light' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
}

// ============================================
// Toast
// ============================================
function showToast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.borderColor = type === 'error' ? 'var(--bg-btn-danger)' : type === 'success' ? 'var(--bg-btn-success)' : 'var(--border-color)';
  el.classList.add('show');
  el.style.display = 'block';
  setTimeout(() => { el.classList.remove('show'); el.style.display = 'none'; }, 3000);
}

// ============================================
// Auth check + guest mode
// ============================================
// Trang chủ mở cho khách: KHÔNG đá về /login.html nữa. Thay vào đó:
//  - Chưa đăng nhập → vào "guest mode": bật overlay gate + tắt các nút cần login.
//  - Đã đăng nhập → initNavbar() như cũ.
async function initAuth() {
  if (Auth.isLoggedIn()) {
    Auth.initNavbar();
    return;
  }
  enterGuestMode();
}

// Hết phiên giữa chừng (API trả 401): auth.js đã xoá token rồi gọi hook này.
// Chuyển UI sang guest TẠI CHỖ thay vì nạp lại/về trang đăng nhập để không mất
// trạng thái đang xem.
window.__onSessionExpired = function () {
  if (window.__guestMode) return;
  try { enterGuestMode(); } catch (e) { console.warn('session expired:', e); }
};

/** Khách: navbar rút gọn + overlay mời đăng ký + banner lượt dùng thử. */
async function enterGuestMode() {
  window.__guestMode = true;
  // Token hết hạn/hỏng vẫn nằm trong localStorage sẽ khiến mọi API gửi kèm
  // Authorization → 401 → chuyển về guest (vòng lặp). Xoá ngay khi xác định là khách.
  if (Auth.getToken() && Auth.isTokenExpired()) {
    Auth.clearToken();
    Auth.clearUser();
  }
  Auth.initNavbar();
  document.body.classList.add('guest-mode');

  // Nút cần đăng nhập (tải file, lịch sử, dữ liệu của tôi...) → mờ + chặn click.
  document.querySelectorAll('.card-header button, .sidebar-actions button, .card button[onclick^="document.getElementById"]')
    .forEach(btn => { btn.classList.add('guest-disabled'); });

  const gate = document.getElementById('guestGate');
  if (gate) gate.style.display = 'flex';

  if (window.AppVersion) await window.AppVersion.renderPanelVersion();
}

/** Tra cứu thử 1 lượt của khách — chỉ dữ liệu nội bộ, không tốn điểm. */
async function guestLookup(mcc, mnc, lac, cellid, sector, radio) {
  const resultEl = document.getElementById('guestLookupResult') || document.getElementById('cellLookupResult');
  resultEl.className = 'cell-lookup-result show';
  resultEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tra cứu (lượt dùng thử)...';
  const sectorParam = (sector !== '' && sector != null) ? `&sector=${encodeURIComponent(sector)}` : '';
  const radioParam = (radio !== '' && radio != null) ? `&radio=${encodeURIComponent(radio)}` : '';
  const url = `/api/guest/lookup?mcc=${encodeURIComponent(mcc)}&mnc=${encodeURIComponent(mnc)}&lac=${encodeURIComponent(lac)}&cellid=${encodeURIComponent(cellid)}${sectorParam}${radioParam}`;
  const r = await fetch(url);
  let data = null;
  try { data = await r.json(); } catch (e) { data = null; }
  if (data && data.guestTrial && window.AppVersion) window.AppVersion.renderPanelVersion();

  if (r.ok && data && data.data) {
    const d = data.data;
    const dLat = parseFloat(d.lat);
    const dLon = parseFloat(d.lon);
    const rs = radioStyle(d.radio);
    resultEl.className = 'cell-lookup-result show success';
    resultEl.innerHTML =
      `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px">` +
        `<i class="fas fa-check-circle"></i>` +
        `<span class="hist-cell">${d.mcc || mcc}-${d.mnc || mnc}-${d.lac || lac}-${d.cellid || cellid}</span>` +
        (rs.key ? `<span class="hist-radio-badge" style="background:${rs.color}" title="${histEsc(t('hist.radio'))}">${histEsc(rs.full || rs.label)}</span>` : '') +
      `</div>` +
      `<div style="font-size:11px">${formatCellId(d.cellid || cellid, sector)}</div>` +
      `<div class="hist-coords" style="margin-top:4px"><i class="fas fa-map-pin"></i>${dLat}, ${dLon}</div>` +
      `<div style="font-size:11px;margin-top:3px">Bán kính: <b>${d.range}m</b></div>` +
      (data.radioConfident === false ? `<div style="font-size:11px;margin-top:4px;color:#c98a1e"><i class="fas fa-triangle-exclamation"></i> ${t('cells.radioWarn')}</div>` : '') +
      (d.description ? `<div style="font-size:11px;margin-top:3px;color:var(--text-muted)">${d.description}</div>` : '');
    showCellOnMap({
      lat: dLat, lon: dLon, range: parseFloat(d.range || 500), color: rs.key ? rs.color : '#ff4444',
      mcc: d.mcc || mcc, mnc: d.mnc || mnc, lac: d.lac || lac, cellid: d.cellid || cellid,
      cellLine: formatCellId(d.cellid || cellid, sector), radio: d.radio,
      sourceLabel: 'CSDL nội bộ', srcType: 'local', showSource: false, description: d.description || ''
    });
    return;
  }

  // Hết lượt / không có kết quả → hiện lời mời đăng ký (upsell).
  const up = (data && data.upgrade) || null;
  const trial = (data && data.guestTrial) || null;
  const exhausted = !!(trial && trial.remaining <= 0);
  resultEl.className = 'cell-lookup-result show' + (exhausted ? ' error' : '');
  const icon = exhausted ? 'fa-lock' : 'fa-info-circle';
  const title = exhausted ? 'Đã hết lượt tra cứu miễn phí' : 'Không có trong dữ liệu nội bộ';
  const message = (up && up.message) || (data && data.error) || 'Không tra cứu được.';
  resultEl.innerHTML =
    `<div style="margin-bottom:6px"><i class="fas ${icon}"></i> <b>${title}</b></div>` +
    `<div style="font-size:12px;margin-bottom:8px">${message}</div>` +
    `<div style="font-size:11px;color:var(--text-faint);margin-bottom:8px">Tra cứu thử chỉ dùng dữ liệu nội bộ. Tài khoản miễn phí mở thêm nguồn OpenCellID.org.</div>` +
    `<a class="btn-primary" style="display:inline-block;text-decoration:none;padding:7px 14px;border-radius:8px" href="${(up && up.registerUrl) || '/index.html#register'}">Đăng ký ngay</a>`;

  const gate = document.getElementById('guestGate');
  if (gate && exhausted) {
    const card = gate.querySelector('.guest-gate-card');
    if (card) card.classList.add('exhausted');
  }
}

/** Đọc form tra cứu của khách (#guestMcc/#guestMnc/#guestLac/#guestCellid/#guestSector). */
function guestLookupFromForm() {
  const val = (id) => (document.getElementById(id)?.value || '').trim();
  const mcc = val('guestMcc'), mnc = val('guestMnc'), lac = val('guestLac');
  const cellid = val('guestCellid'), sector = val('guestSector'), radio = val('guestRadio');
  if (!mcc || !mnc || !lac || !cellid) {
    showToast('Nhập đủ MCC, MNC, LAC và CellID.', 'error');
    return;
  }
  return guestLookup(mcc, mnc, lac, cellid, sector, radio);
}

// Chân panel trái (version + lượt thử còn lại) do AppVersion.renderPanelVersion() vẽ
// — xem public/version.js. Gọi lại ở mỗi lần đổi tab (switchTab) để luôn đồng bộ.
initAuth();

// Chip lọc loại hành động ở tab "Tra cứu danh sách" — uỷ quyền sự kiện, chip được
// tạo tĩnh trong index.html nên gắn 1 lần là đủ.
document.addEventListener('click', (e) => {
  const chip = e.target.closest && e.target.closest('#clActionChips .cl-chip');
  if (chip) { setClActionFilter(chip.dataset.action, chip); return; }
  // Chip lọc TRẠNG THÁI CELL (Đã tra được / Chưa tra được / Không có kết quả).
  const stChip = e.target.closest && e.target.closest('#clRecordStatusChips .cl-chip');
  if (stChip) { setClCellStatusFilter(stChip.dataset.status); return; }
});

// ============================================
// Modal helpers
// ============================================
function openModal(id) {
  document.getElementById(id).classList.add('show');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('show');
}

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', function(e) {
    if (e.target === this) {
      this.classList.remove('show');
    }
  });
});
// Popup xác nhận xoá có xử lý nền mờ riêng (trả kết quả false) → không gắn listener
// chung ở trên, tránh đóng mà không resolve Promise (hộp thoại "treo" chờ mãi).

// ============================================
// Popup xác nhận XOÁ dùng chung (thay confirm() của hệ điều hành)
// ============================================
// Mọi thao tác xoá (bản ghi tra đơn lẻ, phiên tra theo danh sách, dữ liệu rút list...)
// đều đi qua đây: hộp thoại có tiêu đề, mô tả, danh sách CẢNH BÁO nguy hiểm, ghi chú
// thêm, chi tiết đối tượng sẽ xoá, nút Huỷ/Xoá. Trả Promise<boolean>.
//
// openConfirmDialog({
//   title, message, detail: [ 'Dòng chi tiết', ... ],
//   warnings: [ 'Mất là không lấy lại được', ... ],
//   notes: [ 'Phiên vẫn còn trong Lịch sử...', ... ],
//   okText, cancelText, danger (mặc định true)
// }) → Promise<boolean>
let cfDialog = { open: false, resolve: null, lastFocus: null, keyHandler: null, escHandler: null };

function cfSetList(id, wrapId, items) {
  const wrap = document.getElementById(wrapId);
  const list = document.getElementById(id);
  if (!wrap || !list) return;
  const arr = (items || []).filter(Boolean);
  list.innerHTML = '';
  arr.forEach(function (s) {
    const li = document.createElement('li');
    li.textContent = s;
    list.appendChild(li);
  });
  wrap.hidden = arr.length === 0;
}

function openConfirmDialog(opts) {
  const o = opts || {};
  const modal = document.getElementById('confirmModal');
  if (!modal) {
    // Không có markup → vẫn phải trả lời được, dùng confirm() làm chốt chặn cuối.
    return Promise.resolve(window.confirm([o.title, o.message].filter(Boolean).join('\n')));
  }
  // Đang mở hộp khác → đóng hộp cũ (trả false) trước khi mở hộp mới.
  if (cfDialog.open) closeConfirmDialog(false);

  const setText = function (id, txt) {
    const el = document.getElementById(id);
    if (el) el.textContent = txt || '';
  };
  setText('cfTitle', o.title || t('confirm.title'));
  setText('cfMsg', o.message || '');
  setText('cfOkTxt', o.okText || t('confirm.ok'));
  setText('cfCancelTxt', o.cancelText || t('confirm.cancel'));

  const danger = o.danger !== false;
  const okBtn = document.getElementById('cfOkBtn');
  if (okBtn) {
    okBtn.className = 'btn btn-sm ' + (danger ? 'btn-danger' : 'btn-primary');
    okBtn.querySelector('i').className = 'fas ' + (danger ? 'fa-trash-can' : 'fa-check');
  }
  const ico = document.getElementById('cfIcon');
  if (ico) {
    ico.innerHTML = '<i class="fas ' + (danger ? 'fa-trash-can' : 'fa-circle-question') + '"></i>';
    ico.style.background = danger ? '' : 'rgba(61,124,224,0.16)';
    ico.style.color = danger ? '' : 'var(--accent, #3d7ce0)';
  }

  cfSetList('cfWarnDangerList', 'cfWarnDanger', o.warnings);
  cfSetList('cfWarnInfoList', 'cfWarnInfo', o.notes);

  const detail = document.getElementById('cfDetail');
  if (detail) {
    const rows = (o.detail || []).filter(Boolean);
    detail.innerHTML = '';
    rows.forEach(function (row) {
      const div = document.createElement('div');
      // row: string hoặc { k: 'Tên file', v: '...' }
      if (row && typeof row === 'object') {
        const b = document.createElement('b');
        b.textContent = row.k || '';
        div.appendChild(b);
        div.appendChild(document.createTextNode(' ' + (row.v == null ? '' : String(row.v))));
      } else {
        div.textContent = String(row);
      }
      detail.appendChild(div);
    });
    detail.hidden = rows.length === 0;
  }

  cfDialog.lastFocus = document.activeElement;
  cfDialog.open = true;
  modal.classList.add('show');
  // Bấm nền mờ = Huỷ (không xoá).
  modal.onclick = function (e) { if (e.target === modal) closeConfirmDialog(false); };
  // Enter = đồng ý dừng ở nút Xoá (không tự xoá khi vừa mở), Esc = Huỷ.
  cfDialog.escHandler = function (e) {
    if (!cfDialog.open) return;
    if (e.key === 'Escape') { e.preventDefault(); closeConfirmDialog(false); }
  };
  document.addEventListener('keydown', cfDialog.escHandler, true);
  setTimeout(function () {
    const btn = document.getElementById('cfCancelBtn');
    if (btn) btn.focus();
  }, 0);

  return new Promise(function (resolve) { cfDialog.resolve = resolve; });
}

function closeConfirmDialog(result) {
  const modal = document.getElementById('confirmModal');
  if (modal) {
    modal.classList.remove('show');
    modal.onclick = null;
  }
  if (cfDialog.escHandler) {
    document.removeEventListener('keydown', cfDialog.escHandler, true);
    cfDialog.escHandler = null;
  }
  const resolve = cfDialog.resolve;
  const lastFocus = cfDialog.lastFocus;
  cfDialog = { open: false, resolve: null, lastFocus: null, keyHandler: null, escHandler: null };
  if (lastFocus && typeof lastFocus.focus === 'function') {
    try { lastFocus.focus(); } catch (e) { /* phần tử đã bị gỡ */ }
  }
  if (typeof resolve === 'function') resolve(!!result);
}

// ============================================
// Change password
// ============================================
function showChangePassword() {
  document.getElementById('pwdCurrent').value = '';
  document.getElementById('pwdNew').value = '';
  document.getElementById('pwdConfirm').value = '';
  openModal('changePwdModal');
  document.getElementById('userDropdown').classList.remove('show');
  userDropdownOpen = false;
}

async function changePassword() {
  const current = document.getElementById('pwdCurrent').value;
  const newPwd = document.getElementById('pwdNew').value;
  const confirm = document.getElementById('pwdConfirm').value;

  if (!current || !newPwd) { showToast('Vui lòng nhập đầy đủ', 'error'); return; }
  if (newPwd !== confirm) { showToast('Mật khẩu mới không khớp', 'error'); return; }
  if (newPwd.length < 4) { showToast('Mật khẩu phải >= 4 ký tự', 'error'); return; }

  try {
    const result = await apiRequest('PUT', '/api/auth/password', { currentPassword: current, newPassword: newPwd });
    showToast('Đổi mật khẩu thành công', 'success');
    closeModal('changePwdModal');
  } catch (e) {
    showToast('Lỗi: ' + e.message, 'error');
  }
}

// ============================================
// My data
// ============================================
function showMyData() {
  openModal('myDataModal');
  document.getElementById('userDropdown').classList.remove('show');
  userDropdownOpen = false;
  document.getElementById('myDataContent').innerHTML = '<span style="color:var(--text-muted)">Nhấn nút trên để xem dữ liệu</span>';
}

async function loadMyUploads() {
  const el = document.getElementById('myDataContent');
  el.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tải...';
  try {
    const data = await apiRequest('GET', '/api/records/my');
    if (!data || data.length === 0) {
      el.innerHTML = '<span style="color:var(--text-muted)">Không có dữ liệu</span>';
      return;
    }
    let html = '<table class="my-data-table"><thead><tr><th>#</th><th>Số</th><th>Loại</th><th>Thời gian</th><th>CellID</th></tr></thead><tbody>';
    data.forEach((r, i) => {
      const ts = parseServerTime(r.timestamp).toLocaleString('vi-VN');
      html += `<tr><td>${i+1}</td><td>${r.phone_number}</td><td>${r.action_type}</td><td>${ts}</td><td>${r.mcc}-${r.mnc}-${r.lac}-${r.cellid}</td></tr>`;
    });
    html += `</tbody></table><div style="margin-top:6px;color:var(--text-muted);font-size:11px">Tổng: ${data.length} bản ghi</div>`;
    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = '<span style="color:var(--bg-btn-danger)">Lỗi: ' + e.message + '</span>';
  }
}

async function loadMyCells() {
  const el = document.getElementById('myDataContent');
  el.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tải...';
  try {
    const data = await apiRequest('GET', '/api/cells?limit=200');
    if (!data || data.length === 0) {
      el.innerHTML = '<span style="color:var(--text-muted)">Không có dữ liệu cell</span>';
      return;
    }
    let html = '<table class="my-data-table"><thead><tr><th>#</th><th>MCC</th><th>MNC</th><th>LAC</th><th>CellID</th><th>Lat</th><th>Lon</th><th>Range</th></tr></thead><tbody>';
    data.forEach((c, i) => {
      html += `<tr><td>${i+1}</td><td>${c.mcc}</td><td>${c.mnc}</td><td>${c.lac}</td><td>${c.cellid}</td><td>${c.lat}</td><td>${c.lon}</td><td>${c.range}m</td></tr>`;
    });
    html += `</tbody></table><div style="margin-top:6px;color:var(--text-muted);font-size:11px">Tổng: ${data.length} cell</div>`;
    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = '<span style="color:var(--bg-btn-danger)">Lỗi: ' + e.message + '</span>';
  }
}

// ============================================
// Map
// ============================================
const map = L.map('map', {
  center: [21.0285, 105.8542],
  zoom: 12,
  zoomControl: false
});

// Base layers (free, no API key required)
const googleStreetsLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
  attribution: 'Google',
  maxZoom: 20
});
const satelliteLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
  attribution: 'Google',
  maxZoom: 20
});
const terrainLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
  maxZoom: 17
});

googleStreetsLayer.addTo(map);

// Layer control
const baseMaps = {
  'Đường phố': googleStreetsLayer,
  'Vệ tinh': satelliteLayer,
  'Địa hình': terrainLayer
};

// Lớp phủ chứa MỌI marker/vòng cell (tra đơn lẻ, tra hàng loạt, lịch sử, highlight).
// Gom vào 1 L.layerGroup → nút bật/tắt trong layer control có tác dụng thật (checkbox),
// thay vì chỉ có base layer dạng radio (đổi nền, không tắt được).
const cellOverlay = L.layerGroup().addTo(map);
const overlayMaps = { 'Cell / Log đã tra': cellOverlay };

const layerControl = L.control.layers(baseMaps, overlayMaps, { position: 'topright' }).addTo(map);

// Zoom control to right
L.control.zoom({ position: 'topright' }).addTo(map);

// ============================================
// My Location
// ============================================
let locationControl = null;
let locationMarker = null;

try {
  if (typeof L.control.locate !== 'undefined') {
    locationControl = L.control.locate({
      position: 'topright',
      drawCircle: true,
      follow: false,
      setView: true,
      keepCurrentZoomLevel: false,
      markerStyle: {
        weight: 1,
        opacity: 0.8,
        fillOpacity: 0.15
      },
      circleStyle: {
        weight: 1,
        opacity: 0.5,
        fillOpacity: 0.05
      },
      strings: {
        title: t('map.myLocation'),
        metersUnit: 'm',
        feetUnit: 'ft',
        popup: t('map.yourLocation'),
        outsideMapBoundsMsg: t('map.outsideBounds')
      },
      locateOptions: {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    }).addTo(map);
  }
} catch (e) {
  console.warn('Location control not available:', e);
}

// Fallback: manual locate button if plugin not loaded
if (!locationControl) {
  const LocateBtn = L.Control.extend({
    onAdd: function(map) {
      const btn = L.DomUtil.create('button', 'leaflet-bar leaflet-control leaflet-control-custom');
      btn.innerHTML = '<i class="fas fa-location-arrow"></i>';
      btn.style.width = '34px';
      btn.style.height = '34px';
      btn.style.background = 'var(--bg-surface)';
      btn.style.color = 'var(--text-secondary)';
      btn.style.border = '1px solid var(--border-color)';
      btn.style.borderRadius = '4px';
      btn.style.cursor = 'pointer';
      btn.style.fontSize = '16px';
      btn.style.display = 'flex';
      btn.style.alignItems = 'center';
      btn.style.justifyContent = 'center';
      btn.title = t('map.myLocation');
      btn.setAttribute('aria-label', t('map.myLocation'));
      btn.onclick = function() {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(function(pos) {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            centerOnVisible(lat, lng, 15);
            if (locationMarker) map.removeLayer(locationMarker);
            locationMarker = L.circleMarker([lat, lng], {
              radius: 8,
              fillColor: '#4444cc',
              color: '#fff',
              weight: 2,
              opacity: 1,
              fillOpacity: 0.8
            }).addTo(map).bindPopup(t('map.yourLocation'));
          }, function(err) {
            showToast(fmtTpl('map.locateFailed', { err: err.message }), 'error');
          }, { enableHighAccuracy: true, timeout: 10000 });
        } else {
          showToast(t('map.geoUnsupported'), 'error');
        }
      };
      return btn;
    }
  });
  new LocateBtn({ position: 'topright' }).addTo(map);
}

// ============================================
// Leaflet.draw
// ============================================
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

// Shape tạm của cell log (plotCallLogs) — tách khỏi drawnItems để thao tác trên
// tab rút list (lọc/đổi trang) KHÔNG xoá shape do user vẽ.
const logShapeGroup = new L.FeatureGroup();
map.addLayer(logShapeGroup);

// Ngôn ngữ cho toolbar leaflet-draw (mặc định tiếng Anh cứng) → theo currentLang.
// Một nguồn duy nhất: applyMapButtonI18n() (cũng được gọi lại khi toggleLang).
if (typeof applyMapButtonI18n === 'function') applyMapButtonI18n();

const drawControl = new L.Control.Draw({
  position: 'topright',
  edit: { featureGroup: drawnItems },
  draw: { polyline: false, polygon: true, rectangle: true, circle: false, circlemarker: false, marker: true }
});
map.addControl(drawControl);

// ============================================
// Đo khoảng cách — tích hợp vào toolbar leaflet-draw
// ============================================
const measureState = {
  active: false,
  pts: [],
  line: null,
  vertices: [],
  tooltip: null
};

function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function measureTotalKm(pts) {
  let km = 0;
  for (let i = 1; i < pts.length; i++) km += haversineKm(pts[i - 1], pts[i]);
  return km;
}

function fmtDistance(km) {
  return km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(2) + ' km';
}

function makeVertexIcon() {
  return L.divIcon({ className: '', html: '<div class="measure-vertex"></div>', iconSize: [12, 12], iconAnchor: [6, 6] });
}

function clearMeasureDrawing(keepLine) {
  measureState.vertices.forEach((m) => map.removeLayer(m));
  measureState.vertices = [];
  if (measureState.tooltip) { map.removeLayer(measureState.tooltip); measureState.tooltip = null; }
  if (measureState.line && !keepLine) { map.removeLayer(measureState.line); measureState.line = null; }
}

function updateMeasureDrawing() {
  const pts = measureState.pts;
  if (measureState.line) map.removeLayer(measureState.line);
  measureState.line = L.polyline(pts, { color: '#facc15', weight: 3, dashArray: '6,6', className: 'measure-line' }).addTo(map);
  if (measureState.tooltip) map.removeLayer(measureState.tooltip);
  if (pts.length >= 2) {
    const km = measureTotalKm(pts);
    measureState.tooltip = L.marker(pts[pts.length - 1], {
      icon: L.divIcon({ className: '', html: '<div class="measure-tip">' + fmtDistance(km) + '</div>' }),
      interactive: false
    }).addTo(map);
  }
}

function addMeasurePoint(latlng) {
  measureState.pts.push(latlng);
  measureState.vertices.push(L.marker(latlng, { icon: makeVertexIcon(), interactive: false }).addTo(map));
  updateMeasureDrawing();
}

function setMeasureMode(on) {
  measureState.active = on;
  const btn = document.querySelector('.leaflet-draw-measure');
  if (btn) btn.classList.toggle('active', on);
  const container = map.getContainer();
  container.style.cursor = on ? 'crosshair' : '';
  if (!on) {
    clearMeasureDrawing(false);
    measureState.pts = [];
  }
}

function commitMeasure() {
  if (measureState.pts.length < 2) { setMeasureMode(false); return; }
  const km = measureTotalKm(measureState.pts);
  const line = L.polyline(measureState.pts, { color: '#facc15', weight: 3, className: 'measure-line' });
  line.bindTooltip(fmtDistance(km), { permanent: true, direction: 'center', className: 'measure-tip' });
  drawnItems.addLayer(line);
  saveAnnotationForLayer(line, 'polyline', line.toGeoJSON(), 'Khoảng cách', km);
  clearMeasureDrawing(false);
  measureState.pts = [];
}

map.on('click', function (e) {
  if (measureState.active) addMeasurePoint(e.latlng);
});
map.on('dblclick', function (e) {
  if (!measureState.active) return;
  L.DomEvent.stop(e);
  // Double-click fires two 'click' events first → drop trailing duplicates at same spot.
  const pts = measureState.pts;
  while (pts.length >= 2) {
    const a = pts[pts.length - 1];
    const b = pts[pts.length - 2];
    if (Math.abs(a.lat - b.lat) < 1e-7 && Math.abs(a.lng - b.lng) < 1e-7) {
      pts.pop();
      const v = measureState.vertices.pop();
      if (v) map.removeLayer(v);
    } else break;
  }
  commitMeasure();
});
document.addEventListener('keydown', function (e) {
  if (!measureState.active) return;
  if (e.key === 'Escape') { setMeasureMode(false); }
  else if (e.key === 'Enter') { commitMeasure(); }
  else if (e.key === 'Backspace') {
    if (measureState.pts.length) {
      measureState.pts.pop();
      const v = measureState.vertices.pop();
      if (v) map.removeLayer(v);
      updateMeasureDrawing();
      e.preventDefault();
    }
  }
});

// Chèn nút đo vào toolbar của leaflet-draw (dưới nút marker)
(function injectMeasureButton() {
  const toolbar = document.querySelector('.leaflet-draw-toolbar');
  if (!toolbar) return;
  const btn = L.DomUtil.create('a', 'leaflet-draw-measure', toolbar);
  btn.href = '#';
  btn.title = t('map.measureTitle');
  btn.setAttribute('aria-label', t('map.measureTitle'));
  L.DomEvent.on(btn, 'click', L.DomEvent.stop)
    .on(btn, 'click', function () { setMeasureMode(!measureState.active); });
})();

let annotationIdCounter = 0;

map.on(L.Draw.Event.CREATED, function (event) {
  drawnItems.addLayer(event.layer);
  const geojson = event.layer.toGeoJSON();
  saveAnnotationForLayer(
    event.layer,
    event.layerType === 'marker' ? 'marker' : event.layerType === 'polygon' ? 'polygon' : 'rectangle',
    geojson,
    event.layerType
  );
});

// Sửa shape → server không có route PUT: xoá bản ghi cũ rồi ghi lại bản mới
// (giữ đúng dữ liệu, tái dùng POST + DELETE sẵn có).
map.on(L.Draw.Event.EDITED, function (event) {
  event.layers.eachLayer(function (layer) {
    const oldId = layer._annotationId;
    const geojson = layer.toGeoJSON();
    const type = layer instanceof L.Marker
      ? 'marker'
      : (geojson.geometry && geojson.geometry.type === 'Polygon' ? 'polygon' : 'polyline');
    saveAnnotation(type, geojson, layer._annotationLabel || type, layer._annotationDistance || 0)
      .then(function (newId) {
        layer._annotationId = newId;
        if (oldId && oldId !== newId) return deleteAnnotation(oldId);
      });
  });
});

// Xoá shape → xoá bản ghi tương ứng trên server (trước đây thiếu handler này
// nên F5 lại hiện shape đã xoá).
map.on(L.Draw.Event.DELETED, function (event) {
  event.layers.eachLayer(function (layer) {
    if (layer._annotationId) deleteAnnotation(layer._annotationId);
  });
});

// ============================================
// Sidebar
// ============================================
let sidebarExpanded = localStorage.getItem('sidebar') !== 'collapsed';

function toggleSidebar() {
  sidebarExpanded = !sidebarExpanded;
  localStorage.setItem('sidebar', sidebarExpanded ? 'expanded' : 'collapsed');
  updateSidebarState();
}

function updateSidebarState() {
  const sidebar = document.getElementById('sidebar');
  const btn = document.getElementById('sidebarToggleBtn');
  if (sidebarExpanded) {
    sidebar.classList.remove('collapsed');
    // Nút nằm sát mép phải panel (bên trong panel)
    document.documentElement.style.setProperty('--toggle-left', 'calc(var(--sidebar-width) - 40px)');
    if (btn) btn.innerHTML = '<i class="fas fa-chevron-left"></i>';
  } else {
    sidebar.classList.add('collapsed');
    document.documentElement.style.setProperty('--toggle-left', '8px');
    if (btn) btn.innerHTML = '<i class="fas fa-chevron-right"></i>';
  }
}

// ============================================
// Sidebar resize (kéo mép phải panel trái)
// ============================================
// Panel mặc định 340px (kéo tay nới tới SIDEBAR_MAX_WIDTH_FALLBACK). Card phiên ở
// tab Lịch sử đã được thiết kế gọn cho đúng bề rộng này: thông số dạng chip
// "icon + số" trên 1 hàng, nhãn nằm trong tooltip.
const SIDEBAR_DEFAULT_WIDTH = 340;
const SIDEBAR_MIN_WIDTH = 260;
// Chừa tối thiểu 360px cho bản đồ để panel không nuốt hết màn hình.
const SIDEBAR_MIN_MAP_WIDTH = 360;
const SIDEBAR_MAX_WIDTH_FALLBACK = 720;
const SIDEBAR_WIDTH_KEY = 'sidebarWidth';

function sidebarMaxWidth() {
  const avail = window.innerWidth - SIDEBAR_MIN_MAP_WIDTH;
  return Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH_FALLBACK, avail));
}

function clampSidebarWidth(px) {
  const max = sidebarMaxWidth();
  const n = Number(px);
  if (!Number.isFinite(n)) return SIDEBAR_DEFAULT_WIDTH;
  return Math.min(max, Math.max(SIDEBAR_MIN_WIDTH, Math.round(n)));
}

// Đổi độ rộng panel + đồng bộ biến phụ thuộc (nút toggle, vị trí thu gọn).
function applySidebarWidth(px, opts) {
  opts = opts || {};
  const w = clampSidebarWidth(px);
  const root = document.documentElement;
  root.style.setProperty('--sidebar-width', w + 'px');
  // Thu gọn phải đẩy panel ra ngoài đúng bằng bề rộng hiện tại, không hardcode.
  root.style.setProperty('--sidebar-collapsed', (-w) + 'px');
  updateSidebarState();
  if (opts.persist) {
    try { localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w)); } catch (e) { /* storage bị chặn */ }
  }
  return w;
}

function savedSidebarWidth() {
  try {
    const raw = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (raw === null) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch (e) {
    return null;
  }
}

function resetSidebarWidth() {
  try { localStorage.removeItem(SIDEBAR_WIDTH_KEY); } catch (e) { /* storage bị chặn */ }
  applySidebarWidth(SIDEBAR_DEFAULT_WIDTH);
  showToast(t('sidebar.resizeReset') + ' — ' + SIDEBAR_DEFAULT_WIDTH + 'px', 'success');
}

function initSidebarResize() {
  const handle = document.getElementById('sidebarResizer');
  const sidebar = document.getElementById('sidebar');
  if (!handle || !sidebar) return;

  // Khôi phục độ rộng đã lưu (nếu có).
  const saved = savedSidebarWidth();
  if (saved !== null) applySidebarWidth(saved);

  let startX = 0;
  let startWidth = 0;
  let dragging = false;

  function onMove(e) {
    if (!dragging) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    applySidebarWidth(startWidth + (x - startX));
    if (e.cancelable) e.preventDefault();
  }

  function onUp() {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('dragging');
    document.body.classList.remove('resizing-sidebar');
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onUp);
    // Lưu lần cuối.
    const w = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width'), 10);
    try { localStorage.setItem(SIDEBAR_WIDTH_KEY, String(clampSidebarWidth(w))); } catch (e) { /* storage bị chặn */ }
    invalidateMapSize();
  }

  function onDown(e) {
    // Chỉ kéo khi panel đang mở.
    if (sidebar.classList.contains('collapsed')) return;
    dragging = true;
    startX = e.touches ? e.touches[0].clientX : e.clientX;
    startWidth = sidebar.getBoundingClientRect().width;
    handle.classList.add('dragging');
    document.body.classList.add('resizing-sidebar');
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
    if (e.cancelable) e.preventDefault();
  }

  handle.addEventListener('mousedown', onDown);
  handle.addEventListener('touchstart', onDown, { passive: false });
  handle.addEventListener('dblclick', resetSidebarWidth);

  // Bàn phím: mũi tên trái/phải đổi 20px, Home đặt lại.
  handle.setAttribute('tabindex', '0');
  handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-orientation', 'vertical');
  handle.addEventListener('keydown', (e) => {
    if (sidebar.classList.contains('collapsed')) return;
    const cur = sidebar.getBoundingClientRect().width;
    let next = null;
    if (e.key === 'ArrowLeft') next = cur - 20;
    else if (e.key === 'ArrowRight') next = cur + 20;
    else if (e.key === 'Home') { resetSidebarWidth(); e.preventDefault(); return; }
    if (next === null) return;
    applySidebarWidth(next, { persist: true });
    invalidateMapSize();
    e.preventDefault();
  });

  // Thu gọn/mở lại: giữ nguyên độ rộng đã chọn, chỉ vẽ lại bản đồ sau transition.
  const toggleBtn = document.getElementById('sidebarToggleBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => { setTimeout(invalidateMapSize, 320); });
  }

  // Cửa sổ nhỏ lại thì ép độ rộng về trong khoảng hợp lệ.
  window.addEventListener('resize', () => {
    const cur = sidebar.getBoundingClientRect().width;
    if (clampSidebarWidth(cur) !== Math.round(cur)) applySidebarWidth(cur);
  });
}

// Leaflet cần biết container đổi kích thước.
function invalidateMapSize() {
  if (window.map && typeof window.map.invalidateSize === 'function') window.map.invalidateSize();
}

// Overlay (modal, menu khách, panel chú thích) phủ lên sidebar.
// Khi ấy mép phải panel bị che nên handle kéo phải ngừng nhận chuột — nếu không nó
// vẫn chiếm 6px ở mép trái màn hình và lần chuột rơi đúng đó sẽ bị nuốt (không kéo
// được panel / không bấm được thứ phía dưới).
// RIÊNG bảng cell (.cl-fullsheet): user cần kéo giãn panel ngay khi đang xem bảng →
// handle nổi TRÊN overlay (class `over-sheet`, z-index 4950 > 4900) chứ không bị chặn.
function syncSidebarResizeBlock() {
  const handle = document.getElementById('sidebarResizer');
  if (!handle) return;
  const sheetOpen = !!document.querySelector('.cl-fullsheet.show');
  const blocking = !!document.querySelector('.modal-overlay.show, .legend-panel.show');
  handle.classList.toggle('blocked', blocking);
  handle.classList.toggle('over-sheet', sheetOpen && !blocking);
}

function initSidebarResizeBlock() {
  const handle = document.getElementById('sidebarResizer');
  if (!handle) return;

  const update = () => syncSidebarResizeBlock();
  // Overlay bật/tắt bằng class `.show` → theo dõi mọi thay đổi attribute.
  // Môi trường không có DOM thật (test chạy app.js trong vm) thì bỏ qua observer.
  if (typeof MutationObserver === 'function') {
    const obs = new MutationObserver(update);
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
    const sheet = document.getElementById('clTableOverlay');
    if (sheet) obs.observe(sheet, { attributes: true, attributeFilter: ['class'] });
    document.querySelectorAll('.modal-overlay, .legend-panel').forEach((el) => {
      obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    });
  }
  window.addEventListener('resize', update);
  update();
}

// Đóng tab / ẩn trang / F5 khi còn toạ độ chờ ghi (debounce 800ms) → gửi nốt.
// `pagehide` phủ cả đóng tab trên mobile; `beforeunload` cho desktop.
function initCallSessionResolvedFlush() {
  const flush = () => { try { flushCallSessionResolved(); } catch (e) { /* trang đang đóng */ } };
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
}

// ============================================
// Tab switching
// ============================================
function switchTab(tabId) {
  // Khách chỉ được vào tab Tra cứu — tab khác cần đăng nhập (và đã bị ẩn trên sidebar).
  if (window.__guestMode && tabId !== 'cells') {
    showToast('Vui lòng đăng nhập để dùng tính năng này.', 'error');
    tabId = 'cells';
  }
  document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.sidebar-tab[data-tab="${tabId}"]`)?.classList.add('active');
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-' + tabId)?.classList.add('active');
  if (tabId === 'lookuphistory') {
    // Tab Lịch sử: mục danh sách phiên (luôn nạp) + mục đơn lẻ (chỉ nạp khi mở).
    syncHistSectionUi();
    loadHistBatches(1);
    // "Tra cứu đơn lẻ" mặc định ĐANG MỞ → phải nạp luôn, nếu không khung giữa trống
    // cho tới khi user đóng rồi mở lại mục (lúc đó toggleHistSection mới nạp).
    // Mục đang đóng thì để trống theo đúng thiết kế "chỉ nạp khi mở".
    if (histSectionOpen.single) loadLookupHistory(histState.page || 1);
  }
  // Tab "Tra cứu danh sách" không có danh sách phiên nữa → mở tab chỉ vẽ lại danh sách
  // bản ghi (trạng thái cell có thể đổi sau khi tra ở bảng cell).
  if (tabId === 'calllogs') renderCallLogs();
  // Chân panel (version + lượt thử) chỉ thuộc tab tra cứu → vẽ lại cho chắc.
  if (window.AppVersion) window.AppVersion.renderPanelVersion();
}

// ============================================
// Lookup history
// ============================================
// Tab Lịch sử = danh sách phiên tra theo list (`histBatch`/loadHistBatches) + mục con
// THU GỌN "Tra cứu đơn lẻ" (histSingle: lịch sử /api/lookup-history?mode=single).
// Mục con chỉ nạp khi mở (không tốn request nếu user không xem).
let histBatchCache = {};
// Lịch sử TRA ĐƠN LẺ (1 cell / 1 lần) — hiển thị trong mục con thu gọn.
let histState = { page: 1, totalPages: 1, rows: [], total: 0, selected: new Set() };
// Trạng thái UI 2 mục của tab Lịch sử: mở/đóng (nhớ trong phiên) + ngày đang lọc
// (''= không lọc). Mỗi mục lọc ngày ĐỘC LẬP vì 2 nguồn dữ liệu khác nhau.
let histSingle = { open: true };
// Tab Lịch sử là ACCORDION: mặc định mở "Tra cứu đơn lẻ" ở trên, "Tra cứu danh sách"
// ở dưới ĐÓNG; mở mục này thì mục kia tự đóng.
let histSectionOpen = { single: true, batch: false };
let histDateFilter = { batch: '', single: '' };
// Popup lịch: mục đang mở ('batch' | 'single' | '') + tháng đang xem (Date).
let histCalState = { target: '', month: null };
// Tên file Excel của lần upload gần nhất → gắn vào metadata nhóm lịch sử.
let currentUploadFileName = '';
// batch_id của phiên đang mở ở tab "Tra cứu danh sách" (card phiên ở tab Lịch sử dùng để tô
// sáng + biết đang xem phiên nào; nút Xoá nằm trên card phiên của tab Lịch sử).
let currentOpenBatchId = '';

function histEsc(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ============================================
// RAT (Radio Access Technology) — màu + nhãn hiển thị
// ============================================
// Nhãn `label` là chữ ngắn in giữa icon marker; `full` dùng cho popup/tooltip.
const RADIO_STYLE = {
  GSM:   { color: '#e8a33d', label: '2G', full: 'GSM (2G)' },
  CDMA:  { color: '#8e6fd8', label: 'CD', full: 'CDMA' },
  UMTS:  { color: '#2fa8c9', label: '3G', full: 'UMTS (3G)' },
  LTE:   { color: '#3d7ce0', label: '4G', full: 'LTE (4G)' },
  NR:    { color: '#d64545', label: '5G', full: 'NR (5G)' },
  NBIOT: { color: '#3fae7a', label: 'NB', full: 'NB-IoT' },
  EVDO:  { color: '#b05fc4', label: 'EV', full: 'EVDO' },
  IDEN:  { color: '#7a8a99', label: 'iD', full: 'iDEN' }
};
const RADIO_ALIASES = {
  GSM: 'GSM', '2G': 'GSM',
  CDMA: 'CDMA', CDMA2000: 'CDMA',
  UMTS: 'UMTS', WCDMA: 'UMTS', '3G': 'UMTS', HSPA: 'UMTS',
  LTE: 'LTE', 'LTE-M': 'LTE', LTEM: 'LTE', '4G': 'LTE', EUTRAN: 'LTE',
  NR: 'NR', '5G': 'NR', NR5G: 'NR', '5GNR': 'NR',
  NBIOT: 'NBIOT', 'NB-IOT': 'NBIOT', NB_IOT: 'NBIOT',
  EVDO: 'EVDO', IDEN: 'IDEN'
};
const RADIO_UNKNOWN = { color: '#8892a0', label: '?', full: '' };

// Chuẩn hoá RAT về khoá trong RADIO_STYLE; '' nếu không nhận diện được.
function radioKey(radio) {
  if (radio === null || radio === undefined) return '';
  const k = String(radio).trim().toUpperCase().replace(/[\s_]/g, '');
  return RADIO_ALIASES[k] || '';
}

// Trả style { color, label, full, key } cho 1 giá trị RAT bất kỳ.
function radioStyle(radio) {
  const key = radioKey(radio);
  const st = RADIO_STYLE[key];
  return st ? { key, color: st.color, label: st.label, full: st.full } : { key: '', ...RADIO_UNKNOWN };
}

// Icon giữa marker: pin định vị tô màu RAT + chữ ngắn (2G/3G/4G/5G...) ở đầu pin.
function makeCellDivIcon(rs) {
  return L.divIcon({
    className: 'cell-marker-wrap',
    html: `<div class="cell-marker" style="--mc:${rs.color}">` +
            `<i class="fas fa-map-marker-alt"></i>` +
            `<span class="cell-marker-txt">${histEsc(rs.label)}</span>` +
          `</div>`,
    iconSize: [26, 34],
    iconAnchor: [13, 32],
    popupAnchor: [0, -30]
  });
}

// Dòng "Công nghệ mạng" cho popup (rỗng nếu không xác định được).
function radioPopupLine(radio) {
  const rs = radioStyle(radio);
  if (!rs.key) return '';
  return `<br>${t('hist.radio')}: <span style="color:${rs.color};font-weight:600">${histEsc(rs.full || rs.label)}</span>`;
}

// batch_id an toàn để nhúng vào chuỗi JS trong onclick/attribute
function histJsSafe(s) {
  return String(s === undefined || s === null ? '' : s).replace(/[^A-Za-z0-9_-]/g, '');
}

// Nguồn dữ liệu đã BỎ khỏi toàn bộ giao diện (yêu cầu: không hiện nguồn kết quả tra
// cứu ở bất kỳ đâu). Giữ hàm để các chỗ gọi cũ không vỡ — luôn trả chuỗi rỗng.
function histSrcIcon(source, showSource) {
  return '';
}

// ============================================
// Lịch sử tra cứu
// ============================================
// Tab Lịch sử = danh sách phiên tra theo list (loadHistBatches/renderHistBatches) +
// mục "Tra cứu đơn lẻ" (toggleHistSection/loadLookupHistory). Nút "Xóa tất
// cả" và thanh chọn tất cả đã bỏ; chỉ xoá được từng phiên / từng lượt tra.

// ============================================
// Highlight 1 cell trên bản đồ (click dòng kết quả tra cứu / cell con lịch sử)
// ============================================
// Vòng + marker tạm, tự xoá khi chọn cell khác (clearHighlight).
let highlightLayer = null;

function clearHighlight() {
  if (highlightLayer) { cellOverlay.removeLayer(highlightLayer); highlightLayer = null; }
}

// ============================================
// Căn bản đồ vào vùng NHÌN THẤY (bỏ phần sidebar che)
// ============================================
// Panel trái (.sidebar) đè lên bản đồ khi mở ⇒ dùng cả viewport để căn thì cell bị
// nấp sau panel. Mọi chỗ căn/zoom phải đi qua 2 helper dưới đây.
// Bề rộng panel đang che = 0 khi thu gọn / không có sidebar (khách chưa đăng nhập).
const MAP_PAD_PX = 24;

function mapSidebarWidth() {
  try {
    const sb = document.getElementById('sidebar');
    if (!sb) return 0;
    if (sb.classList.contains('collapsed')) return 0;
    const cs = window.getComputedStyle(document.documentElement);
    const w = parseFloat(cs.getPropertyValue('--sidebar-width'));
    return Number.isFinite(w) && w > 0 ? w : 0;
  } catch (e) {
    return 0;
  }
}

// options cho map.fitBounds / getBoundsZoom: chừa panel bên trái + lề đều 4 phía.
function mapVisiblePad(extraPx) {
  const pad = Number.isFinite(extraPx) ? Math.max(0, extraPx) : MAP_PAD_PX;
  return {
    paddingTopLeft: [mapSidebarWidth() + pad, pad],
    paddingBottomRight: [pad, pad]
  };
}

function fitBoundsVisible(bounds) {
  if (typeof map === 'undefined' || !map || !bounds || !map.fitBounds) return;
  try {
    map.invalidateSize();
    map.fitBounds(bounds, mapVisiblePad());
  } catch (e) { /* bản đồ chưa sẵn sàng */ }
}

// Đặt tâm bản đồ sao cho (lat, lon) rơi vào GIỮA vùng không bị panel che.
// setView thường đặt điểm vào giữa viewport → phải dịch tâm sang trái nửa bề rộng panel.
function centerOnVisible(lat, lon, zoom) {
  if (typeof map === 'undefined' || !map || !map.setView) return;
  lat = parseFloat(lat); lon = parseFloat(lon);
  if (!isFinite(lat) || !isFinite(lon)) return;
  const z = Number(zoom) || 15;
  try {
    map.invalidateSize();
    const off = mapSidebarWidth() / 2;
    if (!off) { map.setView([lat, lon], z); return; }
    const pt = map.project(L.latLng(lat, lon), z);
    pt.x -= off;
    const c = map.unproject(pt, z);
    map.setView(c, z);
  } catch (e) {
    map.setView([lat, lon], z);
  }
}

// Chọn mức zoom sao cho vòng bán kính cell luôn nằm gọn trong viewport.
// Cell có range lớn (km) trước đây bị cắt cụt vì zoom cứng 17.
function zoomForRadius(lat, lon, radiusM) {
  const r = Math.max(parseFloat(radiusM) || 0, 100);
  if (typeof map === 'undefined' || !map.getBoundsZoom) return 15;
  try {
    // *2.4 = đường kính + lề để vòng tròn không dính sát mép màn hình.
    const bounds = L.latLng(lat, lon).toBounds(r * 2.4);
    const z = map.getBoundsZoom(bounds);
    return Math.max(11, Math.min(18, z));
  } catch (e) {
    return 15;
  }
}

// Tô sáng 1 cell trên bản đồ (bấm 1 dòng ở Lịch sử tra đơn lẻ / kết quả tra thử của khách).
//
// `info` (tuỳ chọn) là dữ liệu để dựng popup CHI TIẾT giống hệt tra theo danh sách:
//   { mcc, mnc, lac, cellid, cellLine, radio, range, sourceLabel, srcType, showSource,
//     description, extra }
// Trước đây chỉ bind 1 nhãn chữ ("452-1-9000-123456") nên bấm vào cell ở bản đồ không
// xem được nguồn / công nghệ / bán kính / toạ độ / địa chỉ như tra theo danh sách.
function highlightCellOnMap(lat, lon, range, radio, label, info) {
  lat = parseFloat(lat); lon = parseFloat(lon);
  if (!isFinite(lat) || !isFinite(lon)) { showToast(t('hist.notFound'), 'error'); return; }
  clearHighlight();
  const radius = parseFloat(range) || 500;
  const rs = radioStyle(radio);
  highlightLayer = L.layerGroup([
    L.circleMarker([lat, lon], {
      radius: 14, color: rs.color, weight: 3, fill: false,
      className: 'cell-hl-ring', interactive: false
    }),
    L.circle([lat, lon], {
      radius: radius, color: rs.color, weight: 2, opacity: 0.9,
      fillColor: rs.color, fillOpacity: 0.12
    })
  ]);
  cellOverlay.addLayer(highlightLayer);
  centerOnVisible(lat, lon, zoomForRadius(lat, lon, radius));
  if (!label && !info) return;
  // Popup đầy đủ (dùng chung builder với tra theo danh sách) — rơi về nhãn chữ nếu
  // không có đủ thông tin cell.
  let popupHtml;
  if (info && (info.mcc != null || info.cellid != null)) {
    popupHtml = buildCellPopupHtml(Object.assign({ lat: lat, lon: lon, range: radius }, info));
  } else {
    popupHtml = histEsc(label || '');
  }
  const pin = L.marker([lat, lon], { icon: makeCellDivIcon(rs) }).bindPopup(popupHtml);
  // Cho bấm cả vào đường tròn bán kính (vùng bấm rộng hơn pin).
  highlightLayer.eachLayer(function (layer) {
    if (layer instanceof L.Circle && typeof layer.bindPopup === 'function') layer.bindPopup(popupHtml);
  });
  highlightLayer.addLayer(pin);
  pin.openPopup();
}

// Chi tiết 1 cell lịch sử (popup giống hệt tra đơn lẻ)
function showHistCellDetail(r) {
  const showSource = (typeof Auth !== 'undefined' && Auth.isAdmin && Auth.isAdmin());
  const srcType = r.source === 'local' ? 'local' : 'online';
  showCellOnMap({
    lat: r.lat, lon: r.lng, range: r.range || 500,
    color: r.source === 'local' ? '#ff4444' : '#22aa44',
    mcc: r.mcc, mnc: r.mnc, lac: r.lac, cellid: r.cellid,
    cellLine: formatCellId(r.cellid, r.sector),
    radio: r.radio,
    sourceLabel: r.source, srcType: srcType, showSource: showSource
  });
}

// Lấy (và cache) danh sách cell của 1 batch — dùng cho các mục lịch sử khác.
async function histLoadBatch(batchId) {
  if (!histBatchCache[batchId]) {
    const rows = await apiRequest('GET', `/api/lookup-history/batch/${encodeURIComponent(batchId)}`);
    histBatchCache[batchId] = Array.isArray(rows) ? rows : (rows.data || []);
  }
  return histBatchCache[batchId];
}

// ============================================
// Lịch sử tra cứu: 2 mục THU GỌN/MỞ + popup lọc ngày
// ============================================
// Mục 1 "Tra cứu danh sách (Excel)"  → /api/lookup-history?mode=batch
// Mục 2 "Tra cứu đơn lẻ"             → /api/lookup-history?mode=single
// Cả hai mục: bấm tiêu đề = mở/đóng; icon lịch cuối tiêu đề = popup chọn ngày để
// lọc (mỗi mục lọc riêng, độc lập). Mục đơn lẻ mặc định ĐÓNG → chỉ nạp khi mở lần
// đầu, không tốn request nếu user không xem.
const HIST_DOW = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

// Mở/đóng 1 mục của tab Lịch sử — kiểu ACCORDION: mở mục này thì đóng mục kia, danh sách
// đang mở chiếm toàn bộ chiều cao panel.
//   target 'single' → ẩn/hiện #histSingleBody + nạp dữ liệu ở lần mở đầu
//   target 'batch'  → ẩn/hiện #histBatchList (danh sách phiên đã nạp sẵn)
function toggleHistSection(target) {
  const open = !histSectionOpen[target];
  histSectionOpen[target] = open;
  // Mở mục nào thì đóng mục còn lại (2 mục không bao giờ mở cùng lúc).
  if (open) {
    const other = target === 'batch' ? 'single' : 'batch';
    histSectionOpen[other] = false;
  }
  renderHistSections();
  // Mở mục nào cũng nạp lại dữ liệu của mục đó — danh sách phiên có thể vừa thay đổi do
  // vừa tra xong một phiên mới. Trước đây chỉ mục "đơn lẻ" được nạp, nên mở mục "Tra cứu
  // danh sách" ra mà danh sách vẫn là bản cũ (hoặc rỗng nếu lần đầu tab chưa nạp).
  // Không dùng cờ `loaded`: mục có thể đóng/mở nhiều lần trong cùng phiên.
  if (open && target === 'single') loadLookupHistory(histState.page || 1);
  if (open && target === 'batch') loadHistBatches(1);
}

// Vẽ trạng thái mở/đóng của 2 mục. Chỉ 1 mục mở tại một thời điểm:
//   .hist-section-hd[aria-expanded]  → mũi tên xoay
//   <body>[hidden]                   → ẩn/hiện
//   .is-collapsed                    → mục đang đóng chỉ còn dòng tiêu đề
//   .is-expanded                     → mục đang mở giãn hết chiều cao panel
function renderHistSections() {
  // [khoá state, id của BODY cần bật/tắt `hidden`, id của wrapper .hist-sub]
  // Lưu ý: body của mục danh sách là #histBatchBody, KHÔNG phải #histBatchList
  // (đó là <div class="hist-list"> nằm BÊN TRONG body). Trước đây truyền nhầm
  // 'histBatchList' nên `hidden` bị gỡ trên danh sách, còn #histBatchBody vẫn giữ
  // `hidden` từ HTML → mở mục danh sách ra khung trống, không thấy phiên nào.
  [['batch', 'histBatchBody', 'histBatchSub'], ['single', 'histSingleBody', 'histSingleSub']]
    .forEach(([key, bodyId, wrapId]) => {
      const open = !!histSectionOpen[key];
      const hd = document.getElementById(key === 'batch' ? 'histBatchHd' : 'histSingleHd');
      const body = document.getElementById(bodyId);
      const wrap = document.getElementById(wrapId);
      if (hd) hd.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (body) body.hidden = !open;
      if (wrap) {
        wrap.classList.toggle('is-expanded', open);
        wrap.classList.toggle('is-collapsed', !open);
      }
    });
  syncHistDateChips();
}

// Đồng bộ lại trạng thái mở/đóng + chip ngày khi vào tab (tránh HTML và state lệch
// nhau sau khi đóng/mở nhiều lần).
function syncHistSectionUi() {
  renderHistSections();
}

// Ngày ISO YYYY-MM-DD hợp lệ (dùng cả client-side trước khi gọi API).
function isValidIsoDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// Vẽ lại chip ngày + trạng thái nút lịch (mục nào đang lọc thì chip hiện ngày đó,
// bấm chip = bỏ lọc).
function syncHistDateChips() {
  [['batch', 'histBatchDateChip', 'histBatchCalBtn'], ['single', 'histSingleDateChip', 'histSingleCalBtn']]
    .forEach(([key, chipId, btnId]) => {
      const chip = document.getElementById(chipId);
      const btn = document.getElementById(btnId);
      const date = histDateFilter[key] || '';
      if (chip) {
        chip.classList.toggle('hidden', !date);
        chip.innerHTML = date ? `<i class="fas fa-xmark"></i>${histEsc(fmtHistDateVn(date))}` : '';
        chip.title = date ? t('hist.clearDate') : '';
        chip.onclick = date ? (ev) => { ev.stopPropagation(); clearHistDate(key); } : null;
      }
      if (btn) btn.classList.toggle('on', !!date);
    });
}

// YYYY-MM-DD → DD/MM/YYYY (nhãn chip).
function fmtHistDateVn(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || '');
}

// Bỏ lọc ngày của 1 mục → nạp lại danh sách tương ứng.
function clearHistDate(target) {
  histDateFilter[target] = '';
  syncHistDateChips();
  if (target === 'single') loadLookupHistory(1);
  else loadHistBatches(1);
}

// Áp ngày lọc cho 1 mục (gọi từ popup lịch).
function applyHistDate(target, iso) {
  histDateFilter[target] = isValidIsoDate(iso) ? iso : '';
  syncHistDateChips();
  closeHistDatePopup();
  if (target === 'single') {
    loadLookupHistory(1);
  } else {
    loadHistBatches(1);
  }
}

// Mở popup lịch neo dưới nút vừa bấm. Tháng mở mặc định = tháng của ngày đang lọc
// (hoặc tháng hiện tại).
function openHistDatePopup(target, anchorEl) {
  const pop = document.getElementById('histDatePopup');
  if (!pop) return;
  if (histCalState.target === target && !pop.hidden) { closeHistDatePopup(); return; }
  histCalState.target = target;
  const cur = histDateFilter[target];
  const base = isValidIsoDate(cur) ? new Date(cur + 'T00:00:00') : new Date();
  histCalState.month = new Date(base.getFullYear(), base.getMonth(), 1);
  renderHistDatePopup();
  pop.hidden = false;
  // Neo SÁT nút lịch: mép trên popup cách đáy nút 2px, mép phải popup thẳng mép phải nút
  // (popup mở sang trái để luôn dính nút) — nhờ popup được gắn vào <body> nên toạ độ
  // `fixed` đúng bằng toạ độ viewport. Kẹp trong viewport để không tràn mép.
  placeHistDatePopup(anchorEl);
  document.addEventListener('mousedown', histDatePopupOutside, true);
  document.addEventListener('keydown', histDatePopupEsc, true);
}

// Đặt popup lịch sát nút vừa bấm. Gọi lại được khi panel đổi bề rộng / cuộn / resize.
//
// LƯU Ý: popup nằm trong #sidebar và sidebar là `position: fixed` → nếu để nguyên trong
// sidebar, con `position: fixed` sẽ lấy SIDEBAR làm containing block (toạ độ lệch đúng
// bằng offset của sidebar: 48px theo trục dọc). Vì vậy popup được chuyển sang <body>
// ngay khi mở: lúc đó `left/top` là toạ độ viewport thật.
function placeHistDatePopup(anchorEl) {
  const pop = document.getElementById('histDatePopup');
  if (!pop || pop.hidden) return;
  if (pop.parentElement !== document.body) document.body.appendChild(pop);
  if (!anchorEl || !anchorEl.getBoundingClientRect) return;
  const r = anchorEl.getBoundingClientRect();
  const pad = 6, gap = 2;
  const w = pop.offsetWidth || 232;
  const h = pop.offsetHeight || 260;
  // Canh phải popup trùng mép phải nút → nằm sát ngay dưới icon lịch.
  let left = Math.round(r.right - w);
  left = Math.max(pad, Math.min(left, window.innerWidth - w - pad));
  let top = Math.round(r.bottom + gap);
  if (top + h > window.innerHeight - pad) top = Math.max(pad, Math.round(r.top - h - gap));
  pop.style.left = left + 'px';
  pop.style.top = top + 'px';
}

function closeHistDatePopup() {
  const pop = document.getElementById('histDatePopup');
  if (pop) pop.hidden = true;
  histCalState.target = '';
  document.removeEventListener('mousedown', histDatePopupOutside, true);
  document.removeEventListener('keydown', histDatePopupEsc, true);
}

// Bấm ra ngoài popup/nút lịch → đóng.
function histDatePopupOutside(ev) {
  const pop = document.getElementById('histDatePopup');
  if (!pop || pop.hidden) return;
  if (pop.contains(ev.target)) return;
  if (ev.target.closest && ev.target.closest('.hs-cal')) return;
  closeHistDatePopup();
}

function histDatePopupEsc(ev) {
  if (ev.key === 'Escape') closeHistDatePopup();
}

// Lưới tháng: 6 hàng × 7 cột, thứ 2 đầu tuần. Ngày ngoài tháng làm mờ nhưng vẫn bấm
// được. `today` viền mảnh, ngày đang lọc tô đậm.
function renderHistDatePopup() {
  const pop = document.getElementById('histDatePopup');
  if (!pop || !histCalState.month) return;
  const target = histCalState.target;
  const m = histCalState.month;
  const year = m.getFullYear(), month = m.getMonth();
  const first = new Date(year, month, 1);
  // Thứ 2 = 0 … CN = 6
  const lead = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - lead);
  const sel = histDateFilter[target] || '';
  const todayIso = histIsoOf(new Date());

  let days = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const iso = histIsoOf(d);
    const cls = ['hs-cal-day'];
    if (d.getMonth() !== month) cls.push('out');
    if (iso === todayIso) cls.push('today');
    if (iso === sel) cls.push('sel');
    days += `<button type="button" class="${cls.join(' ')}" data-iso="${iso}"` +
      ` onclick="applyHistDate('${target}', '${iso}')">${d.getDate()}</button>`;
  }

  pop.innerHTML = `<div class="hs-cal-hd">`
    + `<button type="button" class="hs-cal-nav" onclick="histCalNav(-12)" title="−1 năm"><i class="fas fa-angle-double-left"></i></button>`
    + `<button type="button" class="hs-cal-nav" onclick="histCalNav(-1)" title="Tháng trước"><i class="fas fa-angle-left"></i></button>`
    + `<b>Tháng ${month + 1}/${year}</b>`
    + `<button type="button" class="hs-cal-nav" onclick="histCalNav(1)" title="Tháng sau"><i class="fas fa-angle-right"></i></button>`
    + `<button type="button" class="hs-cal-nav" onclick="histCalNav(12)" title="+1 năm"><i class="fas fa-angle-double-right"></i></button>`
    + `</div>`
    + `<div class="hs-cal-grid">`
    + HIST_DOW.map(d => `<span class="hs-cal-dow">${d}</span>`).join('')
    + days
    + `</div>`
    + `<div class="hs-cal-ft">`
    + `<button type="button" onclick="applyHistDate('${target}', '${todayIso}')">${histEsc(t('hist.calToday'))}</button>`
    + `<button type="button" onclick="clearHistDate('${target}'); closeHistDatePopup()">${histEsc(t('hist.calAll'))}</button>`
    + `</div>`;
}

// Đổi tháng đang xem (delta tháng; ±12 = ±1 năm).
function histCalNav(delta) {
  if (!histCalState.month) return;
  histCalState.month = new Date(histCalState.month.getFullYear(), histCalState.month.getMonth() + delta, 1);
  renderHistDatePopup();
}

// YYYY-MM-DD theo GIỜ ĐỊA PHƯƠNG (không dùng toISOString: sẽ lệch ngày ở VN UTC+7).
function histIsoOf(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Nạp lịch sử tra đơn lẻ. Chỉ mode=single → không trộn dòng batch (batch có card riêng).
async function loadLookupHistory(page) {
  const list = document.getElementById('lookupHistoryList');
  if (!list) return;
  if (!Auth.getToken()) { list.innerHTML = `<span>${histEsc(t('hist.needAuth'))}</span>`; return; }
  histState.page = page || 1;
  histState.selected = new Set();
  const date = histDateFilter.single || '';
  syncHistDateChips();
  list.innerHTML = `<span>${histEsc(t('hist.loading'))}</span>`;
  try {
    const qs = `page=${histState.page}&limit=50&mode=single`
      + (isValidIsoDate(date) ? '&date=' + encodeURIComponent(date) : '');
    const data = await apiRequest('GET', `/api/lookup-history?${qs}`);
    histState.rows = data.data || [];
    histState.total = data.total || 0;
    histState.totalPages = data.totalPages || 1;
    renderLookupHistory();
  } catch (e) {
    list.innerHTML = `<span style="color:var(--bg-btn-danger)">${histEsc(e.message)}</span>`;
  }
}

// Card = 1 cell đã tra 1 lần: MÃ CELL (dòng chính) + toạ độ / "Không tìm thấy" (dòng
// phụ, thấy ngay vì đây là dữ liệu chính của kiểu tra này) + badge RAT + icon nguồn.
function renderLookupHistory() {
  const list = document.getElementById('lookupHistoryList');
  if (!list) return;
  const rows = histState.rows || [];
  const count = document.getElementById('histSingleCount');
  if (count) count.textContent = histState.total ? `(${histState.total})` : '';
  if (!rows.length) {
    list.innerHTML = `<div class="hist-empty"><i class="fas fa-inbox"></i><br>${histEsc(t('hist.singleEmpty'))}`
      + `<div class="hist-empty-sub">${histEsc(t('hist.singleHint'))}</div></div>`;
    updateHistPager();
    return;
  }

  const showSource = (typeof Auth !== 'undefined' && Auth.isAdmin && Auth.isAdmin());

  list.innerHTML = rows.map(r => {
    const rowKey = String(r.id);
    const src = histSrcIcon(r.source, showSource);
    const cell = `${histEsc(r.mcc)}-${histEsc(r.mnc)}-${histEsc(r.lac)}-${histEsc(r.cellid)}`;

    // Công nghệ mạng (RAT) → badge màu lấy từ RADIO_STYLE (nguồn màu duy nhất, dùng
    // chung với marker/popup bản đồ). Không xác định được thì bỏ trống.
    const rs = radioStyle(r.radio);
    const radioCls = rs.key ? ' hist-card--rat' : '';
    const radioStyleAttr = rs.key ? ` style="border-left-color:${rs.color}"` : '';
    const radioBadge = rs.key
      ? `<span class="hist-radio-badge" style="background:${rs.color}" title="${histEsc(t('hist.radio'))}">${histEsc(t('rat.' + rs.key) || rs.label)}</span>`
      : '';

    // Dòng phụ: toạ độ (tra được) hoặc "Không tìm thấy" + thời gian + bán kính.
    const coordsTxt = (r.lat && r.lng) ? `${parseFloat(r.lat)}, ${parseFloat(r.lng)}` : '';
    const meta = `<div class="hist-meta">
      ${coordsTxt
        ? `<span class="ok"><i class="fas fa-map-pin"></i>${histEsc(coordsTxt)}</span>`
        : `<span class="miss"><i class="fas fa-map-pin"></i>${histEsc(t('hist.notFound'))}</span>`}
      <span><i class="fas fa-clock"></i>${histEsc(fmtDateTime(r.created_at) || r.created_at || '')}</span>
      ${r.range ? `<span><i class="fas fa-circle-notch"></i>${parseFloat(r.range)}m</span>` : ''}
    </div>`;

    // Cell KHÔNG tra được (không có toạ độ) → cho tra lại NGAY trên thẻ, cạnh nút xoá.
    // Trước đây phải bấm vào thân thẻ (mở bản đồ / tra lại ngầm, không rõ ràng).
    const canRetry = !(r.lat && r.lng);
    const retryBtn = canRetry
      ? `<button class="hist-retry" title="${histEsc(t('hist.retry'))}"`
        + ` data-i18n-title="hist.retry" aria-label="${histEsc(t('hist.retry'))}"`
        + ` onclick="event.stopPropagation(); histRetryCell(${r.id})">`
        + `<i class="fas fa-rotate-right"></i></button>`
      : '';

    return `<div class="hist-card hist-card--single${radioCls}"${radioStyleAttr} data-id="${r.id}" data-key="${rowKey}" data-radio="${histEsc(rs.key || '')}">
      <div class="hist-card-main" onclick="histOpenOnMap(${r.id})" title="${histEsc(t('hist.openOnMap'))}">
        <div class="hist-card-top">
          <span class="hist-cell" title="${cell}">${cell}</span>
          ${radioBadge}
          ${src}
        </div>
        ${meta}
      </div>
      <div class="hist-card-acts">
        ${retryBtn}
        <button class="hist-del" title="${histEsc(t('hist.deleteEntry'))}" onclick="event.stopPropagation(); deleteLookupEntry(${r.id})"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
  }).join('');
  updateHistPager();
}

// Click 1 dòng lịch sử TRA ĐƠN LẺ → zoom tới cell trên bản đồ (không trừ điểm).
// Dòng không có toạ độ (miss) → tra lại như tra mới.
async function histOpenOnMap(id) {
  const r = histState.rows.find(x => x.id === id);
  if (!r) return;
  if (r.lat && r.lng) {
    const showSource = (typeof Auth !== 'undefined' && Auth.isAdmin && Auth.isAdmin());
    const srcType = r.source === 'local' ? 'local' : 'online';
    highlightCellOnMap(r.lat, r.lng, r.range, r.radio,
      `${r.mcc}-${r.mnc}-${r.lac}-${r.cellid}`, {
        mcc: r.mcc, mnc: r.mnc, lac: r.lac, cellid: r.cellid,
        cellLine: formatCellId(r.cellid, r.sector),
        radio: r.radio,
        sourceLabel: SOURCE_LABELS[r.source] || (r.source || ''),
        srcType: srcType, showSource: showSource,
        description: r.cell_address || ''
      });
  } else {
    // Không có toạ độ trong lịch sử → tra lại như tra mới.
    await lookupCell(r.mcc, r.mnc, r.lac, r.cellid);
  }
}

// Phân trang + đếm của danh sách tra đơn lẻ.
function updateHistPager() {
  const info = document.getElementById('histPageInfo');
  if (info) info.textContent = `${histState.page} / ${histState.totalPages}`;
  const prev = document.getElementById('histPrevBtn');
  if (prev) prev.disabled = histState.page <= 1;
  const next = document.getElementById('histNextBtn');
  if (next) next.disabled = histState.page >= histState.totalPages;
}

function histPage(delta) {
  const next = histState.page + delta;
  if (next < 1 || next > histState.totalPages) return;
  loadLookupHistory(next);
}

// Tra LẠI 1 cell đã thất bại từ thẻ lịch sử tra đơn lẻ (nút "Tra lại" cạnh nút xoá).
// Khác `lookupCell`: KHÔNG ghi vào form tra cứu / khu kết quả bên tab khác, không nhảy
// bản đồ. Kết quả cập nhật NGAY trên thẻ (thanh trạng thái + đổi nội dung thẻ) và tải
// lại danh sách để có bản ghi mới nhất từ server.
const histRetryBusy = new Set();
// Loại thanh trạng thái của lần "Tra lại" gần nhất (đọc lại sau khi danh sách vẽ lại).
let histRetryBarKind = '';

async function histRetryCell(id) {
  const r = (histState.rows || []).find(x => String(x.id) === String(id));
  if (!r) return;
  if (histRetryBusy.has(String(id))) return;
  const card = document.querySelector(`#lookupHistoryList .hist-card[data-id="${cssEscapeAttr(id)}"]`);
  const btn = card && card.querySelector('.hist-retry');

  histRetryBusy.add(String(id));
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
  histShowRetryBar(card, 'busy');

  try {
    const res = await apiRequest('GET',
      `/api/cells/resolve?mcc=${encodeURIComponent(r.mcc)}&mnc=${encodeURIComponent(r.mnc)}`
      + `&lac=${encodeURIComponent(r.lac)}&cellid=${encodeURIComponent(r.cellid)}`
      + (r.sector != null && r.sector !== '' ? `&sector=${encodeURIComponent(r.sector)}` : '')
      + (r.radio ? `&radio=${encodeURIComponent(r.radio)}` : ''));
    const d = (res && res.data) || {};
    if (d.lat != null && d.lon != null) {
      // Tra ra → cập nhật thẻ tại chỗ (không chờ tải lại) rồi đồng bộ server.
      r.lat = d.lat; r.lng = d.lon;
      if (d.range != null) r.range = d.range;
      if (d.radio) r.radio = d.radio;
      if (res.source) r.source = res.source;
      histShowRetryBar(card, 'done');
      showToast(t('hist.retryOk'), 'success');
    } else {
      histShowRetryBar(card, 'miss');
      showToast(t('hist.retryMiss'), 'error');
    }
  } catch (e) {
    // 402 = hết điểm → báo rõ số dư, KHÔNG coi là "không ra kết quả".
    if (e && e.code === 402) {
      histShowRetryBar(card, 'nofunds');
      showToast(fmtTpl('hist.retryNoFunds', {
        c: e.required != null ? e.required : '?', b: e.balance != null ? e.balance : '?'
      }), 'error');
    } else if (e && e.code === 404) {
      histShowRetryBar(card, 'miss');
      showToast(t('hist.retryMiss'), 'error');
    } else {
      histShowRetryBar(card, 'fail');
      showToast(t('hist.retryFail'), 'error');
    }
  } finally {
    histRetryBusy.delete(String(id));
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-rotate-right"></i>'; }
    // Tải lại danh sách → thẻ vẽ lại theo dữ liệu mới (có toạ độ thì nút Tra lại tự mất).
    // Thanh trạng thái đặt lại vào thẻ mới để user kịp đọc, rồi tự ẩn.
    const kind = histRetryBarKind;
    histRetryBarKind = '';
    await loadLookupHistory(histState.page);
    if (kind) {
      const c2 = document.querySelector(`#lookupHistoryList .hist-card[data-id="${cssEscapeAttr(id)}"]`);
      histShowRetryBar(c2, kind);
      setTimeout(() => histClearRetryBar(id), 3200);
    }
  }
}

// Loại thanh trạng thái của lần "Tra lại" gần nhất (đọc lại sau khi danh sách vẽ lại).
// Thanh trạng thái trên thẻ lịch sử: busy | done | miss | nofunds | fail.
function histShowRetryBar(card, kind) {
  if (!card) return;
  histRetryBarKind = kind;
  let bar = card.querySelector('.hist-retry-bar');
  if (!bar) {
    bar = document.createElement('div');
    card.appendChild(bar);
  }
  const map = {
    busy:    { cls: 'busy',    ico: 'fa-spinner fa-spin',      txt: t('hist.retryBarBusy') },
    done:    { cls: 'done',    ico: 'fa-circle-check',         txt: t('hist.retryBarDone') },
    miss:    { cls: 'miss',    ico: 'fa-circle-xmark',         txt: t('hist.retryBarMiss') },
    nofunds: { cls: 'nofunds', ico: 'fa-triangle-exclamation', txt: t('hist.retryBarNoFunds') },
    fail:    { cls: 'fail',    ico: 'fa-circle-exclamation',   txt: t('hist.retryBarFail') }
  }[kind] || { cls: 'fail', ico: 'fa-circle-exclamation', txt: '' };
  bar.className = `hist-retry-bar ${clsSafe(map.cls)}`;
  bar.innerHTML = `<i class="fas ${map.ico}"></i><span>${histEsc(map.txt)}</span>`;
}

function histClearRetryBar(id) {
  const card = document.querySelector(`#lookupHistoryList .hist-card[data-id="${cssEscapeAttr(id)}"]`);
  const bar = card && card.querySelector('.hist-retry-bar');
  if (bar) bar.remove();
}

// Xoá 1 lượt tra đơn lẻ (chỉ bản ghi của chính user).
async function deleteLookupEntry(id) {
  const row = (histState.rows || []).find(function (r) { return String(r.id) === String(id); }) || {};
  const detail = [];
  const cellTxt = row.cell_key || [row.mcc, row.mnc, row.lac, row.cellid].filter(v => v != null && v !== '').join('-');
  if (cellTxt) detail.push({ k: t('confirm.cellLabel'), v: cellTxt });
  if (row.lat != null && row.lng != null) detail.push({ k: t('confirm.coordsLabel'), v: parseFloat(row.lat) + ', ' + parseFloat(row.lng) });
  if (row.range) detail.push({ k: t('confirm.rangeLabel'), v: parseFloat(row.range) + 'm' });
  if (row.created_at) detail.push({ k: t('confirm.timeLabel'), v: fmtDateTime(row.created_at) || row.created_at });

  const ok = await openConfirmDialog({
    title: t('confirm.delEntryTitle'),
    message: t('confirm.delEntryMsg'),
    detail: detail,
    warnings: [t('confirm.warnPermanent')],
    notes: [t('confirm.noteEntryOnly')],
    okText: t('confirm.okDelete')
  });
  if (!ok) return;
  try {
    await apiRequest('DELETE', `/api/lookup-history/${id}`);
    showToast(t('hist.deleted'), 'success');
    loadLookupHistory(histState.page);
  } catch (e) { showToast(e.message, 'error'); }
}

// ============================================
// Phiên tra theo list (mục "Tra cứu danh sách (Excel)" của tab Lịch sử)
// ============================================
// Tab Lịch sử là nơi DUY NHẤT hiển thị phiên (tab "Tra cứu danh sách" đã bỏ danh sách
// phiên). Mỗi phiên cần 2 nguồn số liệu:
//   /api/lookup-history?mode=batch — lần tra theo list (lookup_batches): số cell của
//                                    file, số cell tra ra toạ độ, tên file, thời gian;
//   /api/call-log-sessions         — metadata phiên (mạng, số dòng) + số cell ĐÃ TRA
//                                    (looked_count, đếm theo lookup_history).
// Hai endpoint cùng khoá `batch_id` → gộp thành 1 card đầy đủ. Nguồn `lookup_batches`
// là nguồn chính (có cả phiên chỉ-tra-mà-không-có call_logs); `call-log-sessions` bổ
// sung số liệu tiến độ. Lỗi mạng ở nguồn phụ không làm hỏng danh sách.
let histBatch = { rows: [], total: 0, page: 1, limit: 20, totalPages: 1 };
// batch_id → metadata phiên (từ /api/call-log-sessions), dùng cho card + openCallLogSession.
let clSessionMeta = {};
// Lần gọi gần nhất — chặn render cũ đè lên render mới khi bấm trang liên tiếp.
let histBatchLoadSeq = 0;

// Nạp metadata phiên (mạng / số dòng / tiến độ tra). Trả về map batch_id → row;
// lỗi mạng → trả map cũ (danh sách vẫn hiển thị từ lookup-history).
async function loadCallLogSessions(page) {
  const qs = `page=${page || 1}&limit=500`;
  try {
    const resp = await apiRequest('GET', '/api/call-log-sessions?' + qs);
    const rows = Array.isArray(resp) ? resp : (resp.data || []);
    const map = {};
    for (const s of rows) if (s && s.batch_id) map[s.batch_id] = s;
    clSessionMeta = map;
    return map;
  } catch (e) {
    return clSessionMeta || {};
  }
}

// Trạng thái tiến độ của 1 phiên (client tính từ 2 nguồn, KHÔNG tự đoán toạ độ):
//   totalCells — số cell của file (metadata client gửi → call_logs → số cell đã tra);
//   looked     — số cell đã tra; found — số cell có toạ độ; pending — còn chưa tra.
function clSessionProgress(entry) {
  const e = entry || {};
  const meta = clSessionMeta[e.batch_id] || {};
  const rowCount = Number(e.row_count) || Number(meta.row_count) || 0;
  const found = Math.max(Number(e.found_count) || 0, Number(meta.found_count) || 0);
  const looked = Math.max(Number(meta.looked_count) || 0, found);
  const total = Math.max(
    Number(e.cell_count) || 0,
    Number(meta.cell_total) || 0,
    looked
  );
  return { rowCount, total, looked, found, pending: Math.max(0, total - looked) };
}

async function loadHistBatches(page) {
  const box = document.getElementById('histBatchList');
  if (!box) return;
  if (!Auth.getToken()) { box.innerHTML = ''; return; }
  histBatch.page = page || 1;
  const seq = ++histBatchLoadSeq;
  const prev = box.innerHTML;
  box.innerHTML = `<div class="hist-batch-empty"><i class="fas fa-spinner fa-spin"></i> ${histEsc(t('hist.loading'))}</div>`;
  try {
    // Ngày lọc lấy từ popup lịch của CHÍNH mục này (mỗi mục lọc độc lập).
    const date = histDateFilter.batch || '';
    const qs = `page=${histBatch.page}&limit=${histBatch.limit}&mode=batch`
      + (isValidIsoDate(date) ? '&date=' + encodeURIComponent(date) : '');
    // Metadata phiên nạp SONG SONG; lỗi ở nguồn phụ không chặn danh sách.
    const [data] = await Promise.all([
      apiRequest('GET', `/api/lookup-history?${qs}`),
      loadCallLogSessions(1)
    ]);
    if (seq !== histBatchLoadSeq) return;   // đã có lần nạp mới hơn
    histBatch.rows = data.data || [];
    histBatch.total = data.total || 0;
    histBatch.totalPages = data.totalPages || 1;
    syncHistDateChips();
    mergePendingSessions();
    renderHistBatches();
  } catch (e) {
    if (seq !== histBatchLoadSeq) return;
    // Lỗi mạng: giữ nội dung cũ (không xoá trắng danh sách đang xem), chỉ báo.
    box.innerHTML = prev || `<div class="hist-batch-empty" style="color:var(--bg-btn-danger)">${histEsc(e.message)}</div>`;
  }
}

// Phiên đã đăng ký nhưng CHƯA có bản ghi lookup_history (bấm Tra cứu rồi bỏ dở, hết
// điểm ngay vòng đầu…) sẽ không xuất hiện ở /api/lookup-history → bổ sung ở trang 1
// để user không "mất" phiên.
function mergePendingSessions() {
  if (histBatch.page !== 1) return;
  const known = new Set(histBatch.rows.map(r => r.batch_id));
  const extra = Object.values(clSessionMeta || {})
    .filter(s => s && s.batch_id && !known.has(s.batch_id))
    .map(s => ({
      mode: 'batch', batch_id: s.batch_id, file_name: s.file_name || '',
      cell_count: Number(s.cell_total) || Number(s.cell_count) || 0,
      found_count: Number(s.found_count) || 0,
      created_at: s.created_at || '', row_count: Number(s.row_count) || 0
    }))
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  histBatch.rows = histBatch.rows.concat(extra);
}

function renderHistBatches() {
  const box = document.getElementById('histBatchList');
  if (!box) return;
  const rows = histBatch.rows || [];
  const count = document.getElementById('histCount');
  if (count) count.textContent = rows.length ? `${rows.length} ${t('hist.sessions')}` : '';
  if (!rows.length) {
    box.innerHTML = `<div class="hist-batch-empty">${histEsc(t('hist.batchEmptyHistory'))}</div>`;
    return;
  }
  const openId = currentOpenBatchId || (clAnalyze && clAnalyze.batchId) || '';
  box.innerHTML = rows.map(r => {
    const bid = r.batch_id || '';
    const meta = clSessionMeta[bid] || {};
    const name = r.file_name || meta.file_name || batchLabelText(bid);
    const when = histEsc(fmtDateTime(r.created_at || meta.created_at) || r.created_at || meta.created_at || '');
    const prog = clSessionProgress(r);
    const network = meta.network || '';
    const pct = prog.total ? Math.max(2, Math.round((prog.looked / prog.total) * 100)) : 0;
    const open = `openCallLogSession('${histJsSafe(bid)}')`;
    // Thông số dạng chip "icon + số". Nhãn nằm trong tooltip để dòng không bị dài;
    // chip tự xuống dòng theo bề rộng panel (flex-wrap), giá trị không bị cắt.
    const stats = [
      network ? { ico: 'fa-signal', label: 'hist.statNetwork', val: histEsc(network) } : null,
      prog.rowCount ? { ico: 'fa-list-ol', label: 'hist.statRows', val: fmtNum(prog.rowCount) } : null,
      prog.total ? { ico: 'fa-table-cells', label: 'hist.statCells', val: fmtNum(prog.total) } : null,
      prog.found ? { ico: 'fa-map-pin', label: 'hist.statCoords', val: fmtNum(prog.found), cls: 'found' } : null,
      prog.pending ? { ico: 'fa-hourglass-half', label: 'hist.statPending', val: fmtNum(prog.pending), cls: 'pend' } : null
    ].filter(Boolean);
    const statsHtml = stats.map(s =>
      `<span class="hs-stat${s.cls ? ' ' + s.cls : ''}" title="${histEsc(t(s.label))}: ${s.val}">`
      + `<i class="fas ${s.ico}"></i><span class="hs-stat-v">${s.val}</span>`
      + `</span>`).join('');
    // Trạng thái tổng của phiên: 1 nhãn duy nhất thay vì 2 con số rời (đã tra / chưa tra).
    let stateChip = '';
    if (prog.total) {
      const done = prog.pending === 0;
      stateChip = `<span class="hs-state ${done ? 'done' : 'part'}" title="${histEsc(fmtTpl('hist.batchProgress', { l: prog.looked, t: prog.total }))}">`
        + `<i class="fas ${done ? 'fa-circle-check' : 'fa-hourglass-half'}"></i>`
        + `${histEsc(done ? t('hist.stateDone') : fmtTpl('hist.batchPendingShort', { n: fmtNum(prog.pending) }))}`
        + `</span>`;
    }
    // Bấm vào card = mở bảng cell của phiên, GIỐNG HỆT nút mở bảng (openCallLogSession)
    // — trước đây card gọi histOpenBatchOnMap (chỉ vẽ marker lên bản đồ), không mở bảng.
    return `<div class="hist-session${bid === openId ? ' is-open' : ''}" data-batch="${histEsc(bid)}"
        title="${histEsc(t('hist.openSession'))}" onclick="${open}">
      <div class="hs-main">
        <div class="hist-session-hd">
          <i class="fas fa-file-excel"></i>
          <b title="${histEsc(name)}">${histEsc(name)}</b>
        </div>
        <div class="hist-session-info">
          <span class="hist-session-when" title="${when}"><i class="fas fa-clock"></i>${when}</span>
          <span class="hist-session-stats">${statsHtml}</span>
        </div>
        <div class="hist-session-note">
          ${stateChip}
          ${prog.total
            ? `<span class="hist-session-prog">`
              + `<span class="hist-session-bar" title="${histEsc(fmtTpl('hist.batchProgress', { l: fmtNum(prog.looked), t: fmtNum(prog.total) }))}">`
              + `<span style="width:${pct}%"></span></span>`
              + `<span class="hist-session-prog-txt">${pct}%</span></span>`
            : ''}
        </div>
      </div>
      <div class="hist-session-acts" onclick="event.stopPropagation()">
        <button class="btn btn-sm hist-session-open" title="${histEsc(t('hist.clSessionView'))}"
                onclick="${open}"><i class="fas fa-table-list"></i></button>
        <button class="btn btn-sm btn-danger hist-session-open" title="${histEsc(t('hist.clSessionDelete'))}"
                onclick="deleteCallLogSession('${histJsSafe(bid)}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
  }).join('') + (histBatch.totalPages > 1
    ? `<div class="hist-batch-pager">
        <button ${histBatch.page <= 1 ? 'disabled' : ''} onclick="histBatchPage(-1)"><i class="fas fa-chevron-left"></i></button>
        <span>${histBatch.page} / ${histBatch.totalPages}</span>
        <button ${histBatch.page >= histBatch.totalPages ? 'disabled' : ''} onclick="histBatchPage(1)"><i class="fas fa-chevron-right"></i></button>
      </div>`
    : '');
}

function histBatchPage(delta) {
  const next = histBatch.page + delta;
  if (next < 1 || next > histBatch.totalPages) return;
  loadHistBatches(next);
}

// Mở lại 1 lần tra hàng loạt trong Lịch sử → bảng cell (không trừ điểm; cell đã
// trả phí hiện sẵn toạ độ, cell chưa tra bấm "Tra cứu" để tra tiếp).
// Giữ tên cũ cho client/test cũ; đi CÙNG một đường với nút trên card.
async function openHistBatchInTable(batchId, fileName) {
  if (fileName) {
    // Tên file từ card → giữ để tiêu đề bảng cell đúng cả khi metadata thiếu.
    clSessionMeta[batchId] = Object.assign({}, clSessionMeta[batchId] || {}, { file_name: fileName, batch_id: batchId });
  }
  await openCallLogSession(batchId);
}

// Cell đã có trong CSDL NỘI BỘ (server trả localLat/localLon lúc analyze) → hiện
// toạ độ ngay trên bảng, KHÔNG trừ điểm, không phải chờ bấm "Tra cứu". Trạng thái
// `local` khác `found` (chưa trả phí) nên vẫn được gửi đi ở lần tra để server trừ
// điểm đúng như cũ.
function clApplyLocalHints(an) {
  if (!an || !Array.isArray(an.rows)) return;
  for (const c of an.rows) {
    if (c.localLat == null || c.localLon == null) continue;
    if (an.results[c.key] && an.results[c.key].state === 'found') continue;
    an.results[c.key] = {
      state: 'local', lat: Number(c.localLat), lon: Number(c.localLon),
      range: c.localRange != null ? c.localRange : null,
      radio: c.radio || '', source: 'local', sourceLabel: SOURCE_LABELS.local || 'CSDL'
    };
    c.lat = Number(c.localLat);
    c.lng = Number(c.localLon);
  }
}

// Date-filter của tab con cũ đã bỏ cùng tab đó; giữ hàm rỗng để code cũ gọi không lỗi.
function syncHistBatchDateClear() { /* tab con "batch" đã bỏ */ }

// ============================================
// Call Logs data
// ============================================
let cellMarkers = [];
let lookupCircle = null;
let lookupCenterMarker = null;

async function apiRequest(method, path, body) {
  // Khách không có token: đừng gọi API cần đăng nhập (tránh vòng lặp 401 → /login).
  if (window.__guestMode && !Auth.getToken()) {
    const err = new Error('Cần đăng nhập để dùng tính năng này.');
    err.code = 401;
    err.guestBlocked = true;
    throw err;
  }
  const token = Auth.getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(path, opts);
  const ct = r.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const body = await r.text().catch(() => '');
    const err = new Error(`Máy chủ trả về ${r.status} không phải JSON (${ct || 'không có content-type'}) cho ${path}`);
    err.code = r.status;
    err.bodySnippet = body.slice(0, 200);
    if (r.status === 401 && typeof Auth !== 'undefined' && Auth.clearSession) Auth.clearSession();
    throw err;
  }
  const data = await r.json();
  if (r.status === 402) {
    // Hết điểm — báo rõ và cập nhật badge, không ném lỗi chung chung.
    if (typeof Auth !== 'undefined' && Auth.setCreditBalance) Auth.setCreditBalance(data.balance);
    const err = new Error(data.error || 'Không đủ điểm');
    err.code = 402;
    err.balance = data.balance;
    err.required = data.required;
    throw err;
  }
  if (!r.ok) throw new Error(data.error || 'Request failed');
  if (data && data.credit && typeof Auth !== 'undefined' && Auth.setCreditBalance) {
    Auth.setCreditBalance(data.credit.balance);
  }
  return data;
}

const colorMap = { CALL_IN: '#22aa44', CALL_OUT: '#dd3333', SMS_IN: '#22aa44', SMS_OUT: '#dd3333' };
const actionLabel = { CALL_IN: 'Gọi đến', CALL_OUT: 'Gọi đi', SMS_IN: 'SMS đến', SMS_OUT: 'SMS đi' };
// Nhãn nguồn dữ liệu — dùng chung cho tra đơn lẻ + popup marker rút list.
const SOURCE_LABELS = { local: 'CSDL nội bộ', opencellid: 'OpenCellID (online)', opencellid_web: 'OpenCellID web (online)', t0stbrot: 't0stbrot (online)', combain: 'Combain (online)' };

// Dòng bản ghi đang hiển thị ở tab "Tra cứu danh sách" (khoá → record) — để bấm 1 dòng
// là mở popup CHI TIẾT trên bản đồ, không phải nhồi tham số vào onclick.
let clRecordRows = {};

// Bấm 1 dòng bản ghi → tô sáng cell trên bản đồ kèm popup chi tiết giống tra theo
// danh sách: MCC-MNC-LAC-CellID, eNB/sector/ECI, công nghệ, nguồn, bán kính, toạ độ,
// địa chỉ cell + các lần gọi/SMS của cell đó trong phiên.
function openClRecordOnMap(key) {
  const l = clRecordRows[key];
  if (!l || l.lat == null || l.lon == null) return;
  const showSource = (typeof Auth !== 'undefined' && Auth.isAdmin && Auth.isAdmin());
  const srcType = l.source === 'local' ? 'local' : 'online';
  const label = `${l.mcc || ''}-${l.mnc || ''}-${l.lac || ''}-${l.cellid || ''}`;
  // Các bản ghi khác cùng cell trong phiên → dòng thời gian ngắn như popup marker.
  const same = (myLogsCache || []).filter(x => x.mcc === l.mcc && x.mnc === l.mnc
    && x.lac === l.lac && String(x.cellid) === String(l.cellid));
  // Phiên mở từ Lịch sử chỉ nạp 1 dòng/cell (myLogsCache không có từng cuộc gọi) —
  // nhưng bảng cell biết TỔNG số dòng của cell qua `rowCount`. Dùng số đó để báo
  // "N bản ghi" và nhắc xem bảng, thay vì im lặng hiện đúng 1 dòng.
  const clCell = (clAnalyze && Array.isArray(clAnalyze.rows) && l.cellid)
    ? clAnalyze.rows.find(c => c.key && c.key === canonicalClientKey(l))
    : null;
  const totalRows = Math.max(same.length, Number((clCell && clCell.rowCount) || l._rowCount || 0));
  const lineItems = same.slice(0, 50).map(g => {
    const ts = fmtDateTime(g.timestamp);
    return `<div class="cell-pop-log">${histEsc(ts)} <span class="cell-pop-act">[${histEsc(actionLabel[g.action_type] || g.action_type || '')}]</span> ${histEsc(g.partner_number || g.contact_number || '')}</div>`;
  }).join('');
  // Chỉ nhồi tối đa 50 dòng vào DOM; còn lại báo tổng số để user tự lọc bảng.
  const more = totalRows > same.length
    ? `<div class="cell-pop-more">${fmtTpl('map.moreLogs', { n: (totalRows - same.length).toLocaleString('vi-VN') })}</div>`
    : '';
  const extra = totalRows
    ? `<div class="cell-pop-logs-hd">${histEsc(t('upload.records'))}: ${totalRows.toLocaleString('vi-VN')}</div>`
      + lineItems + more
    : '';
  highlightCellOnMap(l.lat, l.lon, l.cell_range || l.range, l.radio, label, {
    mcc: l.mcc, mnc: l.mnc, lac: l.lac, cellid: l.cellid,
    cellLine: formatCellId(l.cellid, l.enb_id, l.sector),
    radio: l.radio,
    sourceLabel: SOURCE_LABELS[l.source] || (l.source || ''),
    srcType: srcType, showSource: showSource,
    description: l.cell_address || '',
    extra: extra
  });
}

function getCellColor(type) {
  return colorMap[type] || '#888';
}

// Cờ hoãn vẽ bản đồ: khi nạp Excel xong, KHÔNG vẽ kết quả tra lên bản đồ cho tới
// khi user bấm "Đồng ý tra cứu". Tránh lộ kết quả (đã tốn điểm) trước khi xác nhận.
let clMapDeferred = false;

// Popup marker dùng CHUNG cho tra đơn lẻ (showCellOnMap) và tra rút list (plotCallLogs)
// — cùng định dạng tiêu đề/nguồn/bán kính/toạ độ như tra đơn lẻ.
// opts: { lat, lon, range, mcc, mnc, lac, cellid, cellLine, radio,
//         sourceLabel, srcType, showSource, description, extra }
function buildCellPopupHtml(opts) {
  const lat = parseFloat(opts.lat);
  const lon = parseFloat(opts.lon);
  const range = parseFloat(opts.range || 500) || 500;
  const cp = cellPopupTitle(opts.mcc, opts.mnc, opts.lac, opts.cellid);
  return `<div class="cell-pop">` +
    `<div class="cell-pop-hd">` +
    `<b>${histEsc(cp.text)}</b><br>` +
    `${histEsc(opts.cellLine || '')}` +
    radioPopupLine(opts.radio) + '<br>' +
    `${t('hist.range')}: ${histEsc(range)}m<br>` +
    `${t('hist.result')}: ${lat}, ${lon} ${coordActionIcons(lat, lon)}` +
    (opts.description ? `<br>${histEsc(opts.description)}` : '') +
    `</div>` +
    // Phần danh sách bản ghi trùng cell có thể RẤT dài (hàng trăm cuộc gọi) →
    // tách vào vùng cuộn riêng, giới hạn chiều cao để popup không tràn khỏi bản đồ.
    (opts.extra ? `<div class="cell-pop-logs">${opts.extra}</div>` : '') +
    `</div>`;
}

// Cell chỉ được xem/hiển thị khi đã trả phí trong phiên (`_charged`) hoặc mở lại
// từ Lịch sử (`_fromHistory`). Cell có sẵn toạ độ trong CSDL nội bộ mà chưa trả phí
// vẫn phải bị chặn — luật: "tra ra kết quả là trừ điểm".
function canViewRecord(r) {
  return !!(r && r.lat && r.lon && (r._charged || r._fromHistory));
}

function plotCallLogs(records) {
  cellMarkers.forEach(m => cellOverlay.removeLayer(m));
  cellMarkers = [];
  if (lookupCircle) { cellOverlay.removeLayer(lookupCircle); lookupCircle = null; }
  if (lookupCenterMarker) { cellOverlay.removeLayer(lookupCenterMarker); lookupCenterMarker = null; }
  clearHighlight();
  if (measureState.active) setMeasureMode(false);
  logShapeGroup.clearLayers();

  // Chờ user xác nhận tra → chưa vẽ gì lên bản đồ (kể cả cell đã có toạ độ).
  if (clMapDeferred) return;

  const cellGroups = {};
  records.forEach(r => {
    const key = r.mcc + '-' + r.mnc + '-' + r.lac + '-' + r.cellid;
    if (!cellGroups[key]) cellGroups[key] = [];
    cellGroups[key].push(r);
  });

  Object.keys(cellGroups).forEach(key => {
    const group = cellGroups[key];
    const r = group[0];

    // CHỈ vẽ cell đã có quyền xem (đã trả phí trong phiên / mở từ Lịch sử).
    if (!group.some(canViewRecord)) return;

    if (r.lat && r.lon) {
      const lat = parseFloat(r.lat);
      const lon = parseFloat(r.lon);
      if (isNaN(lat) || isNaN(lon)) return;
      const range = parseFloat(r.range || r.cell_range || 0);
      // Màu vòng tròn = màu RAT (2G/3G/4G/5G…) giống marker tra đơn lẻ + tra hàng loạt.
      // Trước đây tô theo action_type nên cell rút list (action_type rỗng) luôn xám '#888'.
      const rs = radioStyle(r.radio);
      const color = rs.key ? rs.color : getCellColor(group[0].action_type);
      const radius = range > 0 ? range : 500;
      const circle = L.circle([lat, lon], {
        radius: radius,
        color: color,
        fillColor: color,
        fillOpacity: 0.15,
        weight: 2,
        opacity: 0.6
      });
      cellOverlay.addLayer(circle);
      const lineItems = group.slice(0, 50).map(g => {
        const ts = fmtDateTime(g.timestamp);
        return `<div class="cell-pop-log">${histEsc(ts)} <span class="cell-pop-act">[${histEsc(actionLabel[g.action_type] || g.action_type || '')}]</span> ${histEsc(g.partner_number || g.contact_number || '')}</div>`;
      }).join('');
      const showSource = (typeof Auth !== 'undefined' && Auth.isAdmin && Auth.isAdmin());
      const srcType = r.source === 'local' ? 'local' : 'online';
      const sourceLabel = SOURCE_LABELS[r.source] || (r.source || '');
      // Chỉ nhồi tối đa 50 dòng vào DOM; còn lại báo tổng số để user tự lọc bảng.
      const more = group.length > 50
        ? `<div class="cell-pop-more">… ${fmtTpl('map.moreLogs', { n: (group.length - 50).toLocaleString('vi-VN') })}</div>`
        : '';
      const extra = `<div class="cell-pop-logs-hd">${histEsc(t('upload.records'))}: ${group.length.toLocaleString('vi-VN')}</div>`
        + lineItems + more;
      circle.bindPopup(buildCellPopupHtml({
        lat, lon, range: radius, mcc: r.mcc, mnc: r.mnc, lac: r.lac, cellid: r.cellid,
        cellLine: formatCellId(r.cellid, r.enb_id, r.sector),
        radio: r.radio, sourceLabel, srcType, showSource,
        description: r.cell_address || '', extra
      }));
      cellMarkers.push(circle);
    }
  });

  if (cellMarkers.length > 0) {
    const group = L.featureGroup(cellMarkers);
    // Căn theo vùng không bị sidebar che (trước đây cell nằm nấp sau panel).
    fitBoundsVisible(group.getBounds().pad(0.1));
  }
}

// ============================================
// Cell lookup (local first, then OpenCellID online, save to DB)
// ============================================
// Enter trong 4 ô (MCC/MNC/LAC/CellID) → tự tra cứu khi đã nhập đủ
function cellLookupEnter(e) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const mcc = (document.getElementById('cellMcc').value || '').trim();
  const mnc = (document.getElementById('cellMnc').value || '').trim();
  const lac = (document.getElementById('cellLac').value || '').trim();
  const cellid = (document.getElementById('cellCellid').value || '').trim();
  if (mcc && mnc && lac && cellid) lookupCell();
}

// ============================================
// Hiển thị 1 cell trên bản đồ (dùng chung cho tra đơn lẻ + lịch sử)
// ============================================
// opts: { lat, lon, range, color, mcc, mnc, lac, cellid, cellLine, radio,
//         sourceLabel, srcType, showSource, description }
function showCellOnMap(opts) {
  const lat = parseFloat(opts.lat);
  const lon = parseFloat(opts.lon);
  if (!isFinite(lat) || !isFinite(lon)) return;
  const range = parseFloat(opts.range || 500) || 500;
  const rs = radioStyle(opts.radio);
  // Màu vòng: theo RAT khi biết, ngược lại giữ màu theo nguồn (đỏ = nội bộ).
  const color = rs.key ? rs.color : (opts.color || '#22aa44');
  const popupText = buildCellPopupHtml(Object.assign({}, opts, { range: range }));

  if (lookupCircle) { cellOverlay.removeLayer(lookupCircle); lookupCircle = null; }
  if (lookupCenterMarker) { cellOverlay.removeLayer(lookupCenterMarker); lookupCenterMarker = null; }
  centerOnVisible(lat, lon, 15);
  lookupCircle = L.circle([lat, lon], {
    radius: range, color: color, fillOpacity: 0.1, weight: 2
  }).bindPopup(popupText);
  cellOverlay.addLayer(lookupCircle);
  lookupCenterMarker = L.marker([lat, lon], { icon: makeCellDivIcon(rs) })
    .bindPopup(popupText);
  cellOverlay.addLayer(lookupCenterMarker);
  lookupCenterMarker.openPopup();
}

async function lookupCell(mccArg, mncArg, lacArg, cellidArg) {
  const mcc = (mccArg != null && mccArg !== '') ? mccArg : document.getElementById('cellMcc').value;
  const mnc = (mncArg != null && mncArg !== '') ? mncArg : document.getElementById('cellMnc').value;
  const lac = (lacArg != null && lacArg !== '') ? lacArg : document.getElementById('cellLac').value;
  const cellid = (cellidArg != null && cellidArg !== '') ? cellidArg : document.getElementById('cellCellid').value;
  const sectorEl = document.getElementById('cellSector');
  const sector = sectorEl ? sectorEl.value : '';
  const radioEl = document.getElementById('cellRadio');
  const radio = radioEl ? radioEl.value : '';
  const resultEl = document.getElementById('cellLookupResult');

  if (!mcc || !mnc || !lac || !cellid) {
    resultEl.className = 'cell-lookup-result show error';
    resultEl.textContent = 'Nhập đủ MCC, MNC, LAC, CellID';
    return;
  }

  // Khách: chỉ 1 lượt tra cứu thử với CSDL nội bộ, rồi mời đăng ký.
  if (window.__guestMode) return guestLookup(mcc, mnc, lac, cellid, sector, radio);

  resultEl.className = 'cell-lookup-result show';
  resultEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tra cứu...';

  // Send the raw cell ID (short or long) + optional sector + optional RAT hint.
  // The server probes the raw value first, then its ECI form — so both short and
  // long inputs work.
  try {
    const sectorParam = (sector !== '' && sector != null) ? `&sector=${encodeURIComponent(sector)}` : '';
    const radioParam = (radio !== '' && radio != null) ? `&radio=${encodeURIComponent(radio)}` : '';
    const result = await apiRequest('GET', `/api/cells/resolve?mcc=${mcc}&mnc=${mnc}&lac=${lac}&cellid=${encodeURIComponent(cellid)}${sectorParam}${radioParam}`);
    resultEl.className = 'cell-lookup-result show success';
    const d = result.data;
    const showSource = (typeof Auth !== 'undefined' && Auth.isAdmin && Auth.isAdmin());
    const sourceLabel = SOURCE_LABELS[result.source] || (result.source || 'Không rõ');
    const srcType = result.source === 'local' ? 'local' : 'online';
    const dLat = parseFloat(d.lat);
    const dLon = parseFloat(d.lon);
    const dCell = `${d.mcc || mcc}-${d.mnc || mnc}-${d.lac || lac}-${d.cellid || cellid}`;
    const rs = radioStyle(d.radio);
    const warnUncertain = (result.radioConfident === false);
    resultEl.innerHTML =
      `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px">` +
        `<i class="fas fa-check-circle"></i>` +
        `<span class="hist-cell">${dCell}</span>` +
        (rs.key ? `<span class="hist-radio-badge" style="background:${rs.color}" title="${histEsc(t('hist.radio'))}">${histEsc(rs.full || rs.label)}</span>` : '') +
      `</div>` +
      `<div style="font-size:11px">${formatCellId(d.cellid || cellid, sector)}</div>` +
      `<div class="hist-coords" style="margin-top:4px">` +
        `<i class="fas fa-map-pin"></i>${dLat}, ${dLon} ` +
        coordActionIcons(dLat, dLon) +
      `</div>` +
      `<div style="font-size:11px;margin-top:3px">Bán kính: <b>${d.range}m</b></div>` +
      (warnUncertain ? `<div style="font-size:11px;margin-top:4px;color:#c98a1e"><i class="fas fa-triangle-exclamation"></i> ${t('cells.radioWarn')}</div>` : '') +
      (d.description ? `<div style="font-size:11px;margin-top:3px;color:var(--text-muted)">${d.description}</div>` : '');

    const cellLine = formatCellId(d.cellid || cellid, sector);
    const range = parseFloat(d.range || 500);
    const color = result.source === 'local' ? '#ff4444' : '#22aa44';
    showCellOnMap({
      lat: dLat, lon: dLon, range: range, color: color,
      mcc: d.mcc || mcc, mnc: d.mnc || mnc, lac: d.lac || lac, cellid: d.cellid || cellid,
      cellLine: cellLine, radio: d.radio,
      sourceLabel: sourceLabel, srcType: srcType,
      showSource: showSource, description: d.description || ''
    });
  } catch (e) {
    resultEl.className = 'cell-lookup-result show error';
    const msg = (e && e.message) ? e.message : '';
    if (e && e.code === 402) {
      // Hết điểm tra cứu — dẫn user sang trang nạp/lịch sử điểm.
      resultEl.innerHTML = '<i class="fas fa-gem"></i> ' + msg +
        ` (còn ${e.balance != null ? e.balance : 0}, cần ${e.required != null ? e.required : 1})` +
        ' — <a href="/credits.html" style="color:inherit;text-decoration:underline">Xem điểm</a>';
    } else if (msg.indexOf('Chưa cấu hình') !== -1) {
      resultEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> ' + msg;
    } else {
      resultEl.innerHTML = '<i class="fas fa-times-circle"></i> Không tìm thấy cell trong CSDL nội bộ và OpenCellID.org.';
    }
  }
}

async function searchCells() {
  const input = document.getElementById('cellSearch');
  const list = document.getElementById('cellList');
  const raw = (input.value || '').trim();

  // Ô trống → lấy giá trị từ form Tra Cứu Cell ID phía trên
  if (!raw) {
    const mcc = document.getElementById('cellMcc').value;
    const mnc = document.getElementById('cellMnc').value;
    const lac = document.getElementById('cellLac').value;
    const cellid = document.getElementById('cellCellid').value;
    if (!mcc && !mnc && !lac && !cellid) {
      list.innerHTML = '<span data-i18n="cells.typeToSearch">Gõ để tìm kiếm...</span>';
      applyI18n();
      return;
    }
    await lookupCell(mcc, mnc, lac, cellid);
    list.innerHTML = `<span style="color:var(--text-faint)">Đã tra cứu ${mcc}-${mnc}-${lac}-${cellid}</span>`;
    return;
  }

  // Nhập 4 giá trị cùng dòng, phân tách bằng '-' hoặc dấu phẩy (hoặc khoảng trắng)
  // → tra cứu + hiển thị bản đồ. Cú pháp chuẩn: MCC-MNC-LAC-CELLID.
  const parts = raw.split(/[,\-\s]+/).filter(Boolean);
  if (parts.length === 4) {
    await lookupCell(parts[0], parts[1], parts[2], parts[3]);
    list.innerHTML = `<span style="color:var(--text-faint)">Đã tra cứu ${parts.join('-')}</span>`;
    return;
  }

  // Ít hơn 4 phần → tìm kiếm dạng danh sách theo từ khóa
  if (raw.length < 2) {
    list.innerHTML = '<span data-i18n="cells.typeToSearch">Gõ để tìm kiếm...</span>';
    applyI18n();
    return;
  }
  try {
    const resp = await apiRequest('GET', `/api/cells/search?q=${encodeURIComponent(raw)}`);
    const cells = resp.data || [];
    // Giữ dữ liệu cell để bấm dòng nào thì dựng popup CHI TIẾT cho cell đó (giống tra
    // theo danh sách), không chỉ hiện mỗi nhãn MCC-MNC-LAC-CellID.
    cellSearchRows = {};
    list.innerHTML = cells.length === 0 ? '<span style="color:var(--text-faint)">No results</span>' :
      cells.slice(0, 20).map(c => {
        const label = `${c.mcc}-${c.mnc}-${c.lac}-${c.cellid}`;
        const hasCoord = c.lat && c.lon;
        cellSearchRows[label] = c;
        const click = hasCoord
          ? `onclick="openCellSearchResult('${histJsSafe(label)}')"`
          : '';
        return `<div ${click} style="padding:3px 0;${hasCoord ? 'cursor:pointer;' : 'opacity:0.6;'}color:var(--text-secondary);border-bottom:1px solid var(--border-color);font-size:11px">${label} <span style="color:var(--text-faint)">${c.lat}, ${c.lon}</span></div>`;
      }).join('');
  } catch (e) {
    list.innerHTML = 'Error';
  }
}

// Bấm 1 dòng ở kết quả tìm kiếm cell → tô sáng trên bản đồ KÈM popup chi tiết
// (nguồn, công nghệ, bán kính, toạ độ, địa chỉ) giống tra theo danh sách.
let cellSearchRows = {};
function openCellSearchResult(key) {
  const c = cellSearchRows[key];
  if (!c) return;
  const showSource = (typeof Auth !== 'undefined' && Auth.isAdmin && Auth.isAdmin());
  const srcType = c.source === 'local' ? 'local' : 'online';
  highlightCellOnMap(c.lat, c.lon, c.range || c.cell_range, c.radio, key, {
    mcc: c.mcc, mnc: c.mnc, lac: c.lac, cellid: c.cellid,
    cellLine: formatCellId(c.cellid, c.sector),
    radio: c.radio,
    sourceLabel: SOURCE_LABELS[c.source] || (c.source || ''),
    srcType: srcType, showSource: showSource,
    description: c.cell_address || ''
  });
}

// ============================================
// Annotation save/load
// ============================================
async function saveAnnotation(type, geojson, label, distance) {
  try {
    const res = await apiRequest('POST', '/api/annotations', { type, geojson, label: label || type, distance: distance || 0 });
    return res && res.id ? res.id : null;
  } catch (e) {
    console.error('Save annotation error:', e);
    return null;
  }
}

// Gắn id server vào layer để sửa/xoá về sau (EDITED/DELETED handlers).
async function saveAnnotationForLayer(layer, type, geojson, label, distance) {
  const id = await saveAnnotation(type, geojson, label, distance);
  if (id && layer) layer._annotationId = id;
  return id;
}

// Xoá 1 annotation trên server; trả true nếu thành công.
async function deleteAnnotation(id) {
  if (!id) return false;
  try {
    await apiRequest('DELETE', '/api/annotations/' + id);
    return true;
  } catch (e) {
    console.error('Delete annotation error:', e);
    return false;
  }
}

const ANNOTATION_STYLE = { color: '#6666ff', weight: 2, opacity: 0.7, fillOpacity: 0.1 };

function annotationStyle(feature) {
  const g = feature && feature.geometry;
  if (g && (g.type === 'LineString' || g.type === 'MultiLineString')) {
    return { color: '#facc15', weight: 3, opacity: 0.9 };
  }
  return ANNOTATION_STYLE;
}

function bindAnnotationLabel(layer, a) {
  if (a.type === 'polyline' && a.distance) {
    layer.bindTooltip(fmtDistance(a.distance), { permanent: true, direction: 'center', className: 'measure-tip' });
  }
}

async function loadAnnotations() {
  try {
    const annotations = await apiRequest('GET', '/api/annotations');
    if (!annotations || annotations.length === 0) return;
    annotations.forEach(a => {
      try {
        const layer = L.geoJSON(a.geojson, { style: annotationStyle });
        layer.eachLayer(l => {
          l._annotationId = a.id;
          l._annotationLabel = a.label;
          l._annotationDistance = a.distance;
          bindAnnotationLabel(l, a);
          drawnItems.addLayer(l);
        });
      } catch (e) {}
    });
  } catch (e) {
    console.error('Load annotations error:', e);
  }
}

// ============================================
// Popup full-window: bảng CELL sau khi nạp Excel (đọc-only → tra theo lựa chọn)
// ============================================
// clAnalyze: { fileName, network, totalRows, rows[], sort:{key,dir}, selected:Set<key>, results:{key:obj},
//             batchId, uploadId, roundsDone, limit, mapShown, summary:{total,found,miss,unpaid} }
// `uploadId` BỀN VỮNG theo nội dung lô (cùng file/cùng phiên ⇒ cùng uploadId ⇒ cùng
// bút toán `batchId:rN`), nhờ vậy bấm "Tra cứu" lần 2 không bị trừ điểm lần nữa.
let clAnalyze = null;
// Số dòng vẽ mỗi lần (bảng rất dài → "Xem thêm" nới thêm từng đợt).
const CL_TBL_PAGE = 300;

// `col`: class <col> (giữ bề rộng tối thiểu ở CSS) — sinh <colgroup> từ đây để thêm
// bớt cột/sửa bề rộng chỉ phải sửa 1 chỗ, không lệch giữa head và colgroup.
// Thứ tự hiển thị cố định: cột "#" luôn là STT theo thứ tự đang hiển thị nên KHÔNG
// sort theo nó (sort theo idx chỉ đảo ngược danh sách — đã có nút đảo ở cột khác).
const CL_TBL_COLS = [
  { key: 'idx', label: '#', sortable: false, cls: 'cl-tbl-num', col: 'cl-col-idx' },
  { key: 'cell', label: 'calllogs.colCell', sortable: true, cls: 'cl-tbl-cell', col: 'cl-col-cell' },
  { key: 'sector', label: 'calllogs.colSector', sortable: true, col: 'cl-col-sec' },
  { key: 'rowCount', label: 'calllogs.colRows', sortable: true, cls: 'cl-tbl-num', col: 'cl-col-rows' },
  { key: 'radio', label: 'calllogs.colRadio', sortable: true, col: 'cl-col-radio' },
  { key: 'time', label: 'calllogs.colTime', sortable: true, col: 'cl-col-time' },
  { key: 'address', label: 'calllogs.colAddress', sortable: true, col: 'cl-col-addr' },
  { key: 'loc', label: 'calllogs.colLoc', sortable: true, cls: 'cl-tbl-loc', col: 'cl-col-loc' },
  { key: 'status', label: 'calllogs.colStatus', sortable: true, col: 'cl-col-status' }
];

// Bề rộng cột do user kéo tay: { [chỉ số cột]: px }. Rỗng = dùng bề rộng mặc định
// khai báo ở CSS (.cl-tbl .cl-col-*).
let clColWidths = {};

// Bắt đầu kéo dãn cột: đo bề rộng hiện tại rồi cập nhật <col> theo con trỏ.
// Dùng document listener (không phải pointer capture) để kéo ra ngoài bảng vẫn mượt.
function clStartColResize(ev, idx) {
  ev.preventDefault();
  ev.stopPropagation();
  const colgroup = document.getElementById('clTableCols');
  const col = colgroup && colgroup.children[idx];
  if (!col) return;
  const grip = ev.currentTarget;
  const startX = ev.clientX;
  const startW = col.getBoundingClientRect().width;
  grip.classList.add('dragging');
  document.body.classList.add('cl-col-resizing');

  const move = (e) => {
    // Tối thiểu 44px để tiêu đề còn đọc được.
    const w = Math.max(44, Math.round(startW + (e.clientX - startX)));
    clColWidths[idx] = w;
    col.style.width = w + 'px';
  };
  const up = () => {
    grip.classList.remove('dragging');
    document.body.classList.remove('cl-col-resizing');
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
    // Bề rộng mới phải vào <colgroup> để giữ nguyên khi bảng vẽ lại (sort/lọc/thêm dòng).
    renderClTable();
  };
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
}

// Hash nội dung 32-bit (djb2) → đuôi uploadId ổn định giữa các lần bấm/F5.
function clHash(str) {
  let h = 5381;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// uploadId của 1 lô = hash(tên file | số dòng | danh sách cell đã sort).
// Cùng dữ liệu ⇒ cùng uploadId kể cả sau F5 → server dedup theo batch (không trừ
// điểm lần 2). Khác file ⇒ khác uploadId ⇒ lịch sử vẫn tách nhóm đúng.
function clBatchUploadId(fileName, cells) {
  const keys = (cells || []).map(c => `${c.mcc}-${c.mnc}-${c.lac}-${c.cellid}`).sort();
  return 'cl' + clHash([fileName || '', keys.length, keys.join(',')].join('|'));
}

// Dựng clAnalyze từ server (analyze / cells của phiên / cells của lịch sử).
// `src`: { cells[], fileName, network, totalRows, batchId }
//   cells[].state: 'found' | 'miss' | 'unpaid' (analyze chưa tra → không có state).
// Mỗi cell → results[key] = { state, lat, lon, range, radio, source, sourceLabel }.
// Nhờ vậy bảng, bộ đếm và bản đồ dùng CHUNG một nguồn số.
function clCellsFromSource(src, opts) {
  const o = opts || {};
  const rows = Array.isArray(src && src.cells) ? src.cells : [];
  // `key` chuẩn (mcc-mnc-lac-ECI) để 1 physical cell không bị nhân đôi khi mở lại
  // phiên (short-cellid vs ECI trong dữ liệu gốc).
  for (const c of rows) {
    if (!c.key) c.key = canonicalClientKey(c);
    else c.key = canonicalClientKey(keyToCell(c.key));
  }
  // Toạ độ đã trả phí lưu ở phiên (resolved_cells) là NGUỒN SỰ THẬT: server có thể
  // báo `unpaid` (lookup_history không còn / chưa kịp ghi) nhưng cell đã trả phí rồi
  // → ghép lại thành `found`, không hiện "chưa tra" và không trả phí lần 2.
  const resolved = Array.isArray(src && src.resolvedCells) ? src.resolvedCells : [];
  const savedByKey = new Map();
  for (const r of resolved) {
    if (!r || r.lat == null || r.lng == null) continue;
    savedByKey.set(canonicalClientKey(r), r);
  }
  if (savedByKey.size) {
    for (const c of rows) {
      const hit = savedByKey.get(canonicalClientKey(c));
      if (!hit) continue;
      if (c.state !== 'found') {
        c.state = 'found';
        c.lat = hit.lat; c.lng = hit.lng;
        c.range = hit.range != null ? hit.range : null;
        c.source = hit.source || '';
      }
      if (!c.radio && hit.radio) c.radio = hit.radio;
    }
  }
  const results = {};
  for (const c of rows) {
    if (c.state === 'found' && c.lat != null && c.lng != null) {
      results[c.key] = {
        state: 'found', lat: c.lat, lon: c.lng, range: c.range, radio: c.radio,
        source: c.source || '', sourceLabel: SOURCE_LABELS[c.source] || (c.source || '')
      };
    } else if (c.state === 'miss') {
      results[c.key] = { state: 'miss', reason: '' };
    } else if (c.state === 'unpaid') {
      results[c.key] = { state: 'unpaid' };
    }
  }
  clAnalyze = {
    fileName: (src && src.fileName) || o.fileName || '',
    network: (src && src.network) || '',
    totalRows: Number(src && src.totalRows) || 0,
    rows,
    sort: o.sort || { key: 'rowCount', dir: 'desc' },
    selected: new Set(),
    results,
    batchId: (src && src.batchId) || o.batchId || '',
    uploadId: clBatchUploadId((src && src.fileName) || o.fileName || '', rows),
    roundsDone: 0,
    limit: CL_TBL_PAGE,
    mapShown: false
  };
  // Mặc định chọn các cell CHƯA có kết quả (cell đã trả phí không cần tra lại).
  // analyze (chưa tra) không có `state` ⇒ chọn hết như cũ.
  for (const c of rows) {
    const r = results[c.key];
    if (!r || r.state === 'unpaid' || (o.selectUnpaidOnly && r.state !== 'found')) clAnalyze.selected.add(c.key);
  }
  // Lô mới → bộ lọc trạng thái về "Tất cả" (tránh user tưởng mất cell).
  clStatusFilter = 'all';
  return clAnalyze;
}

// Đếm cùng một nguồn số cho bảng/footer/bản đồ/toast: { total, found, miss, unpaid }.
// analyze chưa tra (không có state) → `pending` = số cell chưa tra.
function clCellsSummary() {
  const s = { total: 0, found: 0, miss: 0, unpaid: 0, pending: 0, selected: 0 };
  if (!clAnalyze) return s;
  s.total = clAnalyze.rows.length;
  s.selected = clAnalyze.selected.size;
  for (const c of clAnalyze.rows) {
    const r = clAnalyze.results[c.key];
    if (!r) { s.pending++; continue; }
    if (r.state === 'found') s.found++;
    else if (r.state === 'miss') s.miss++;
    else if (r.state === 'unpaid') s.unpaid++;
    // `local` = toạ độ có sẵn trong CSDL nội bộ (miễn phí, chưa trả phí) → vẫn tính
    // là "chưa tra" để số liệu khớp với điểm sẽ trừ.
    else s.pending++;
  }
  return s;
}

// Chi tiết phiên đang mở để hiện trên card: CHỈ tên file.
// Dòng `.cls-meta` (mạng · số cell · số dòng) đã bỏ theo yêu cầu — số liệu tổng hợp
// đã có ở #clListSummary ngay dưới, hiện thêm ở đây là lặp.
function clSessionDetailHtml() {
  if (!clAnalyze) return '';
  return `<div class="cls-detail">`
    + `<i class="fas fa-file-excel"></i>`
    + `<span class="cls-file" title="${histEsc(clAnalyze.fileName || '')}">${histEsc(clAnalyze.fileName || '—')}</span>`
    + `</div>`;
}

// Hiện/ẩn khối NẠP FILE (chọn mạng + khung upload). Chỉ hiện ở bước đầu — khi chưa có
// danh sách cell của phiên làm việc. Có danh sách → thay bằng card phiên + bảng cell.
// Tổng kết (#clListSummary) nằm TRONG card nên phải cập nhật cùng lúc, không thì
// card hiện mà dòng tổng kết vẫn ẩn (display:none ban đầu trong HTML).
function syncClLoadUi() {
  const has = !!(clAnalyze && Array.isArray(clAnalyze.rows) && clAnalyze.rows.length);
  const up = document.getElementById('clInlineUp');
  const card = document.getElementById('clSessionCard');
  const search = document.getElementById('clRecordsBlock');
  if (up) up.hidden = has;
  if (card) card.hidden = !has;
  // #clRecordsBlock chứa bộ lọc + khoảng ngày → phải LUÔN hiện. Trước đây chỉ gỡ
  // `hidden` khi đã có danh sách cell, nên lúc chưa nạp file cả khối bị display:none
  // và bấm vào ô ngày không có gì xảy ra (phần tử 0×0, không nhận click).
  if (search) search.hidden = false;
  const detail = document.getElementById('clSessionCardDetail');
  if (card && has && detail) detail.innerHTML = clSessionDetailHtml();
  // Card vừa hiện → nạp lại số liệu tổng kết. Không có dữ liệu thì hàm này tự ẩn.
  if (has) updateCallSessionUi(myLogsCache);
}

// Đóng phiên làm việc: bảng cell + danh sách bản ghi về trống, quay lại giao diện nạp
// file ban đầu. Dữ liệu phiên KHÔNG mất — đã lưu ở Lịch sử tra cứu (+ toạ độ đã trả
// phí) nên mở lại từ đó vẫn miễn phí.
function closeClSession() {
  flushCallSessionResolved();        // gửi nốt toạ độ đã trả phí trước khi dọn
  clearCallSession();                // bản sao trong sessionStorage
  clAnalyze = null;
  myLogsCache = [];
  myLogsCache._restored = false;
  currentOpenBatchId = '';
  currentUploadFileName = '';
  const notice = document.getElementById('clCreditNotice');
  if (notice) { notice.style.display = 'none'; notice.innerHTML = ''; }
  closeClTableOverlay();
  syncClLoadUi();
  renderCallLogs();
}

// Mở overlay BẢNG CELL. File nạp ngay ở tab "Tra cứu danh sách" nên overlay chỉ mở khi đã
// có bảng (gọi từ uploadCallLogAnalyze / mở phiên cũ). Chưa có bảng → vẽ lại trạng
// thái rỗng của tab (không mở overlay trắng).
function openClTableOverlay() {
  if (!clAnalyze || !Array.isArray(clAnalyze.rows) || !clAnalyze.rows.length) {
    showToast(t('calllogs.chooseFile'), 'info');
    renderClTable();
    return;
  }
  clSheetStep('table');
  document.getElementById('clTableOverlay')?.classList.add('show');
}

function closeClTableOverlay() {
  // Bấm X ngay sau khi tra xong (trong 800ms debounce) → gửi nốt toạ độ đã trả phí
  // lên phiên trước khi đóng, tránh mất kết quả đã trừ điểm.
  flushCallSessionResolved();
  document.getElementById('clTableOverlay')?.classList.remove('show');
}

// Chuyển overlay giữa 2 bước: busy (đang đọc file) / table (bảng cell).
function clSheetStep(name) {
  const map = { busy: 'clSheetStepBusy', table: 'clSheetStepTable' };
  for (const k of Object.keys(map)) {
    const el = document.getElementById(map[k]);
    if (el) {
      el.hidden = (k !== name);
      if (k === 'table') el.style.display = (k === name) ? 'flex' : 'none';
    }
  }
  const foot = document.getElementById('clSheetFoot');
  if (foot) foot.style.display = (name === 'table') ? '' : 'none';
}

// --- Chọn mạng ở khối nạp file: <select> native + logo thật ------------------
// `logo`: file logo trong public/img/net (SVG; 2 mạng chưa có SVG chuẩn thì dùng PNG).
// `ok: false` = mạng chưa hỗ trợ đọc cell → option bị khoá, vẫn hiện logo trong list.
// Mạng mới = thêm 1 dòng ở đây + 1 file logo.
const CL_NET_OPTIONS = [
  { value: 'auto', name: 'Tự động', logo: '', ok: true,
    hint: 'Tự nhận diện mạng theo nội dung file (khuyên dùng)' },
  { value: 'viettel', name: 'Viettel', logo: 'viettel.svg', ok: true },
  { value: 'mobifone', name: 'Mobifone', logo: 'mobifone.svg', ok: true },
  { value: 'vinaphone', name: 'Vinaphone', logo: 'vinaphone.svg', ok: false },
  { value: 'vietnamobile', name: 'Vietnamobile', logo: 'vietnamobile.png', ok: false },
  { value: 'gmobile', name: 'Gmobile', logo: 'gmobile.png', ok: false }
];
const CL_NET_LOGO_BASE = '/img/net/';
// Mạng đang chọn ở khối nạp file (mặc định 'auto').
let clNetChoice = 'auto';

// HTML logo của 1 mạng; 'auto' không có file → icon tia lửa (màu theo chữ, không
// dùng ảnh nên `logo` rỗng trả `''` và ô hiển thị dùng icon riêng).
function clNetLogoHtml(o, extraCls) {
  if (!o || !o.logo) return '';
  return `<img class="cl-net-logo ${histEsc(extraCls || '')}" src="${CL_NET_LOGO_BASE}${histEsc(o.logo)}"`
    + ` alt="" loading="lazy" decoding="async">`;
}

// Vẽ list chọn mạng + phần hiển thị (logo + tên) của mạng đang chọn.
function renderClNetOptions() {
  const sel = document.getElementById('clNetSelect');
  const face = document.getElementById('clNetFace');
  const cur = CL_NET_OPTIONS.find(o => o.value === clNetChoice) || CL_NET_OPTIONS[0];
  if (sel) {
    sel.innerHTML = CL_NET_OPTIONS.map(o =>
      `<option value="${o.value}"${clNetChoice === o.value ? ' selected' : ''}${o.ok ? '' : ' disabled'}>`
      + `${histEsc(o.ok ? o.name : `${o.name} (${t('calllogs.netSoon')})`)}</option>`
    ).join('');
  }
  if (face) {
    face.innerHTML = (cur.logo
      ? clNetLogoHtml(cur)
      : `<i class="fas fa-wand-magic-sparkles cl-net-auto" aria-hidden="true"></i>`)
      + `<span class="cl-net-name">${histEsc(cur.ok ? cur.name : `${cur.name} (${t('calllogs.netSoon')})`)}</span>`;
  }
  const pick = sel && sel.closest('.cl-net-pick');
  if (pick) pick.title = cur.hint || ('Tra theo dữ liệu ' + cur.name);
}

function setClNetChoice(value) {
  const o = CL_NET_OPTIONS.find(x => x.value === value);
  if (!o || !o.ok) { renderClNetOptions(); return; }   // mạng chưa hỗ trợ → giữ nguyên
  clNetChoice = value;
  renderClNetOptions();
}

// Ô chọn mạng nằm NGAY trong tab (không chỉ trong popup) → vẽ sẵn khi tải trang,
// không phụ thuộc việc mở overlay.
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderClNetOptions);

// Khung popup hướng dẫn DÙNG CHUNG cho tab "Tra cứu danh sách" và "Tra cứu đơn lẻ":
// neo theo nút ? (`btnId`) vì nút nằm ở 2 chỗ khác nhau, và popup tự chuyển sang
// `position: fixed` khi tràn viewport (panel cuộn / màn hình thấp).
function showHelpPopup(opts) {
  const o = opts || {};
  const btnId = o.btnId || '';
  const oldId = o.id || 'helpPopup';
  const prev = document.getElementById(oldId);
  if (prev) { prev.remove(); return; }   // bấm lần 2 = đóng
  const pop = document.createElement('div');
  pop.id = oldId;
  pop.className = 'cl-help-pop';
  pop.innerHTML = `<div class="cl-help-hd"><i class="fas fa-circle-question"></i>`
    + `<b>${histEsc(t(o.titleKey))}</b>`
    + `<button type="button" onclick="document.getElementById('${oldId}').remove()" aria-label="Đóng">`
    + `<i class="fas fa-xmark"></i></button></div>`
    + (o.steps && o.steps.length
      ? `<ol class="cl-help-steps">${o.steps.map(k => `<li>${histEsc(t(k))}</li>`).join('')}</ol>`
      : '')
    + (o.items && o.items.length
      ? `<div class="cl-help-sub">${histEsc(t(o.itemsTitleKey || 'calllogs.helpTitle'))}</div>`
        + `<ul>${o.items.map(k => `<li>${histEsc(t(k))}</li>`).join('')}</ul>`
      : '');
  const btn = btnId ? document.getElementById(btnId) : null;
  // Khung tham chiếu để tính bề rộng: PANEL chứa nút (sidebar), không phải viewport —
  // popup rộng đúng bằng panel và canh giữa panel, kể cả khi user kéo giãn/thu hẹp panel.
  const panel = (btn && (btn.closest('.sidebar') || btn.closest('.cl-net-field')
    || btn.closest('.form-group') || btn.closest('.tab-content') || btn.parentElement))
    || document.body;
  // Gắn vào <body>, KHÔNG gắn vào sidebar: sidebar là `position: fixed` nên nó trở thành
  // containing block của con `position: fixed` → toạ độ lệch đúng bằng offset sidebar.
  // Đo panel bằng getBoundingClientRect (toạ độ viewport) nên gắn vào body là khớp.
  document.body.appendChild(pop);

  const pad = 8;          // lề tối thiểu trong panel
  const gap = 6;          // khoảng cách tới nút
  const place = () => {
    if (!pop.isConnected) return;
    const pr = panel.getBoundingClientRect();
    const b = btn ? btn.getBoundingClientRect() : null;
    const vh = window.innerHeight;
    // Bề rộng = bề rộng panel trừ lề 2 bên (không vượt quá viewport khi panel rộng hơn
    // màn hình — panel có thể rộng hơn viewport sau khi kéo).
    const availW = Math.max(180, Math.round(pr.width - pad * 2));
    pop.style.position = 'fixed';
    pop.style.width = availW + 'px';
    pop.style.maxWidth = availW + 'px';
    // Canh giữa theo panel.
    let left = Math.round(pr.left + (pr.width - availW) / 2);
    // Kẹp trong viewport nếu panel tràn mép.
    const maxLeft = Math.max(pad, window.innerWidth - availW - pad);
    left = Math.max(pad, Math.min(left, maxLeft));
    pop.style.left = left + 'px';
    pop.style.right = 'auto';

    // Mốc dưới của nút ? — popup bám sát ngay dưới nó.
    const topBelow = b ? Math.round(b.bottom + gap) : Math.round(pr.top + 40);
    // Chiều cao nội dung thật (đo khi max-height đang bị bỏ giới hạn).
    pop.style.maxHeight = 'none';
    const ph = pop.offsetHeight;
    // Chỗ còn lại phía dưới nút và phía trên nút.
    const roomBelow = Math.max(120, vh - pad - topBelow);
    const roomAbove = b ? Math.max(0, Math.round(b.top - gap - pad)) : 0;
    // Nội dung dài hơn chỗ trống → KHÔNG nhảy lên đầu panel (dễ tưởng popup treo ở trên):
    // giữ popup ngay dưới nút và cho nó tự cuộn. Chỉ lật lên trên khi phía trên rộng hơn
    // hẳn phía dưới VÀ đủ chứa nội dung.
    let top = topBelow;
    let maxH = roomBelow;
    if (ph > roomBelow) {
      if (roomAbove > roomBelow && roomAbove >= ph) {
        top = Math.round(b.top - gap - ph);
        maxH = roomAbove;
      } else {
        maxH = roomBelow;   // ngay dưới nút, cuộn bên trong
      }
    }
    pop.style.maxHeight = Math.max(140, Math.round(maxH)) + 'px';
    pop.style.top = Math.max(pad, top) + 'px';
  };
  requestAnimationFrame(place);
  // Panel đổi bề rộng (kéo giãn / thu gọn) hoặc cửa sổ đổi kích thước → đặt lại.
  const onResize = () => { if (pop.isConnected) place(); else window.removeEventListener('resize', onResize); };
  window.addEventListener('resize', onResize);
  // Bấm ra ngoài thì đóng (không đóng khi bấm chính nút ? — nút đó tự toggle).
  setTimeout(() => {
    const away = (e) => {
      if (!pop.isConnected) { document.removeEventListener('click', away, true); return; }
      if (pop.contains(e.target) || (btn && (e.target === btn || btn.contains(e.target)))) return;
      pop.remove();
      document.removeEventListener('click', away, true);
    };
    document.addEventListener('click', away, true);
  }, 0);
}

// Popup hướng dẫn tab "Tra cứu danh sách" (nút ? cạnh ô chọn mạng).
function openClPickHelp(ev) {
  if (ev) { ev.preventDefault(); ev.stopPropagation(); }
  showHelpPopup({
    id: 'clPickHelpPopup',
    btnId: 'clPickHelpBtn',
    titleKey: 'calllogs.guideTitle',
    steps: ['calllogs.guide1', 'calllogs.guide2', 'calllogs.guide4',
      'calllogs.guide5', 'calllogs.guide6', 'calllogs.guide7'],
    itemsTitleKey: 'calllogs.helpTitle',
    items: ['calllogs.helpFmt', 'calllogs.helpNet', 'calllogs.helpRead',
      'calllogs.helpCredit', 'calllogs.helpResume']
  });
}

// Popup hướng dẫn TRA CỨU ĐƠN LẺ (nút ? cạnh tiêu đề "Tra Cứu Cell ID").
function openCellLookupHelp(ev) {
  if (ev) { ev.preventDefault(); ev.stopPropagation(); }
  showHelpPopup({
    id: 'cellHelpPopup',
    btnId: 'cellHelpBtn',
    titleKey: 'cells.helpTitle',
    steps: ['cells.help1', 'cells.help2', 'cells.help3', 'cells.help4', 'cells.help5'],
    itemsTitleKey: 'cells.helpNoteTitle',
    items: ['cells.helpN1', 'cells.helpN2', 'cells.helpN3']
  });
}

// Nhãn tên mạng từ giá trị server trả về ('viettel', 'Viettel', 'auto', '') → tên
// hiển thị ('Viettel'), 'tự động' khi không xác định. Dùng cho card phiên + bảng.
function clNetLabelFor(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v || v === 'auto') return '';
  const o = (typeof CL_NET_OPTIONS !== 'undefined' ? CL_NET_OPTIONS : []).find(x => x.value === v);
  return o ? o.name : String(value);
}

// Server nhận diện được mạng của file → cập nhật ô chọn cho khớp với phiên vừa nạp.
// Đổi cả `clNetChoice` để lần nạp sau mặc định đúng mạng đó.
function clNetApplyDetected(value) {
  const v = String(value || '').trim().toLowerCase();
  const o = CL_NET_OPTIONS.find(x => x.value === v && x.ok);
  if (!o) return;
  clNetChoice = o.value;
  renderClNetOptions();
}

// Bật/tắt trạng thái "đang đọc file" trên khung nạp file nằm NGAY trong tab.
function setClInlineBusy(busy, fileName) {
  const drop = document.getElementById('clSheetDrop');
  if (drop) drop.classList.toggle('busy', !!busy);
  const busyFile = document.getElementById('clSheetBusyFile');
  if (busyFile && fileName != null) busyFile.textContent = fileName;
  const busyStatus = document.getElementById('clSheetBusyStatus');
  if (busyStatus && !busy) busyStatus.textContent = t('calllogs.analyzing');
}

// Nạp file ở tab "Tra cứu danh sách" → phân tích (CHỈ ĐỌC: server không ghi DB, không trừ
// điểm) → mở NGAY Bảng cell cần tra. Không còn popup "chọn file" riêng.
// `event` có thể là event thật (event.target.files) hoặc object giả { target: { files } }
// khi kéo-thả file vào khung.
async function uploadCallLogAnalyze(event) {
  const target = event && event.target;
  const list = target && target.files;
  const file = list && list[0];
  if (target) target.value = '';
  if (!file) return;
  const fileName = file.name || '';

  // Hiện trạng thái đang đọc ngay trên khung upload của tab; overlay bảng chỉ mở khi
  // đã có dữ liệu (tránh nháy 1 popup trắng rồi đóng khi file lỗi).
  setClInlineBusy(true, fileName);

  try {
    const fd = new FormData();
    fd.append('file', file);
    const network = clNetChoice || 'auto';
    fd.append('network', network);
    const token = Auth.getToken();
    const r = await fetch('/api/call-logs/analyze', {
      method: 'POST',
      headers: token ? { 'Authorization': 'Bearer ' + token } : {},
      body: fd
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Analyze failed');

    const rows = Array.isArray(data.cells) ? data.cells : [];
    if (!rows.length) {
      showToast(t('calllogs.noCells'), 'error');
      return;
    }
    // Phiên làm việc MỚI: bỏ mọi danh sách/bản ghi của phiên trước (nếu có) để tab
    // không trộn cell của 2 file.
    myLogsCache = [];
    myLogsCache._restored = false;
    currentOpenBatchId = '';
    // 1 pipeline chung cho MỌI đường mở (analyze / phiên / lịch sử) → cùng số liệu.
    clAnalyze = clCellsFromSource({
      cells: rows, fileName, network: data.network || '', totalRows: data.totalRows
    });
    // Cell đã có trong CSDL nội bộ → hiện toạ độ ngay (miễn phí), bảng không còn trống.
    clApplyLocalHints(clAnalyze);
    // Mặc định chọn hết để bấm tra được ngay; user vẫn bỏ chọn từng dòng được.
    for (const c of clAnalyze.rows) clAnalyze.selected.add(c.key);
    // Ô chọn mạng khớp với mạng server nhận diện được từ nội dung file.
    clNetApplyDetected(data.network);
    // Đăng ký phiên NGAY khi nạp (không còn chờ bấm Tra cứu): danh sách cell + tên file
    // nằm ở Lịch sử tra cứu, và phiên làm việc vẫn khôi phục được sau khi F5. Chưa tra
    // cell nào nên chưa có bản ghi ở lịch sử tra cứu đơn lẻ và không tốn điểm.
    const uploadId = clBatchUploadId(fileName, clAnalyze.rows);
    clAnalyze.uploadId = uploadId;
    clAnalyze.batchId = uploadId;
    currentUploadFileName = fileName;
    currentOpenBatchId = uploadId;
    ensureCallLogSession(uploadId, {
      fileName, network: data.network || '',
      rowCount: clAnalyze.totalRows, cellCount: clAnalyze.rows.length,
      sessionCells: clAnalyze.rows
    });

    // Có danh sách cell → ẩn khối nạp file, hiện card phiên + mở Bảng cell cần tra.
    syncClLoadUi();
    openClTableOverlay();
    renderClTable();
    renderClSheetResolve().catch(() => {});
    // Danh sách bản ghi của tab cũng cập nhật theo bảng vừa nạp.
    renderCallLogs();
  } catch (e) {
    showToast(e.message, 'error');
    const busyStatus = document.getElementById('clSheetBusyStatus');
    if (busyStatus) busyStatus.textContent = e.message;
  } finally {
    setClInlineBusy(false);
  }
}

// Giá trị dùng để so sánh khi sort một dòng bảng.
function clSortValue(cell, key) {
  if (key === 'idx') return clAnalyze ? clAnalyze.rows.indexOf(cell) : 0;
  if (key === 'cell') return `${String(cell.lac).padStart(6, '0')}-${String(cell.cellid)}`;
  if (key === 'sector') return Number(cell.sector || -1);
  if (key === 'rowCount') return Number(cell.rowCount) || 0;
  if (key === 'radio') return String(cell.radio || '');
  if (key === 'time') return cell.firstTs || '';
  if (key === 'address') {
    const a = Array.isArray(cell.addresses) ? cell.addresses : [];
    return String(cell.address || cell.cell_address || (a[0] && (a[0].address || a[0])) || '');
  }
  if (key === 'loc') return (cell.lat != null && cell.lng != null) ? Number(cell.lat) : -1e9;
  if (key === 'status') return clRowStatusFor(cell).rank;
  return '';
}

// Bấm tiêu đề cột → đổi khoá sort (bấm lại cùng cột thì đảo chiều).
function sortClTable(key) {
  if (!clAnalyze) return;
  if (clAnalyze.sort.key === key) {
    clAnalyze.sort.dir = clAnalyze.sort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    clAnalyze.sort = { key, dir: (key === 'rowCount' || key === 'time') ? 'desc' : 'asc' };
  }
  renderClTable();
}

// Chuỗi + hạng cho cột Trạng thái của 1 dòng (kèm lý do miss từ nguồn nếu có).
function clRowStatusFor(cell) {
  const res = clAnalyze ? clAnalyze.results[cell.key] : null;
  if (res && res.state === 'found') {
    return { rank: 3, cls: 'found', text: t('calllogs.statusFound') };
  }
  if (res && res.state === 'unpaid') return { rank: 4, cls: 'unpaid', text: t('calllogs.statusUnpaid') };
  if (res && res.state === 'miss') {
    return { rank: 2, cls: 'miss', text: t('calllogs.statusMiss') + (res.reason ? ` · ${res.reason}` : '') };
  }
  if (res && res.state === 'busy') return { rank: 1, cls: 'busy', text: t('calllogs.statusBusy') };
  // Toạ độ lấy từ CSDL nội bộ (miễn phí, chưa trả phí) — vẫn có thể bấm Tra cứu để
  // lấy kết quả mới nhất từ nguồn online.
  if (res && res.state === 'local') return { rank: 3, cls: 'found', text: t('calllogs.statusLocal') };
  if (cell.localLat != null && cell.localLon != null) return { rank: 0, cls: 'pending', text: t('calllogs.statusLocal') };
  return { rank: 0, cls: 'pending', text: t('calllogs.statusPending') };
}

// Số dòng dữ liệu gốc của các cell đang được chọn (để hiện "· N dòng").
function clSelectedRowCount() {
  if (!clAnalyze) return 0;
  let n = 0;
  for (const c of clAnalyze.rows) if (clAnalyze.selected.has(c.key)) n += Number(c.rowCount) || 0;
  return n;
}

// Danh sách cell theo đúng THỨ TỰ đang hiển thị (đã sort) → tra lần lượt theo thứ tự này.
function clSortedRows() {
  if (!clAnalyze) return [];
  const rows = clAnalyze.rows.slice();
  const { key, dir } = clAnalyze.sort || {};
  if (!key) return rows;
  const mul = dir === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    const va = clSortValue(a, key);
    const vb = clSortValue(b, key);
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mul;
    return String(va).localeCompare(String(vb)) * mul;
  });
  return rows;
}

// Bộ lọc trạng thái của bảng cell: all / found (đã tra được) / miss (không ra kết quả)
// / unpaid (chưa tra: chưa có state hoặc hết điểm).
let clStatusFilter = 'all';

function clRowMatchesFilter(cell) {
  if (clStatusFilter === 'all') return true;
  const r = clAnalyze ? clAnalyze.results[cell.key] : null;
  const state = r && r.state ? r.state : 'none';
  if (clStatusFilter === 'found') return state === 'found';
  if (clStatusFilter === 'miss') return state === 'miss';
  // "Chưa tra" phải khớp ĐÚNG số trên chip. Chip lấy `notFound = miss + unpaid +
  // pending` và `pending` gồm mọi state không phải found/miss/unpaid (vd 'none',
  // 'local', 'busy') ⇒ ở đây cũng phải nhận đúng tập đó, nếu chỉ liệt kê
  // unpaid/none/busy thì chip ghi 12 mà bảng lọc ra 0 dòng.
  if (clStatusFilter === 'unpaid') return state !== 'found' && state !== 'miss';
  return true;
}

// Dòng đã lọc (trước khi sort + phân trang) → render bảng/đếm theo đúng tập đang xem.
function clFilteredRows(rows) {
  const src = Array.isArray(rows) ? rows : clSortedRows();
  return src.filter(clRowMatchesFilter);
}

// Đổi bộ lọc → vẽ lại bảng (giữ nguyên lựa chọn của user).
function setClStatusFilter(k) {
  clStatusFilter = k || 'all';
  renderClTable();
}


let myLogsCache = [];
let logPageIndex = 1;
const LOG_PAGE_SIZE = 20;
// Lọc loại hành động (chip icon) — thay cho <select id="actionFilter"> cũ.
let clActionFilter = 'all';
// Lọc theo TRẠNG THÁI CELL của dòng bản ghi (độc lập với lọc hành động/ngày):
//   all    = mọi dòng
//   found  = cell đã tra được (có toạ độ)
//   unpaid = cell CHƯA tra được (chưa trả phí / hết điểm / đang tra)
//   miss   = cell đã tra nhưng KHÔNG có kết quả
let clCellStatusFilter = 'all';


function renderClTable() {
  const head = document.getElementById('clTableHead');
  const body = document.getElementById('clTableBody');
  if (!head || !body || !clAnalyze) return;

  const sort = clAnalyze.sort || {};
  // Grip kéo dãn nằm ở cuối mỗi th (trừ th cuối — cột cuối ăn phần dư, kéo sẽ vô nghĩa).
  head.innerHTML = '<tr>' + CL_TBL_COLS.map((c, i) => {
    const cls = [c.sortable ? 'cl-tbl-sort' : '', c.cls || '',
      sort.key === c.key ? (sort.dir === 'asc' ? 'cl-sort-asc' : 'cl-sort-desc') : ''].filter(Boolean).join(' ');
    const ico = c.sortable ? `<i class="fas cl-sort-ico ${sort.key === c.key && sort.dir === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}"></i>` : '';
    const click = c.sortable ? ` onclick="sortClTable('${c.key}')"` : '';
    const grip = i < CL_TBL_COLS.length - 1
      ? `<span class="cl-col-grip" data-col="${i}" title="${histEsc(t('calllogs.colResize'))}"`
        + ` onmousedown="clStartColResize(event, ${i})" onclick="event.stopPropagation()"></span>`
      : '';
    return `<th class="${cls}"${click}>${c.key === 'idx' ? '' : histEsc(t(c.label))}${ico}${grip}</th>`;
  }).join('') + '</tr>';

  // <colgroup> sinh từ CL_TBL_COLS (cùng nguồn với header) → không lệch cột.
  // Cột cuối (Địa chỉ) không đặt width → ăn hết phần dư. `table-layout: fixed` nhờ
  // vậy header (sticky) và body luôn cùng độ rộng, không nhảy khi cuộn ngang/dọc.
  // Bề rộng đã kéo tay (clColWidths) được ghi đè lên class mặc định.
  const colgroup = document.getElementById('clTableCols');
  if (colgroup) {
    colgroup.innerHTML = CL_TBL_COLS.map((c, i) => {
      const w = clColWidths[i];
      return `<col${c.col ? ` class="${c.col}"` : ''}${w ? ` style="width:${w}px"` : ''}>`;
    }).join('');
  }

  // File lớn (hàng nghìn cell) → chỉ vẽ CL_TBL_PAGE dòng đầu, "Xem thêm" nới dần.
  // Lọc theo chip trạng thái TRƯỚC khi phân trang → "Đã có kết quả" luôn thấy đủ.
  const sorted = clFilteredRows();
  const limit = Math.max(CL_TBL_PAGE, Number(clAnalyze.limit) || CL_TBL_PAGE);
  const shown = sorted.slice(0, limit);
  body.innerHTML = shown.map((c, i) => clTableRowHtml(c, i + 1)).join('');
  // Bộ lọc không khớp dòng nào → báo rõ thay vì bảng trống.
  if (!shown.length) {
    body.innerHTML = `<tr><td colspan="${CL_TBL_COLS.length}" style="padding:14px;text-align:center;color:var(--text-faint)">` +
      `${histEsc(t('calllogs.filterEmpty'))}</td></tr>`;
  }

  const more = document.getElementById('clShowMoreWrap');
  if (more) {
    const left = sorted.length - shown.length;
    if (left > 0) {
      more.hidden = false;
      more.innerHTML = `<button type="button" class="cl-show-more" onclick="clShowMore()">` +
        `<i class="fas fa-chevron-down"></i> ${histEsc(fmtTpl('calllogs.showMore', { n: left }))}</button>`;
    } else {
      more.hidden = true;
      more.innerHTML = '';
    }
  }

  renderClTableSummary();
  updateClResolveSelBtn();
}

// Nới thêm 1 đợt dòng cho bảng.
function clShowMore() {
  if (!clAnalyze) return;
  clAnalyze.limit = (Number(clAnalyze.limit) || CL_TBL_PAGE) + CL_TBL_PAGE;
  renderClTable();
}

// Cột Cell dạng NGẮN GỌN: `MCC-MNC-LAC/TAC-CELLID` (1 dòng, không wrap) + dòng phụ
// `eNB · sector` cho cell dạng ECI dài. LTE/NR dùng TAC, còn lại là LAC — chỉ đổi
// nhãn, giá trị vẫn là trường `lac` của dữ liệu.
function clCellShort(parts, radio) {
  const mcc = parts.mcc == null ? '' : String(parts.mcc);
  const mnc = parts.mnc == null ? '' : String(parts.mnc);
  const lac = parts.lac == null ? '' : String(parts.lac);
  const cid = parts.cellid == null ? '' : String(parts.cellid);
  const r = String(radio || '').toUpperCase();
  const area = (r === 'LTE' || r === 'NR' || r === '5G') ? 'TAC' : 'LAC';
  return `${mcc}-${mnc}-${lac}/${area}-${cid}`;
}

// Badge công nghệ mạng (RAT) — màu theo RADIO_STYLE để quét mắt theo làn sóng.
// Không xác định được thì hiện "?" (không đoán bừa).
function clRadioBadgeHtml(radio) {
  const rs = radioStyle(radio);
  if (!rs.key) return `<span class="cl-tbl-unknown">?</span>`;
  return `<span class="cl-radio-badge" style="--rc:${rs.color}" title="${histEsc(rs.full || rs.label)}">` +
    `<i class="fas fa-signal"></i>${histEsc(rs.label)}</span>`;
}

// Icon trạng thái dòng (kèm màu) — dùng chung cho pill trạng thái.
function clStatusIconHtml(cls) {
  const ico = cls === 'found' ? 'fa-circle-check'
    : cls === 'miss' ? 'fa-circle-xmark'
    : cls === 'unpaid' ? 'fa-lock'
    : cls === 'busy' ? 'fa-spinner fa-spin'
    : 'fa-circle-notch';
  return `<i class="fas ${ico}"></i> `;
}

function clTableRowHtml(cell, index) {
  const selected = clAnalyze.selected.has(cell.key);
  const st = clRowStatusFor(cell);
  const res = clAnalyze ? clAnalyze.results[cell.key] : null;
  const unknown = `<span class="cl-tbl-unknown">${histEsc(t('calllogs.unknown'))}</span>`;
  // Cột Sóng: badge màu RAT (2G/3G/4G/5G...) thay cho chữ trơn.
  const radio = clRadioBadgeHtml(cell.radio);
  const sector = (cell.sector !== '' && cell.sector != null) ? histEsc(cell.sector) : unknown;
  // Cell: 1 dòng `mcc-mnc-lac/tac-cellid`; cell dạng ECI (id dài) kèm dòng phụ
  // `eNB · sector` cho dễ đối chiếu, cell ngắn thì không cần (đã là eNB).
  const cellIdText = cell.cellid == null ? '' : String(cell.cellid);
  const cellShort = clCellShort(cell, cell.radio);
  const cellSub = cellIdText.length > 7
    ? `<span class="cl-tbl-cell-sub">${histEsc(formatCellId(cell.cellid, cell.enb_id, cell.sector))}</span>`
    : '';
  const time = cell.firstTs
    ? (cell.lastTs && cell.lastTs !== cell.firstTs
        ? `${histEsc(cell.firstTs)}<br><span style="color:var(--text-faint)">${histEsc(cell.lastTs)}</span>`
        : histEsc(cell.firstTs))
    : unknown;
  const addr = (cell.addresses && cell.addresses[0])
    ? `<span class="cl-tbl-addr" title="${histEsc(cell.addresses.join(' · '))}">${histEsc(cell.addresses[0])}</span>`
    : `<span class="cl-tbl-addr cl-tbl-unknown">${histEsc(t('calllogs.unknown'))}</span>`;
  return `<tr class="cl-row st-${st.cls}${selected ? ' cl-row-sel' : ''}" data-key="${histEsc(cell.key)}">` +
    `<td class="cl-tbl-num"><input type="checkbox" class="cl-tbl-check" ${selected ? 'checked' : ''} ` +
      `onchange="clToggleRow('${histEsc(cell.key)}', this.checked)"> <span class="cl-tbl-idx">${index}</span></td>` +
    `<td class="cl-tbl-cell">${histEsc(cellShort)}${cellSub}</td>` +
    `<td>${sector}</td>` +
    `<td class="cl-tbl-num">${histEsc(cell.rowCount)}</td>` +
    `<td>${radio}</td>` +
    `<td>${time}</td>` +
    `<td>${addr}</td>` +
    `<td class="cl-tbl-loc">${clRowLocHtml(cell)}</td>` +
    `<td class="cl-tbl-status">${clRowStatusCellHtml(st, st.cls === 'busy' ? '0.0' : null)}</td>` +
    `</tr>`;
}

// Cột Vị trí: toạ độ từ lần tra trong phiên, hoặc cell có sẵn trong CSDL nội bộ
// (CHƯA trả phí → chỉ hiện "CSDL nội bộ", KHÔNG lộ số toạ độ).
function clRowLocHtml(cell) {
  const res = clAnalyze ? clAnalyze.results[cell.key] : null;
  if (res && res.lat != null && res.lon != null) {
    return `${histEsc(res.lat)}, ${histEsc(res.lon)}` + coordActionIcons(res.lat, res.lon);
  }
  if (cell.localLat != null && cell.localLon != null) {
    return `<span class="cl-tbl-unknown">${histEsc(t('calllogs.statusLocal'))}</span>`;
  }
  return `<span class="cl-tbl-unknown">${histEsc(t('calllogs.unknown'))}</span>`;
}

function renderClTableSummary() {
  if (!clAnalyze) return;
  const meta = document.getElementById('clSheetMeta');
  const s = clCellsSummary();
  let msg = fmtTpl('calllogs.stepDone', {
    c: s.total, r: clAnalyze.totalRows, net: clAnalyze.network || ''
  });
  // Cùng một nguồn số cho bảng / footer / bản đồ: "4 cell · 3 có kết quả · 1 không ra".
  if (s.found || s.miss || s.unpaid) {
    const parts = [];
    if (s.found) parts.push(fmtTpl('calllogs.sumFound', { n: s.found }));
    if (s.miss) parts.push(fmtTpl('calllogs.sumMiss', { n: s.miss }));
    if (s.unpaid) parts.push(fmtTpl('calllogs.sumUnpaid', { n: s.unpaid }));
    msg += ` — ${parts.join(' · ')}`;
  }
  if (meta) {
    // Đang tra → thêm thanh tiến trình TỔNG (đã có kết quả / tổng cell cần tra) +
    // số giây, để biết còn bao lâu thay vì nhìn bảng đứng im.
    const running = !!clResolveTick;
    const done = s.found + s.miss + s.unpaid;
    const total = Math.max(1, s.total);
    const pct = Math.min(100, Math.round((done / total) * 100));
    const secs = running && clResolveStartedAt ? ((Date.now() - clResolveStartedAt) / 1000).toFixed(0) : '';
    const prog = running
      ? `<span class="cl-sheet-prog"><span class="cl-sheet-prog-bar"><i style="width:${pct}%"></i></span>`
        + `<span class="cl-sheet-prog-txt">${done}/${s.total}${secs ? ' · ' + secs + 's' : ''}</span></span>`
      : '';
    meta.innerHTML = `<span><i class="fas fa-file-excel"></i> ${histEsc(clAnalyze.fileName || '')}</span>` +
      `<span>${histEsc(msg)}</span>` + prog;
  }
  renderClStatusChips(s);
  renderClSheetCount();
  updateClMapResultsBtn(s);
}

// Chip lọc trạng thái: Tất cả / Đã có kết quả / Không ra kết quả / Chưa tra.
// Số trên chip lấy từ clCellsSummary() → cùng nguồn số với bảng/footer/bản đồ.
function renderClStatusChips(summary) {
  const box = document.getElementById('clStatusChips');
  if (!box || !clAnalyze) return;
  const s = summary || clCellsSummary();
  // "Chưa tra" = mọi cell KHÔNG có kết quả tra (không found, không miss): unpaid +
  // pending (chưa có entry / local / busy). KHÔNG cộng `miss` — miss là ĐÃ TRA rồi
  // nhưng không ra, đã có chip "Không ra kết quả" riêng. Trước đây cộng cả miss nên
  // chip ghi 4 mà bấm vào chỉ ra 3 dòng.
  const notFound = s.unpaid + s.pending;
  const chips = [
    { k: 'all', label: 'calllogs.filterAll', n: s.total, cls: '' },
    { k: 'found', label: 'calllogs.filterFound', n: s.found, cls: 'found' },
    { k: 'miss', label: 'calllogs.filterMiss', n: s.miss, cls: 'miss' },
    { k: 'unpaid', label: 'calllogs.filterUnpaid', n: notFound, cls: 'unpaid' }
  ];
  box.innerHTML = chips.map(c =>
    `<button type="button" class="cl-chip cl-chip-${c.k}${c.cls ? ' ' + c.cls : ''}${clStatusFilter === c.k ? ' active' : ''}"` +
    ` data-filter="${c.k}" onclick="setClStatusFilter('${c.k}')">` +
    `${histEsc(t(c.label))} <b>${c.n}</b></button>`
  ).join('');
}

// Dòng đếm "Đã chọn n/t · r dòng" + trạng thái checkbox "chọn tất cả".
function renderClSheetCount() {
  const el = document.getElementById('clSheetCount');
  if (!el || !clAnalyze) return;
  el.textContent = fmtTpl('calllogs.selectedN', {
    n: clAnalyze.selected.size, t: clAnalyze.rows.length, r: clSelectedRowCount()
  });
  const all = document.getElementById('clSelectAll');
  if (all) {
    all.checked = clAnalyze.selected.size > 0 && clAnalyze.selected.size === clAnalyze.rows.length;
    all.indeterminate = clAnalyze.selected.size > 0 && clAnalyze.selected.size < clAnalyze.rows.length;
  }
}

// Chọn/bỏ chọn 1 dòng (cập nhật tại chỗ, không render lại cả bảng).
function clToggleRow(key, checked) {
  if (!clAnalyze) return;
  if (checked) clAnalyze.selected.add(key); else clAnalyze.selected.delete(key);
  const tr = document.querySelector(`#clTableBody tr[data-key="${key}"]`);
  if (tr) tr.classList.toggle('cl-row-sel', !!checked);
  renderClSheetCount();
  updateClResolveSelBtn();
  renderClSheetResolve().catch(() => {});
}

// "Chọn tất cả" áp dụng cho các dòng ĐANG HIỂN THỊ (đã lọc) → lọc ra phần chưa tra
// rồi bấm chọn hết là tra đúng phần đó.
function clSelectAll(checked) {
  if (!clAnalyze) return;
  clAnalyze.selected = new Set();
  if (checked) for (const c of clFilteredRows()) clAnalyze.selected.add(c.key);
  renderClTable();
  renderClSheetResolve().catch(() => {});
}

// Nút "Tra cứu N" hiện đúng số cell đang chọn.
function updateClResolveSelBtn() {
  const btn = document.getElementById('clResolveSelectedBtn');
  if (!btn || !clAnalyze) return;
  const n = clAnalyze.selected.size;
  const label = n > 0 ? fmtTpl('calllogs.resolveN', { n }) : t('calllogs.resolveNone');
  btn.innerHTML = `<i class="fas fa-satellite-dish"></i> ${histEsc(label)}`;
}

// Nút "Xem trên bản đồ": chỉ bật khi đã có ít nhất 1 cell tra ra toạ độ.
function updateClMapResultsBtn(summary) {
  const btn = document.getElementById('clMapResultsBtn');
  if (!btn) return;
  const s = summary || (clAnalyze ? clCellsSummary() : null);
  const n = s ? (Number(s.found) || 0) : 0;
  btn.disabled = n <= 0;
  btn.title = n > 0 ? fmtTpl('calllogs.mapResults', { n }) : t('calllogs.mapNone');
  const txt = document.getElementById('clMapResultsTxt');
  if (txt) txt.textContent = n > 0 ? fmtTpl('calllogs.mapResults', { n }) : t('calllogs.mapNone');
}

// Cập nhật TẠI CHỖ 1 dòng khi có kết quả tra (không render lại cả bảng → giữ vị trí cuộn).
// Ô trạng thái của 1 dòng: pill + (khi đang tra) thanh tiến trình nhỏ chạy liên tục
// kèm số giây → user thấy cell nào đang được tra chứ không tưởng là treo.
// Ô trạng thái trong bảng cell: CHỈ icon (gọn), chữ trạng thái chuyển vào tooltip
// `title` — hover là thấy, không chiếm chỗ trên dòng. Badge nguồn (admin) và thanh
// "đang tra" vẫn giữ vì chúng là thông tin phụ không thay được bằng tooltip.
function clRowStatusCellHtml(st, secs) {
  const tip = secs != null ? `${st.text} · ${secs}s` : st.text;
  const busy = st.cls === 'busy'
    ? `<span class="cl-row-busy" title="${histEsc(t('calllogs.statusBusy'))}">`
      + `<span class="cl-row-busy-bar"><i></i></span>`
      + `<span class="cl-row-busy-t">${secs != null ? histEsc(secs) + 's' : ''}</span></span>`
    : '';
  return `<span class="cl-tbl-status-wrap">`
    + `<span class="cl-row-status cl-row-status-ico ${st.cls}" data-cls="${st.cls}"`
    + ` title="${histEsc(tip)}" aria-label="${histEsc(st.text)}" role="img">`
    + `${clStatusIconHtml(st.cls)}</span>`
    + busy
    + `</span>`;
}

function updateClTableRow(key) {
  if (!clAnalyze) return;
  const cell = clAnalyze.rows.find(c => c.key === key);
  const tr = document.querySelector(`#clTableBody tr[data-key="${CSS.escape(key)}"]`);
  if (!cell || !tr) return;
  const st = clRowStatusFor(cell);
  tr.className = `cl-row st-${st.cls}` + (clAnalyze.selected.has(key) ? ' cl-row-sel' : '');
  const locTd = tr.querySelector('.cl-tbl-loc');
  if (locTd) locTd.innerHTML = clRowLocHtml(cell);
  const stTd = tr.querySelector('.cl-tbl-status');
  const res = clAnalyze.results[cell.key];
  if (stTd) {
    // Vẽ lại cả ô (không chỉ đổi chữ) để thanh "đang tra" xuất biến/mất đi đúng lúc.
    const secs = st.cls === 'busy' && clResolveStartedAt
      ? ((Date.now() - clResolveStartedAt) / 1000).toFixed(1) : null;
    stTd.innerHTML = clRowStatusCellHtml(st, secs);
  } else {
    const stEl = tr.querySelector('.cl-row-status');
    if (stEl) {
      stEl.className = 'cl-row-status cl-row-status-ico ' + st.cls;
      stEl.setAttribute('data-cls', st.cls);
      stEl.setAttribute('title', st.text);
      stEl.setAttribute('aria-label', st.text);
      stEl.innerHTML = clStatusIconHtml(st.cls);
    }
  }
}



// Khối thông báo điểm dưới bảng: ước tính chi phí của các cell đang chọn so với số dư.
// CHỈ tính các cell CHƯA có kết quả — cell đã tra trong lần nạp này không trừ lại.
async function renderClSheetResolve() {
  const box = document.getElementById('clSheetResolve');
  const btn = document.getElementById('clResolveSelectedBtn');
  if (!box || !clAnalyze) return;
  const n = clClSelectedNeed();
  const free = clClSelectedFree();
  if (!clAnalyze.selected.size) { box.hidden = true; box.innerHTML = ''; if (btn) btn.disabled = false; return; }
  if (n <= 0) {
    // Chọn toàn cell đã có kết quả → không có gì để trừ điểm.
    box.hidden = false;
    box.className = 'cl-up-resolve ok';
    box.innerHTML = `<i class="fas fa-circle-check"></i> ${histEsc(t('calllogs.allResolved'))}`;
    if (btn) btn.disabled = false;
    return;
  }

  const q = await clNeedQuoteFresh();
  const { cost, total, balance, enough, creditOn } = q;

  box.hidden = false;
  if (!creditOn) {
    box.className = 'cl-up-resolve free';
    box.innerHTML = `<i class="fas fa-circle-check"></i> ${histEsc(t('calllogs.confirmFreeMode'))}` +
      (free > 0 ? ` · <span class="cl-up-reuse">${histEsc(fmtTpl('calllogs.confirmFree', { q: free }))}</span>` : '');
    if (btn) btn.disabled = false;
    return;
  }
  box.className = 'cl-up-resolve' + (enough ? '' : ' warn');
  const canStart = clCanStartQuote(q);
  box.innerHTML = `<i class="fas fa-circle-info"></i> ${histEsc(fmtTpl('calllogs.resolveNeed', { n, c: cost, t: total, b: balance == null ? '?' : balance }))}` +
    (free > 0 ? ` · <span class="cl-up-reuse">${histEsc(fmtTpl('calllogs.confirmFree', { q: free }))}</span>` : '') +
    // Thiếu tổng nhưng còn điểm: tra tới khi hết điểm (không chặn).
    (enough ? '' : (canStart
      ? `<div class="cl-up-warn"><i class="fas fa-circle-info"></i> ${
        histEsc(fmtTpl('calllogs.notEnoughTotal', { b: balance == null ? '?' : balance, n, t: total }))}</div>`
      : `<div class="cl-up-warn"><i class="fas fa-triangle-exclamation"></i> ${
        histEsc(fmtTpl('calllogs.confirmNoCredits', { t: total, b: balance == null ? '?' : balance }))}` +
        ` <a href="/topup.html" style="color:inherit;text-decoration:underline"><i class="fas fa-wallet"></i> ${histEsc(t('calllogs.topupBtn'))}</a></div>`));
  if (btn) btn.disabled = !canStart;
}

// Giá điểm/cell từ cấu hình Auth (fallback 1 khi chế độ điểm bật nhưng giá chưa cấu hình).
function clCreditCost(cfg) {
  const c = (cfg || ((typeof Auth !== 'undefined' && Auth.getCreditConfig) ? Auth.getCreditConfig() : null)) || {};
  const v = Number(c.cost);
  if (Number.isFinite(v) && v > 0) return v;
  const d = Number(c.default_cost);
  if (Number.isFinite(d) && d > 0) return d;
  return 1;
}

// Chế độ tính điểm có bật không (false = miễn phí, không trừ điểm).
function clCreditOn(cfg) {
  const c = (cfg || ((typeof Auth !== 'undefined' && Auth.getCreditConfig) ? Auth.getCreditConfig() : null)) || {};
  return c.enabled !== false;
}

// Cell đang chọn mà lần tra này PHẢI trả phí (chưa có kết quả trong lần nạp này).
function clClSelectedNeed() {
  if (!clAnalyze) return 0;
  let n = 0;
  for (const c of clAnalyze.rows) {
    if (!clAnalyze.selected.has(c.key)) continue;
    const r = clAnalyze.results[c.key];
    if (!r || r.state !== 'found') n++;
  }
  return n;
}

// Cell đang chọn đã trả phí (state=found) → tra lại MIỄN PHÍ (server dedup theo batch).
function clClSelectedFree() {
  if (!clAnalyze) return 0;
  let n = 0;
  for (const c of clAnalyze.rows) {
    if (!clAnalyze.selected.has(c.key)) continue;
    const r = clAnalyze.results[c.key];
    if (r && r.state === 'found') n++;
  }
  return n;
}
// Tóm tắt chi phí (sync, dùng cache có sẵn): { n, free, cost, total, balance, after, enough, creditOn, totalCells }.
function clNeedQuote() {
  const n = clClSelectedNeed();
  const free = clClSelectedFree();
  const cost = clCreditCost();
  const creditOn = clCreditOn();
  const total = n * cost;
  let balance = (typeof Auth !== 'undefined' && Auth.getCreditBalance) ? Auth.getCreditBalance() : null;
  if (balance != null) balance = Number(balance);
  const after = balance != null ? balance - total : null;
  const enough = !creditOn || n <= 0 || balance == null || balance >= total;
  const totalCells = clAnalyze ? clAnalyze.selected.size : 0;
  return { n, free, cost, total, balance, after, enough, creditOn, totalCells };
}

// Có được BẮT ĐẦU tra với quote này không: chỉ cần đủ điểm cho 1 cell.
// Thiếu tổng (`enough=false`) vẫn cho chạy → tra lần lượt tới khi hết điểm.
function clCanStartQuote(q) {
  if (!q || !q.creditOn || q.n <= 0) return true;
  const cost = Number(q.cost) || 0;
  if (cost <= 0) return true;
  const bal = (q.balance == null || !Number.isFinite(Number(q.balance))) ? null : Number(q.balance);
  if (bal == null) return true;           // chưa đọc được số dư → để server quyết
  return bal >= cost;
}

// Async variant: refresh số dư từ server trước khi tính.
async function clNeedQuoteFresh() {
  if (typeof Auth !== 'undefined' && Auth.refreshCreditBalance) {
    try { await Auth.refreshCreditBalance(); } catch (e) { /* dùng cache */ }
  }
  return clNeedQuote();
}
// Modal xác nhận trước khi trừ điểm: chi tiết mới / miễn phí / tổng điểm / số dư.
// Chỉ gọi resolveClSelected() khi user bấm "Xác nhận tra cứu".
async function openClConfirmResolveModal() {
  if (!clAnalyze) return;
  if (!clAnalyze.selected.size) { showToast(t('calllogs.noSelection'), 'error'); return; }
  const modal = document.getElementById('clConfirmResolveModal');
  const body = document.getElementById('clConfirmResolveBody');
  const okBtn = document.getElementById('clConfirmResolveOk');
  const q = await clNeedQuoteFresh();
  const { n, free, cost, total, balance, after, enough, creditOn, totalCells } = q;
  // Được bắt đầu khi còn đủ điểm cho 1 cell; `enough` chỉ quyết định có chạy TRỌN lô
  // hay dừng giữa chừng (không chặn được user tra phần đã trả được).
  const canStart = clCanStartQuote(q);

  if (body) {
    const rows = [];
    // Dòng 1: tổng cell đang chọn
    rows.push(`<div class="cl-cfm-row"><span>${histEsc(t('calllogs.confirmCells'))}</span><b>${totalCells}</b></div>`);
    // Dòng 2: cell cần tra (chưa có kết quả)
    rows.push(`<div class="cl-cfm-row"><span>${histEsc(t('calllogs.confirmNeed'))}</span><b>${n}</b></div>`);
    // Dòng 3: cell miễn phí (đã có kết quả)
    if (free > 0) {
      rows.push(`<div class="cl-cfm-row free"><span><i class="fas fa-gift"></i> ${histEsc(fmtTpl('calllogs.confirmFree', { q: free }))}</span><b>0</b></div>`);
    }
    if (creditOn) {
      // Dòng 4: chi phí = n × giá = tổng
      rows.push(`<div class="cl-cfm-row total"><span>${histEsc(fmtTpl('calllogs.confirmCost', { n, c: cost, t: total }))}</span><b>${total}</b></div>`);
      // Dòng 5: số dư hiện tại
      if (balance != null) {
        rows.push(`<div class="cl-cfm-row"><span>${histEsc(fmtTpl('calllogs.confirmBalance', {
          b: balance, a: Math.max(0, balance - total)
        }))}</span><b>${balance}</b></div>`);
        // Dòng 6: số dư còn lại
        rows.push(`<div class="cl-cfm-row ${enough ? '' : 'bad'}"><span>${histEsc(t('calllogs.confirmAfter'))}</span><b>${Math.max(0, balance - total)}</b></div>`);
      }
    }
    // Tất cả đã có kết quả
    if (n <= 0) rows.push(`<div class="cl-cfm-note"><i class="fas fa-circle-check"></i> ${histEsc(t('calllogs.allResolved'))}</div>`);
    // Chế độ điểm tắt
    if (!creditOn) {
      rows.push(`<div class="cl-cfm-note"><i class="fas fa-circle-check"></i> ${histEsc(t('calllogs.confirmFreeMode'))}</div>`);
    }
    // Không đủ điểm cho cả lô nhưng còn điểm → vẫn tra được một phần rồi tự dừng.
    if (enough ? false : canStart) {
      rows.push(`<div class="cl-cfm-note"><i class="fas fa-circle-info"></i> ${
        histEsc(fmtTpl('calllogs.notEnoughTotal', { b: balance, n, t: total }))}</div>`);
    }
    // Hết điểm (không đủ cho dù chỉ 1 cell)
    if (!canStart) {
      rows.push(`<div class="cl-cfm-note bad"><i class="fas fa-triangle-exclamation"></i> ${
        histEsc(fmtTpl('calllogs.confirmNoCredits', { t: total, b: balance }))}` +
        ` <a href="/topup.html" style="color:inherit;text-decoration:underline"><i class="fas fa-wallet"></i> ${histEsc(t('calllogs.topupBtn'))}</a></div>`);
    }
    body.innerHTML = rows.join('');
  }
  if (okBtn) {
    okBtn.disabled = !canStart;
    okBtn.innerHTML = canStart
      ? `<i class="fas fa-satellite-dish"></i> ${histEsc(t('calllogs.confirmOk'))}`
      : `<i class="fas fa-wallet"></i> ${histEsc(t('calllogs.topupBtn'))}`;
    okBtn.onclick = canStart ? confirmClResolveModal : () => { location.href = '/topup.html'; };
  }
  if (modal) modal.classList.add('show');
}

function closeClConfirmResolveModal() {
  document.getElementById('clConfirmResolveModal')?.classList.remove('show');
}

// Bấm "Xác nhận tra cứu" trong modal → đóng modal rồi chạy tra thật.
function confirmClResolveModal() {
  closeClConfirmResolveModal();
  resolveClSelected({ confirmed: true });
}

// Nút "Tra cứu N" ở footer bảng → mở modal xác nhận (không trừ điểm ngay).
// Chỉ chặn khi KHÔNG còn điểm (số dư < giá 1 cell); thiếu tổng vẫn cho chạy →
// tra lần lượt tới khi hết điểm rồi dừng, phần còn lại để "chưa tra".
function resolveClSelectedClick() {
  if (!clAnalyze) return;
  if (!clAnalyze.selected.size) { showToast(t('calllogs.noSelection'), 'error'); return; }
  const q = clNeedQuote();
  if (!clCanStartQuote(q)) {
    showToast(fmtTpl('calllogs.confirmNoCredits', { t: q.total, b: q.balance }), 'error');
  } else if (q.creditOn && !q.enough) {
    // Đủ điểm cho MỘT PHẦN lô: báo trước là sẽ dừng khi hết điểm (không chặn).
    showToast(fmtTpl('calllogs.notEnoughTotal', { b: q.balance, n: q.n, t: q.total }), 'info');
  }
  openClConfirmResolveModal().catch(() => resolveClSelected({ confirmed: true }));
}

// Tra cứu các cell ĐANG CHỌN theo đúng thứ tự bảng (trên → dưới), lần lượt tới khi
// hết điểm thì dừng; mỗi dòng tự cập nhật toạ độ/kết quả ngay khi có kết quả.
// `opts.confirmed` = user đã xác nhận ở modal.
async function resolveClSelected(opts) {
  if (!clAnalyze) return;
  const selected = clAnalyze.selected;
  if (!selected.size) { showToast(t('calllogs.noSelection'), 'error'); return; }

  const box = document.getElementById('clSheetResolve');
  const btn = document.getElementById('clResolveSelectedBtn');
  if (btn) btn.disabled = true;
  // Đếm lại từ 0 cho thanh tiến trình tổng của lần chạy này.
  clResolveDoneCells = 0;
  clResolveStartedAt = 0;
  // Thống kê điểm của lần tra (tích luỹ qua các vòng, cùng shape với luồng cũ để
  // tái dùng calllogs.creditCharged / creditPartial + nút Nạp điểm).
  const credit = { charged: 0, requested: 0, found: 0, missed: 0, unpaid: 0, balance: null, insufficient: false, reused: 0 };
  // uploadId BỀN VỮNG theo nội dung lô (không phải Date.now) → bấm "Tra cứu" lần 2
  // trong cùng phiên rơi vào CÙNG batch ⇒ server trả toạ độ lại MIỄN PHÍ.
  const uploadId = clAnalyze.uploadId || clBatchUploadId(clAnalyze.fileName, clAnalyze.rows);
  clAnalyze.uploadId = uploadId;
  const keyOf = (c) => `${c.mcc}-${c.mnc}-${c.lac}-${c.cellid}`;
  const findCell = (k) => clAnalyze.rows.find(c => c.key === k) || clAnalyze.rows.find(c => canonicalClientKey(c) === k);

  try {
    // Bỏ qua cell ĐÃ có kết quả trong lần nạp này → không gửi lại, không trả phí lại.
    let batch = clSortedRows().filter(c => {
      if (!selected.has(c.key)) return false;
      const r = clAnalyze.results[c.key];
      return !(r && r.state === 'found');
    }).map(c => ({ mcc: c.mcc, mnc: c.mnc, lac: c.lac, cellid: c.cellid, sector: c.sector }));
    if (!batch.length) {
      showToast(t('calllogs.allResolved'), 'error');
      renderClTableSummary();
      return;
    }

    // Vòng bắt đầu từ số vòng ĐÃ chạy (roundsDone) → ref `batchId:rN` không trùng với
    // lần tra trước của cùng file, nên kết quả mới vẫn được ghi bút toán đúng.
    const MAX_ROUNDS = 5;
    const startRound = Number(clAnalyze.roundsDone) || 0;
    const costPer = clCreditCost();
    const creditOn = clCreditOn();
    // Đăng ký phiên TRƯỚC khi tra: tab "Tra cứu danh sách" thấy ngay file này (kể cả khi
    // 0 cell ra toạ độ / hết điểm ngay vòng đầu). Không tốn điểm.
    if (!clAnalyze.batchId) clAnalyze.batchId = uploadId;
    await ensureCallLogSession(clAnalyze.batchId, {
      fileName: clAnalyze.fileName,
      network: clAnalyze.network,
      rowCount: clAnalyze.totalRows,
      cellCount: clAnalyze.rows.length,
      // Danh sách cell ĐẦY ĐỦ (kể cả chưa tra) → mở lại phiên vẫn thấy đủ cell.
      sessionCells: clAnalyze.rows
    });
    // Dừng chủ động khi số dư không còn đủ cho 1 cell (server đã trả `insufficient`,
    // đây là lưới an toàn để KHÔNG gửi thêm vòng vô ích).
    const outOfCredit = () => creditOn && costPer > 0 &&
      credit.balance != null && Number(credit.balance) < costPer;
    let stoppedNoCredit = false;
    for (let round = startRound; round < startRound + MAX_ROUNDS && batch.length > 0; round++) {
      if (outOfCredit()) { stoppedNoCredit = true; break; }
      // Đánh dấu "đang tra" cho cả lô để user thấy tiến trình.
      for (const c of batch) {
        const cell = findCell(keyOf(c)) || clAnalyze.rows.find(c2 => canonicalClientKey(c2) === keyOf(c));
        if (!cell) continue;
        clAnalyze.results[cell.key] = { state: 'busy' };
        updateClTableRow(cell.key);
      }
      // Server xử lý CẢ lô trong 1 request (tuần tự từng cell, mỗi cell có thể gọi
      // nhiều nguồn online) → gửi 500 cell/lần thì user nhìn bảng "đang tra" rất lâu
      // mà không thấy gì đổi. Chia thành lô nhỏ: mỗi lô trả về là 1 nhóm cell hiện
      // kết quả NGAY, thanh tiến trình nhảy theo. roundIdx giữ nguyên cho cả vòng nên
      // ref bút toán `${batchId}:r${round}` vẫn idempotent (retry không trừ 2 lần).
      let roundResults = [];
      let roundHasPending = false;
      let roundInsufficient = false;
      for (let ci = 0; ci < batch.length; ci += CL_RESOLVE_CHUNK) {
        if (outOfCredit()) { stoppedNoCredit = true; break; }
        const chunk = batch.slice(ci, ci + CL_RESOLVE_CHUNK);
        clResolveProgressStart(credit);
        let resp = null;
        try {
          resp = await apiRequest('POST', '/api/cells/resolve-batch',
            { cells: chunk, uploadId: uploadId, fileName: clAnalyze.fileName, roundIdx: round });
        } catch (err) {
          // Lô lỗi (mạng/hết điểm giữa chừng): dừng hẳn, không gửi lô kế tiếp.
          clResolveProgressStop();
          throw err;
        }
        clResolveProgressStop();
        if (resp && resp.credit) {
          credit.charged += Number(resp.credit.charged) || 0;
          credit.requested += Number(resp.credit.requested) || 0;
          credit.found += Number(resp.credit.found) || 0;
          credit.missed += Number(resp.credit.missed) || 0;
          credit.unpaid = Math.max(credit.unpaid, Number(resp.credit.unpaid) || 0);
          credit.reused += Number(resp.credit.reused) || 0;
          if (resp.credit.balance != null) credit.balance = resp.credit.balance;
          if (resp.credit.insufficient) credit.insufficient = true;
        }
        if (resp && resp.batchId) clAnalyze.batchId = resp.batchId;
        if (!resp || !resp.results) { roundHasPending = false; break; }
        if (resp.pending) roundHasPending = true;
        if (resp.credit && resp.credit.insufficient && resp.pending) roundInsufficient = true;
        roundResults = roundResults.concat(resp.results);
        // Hiện kết quả của lô này NGAY (không chờ hết vòng).
        clApplyResolveResults(resp.results, findCell, credit);
        renderClTableSummary();
        if (roundInsufficient) break;
        if (outOfCredit()) { stoppedNoCredit = true; break; }
      }
      // Hết điểm giữa chừng → mọi cell còn pending (trong mọi lô đã gửi) là "chưa tra".
      if (roundInsufficient) {
        stoppedNoCredit = true;
        for (const r of roundResults) {
          if (!r || !r.pending) continue;
          const cell = findCell(r.key);
          if (!cell) continue;
          clAnalyze.results[cell.key] = { state: 'unpaid' };
          clResolveDoneCells++;
          updateClTableRow(cell.key);
        }
        break;
      }

      const stillPending = clPendingKeysFor(roundResults, findCell);
      if (!stillPending.length) break;
      if (!roundHasPending) {
        // Hết nguồn cho phần còn lại → không ra kết quả.
        markCellsMiss(stillPending, findCell);
        break;
      }
      const pendingSet = new Set(stillPending);
      batch = batch.filter(c => pendingSet.has(keyOf(c)));
    }
    clAnalyze.roundsDone = startRound + 1;
    // Bảng đã có dữ liệu → cho bản đồ vẽ (không hoãn nữa).
    clMapDeferred = false;

    renderClTableSummary();
    showClSheetResolveResult(credit, box);
    // Dừng vì hết điểm giữa lô: nói rõ để user biết còn cell chưa tra (không im lặng).
    if (stoppedNoCredit) showToast(t('calllogs.stopNoCredit'), 'error');
    saveCallSession();
    // Đẩy cell vừa tra được lên phiên server ngay (không chờ hết vòng): đóng tab /
    // mất mạng giữa chừng thì toạ độ đã trả phí vẫn còn ở phiên.
    saveCallSessionResolved(clAnalyze.batchId || currentOpenBatchId, { flush: true });
    // Tab Lịch sử đang mở → lần tra này hiện ngay ở mục "Tra cứu danh sách (Excel)"
    // (tab này là nơi DUY NHẤT có danh sách phiên).
    if (document.getElementById('tab-lookuphistory')?.classList.contains('active')) {
      loadHistBatches(histBatch.page || 1);
    }
  } catch (e) {
    if (box) {
      box.hidden = false;
      box.className = 'cl-up-resolve warn';
      box.innerHTML = `<i class="fas fa-triangle-exclamation"></i> ${histEsc(e.message)}`;
    }
  } finally {
    clResolveProgressStop();
    if (btn) btn.disabled = false;
    renderClSheetCount();
    renderClTableSummary();
  }
}

// Thông báo kết quả 3 số (tra được / không ra kết quả / chưa tra vì hết điểm)
// Nút "Hiển thị tất cả trên bản đồ" đã bỏ khỏi footer overlay (trùng với tab
// "Tra cứu danh sách" đã tự vẽ marker) → không còn plotClTableOnMap.

// ============================================
// Tra cứu theo lô nhỏ + tiến trình từng cell
// ============================================
// Server xử lý tuần tự cả lô trong 1 request (mỗi cell có thể hỏi nhiều nguồn online
// + throttle) nên 1 request 500 cell mất rất lâu và bảng đứng im ở "đang tra".
// Client chia thành lô nhỏ: giữa 2 lô là 1 nhịp vẽ lại → user thấy cell nào vừa
// xong, thanh tiến trình tổng nhích lên, và mỗi cell "đang tra" có thanh chạy riêng.
const CL_RESOLVE_CHUNK = 25;       // số cell / request (đủ nhỏ để phản hồi nhanh)
let clResolveTick = null;          // interval vẽ lại các cell đang "busy"
let clResolveBusyKeys = [];        // key các cell đang chờ trong lô hiện tại
let clResolveStartedAt = 0;
let clResolveTotalCells = 0;       // tổng cell cần tra của lần chạy này
let clResolveDoneCells = 0;        // số cell đã có kết quả (found/miss/unpaid)

// Bắt đầu 1 nhịp tra: ghi mốc thời gian + bật ticker cập nhật thanh tiến trình mỗi
// cell đang chờ (để user thấy "đang chạy" chứ không phải treo).
function clResolveProgressStart(credit) {
  clResolveBusyKeys = clAnalyze
    ? clAnalyze.rows.filter(c => clAnalyze.results[c.key] && clAnalyze.results[c.key].state === 'busy').map(c => c.key)
    : [];
  clResolveStartedAt = Date.now();
  if (clResolveTick) return;
  clResolveTick = setInterval(() => {
    const secs = ((Date.now() - clResolveStartedAt) / 1000).toFixed(1);
    for (const k of clResolveBusyKeys) clUpdateBusyBar(k, secs);
    renderClTableSummary();
  }, 200);
}

function clResolveProgressStop() {
  if (clResolveTick) { clearInterval(clResolveTick); clResolveTick = null; }
  clResolveBusyKeys = [];
  clResolveStartedAt = 0;
}

// Thanh tiến trình KHÔNG xác định (indeterminate) + số giây trên dòng đang tra.
// Dùng thanh riêng trong ô trạng thái nên không đè lên chữ trạng thái.
function clUpdateBusyBar(key, secs) {
  const tr = document.querySelector(`#clTableBody tr[data-key="${CSS.escape(key)}"]`);
  if (!tr) return;
  const bar = tr.querySelector('.cl-row-busy');
  if (!bar) return;
  const t = bar.querySelector('.cl-row-busy-t');
  if (t) t.textContent = `${secs}s`;
}

// Áp kết quả 1 lô vào clAnalyze (found / unpaid / miss) rồi vẽ lại từng dòng.
// Tách khỏi vòng lặp để gọi được ngay sau MỖI lô nhỏ.
function clApplyResolveResults(results, findCell, credit) {
  for (const r of results || []) {
    const cell = findCell(r.key);
    if (!cell) continue;
    if (r.unpaid) {
      // Vượt số dư: server ẩn toạ độ → không nhận kết quả, để user nạp điểm tra tiếp.
      clAnalyze.results[cell.key] = { state: 'unpaid' };
      clResolveDoneCells++;
      updateClTableRow(cell.key);
      continue;
    }
    if (r.lat && r.lon) {
      clAnalyze.results[cell.key] = {
        state: 'found', lat: r.lat, lon: r.lon, range: r.range, radio: r.radio,
        sourceLabel: SOURCE_LABELS[r.source] || (r.source || ''), source: r.source
      };
      // Ghi toạ độ vào chính dòng cell → "Hiển thị trên bản đồ"/lưu phiên dùng lại.
      cell.lat = r.lat; cell.lng = r.lon; cell.range = r.range;
      if (!cell.radio && r.radio) cell.radio = r.radio;
      cell.state = 'found';
      clResolveDoneCells++;
      updateClTableRow(cell.key);
    } else if (!r.pending) {
      clAnalyze.results[cell.key] = { state: 'miss', reason: '' };
      cell.state = 'miss';
      clResolveDoneCells++;
      updateClTableRow(cell.key);
    }
    // `pending` (còn vòng sau) → giữ nguyên "busy" để user biết còn đang chạy.
    if (credit && r.lat && r.lon) credit.foundCellSeen = (credit.foundCellSeen || 0) + 1;
  }
}

// Các key còn "chưa có kết quả" trong 1 lô (server báo pending).
function clPendingKeysFor(results, findCell) {
  const out = [];
  for (const r of results || []) {
    if (!r || !r.pending) continue;
    const cell = findCell(r.key);
    if (cell) out.push(r.key);
  }
  return out;
}

// Đánh dấu "không ra kết quả" cho các cell còn lại sau khi hết nguồn.
function markCellsMiss(keys, findCell) {
  for (const k of keys || []) {
    const cell = findCell(k);
    if (!cell) continue;
    clAnalyze.results[cell.key] = { state: 'miss', reason: '' };
    cell.state = 'miss';
    clResolveDoneCells++;
    updateClTableRow(cell.key);
  }
}

// ============================================
// Tra cứu MỘT cell từ danh sách bản ghi
// --------------------------------------------
// Icon cuối dòng (chỉ hiện với cell chưa tra / chưa đủ điểm trả phí) → tra đúng 1 cell:
//   1. Đẩy dòng sang trạng thái "đang tra" + hiện thanh trạng thái ngay trong dòng.
//   2. POST /api/cells/resolve-batch với 1 cell, CÙNG uploadId của phiên → server tái
//      dùng kết quả đã trả phí, không trừ điểm 2 lần.
//   3. Ra toạ độ  → ghi vào clAnalyze.results + mọi dòng bản ghi cùng cell ⇒ dòng tự
//      nhảy sang nhóm "đã tra được" (chip đếm lại, bộ lọc trạng thái thấy ngay).
//      Không ra   → 'miss' + toast báo.
//      Hết điểm   → giữ 'unpaid' + toast báo thiếu điểm (không đánh dấu miss, vì chưa
//                   thực sự tra được lần nào).
const clOneCellBusy = new Set();

async function clLookupOneCell(ev, btn) {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  const key = btn && (btn.dataset.cellKey || '');
  if (!key || !clAnalyze) return;
  if (clOneCellBusy.has(key)) return;

  const cell = clAnalyze.rows.find(c => c.key === key) || clAnalyze.rows.find(c => canonicalClientKey(c) === key);
  if (!cell) { showToast(t('calllogs.lookupCellNoRow'), 'error'); return; }

  clOneCellBusy.add(key);
  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

  // (1) "Đang tra" NGAY: state busy + thanh trạng thái trong dòng.
  const prevState = clAnalyze.results[cell.key];
  clAnalyze.results[cell.key] = { state: 'busy' };
  renderCallLogs();
  clShowLookupBar(key, 'busy');

  const credit = { charged: 0, balance: null, insufficient: false };
  const uploadId = clAnalyze.uploadId || clBatchUploadId(clAnalyze.fileName, clAnalyze.rows);
  clAnalyze.uploadId = uploadId;
  if (!clAnalyze.batchId) clAnalyze.batchId = uploadId;

  try {
    const resp = await apiRequest('POST', '/api/cells/resolve-batch', {
      cells: [{ mcc: cell.mcc, mnc: cell.mnc, lac: cell.lac, cellid: cell.cellid, sector: cell.sector }],
      uploadId: uploadId,
      fileName: clAnalyze.fileName,
      roundIdx: Number(clAnalyze.roundsDone) || 0
    });
    if (resp && resp.credit) {
      credit.charged = Number(resp.credit.charged) || 0;
      credit.balance = resp.credit.balance != null ? resp.credit.balance : null;
      credit.insufficient = !!resp.credit.insufficient;
    }
    if (resp && resp.batchId) clAnalyze.batchId = resp.batchId;
    const res = (resp && Array.isArray(resp.results)) ? resp.results[0] : null;

    if (!res) {
      // Server không trả gì cho cell này → giữ nguyên trạng thái cũ.
      if (prevState) clAnalyze.results[cell.key] = prevState; else delete clAnalyze.results[cell.key];
      clShowLookupBar(key, 'fail');
      showToast(t('calllogs.lookupCellNoResult'), 'error');
    } else if (res.unpaid || credit.insufficient) {
      // Hết điểm: KHÔNG đánh dấu miss — nạp điểm rồi tra lại được.
      clAnalyze.results[cell.key] = { state: 'unpaid' };
      clShowLookupBar(key, 'nofunds');
      showToast(fmtTpl('calllogs.lookupCellNoFunds', {
        c: clCreditCost(), b: credit.balance == null ? '?' : credit.balance
      }), 'error');
    } else if (res.lat && res.lon) {
      // Tra ra → ghi vào cả kết quả phiên lẫn mọi dòng bản ghi cùng cell.
      clAnalyze.results[cell.key] = {
        state: 'found', lat: res.lat, lon: res.lon, range: res.range, radio: res.radio,
        sourceLabel: SOURCE_LABELS[res.source] || (res.source || ''), source: res.source
      };
      cell.lat = res.lat; cell.lng = res.lon; cell.range = res.range;
      if (!cell.radio && res.radio) cell.radio = res.radio;
      cell.state = 'found';
      for (const row of myLogsCache) {
        if (!row.cellid || canonicalClientKey(row) !== cell.key) continue;
        row.lat = res.lat; row.lon = res.lon; row.cell_range = res.range;
        row.source = res.source; row._charged = true;
        row._resolvedOnline = (res.source || '') !== 'local';
        if (!row.radio && res.radio) row.radio = res.radio;
      }
      clShowLookupBar(key, 'done');
      showToast(credit.charged > 0
        ? fmtTpl('calllogs.lookupCellOk', { c: credit.charged })
        : t('calllogs.lookupCellOkFree'), 'success');
    } else if (res.pending) {
      // Server còn việc (nguồn online đang chạy) → giữ "đang tra", user bấm lại sau.
      clAnalyze.results[cell.key] = { state: 'busy' };
      clShowLookupBar(key, 'pending');
      showToast(t('calllogs.lookupCellPending'), '');
    } else {
      // Đã tra nhưng không nguồn nào có cell.
      clAnalyze.results[cell.key] = { state: 'miss', reason: '' };
      cell.state = 'miss';
      clShowLookupBar(key, 'miss');
      showToast(credit.charged > 0
        ? fmtTpl('calllogs.lookupCellMiss', { c: credit.charged })
        : t('calllogs.lookupCellMissFree'), 'error');
    }
    // Ghi phiên → mở lại từ Lịch sử vẫn thấy kết quả / trạng thái mới.
    if (clAnalyze.batchId) {
      ensureCallLogSession(clAnalyze.batchId, {
        fileName: clAnalyze.fileName, network: clAnalyze.network,
        rowCount: clAnalyze.totalRows, cellCount: clAnalyze.rows.length,
        sessionCells: clAnalyze.rows
      }).catch(() => {});
    }
  } catch (err) {
    if (prevState) clAnalyze.results[cell.key] = prevState; else delete clAnalyze.results[cell.key];
    clShowLookupBar(key, 'fail');
    showToast(t('calllogs.lookupCellFail'), 'error');
  } finally {
    clOneCellBusy.delete(key);
    // Vẽ lại danh sách → dòng ở trạng thái CUỐI; thanh trạng thái đặt lại vào dòng mới
    // để user kịp đọc kết quả, rồi tự ẩn.
    const finalKind = clCellBarKindFor(cell.key);
    renderCallLogs();
    renderClTableSummary();
    if (finalKind) clShowLookupBar(cell.key, finalKind.kind);
    setTimeout(() => clHideLookupBar(cell.key), finalKind ? 3000 : 0);
  }
}

// Loại thanh trạng thái (nếu còn cần hiện) theo state CUỐI của cell.
function clCellBarKindFor(key) {
  const r = clAnalyze && clAnalyze.results ? clAnalyze.results[key] : null;
  const st = r && r.state ? r.state : 'none';
  if (st === 'found') return { kind: 'done' };
  if (st === 'miss') return { kind: 'miss' };
  if (st === 'unpaid') return { kind: 'nofunds' };
  if (st === 'busy') return { kind: 'pending' };
  return null;
}

// Thanh trạng thái trong dòng bản ghi của 1 cell.
// `kind`: busy | done | miss | nofunds | pending | fail.
function clShowLookupBar(key, kind) {
  const card = document.querySelector(`#logRecordList .log-card[data-key="${cssEscapeAttr(key)}"]`);
  if (!card) return;
  let bar = card.querySelector('.log-lookup-bar');
  if (!bar) {
    bar = document.createElement('div');
    const detail = card.querySelector('.log-detail');
    if (detail) card.insertBefore(bar, detail); else card.appendChild(bar);
  }
  const map = {
    busy:    { cls: 'busy',    ico: 'fa-spinner fa-spin',      txt: t('calllogs.lookupBarBusy') },
    done:    { cls: 'done',    ico: 'fa-circle-check',         txt: t('calllogs.lookupBarDone') },
    miss:    { cls: 'miss',    ico: 'fa-circle-xmark',         txt: t('calllogs.lookupBarMiss') },
    nofunds: { cls: 'nofunds', ico: 'fa-triangle-exclamation', txt: t('calllogs.lookupBarNoFunds') },
    pending: { cls: 'busy',    ico: 'fa-hourglass-half',       txt: t('calllogs.lookupBarPending') },
    fail:    { cls: 'fail',    ico: 'fa-circle-exclamation',   txt: t('calllogs.lookupBarFail') }
  }[kind] || { cls: 'fail', ico: 'fa-circle-exclamation', txt: '' };
  bar.className = `log-lookup-bar ${clsSafe(map.cls)}`;
  bar.innerHTML = `<i class="fas ${map.ico}"></i><span>${histEsc(map.txt)}</span>`;
}

// Ẩn thanh trạng thái của 1 dòng.
function clHideLookupBar(key) {
  const card = document.querySelector(`#logRecordList .log-card[data-key="${cssEscapeAttr(key)}"]`);
  const bar = card && card.querySelector('.log-lookup-bar');
  if (bar) bar.remove();
}

// Escape giá trị cho selector thuộc tính `[data-key="…"]` (cell ID chứa dấu `-`).
function cssEscapeAttr(v) { return String(v == null ? '' : v).replace(/["\\]/g, '\\$&'); }
function clsSafe(v) { return String(v || '').replace(/[^a-z0-9_-]/gi, ''); }



// Kéo-thả file vào khung nạp file trong tab "Tra cứu danh sách" → nạp qua luồng phân tích.
// Lắng nghe ở document (không gắn 1 lần vào khung lúc DOMContentLoaded) để khung
// luôn bắt được drop kể cả khi markup render lại.
(function initClSheetDrop() {
  const wire = () => {
    document.addEventListener('dragover', e => {
      const drop = document.getElementById('clSheetDrop');
      if (!drop || !drop.contains(e.target)) return;
      e.preventDefault(); drop.classList.add('dragover');
    });
    ['dragleave', 'dragend'].forEach(ev => document.addEventListener(ev, () => {
      document.getElementById('clSheetDrop')?.classList.remove('dragover');
    }));
    document.addEventListener('drop', e => {
      const drop = document.getElementById('clSheetDrop');
      if (!drop || !drop.contains(e.target)) return;
      e.preventDefault(); drop.classList.remove('dragover');
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) uploadCallLogAnalyze({ target: { files: [f], value: '' } });
    });
    // Ô chọn mạng nằm NGAY trong tab → vẽ sẵn khi tải trang (không phụ thuộc overlay).
    renderClNetOptions();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
})();

// Các cell ĐÃ TRA ĐƯỢC (đã trả phí) của phiên hiện tại → POST về server để lưu vào
// call_log_batches.resolved_cells. Nhờ vậy mở lại phiên ở máy/tab khác (hoặc sau khi
// đóng tab) vẫn thấy toạ độ đã trả phí, không phải tra & trừ điểm lần nữa.
// Nguồn DUY NHẤT là bảng cell đang mở (clAnalyze): chỉ cell found THUỘC batch hiện tại
// mới được lưu. myLogsCache KHÔNG dùng làm nguồn nữa — dữ liệu mở từ Lịch sử tra cứu
// (`_fromHistory`) có thể không thuộc phiên đang mở, lưu vào sẽ phình resolved_cells
// bằng cell ngoài phiên.
function clResolvedCellsForSave(batchId) {
  const out = [];
  const seen = new Set();
  if (!clAnalyze) return out;
  const cur = String(batchId || clAnalyze.batchId || currentOpenBatchId || '');
  // Phiên đang mở khác batch của bảng → không lưu (tránh gán nhầm cell).
  const owner = String(clAnalyze.batchId || currentOpenBatchId || '');
  if (cur && owner && cur !== owner) return out;
  for (const cell of clAnalyze.rows) {
    const r = clAnalyze.results[cell.key];
    if (!r || r.state !== 'found' || r.lat == null || r.lon == null) continue;
    const rec = {
      mcc: cell.mcc, mnc: cell.mnc, lac: cell.lac, cellid: cell.cellid, sector: cell.sector || '',
      lat: Number(r.lat), lng: Number(r.lon),
      range: r.range != null ? r.range : (cell.range != null ? cell.range : null),
      source: r.source || '', radio: r.radio || cell.radio || ''
    };
    const key = canonicalClientKey(rec);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(rec);
  }
  return out;
}

let clSaveResolvedTimer = null;
let clSaveResolvedBatchId = '';
let clSaveResolvedBusy = false;

// Lưu cell đã tra được lên phiên của user (gộp 800ms để không bắn nhiều request
// khi bảng cập nhật từng dòng). `opts.flush` = gửi ngay (dùng khi sắp rời trang).
// Lỗi mạng → im lặng: sessionStorage vẫn giữ.
function saveCallSessionResolved(batchId, opts) {
  const id = batchId || currentOpenBatchId || (clAnalyze && clAnalyze.batchId) || '';
  if (!id || typeof apiRequest !== 'function') return;
  clSaveResolvedBatchId = id;
  if (opts && opts.flush) {
    if (clSaveResolvedTimer) { clearTimeout(clSaveResolvedTimer); clSaveResolvedTimer = null; }
    clFlushResolvedCells(id);
    return;
  }
  if (clSaveResolvedTimer) clearTimeout(clSaveResolvedTimer);
  clSaveResolvedTimer = setTimeout(() => { clSaveResolvedTimer = null; clFlushResolvedCells(id); }, 800);
}

// Gửi NGAY phần đang chờ (bấm X đóng bảng, đóng tab, ẩn trang). Không debounce để
// toạ độ đã trả phí không bị mất khi người dùng rời đi trong 800ms.
function flushCallSessionResolved() {
  const id = clSaveResolvedBatchId || currentOpenBatchId || (clAnalyze && clAnalyze.batchId) || '';
  if (!id) return;
  if (clSaveResolvedTimer) { clearTimeout(clSaveResolvedTimer); clSaveResolvedTimer = null; }
  clFlushResolvedCells(id);
}

async function clFlushResolvedCells(batchId, retried) {
  if (clSaveResolvedBusy) return;
  const cells = clResolvedCellsForSave(batchId);
  if (!cells.length) return;
  clSaveResolvedBusy = true;
  try {
    await apiRequest('POST', '/api/call-log-sessions/' + encodeURIComponent(batchId) + '/cells', { cells });
  } catch (e) {
    // 404 = phiên chưa có trong CSDL (mở phiên cũ bị xoá / đăng ký lỗi mạng trước đó)
    // → đăng ký lại 1 lần rồi gửi lại, để toạ độ đã trả phí không bị mất.
    if (!retried) {
      const ok = await ensureCallLogSession(batchId, {
        fileName: currentUploadFileName,
        network: (clAnalyze && clAnalyze.network) || '',
        rowCount: (clAnalyze && clAnalyze.totalRows) || 0,
        cellCount: (clAnalyze && clAnalyze.rows.length) || 0,
        sessionCells: (clAnalyze && clAnalyze.rows) || null
      });
      if (ok) { clSaveResolvedBusy = false; return clFlushResolvedCells(batchId, true); }
    }
    /* offline / chưa đăng nhập: giữ ở sessionStorage */
  } finally { clSaveResolvedBusy = false; }
}


// — cùng định dạng với #clCreditNotice của luồng cũ.
function showClSheetResolveResult(credit, box) {
  if (!box) return;
  const charged = Number(credit && credit.charged) || 0;
  const found = Number(credit && credit.found);
  const paid = Number.isFinite(found) && found >= 0 ? Math.min(charged, found) : charged;
  const requested = Number(credit && credit.requested) || 0;
  const missed = Number.isFinite(found) ? (Number(credit && credit.missed) || 0) : Math.max(0, requested - paid);
  const insufficient = !!(credit && credit.insufficient);
  const left = Number(credit && credit.unpaid) || 0;
  if (!insufficient && charged <= 0 && left <= 0) { box.hidden = true; box.innerHTML = ''; return; }
  const msg = t(insufficient ? 'calllogs.creditPartial' : 'calllogs.creditCharged')
    .replace('{f}', paid).replace('{n}', Math.max(paid + missed, requested))
    .replace('{c}', charged).replace('{m}', missed).replace('{z}', left);
  box.hidden = false;
  box.className = 'cl-up-resolve' + (insufficient ? ' warn' : '');
  box.innerHTML = `<i class="fas ${insufficient ? 'fa-triangle-exclamation' : 'fa-circle-check'}"></i> ${histEsc(msg)}` +
    ` · <a href="/topup.html" style="color:inherit;text-decoration:underline"><i class="fas fa-wallet"></i> ${histEsc(t('calllogs.topupNow'))}</a>`;
}

// ============================================
// Phiên làm việc hiện tại (giữ qua F5 trong cùng tab)
// ============================================
// Dữ liệu rút list lưu trong sessionStorage → F5 vẫn còn, đóng tab là mất.
// Muốn xem lại sau khi thoát: vào tab Lịch sử tra cứu, bấm 1 dòng hàng loạt.
const SESSION_LOGS_KEY = 'ct_session_logs';
const SESSION_LOGS_MAX = 2000;

// Lưu phiên: GIỮ NGUYÊN toạ độ + cờ `_charged` / `_fromHistory` (trước đây bị lược bỏ
// → F5 xong mất kết quả đã trả phí và bị trừ điểm lại).
function saveCallSession() {
  try {
    if (!myLogsCache.length) return;
    const rows = myLogsCache.slice(0, SESSION_LOGS_MAX).map(r => ({
      mcc: r.mcc, mnc: r.mnc, lac: r.lac, cellid: r.cellid, sector: r.sector,
      lat: r.lat, lon: r.lon, cell_range: r.cell_range, radio: r.radio, source: r.source,
      timestamp: r.timestamp, network: r.network, action_type: r.action_type,
      phone_number: r.phone_number, contact_number: r.contact_number,
      cell_address: r.cell_address, duration: r.duration, batch_id: r.batch_id,
      _charged: !!r._charged, _fromHistory: !!r._fromHistory, _resolvedOnline: !!r._resolvedOnline
    }));
    const payload = {
      v: 2, at: Date.now(),
      fileName: currentUploadFileName || '',
      batchId: currentOpenBatchId || '',
      rows
    };
    sessionStorage.setItem(SESSION_LOGS_KEY, JSON.stringify(payload));
  } catch (e) { /* quota / chế độ riêng tư: bỏ qua */ }
  // Đồng thời lưu toạ độ đã trả phí lên phiên server (gộp 800ms) — sessionStorage
  // mất khi đóng tab / đổi máy.
  saveCallSessionResolved(currentOpenBatchId || (clAnalyze && clAnalyze.batchId));
}

function loadCallSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_LOGS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.rows) || !data.rows.length) return null;
    return data;
  } catch (e) { return null; }
}

function clearCallSession() {
  try { sessionStorage.removeItem(SESSION_LOGS_KEY); } catch (e) {}
}

// Khôi phục cờ `_charged` từ phiên đang giữ (sessionStorage) sang list vừa nạp
// từ server — tránh trừ điểm 2 lần cho cùng cell sau F5. So khớp theo canonical key.
function restoreChargedFlags() {
  const sess = loadCallSession();
  if (!sess || !Array.isArray(sess.rows) || !myLogsCache.length) return;
  const charged = new Set();
  for (const r of sess.rows) {
    if (r && r._charged) { charged.add(`${r.mcc}-${r.mnc}-${r.lac}-${r.cellid}`); charged.add(canonicalClientKey(r)); }
  }
  if (!charged.size) return;
  for (const row of myLogsCache) {
    if (charged.has(`${row.mcc}-${row.mnc}-${row.lac}-${row.cellid}`) || charged.has(canonicalClientKey(row))) {
      row._charged = true;
    }
  }
}

// Khôi phục toạ độ của các cell ĐÃ TRẢ PHÍ từ phiên đang giữ sau F5: server không
// lưu toạ độ trong call_logs, nếu không gắn lại thì list mất kết quả và bản đồ trống.
function restoreSessionCoords() {
  const sess = loadCallSession();
  if (!sess || !Array.isArray(sess.rows) || !myLogsCache.length) return;
  const byKey = new Map();
  for (const r of sess.rows) {
    if (!r || (r.lat == null && r.lon == null)) continue;
    byKey.set(`${r.mcc}-${r.mnc}-${r.lac}-${r.cellid}`, r);
    byKey.set(canonicalClientKey(r), r);
  }
  if (!byKey.size) return;
  for (const row of myLogsCache) {
    const hit = byKey.get(`${row.mcc}-${row.mnc}-${row.lac}-${row.cellid}`) || byKey.get(canonicalClientKey(row));
    if (!hit) continue;
    if (row.lat == null) {
      row.lat = hit.lat; row.lon = hit.lon; row.cell_range = hit.cell_range;
      if (hit.source) row.source = hit.source;
    }
    if (hit._charged) row._charged = true;
  }
}

async function uploadCallLogExcel(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  // Nhớ tên file để ghi vào metadata nhóm lịch sử tra cứu hàng loạt.
  currentUploadFileName = file.name || '';

  setClUpStep('busy');
  const nameEl = document.getElementById('clUpFileName');
  const status = document.getElementById('callLogUploadStatus');
  const fill = document.getElementById('callLogUploadProgressFill');
  if (nameEl) nameEl.textContent = currentUploadFileName;
  if (status) status.textContent = 'Đang tải...';
  if (fill) fill.style.width = '5%';

  try {
    const fd = new FormData();
    fd.append('file', file);
    const network = document.getElementById('networkSelect')?.value || 'auto';
    fd.append('network', network);
    const token = Auth.getToken();
    const r = await fetch('/api/call-logs/upload', {
      method: 'POST',
      headers: token ? { 'Authorization': 'Bearer ' + token } : {},
      body: fd
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Upload failed');
    if (fill) fill.style.width = '100%';
    if (status) status.textContent = 'Hoàn tất';
    if (data.network && document.getElementById('networkSelect')) {
      const sel = document.getElementById('networkSelect');
      const v = data.network.toLowerCase();
      if ([...sel.options].some(o => o.value === v)) sel.value = v;
    }
    showToast(`Upload ${data.network}: ${data.inserted || 0} bản ghi`, data.inserted > 0 ? 'success' : 'error');
    // Nạp bản ghi mới vào list (không hỏi tra) rồi chuyển popup sang bước xác nhận.
    // Hoãn vẽ bản đồ: kết quả tra chỉ hiện SAU khi user bấm "Đồng ý tra cứu".
    clMapDeferred = true;
    await loadCallLogs({ prompt: false });
    setClUpStep('confirm');
    await renderClConfirm({ total: data.total, inserted: data.inserted, errors: data.errors });
  } catch (e) {
    showToast('Upload thất bại: ' + e.message, 'error');
    if (status) status.textContent = 'Lỗi';
    setClUpStep('pick');
  }
}

async function loadCallLogs(opts) {
  const prompt = !(opts && opts.prompt === false);
  try {
    // Lấy theo phân trang server để không bỏ sót bản ghi khi batch > 500.
    // Mọi phiên hiện ở tab Lịch sử, nên chỉ cần nạp phiên mới nhất vào list này.
    const resp = await apiRequest('GET', '/api/call-logs?page=1&limit=2000');
    const rows = Array.isArray(resp) ? resp : (resp.data || []);
    if (rows.length) {
      myLogsCache = rows;
      myLogsCache._restored = false;
      // Phiên mới nhất trên server → đây là phiên đang xem (nút "Xoá phiên" xoá nó).
      currentOpenBatchId = (myLogsCache[0] && myLogsCache[0].batch_id) || '';
      if (!currentUploadFileName) currentUploadFileName = myLogsCache[0] ? (myLogsCache[0].file_name || '') : '';
      logPageIndex = 1;
      // Server không lưu cờ `_charged` (nó là trạng thái của phiên làm việc) →
      // khôi phục từ sessionStorage để F5 không bị trừ điểm lần 2 cho cùng cell.
      restoreChargedFlags();
      // Cell đã trả phí trong phiên này → giữ toạ độ từ session (server call_logs
      // không có cột toạ độ) để không phải tra lại.
      restoreSessionCoords();
      document.getElementById('logSearchInput').value = '';
      renderCallLogs();
      saveCallSession();
      // Hỏi user trước khi tra (ước tính điểm) thay vì tự động trừ — tránh cháy tài khoản.
      // Luồng nạp Excel tự quản lý popup xác nhận nên truyền prompt:false.
      if (prompt && typeof showResolvePrompt === 'function') await showResolvePrompt();
    } else {
      // Server không có bản ghi → khôi phục phiên làm việc đang giữ (F5 trong tab).
      const sess = loadCallSession();
      if (sess) {
        myLogsCache = sess.rows;
        myLogsCache._restored = true;
        currentOpenBatchId = sess.batchId || (myLogsCache[0] && myLogsCache[0].batch_id) || '';
        currentUploadFileName = sess.fileName || currentUploadFileName;
        logPageIndex = 1;
        renderCallLogs();
      } else {
        myLogsCache = [];
        renderCallLogs();
      }
    }
  } catch (e) {
    document.getElementById('logRecordList').innerHTML = '<div style="color:var(--text-faint)">Lỗi tải nhật ký</div>';
  }
}

// User chủ động xoá phiên đang giữ → list trống, mời tải Excel hoặc mở từ Lịch sử.
// Xoá CẢ phiên local (sessionStorage) lẫn toàn bộ bản ghi rút list của user trên server.
async function resetCallSession() {
  const ok = await openConfirmDialog({
    title: t('confirm.delSessionTitle'),
    message: t('calllogs.confirmReset'),
    detail: currentUploadFileName ? [{ k: t('confirm.fileLabel'), v: currentUploadFileName }] : [],
    warnings: [
      t('confirm.warnPermanent'),
      t('confirm.warnAllRecords'),
      t('confirm.warnServerToo')
    ],
    notes: [t('confirm.noteHistoryGone')],
    okText: t('confirm.okDelete')
  });
  if (!ok) return;
  clearCallSession();
  myLogsCache = [];
  currentOpenBatchId = '';
  logPageIndex = 1;
  skipResolve();
  const notice = document.getElementById('clCreditNotice');
  if (notice) { notice.style.display = 'none'; notice.innerHTML = ''; }
  renderCallLogs();
  try {
    await apiRequest('DELETE', '/api/call-logs');
  } catch (e) {
    // Không có phiên đăng nhập hoặc lỗi mạng → phiên local vẫn đã xoá; báo nhẹ.
    showToast('Đã xoá phiên trên máy — không xoá được bản ghi server: ' + (e.message || ''), 'error');
    return;
  }
  showToast(t('calllogs.sessionCleared'), 'success');
}

// Mở 1 lần tra theo list (từ Lịch sử / phiên đã lưu) → tab "Tra cứu danh sách" + BẢNG cell.
// ĐÃ GỘP về `openCallLogSession`: trước đây hàm này tự dựng danh sách từ bảng cell và
// gọi `/api/lookup-history/batch/:id/cells`, trong khi danh sách phiên (nút hist-session-acts)
// lại gọi `openCallLogSession` → 2 đường cho 2 kết quả khác nhau (đường cũ không mở
// được phiên chỉ có metadata). Giữ tên hàm cho chỗ gọi cũ.
async function openCallLogsFromHistory(rows, fileName, batchId) {
  if (batchId) return openCallLogSession(batchId);
  // Không có batch_id (dữ liệu lịch sử rời) → hiển thị trực tiếp các cell đã có toạ độ
  // như trước (miễn phí, không gọi server).
  const arr = Array.isArray(rows) ? rows : [];
  myLogsCache = arr.filter(r => r.lat != null && r.lng != null).map(r => ({
    mcc: r.mcc, mnc: r.mnc, lac: r.lac, cellid: r.cellid, sector: r.sector,
    lat: r.lat, lon: r.lng, cell_range: r.range,
    radio: r.radio, source: r.source,
    timestamp: r.created_at || '', network: currentUploadFileName || '',
    action_type: '', phone_number: '', contact_number: '', cell_address: '', duration: '',
    _fromHistory: true, _charged: true, _resolvedOnline: r.source !== 'local'
  }));
  myLogsCache._restored = true;
  myLogsCache._fromHistoryOpened = true;
  currentOpenBatchId = '';
  currentUploadFileName = fileName || '';
  logPageIndex = 1;
  clActionFilter = 'all';
  document.querySelectorAll('#clActionChips .cl-chip').forEach(c => c.classList.toggle('active', c.dataset.action === 'all'));
  // Phiên mới → bỏ lọc trạng thái cell (giữ lại sẽ khiến danh sách trống khó hiểu).
  clCellStatusFilter = 'all';
  document.querySelectorAll('#clRecordStatusChips .cl-chip').forEach(c => c.classList.toggle('active', c.dataset.status === 'all'));
  const df = document.getElementById('dateFrom'); if (df) df.value = '';
  const dt = document.getElementById('dateTo'); if (dt) dt.value = '';
  syncClDateButtons();
  const si = document.getElementById('logSearchInput'); if (si) si.value = '';
  const notice = document.getElementById('clCreditNotice');
  if (notice) { notice.style.display = 'none'; notice.innerHTML = ''; }
  switchTab('calllogs');
  // Không mở popup: hiện ngay kết quả đã tra trước đó (không trừ điểm).
  openClResolveForRestore();
  showToast(t('hist.openedAsCallLogs').replace('{n}', myLogsCache.length), 'success');
}

// Lấy bảng cell của 1 batch từ server. `kind`: 'lookup' (Lịch sử tra cứu) hoặc
// 'session' (Phiên rút list). Trả `{ cells, resolvedCells, fileName, network, totalRows,
// batchId }` (cells rỗng nếu lỗi). `resolvedCells` = toạ độ đã trả phí lưu trong phiên
// → truyền tiếp vào clCellsFromSource để cell đã trả phí không bị hiện "chưa tra".
async function clLoadBatchCells(batchId, kind) {
  const empty = { cells: [], resolvedCells: [] };
  if (!batchId) return empty;
  const base = kind === 'session'
    ? '/api/call-log-sessions/' + encodeURIComponent(batchId) + '/cells'
    : '/api/lookup-history/batch/' + encodeURIComponent(batchId) + '/cells';
  try {
    const data = await apiRequest('GET', base);
    if (!data) return empty;
    // Toạ độ đã trả phí lưu theo phiên (server) → ghép vào cell nếu lookup_history
    // chưa có (vd. mở phiên ở máy khác sau khi đã tra).
    const resolved = Array.isArray(data.resolvedCells) ? data.resolvedCells : [];
    const cells = Array.isArray(data.cells) ? data.cells.slice() : [];
    if (resolved.length) {
      const byKey = new Map();
      for (const r of resolved) {
        if (r && r.lat != null && r.lng != null) byKey.set(canonicalClientKey(r), r);
      }
      for (const c of cells) {
        if (c.state === 'found') continue;
        const hit = byKey.get(canonicalClientKey(c));
        if (!hit) continue;
        c.state = 'found'; c.lat = hit.lat; c.lng = hit.lng;
        c.range = hit.range != null ? hit.range : null;
        c.source = hit.source || ''; c.radio = c.radio || hit.radio || '';
      }
    }
    return {
      cells, resolvedCells: resolved,
      fileName: data.fileName || '', network: data.network || '',
      totalRows: Number(data.totalRows) || 0, batchId: data.batchId || batchId
    };
  } catch (e) {
    return empty;
  }
}

// Mở lại dữ liệu phục hồi (từ Lịch sử / phiên đã lưu): hiện NGAY kết quả đã tra
// trước đó trên bản đồ, KHÔNG mở popup và KHÔNG trừ điểm. Cell chưa tra được
// (do trước đó hết điểm) không có toạ độ nên tự động không hiện.
function openClResolveForRestore() {
  clMapDeferred = false;
  renderCallLogs();
}

// Hiển thị NGAY các cell đã tra ra toạ độ của lô đang xem (bảng Excel) lên bản đồ.
// Nối tiếp của nút trước đây trong panel: hiện tại chỉ đọc `clAnalyze.results` nên
// không bao giờ vẽ cell chưa trả phí (`unpaid` / `miss`) — an toàn về tính điểm.
function clPlotResultsOnMap() {
  if (!clAnalyze) return;
  const found = clAnalyze.rows.filter(c => {
    const r = clAnalyze.results[c.key];
    return r && r.state === 'found' && r.lat != null && r.lon != null;
  });
  if (!found.length) { showToast(t('calllogs.mapNone'), 'error'); return; }
  const records = found.map(c => {
    const r = clAnalyze.results[c.key];
    return {
      mcc: c.mcc, mnc: c.mnc, lac: c.lac, cellid: c.cellid, sector: c.sector,
      lat: r.lat, lon: r.lon, cell_range: r.range,
      radio: c.radio || r.radio || '', source: r.source || '',
      timestamp: '', network: clAnalyze.network || '',
      action_type: '', phone_number: '', contact_number: '', cell_address: '', duration: '',
      batch_id: clAnalyze.batchId || '', _charged: true,
      _resolvedOnline: (r.source || '') !== 'local'
    };
  });
  // Giữ bản ghi gốc của lô (nếu đã nạp) để không mất số liệu cuộc gọi, rồi nối thêm
  // cell vừa tra được — dedup theo canonical key để 1 cell không hiện 2 marker.
  const seen = new Set(records.map(r => canonicalClientKey(r)));
  myLogsCache = myLogsCache.filter(l => !seen.has(canonicalClientKey(l))).concat(records);
  myLogsCache._restored = true;
  myLogsCache._fromHistoryOpened = false;
  // Gán phiên đang mở theo bảng cell → danh sách bản ghi biết thuộc phiên nào (dòng
  // "cell-only", tô sáng card phiên ở tab Lịch sử, làm mới card sau khi tra).
  if (!currentOpenBatchId && clAnalyze.batchId) currentOpenBatchId = clAnalyze.batchId;
  if (!currentUploadFileName && clAnalyze.fileName) currentUploadFileName = clAnalyze.fileName;
  logPageIndex = 1;
  // Đóng bảng cell để thấy bản đồ, rồi vẽ lại danh sách (plotCallLogs căn theo
  // vùng không bị sidebar che).
  closeClTableOverlay();
  switchTab('calllogs');
  renderCallLogs();
  saveCallSession();
  // Danh sách phiên ở tab Lịch sử đang mở → cập nhật tô sáng/thời gian phiên.
  if (document.getElementById('tab-lookuphistory')?.classList.contains('active')) {
    loadHistBatches(histBatch.page || 1);
  }
}

// Canonical cell key: collapse short-cellid / ECI aliases (e.g. 662091 & 169495296)
// so client dedup matches server memo. Mirrors canonicalCellKey on the server.
function canonicalClientKey(c) {
  const raw = String(c.cellid == null ? '' : c.cellid);
  let cid = raw;
  try {
    if (typeof parseCellId === 'function') {
      const p = parseCellId(raw);
      if (p && p.isShort && p.eci != null && String(p.eci) !== raw) cid = String(p.eci);
    }
  } catch (e) { /* keep raw */ }
  return `${c.mcc}-${c.mnc}-${c.lac}-${cid}`;
}

// Ngược lại canonicalClientKey: tách key dạng `mcc-mnc-lac-cellid` (cellid có thể
// chứa dấu `-`) thành object cell để chuẩn hoá tiếp.
function keyToCell(key) {
  const s = String(key == null ? '' : key);
  const parts = s.split('-');
  return { mcc: parts[0], mnc: parts[1], lac: parts[2], cellid: parts.slice(3).join('-') };
}

// Mở popup nạp Excel (dùng cho nút Load Excel + empty-state).
function openClUploadModal() {
  setClUpStep('pick');
  document.getElementById('clUploadModal')?.classList.add('show');
}

function closeClUploadModal() {
  document.getElementById('clUploadModal')?.classList.remove('show');
}

// Chuyển popup giữa 3 bước: pick (chọn file) / busy (đang tải) / confirm (xác nhận tra).
function setClUpStep(name) {
  const map = { pick: 'clUpStepPick', busy: 'clUpStepBusy', confirm: 'clUpStepConfirm' };
  for (const k of Object.keys(map)) {
    const el = document.getElementById(map[k]);
    if (el) el.hidden = (k !== name);
  }
}

// Ước tính số cell cần tra + cảnh báo điểm cho bước xác nhận.
// Trả về {enough, cost, need, balance}; hiển thị vào #clUpResolve và chỉnh nút confirm.
async function renderClConfirm(stats) {
  const statsBox = document.getElementById('clUpStats');
  const box = document.getElementById('clUpResolve');
  const confirmBtn = document.getElementById('clUpConfirmBtn');
  const skipBtn = document.getElementById('clUpSkipBtn');
  if (!box || !statsBox) return;

  const s = stats || {};
  if (s.total !== undefined) {
    statsBox.innerHTML =
      `<div class="cl-up-stat"><b>${s.total || 0}</b><span>${histEsc(t('calllogs.statTotal'))}</span></div>` +
      `<div class="cl-up-stat ok"><b>${s.inserted || 0}</b><span>${histEsc(t('calllogs.statInserted'))}</span></div>` +
      `<div class="cl-up-stat err"><b>${s.errors || 0}</b><span>${histEsc(t('calllogs.statErrors'))}</span></div>`;
  } else {
    statsBox.innerHTML = '';
  }

  const need = countResolveNeeded();
  const n = need.length;
  const hasCoords = myLogsCache.filter(r => r.lat && r.lon).length;
  const fromHist = myLogsCache.filter(r => r._fromHistory).length;

  if (skipBtn) skipBtn.innerHTML = n > 0
    ? `<i class="fas fa-forward"></i> ${histEsc(t('calllogs.skipBtn'))}`
    : `<i class="fas fa-forward"></i> ${histEsc(t('calllogs.closeBtn'))}`;

  // Không có cell cần tra → không hiện chi phí, nút chỉ đóng.
  if (n === 0) {
    box.className = 'cl-up-resolve free';
    box.innerHTML = `<i class="fas fa-circle-check"></i> ${histEsc(fmtTpl('calllogs.nothingToResolve', {
      r: myLogsCache.length, c: hasCoords, h: fromHist
    }))}`;
    if (confirmBtn) confirmBtn.style.display = 'none';
    return;
  }

  // Giá + số dư: số dư PHẢI làm mới từ server (user có thể vừa nạp điểm ở tab
  // khác) — chỉ dùng cache khi refresh lỗi mạng. Trước đây chỉ refresh khi cache
  // `null` nên nạp điểm xong nút "Đồng ý tra cứu" vẫn bị khoá ở số dư cũ.
  let cost = clCreditCost();
  let creditOn = true;
  try {
    if (typeof Auth.getCreditConfig === 'function') {
      const cfg = await Auth.getCreditConfig();
      if (cfg) { cost = clCreditCost(cfg); creditOn = clCreditOn(cfg); }
    }
  } catch (e) { /* dùng cost mặc định */ }
  let balance = null;
  if (typeof Auth.refreshCreditBalance === 'function') {
    balance = await Auth.refreshCreditBalance();
  }
  if (balance == null) balance = Auth.getCreditBalance();
  balance = Number(balance) || 0;

  const total = n * cost;
  const enough = !creditOn || cost <= 0 || balance >= cost;
  const enoughAll = !creditOn || cost <= 0 || balance >= total;
  box.className = 'cl-up-resolve' + (enough ? '' : ' warn');
  box.innerHTML =
    `<div><i class="fas fa-gem"></i> ${histEsc(fmtTpl(creditOn ? 'calllogs.resolveNeed' : 'calllogs.confirmFreeMode', {
      n, c: cost, t: total, b: balance
    }))}</div>` +
    (enough ? '' : `<div class="cl-up-warn"><i class="fas fa-triangle-exclamation"></i> ${
      histEsc(fmtTpl('calllogs.notEnough', { t: cost, n }))}</div>`) +
    (enough && !enoughAll ? `<div class="cl-up-warn"><i class="fas fa-triangle-exclamation"></i> ${
      histEsc(fmtTpl('calllogs.confirmNoCredits', { b: balance, n, t: total }))}` +
      ` <a href="/topup.html" style="color:inherit;text-decoration:underline"><i class="fas fa-wallet"></i> ${histEsc(t('calllogs.topupBtn'))}</a></div>` : '');
  if (confirmBtn) {
    confirmBtn.style.display = '';
    confirmBtn.disabled = !enough;
  }
}

// Nạp điểm ở tab `/topup.html` rồi quay lại: xác nhận lại số dư để mở khoá nút
// "Đồng ý tra cứu" ngay khi cửa sổ được focus trở lại (bước confirm đang mở).
if (!window._clConfirmFocusBound) {
  window._clConfirmFocusBound = true;
  const rebind = () => {
    const stepConfirm = document.getElementById('clUpStepConfirm');
    const modal = document.getElementById('clUploadModal');
    const open = modal && modal.classList.contains('show') &&
      stepConfirm && !stepConfirm.hidden;
    if (open) renderClConfirm().catch(() => {});
    // Overlay bảng cell cũng cần cập nhật số dư sau khi nạp điểm.
    const sheet = document.getElementById('clTableOverlay');
    if (sheet && sheet.classList.contains('show') && clAnalyze) {
      renderClSheetResolve().catch(() => {});
    }
  };
  window.addEventListener('focus', rebind);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) rebind(); });
}

// Nút "Tra cứu ngay" cố định ở topbar: hiện khi còn cell chưa tra (đã chọn / bị bỏ
// dở vì hết điểm) trong bảng cell ĐANG MỞ. Cần thiết vì popup xác nhận không tự mở
// lại sau khi user rời trang đi nạp điểm.
function updateClResolveNowBtn() {
  const btn = document.getElementById('clResolveNowBtn');
  const cnt = document.getElementById('clResolveNowCount');
  if (!btn) return;
  const n = clUnpaidCount();
  if (!n) { btn.style.display = 'none'; return; }
  btn.style.display = '';
  if (cnt) { cnt.textContent = String(n); cnt.classList.add('show'); }
}

// Số cell của bảng đang mở còn phải trả phí (chưa có kết quả): gồm cả cell bị dừng
// giữa chừng vì hết điểm (state=unpaid) lẫn cell chưa từng tra.
function clUnpaidCount() {
  if (!clAnalyze) return 0;
  let n = 0;
  for (const c of clAnalyze.rows) {
    const r = clAnalyze.results[c.key];
    if (!r || (r.state !== 'found' && r.state !== 'miss')) n++;
  }
  return n;
}

// Nút "Đồng ý tra cứu" trong popup + nút "Tra cứu ngay" ở topbar: đóng popup (nếu
// đang mở) rồi tra các cell còn thiếu toạ độ. Chỉ từ đây kết quả tra mới được vẽ lên
// bản đồ (bỏ cờ hoãn).
function confirmClResolve() {
  closeClUploadModal();
  clMapDeferred = false;
  resolveUnmatchedCells().catch(() => {});
}

// Nút "Bỏ qua"/"Đóng": đóng popup, không tra. Chỉ hiện những cell ĐÃ có quyền xem
// (đã trả phí trong phiên hoặc mở từ Lịch sử) — cell chưa trả phí không được lộ
// toạ độ ra bản đồ (điều kiện này nằm sẵn trong `plotCallLogs`).
function skipClResolve() {
  closeClUploadModal();
  clMapDeferred = false;
  renderCallLogs();
}

// Popup hướng dẫn tính năng tab "Tra cứu danh sách" (giữ cho nơi khác gọi; nút "Hướng dẫn"
// trên tab đã thay bằng nút ? mở openClPickHelp).
function openClGuideModal() {
  document.getElementById('clGuideModal')?.classList.add('show');
}

function closeClGuideModal() {
  document.getElementById('clGuideModal')?.classList.remove('show');
}

// Kéo-thả file vào dropzone của popup → nạp qua cùng luồng upload.
(function initClUpDrop() {
  const wire = () => {
    const drop = document.getElementById('clUpDrop');
    const input = drop && drop.querySelector('input[type=file]');
    if (!drop || !input) return;
    ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => {
      e.preventDefault(); drop.classList.add('dragover');
    }));
    ['dragleave', 'dragend'].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove('dragover')));
    drop.addEventListener('drop', e => {
      e.preventDefault(); drop.classList.remove('dragover');
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) uploadCallLogExcel({ target: { files: [f], value: '' } });
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
})();

// Đếm số cell CẦN tra (unique theo canonical key, bỏ dòng đến từ Lịch sử / đã
// trả phí trong phiên / thiếu mcc-lac-cellid). Dùng cho ước tính điểm trước khi tra.
// LƯU Ý: cell đã có toạ độ sẵn trong CSDL nội bộ VẪN phải tính điểm — luật là
// "tra ra kết quả là trừ điểm", không phân biệt nguồn local hay online.
function countResolveNeeded() {
  const seen = new Set();
  const list = [];
  for (const r of myLogsCache) {
    // Dữ liệu mở từ Lịch sử: đã được tra trước đó, không tiêu credit tra lại.
    if (r._fromHistory) continue;
    // Đã trả phí cho cell này trong phiên hiện tại (kể cả sau F5) → không trả lại.
    if (r._charged) continue;
    if (!r.mcc || !r.lac || !r.cellid) continue;
    const key = canonicalClientKey(r);
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({ mcc: r.mcc, mnc: r.mnc, lac: r.lac, cellid: r.cellid, sector: r.sector });
  }
  return list;
}

// Luồng phục hồi/mở lại từ Lịch sử: mở popup ở bước xác nhận (không chọn file).
// Dữ liệu `_fromHistory` được countResolveNeeded bỏ qua → không trừ điểm khi phục hồi.
async function showResolvePrompt() {
  const box = document.getElementById('clResolvePrompt');
  if (box) { box.style.display = 'none'; box.innerHTML = ''; }
  const notice = document.getElementById('clCreditNotice');
  if (notice) { notice.style.display = 'none'; notice.innerHTML = ''; }
  if (countResolveNeeded().length === 0) return;
  if (typeof Auth === 'undefined' || !Auth.isLoggedIn || !Auth.isLoggedIn()) return;
  setClUpStep('confirm');
  document.getElementById('clUploadModal')?.classList.add('show');
  await renderClConfirm(null);
}

function skipResolve() {
  closeClUploadModal();
  const box = document.getElementById('clResolvePrompt');
  if (box) { box.style.display = 'none'; box.innerHTML = ''; }
}

function startResolveFromPrompt() {
  skipResolve();
  resolveUnmatchedCells().catch(() => {});
}

// Hiện kết quả sau khi tra: đã tra được bao nhiêu cell (đã trừ điểm), bao nhiêu
// cell không ra kết quả, và bao nhiêu cell chưa tra vì hết điểm.
function showResolveResult(credit) {
  const notice = document.getElementById('clCreditNotice');
  if (!notice) return;
  const charged = Number(credit && credit.charged) || 0;
  // Số cell tra RA kết quả + đã trả phí trong lần tra này (server trả `found`).
  const found = Number(credit && credit.found);
  const paid = Number.isFinite(found) && found >= 0 ? Math.min(charged, found) : charged;
  const requested = Number(credit && credit.requested) || 0;
  // Cell không ra kết quả = số cell đã hỏi hết nguồn mà vẫn miss.
  const missed = Number.isFinite(found) ? Number(credit && credit.missed) || 0 : Math.max(0, requested - paid);
  const insufficient = !!(credit && credit.insufficient);
  // Cell chưa tra vì hết điểm: server báo `unpaid`, fallback = phần vượt số dư.
  const unpaidServer = Number(credit && credit.unpaid);
  const left = Number.isFinite(unpaidServer) && unpaidServer > 0
    ? unpaidServer : countResolveNeeded().length;
  if (!insufficient && charged <= 0 && left <= 0) { notice.style.display = 'none'; notice.innerHTML = ''; return; }

  const msg = t(insufficient ? 'calllogs.creditPartial' : 'calllogs.creditCharged')
    .replace('{f}', paid).replace('{n}', Math.max(paid + missed, requested))
    .replace('{c}', charged).replace('{m}', missed).replace('{z}', left);
  notice.className = 'cl-credit-notice' + (insufficient ? '' : ' ok');
  notice.style.display = '';
  // Panel bộ lọc chứa thông báo này — mở ra để user luôn thấy kết quả trừ điểm.
  const panel = document.getElementById('callLogFilterPanel');
  if (panel && panel.classList.contains('hidden')) toggleCallLogFilters();
  notice.innerHTML =
    `<i class="fas ${insufficient ? 'fa-triangle-exclamation' : 'fa-circle-check'}"></i> ${histEsc(msg)}` +
    ` · <a href="/topup.html"><i class="fas fa-wallet"></i> ${histEsc(t('calllogs.topupNow'))}</a>`;
}

async function resolveUnmatchedCells() {
  // Find unique cells with null lat/lon (dedup by canonical key).
  const unresolved = countResolveNeeded();
  // Bắt đầu tra → cho phép vẽ kết quả lên bản đồ (kể cả khi không còn cell cần tra,
  // để kết quả đã có toạ độ hiện ngay trên bản đồ).
  clMapDeferred = false;
  if (unresolved.length === 0) {
    renderCallLogs();
    return;
  }

  // Two-phase server resolve: local-first, then a budget-limited online pass.
  // When the server reports pending work, re-request with the still-unresolved
  // cells (bounded retries as a safety net against very large files).
  const resolvedMap = {};
  const MAX_ROUNDS = 5;
  let batch = unresolved;
  // Tích luỹ credit qua các vòng (server trả `credit` mỗi lần).
  const credit = { charged: 0, requested: 0, found: 0, missed: 0, unpaid: 0, balance: null, insufficient: false };
  // Một uploadId dùng chung cho MỌI vòng → các vòng resolve gộp về 1 nhóm lịch sử.
  const uploadId = 'up' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  try {
    for (let round = 0; round < MAX_ROUNDS && batch.length > 0; round++) {
      const resp = await apiRequest('POST', '/api/cells/resolve-batch',
        { cells: batch, uploadId, fileName: currentUploadFileName, roundIdx: round });
      if (resp && resp.credit) {
        credit.charged += Number(resp.credit.charged) || 0;
        credit.requested += Number(resp.credit.requested) || 0;
        credit.found += Number(resp.credit.found) || 0;
        credit.missed += Number(resp.credit.missed) || 0;
        // Vòng mới tiếp tục phần chưa trả phí → lấy số lớn nhất (không cộng dồn
        // cùng một cell qua nhiều vòng retry).
        credit.unpaid = Math.max(credit.unpaid, Number(resp.credit.unpaid) || 0);
        if (resp.credit.balance != null) credit.balance = resp.credit.balance;
        if (resp.credit.insufficient) credit.insufficient = true;
      }
      if (!resp.results) break;
      const stillPending = [];
      for (const r of resp.results) {
        // Cell vượt số dư (server ẩn toạ độ, `unpaid:true`): KHÔNG nhận kết quả,
        // để lại chờ nạp điểm rồi tra tiếp — không coi là miss.
        if (r.unpaid) { continue; }
        if (r.lat && r.lon) {
          resolvedMap[r.key] = r;
          resolvedMap[canonicalClientKey({ mcc: r.key.split('-')[0], mnc: r.key.split('-')[1], lac: r.key.split('-')[2], cellid: r.key.split('-').slice(3).join('-') })] = r;
        } else {
          stillPending.push(r.key);
        }
      }
      // Đánh dấu `_charged` cho mọi cell server báo đã tính phí (tra ra kết quả)
      // → F5/Đồng ý lại không trả phí lần 2 cho cùng cell trong phiên.
      if (resp.results.some(r => r.charged)) {
        const chargedSet = new Set();
        for (const r of resp.results) {
          if (r.charged) { chargedSet.add(r.key); chargedSet.add(canonicalClientKey(keyToCell(r.key))); }
        }
        for (const row of myLogsCache) {
          if (chargedSet.has(`${row.mcc}-${row.mnc}-${row.lac}-${row.cellid}`) ||
              chargedSet.has(canonicalClientKey(row))) row._charged = true;
        }
      }
      if (!resp.pending || stillPending.length === 0) break;
      // Hết điểm giữa lô → dừng ngay, không gọi vòng kế (vòng sau cũng không đủ điểm).
      if (credit.insufficient) break;
      // Re-map pending keys back to cell objects for the next round.
      const pendingSet = new Set(stillPending);
      batch = batch.filter(c => pendingSet.has(`${c.mcc}-${c.mnc}-${c.lac}-${c.cellid}`));
    }

    if (Object.keys(resolvedMap).length === 0) {
      // Không tra được cell nào — vẫn hiện thông báo điểm (nếu có) rồi thôi.
      showResolveResult(credit);
      return;
    }
    // Update myLogsCache with resolved data (match by raw or canonical key).
    // Không bỏ qua dòng đã có toạ độ: cell local vẫn cần nhận `_charged` + dấu
    // `_resolvedOnline` để biết đã trả phí trong phiên.
    for (const row of myLogsCache) {
      const key = `${row.mcc}-${row.mnc}-${row.lac}-${row.cellid}`;
      const resolved = resolvedMap[key] || resolvedMap[canonicalClientKey(row)];
      if (resolved) {
        row.lat = resolved.lat;
        row.lon = resolved.lon;
        row.cell_range = resolved.range;
        row._resolvedOnline = true;
      }
    }
    // Re-render with newly resolved data
    renderCallLogs();
    saveCallSession();
    showResolveResult(credit);
  } catch (e) {
    // Lỗi mạng/402 giữa chừng: vẫn vẽ những gì đã tra được + báo lỗi điểm (nếu có).
    clMapDeferred = false;
    renderCallLogs();
    if (credit.charged > 0 || credit.insufficient) showResolveResult(credit);
  }
}

function applyCallLogFilters() {
  logPageIndex = 1;
  updateClFilterBadge();
  syncClDateButtons();
  renderCallLogs();
}

// Xoá cả khoảng ngày rồi áp lại lọc.
function clearCallLogDate() {
  const df = document.getElementById('dateFrom');
  const dt = document.getElementById('dateTo');
  if (df) df.value = '';
  if (dt) dt.value = '';
  clCal.from = '';
  clCal.pending = '';
  applyCallLogFilters();
  if (clCalOpen) renderClCalendar();
}

// ============================================
// Bảng lịch chọn NGÀY / KHOẢNG NGÀY (1 bảng duy nhất)
// --------------------------------------------
// Trước đây là 2 <input type="date"> native: mỗi input mở 1 bảng lịch riêng, và
// showPicker() bị chặn (NotAllowedError) khi thiếu user-activation nên nhấn vào
// không mở được gì. Nay: 1 nút lịch mở 1 popup lịch tự vẽ.
//   - click 1 ngày rồi bấm "Áp dụng" (hoặc click lần 2 vào CHÍNH ngày đó)
//     → lọc đúng 1 ngày.
//   - click ngày đầu rồi ngày cuối → khoảng [from..to].
// Giá trị cuối vẫn ghi vào #dateFrom/#dateTo (input hidden) để getFilteredLogs
// và mọi code cũ đọc nguyên trạng.
const clCal = { view: '', from: '', pending: '', open: false };
let clCalOpen = false;
// Đang dựng lại innerHTML của popup: sự kiện click đang lan lên document sẽ có
// target đã bị gỡ khỏi DOM → handler "bấm ra ngoài" phải bỏ qua.
let clCalRendering = false;

function clYmd(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function clTodayYmd() { return clYmd(new Date()); }
function clParseYmd(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
// 'YYYY-MM-DD' → 'dd/mm/yyyy' cho nhãn nút.
function clFmtYmd(s) {
  const d = clParseYmd(s);
  if (!d) return '';
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function toggleClDatePicker(ev) {
  if (ev) ev.stopPropagation();
  if (clCalOpen) { closeClDatePicker(); return; }
  const df = document.getElementById('dateFrom');
  const dt = document.getElementById('dateTo');
  clCal.from = (df && df.value) || '';
  clCal.pending = '';
  const base = clCal.from || (dt && dt.value) || clTodayYmd();
  clCal.view = base.slice(0, 7) + '-01';
  const pop = document.getElementById('clCalPop');
  const btn = document.getElementById('clDateBtn');
  if (pop) pop.classList.remove('hidden');
  if (btn) { btn.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
  clCalOpen = true;
  renderClCalendar();
  positionClCalendar();
}

// Canh popup NGAY DƯỚI hàng chip (neo vào .cl-filter-panel nên phải tự tính top):
// lấy đáy của #clActionChips so với panel rồi cộng 6px. Canh cả left theo panel.
// Gọi sau khi popup đã hiện (cần layout) và mỗi lần render lại (chiều cao đổi).
function positionClCalendar() {
  const pop = document.getElementById('clCalPop');
  const panel = document.getElementById('callLogFilterPanel');
  const row = document.getElementById('clActionChips');
  if (!pop || !panel || !row) return;
  const pr = panel.getBoundingClientRect();
  const rr = row.getBoundingClientRect();
  const top = Math.round(rr.bottom - pr.top + 6);
  pop.style.top = top + 'px';
  pop.style.left = '0px';
  // Không cho popup tràn ngang ra ngoài khung chứa.
  pop.style.maxWidth = Math.max(200, Math.round(pr.width)) + 'px';
}

function closeClDatePicker() {
  const pop = document.getElementById('clCalPop');
  const btn = document.getElementById('clDateBtn');
  if (pop) pop.classList.add('hidden');
  if (btn) { btn.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
  clCalOpen = false;
}

// Đóng khi bấm ra ngoài / nhấn Esc.
// Lưu ý: renderClCalendar() dựng lại innerHTML của popup, nên phần tử vừa bị click
// có thể đã bị gỡ khỏi DOM lúc sự kiện nổi lên document → `range.contains(target)`
// trả false và popup tự đóng ngay sau lần chọn ĐẦU TIÊN (lần chọn thứ hai rơi vào
// khoảng trống). Vì vậy: (a) dùng composedPath() để biết click có đi qua popup/filter
// panel hay không, (b) đếm số lần render để bỏ qua sự kiện đang lan từ chính popup.
document.addEventListener('click', (e) => {
  if (!clCalOpen) return;
  const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
  const inRange = path.some(n => n && n.id === 'clDateRange') ||
    (() => { const r = document.getElementById('clDateRange'); return !!(r && e.target && r.contains(e.target)); })();
  // Click phát sinh trong chính đợt này (target đã bị re-render gỡ khỏi DOM) vẫn
  // được coi là click bên trong nếu quá trình render vừa xảy ra.
  if (inRange || clCalRendering) return;
  closeClDatePicker();
});
document.addEventListener('keydown', (e) => {
  if (clCalOpen && e.key === 'Escape') closeClDatePicker();
});
// Xoay máy / đổi bề rộng → hàng chip đổi vị trí, popup phải bám lại.
window.addEventListener('resize', () => { if (clCalOpen) positionClCalendar(); });

// Vẽ lưới lịch của tháng đang xem. Ô ngoài tháng vẫn hiện (mờ) để bấm được.
function renderClCalendar() {
  const pop = document.getElementById('clCalPop');
  if (!pop) return;
  const view = clParseYmd(clCal.view) || new Date();
  const y = view.getFullYear(), m = view.getMonth();
  const first = new Date(y, m, 1);
  // Thứ 2 = cột đầu (ISO). getDay(): CN=0 → đổi về 0..6 với T2=0.
  const shift = (first.getDay() + 6) % 7;
  const gridStart = new Date(y, m, 1 - shift);
  const today = clTodayYmd();
  const a = clCal.from || '';
  const b = clCal.pending || '';
  const lo = a && b ? (a <= b ? a : b) : (a || b);
  const hi = a && b ? (a <= b ? b : a) : '';

  const dows = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const ymd = clYmd(d);
    const other = d.getMonth() !== m;
    const cls = ['cl-cal-day'];
    if (other) cls.push('other');
    if (ymd === today) cls.push('today');
    if (hi && ymd > lo && ymd < hi) cls.push('in-range');
    if (ymd === lo) cls.push('range-start');
    if (ymd === hi && hi !== lo) cls.push('range-end');
    if (ymd === lo && hi && lo === hi) cls.push('range-end');
    cells += `<button type="button" class="${cls.join(' ')}" data-ymd="${ymd}"` +
      ` onclick="clCalPick('${ymd}')">${d.getDate()}</button>`;
  }

  const title = `${String(m + 1).padStart(2, '0')}/${y}`;
  const T = (k, fb) => (typeof t === 'function' ? t(k) : fb);
  clCalRendering = true;
  try {
  pop.innerHTML =
    `<div class="cl-cal-head">` +
      `<button type="button" class="cl-cal-nav" onclick="clCalNav(-12)" title="${histEsc(T('cal.prevYear', 'Năm trước'))}"><i class="fas fa-angles-left"></i></button>` +
      `<button type="button" class="cl-cal-nav" onclick="clCalNav(-1)" title="${histEsc(T('cal.prevMonth', 'Tháng trước'))}"><i class="fas fa-chevron-left"></i></button>` +
      `<span class="cl-cal-title">${title}</span>` +
      `<button type="button" class="cl-cal-nav" onclick="clCalNav(1)" title="${histEsc(T('cal.nextMonth', 'Tháng sau'))}"><i class="fas fa-chevron-right"></i></button>` +
      `<button type="button" class="cl-cal-nav" onclick="clCalNav(12)" title="${histEsc(T('cal.nextYear', 'Năm sau'))}"><i class="fas fa-angles-right"></i></button>` +
    `</div>` +
    `<div class="cl-cal-grid">` +
      dows.map(d => `<span class="cl-cal-dow">${d}</span>`).join('') +
      cells +
    `</div>` +
    `<div class="cl-cal-foot">` +
      `<span class="cl-cal-hint" id="clCalHint"></span>` +
      `<button type="button" class="cl-cal-act" onclick="clCalToday()">${histEsc(T('cal.today', 'Hôm nay'))}</button>` +
      `<button type="button" class="cl-cal-act primary" onclick="clCalApply()">${histEsc(T('cal.apply', 'Áp dụng'))}</button>` +
    `</div>`;
  } finally {
    // Hạ cờ ở macrotask kế tiếp: sự kiện click đang lan lên document PHẢI xảy ra
    // trong lúc cờ còn bật, nếu hạ ngay trong finally (đồng bộ) thì vô dụng.
    setTimeout(() => { clCalRendering = false; }, 0);
  }
  syncClCalHint();
  // Chiều cao popup đổi (hàng tuần / chân) → canh lại cho bám đáy hàng chip.
  positionClCalendar();
}

function syncClCalHint() {
  const hint = document.getElementById('clCalHint');
  if (!hint) return;
  const T = (k, fb) => (typeof t === 'function' ? t(k) : fb);
  const a = clCal.from || '', b = clCal.pending || '';
  if (a && b) hint.textContent = fmtTpl('cal.hintRange', { a: clFmtYmd(a), b: clFmtYmd(b) });
  else if (a) hint.textContent = fmtTpl('cal.hintFrom', { d: clFmtYmd(a) });
  else hint.textContent = T('cal.hintPick', 'Chọn 1 ngày, hoặc 2 ngày để lấy khoảng');
}

function clCalNav(deltaMonths) {
  const v = clParseYmd(clCal.view) || new Date();
  v.setMonth(v.getMonth() + deltaMonths);
  clCal.view = clYmd(v).slice(0, 7) + '-01';
  renderClCalendar();
}

function clCalToday() {
  const t = clTodayYmd();
  clCal.view = t.slice(0, 7) + '-01';
  clCal.from = t;
  clCal.pending = '';
  renderClCalendar();
}

// Bấm 1 ngày trong lịch:
//   chưa có ngày đầu  → đặt ngày đầu, chờ ngày cuối.
//   đã có ngày đầu    → đặt ngày cuối (nếu trước ngày đầu thì đảo lại).
//                       Bấm LẦN 2 vào chính ngày đầu → chốt đúng 1 ngày đó.
function clCalPick(ymd) {
  if (!clCal.from) {
    clCal.from = ymd;
    clCal.pending = '';
    renderClCalendar();
    return;
  }
  if (ymd === clCal.from && !clCal.pending) {
    // Chốt 1 ngày duy nhất.
    clCalApply();
    return;
  }
  clCal.pending = ymd;
  renderClCalendar();
}

// Ghi khoảng đã chọn vào #dateFrom/#dateTo rồi lọc lại.
function clCalApply() {
  let from = clCal.from || '';
  let to = clCal.pending || '';
  if (from && to && to < from) { const t = from; from = to; to = t; }
  const df = document.getElementById('dateFrom');
  const dt = document.getElementById('dateTo');
  if (df) df.value = from;
  if (dt) dt.value = to;
  clCal.from = from;
  clCal.pending = to;
  closeClDatePicker();
  applyCallLogFilters();
}

// Đồng bộ nút lịch (chip icon-only) + dòng "khoảng đang lọc" theo #dateFrom/#dateTo.
//   chưa lọc → chip không active, không chấm; dòng khoảng ẩn.
//   1 ngày   → chấm đỏ + dòng '18/10/2026'
//   khoảng   → chấm đỏ + dòng '15/10 → 18/10/2026'
function syncClDateButtons() {
  const btn = document.getElementById('clDateBtn');
  if (!btn) return;
  const df = document.getElementById('dateFrom');
  const dt = document.getElementById('dateTo');
  const from = (df && df.value) || '';
  const to = (dt && dt.value) || '';
  const has = !!(from || to);
  const T = (k, fb) => (typeof t === 'function' ? t(k) : fb);
  let label = '';
  if (from && to && from !== to) {
    const a = clFmtYmd(from), b = clFmtYmd(to);
    // Cùng năm thì thu gọn năm ở mốc đầu: '15/10 → 18/10/2026'.
    label = (from.slice(0, 4) === to.slice(0, 4)) ? (a.slice(0, 5) + ' → ' + b) : (a + ' → ' + b);
  } else if (has) label = clFmtYmd(from || to);

  // Chấm đỏ báo "đang lọc ngày" — cùng chỗ & kích thước với mũi tên .cl-chip-dir.
  const dot = document.getElementById('clDateDot');
  if (dot) dot.classList.toggle('hidden', !has);
  btn.classList.toggle('active', has);
  btn.setAttribute('title', has ? (label + ' — ' + T('calllogs.dateRange', 'Chọn ngày / khoảng ngày'))
    : T('calllogs.dateRange', 'Chọn ngày / khoảng ngày'));

  // Dòng hiện khoảng đang lọc + nút xoá (ẩn khi chưa lọc).
  const row = document.getElementById('clDateActive');
  const rowTxt = document.getElementById('clDateActiveTxt');
  if (row) row.classList.toggle('hidden', !has);
  if (rowTxt) rowTxt.textContent = has ? label : '';

  // giữ popup đồng bộ nếu đang mở
  if (clCalOpen) { clCal.from = from; clCal.pending = to; renderClCalendar(); }
}

// Mở/đóng khối bộ lọc phụ ở tab "Tra cứu danh sách".
function toggleCallLogFilters() {
  const panel = document.getElementById('callLogFilterPanel');
  const btn = document.getElementById('clFilterToggle');
  if (!panel) return;
  const open = panel.classList.toggle('hidden') === false;
  if (btn) {
    btn.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
}

// Chọn chip lọc hành động — đổi state + highlight + render lại.
function setClActionFilter(action, chipEl) {
  clActionFilter = action || 'all';
  document.querySelectorAll('#clActionChips .cl-chip').forEach(c => c.classList.remove('active'));
  if (chipEl) chipEl.classList.add('active');
  else {
    const el = document.querySelector(`#clActionChips .cl-chip[data-action="${clActionFilter}"]`);
    if (el) el.classList.add('active');
  }
  searchCallLogs();
}

// Badge trên nút "Bộ lọc": số điều kiện phụ đang bật (loại + ngày).
function updateClFilterBadge() {
  const badge = document.getElementById('clFilterBadge');
  if (!badge) return;
  let n = 0;
  if (clActionFilter && clActionFilter !== 'all') n++;
  if (clCellStatusFilter && clCellStatusFilter !== 'all') n++;
  const df = document.getElementById('dateFrom');
  const dt = document.getElementById('dateTo');
  if (df && df.value) n++;
  if (dt && dt.value) n++;
  badge.textContent = String(n);
  badge.classList.toggle('show', n > 0);
}

function searchCallLogs() {
  logPageIndex = 1;
  syncLogSearchClear();
  renderCallLogs();
}

// Hiện nút "xoá" khi ô tìm kiếm có nội dung.
function syncLogSearchClear() {
  const input = document.getElementById('logSearchInput');
  const clear = document.getElementById('logSearchClear');
  if (!input || !clear) return;
  clear.classList.toggle('hidden', !(input.value || '').trim());
}

// Nút xoá nhanh trong ô tìm kiếm: trống ô rồi render lại.
function clearLogSearch() {
  const input = document.getElementById('logSearchInput');
  if (input) input.value = '';
  searchCallLogs();
}

function logPage(dir) {
  const filtered = getFilteredLogs();
  const totalPages = Math.max(1, Math.ceil(filtered.length / LOG_PAGE_SIZE));
  logPageIndex = Math.min(Math.max(1, logPageIndex + dir), totalPages);
  renderCallLogs();
}

function getFilteredLogs() {
  const actionFilter = clActionFilter;
  const fromEl = document.getElementById('dateFrom');
  const toEl = document.getElementById('dateTo');
  const searchEl = document.getElementById('logSearchInput');
  const dateFrom = fromEl ? (fromEl.value || '') : '';
  const dateTo = toEl ? (toEl.value || '') : '';
  const q = searchEl ? (searchEl.value || '').trim().toLowerCase() : '';

  let rows = clRecordsWithSessionCells();
  // Dòng "cell-only" (cell của phiên tra theo list, KHÔNG có bản ghi cuộc gọi) có
  // `action_type` rỗng. Trước đây lọc theo loại hành động loại luôn các dòng này ⇒
  // chọn "Gọi đến"/"SMS đi" là danh sách TRỐNG dù phiên còn đầy cell chưa tra.
  // Giữ chúng lại để user vẫn thấy trạng thái các cell còn lại của phiên.
  if (actionFilter !== 'all') {
    rows = rows.filter(l => l._cellOnly || l.action_type === actionFilter);
  }
  // Dòng "cell-only" không có mốc thời gian → không loại theo khoảng ngày, tránh làm
  // cell chưa tra biến mất khi lọc ngày.
  if (dateFrom) rows = rows.filter(l => l._cellOnly || (l.timestamp || '') >= dateFrom);
  // dateTo là ngày (YYYY-MM-DD); timestamp kèm giờ nên so sánh trọn ngày cuối.
  if (dateTo) {
    const toEnd = dateTo.length === 10 ? dateTo + ' 23:59:59' : dateTo;
    rows = rows.filter(l => l._cellOnly || (l.timestamp || '') <= toEnd);
  }
  if (q) {
    rows = rows.filter(l => {
      const hay = [l.network, l.phone_number, l.action_type, l.contact_number, l.timestamp,
        l.cellid, l.cell_address, `${l.mcc || ''}-${l.mnc || ''}-${l.lac || ''}-${l.cellid || ''}`]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }
  // Lọc theo trạng thái cell — áp SAU cùng để số dòng khớp chip người dùng vừa bấm.
  if (clCellStatusFilter !== 'all') {
    const cellsByKey = clCellsByKey();
    rows = rows.filter(l => clRecordStatusClass(l, cellsByKey) === clCellStatusFilter);
  }
  return rows;
}

// Lớp trạng thái của 1 dòng để so với bộ lọc: 'found' | 'miss' | 'unpaid'.
// `busy`/`pending` đều thuộc nhóm "chưa tra được" (chưa có kết quả cuối cùng).
function clRecordStatusClass(row, cellsByKey) {
  const st = clRecordState(row, cellsByKey || clCellsByKey());
  if (st.cls === 'found') return 'found';
  if (st.cls === 'miss') return 'miss';
  return 'unpaid';
}

// Đếm số dòng theo từng trạng thái + cập nhật số trên chip. Đếm trên danh sách
// phiên (chưa áp bộ lọc hành động/ngày/tìm kiếm) để chip luôn cho biết tổng quan
// của cả phiên — bấm nhiều bộ lọc liên tiếp vẫn thấy số ổn định.
function syncClStatusChips() {
  const box = document.getElementById('clRecordStatusChips');
  if (!box) return;
  const rows = typeof clRecordsWithSessionCells === 'function' ? clRecordsWithSessionCells() : [];
  const cellsByKey = clCellsByKey();
  let found = 0, miss = 0, unpaid = 0;
  for (const l of rows) {
    const c = clRecordStatusClass(l, cellsByKey);
    if (c === 'found') found++;
    else if (c === 'miss') miss++;
    else unpaid++;
  }
  const set = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = String(n); };
  set('clStCountAll', rows.length);
  set('clStCountFound', found);
  set('clStCountUnpaid', unpaid);
  set('clStCountMiss', miss);
  // Đồng bộ highlight theo state (sau khi vẽ lại / khôi phục phiên).
  box.querySelectorAll('.cl-chip').forEach(c =>
    c.classList.toggle('active', c.dataset.status === clCellStatusFilter));
}

// Bấm chip trạng thái cell → đổi state + render lại danh sách.
function setClCellStatusFilter(k) {
  clCellStatusFilter = k || 'all';
  const box = document.getElementById('clRecordStatusChips');
  if (box) box.querySelectorAll('.cl-chip').forEach(c =>
    c.classList.toggle('active', c.dataset.status === clCellStatusFilter));
  logPageIndex = 1;
  updateClFilterBadge();
  renderCallLogs();
}

// Bản ghi của phiên + các CELL CHƯA CÓ BẢN GHI của phiên (chưa tra / tra không ra).
// Bảng cell là nguồn danh sách cell của file (kể cả cell không có dòng cuộc gọi nào),
// nên danh sách bản ghi phải hiện đủ để thấy trạng thái TỪNG cell của phiên đang mở.
// Chỉ áp dụng khi bảng đang mở đúng phiên hiện tại (tránh trộn cell phiên khác).
function clRecordsWithSessionCells() {
  const base = myLogsCache.slice();
  if (!clAnalyze || !Array.isArray(clAnalyze.rows) || !clAnalyze.rows.length) return base;
  if (currentOpenBatchId && clAnalyze.batchId && clAnalyze.batchId !== currentOpenBatchId) return base;
  const seen = new Set();
  for (const l of base) if (l.cellid) seen.add(canonicalClientKey(l));
  const extra = [];
  for (const c of clAnalyze.rows) {
    const key = c.key || canonicalClientKey(c);
    if (!key || seen.has(key)) continue;
    // Cell chưa có bản ghi nào trong danh sách → thêm dòng tổng hợp để thấy trạng
    // thái thật của cell (chưa tra / đã tra ra / không ra do server trả ở results).
    seen.add(key);
    // Dòng tổng hợp kế thừa TOẠ ĐỘ của cell nếu cell đã tra ra (state='found').
    // Trước đây gán cứng `lat: null, lon: null` nên dòng cell-only đã có toạ độ vẫn
    // không bấm được trên bản đồ (không có onclick). Cell chỉ có lat/lng khi đã trả
    // phí → vẫn không lộ toạ độ của cell chưa tra.
    const cLat = (c.state === 'found' && c.lat != null) ? c.lat : null;
    const cLng = (c.state === 'found' && (c.lng != null || c.lon != null)) ? (c.lng != null ? c.lng : c.lon) : null;
    extra.push({
      mcc: c.mcc, mnc: c.mnc, lac: c.lac, cellid: c.cellid, sector: c.sector,
      radio: c.radio || '', lat: cLat, lon: cLng,
      cell_range: (c.range != null) ? c.range : null, source: c.source || '',
      network: clAnalyze.network || '', action_type: '',
      phone_number: '', contact_number: '', timestamp: '', cell_address: '',
      duration: '', batch_id: clAnalyze.batchId || currentOpenBatchId || '',
      _rowCount: Number(c.rowCount) || 0,
      _cellOnly: true, _charged: false, _resolvedOnline: false
    });
  }
  return base.concat(extra);
}

// Số gọn cho card phiên: 12500 → "12.5K", 1_250_000 → "1.25M", dưới 10000 giữ nguyên
// (có dấu phân cách nghìn) để vẫn đọc chính xác khi số nhỏ.
function fmtNum(n) {
  const v = Number(n) || 0;
  if (v < 10000) return v.toLocaleString('vi-VN');
  if (v < 1e6) {
    const k = v / 1000;
    return (k >= 100 ? Math.round(k) : Math.round(k * 10) / 10).toString().replace('.', ',') + 'K';
  }
  const m = v / 1e6;
  return (m >= 100 ? Math.round(m) : Math.round(m * 100) / 100).toString().replace('.', ',') + 'M';
}

// Định dạng số cho các chuỗi i18n dạng "{n} ...".
function fmtTpl(key, vars) {
  let s = t(key);
  Object.keys(vars || {}).forEach(k => { s = s.split('{' + k + '}').join(vars[k]); });
  return s;
}

// Dòng tổng kết nhanh của phiên đang xem (thay banner/dòng phiên cũ — danh sách
// phiên giờ nằm ở tab Lịch sử). Số liệu lấy từ CÙNG nguồn với bảng cell
// (`clCellsSummary`) khi bảng đang mở đúng batch; fallback đếm trên danh sách.
function updateCallSessionUi(filtered) {
  const bar = document.getElementById('clListSummary');
  if (!bar) return;
  const list = Array.isArray(filtered) ? filtered : [];
  const hasData = list.length > 0 || (clAnalyze && clAnalyze.rows && clAnalyze.rows.length);
  if (!hasData) { bar.style.display = 'none'; bar.innerHTML = ''; return; }

  // Số liệu chuẩn từ bảng cell (server là nguồn sự thật của state từng cell).
  const sameSession = !!(clAnalyze && (!currentOpenBatchId || clAnalyze.batchId === currentOpenBatchId));
  let c, f, x, u;
  if (sameSession) {
    const s = clCellsSummary();
    c = s.total; f = s.found; x = s.miss; u = s.unpaid + s.pending;
  } else {
    const cellsByKey = new Map();
    c = 0; f = 0; x = 0; u = 0;
    const seen = new Set();
    for (const l of list) {
      if (!l.cellid) continue;
      const key = canonicalClientKey(l);
      if (seen.has(key)) continue;
      seen.add(key);
      c++;
      const st = clRecordState(l, cellsByKey);
      if (st.cls === 'found') f++;
      else if (st.cls === 'miss') x++;
      else u++;
    }
  }

  const name = currentUploadFileName || (clAnalyze && clAnalyze.fileName) || '';
  bar.style.display = 'flex';
  // Tên file KHÔNG lặp ở đây: card đã hiện ở .cls-detail (dòng trên), và tổng kết này
  // nằm ngay trong card. Vẫn dựng .cls-name khi dùng NGOÀI card (giữ tương thích).
  const inCard = !!bar.closest('#clSessionCard');
  bar.innerHTML =
    (name && !inCard ? `<span class="cls-name" title="${histEsc(name)}"><i class="fas fa-file-excel"></i> ${histEsc(name)}</span>` : '') +
    `<b>${list.length}</b> ${histEsc(t('upload.records'))} · ` +
    `<span class="cls-ok"><i class="fas fa-circle-check"></i> <b>${f}</b>/${c}</span> ${histEsc(t('hist.foundCells'))} · ` +
    `<span class="cls-miss">${x} ${histEsc(t('calllogs.statusMiss'))}</span>` +
    (u ? ` · <span class="cls-unpaid">${u} ${histEsc(t('calllogs.statusPending'))}</span>` : '');
}

// Trạng thái của 1 dòng trong danh sách bản ghi, theo đúng bộ trạng thái của bảng
// cell (.cl-row-status): found (đã tra, có toạ độ) / miss (đã tra, không ra) /
// unpaid (chưa tra) / busy (đang tra) / pending (chưa tra).
// Ưu tiên `clAnalyze.results` (mới tra trong phiên), rồi tới trạng thái cell do
// server trả (`cellsByKey`), cuối cùng suy từ quyền xem toạ độ của bản ghi.
function clRecordState(r, cellsByKey) {
  const row = r || {};
  const key = row.cellid ? canonicalClientKey(row) : '';
  const live = (clAnalyze && key) ? clAnalyze.results[key] : null;
  if (live && live.state) return clStateOf(live.state);
  const cell = (cellsByKey && key) ? cellsByKey.get(key) : null;
  if (cell && cell.state) return clStateOf(cell.state);
  if (!row.cellid) return { cls: 'pending', ico: 'fa-circle-notch', text: t('calllogs.statusPending') };
  if (canViewRecord(row)) return { cls: 'found', ico: 'fa-circle-check', text: t('calllogs.statusFound') };
  // Có toạ độ nhưng chưa trả phí (cell miễn phí từ CSDL nội bộ) → chưa tra.
  return { cls: 'unpaid', ico: 'fa-lock', text: t('calllogs.statusUnpaid') };
}

// Map state của cell (server / clAnalyze) → lớp CSS + icon + nhãn.
function clStateOf(state) {
  if (state === 'found') return { cls: 'found', ico: 'fa-circle-check', text: t('calllogs.statusFound') };
  if (state === 'miss') return { cls: 'miss', ico: 'fa-circle-xmark', text: t('calllogs.statusMiss') };
  if (state === 'busy') return { cls: 'busy', ico: 'fa-spinner fa-spin', text: t('calllogs.statusBusy') };
  return { cls: 'unpaid', ico: 'fa-lock', text: t('calllogs.statusUnpaid') };
}

// Map khoá cell của bảng đang mở → cell (để lấy trạng thái cell không có bản ghi).
function clCellsByKey() {
  const map = new Map();
  if (!clAnalyze || !Array.isArray(clAnalyze.rows)) return map;
  for (const c of clAnalyze.rows) if (c.key) map.set(c.key, c);
  return map;
}

function renderCallLogs() {
  // Khối nạp file ↔ card phiên phụ thuộc trạng thái phiên → đồng bộ mỗi lần vẽ lại.
  syncClLoadUi();
  syncClDateButtons();
  syncLogSearchClear();
  syncClStatusChips();
  updateClResolveNowBtn();
  const list = document.getElementById('logRecordList');
  const filtered = getFilteredLogs();
  const totalPages = Math.max(1, Math.ceil(filtered.length / LOG_PAGE_SIZE));
  if (logPageIndex > totalPages) logPageIndex = totalPages;
  const start = (logPageIndex - 1) * LOG_PAGE_SIZE;
  const page = filtered.slice(start, start + LOG_PAGE_SIZE);

  // Đang xem lịch sử di chuyển thì thoát khi bộ lọc/dữ liệu thay đổi
  if (playMode !== 'idle') stopPlay();

  plotCallLogs(filtered);
  updatePlayBtn();
  updateCallSessionUi(filtered);
  updateClFilterBadge();

  if (filtered.length === 0) {
    list.innerHTML =
      `<div style="color:var(--text-faint);text-align:center;padding:14px 10px;font-size:11px">
        ${histEsc(t('calllogs.emptyHint'))}
      </div>`;
    document.getElementById('logPrevBtn').disabled = true;
    document.getElementById('logNextBtn').disabled = true;
    document.getElementById('logPageInfo').textContent = '0 ' + t('upload.records');
    return;
  }

  document.getElementById('logPrevBtn').disabled = logPageIndex <= 1;
  document.getElementById('logNextBtn').disabled = logPageIndex >= totalPages;
  document.getElementById('logPageInfo').textContent = `${filtered.length} ${t('upload.records')} — trang ${logPageIndex}/${totalPages}`;

  const cellsByKey = clCellsByKey();
  clRecordRows = {};
  list.innerHTML = page.map(l => {
    const st = clRecordState(l, cellsByKey);
    const cellLabel = `${l.mcc || ''}-${l.mnc || ''}-${l.lac || ''}-${l.cellid || ''}`;
    // Click dòng CÓ toạ độ → zoom + vòng nhấp nháy trên bản đồ. Chỉ dòng đã tra ra
    // (đã trả phí / mở từ Lịch sử) mới có toạ độ → không lộ cell chưa tra.
    // Khoá dòng: cellLabel + vị trí trong trang. Dùng '-' (KHÔNG dùng '|') vì khoá này
    // được nhúng vào onclick qua histJsSafe() — hàm đó xoá mọi ký tự ngoài
    // [A-Za-z0-9_-], nên '|' biến mất và tra cứu clRecordRows luôn trượt.
    const rowKey = `${cellLabel}-${(page.indexOf(l))}`;
    // Cell từ API dùng `lat`/`lng` (xem /api/lookup-history/batch/.../cells); bản ghi
    // call_logs đời cũ dùng `lat`/`lon`. Nhận CẢ HAI — trước đây chỉ kiểm `l.lon` nên
    // 13 cell đã tra ra toạ độ vẫn không bấm được (không có onclick nào trên dòng).
    const rowLat = (l.lat != null) ? l.lat : null;
    const rowLon = (l.lon != null) ? l.lon : ((l.lng != null) ? l.lng : null);
    const hasCoord = rowLat != null && rowLon != null && isFinite(parseFloat(rowLat)) && isFinite(parseFloat(rowLon));
    if (hasCoord) { l.lat = rowLat; l.lon = rowLon; }   // chuẩn hoá để openClRecordOnMap đọc 1 tên
    if (st.cls === 'found' && hasCoord) clRecordRows[rowKey] = l;
    const rowClick = (st.cls === 'found' && hasCoord)
      ? `onclick="openClRecordOnMap('${histJsSafe(rowKey)}')"`
      : '';
    // Nguồn kết quả đã bỏ khỏi giao diện (không còn badge nguồn ở dòng bản ghi).
    const dur = l.duration ? ` · ${histEsc(l.duration)}s` : '';
    const partner = l.contact_number ? ` · ${histEsc(t('calllogs.partner'))}: ${histEsc(l.contact_number)}` : '';
    // Dòng KHÔNG có bản ghi cuộc gọi (cell-only) → chỗ SĐT hiện chính cell ID dạng
    // log-card-cell (MCC-MNC-LAC-CELLID), không phải nhãn "Cell trong phiên".
    const phone = l.phone_number
      ? `<span class="log-card-phone">${histEsc(l.phone_number)}</span>`
      : (l.cellid
        ? `<span class="log-card-cell log-card-cell-lead" title="${histEsc(cellLabel)}">${histEsc(cellLabel)}</span>`
        : `<span class="log-card-phone none">${histEsc(t('calllogs.cellOnly'))}</span>`);
    // Icon tra cứu ở CUỐI dòng — chỉ cho cell CHƯA tra được (unpaid / pending / busy)
    // và chưa đang tra. Bấm → tra 1 cell (trừ điểm), hiện thanh trạng thái, xong thì
    // cập nhật lại dòng (đưa vào nhóm "đã tra được" hoặc báo không ra kết quả).
    const cellKey = l.cellid ? canonicalClientKey(l) : '';
    const canLookup = !!cellKey && (st.cls === 'unpaid' || st.cls === 'pending');
    const lookupBtn = canLookup
      ? `<button type="button" class="log-card-go" data-cell-key="${histEsc(cellKey)}"`
        + ` onclick="clLookupOneCell(event, this)"`
        + ` data-i18n-title="calllogs.lookupCell" title="Tra cứu cell này" aria-label="Tra cứu cell này">`
        + `<i class="fas fa-magnifying-glass-arrow-right"></i></button>`
      : '';
    return `<div class="log-card st-${st.cls}" ${rowClick} data-key="${histEsc(cellKey)}">
      <div class="log-card-hd">
        ${phone}
        ${l.timestamp ? `<span class="log-card-when">${histEsc(l.timestamp)}</span>` : ''}
        ${l.cellid ? clRadioBadgeHtml(l.radio) : ''}
        <span class="log-card-type t-${histEsc(l.action_type || 'none')}">${histEsc(l.action_type || '')}</span>
        <span class="log-card-spacer"></span>
        <span class="cl-row-status ${st.cls}">${`<i class="fas ${st.ico}"></i> `}${histEsc(st.text)}</span>
      </div>
      <div class="log-card-sub">
        ${l.phone_number ? `<span class="log-card-cell" title="${histEsc(cellLabel)}">${histEsc(l.cellid ? cellLabel : '')}</span>` : ''}
        ${dur}${partner}
        <span class="log-card-spacer"></span>
        ${lookupBtn}
      </div>
      ${l.cell_address ? `<div class="log-card-addr" title="${histEsc(l.cell_address)}">${histEsc(l.cell_address)}</div>` : ''}
      ${clRecordDetailHtml(l, st)}
    </div>`;
  }).join('');
}

// Dòng CHI TIẾT của 1 cell trong danh sách bản ghi — khác nhau theo trạng thái:
//   found  → toạ độ (+ nút copy) · bán kính · số dòng của cell · nguồn (admin);
//   miss   → "không tìm thấy trên mọi nguồn";
//   unpaid/pending/busy → "chưa tra (chưa trả phí)".
function clRecordDetailHtml(l, st) {
  // Toạ độ: API trả `lat`/`lng`, bản ghi cũ dùng `lon` → nhận cả hai (xem renderCallLogs).
  const dLon = (l.lon != null) ? l.lon : l.lng;
  if (st.cls === 'found' && l.lat != null && dLon != null) {
    const lat = parseFloat(l.lat);
    const lng = parseFloat(dLon);
    const range = parseFloat(l.cell_range);
    // Nguồn kết quả đã bỏ khỏi giao diện.
    return `<div class="log-detail">
      <span class="ok log-coords"><i class="fas fa-map-pin"></i>${histEsc(lat)}, ${histEsc(lng)}` +
        coordActionIcons(lat, lng) + `</span>` +
      (isFinite(range) ? `<span><i class="fas fa-circle-notch"></i>${histEsc(fmtTpl('calllogs.detailRange', { n: range }))}</span>` : '') +
      (l._rowCount ? `<span><i class="fas fa-layer-group"></i>${histEsc(fmtTpl('calllogs.detailLines', { n: l._rowCount }))}</span>` : '') +
    `</div>`;
  }
  if (st.cls === 'miss') {
    return `<div class="log-detail">
      <span class="miss"><i class="fas fa-circle-xmark"></i>${histEsc(t('calllogs.detailMiss'))}</span>
    </div>`;
  }
  if (st.cls === 'busy') return '';
  return `<div class="log-detail">
    <span class="unpaid"><i class="fas fa-lock"></i>${histEsc(t('calllogs.detailUnpaid'))}</span>
  </div>`;
}

// batch_id dạng 'b<epoch_ms>' → hiển thị giờ tải dễ đọc.
function batchLabelText(bId) {
  const m = /^b(\d{10,})$/.exec(bId || '');
  if (!m) return bId || '';
  const d = new Date(parseInt(m[1], 10));
  if (isNaN(d.getTime())) return bId;
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Xoá toàn bộ bản ghi thuộc 1 lần upload (batch_id). Chỉ data của chính user.
// (Alias cũ — dùng chung logic với deleteCallLogSession.)
async function deleteCallLogBatch(batchId) {
  return deleteCallLogSession(batchId);
}

// batch_id của phiên đang mở (card phiên ở tab Lịch sử dùng để tô sáng phiên đang
// xem; `currentOpenBatchId` được gán khi mở phiên / nạp Excel).
function currentCallLogBatchId() {
  if (currentOpenBatchId) return currentOpenBatchId;
  for (const l of myLogsCache) {
    if (l.batch_id) return l.batch_id;
  }
  return '';
}

// Đăng ký metadata phiên rút list trước lần tra ĐẦU TIÊN của một file (idempotent).
// Nhờ vậy file đã bấm "Tra cứu" luôn xuất hiện ở tab "Tra cứu danh sách" / Lịch sử, kể cả
// khi chưa có bản ghi call_logs nào (phiên chỉ chứa toạ độ đã trả phí).
// `sessionCells`: danh sách cell ĐẦY ĐỦ của file (kể cả chưa tra) — CHỈ định danh
// (mcc/mnc/lac/cellid/sector/radio/rowCount), KHÔNG toạ độ. Nhờ vậy mở lại phiên
// vẫn thấy đủ cell chưa tra, không bị "Không tìm thấy phiên".
// Không tốn điểm, không đụng `resolved_cells`. Lỗi mạng → bỏ qua (không chặn tra).
async function ensureCallLogSession(batchId, meta) {
  if (!batchId || typeof apiRequest !== 'function') return false;
  if (typeof Auth !== 'undefined' && !Auth.getToken()) return false;
  const m = meta || {};
  const body = {
    fileName: m.fileName || '',
    network: m.network || '',
    rowCount: Number(m.rowCount) || 0,
    cellCount: Number(m.cellCount) || 0
  };
  const list = Array.isArray(m.sessionCells) ? m.sessionCells : null;
  if (list && list.length) {
    body.sessionCells = list.map(c => ({
      mcc: c.mcc, mnc: c.mnc, lac: c.lac, cellid: c.cellid,
      sector: c.sector == null ? '' : c.sector,
      radio: c.radio || '',
      rowCount: Number(c.rowCount) || 0
    }));
  }
  try {
    await apiRequest('PUT', '/api/call-log-sessions/' + encodeURIComponent(batchId), body);
    return true;
  } catch (e) {
    return false;
  }
}

// Mở lại 1 phiên đã lưu trong CSDL → hiển thị ở tab "Tra cứu danh sách" + BẢNG cell.
// Đây là ĐƯỜNG DUY NHẤT mở phiên (card phiên ở tab Lịch sử gọi hàm này), nên phải
// chịu được cả 2 loại phiên:
//   - phiên có bản ghi call_logs (upload theo luồng cũ) → danh sách lấy từ call_logs;
//   - phiên chỉ có cell đã tra (bấm Tra cứu ở bảng cell → call_logs RỖNG) → danh sách
//     rỗng, nhưng bảng cell vẫn dựng được từ lookup_history + resolved_cells.
// Trạng thái từng cell lấy từ server (`/cells`), KHÔNG tự gắn toạ độ nội bộ cho cell
// chưa trả phí → không rò kết quả và số liệu khớp với màn hình sau khi nạp file.
async function openCallLogSession(batchId) {
  if (!batchId) return;
  const meta = clSessionMeta[batchId] || {};
  try {
    // Bảng cell (kèm toạ độ CHỈ của cell đã trả phí) + danh sách bản ghi, song song.
    const [loaded, rows] = await Promise.all([
      clLoadBatchCells(batchId, 'session'),
      apiRequest('GET', '/api/call-log-sessions/' + encodeURIComponent(batchId))
    ]);
    const cells = loaded.cells;
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length && !cells.length) { showToast(t('hist.clSessionEmpty'), 'error'); return; }
    // Map shape call_logs → shape dùng trong tab (giữ `batch_id` để biết thuộc phiên
    // nào). Toạ độ lấy từ bảng cell (chỉ cell state=found mới có).
    const coords = new Map();
    for (const c of (cells || [])) {
      if (c.state === 'found' && c.lat != null && c.lng != null) coords.set(c.key, c);
    }
    myLogsCache = list.map(r => {
      const hit = coords.get(canonicalClientKey(r)) || coords.get(`${r.mcc}-${r.mnc}-${r.lac}-${r.cellid}`);
      return Object.assign({}, r, {
        lat: hit ? hit.lat : null, lon: hit ? hit.lng : null, cell_range: hit ? hit.range : null,
        radio: r.radio || (hit && hit.radio) || '', source: hit ? hit.source : '',
        _charged: !!hit, _fromHistory: true, batch_id: r.batch_id || batchId
      });
    });
    myLogsCache._restored = true;
    myLogsCache._fromHistoryOpened = true;
    currentOpenBatchId = batchId;
    currentUploadFileName = (meta && meta.file_name) || loaded.fileName || batchLabelText(batchId);
    logPageIndex = 1;
    clActionFilter = 'all';
    document.querySelectorAll('#clActionChips .cl-chip').forEach(c => c.classList.toggle('active', c.dataset.action === 'all'));
    // Mở phiên từ Lịch sử → cũng bỏ lọc trạng thái cell.
    clCellStatusFilter = 'all';
    document.querySelectorAll('#clRecordStatusChips .cl-chip').forEach(c => c.classList.toggle('active', c.dataset.status === 'all'));
    const df = document.getElementById('dateFrom'); if (df) df.value = '';
    const dt = document.getElementById('dateTo'); if (dt) dt.value = '';
    syncClDateButtons();
    const si = document.getElementById('logSearchInput'); if (si) si.value = '';
    switchTab('calllogs');

    // Dựng bảng cell TRƯỚC rồi mới vẽ danh sách: getFilteredLogs() đọc
    // clRecordsWithSessionCells(), hàm này bỏ qua `clAnalyze` khi nó null ⇒ trước đây
    // danh sách + bộ lọc được vẽ khi clAnalyze còn null nên hiện RỖNG ("không có bản
    // ghi") dù phiên đầy cell. Phải gán clAnalyze trước, render sau.
    if (cells.length) {
      clAnalyze = clCellsFromSource({
        cells, resolvedCells: loaded.resolvedCells,
        fileName: currentUploadFileName || loaded.fileName,
        network: (meta && meta.network) || loaded.network || '',
        totalRows: (meta && meta.row_count) || loaded.totalRows || 0, batchId
      });
      clMapDeferred = false;
      clSheetStep('table');
      document.getElementById('clTableOverlay')?.classList.add('show');
      renderClTable();
      renderClSheetResolve().catch(() => {});
    }

    // Bản đồ + danh sách bản ghi (sau khi clAnalyze đã sẵn sàng).
    openClResolveForRestore();
    renderCallLogs();
    // Có cell chưa tra (bỏ dở / không đủ điểm) → báo rõ để user bấm "Tra cứu" ở
    // bảng cell mà tra tiếp. Không nhắc thì phiên trông như đã xong.
    const pend = cells.filter(c => c.state !== 'found' && c.state !== 'miss').length;
    if (pend) {
      showToast(fmtTpl('calllogs.pendingLeft', { n: pend, c: clCreditCost() }), 'info');
    } else {
      showToast(t('hist.openedAsCallLogs').replace('{n}', myLogsCache.length), 'success');
    }
  } catch (e) {
    showToast('Lỗi: ' + e.message, 'error');
  }
}

// Xoá 1 phiên (nút Xoá trên card phiên ở tab Lịch sử): bản ghi + metadata. Nếu đang
// mở đúng phiên đó ở tab "Tra cứu danh sách" thì dọn danh sách + bảng cell.
async function deleteCallLogSession(batchId) {
  if (!batchId) return;
  // Chi tiết phiên sẽ xoá (lấy từ cache card phiên; thiếu thì chỉ hiện cảnh báo chung).
  const sess = (histBatch.rows || []).find(function (r) { return String(r.batch_id) === String(batchId); }) || {};
  const meta = clSessionMeta[batchId] || {};
  const detail = [];
  if (sess.file_name) detail.push({ k: t('confirm.fileLabel'), v: sess.file_name });
  if (meta.network || sess.network) detail.push({ k: t('confirm.netLabel'), v: clNetLabelFor(meta.network || sess.network) });
  const nCell = Number(sess.total_cells || sess.cell_count || meta.cell_count) || 0;
  if (nCell) detail.push({ k: t('confirm.cellsLabel'), v: nCell });
  const nLooked = Number(meta.looked_count || sess.looked_count) || 0;
  if (nLooked) detail.push({ k: t('confirm.lookedLabel'), v: nLooked });
  const nRow = Number(meta.row_count || sess.total_rows) || 0;
  if (nRow) detail.push({ k: t('confirm.rowsLabel'), v: nRow });
  const when = sess.created_at || sess.uploaded_at || meta.created_at || '';
  if (when) detail.push({ k: t('confirm.timeLabel'), v: fmtDateTime(when) || when });

  const ok = await openConfirmDialog({
    title: t('confirm.delSessionTitle'),
    message: t('hist.clSessionConfirmDelete'),
    detail: detail,
    warnings: [
      t('confirm.warnPermanent'),
      t('confirm.warnAllRecords'),
      nLooked ? t('confirm.warnPaidPoints') : ''
    ],
    notes: [t('confirm.noteCantUndo')],
    okText: t('confirm.okDelete')
  });
  if (!ok) return;
  try {
    const res = await apiRequest('DELETE', '/api/call-log-sessions/' + encodeURIComponent(batchId));
    // Phiên "tra theo danh sách Excel" KHÔNG có call_logs → `res.deleted` = 0 dù xoá
    // thành công. Phải cộng cả `deletedBatch` (metadata lookup_batches), nếu không
    // toast báo "Đã xoá 0 bản ghi" và user tưởng nút xoá không chạy.
    const nDel = (Number(res && res.deleted) || 0) + (Number(res && res.deletedBatch) || 0);
    showToast('Đã xoá ' + nDel + ' bản ghi', 'success');
    if (currentCallLogBatchId() === batchId) {
      clearCallSession();
      myLogsCache = [];
      currentOpenBatchId = '';
      clAnalyze = null;
      closeClTableOverlay();
      logPageIndex = 1;
      renderCallLogs();
    }
    // Phiên đã xoá phải biến mất khỏi MỌI danh sách của tab Lịch sử: danh sách phiên
    // Excel (histBatchCache + lookup_batches) VÀ danh sách tra cứu đơn lẻ.
    // loadHistBatches tự gọi loadCallLogSessions(1) bên trong → không gọi lặp.
    if (histBatchCache && histBatchCache[batchId]) delete histBatchCache[batchId];
    if (clSessionMeta && clSessionMeta[batchId]) delete clSessionMeta[batchId];
    loadHistBatches(histBatch.page || 1);
    return;
  } catch (e) {
    showToast('Lỗi: ' + e.message, 'error');
  }
}

// (Đã bỏ deleteCallLog: list bản ghi không còn nút xoá từng dòng — xoá theo phiên
//  dùng deleteCallLogSession ở card phiên tab Lịch sử.)

let playTimer = null;
let playPoints = [];
let playIndex = 0;
let playLine = null;
let playActiveMarker = null;
let playMode = 'idle'; // 'idle' | 'playing' | 'manual'
const PLAY_DELAY = 1200;
const ONE_HOUR_MS = 3600000;
const TL_PX_PER_MS = 0.0005;   // 0.5 px/giây khi tổng thời gian > 1 giờ
let timelineWidth = 0;
let tlZoom = 1; // hệ số zoom thanh timeline
const timelineIcon = { CALL_IN: 'fa-phone', CALL_OUT: 'fa-phone', SMS_IN: 'fa-envelope', SMS_OUT: 'fa-envelope' };

function showPlayNav(show) {
  const nav = document.getElementById('playNav');
  if (nav) nav.style.display = show ? 'flex' : 'none';
  document.body.classList.toggle('play-active', !!show);
}

// Phím tắt khi đang phát lại: ←/→ bước 1 điểm, Space dừng/tiếp tục.
document.addEventListener('keydown', (e) => {
  if (document.body.classList.contains('play-active') === false) return;
  const tag = (e.target && e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
  if (e.key === 'ArrowLeft') { e.preventDefault(); playStep(-1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); playStep(1); }
  else if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); playToggle(); }
});

function setPlayBtnLabel(key) {
  const el = document.getElementById('playBtnLabel');
  if (el) el.textContent = t(key);
}

function setPlayToggleLabel(key) {
  const el = document.getElementById('playToggleLabel');
  if (el) el.textContent = t(key);
  const icon = document.querySelector('#playToggleBtn i');
  if (icon) icon.className = key === 'play.resume' ? 'fas fa-play' : 'fas fa-stop';
}

function playCallLogs() {
  // Đang xem lịch sử → thoát hẳn
  if (playMode !== 'idle') { stopPlay(); return; }

  playPoints = getFilteredLogs()
    .filter(canViewRecord)
    .map(r => ({ ...r, lat: parseFloat(r.lat), lon: parseFloat(r.lon) }))
    .filter(p => !isNaN(p.lat) && !isNaN(p.lon))
    .sort((a, b) => parseServerTime(a.timestamp) - parseServerTime(b.timestamp));

  if (playPoints.length === 0) {
    showToast('Không có bản ghi có tọa độ để play', 'error');
    return;
  }

  playIndex = 0;

  const pts = playPoints.map(p => [p.lat, p.lon]);
  playLine = L.polyline(pts, { color: '#ffaa00', weight: 3, opacity: 0.8, dashArray: '6,6' }).addTo(map);

  map.flyTo([playPoints[0].lat, playPoints[0].lon], 14);
  showPlayPoint(playPoints[0]);

  showPlayNav(true);
  setPlayBtnLabel('play.exitHistory');
  const btn = document.getElementById('playBtn');
  if (btn) btn.style.background = 'var(--bg-btn-danger)';

  buildTimeline(playPoints);
  showTimeline(true);
  startPlayTimer();
  updateTimelineActive();
}

function startPlayTimer() {
  if (playTimer) { clearInterval(playTimer); playTimer = null; }
  playMode = 'playing';
  setPlayToggleLabel('play.stop');
  playTimer = setInterval(() => {
    playIndex++;
    if (playIndex >= playPoints.length) { stopPlay(true); return; }
    const p = playPoints[playIndex];
    map.flyTo([p.lat, p.lon], 14);
    showPlayPoint(p);
    updateTimelineActive();
  }, PLAY_DELAY);
}

// Tiến/lùi một log — tạm dừng auto-play, chuyển nút giữa thành "Tiếp tục phát"
function playStep(dir) {
  if (playMode === 'idle') return;
  if (playTimer) { clearInterval(playTimer); playTimer = null; }
  playMode = 'manual';
  playIndex = Math.min(Math.max(0, playIndex + dir), playPoints.length - 1);
  const p = playPoints[playIndex];
  if (!p) return;
  map.flyTo([p.lat, p.lon], 14);
  showPlayPoint(p);
  setPlayToggleLabel('play.resume');
  updateTimelineActive();
}

// Nút giữa: Dừng lại (tạm dừng) <-> Tiếp tục phát (resume)
function playToggle() {
  if (playMode === 'playing') {
    if (playTimer) { clearInterval(playTimer); playTimer = null; }
    playMode = 'manual';
    setPlayToggleLabel('play.resume');
  } else if (playMode === 'manual') {
    startPlayTimer();
  }
}

function showPlayPoint(p) {
  if (playActiveMarker) map.removeLayer(playActiveMarker);
  const color = getCellColor(p.action_type);
  playActiveMarker = L.circleMarker([p.lat, p.lon], {
    radius: 10,
    color: '#fff',
    weight: 2,
    fillColor: color,
    fillOpacity: 0.9
  }).addTo(map);
  playActiveMarker.bindPopup(`<b>${fmtDateTime(p.timestamp)}</b><br>${actionLabel[p.action_type] || p.action_type} — ${p.phone_number}<br>Trạm: ${p.mcc}-${p.mnc}-${p.lac}<br>${formatCellId(p.cellid, p.enb_id, p.sector)}<br>Tọa độ: ${p.lat}, ${p.lon} ${coordActionIcons(p.lat, p.lon)}${p.cell_address ? '<br>' + p.cell_address : ''}`);
  playActiveMarker.openPopup();
}

function showTimeline(show) {
  const bar = document.getElementById('timelineBar');
  if (bar) bar.classList.toggle('show', !!show);
}

// Bơm các node icon + nhãn thời gian lên thanh timeline
function buildTimeline(points) {
  const track = document.getElementById('timelineTrack');
  const bar = document.getElementById('timelineBar');
  if (!track || !bar || !points.length) { showTimeline(false); return; }

  const t0 = parseServerTime(points[0].timestamp).getTime();
  const t1 = parseServerTime(points[points.length - 1].timestamp).getTime();
  const span = Math.max(t1 - t0, 1);

  let pxPerMs, width;
  if (span <= ONE_HOUR_MS) {
    // Ngắn (<= 1 giờ): dàn vừa khung màn hình, vẫn giữ tỉ lệ thời gian
    width = bar.clientWidth || window.innerWidth;
    pxPerMs = (width / span) * tlZoom;
  } else {
    // Dài: tỉ lệ cố định px/giây (nhân hệ số zoom), cuộn ngang
    pxPerMs = TL_PX_PER_MS * tlZoom;
    width = Math.max(span * pxPerMs, bar.clientWidth || window.innerWidth);
  }
  timelineWidth = width;

  const fmtTick = (ts) => {
    const d = parseServerTime(ts);
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0') +
      ' ' + d.getDate().toString().padStart(2, '0') + '/' + (d.getMonth() + 1).toString().padStart(2, '0');
  };

  const typeLabel = { CALL_IN: 'Gọi đến', CALL_OUT: 'Gọi đi', SMS_IN: 'SMS đến', SMS_OUT: 'SMS đi' };

  let html = `<span class="tl-axis" style="width:${width}px"></span>`;
  html += `<span class="tl-tick" style="left:2px;transform:none">${fmtTick(points[0].timestamp)}</span>`;
  html += `<span class="tl-tick" style="left:${width - 2}px;transform:translateX(-100%)">${fmtTick(points[points.length - 1].timestamp)}</span>`;

  points.forEach((p, i) => {
    const ts = parseServerTime(p.timestamp).getTime();
    const x = Math.round((ts - t0) * pxPerMs);
    const color = getCellColor(p.action_type);
    const icon = timelineIcon[p.action_type] || 'fa-circle';
    const direction = (p.action_type === 'CALL_IN' || p.action_type === 'SMS_IN') ? 'đến' : 'đi';
    const tip = `${fmtDateTime(p.timestamp)} — ${typeLabel[p.action_type] || p.action_type}${p.phone_number ? ' — ' + p.phone_number : ''}`;
    html += `<span class="tl-node-tick" style="left:${x}px"></span>`;
    html += `<span class="tl-node" data-idx="${i}" title="${tip}" data-dir="${direction}" onclick="timelineJump(${i})" style="left:${x}px;background:${color}"><i class="fas ${icon}"></i></span>`;
    // Nhãn thời gian ngay dưới mỗi icon
    html += `<span class="tl-tick" style="left:${x}px">${fmtTick(p.timestamp)}</span>`;
  });

  track.style.width = width + 'px';
  track.style.transform = 'translateX(0)';
  track.innerHTML = html;
}

// Zoom thanh timeline: delta > 0 = phóng to, < 0 = thu nhỏ
function zoomTimeline(delta) {
  tlZoom = Math.min(8, Math.max(0.25, tlZoom * (delta > 0 ? 1.5 : 1 / 1.5)));
  if (playPoints && playPoints.length) {
    buildTimeline(playPoints);
    updateTimelineActive();
  }
}

// Đánh dấu node hiện tại + tự cuộn timeline khi chạy tới sát mép phải
function updateTimelineActive() {
  const track = document.getElementById('timelineTrack');
  const bar = document.getElementById('timelineBar');
  if (!track || !bar || playMode === 'idle') return;

  track.querySelectorAll('.tl-node.active').forEach(n => n.classList.remove('active'));
  const node = track.querySelector(`.tl-node[data-idx="${playIndex}"]`);
  if (!node) return;
  node.classList.add('active');

  const barW = bar.clientWidth;
  const nodeX = parseFloat(node.style.left) || 0;
  const nodeCenter = nodeX;
  if (nodeCenter >= barW * 0.7) {
    // Sát mép phải → dịch timeline về đầu (đưa node hiện tại về gần mép trái) để chạy tiếp
    const offset = Math.max(0, nodeCenter - barW * 0.3);
    track.style.transform = `translateX(-${offset}px)`;
  } else if (nodeCenter < Math.abs(parseFloat((track.style.transform.match(/-?[\d.]+/) || [0])[0]))) {
    // Cuộn ngược về đầu khi điểm hiện tại nằm bên trái khung nhìn
    track.style.transform = 'translateX(0)';
  }
}

// Click icon trên timeline → nhảy tới log đó
function timelineJump(i) {
  if (playMode === 'idle') return;
  if (playTimer) { clearInterval(playTimer); playTimer = null; }
  playMode = 'manual';
  playIndex = i;
  const p = playPoints[playIndex];
  if (!p) return;
  map.flyTo([p.lat, p.lon], 14);
  showPlayPoint(p);
  setPlayToggleLabel('play.resume');
  updateTimelineActive();
}

function stopPlay(complete) {
  if (playTimer) { clearInterval(playTimer); playTimer = null; }
  if (playLine) { map.removeLayer(playLine); playLine = null; }
  if (playActiveMarker) { map.removeLayer(playActiveMarker); playActiveMarker = null; }
  playMode = 'idle';
  tlZoom = 1;
  showPlayNav(false);
  setPlayBtnLabel('play.viewHistory');
  const btn = document.getElementById('playBtn');
  if (btn) btn.style.background = '';
  setPlayToggleLabel('play.stop');
  showTimeline(false);
  if (complete) showToast('Xem lịch sử hoàn tất: ' + playPoints.length + ' điểm', 'success');
  playPoints = [];
}

// Play button visibility: show when filtered records have coordinates
function updatePlayBtn() {
  const btn = document.getElementById('playBtn');
  if (!btn) return;
  const hasCoord = getFilteredLogs().some(canViewRecord);
  btn.style.display = hasCoord ? '' : 'none';
  if (!hasCoord) showPlayNav(false);
}

function toggleLegend() {
  document.getElementById('legendPanel').classList.toggle('show');
}

// Mở/đóng sub-section "Công nghệ mạng" trong legend
function toggleLegendRadio() {
  const sub = document.getElementById('legendRadioSub');
  if (sub) sub.classList.toggle('open');
}

// ============================================
// Init
// ============================================
loadTheme();
applyI18n();
// Vào trang chủ: tab mặc định là Tra cứu cell đơn lẻ. Nạp sẵn phiên rút list cũ (nếu có)
// NHƯNG KHÔNG mở popup xác nhận tra — chỉ mở khi user thao tác (Load Excel / mở phiên).
loadCallLogs({ prompt: false });
loadAnnotations();
updateSidebarState();
initSidebarResize();
initSidebarResizeBlock();
initCallSessionResolvedFlush();
