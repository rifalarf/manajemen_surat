const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'data.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Gagal terhubung ke database:", err.message);
    } else {
        console.log("Terhubung ke database SQLite.");
        db.run(`
            CREATE TABLE IF NOT EXISTS surat_peringatan (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nomor_surat TEXT NOT NULL,
                nama_karyawan TEXT NOT NULL,
                nama_perusahaan TEXT NOT NULL,
                alasan_peringatan TEXT NOT NULL,
                tanggal_surat TEXT NOT NULL,
                nama_penandatangan TEXT NOT NULL,
                signature TEXT NOT NULL
            )
        `, (err) => {
            if (err) {
                console.error("Gagal membuat tabel:", err.message);
            } else {
                console.log("Tabel surat_peringatan berhasil dibuat (jika belum ada).");
            }
        });
    }
});

module.exports = db;
