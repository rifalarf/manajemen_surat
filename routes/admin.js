const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const puppeteer = require('puppeteer');

const privateKey = fs.readFileSync('./keys/private_key.pem', 'utf8');
const templatePath = path.join(__dirname, '../views/template.html');
const templateHtml = fs.readFileSync(templatePath, 'utf8');

router.get('/', (req, res) => {
    res.render('admin/form');
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
                
                const browser = await puppeteer.launch();
                const page = await browser.newPage();
                await page.setContent(suratHtml, { waitUntil: 'networkidle0' });
                const pdf = await page.pdf({ format: 'A4', printBackground: true });
                await browser.close();

                res.set({ 'Content-Type': 'application/pdf', 'Content-Length': pdf.length });
                res.send(pdf);
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('Error generating signature or QR code');
    }
});

module.exports = router;
