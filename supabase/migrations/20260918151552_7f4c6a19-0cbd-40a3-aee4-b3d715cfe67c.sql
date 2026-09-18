-- enums
create type public.app_role as enum ('customer','owner','admin');
create type public.booking_status as enum ('pending','confirmed','rejected','cancelled');
create type public.payment_status as enum ('unpaid','paid','refunded');
create type public.service_unit as enum ('flat','per_guest');

-- updated_at helper
create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant select on public.profiles to anon;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable by everyone" on public.profiles for select using (true);
create policy "users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "users insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create trigger profiles_updated_at before update on public.profiles for each row execute function public.update_updated_at_column();

-- roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select, insert on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create policy "users read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);
create policy "users claim own role" on public.user_roles for insert to authenticated with check (auth.uid() = user_id and role <> 'admin');

-- signup trigger
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role)
  values (new.id, coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'customer'))
  on conflict do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- halls
create table public.halls (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  city text not null,
  area text,
  hall_type text not null default 'Banquet',
  capacity integer not null default 50,
  size_sqft integer,
  price_per_day numeric(12,2) not null default 0,
  description text,
  image_url text,
  amenities text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.halls to authenticated;
grant select on public.halls to anon;
grant all on public.halls to service_role;
alter table public.halls enable row level security;
create policy "active halls are public" on public.halls for select using (is_active = true);
create policy "owners read own halls" on public.halls for select to authenticated using (auth.uid() = owner_id);
create policy "owners insert own halls" on public.halls for insert to authenticated with check (auth.uid() = owner_id);
create policy "owners update own halls" on public.halls for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "owners delete own halls" on public.halls for delete to authenticated using (auth.uid() = owner_id);
create trigger halls_updated_at before update on public.halls for each row execute function public.update_updated_at_column();
create index halls_city_idx on public.halls (city);

-- services
create table public.hall_services (
  id uuid primary key default gen_random_uuid(),
  hall_id uuid not null references public.halls(id) on delete cascade,
  name text not null,
  price numeric(12,2) not null default 0,
  unit public.service_unit not null default 'flat',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.hall_services to authenticated;
grant select on public.hall_services to anon;
grant all on public.hall_services to service_role;
alter table public.hall_services enable row level security;
create policy "services are public" on public.hall_services for select using (true);
create policy "owners manage own services" on public.hall_services for all to authenticated
  using (exists (select 1 from public.halls h where h.id = hall_id and h.owner_id = auth.uid()))
  with check (exists (select 1 from public.halls h where h.id = hall_id and h.owner_id = auth.uid()));

-- blocked dates
create table public.hall_blackouts (
  id uuid primary key default gen_random_uuid(),
  hall_id uuid not null references public.halls(id) on delete cascade,
  blocked_date date not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (hall_id, blocked_date)
);
grant select, insert, update, delete on public.hall_blackouts to authenticated;
grant select on public.hall_blackouts to anon;
grant all on public.hall_blackouts to service_role;
alter table public.hall_blackouts enable row level security;
create policy "blackouts are public" on public.hall_blackouts for select using (true);
create policy "owners manage own blackouts" on public.hall_blackouts for all to authenticated
  using (exists (select 1 from public.halls h where h.id = hall_id and h.owner_id = auth.uid()))
  with check (exists (select 1 from public.halls h where h.id = hall_id and h.owner_id = auth.uid()));

-- bookings
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  hall_id uuid not null references public.halls(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  event_date date not null,
  start_time time not null default '18:00',
  end_time time not null default '23:00',
  guests integer not null default 50,
  event_type text not null default 'Event',
  selected_services jsonb not null default '[]'::jsonb,
  base_amount numeric(12,2) not null default 0,
  services_amount numeric(12,2) not null default 0,
  service_fee numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  status public.booking_status not null default 'pending',
  payment_status public.payment_status not null default 'unpaid',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.bookings to authenticated;
grant all on public.bookings to service_role;
alter table public.bookings enable row level security;
create policy "customers read own bookings" on public.bookings for select to authenticated using (auth.uid() = customer_id);
create policy "owners read hall bookings" on public.bookings for select to authenticated
  using (exists (select 1 from public.halls h where h.id = hall_id and h.owner_id = auth.uid()));
create policy "customers create own bookings" on public.bookings for insert to authenticated with check (auth.uid() = customer_id);
create policy "customers update own bookings" on public.bookings for update to authenticated using (auth.uid() = customer_id) with check (auth.uid() = customer_id);
create policy "owners update hall bookings" on public.bookings for update to authenticated
  using (exists (select 1 from public.halls h where h.id = hall_id and h.owner_id = auth.uid()))
  with check (exists (select 1 from public.halls h where h.id = hall_id and h.owner_id = auth.uid()));
create trigger bookings_updated_at before update on public.bookings for each row execute function public.update_updated_at_column();
create index bookings_hall_date_idx on public.bookings (hall_id, event_date);

-- reviews
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  hall_id uuid not null references public.halls(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (booking_id, user_id)
);
grant select, insert, update, delete on public.reviews to authenticated;
grant select on public.reviews to anon;
grant all on public.reviews to service_role;
alter table public.reviews enable row level security;
create policy "reviews are public" on public.reviews for select using (true);
create policy "users write own reviews" on public.reviews for insert to authenticated with check (auth.uid() = user_id);
create policy "users update own reviews" on public.reviews for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users delete own reviews" on public.reviews for delete to authenticated using (auth.uid() = user_id);

-- demo halls
insert into public.halls (id, owner_id, name, city, area, hall_type, capacity, size_sqft, price_per_day, description, amenities)
values
 ('11111111-1111-4111-8111-111111111111', null, 'The Amber Ballroom', 'Mumbai', 'Bandra West', 'Ballroom', 300, 9000, 38000,
  'A sunlit marble ballroom with tall arched windows and chandeliers, ideal for weddings and receptions.',
  array['AV system','Catering','Valet parking','Air conditioning']),
 ('22222222-2222-4222-8222-222222222222', null, 'Lotus Courtyard', 'Bengaluru', 'Whitefield', 'Garden pavilion', 180, 4500, 24500,
  'An open-air garden pavilion with string lights and long wooden tables — perfect for evening celebrations.',
  array['Outdoor','Sound system','Catering','Parking']),
 ('33333333-3333-4333-8333-333333333333', null, 'Foundry Loft No.7', 'Pune', 'Koregaon Park', 'Loft studio', 120, 3200, 18500,
  'An industrial loft studio with exposed brick and warm pendant lighting for launches and intimate parties.',
  array['AV system','Bar','Parking','Wi-Fi']);

insert into public.hall_services (hall_id, name, price, unit) values
 ('11111111-1111-4111-8111-111111111111','Catering', 950, 'per_guest'),
 ('11111111-1111-4111-8111-111111111111','AV & lighting', 15000, 'flat'),
 ('11111111-1111-4111-8111-111111111111','Florist package', 22000, 'flat'),
 ('22222222-2222-4222-8222-222222222222','Catering', 780, 'per_guest'),
 ('22222222-2222-4222-8222-222222222222','Stage & decor', 18000, 'flat'),
 ('33333333-3333-4333-8333-333333333333','Catering', 620, 'per_guest'),
 ('33333333-3333-4333-8333-333333333333','Live sound crew', 12000, 'flat');