from Crypto.Signature import pkcs1_15
from Crypto.Hash import SHA256
from Crypto.PublicKey import RSA
import base64
import binascii
import qrcode

def load_private_key():
    with open('keys/private_key.pem', 'r') as f:
        return RSA.import_key(f.read())

def load_public_key():
    with open('keys/public_key.pem', 'r') as f:
        return RSA.import_key(f.read())

def create_signature(data_string):
    key = load_private_key()
    h = SHA256.new(data_string.encode())
    signature = pkcs1_15.new(key).sign(h)
    return base64.b64encode(signature).decode()

def verify_signature(data_string, signature_b64):
    key = load_public_key()
    h = SHA256.new(data_string.encode())
    try:
        # Menambahkan validate=True untuk memastikan tidak ada karakter ilegal
        # dalam string base64. Ini akan melempar binascii.Error jika tidak valid.
        signature = base64.b64decode(signature_b64, validate=True)
        pkcs1_15.new(key).verify(h, signature)
        return True
    except (ValueError, TypeError, binascii.Error):
        return False

def generate_qr_code(signature_b64, save_path):
    img = qrcode.make(signature_b64)
    img.save(save_path)
