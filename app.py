from flask import Flask, render_template, redirect, url_for, flash, request, send_from_directory
from flask_login import LoginManager, login_user, login_required, logout_user, current_user
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import os

from models import db, User, SuratPeringatan
from forms import LoginForm, SuratForm, SearchForm
from utils.crypto import create_signature, verify_signature, generate_qr_code

app = Flask(__name__)
# Konfigurasi untuk produksi dari environment variables
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'kunci-rahasia-lokal-yang-aman')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///surat.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = 'static/qr'

db.init_app(app)

login_manager = LoginManager(app)
login_manager.login_view = 'login'

# --- USER AUTH ---
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@app.route('/login', methods=['GET', 'POST'])
def login():
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(username=form.username.data).first()
        if user and check_password_hash(user.password_hash, form.password.data):
            login_user(user)
            return redirect(url_for('dashboard'))
        else:
            flash('Username/password salah', 'danger')
    return render_template('login.html', form=form)

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

# --- DASHBOARD ---
@app.route('/')
@login_required
def dashboard():
    return render_template('dashboard.html')

# --- BUAT SURAT ---
@app.route('/surat/baru', methods=['GET', 'POST'])
@login_required
def surat_baru():
    if current_user.role != 'admin':
        flash('Hanya admin yang bisa membuat surat!', 'danger')
        return redirect(url_for('daftar_surat'))
    form = SuratForm()
    if form.validate_on_submit():
        data_string = f"{form.nomor_surat.data}|{form.nama_karyawan.data}|{form.nama_perusahaan.data}|{form.alasan_peringatan.data}|{form.tanggal_surat.data}"
        signature = create_signature(data_string)
        filename = f"{form.nomor_surat.data}_qr.png".replace('/', '_')
        qr_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        generate_qr_code(signature, qr_path)
        surat = SuratPeringatan(
            nomor_surat=form.nomor_surat.data,
            nama_karyawan=form.nama_karyawan.data,
            nama_perusahaan=form.nama_perusahaan.data,
            alasan_peringatan=form.alasan_peringatan.data,
            tanggal_surat=form.tanggal_surat.data,
            nama_penandatangan=form.nama_penandatangan.data,
            signature=signature,
            qr_code_path=qr_path,
            created_by=current_user.id
        )
        db.session.add(surat)
        db.session.commit()
        flash('Surat berhasil dibuat!', 'success')
        return redirect(url_for('preview_surat', surat_id=surat.id))
    return render_template('input_surat.html', form=form, title="Buat Surat Peringatan")

# --- EDIT SURAT ---
@app.route('/surat/edit/<int:surat_id>', methods=['GET', 'POST'])
@login_required
def edit_surat(surat_id):
    if current_user.role != 'admin':
        flash('Hanya admin yang bisa mengubah surat!', 'danger')
        return redirect(url_for('daftar_surat'))
    surat = SuratPeringatan.query.get_or_404(surat_id)
    form = SuratForm(obj=surat)
    if form.validate_on_submit():
        # Hapus file QR lama jika nomor surat berubah
        old_qr_path = surat.qr_code_path
        if old_qr_path and os.path.exists(old_qr_path):
            os.remove(old_qr_path)

        # Update data
        form.populate_obj(surat)
        
        # Buat ulang signature dan QR code
        data_string = f"{surat.nomor_surat}|{surat.nama_karyawan}|{surat.nama_perusahaan}|{surat.alasan_peringatan}|{surat.tanggal_surat}"
        signature = create_signature(data_string)
        filename = f"{surat.nomor_surat}_qr.png".replace('/', '_')
        qr_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        generate_qr_code(signature, qr_path)
        surat.signature = signature
        surat.qr_code_path = qr_path
        
        db.session.commit()
        flash('Surat berhasil diperbarui!', 'success')
        return redirect(url_for('preview_surat', surat_id=surat.id))
    
    return render_template('input_surat.html', form=form, title="Edit Surat Peringatan")

# --- HAPUS SURAT ---
@app.route('/surat/delete/<int:surat_id>', methods=['POST'])
@login_required
def delete_surat(surat_id):
    if current_user.role != 'admin':
        flash('Hanya admin yang bisa menghapus surat!', 'danger')
        return redirect(url_for('daftar_surat'))
    surat = SuratPeringatan.query.get_or_404(surat_id)
    
    if surat.qr_code_path and os.path.exists(surat.qr_code_path):
        os.remove(surat.qr_code_path)

    db.session.delete(surat)
    db.session.commit()
    flash('Surat berhasil dihapus.', 'success')
    return redirect(url_for('daftar_surat'))

# --- DAFTAR & CARI SURAT ---
@app.route('/surat', methods=['GET', 'POST'])
@login_required
def daftar_surat():
    form = SearchForm()
    query = SuratPeringatan.query
    if form.validate_on_submit() or request.method == 'POST':
        s = form.search.data
        query = query.filter(
            (SuratPeringatan.nomor_surat.like(f"%{s}%")) | 
            (SuratPeringatan.nama_karyawan.like(f"%{s}%")) |
            (SuratPeringatan.tanggal_surat.like(f"%{s}%"))
        )
    daftar = query.order_by(SuratPeringatan.tanggal_surat.desc()).all()
    return render_template('daftar_surat.html', daftar=daftar, form=form)

# --- DETAIL & PREVIEW SURAT ---
@app.route('/surat/<int:surat_id>')
@login_required
def detail_surat(surat_id):
    surat = SuratPeringatan.query.get_or_404(surat_id)
    return render_template('detail_surat.html', surat=surat)

@app.route('/surat/preview/<int:surat_id>')
@login_required
def preview_surat(surat_id):
    surat = SuratPeringatan.query.get_or_404(surat_id)
    return render_template('preview_surat.html', surat=surat)

# --- VERIFIKASI SURAT ---
@app.route('/verifikasi', methods=['GET', 'POST'])
def verifikasi():
    status = None
    if request.method == 'POST':
        # Ambil data dari form
        nomor_surat = request.form.get('nomor_surat')
        nama_karyawan = request.form.get('nama_karyawan')
        nama_perusahaan = request.form.get('nama_perusahaan')
        alasan_peringatan = request.form.get('alasan_peringatan')
        tanggal_surat = request.form.get('tanggal_surat')
        signature = request.form.get('signature')
        
        # Gabungkan data untuk verifikasi
        data_string = f"{nomor_surat}|{nama_karyawan}|{nama_perusahaan}|{alasan_peringatan}|{tanggal_surat}"
        
        # Lakukan verifikasi
        status = verify_signature(data_string, signature)
        
    return render_template('verifikasi.html', status=status)


@app.route('/static/qr/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.cli.command("init-db")
def init_db_command():
    """Membuat tabel database dan user default."""
    db.create_all()
    # Seed admin jika belum ada
    if not User.query.filter_by(username='admin').first():
        user = User(username='admin', 
            password_hash=generate_password_hash('admin123'),
            role='admin')
        db.session.add(user)
        db.session.commit()
        print("Database diinisialisasi dan user admin dibuat.")
    else:
        print("User admin sudah ada.")

if __name__ == '__main__':
    # Blok ini hanya untuk development lokal, tidak akan dijalankan oleh Gunicorn
    with app.app_context():
        db.create_all()
        if not User.query.filter_by(username='admin').first():
            user = User(username='admin', password_hash=generate_password_hash('admin123'), role='admin')
            db.session.add(user)
            db.session.commit()
    app.run(debug=True, port=8080)
