from app import app, db, User
from werkzeug.security import generate_password_hash

# --- KONFIGURASI PENGGUNA BARU ---
# Ubah username, password, dan role sesuai kebutuhan
NEW_USERNAME = 'hilmi'
NEW_PASSWORD = 'hilmikripto'
NEW_ROLE = 'user' # bisa 'user' atau 'admin'
# ------------------------------------

with app.app_context():
    # Cek apakah username sudah ada
    existing_user = User.query.filter_by(username=NEW_USERNAME).first()
    if existing_user:
        print(f"Error: Pengguna dengan username '{NEW_USERNAME}' sudah ada.")
    else:
        # Buat hash password
        hashed_password = generate_password_hash(NEW_PASSWORD)
        
        # Buat objek pengguna baru
        new_user = User(username=NEW_USERNAME, password_hash=hashed_password, role=NEW_ROLE)
        
        # Tambahkan ke database
        db.session.add(new_user)
        db.session.commit()
        
        print(f"Pengguna '{NEW_USERNAME}' dengan role '{NEW_ROLE}' berhasil dibuat!")