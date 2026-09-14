UPDATE db_backup_jobs
SET status = 'error',
    error = 'Задача не запустилась из-за ошибки в механизме фонового запуска (исправлено), запустите создание копии заново',
    finished_at = now()
WHERE status = 'pending';
