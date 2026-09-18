create or replace function public.hall_booked_dates(_hall_id uuid)
returns table (event_date date)
language sql stable security definer set search_path = public as $$
  select b.event_date from public.bookings b
  where b.hall_id = _hall_id and b.status in ('pending','confirmed')
  group by b.event_date;
$$;
revoke execute on function public.hall_booked_dates(uuid) from public;
grant execute on function public.hall_booked_dates(uuid) to anon, authenticated;