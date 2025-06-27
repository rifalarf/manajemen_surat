from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin

db = SQLAlchemy()

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True)
    password_hash = db.Column(db.String(128))
    role = db.Column(db.String(10)) # 'admin' atau 'user'

class SuratPeringatan(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nomor_surat = db.Column(db.String(100))
    nama_karyawan = db.Column(db.String(100))
    nama_perusahaan = db.Column(db.String(100))
    alasan_peringatan = db.Column(db.Text)
    tanggal_surat = db.Column(db.Date)
    nama_penandatangan = db.Column(db.String(100))
    signature = db.Column(db.Text)      # base64
    qr_code_path = db.Column(db.String(200)) # path file QR code
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'))
