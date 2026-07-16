-- Estado de cancelación + motivo (observación del admin)
alter type order_status add value if not exists 'cancelled';
alter table orders add column if not exists cancellation_reason text;
