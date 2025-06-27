const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');
const multer = require('multer');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const { createCanvas } = require('canvas');
const jsQR = require('jsqr');

// Gunakan Environment Variable untuk kunci publik
const publicKey = process.env.PUBLIC_KEY.replace(/\\n/g, '\n');

// Konfigurasi Multer untuk menyimpan file di memori
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // Batas 10 MB
});

// Rute untuk menampilkan halaman verifikasi
router.get('/', (req, res) => {
    res.render('verify/form');
});

// Rute untuk memindai QR code dari PDF yang diunggah
router.post('/scan-qr', upload.single('suratPdf'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Tidak ada file yang diunggah.' });
    }

    try {
        const data = new Uint8Array(req.file.buffer);
        const pdf = await pdfjsLib.getDocument(data).promise;
        const page = await pdf.getPage(1);

        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = createCanvas(viewport.width, viewport.height);
        const context = canvas.getContext('2d');

        await page.render({ canvasContext: context, viewport: viewport }).promise;

        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code) {
            res.json({ signature: code.data });
        } else {
            res.status(404).json({ message: 'QR Code tidak ditemukan di dalam PDF.' });
        }
    } catch (error) {
        console.error('Error processing PDF:', error);
        res.status(500).json({ message: 'Gagal memproses file PDF.' });
    }
});

// Rute untuk melakukan verifikasi final
router.post('/verify', (req, res) => {
    const { nomorSurat, namaKaryawan, namaPerusahaan, alasanPeringatan, tanggalSurat, namaPenandatangan, signature } = req.body;
    const data = JSON.stringify({ nomorSurat, namaKaryawan, namaPerusahaan, alasanPeringatan, tanggalSurat, namaPenandatangan });
    const hash = crypto.createHash('sha256').update(data).digest('hex');

    try {
        const isVerified = crypto.verify(
            'SHA256',
            Buffer.from(hash, 'hex'),
            { key: publicKey, padding: crypto.constants.RSA_PKCS1_PADDING },
            Buffer.from(signature, 'base64')
        );

        if (isVerified) {
            res.send('<h1><i class="fas fa-check-circle" style="color: green;"></i> Verifikasi Berhasil!</h1><p>Tanda tangan pada surat ini sah dan data tidak berubah.</p>');
        } else {
            res.send('<h1><i class="fas fa-times-circle" style="color: red;"></i> Verifikasi Gagal!</h1><p>Tanda tangan tidak cocok atau data telah diubah.</p>');
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Terjadi kesalahan saat verifikasi.');
    }
});

module.exports = router;
