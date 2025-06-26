const crypto = require('crypto');
const fs = require('fs');

function generateKeys() {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });

    fs.writeFileSync('./keys/private_key.pem', privateKey);
    fs.writeFileSync('./keys/public_key.pem', publicKey);

    console.log('Kunci RSA berhasil dibuat di folder /keys.');
}

generateKeys();
