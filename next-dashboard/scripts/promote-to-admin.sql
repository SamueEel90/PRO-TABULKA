-- Run in Supabase SQL editor (or psql) to promote a user to ADMIN.
-- Usage: replace the email and execute.

UPDATE "User"
SET role = 'ADMIN',
    "updatedAt" = NOW()
WHERE email = 'testvkl5@gmail.sk'
RETURNING id, email, role;
