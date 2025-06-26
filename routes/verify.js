const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');

const publicKey = fs.readFileSync('./keys/public_key.pem', 'utf8');

router.get('/', (req, res) => {
    res.render('verify/form');
});

router.post('/verify', (req, res) => {
    try {
        const { nomorSurat, namaKaryawan, namaPerusahaan, alasanPeringatan, tanggalSurat, namaPenandatangan, signature } = req.body;

        const data = JSON.stringify({
            nomorSurat,
            namaKaryawan,
            namaPerusahaan,
            alasanPeringatan,
            tanggalSurat,
            namaPenandatangan
        });

        const hash = crypto.createHash('sha256').update(data).digest('hex');

        const verify = crypto.verify(
            'SHA256',
            Buffer.from(hash, 'hex'),
            {
                key: publicKey,
                padding: crypto.constants.RSA_PKCS1_PADDING,
            },
            Buffer.from(signature, 'base64')
        );

        res.render('verify/result', {
            isValid: verify
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('Error verifying signature');
    }
});

module.exports = router;
