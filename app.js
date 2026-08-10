/* ═══════════════════════════════════════════════════
   Pencatat Pelanggaran — OSIS SMAN 3 Garut
   Frontend Logic
   ═══════════════════════════════════════════════════ */

/**
 * ⚠️ GANTI URL DI BAWAH INI
 * Paste URL deploy Google Apps Script kamu di sini.
 * Lihat SETUP.md Langkah 3 untuk cara mendapatkan URL.
 */
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxgny7vyH-IoYhc06N4liy582vVGxlgKTl9ig3f0F60Ue-qMKMYiSXdpNtZu1PpgySO/exec';

/* ── Konfigurasi Jenis Pelanggaran ─────────────────── */

const VIOLATION_TYPES = [
  { label: 'Telat',           icon: '⏰', badgeClass: 'badge--telat' },
  { label: 'Make up',         icon: '💄', badgeClass: 'badge--makeup' },
  { label: 'Rok Baping',      icon: '👗', badgeClass: 'badge--rok' },
  { label: 'Atribut',         icon: '🎽', badgeClass: 'badge--atribut' },
  { label: 'Kaus Kaki',       icon: '🧦', badgeClass: 'badge--kaki' },
  { label: 'Benda Berbahaya', icon: '⚠️', badgeClass: 'badge--benda' },
];

/* ── State ─────────────────────────────────────────── */

let studentsData = [];
let selectedStudent = null;
let selectedViolation = null;
let isSubmitting = false;

/* ── DOM References ────────────────────────────────── */

const $ = (id) => document.getElementById(id);

const dom = {
  searchInput:    $('searchInput'),
  searchClear:    $('searchClear'),
  tableBody:      $('tableBody'),
  tableScroll:    $('tableScroll'),
  stateLoading:   $('stateLoading'),
  stateError:     $('stateError'),
  stateEmpty:     $('stateEmpty'),
  stateConfig:    $('stateConfig'),
  errorTitle:     $('errorTitle'),
  errorDesc:      $('errorDesc'),
  emptyTitle:     null,
  emptyDesc:      $('emptyDesc'),
  btnRetry:       $('btnRetry'),
  resultCount:    $('resultCount'),
  statSiswa:      $('statSiswa'),
  statPelanggaran:$('statPelanggaran'),
  modalOverlay:   $('modalOverlay'),
  modal:          $('modal'),
  modalClose:     $('modalClose'),
  modalNama:      $('modalNama'),
  modalKelas:     $('modalKelas'),
  modalAvatar:    $('modalAvatar'),
  violationGrid:  $('violationGrid'),
  btnBatal:       $('btnBatal'),
  btnSubmit:      $('btnSubmit'),
  toastContainer: $('toastContainer'),
};

/* ── Initialization ────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  // Cache emptyTitle (queried from DOM since it has no ID)
  dom.emptyTitle = dom.stateEmpty.querySelector('.state-title');

  renderViolationOptions();
  bindEvents();

  if (isConfigured()) {
    loadData();
  } else {
    showState('config');
  }
});

/**
 * Check if Apps Script URL has been configured.
 */
function isConfigured() {
  return APPS_SCRIPT_URL &&
         APPS_SCRIPT_URL !== 'PASTE_URL_DEPLOY_DISINI' &&
         APPS_SCRIPT_URL.startsWith('https://');
}

/* ── Event Binding ─────────────────────────────────── */

