# 📋 Panduan Setup — Pencatat Pelanggaran OSIS SMAN 3 Garut

Ikuti langkah-langkah ini untuk menyiapkan aplikasi dari nol.

---

## Langkah 1: Siapkan Google Spreadsheet

1. Buka [Google Sheets](https://sheets.google.com) dan buat spreadsheet baru.
2. Beri nama: **"Data Pelanggaran OSIS SMAN 3 Garut"** (atau sesuai keinginan).

### Sheet1 — Data Siswa

Biarkan nama sheet tetap **"Sheet1"**. Isi format berikut:

| | A | B |
|---|---|---|
| **1** | **Nama** | **Kelas** |
| 2 | Ahmad Fadilah | X-1 |
| 3 | Budi Santoso | X-2 |
| 4 | Citra Dewi | XI-IPA-1 |
| ... | ... | ... |

> [!IMPORTANT]
> Baris pertama (A1, B1) **harus berisi header** "Nama" dan "Kelas". Data siswa dimulai dari baris ke-2.

### Sheet2 — Log Pelanggaran

Klik tombol **"+"** di bawah untuk menambah sheet baru. Pastikan namanya **"Sheet2"** (default). Isi header di baris pertama:

| | A | B | C | D |
|---|---|---|---|---|
| **1** | **Waktu** | **Nama** | **Kelas** | **Jenis Pelanggaran** |

> [!NOTE]
> Sheet2 akan terisi otomatis setiap kali pelanggaran dicatat melalui aplikasi. Kamu hanya perlu membuat header-nya saja.

---

## Langkah 2: Buat Google Apps Script

1. Di spreadsheet yang sudah dibuat, klik menu **Extensions** → **Apps Script**.
2. Akan terbuka editor Apps Script di tab baru.
3. Hapus semua kode default yang ada di file `Code.gs`.
4. Buka file `Code.gs` dari project ini, **copy seluruh isinya**.
5. **Paste** ke editor Apps Script (menggantikan kode default).
6. Klik **💾 Save** (Ctrl+S).

> [!TIP]
> Karena Apps Script dibuat dari dalam spreadsheet, kamu **tidak perlu** mengisi `SPREADSHEET_ID` di kode. Biarkan kosong.

---

## Langkah 3: Deploy sebagai Web App

1. Di editor Apps Script, klik tombol **Deploy** → **New deployment**.
2. Klik ikon ⚙️ (gear) di sebelah "Select type", pilih **Web app**.
3. Isi pengaturan:
   - **Description**: `API Pelanggaran v1` (atau apa saja)
   - **Execute as**: **Me** (email kamu)
   - **Who has access**: **Anyone**
4. Klik **Deploy**.
5. Klik **Authorize access**, lalu login dengan akun Google kamu.
6. Jika muncul peringatan "Google hasn't verified this app":
   - Klik **Advanced** → **Go to [nama project] (unsafe)** → **Allow**.
7. **Copy URL** yang muncul setelah deploy berhasil.

> [!CAUTION]
> URL deploy terlihat seperti:
> ```
> https://script.google.com/macros/s/AKfycbx.../exec
> ```
> **Simpan URL ini baik-baik!** URL ini akan di-paste ke file konfigurasi frontend.

---

## Langkah 4: Hubungkan Frontend

1. Buka file `app.js` dari project ini.
2. Cari baris paling atas:
   ```javascript
   const APPS_SCRIPT_URL = 'PASTE_URL_DEPLOY_DISINI';
   ```
3. Ganti `'PASTE_URL_DEPLOY_DISINI'` dengan URL deploy dari Langkah 3.
4. Simpan file.

---

## Langkah 5: Jalankan Aplikasi

### Cara Termudah (Tanpa Install Apapun)
Cukup **double-click** file `index.html` untuk membukanya di browser.

### Cara Lebih Baik (Pakai Live Server)
Jika kamu punya **VS Code**:
1. Install extension **Live Server**.
2. Buka folder project di VS Code.
3. Klik kanan `index.html` → **Open with Live Server**.

Atau pakai Python:
```bash
cd path/ke/folder/project
python -m http.server 8000
```
Lalu buka `http://localhost:8000` di browser.

---

## ⚠️ Troubleshooting

### "Gagal memuat data" / Network Error
- Pastikan URL Apps Script sudah benar di `app.js`.
- Pastikan deploy-nya menggunakan **"Anyone"** untuk akses.
- Coba buka URL Apps Script langsung di browser — harus muncul JSON.

### Data siswa tidak muncul
- Pastikan nama sheet tepat: **"Sheet1"** (bukan "sheet1" atau "Daftar Siswa").
- Pastikan ada header di baris 1 dan data mulai dari baris 2.
- Pastikan kolom A = Nama, kolom B = Kelas.

### Pelanggaran tidak tercatat
- Pastikan **"Sheet2"** ada dan memiliki header di baris 1.
- Buka Apps Script, klik **Executions** di sidebar untuk melihat log error.

### Setelah update kode Apps Script
- Kamu harus **deploy ulang** (New deployment) setiap kali mengubah kode Apps Script.
- URL deploy akan berubah setiap kali deploy baru. Update URL di `app.js`.

> [!TIP]
> Untuk update tanpa ganti URL, pilih **Deploy** → **Manage deployments** → klik ✏️ edit → pilih **version baru** → **Deploy**.

---

## 📁 Struktur File

```
osis-sman3-garut/
├── index.html    ← Halaman utama (buka di browser)
├── style.css     ← Styling dan desain
├── app.js        ← Logika frontend (edit URL di sini)
├── Code.gs       ← Copy ke Google Apps Script
├── SETUP.md      ← Panduan ini
```
