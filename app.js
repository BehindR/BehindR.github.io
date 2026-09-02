/* ═══════════════════════════════════════════════════
   Pencatat Pelanggaran — OSIS SMAN 3 Garut
   Frontend Logic (Production Audit v2)
   ═══════════════════════════════════════════════════ */

/**
 * ⚠️ GANTI URL DI BAWAH INI
 * Paste URL deploy Google Apps Script kamu di sini.
 * Lihat SETUP.md Langkah 3 untuk cara mendapatkan URL.
 */
var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxgny7vyH-IoYhc06N4liy582vVGxlgKTl9ig3f0F60Ue-qMKMYiSXdpNtZu1PpgySO/exec';

/* ── Constants ─────────────────────────────────────── */

var VIOLATION_TYPES = [
  { label: 'Telat',           icon: '⏰', badgeClass: 'badge--telat' },
  { label: 'Make up',         icon: '💄', badgeClass: 'badge--makeup' },
  { label: 'Rok Baping',      icon: '👗', badgeClass: 'badge--rok' },
  { label: 'Atribut',         icon: '🎽', badgeClass: 'badge--atribut' },
  { label: 'Kaus Kaki',       icon: '🧦', badgeClass: 'badge--kaki' },
  { label: 'Benda Berbahaya', icon: '⚠️', badgeClass: 'badge--benda' },
];

var CACHE_KEY_DATA  = 'osis_cache_v2';
var CACHE_KEY_TOTAL = 'osis_total_v2';
var PAGE_SIZE = 50;

/* ── State ─────────────────────────────────────────── */

var studentsData = [];       // Full dataset from server
var filteredData = [];       // Current filtered view (search result or all)
var currentPage = 1;         // Current pagination page
var selectedStudent = null;
var selectedViolation = null;
var isSubmitting = false;
var isLoading = false;
var animFrameSiswa = 0;
var animFramePelanggaran = 0;
var searchIndex = [];        // Pre-normalized search strings

/* ── DOM References ────────────────────────────────── */

var dom = {};

function initDOM() {
  var g = function(id) { return document.getElementById(id); };
  dom.searchInput     = g('searchInput');
  dom.searchClear     = g('searchClear');
  dom.tableBody       = g('tableBody');
  dom.tableScroll     = g('tableScroll');
  dom.stateLoading    = g('stateLoading');
  dom.stateError      = g('stateError');
  dom.stateEmpty      = g('stateEmpty');
  dom.stateConfig     = g('stateConfig');
  dom.errorTitle      = g('errorTitle');
  dom.errorDesc       = g('errorDesc');
  dom.emptyTitle      = g('emptyTitle');
  dom.emptyDesc       = g('emptyDesc');
  dom.btnRetry        = g('btnRetry');
  dom.resultCount     = g('resultCount');
  dom.statSiswa       = g('statSiswa');
  dom.statPelanggaran = g('statPelanggaran');
  dom.modalOverlay    = g('modalOverlay');
  dom.modalClose      = g('modalClose');
  dom.modalNama       = g('modalNama');
  dom.modalKelas      = g('modalKelas');
  dom.modalAvatar     = g('modalAvatar');
  dom.violationGrid   = g('violationGrid');
  dom.btnBatal        = g('btnBatal');
  dom.btnSubmit       = g('btnSubmit');
  dom.toastContainer  = g('toastContainer');
  dom.pagination      = g('pagination');
}

/* ── Initialization ────────────────────────────────── */

document.addEventListener('DOMContentLoaded', function() {
  initDOM();
  renderViolationOptions();
  bindEvents();

  if (isConfigured()) {
    loadData(false);
  } else {
    showState('config');
  }
});

function isConfigured() {
  return APPS_SCRIPT_URL &&
         APPS_SCRIPT_URL !== 'PASTE_URL_DEPLOY_DISINI' &&
         APPS_SCRIPT_URL.startsWith('https://');
}

/* ── Event Binding ─────────────────────────────────── */

