-- Historial de estados del pedido (seguimiento con fecha/hora para el cliente)
create table if not exists order_status_history (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid references orders(id) on delete cascade,
  status     order_status not null,
  note       text,
  created_at timestamptz default now()
);

create index if not exists idx_status_history_order on order_status_history(order_id);

alter table order_status_history enable row level security;

-- El cliente ve el historial de sus pedidos; el admin, de todos.
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

-- Backfill: un evento inicial para pedidos existentes (estado actual).
insert into order_status_history (order_id, status, created_at)
select id, status, created_at from orders o
where not exists (
  select 1 from order_status_history h where h.order_id = o.id
);
