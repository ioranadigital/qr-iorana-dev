-- Dominios adicionales para URL amigable (añadidos desde la UI).
-- Ejecutar una vez en el SQL Editor de Supabase.
create table if not exists slug_domains (
  domain     text primary key,
  created_at timestamptz not null default now()
);
