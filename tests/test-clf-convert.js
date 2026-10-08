/**
 * CLF V4.1 <-> OpenCellID CSV round-trip test.
 *
 * Usage:
 *   node tests/test-clf-convert.js
 *   node tests/test-clf-convert.js uploads/Database_free.csv
 *
 * Writes the converted files into uploads/clf/ and re-converts them back,
 * printing row counts and a sample of each side so the mapping can be eyeballed.
 */

const fs = require('fs');
const path = require('path');
const clf = require('../clf-converter');

const inPath = path.resolve(process.argv[2] || path.join(__dirname, '..', 'uploads', 'Database_free.csv'));
const outDir = path.join(__dirname, '..', 'uploads', 'clf');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const stamp = Date.now();
const clfPath = path.join(outDir, 'test_' + stamp + '.clf');
const csvPath = path.join(outDir, 'test_' + stamp + '.csv');

function fail(msg) {
  console.error('\u2717 ' + msg);
  process.exitCode = 1;
}

function ok(msg) {
  console.log('\u2713 ' + msg);
}

(async () => {
  if (!fs.existsSync(inPath)) {
    fail('Input file not found: ' + inPath);
    return;
  }
  console.log('Input : ' + inPath + ' (' + (fs.statSync(inPath).size / 1024 / 1024).toFixed(2) + ' MB)');
  console.log('CLF cols: ' + clf.CLF_FIELDS.join(';'));

  // ---- 1. CSV -> CLF -------------------------------------------------------
  const t0 = Date.now();
  const fwd = await clf.convertCsvFileToClf(inPath, clfPath);
  console.log('\n[1] CSV -> CLF  (' + ((Date.now() - t0) / 1000).toFixed(1) + 's)');
  console.log('   total=' + fwd.total + ' converted=' + fwd.converted + ' failed=' + fwd.failed);
  console.log('   size=' + (fs.statSync(clfPath).size / 1024 / 1024).toFixed(2) + ' MB');
  if (fwd.converted === 0) fail('no rows converted CSV -> CLF');
  else ok(fwd.converted + ' rows converted');

  const clfLines = fs.readFileSync(clfPath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  console.log('   sample:');
  clfLines.slice(0, 3).forEach(l => console.log('     ' + l));

  const firstCols = clfLines[0].split(';');
  if (firstCols.length !== 16) fail('first CLF line has ' + firstCols.length + ' columns, expected 16');
  else ok('every line has 16 columns');
  if (/^[0-9]+$/.test(firstCols[0])) ok('MCCMNC numeric: ' + firstCols[0]);
  else fail('MCCMNC not numeric: ' + firstCols[0]);
  if (clfLines.every(l => l.split(';').length === 16)) ok('all lines have 16 columns');
  else fail('some lines do not have 16 columns');

  // ---- 2. CLF -> CSV -------------------------------------------------------
  const t1 = Date.now();
  const rev = await clf.convertClfFileToCsv(clfPath, csvPath);
  console.log('\n[2] CLF -> CSV  (' + ((Date.now() - t1) / 1000).toFixed(1) + 's)');
  console.log('   total=' + rev.total + ' converted=' + rev.converted + ' failed=' + rev.failed);
  if (rev.converted !== fwd.converted) fail('row count mismatch: fwd=' + fwd.converted + ' rev=' + rev.converted);
  else ok('row count round-trips: ' + rev.converted);

  const csvLines = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  console.log('   header: ' + csvLines[0]);
  console.log('   sample:');
  csvLines.slice(1, 4).forEach(l => console.log('     ' + l));
  if (csvLines[0] === clf.OPENCELLID_FIELDS.join(',')) ok('CSV header matches OpenCellID schema');
  else fail('CSV header mismatch');

  // ---- 3. Value fidelity on the first data row -----------------------------
  const srcFirst = fs.readFileSync(inPath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)[1].split(',');
  const rtFirst = csvLines[1].split(',');
  const src = {}; clf.OPENCELLID_FIELDS.forEach((f, i) => { src[f] = srcFirst[i]; });
  const rt = {}; clf.OPENCELLID_FIELDS.forEach((f, i) => { rt[f] = rtFirst[i]; });
  console.log('\n[3] Round-trip fidelity (first row)');
  const close = (a, b) => Math.abs(parseFloat(a) - parseFloat(b)) < 1e-6;
  ['radio', 'mcc'].forEach(f => {
    if (String(src[f]) === String(rt[f])) ok(f + '=' + rt[f]);
    else fail(f + ' changed: ' + src[f] + ' -> ' + rt[f]);
  });
  ['lat', 'lon', 'range', 'samples'].forEach(f => {
    if (close(src[f], rt[f])) ok(f + '=' + rt[f]);
    else fail(f + ' changed: ' + src[f] + ' -> ' + rt[f]);
  });
  // `net` / `area` / `cell` may gain CLF zero padding; compare numerically.
  ['net', 'area', 'cell'].forEach(f => {
    if (parseInt(src[f], 10) === parseInt(rt[f], 10)) ok(f + '=' + rt[f] + ' (clf-padded)');
    else fail(f + ' changed: ' + src[f] + ' -> ' + rt[f]);
  });

  // ---- 4. Spec example line -----------------------------------------------
  console.log('\n[4] Spec example line');
  const spec = '26207;04002;00432;0;50.12345;-8.12345;-1;This is sector 3;3;4002_3;240;30.5;65;7;6;1599XY03';
  const specOut = clf.clfLineToCsvLine(spec, 0);
  console.log('   in : ' + spec);
  console.log('   out: ' + specOut);
  const sc = specOut.split(',');
  const specRow = {}; clf.OPENCELLID_FIELDS.forEach((f, i) => { specRow[f] = sc[i]; });
  if (specRow.mcc === '262' && specRow.net === '07' && specRow.area === '00432' && specRow.cell === '04002'
      && Math.abs(parseFloat(specRow.lat) - 50.12345) < 1e-6 && Math.abs(parseFloat(specRow.lon) + 8.12345) < 1e-6) {
    ok('spec line parsed correctly');
  } else {
    fail('spec line parsed incorrectly: ' + JSON.stringify(specRow));
  }

  console.log('\nOutput files:');
  console.log('  ' + clfPath);
  console.log('  ' + csvPath);
  console.log(process.exitCode ? '\nFAILED' : '\nPASSED');
})().catch(e => { console.error(e); process.exitCode = 1; });
