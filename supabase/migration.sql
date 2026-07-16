-- ============================================================
-- Masamor Digital Platform — Esquema base + RLS (walking skeleton)
-- Ejecutar en Supabase: SQL Editor > New query > pegar > Run.
-- ============================================================

-- ---------- Enums ----------
create type user_role   as enum ('restaurant', 'entrepreneur', 'admin');
create type order_status as enum ('requested', 'confirmed', 'in_production', 'shipped', 'delivered', 'cancelled');
create type price_tier   as enum ('wholesale', 'retail');

-- ---------- Perfil extendido de usuario ----------
-- auth.users ya existe (lo gestiona Supabase Auth).
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          user_role  not null default 'entrepreneur',
  business_name text,
  price_tier    price_tier not null default 'retail',
  created_at    timestamptz default now()
);

-- Crea automáticamente el perfil al registrarse un usuario.
-- Lee role/business_name/price_tier desde raw_user_meta_data si vienen en el signUp.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, business_name, price_tier)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'entrepreneur'),
    new.raw_user_meta_data ->> 'business_name',
    coalesce((new.raw_user_meta_data ->> 'price_tier')::price_tier, 'retail')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Productos ----------
create table products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  image_url   text,
  is_active   boolean default true,
  created_at  timestamptz default now()
);

-- Precio por tier: clave para B2B con precios diferenciados.
create table product_prices (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  tier       price_tier not null,
  price      numeric(12,2) not null,
  unique(product_id, tier)
);

-- ---------- Pedidos ----------
create table orders (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid references profiles(id),
  status              order_status not null default 'requested',
  total               numeric(12,2),
  notes               text,
  cancellation_reason text,
  created_at          timestamptz default now()
);

create table order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid references orders(id) on delete cascade,
  product_id uuid references products(id),
  quantity   int not null,
  unit_price numeric(12,2) not null
);

-- Historial de estados (seguimiento con fecha/hora para el cliente)
create table order_status_history (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid references orders(id) on delete cascade,
  status     order_status not null,
  note       text,
  created_at timestamptz default now()
);
create index idx_status_history_order on order_status_history(order_id);

-- ============================================================
-- Row Level Security
-- El backend NestJS usa la secret key (sb_secret_) y SALTA el RLS;
-- estas políticas protegen si el front consulta Supabase directo.
-- ============================================================
alter table profiles             enable row level security;
alter table products             enable row level security;
alter table product_prices       enable row level security;
alter table orders               enable row level security;
alter table order_items          enable row level security;
alter table order_status_history enable row level security;

-- Un usuario solo ve su propio perfil.
create policy "own_profile" on profiles
  for select using (auth.uid() = id);

-- Catálogo y precios: visibles para cualquier usuario autenticado.
create policy "read_products" on products
  for select using (auth.role() = 'authenticated');
create policy "read_prices" on product_prices
  for select using (auth.role() = 'authenticated');

-- Un cliente solo ve sus propios pedidos; admin ve todos.
create policy "own_orders" on orders
  for select using (
    auth.uid() = customer_id
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Un cliente crea sus propios pedidos.
create policy "create_own_orders" on orders
  for insert with check (auth.uid() = customer_id);

-- Items visibles si el pedido padre es visible para el usuario.
create policy "read_own_order_items" on order_items
  for select using (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and (
          o.customer_id = auth.uid()
          or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
        )
    )
  );

-- Historial visible si el pedido padre es visible para el usuario.
create policy "read_own_order_history" on order_status_history
  for select using (
    exists (
      select 1 from orders o
      where o.id = order_status_history.order_id
        and (
          o.customer_id = auth.uid()
          or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
        )
    )
  );

-- ============================================================
-- Seed: productos de prueba con precios por tier (CLP)
-- ============================================================
with seed(name, description, image_url, wholesale, retail) as (
  values
    ('Display Queques Surtidos',    'Display con 6 queques congelados listos para hornear.',     null, 24000, 32000),
    ('Display Galletas NY',         'Display con 12 galletas estilo New York.',                  null, 21000, 28000),
    ('Queque de Zanahoria',         'Queque congelado prehorneado, sabor zanahoria.',            null,  3800,  5200),
    ('Queque de Chocolate',         'Queque congelado prehorneado, sabor chocolate intenso.',    null,  3900,  5300),
    ('Galleta NY Chocolate Chip',   'Galleta estilo New York con chips de chocolate.',           null,  1600,  2400),
    ('Galleta NY Red Velvet',       'Galleta estilo New York sabor red velvet.',                 null,  1700,  2500)
)
insert into products (name, description, image_url)
select name, description, image_url from seed;

insert into product_prices (product_id, tier, price)
select p.id, 'wholesale'::price_tier, s.wholesale
from products p
join (values
  ('Display Queques Surtidos', 24000),
  ('Display Galletas NY', 21000),
  ('Queque de Zanahoria', 3800),
  ('Queque de Chocolate', 3900),
  ('Galleta NY Chocolate Chip', 1600),
  ('Galleta NY Red Velvet', 1700)
) as s(name, wholesale) on s.name = p.name;

insert into product_prices (product_id, tier, price)
select p.id, 'retail'::price_tier, s.retail
from products p
join (values
  ('Display Queques Surtidos', 32000),
  ('Display Galletas NY', 28000),
  ('Queque de Zanahoria', 5200),
  ('Queque de Chocolate', 5300),
  ('Galleta NY Chocolate Chip', 2400),
  ('Galleta NY Red Velvet', 2500)
) as s(name, retail) on s.name = p.name;
