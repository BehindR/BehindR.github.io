/**
 * =====================================================
 *  Google Apps Script — Backend API
 *  Aplikasi Pencatat Pelanggaran OSIS SMAN 3 Garut
 * =====================================================
 *
 *  CARA PAKAI:
 *  1. Buka https://script.google.com
 *  2. Buat project baru
 *  3. Paste seluruh kode ini ke Code.gs
 *  4. Deploy sebagai Web App (lihat SETUP.md)
 *
 *  SPREADSHEET FORMAT:
 *  Sheet1 → Kolom A: Nama Siswa, Kolom B: Kelas
 *  Sheet2 → Kolom A: Waktu, Kolom B: Nama, Kolom C: Kelas, Kolom D: Jenis Pelanggaran
 */

/* ── Konfigurasi ───────────────────────────────────── */

/**
 * Ganti dengan ID spreadsheet kamu.
 * ID bisa diambil dari URL spreadsheet:
 * https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
 *
 * Jika Apps Script dibuat dari dalam spreadsheet
 * (Extensions > Apps Script), biarkan kosong
 * dan gunakan SpreadsheetApp.getActiveSpreadsheet()
 */
const SPREADSHEET_ID = ''; // Kosongkan jika dibuat dari spreadsheet

const SHEET_SISWA = 'Sheet1';
const SHEET_LOG   = 'Sheet2';

/* ── Helper ────────────────────────────────────────── */

/**
 * Mengambil spreadsheet yang aktif atau berdasarkan ID.
 */
function getSpreadsheet() {
  if (SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Membuat JSON response yang bisa dikonsumsi oleh frontend.
 */
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ── HTTP Handlers ─────────────────────────────────── */

/**
 * Handler untuk semua request GET.
 *
 * Query parameters:
 *   action=get   → Ambil data siswa + ringkasan pelanggaran (default)
 *   action=add   → Catat pelanggaran baru
 *     &nama=...  → Nama siswa
 *     &kelas=... → Kelas siswa
 *     &jenis=... → Jenis pelanggaran
 */
function doGet(e) {
  try {
    var params = e ? e.parameter : {};
    var action = params.action || 'get';

    if (action === 'add') {
      return addViolation(params);
    }

    return getStudents();
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

/**
 * Handler POST sebagai fallback.
 * Body JSON: { nama, kelas, jenis }
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    return addViolationData(data.nama, data.kelas, data.jenis);
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

/* ── Logika Utama ──────────────────────────────────── */

/**
 * Mengambil seluruh data siswa dari Sheet1 beserta
 * jumlah pelanggaran per jenis dari Sheet2.
 */
function getStudents() {
  var ss = getSpreadsheet();
  var studentSheet   = ss.getSheetByName(SHEET_SISWA);
  var violationSheet = ss.getSheetByName(SHEET_LOG);

  if (!studentSheet) {
    return jsonResponse({ success: false, error: 'Sheet "' + SHEET_SISWA + '" tidak ditemukan.' });
  }
  if (!violationSheet) {
    return jsonResponse({ success: false, error: 'Sheet "' + SHEET_LOG + '" tidak ditemukan.' });
  }

  var studentData   = studentSheet.getDataRange().getValues();
  var violationData = violationSheet.getDataRange().getValues();

  // Buat lookup pelanggaran untuk efisiensi
  // Key: "nama|||kelas|||jenis" → count
  var violationMap = {};

  for (var j = 1; j < violationData.length; j++) {
    var vNama  = String(violationData[j][1] || '').trim();
    var vKelas = String(violationData[j][2] || '').trim();
    var vJenis = String(violationData[j][3] || '').trim();

    if (!vNama || !vJenis) continue;

    var key = vNama + '|||' + vKelas + '|||' + vJenis;
    violationMap[key] = (violationMap[key] || 0) + 1;
  }

  // Jenis pelanggaran yang ditrack
  var jenisArray = ['Telat', 'Make up', 'Rok Baping', 'Atribut', 'Kaus Kaki', 'Benda Berbahaya'];

  var students = [];
  var totalViolations = 0;

  for (var i = 1; i < studentData.length; i++) {
    var nama  = String(studentData[i][0] || '').trim();
    var kelas = String(studentData[i][1] || '').trim();

    if (!nama) continue;

    var pelanggaran = {};
    for (var k = 0; k < jenisArray.length; k++) {
      var jenis = jenisArray[k];
      var lookupKey = nama + '|||' + kelas + '|||' + jenis;
      var count = violationMap[lookupKey] || 0;
      pelanggaran[jenis] = count;
      totalViolations += count;
    }

    students.push({
      nama: nama,
      kelas: kelas,
      pelanggaran: pelanggaran
    });
  }

  return jsonResponse({
    success: true,
    data: students,
    totalViolations: totalViolations
  });
}

/**
 * Mencatat pelanggaran baru dari query parameters.
 */
function addViolation(params) {
  var nama  = decodeURIComponent(params.nama  || '');
  var kelas = decodeURIComponent(params.kelas || '');
  var jenis = decodeURIComponent(params.jenis || '');

  if (!nama || !kelas || !jenis) {
    return jsonResponse({
      success: false,
      error: 'Parameter tidak lengkap. Butuh: nama, kelas, jenis.'
    });
  }

  return addViolationData(nama, kelas, jenis);
}

/**
 * Menulis baris baru ke Sheet2 (log pelanggaran).
 */
function addViolationData(nama, kelas, jenis) {
  var validTypes = ['Telat', 'Make up', 'Rok Baping', 'Atribut', 'Kaus Kaki', 'Benda Berbahaya'];

  if (validTypes.indexOf(jenis) === -1) {
    return jsonResponse({
      success: false,
      error: 'Jenis pelanggaran tidak valid: "' + jenis + '". ' +
             'Pilihan: ' + validTypes.join(', ')
    });
  }

  var ss    = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_LOG);

  if (!sheet) {
    return jsonResponse({
      success: false,
      error: 'Sheet "' + SHEET_LOG + '" tidak ditemukan.'
    });
  }

  var timestamp = Utilities.formatDate(
    new Date(),
    'Asia/Jakarta',
    'dd/MM/yyyy HH:mm:ss'
  );

  sheet.appendRow([timestamp, nama, kelas, jenis]);

  return jsonResponse({
    success: true,
    message: 'Pelanggaran "' + jenis + '" untuk ' + nama + ' berhasil dicatat.'
  });
}
