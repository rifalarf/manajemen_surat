from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, TextAreaField, DateField, SubmitField
from wtforms.validators import DataRequired

class LoginForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired()])
    password = PasswordField('Password', validators=[DataRequired()])
    submit = SubmitField('Login')

class SuratForm(FlaskForm):
    nomor_surat = StringField('Nomor Surat', validators=[DataRequired()])
    nama_karyawan = StringField('Nama Karyawan', validators=[DataRequired()])
    nama_perusahaan = StringField('Nama Perusahaan', validators=[DataRequired()])
    alasan_peringatan = TextAreaField('Alasan Peringatan', validators=[DataRequired()])
    tanggal_surat = DateField('Tanggal Surat', validators=[DataRequired()])
    nama_penandatangan = StringField('Nama Penandatangan', validators=[DataRequired()])
    submit = SubmitField('Simpan')

class SearchForm(FlaskForm):
    search = StringField('Cari Nama/Nomor/Tanggal')
    submit = SubmitField('Cari')
