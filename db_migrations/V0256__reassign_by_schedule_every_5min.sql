UPDATE automation_jobs
SET schedule_preset = 'every_5min',
    next_run_at = NOW() + interval '5 minutes'
WHERE job_key = 'reassign_by_schedule';