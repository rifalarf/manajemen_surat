const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

// Gunakan Environment Variable untuk kunci privat
const privateKey = process.env.PRIVATE_KEY.replace(/\\n/g, '\n');
const templatePath = path.join(__dirname, '../views/template.html');
const templateHtml = fs.readFileSync(templatePath, 'utf8');

router.get('/', (req, res) => {
    // Pastikan untuk selalu memberikan objek 'surat' ke templat
    res.render('admin/form', { surat: {} });
});

router.get('/manage', (req, res) => {
    db.all("SELECT id, nomor_surat, nama_karyawan, tanggal_surat FROM surat_peringatan ORDER BY id DESC", [], (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send("Gagal mengambil data dari database.");
        }
        res.render('admin/manage', { suratList: rows });
    });
});

router.get('/edit/:id', (req, res) => {
    const id = req.params.id;
    db.get("SELECT * FROM surat_peringatan WHERE id = ?", [id], (err, row) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send("Gagal query ke database.");
        }
        // Juga tangani kasus jika surat tidak ditemukan dengan memberikan objek kosong
        res.render('admin/form', { surat: row || {} });
    });
});

router.post('/update/:id', async (req, res) => {
    try {
        const { nomorSurat, namaKaryawan, namaPerusahaan, alasanPeringatan, tanggalSurat, namaPenandatangan } = req.body;
        const data = JSON.stringify({ nomorSurat, namaKaryawan, namaPerusahaan, alasanPeringatan, tanggalSurat, namaPenandatangan });
        const hash = crypto.createHash('sha256').update(data).digest('hex');
        const sign = crypto.sign('SHA256', Buffer.from(hash, 'hex'), {
            key: privateKey,
            padding: crypto.constants.RSA_PKCS1_PADDING,
        });
        const signature = sign.toString('base64');

        db.run(`UPDATE surat_peringatan SET nomor_surat = ?, nama_karyawan = ?, nama_perusahaan = ?, alasan_peringatan = ?, tanggal_surat = ?, nama_penandatangan = ?, signature = ? WHERE id = ?`,
            [nomorSurat, namaKaryawan, namaPerusahaan, alasanPeringatan, tanggalSurat, namaPenandatangan, signature, req.params.id],
            (err) => {
                if (err) {
                    console.error(err.message);
                    return res.status(500).send('Gagal memperbarui data.');
                }
                res.redirect('/admin/manage');
            }
        );
    } catch (error) {
        console.error(error);
        res.status(500).send('Error updating signature');
    }
});

router.post('/delete/:id', (req, res) => {
    db.run("DELETE FROM surat_peringatan WHERE id = ?", [req.params.id], (err) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send("Gagal menghapus data.");
        }
        res.redirect('/admin/manage');
    });
});

router.post('/generate', async (req, res) => {
    try {
        const { nomorSurat, namaKaryawan, namaPerusahaan, alasanPeringatan, tanggalSurat, namaPenandatangan } = req.body;

        const data = JSON.stringify({
            nomorSurat,
            namaKaryawan,
            namaPerusahaan,
            alasanPeringatan,
            tanggalSurat,
            namaPenandatangan
        });

        const hash = crypto.createHash('sha256').update(data).digest('hex');

        const sign = crypto.sign('SHA256', Buffer.from(hash, 'hex'), {
            key: privateKey,
            padding: crypto.constants.RSA_PKCS1_PADDING,
        });

        const signature = sign.toString('base64');

        const qrCodeDataURL = await qrcode.toDataURL(signature);

        let suratHtml = templateHtml.replace('$nomor_surat', nomorSurat);
        suratHtml = suratHtml.replace('$nama_karyawan', namaKaryawan);
        suratHtml = suratHtml.replace('$nama_perusahaan', namaPerusahaan);
        suratHtml = suratHtml.replace('$alasan_peringatan', alasanPeringatan);
        suratHtml = suratHtml.replace('$tanggal_surat', tanggalSurat);
        suratHtml = suratHtml.replace('$nama_penandatangan', namaPenandatangan);
        suratHtml = suratHtml.replace('$qr_code_url', qrCodeDataURL);

        db.run(`
            INSERT INTO surat_peringatan (nomor_surat, nama_karyawan, nama_perusahaan, alasan_peringatan, tanggal_surat, nama_penandatangan, signature)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [nomorSurat, namaKaryawan, namaPerusahaan, alasanPeringatan, tanggalSurat, namaPenandatangan, signature], async (err) => {
            if (err) {
                console.error("Gagal menyimpan data ke database:", err.message);
                return res.status(500).send('Gagal menyimpan data ke database');
            } else {
                console.log("Data surat peringatan berhasil disimpan ke database.");
                
                const browser = await puppeteer.launch({
                    args: chromium.args,
                    defaultViewport: chromium.defaultViewport,
                    executablePath: await chromium.executablePath(),
                    headless: chromium.headless,
                });
                const page = await browser.newPage();
                await page.setContent(suratHtml, { waitUntil: 'networkidle0' });
                const pdf = await page.pdf({ format: 'A4', printBackground: true });
                await browser.close();

                const safeFileName = nomorSurat.replace(/[\/\?<>\\:\*\|":]/g, '_');
                
                // Mengatur header respons untuk memicu unduhan
                res.set({
                    'Content-Type': 'application/pdf',
                    'Content-Length': pdf.length,
                    'Content-Disposition': `attachment; filename="surat-${safeFileName}.pdf"`
                });
                res.send(pdf);
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('Error generating signature or QR code');
    }
});

module.exports = router;
