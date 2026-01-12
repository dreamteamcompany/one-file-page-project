import bcrypt

password = "admin"
password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
print(f"Password hash for 'admin': {password_hash}")

# Проверка
is_valid = bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))
print(f"Verification: {is_valid}")
