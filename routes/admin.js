const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const puppeteer = require('puppeteer-core');
const chromium = require('chrome-aws-lambda'); // Ganti ke chrome-aws-lambda

// Gunakan Environment Variable untuk kunci privat
const privateKey = process.env.PRIVATE_KEY.replace(/\\n/g, '\n');
const templatePath = path.join(__dirname, '../views/template.html');
const templateHtml = fs.readFileSync(templatePath, 'utf8');

router.get('/', (req, res) => {
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
    let browser = null;
    try {
        const { nomorSurat, namaKaryawan, namaPerusahaan, alasanPeringatan, tanggalSurat, namaPenandatangan } = req.body;
        const data = JSON.stringify({ nomorSurat, namaKaryawan, namaPerusahaan, alasanPeringatan, tanggalSurat, namaPenandatangan });
        const hash = crypto.createHash('sha256').update(data).digest('hex');
        const sign = crypto.sign('SHA256', Buffer.from(hash, 'hex'), {
            key: privateKey,
            padding: crypto.constants.RSA_PKCS1_PADDING,
        });
        const signature = sign.toString('base64');
        const qrCodeDataUrl = await qrcode.toDataURL(signature);

        db.run(`INSERT INTO surat_peringatan (nomor_surat, nama_karyawan, nama_perusahaan, alasan_peringatan, tanggal_surat, nama_penandatangan, signature) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [nomorSurat, namaKaryawan, namaPerusahaan, alasanPeringatan, tanggalSurat, namaPenandatangan, signature],
            (err) => {
                if (err) {
                    console.error(err.message);
                    return res.status(500).send('Gagal menyimpan data ke database.');
                }
            }
        );

        let content = templateHtml
            .replace('{{nomorSurat}}', nomorSurat)
            .replace('{{namaKaryawan}}', namaKaryawan)
            .replace('{{namaPerusahaan}}', namaPerusahaan)
            .replace('{{alasanPeringatan}}', alasanPeringatan)
            .replace('{{tanggalSurat}}', tanggalSurat)
            .replace('{{namaPenandatangan}}', namaPenandatangan)
            .replace('{{qrCode}}', qrCodeDataUrl);

        // Gunakan chrome-aws-lambda
        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath, // Perhatikan: tidak ada ()
            headless: chromium.headless, // Perhatikan: gunakan nilai dari paket
            ignoreHTTPSErrors: true,
        });

        const page = await browser.newPage();
        await page.setContent(content, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=surat-peringatan-${nomorSurat}.pdf`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error("Error saat generate PDF:", error);
        res.status(500).send('Gagal membuat surat.');
    } finally {
        if (browser !== null) {
            await browser.close();
        }
    }
});

module.exports = router;