function bindEvents() {
  // Search — debounced
  var searchTimer;
  dom.searchInput.addEventListener('input', function() {
    var hasVal = dom.searchInput.value.trim().length > 0;
    dom.searchInput.parentElement.classList.toggle('has-value', hasVal);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(handleSearch, 180);
  });
  dom.searchClear.addEventListener('click', clearSearch);

  // Table row clicks — single delegated listener
  dom.tableBody.addEventListener('click', function(e) {
    var tr = e.target.closest('tr');
    if (!tr) return;
    var idx = tr.getAttribute('data-idx');
    if (idx == null) return;
    var student = filteredData[parseInt(idx, 10)];
    if (student) openModal(student);
  });

  // Modal
  dom.modalClose.addEventListener('click', closeModal);
  dom.btnBatal.addEventListener('click', closeModal);
  dom.modalOverlay.addEventListener('click', function(e) {
    if (e.target === dom.modalOverlay) closeModal();
  });

  // Submit
  dom.btnSubmit.addEventListener('click', submitViolation);

  // Retry
  dom.btnRetry.addEventListener('click', function() { loadData(false); });

  // Keyboard — Escape to close modal
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeModal();
  });

  // Violation grid — single delegated listener
  dom.violationGrid.addEventListener('change', function(e) {
    if (e.target.name === 'violationType') {
      selectedViolation = e.target.value;
      dom.btnSubmit.disabled = false;
    }
  });

  // Pagination — delegated
  dom.pagination.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-page]');
    if (!btn) return;
    var page = btn.getAttribute('data-page');
    if (page === 'prev') {
      goToPage(currentPage - 1);
    } else if (page === 'next') {
      goToPage(currentPage + 1);
    } else {
      goToPage(parseInt(page, 10));
    }
  });
}

/* ── Data Loading ──────────────────────────────────── */

function loadData(silent) {
  if (isLoading) return;
  isLoading = true;

  // Try cache first
  var cached = null;
  var hasCache = false;
  try {
    var raw = localStorage.getItem(CACHE_KEY_DATA);
    if (raw) {
      cached = JSON.parse(raw);
      if (Array.isArray(cached) && cached.length > 0) {
        studentsData = cached;
        buildSearchIndex();
        var ct = localStorage.getItem(CACHE_KEY_TOTAL);
        updateStats(ct ? parseInt(ct, 10) : calculateTotal(studentsData));
        applyCurrentView();
        hasCache = true;
      }
    }
  } catch (e) {
    localStorage.removeItem(CACHE_KEY_DATA);
    localStorage.removeItem(CACHE_KEY_TOTAL);
  }

  if (!hasCache && !silent) {
    showState('loading');
  }

  fetch(APPS_SCRIPT_URL)
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function(result) {
      if (!result.success) throw new Error(result.error || 'Server error.');

      studentsData = result.data || [];
      buildSearchIndex();

      var total = result.totalViolations != null
        ? result.totalViolations
        : calculateTotal(studentsData);

      // Save to cache
      try {
        localStorage.setItem(CACHE_KEY_DATA, JSON.stringify(studentsData));
        localStorage.setItem(CACHE_KEY_TOTAL, total.toString());
      } catch (e) {}

      if (studentsData.length === 0) {
        showState('empty');
        dom.emptyTitle.textContent = 'Belum ada data siswa';
        dom.emptyDesc.textContent = 'Tambahkan data siswa di Sheet1 Google Spreadsheet.';
      } else {
        applyCurrentView();
      }
      updateStats(total);
    })
    .catch(function(err) {
      if (hasCache) {
        showToast('Gagal sinkronisasi data terbaru.', 'error');
      } else {
        showError('Gagal memuat data', err.message || 'Periksa koneksi internet.');
      }
    })
    .finally(function() {
      isLoading = false;
    });
}

/* ── Search Index ──────────────────────────────────── */

/**
 * Pre-normalize all student names and classes to lowercase once.
 * Avoids calling .toLowerCase() 1565 times on every keypress.
 */
function buildSearchIndex() {
  searchIndex = new Array(studentsData.length);
  for (var i = 0; i < studentsData.length; i++) {
    var s = studentsData[i];
    searchIndex[i] = (s.nama + ' ' + s.kelas).toLowerCase();
  }
}

/* ── View Controller ───────────────────────────────── */

function applyCurrentView() {
  var query = dom.searchInput.value.toLowerCase().trim();
  if (query) {
    filterByQuery(query);
  } else {
    filteredData = studentsData;
  }
  currentPage = 1;
  renderCurrentPage();
}

function filterByQuery(query) {
  filteredData = [];
  for (var i = 0; i < studentsData.length; i++) {
    if (searchIndex[i].indexOf(query) !== -1) {
      filteredData.push(studentsData[i]);
    }
  }
}

/* ── Pagination ────────────────────────────────────── */

function getTotalPages() {
  return Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));
}

function goToPage(page) {
  var total = getTotalPages();
  if (page < 1 || page > total) return;
  currentPage = page;
  renderCurrentPage();
  // Scroll table to top
  dom.tableScroll.scrollTop = 0;
}

function renderCurrentPage() {
  if (filteredData.length === 0) {
    showState('empty');
    dom.emptyTitle.textContent = 'Tidak ditemukan';
    dom.emptyDesc.textContent = 'Tidak ada siswa yang cocok dengan "' + dom.searchInput.value + '".';
    dom.pagination.innerHTML = '';
    return;
  }

  var total = getTotalPages();
  var start = (currentPage - 1) * PAGE_SIZE;
  var end = Math.min(start + PAGE_SIZE, filteredData.length);
  var pageData = filteredData.slice(start, end);

  renderTable(pageData, start);
  renderPagination(total);
  showState('table');

  dom.resultCount.textContent =
    'Menampilkan ' + (start + 1) + '–' + end + ' dari ' + filteredData.length + ' siswa';
  dom.resultCount.classList.add('visible');
}

