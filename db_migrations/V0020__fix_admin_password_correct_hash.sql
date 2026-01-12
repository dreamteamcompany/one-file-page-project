-- Установка правильного хэша для пароля "admin"
UPDATE users 
SET password_hash = '$2b$12$Kq8gDwrjo.ZtFPGt3cOoBOijGqsYi06Y0Yb0sxkHhAXjBY7rmtLJO'
WHERE username = 'admin';