# Produksi Control Room

Prototype dashboard produksi harian dan operator dalam Bahasa Indonesia. Tidak memerlukan instalasi paket.

## Menjalankan

Di folder proyek jalankan:

```sh
python3 -m http.server 8000
```

Buka `http://localhost:8000` di browser.

## Fitur prototype

- Tampilan terpisah Admin (semua menu), Boss (dashboard/laporan baca-saja), dan Operator (input sendiri/tools). Kata sandi Admin dan Boss disiapkan terpisah saat pertama kali dipilih; Operator memilih profil operator.
- Dashboard target, output OK/repair/NG, loading line PO, hasil operator, dan tools.
- Loading line per mesin dengan pekerjaan terakhir serta status verifikasi. Admin dapat menyetujui hasil atau mengembalikannya untuk koreksi; keputusan, waktu, dan catatan tersimpan dalam audit laporan.
- Input produksi per operator, item/PO, OP, shift, serta satu atau beberapa mesin. Cycle time, loading, dan unloading diisi dalam menit lalu ditampilkan sebagai jam dan menit.
- Batas jumlah proses lanjutan berdasarkan output tahap sebelumnya. Konsumsi bahan hanya dipotong pada OP1 agar OP berikutnya tidak menghitung material yang sama berulang kali.
- Catatan setting/pergantian pekerjaan mesin dan waktu setup.
- Pengambilan tools memakai stok Baru atau Bekas, memilih mesin, dan membuat kode ringkas tipe/ukuran-operator-mesin-tanggal-jam-urutan (contoh `E10-AMR-850-261117-0304-01`). Retur mencocokkan kode awal; stok reusable/afkir bertambah setelah verifikasi Admin.
- Absensi masuk/pulang operator dengan timestamp, verifikasi manual Admin, serta formulir izin/cuti yang memerlukan persetujuan.
- Master customer dapat ditambah/diubah manual; item/target dapat diperbarui dan nomor PO boleh dikosongkan sampai PO diterbitkan.
- Dashboard Data Master memisahkan pengelolaan item/PO, nama customer, OP dan target per OP, spesifikasi/ukuran material, operator, serta mesin dari halaman Imigrasi Material. Operator dapat mengetik nama baru saat login atau pada laporan.
- Admin dan Boss dapat mengganti kata sandi melalui menu Pengaturan. Admin dapat mencatat serta mengubah penyesuaian progres manual secara terpisah tanpa mengubah laporan operator yang sudah tersimpan.
- Master item menjadi sumber nama item, customer, dan PO di halaman Material; perubahan customer juga diperbarui pada transaksi penerimaan dan pengiriman yang terkait.
- Penerimaan material PCS atau batang dengan konversi EQ, stok/WIP per OP, catatan pengiriman, dan ekspor CSV untuk Excel.
- Ekspor customer hanya berisi pengiriman OK aktual. Data repair/NG internal tetap dicatat dengan angka sebenarnya dan tidak dimanipulasi.

## Batasan penting

Ini prototype lokal: data demo dan perubahan disimpan di `localStorage` browser yang digunakan. Kata sandi Admin/Boss disimpan sebagai hash lokal, bukan di server; profil Operator belum memakai kata sandi. Pemisahan peran hanya demonstrasi UI dan dapat dilewati pengguna teknis browser. Data tidak tersinkron antaroperator/perangkat dan bukan layanan realtime yang dapat diakses dari luar perangkat tersebut.

Penggunaan nyata memerlukan backend/database, autentikasi/otorisasi server untuk setiap peran, sinkronisasi realtime, dan deployment. Integrasi absensi Google Sheets juga belum diaktifkan; status absensi pada prototype bersifat demo/manual. Jangan gunakan data demo sebagai catatan produksi resmi.