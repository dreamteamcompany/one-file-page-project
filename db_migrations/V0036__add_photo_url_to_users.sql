-- Add photo_url column to users table
ALTER TABLE t_p61788166_html_to_frontend.users 
ADD COLUMN IF NOT EXISTS photo_url VARCHAR(500);

COMMENT ON COLUMN t_p61788166_html_to_frontend.users.photo_url IS 'URL фото профиля пользователя';
