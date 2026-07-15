-- Split from 0023_team_roles_permissions.sql for the same reason 0015/0016
-- were split: a value added via `alter type ... add value` cannot be used
-- (compared, cast from a string literal, etc.) within the same transaction
-- it was added in. `rename value` has no such restriction, but since both
-- changes belong together conceptually, they're kept in one migration file
-- with 'viewer' usage deferred to 0023.
--
-- 'member' -> 'sales_rep': same slot, same existing profile data, just the
-- name the product now uses ("Sales Rep" per the roles spec).
alter type public.org_role rename value 'member' to 'sales_rep';
alter type public.org_role add value 'viewer';