function renderPagination(totalPages) {
  if (totalPages <= 1) {
    dom.pagination.innerHTML = '';
    return;
  }

  var html = '';

  // Prev
  html += '<button class="page-btn' + (currentPage === 1 ? ' disabled' : '') +
    '" data-page="prev"' + (currentPage === 1 ? ' disabled' : '') + '>‹</button>';

  // Page numbers with ellipsis
  var pages = buildPageNumbers(currentPage, totalPages);
  for (var i = 0; i < pages.length; i++) {
    var p = pages[i];
    if (p === '...') {
      html += '<span class="page-ellipsis">…</span>';
    } else {
      html += '<button class="page-btn' + (p === currentPage ? ' active' : '') +
        '" data-page="' + p + '">' + p + '</button>';
    }
  }

  // Next
  html += '<button class="page-btn' + (currentPage === totalPages ? ' disabled' : '') +
    '" data-page="next"' + (currentPage === totalPages ? ' disabled' : '') + '>›</button>';

  dom.pagination.innerHTML = html;
}

function buildPageNumbers(current, total) {
  if (total <= 7) {
    var all = [];
    for (var i = 1; i <= total; i++) all.push(i);
    return all;
  }

  var pages = [1];
  if (current > 3) pages.push('...');

  var start = Math.max(2, current - 1);
  var end = Math.min(total - 1, current + 1);
  for (var j = start; j <= end; j++) pages.push(j);

  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

/* ── Table Rendering ───────────────────────────────── */

function renderTable(data, globalOffset) {
  var html = '';
  for (var i = 0; i < data.length; i++) {
    var student = data[i];
    var globalIdx = globalOffset + i;
    var telatCount = student.pelanggaran['Telat'] || 0;
    var rowClass = '';
    if (telatCount > 3) {
      rowClass = ' class="row-danger"';
    } else if (telatCount > 2) {
      rowClass = ' class="row-warning"';
    }

    html += '<tr' + rowClass + ' data-idx="' + globalIdx + '">' +
      '<td class="td-no">' + (globalIdx + 1) + '</td>' +
      '<td class="td-nama">' + escapeHtml(student.nama) + '</td>' +
      '<td class="td-kelas">' + escapeHtml(student.kelas) + '</td>' +
      buildBadgeCells(student.pelanggaran) +
      '</tr>';
  }
  dom.tableBody.innerHTML = html;
}

function buildBadgeCells(pelanggaran) {
  var cells = '';
  for (var i = 0; i < VIOLATION_TYPES.length; i++) {
    var type = VIOLATION_TYPES[i];
    var count = pelanggaran[type.label] || 0;
    var cls = count > 0 ? type.badgeClass : 'badge--zero';
    cells += '<td class="td-badge"><span class="badge ' + cls + '">' + count + '</span></td>';
  }
  return cells;
}

/* ── State Management ──────────────────────────────── */

function showState(state) {
  dom.stateLoading.classList.toggle('active', state === 'loading');
  dom.stateError.classList.toggle('active', state === 'error');
  dom.stateEmpty.classList.toggle('active', state === 'empty');
  dom.stateConfig.classList.toggle('active', state === 'config');
  dom.tableScroll.style.display = state === 'table' ? 'block' : 'none';
  dom.resultCount.classList.toggle('visible', state === 'table');
  dom.pagination.style.display = state === 'table' ? '' : 'none';
}

function showError(title, desc) {
  dom.errorTitle.textContent = title;
  dom.errorDesc.textContent = desc;
  showState('error');
}

/* ── Stats ─────────────────────────────────────────── */

function updateStats(totalViolations) {
  animFrameSiswa = animateNumber(dom.statSiswa, studentsData.length, animFrameSiswa);
  var total = totalViolations != null ? totalViolations : calculateTotal(studentsData);
  animFramePelanggaran = animateNumber(dom.statPelanggaran, total, animFramePelanggaran);
}

function calculateTotal(data) {
  var sum = 0;
  for (var i = 0; i < data.length; i++) {
    var p = data[i].pelanggaran;
    for (var k in p) {
      if (p.hasOwnProperty(k)) sum += p[k];
    }
  }
  return sum;
}

function animateNumber(el, target, prevId) {
  if (prevId) cancelAnimationFrame(prevId);
  var start = parseInt(el.textContent) || 0;
  var diff = target - start;
  if (diff === 0) { el.textContent = target; return 0; }

  var duration = 350;
  var t0 = performance.now();
  var fid = 0;

  function step(now) {
    var p = Math.min((now - t0) / duration, 1);
    var eased = 1 - (1 - p) * (1 - p);
    el.textContent = Math.round(start + diff * eased);
    if (p < 1) fid = requestAnimationFrame(step);
  }
  fid = requestAnimationFrame(step);
  return fid;
}

/* ── Search ────────────────────────────────────────── */

function handleSearch() {
  var query = dom.searchInput.value.toLowerCase().trim();
  if (!query) {
    filteredData = studentsData;
  } else {
    filterByQuery(query);
  }
  currentPage = 1;
  renderCurrentPage();
}

function clearSearch() {
  dom.searchInput.value = '';
  dom.searchInput.parentElement.classList.remove('has-value');
  dom.searchInput.focus();
  filteredData = studentsData;
  currentPage = 1;
  renderCurrentPage();
}

/* ── Modal ─────────────────────────────────────────── */

function openModal(student) {
  selectedStudent = student;
  selectedViolation = null;

  dom.modalNama.textContent = student.nama;
  dom.modalKelas.textContent = student.kelas;
  dom.modalAvatar.textContent = getInitials(student.nama);

  var radios = dom.violationGrid.querySelectorAll('input[type="radio"]');
  for (var i = 0; i < radios.length; i++) radios[i].checked = false;

  dom.btnSubmit.disabled = true;
  dom.btnSubmit.classList.remove('is-loading');

  dom.modalOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  if (isSubmitting) return;
  dom.modalOverlay.classList.remove('active');
  document.body.style.overflow = '';
  selectedStudent = null;
  selectedViolation = null;
}

function getInitials(name) {
  var parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
}

/* ── Violation Options ─────────────────────────────── */

function renderViolationOptions() {
  var html = '';
  for (var i = 0; i < VIOLATION_TYPES.length; i++) {
    var t = VIOLATION_TYPES[i];
    html += '<label class="violation-option" data-type="' + t.label + '">' +
      '<input type="radio" name="violationType" value="' + t.label + '">' +
      '<div class="violation-card">' +
      '<span class="violation-card-icon">' + t.icon + '</span>' +
      '<span class="violation-card-label">' + t.label + '</span>' +
      '</div></label>';
  }
  dom.violationGrid.innerHTML = html;
}

/* ── Submit Violation ──────────────────────────────── */

function submitViolation() {
  if (!selectedStudent || !selectedViolation || isSubmitting) return;

  isSubmitting = true;
  dom.btnSubmit.classList.add('is-loading');
  dom.btnSubmit.disabled = true;

  var params = new URLSearchParams({
    action: 'add',
    nama: selectedStudent.nama,
    kelas: selectedStudent.kelas,
    jenis: selectedViolation,
  });

  fetch(APPS_SCRIPT_URL + '?' + params.toString())
    .then(function(r) { return r.json(); })
    .then(function(result) {
      if (!result.success) {
        showToast('Gagal: ' + (result.error || 'Terjadi kesalahan.'), 'error');
        return;
      }

      // Optimistic local update
      var cur = selectedStudent.pelanggaran[selectedViolation] || 0;
      selectedStudent.pelanggaran[selectedViolation] = cur + 1;

      // Update cache + UI
      var newTotal = calculateTotal(studentsData);
      try {
        localStorage.setItem(CACHE_KEY_DATA, JSON.stringify(studentsData));
        localStorage.setItem(CACHE_KEY_TOTAL, newTotal.toString());
      } catch (e) {}

      // Rebuild search index (counts changed)
      buildSearchIndex();
      updateStats(newTotal);
      renderCurrentPage();

      isSubmitting = false;
      dom.btnSubmit.classList.remove('is-loading');

      showToast(
        'Pelanggaran "' + selectedViolation + '" untuk ' + selectedStudent.nama + ' berhasil dicatat ✓',
        'success'
      );
      closeModal();

      // Silent background sync
      setTimeout(function() { loadData(true); }, 3000);
    })
    .catch(function() {
      showToast('Gagal mengirim data. Periksa koneksi internet.', 'error');
    })
    .finally(function() {
      isSubmitting = false;
      dom.btnSubmit.classList.remove('is-loading');
      dom.btnSubmit.disabled = false;
    });
}

/* ── Toast ─────────────────────────────────────────── */

function showToast(message, type) {
  var toast = document.createElement('div');
  toast.className = 'toast toast--' + (type || 'info');
  toast.textContent = message;
  dom.toastContainer.appendChild(toast);

  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      toast.classList.add('show');
    });
  });

  setTimeout(function() {
    toast.classList.remove('show');
    toast.classList.add('hiding');
    setTimeout(function() {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 350);
  }, 3500);
}

/* ── Utility ───────────────────────────────────────── */

var _esc = document.createElement('span');
function escapeHtml(text) {
  _esc.textContent = text;
  return _esc.innerHTML;
}