function bindEvents() {
  // Search
  dom.searchInput.addEventListener('input', handleSearch);
  dom.searchClear.addEventListener('click', clearSearch);

  // Modal
  dom.modalClose.addEventListener('click', closeModal);
  dom.btnBatal.addEventListener('click', closeModal);
  dom.modalOverlay.addEventListener('click', (e) => {
    if (e.target === dom.modalOverlay) closeModal();
  });

  // Submit
  dom.btnSubmit.addEventListener('click', submitViolation);

  // Retry
  dom.btnRetry.addEventListener('click', loadData);

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

/* ── Data Loading ──────────────────────────────────── */

async function loadData() {
  showState('loading');

  try {
    const response = await fetch(APPS_SCRIPT_URL);

    if (!response.ok) {
      throw new Error('HTTP ' + response.status + ': ' + response.statusText);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Server mengembalikan error.');
    }

    studentsData = result.data || [];

    if (studentsData.length === 0) {
      showState('empty');
      dom.emptyTitle.textContent = 'Belum ada data siswa';
      dom.emptyDesc.textContent = 'Tambahkan data siswa di Sheet1 Google Spreadsheet.';
    } else {
      renderTable(studentsData);
      showState('table');
    }

    updateStats(result.totalViolations);

  } catch (err) {
    console.error('Load error:', err);
    showError(
      'Gagal memuat data',
      err.message || 'Periksa koneksi internet dan URL konfigurasi.'
    );
  }
}

/* ── State Management ──────────────────────────────── */

/**
 * Show a specific UI state: 'loading', 'error', 'empty', 'config', 'table'.
 */
function showState(state) {
  dom.stateLoading.classList.toggle('active', state === 'loading');
  dom.stateError.classList.toggle('active', state === 'error');
  dom.stateEmpty.classList.toggle('active', state === 'empty');
  dom.stateConfig.classList.toggle('active', state === 'config');
  dom.tableScroll.style.display = state === 'table' ? 'block' : 'none';

  dom.resultCount.classList.toggle('visible', state === 'table');
}

function showError(title, desc) {
  dom.errorTitle.textContent = title;
  dom.errorDesc.textContent = desc;
  showState('error');
}

/* ── Stats ─────────────────────────────────────────── */

function updateStats(totalViolations) {
  // Animate number counting
  animateNumber(dom.statSiswa, studentsData.length);
  animateNumber(dom.statPelanggaran, totalViolations != null
    ? totalViolations
    : studentsData.reduce((sum, s) => {
        return sum + Object.values(s.pelanggaran).reduce((a, b) => a + b, 0);
      }, 0)
  );
}

/**
 * Simple number count-up animation.
 */
function animateNumber(el, target) {
  const duration = 600;
  const start = parseInt(el.textContent) || 0;
  const diff = target - start;

  if (diff === 0) {
    el.textContent = target;
    return;
  }

  const startTime = performance.now();

  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out quad
    const eased = 1 - (1 - progress) * (1 - progress);
    const current = Math.round(start + diff * eased);
    el.textContent = current;
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

/* ── Table Rendering ───────────────────────────────── */

function renderTable(data) {
  dom.tableBody.innerHTML = '';

  data.forEach((student, index) => {
    const tr = document.createElement('tr');
    tr.style.setProperty('--i', Math.min(index, 20));

    // Determine row class based on "Telat" count
    const telatCount = student.pelanggaran['Telat'] || 0;
    if (telatCount > 3) {
      tr.classList.add('row-danger');
    } else if (telatCount > 2) {
      tr.classList.add('row-warning');
    }

    // Click handler: open modal
    tr.addEventListener('click', () => openModal(student));

    // Build cells
    tr.innerHTML =
      '<td class="td-no">' + (index + 1) + '</td>' +
      '<td class="td-nama">' + escapeHtml(student.nama) + '</td>' +
      '<td class="td-kelas">' + escapeHtml(student.kelas) + '</td>' +
      buildBadgeCells(student.pelanggaran);

    dom.tableBody.appendChild(tr);
  });

  // Update result count
  dom.resultCount.textContent =
    'Menampilkan ' + data.length + ' dari ' + studentsData.length + ' siswa';
  dom.resultCount.classList.add('visible');
}

/**
 * Build badge <td> cells for all violation types.
 */
function buildBadgeCells(pelanggaran) {
  return VIOLATION_TYPES.map(function(type) {
    var count = pelanggaran[type.label] || 0;
    var cls = count > 0 ? type.badgeClass : 'badge--zero';
    return '<td class="td-badge">' +
           '<span class="badge ' + cls + '">' + count + '</span>' +
           '</td>';
  }).join('');
}

/* ── Search ────────────────────────────────────────── */

function handleSearch() {
  var query = dom.searchInput.value.toLowerCase().trim();

  // Toggle clear button visibility
  dom.searchInput.parentElement.classList.toggle('has-value', query.length > 0);

  if (!query) {
    renderTable(studentsData);
    showState('table');
    return;
  }

  var filtered = studentsData.filter(function(s) {
    return s.nama.toLowerCase().indexOf(query) !== -1 ||
           s.kelas.toLowerCase().indexOf(query) !== -1;
  });

  if (filtered.length === 0) {
    showState('empty');
    dom.emptyTitle.textContent = 'Tidak ditemukan';
    dom.emptyDesc.textContent =
      'Tidak ada siswa yang cocok dengan "' + dom.searchInput.value + '".';
  } else {
    renderTable(filtered);
    showState('table');
  }
}

function clearSearch() {
  dom.searchInput.value = '';
  dom.searchInput.parentElement.classList.remove('has-value');
  dom.searchInput.focus();
  renderTable(studentsData);
  showState('table');
}

/* ── Modal ─────────────────────────────────────────── */

function openModal(student) {
  selectedStudent = student;
  selectedViolation = null;

  // Populate student info
  dom.modalNama.textContent = student.nama;
  dom.modalKelas.textContent = student.kelas;
  dom.modalAvatar.textContent = getInitials(student.nama);

  // Reset radio buttons
  dom.violationGrid.querySelectorAll('input[type="radio"]').forEach(function(r) {
    r.checked = false;
  });

  // Reset submit button
  dom.btnSubmit.disabled = true;
  dom.btnSubmit.classList.remove('is-loading');

  // Show modal
  dom.modalOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  if (isSubmitting) return; // Prevent closing while submitting

  dom.modalOverlay.classList.remove('active');
  document.body.style.overflow = '';
  selectedStudent = null;
  selectedViolation = null;
}

/**
 * Get initials from a name (first letter of first two words).
 */
function getInitials(name) {
  var parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].substring(0, 2).toUpperCase();
}

/* ── Violation Options ─────────────────────────────── */

function renderViolationOptions() {
  dom.violationGrid.innerHTML = VIOLATION_TYPES.map(function(type) {
    return '<label class="violation-option" data-type="' + type.label + '">' +
           '  <input type="radio" name="violationType" value="' + type.label + '">' +
           '  <div class="violation-card">' +
           '    <span class="violation-card-icon">' + type.icon + '</span>' +
           '    <span class="violation-card-label">' + type.label + '</span>' +
           '  </div>' +
           '</label>';
  }).join('');

  // Bind change events
  dom.violationGrid.querySelectorAll('input[type="radio"]').forEach(function(radio) {
    radio.addEventListener('change', function(e) {
      selectedViolation = e.target.value;
      dom.btnSubmit.disabled = false;
    });
  });
}

/* ── Submit Violation ──────────────────────────────── */

async function submitViolation() {
  if (!selectedStudent || !selectedViolation || isSubmitting) return;

  isSubmitting = true;
  dom.btnSubmit.classList.add('is-loading');
  dom.btnSubmit.disabled = true;

  try {
    var params = new URLSearchParams({
      action: 'add',
      nama: selectedStudent.nama,
      kelas: selectedStudent.kelas,
      jenis: selectedViolation,
    });

    var response = await fetch(APPS_SCRIPT_URL + '?' + params.toString());
    var result = await response.json();

    if (result.success) {
      // Reset submit state before closing modal (closeModal checks isSubmitting)
      isSubmitting = false;
      dom.btnSubmit.classList.remove('is-loading');

      showToast(
        'Pelanggaran "' + selectedViolation + '" untuk ' + selectedStudent.nama + ' berhasil dicatat ✓',
        'success'
      );
      closeModal();

      // Reload data to reflect changes
      await loadData();

    } else {
      showToast('Gagal: ' + (result.error || 'Terjadi kesalahan.'), 'error');
    }

  } catch (err) {
    console.error('Submit error:', err);
    showToast('Gagal mengirim data. Periksa koneksi internet.', 'error');
  } finally {
    isSubmitting = false;
    dom.btnSubmit.classList.remove('is-loading');
    dom.btnSubmit.disabled = false;
  }
}

/* ── Toast Notifications ───────────────────────────── */

function showToast(message, type) {
  type = type || 'info';

  var toast = document.createElement('div');
  toast.className = 'toast toast--' + type;
  toast.textContent = message;
  dom.toastContainer.appendChild(toast);

  // Trigger entrance animation (next frame so the initial transform applies)
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      toast.classList.add('show');
    });
  });

  // Auto-dismiss after 3.5s
  setTimeout(function() {
    toast.classList.remove('show');
    toast.classList.add('hiding');
    setTimeout(function() {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 350);
  }, 3500);
}

/* ── Utility ───────────────────────────────────────── */

/**
 * Escape HTML special characters to prevent XSS.
 */
function escapeHtml(text) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}
