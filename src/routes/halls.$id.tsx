import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/venue/Shell";
import { useSession } from "@/hooks/useAuth";
import {
  EVENT_TYPES,
  calculateCost,
  formatDate,
  formatINR,
  hallImage,
  type Hall,
  type HallService,
} from "@/lib/venue";

export const Route = createFileRoute("/halls/$id")({
  head: () => ({
    meta: [
      { title: "Hall details — VenueEasy" },
      {
        name: "description",
        content:
          "See photos, capacity, amenities, day rate and live availability, pick your services and request a booking.",
      },
      { property: "og:title", content: "Hall details — VenueEasy" },
      {
        property: "og:description",
        content: "Check availability and book this hall on VenueEasy.",
      },
    ],
  }),
  component: HallDetail,
});

function HallDetail() {
  const { id } = Route.useParams();
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [date, setDate] = useState("");
  const [start, setStart] = useState("18:00");
  const [end, setEnd] = useState("23:00");
  const [guests, setGuests] = useState(100);
  const [eventType, setEventType] = useState(EVENT_TYPES[0] as string);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const hallQuery = useQuery({
    queryKey: ["hall", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("halls").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as unknown as Hall | null;
    },
  });

  const servicesQuery = useQuery({
    queryKey: ["hall-services", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hall_services")
        .select("*")
        .eq("hall_id", id)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as HallService[];
    },
  });

  const unavailableQuery = useQuery({
    queryKey: ["hall-unavailable", id],
    queryFn: async () => {
      const [blackouts, booked] = await Promise.all([
        supabase.from("hall_blackouts").select("blocked_date").eq("hall_id", id),
        supabase.rpc("hall_booked_dates", { _hall_id: id }),
      ]);
      const dates = new Set<string>();
      for (const row of blackouts.data ?? []) dates.add(row.blocked_date as string);
      for (const row of (booked.data ?? []) as { event_date: string }[]) dates.add(row.event_date);
      return dates;
    },
  });

  const reviewsQuery = useQuery({
    queryKey: ["hall-reviews", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("id, rating, comment, created_at, user_id")
        .eq("hall_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const ids = [...new Set(rows.map((r) => r.user_id as string))];
      const names: Record<string, string> = {};
      if (ids.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", ids);
        for (const p of profiles ?? []) names[p.id as string] = (p.full_name as string) || "Guest";
      }
      return rows.map((r) => ({ ...r, name: names[r.user_id as string] ?? "Guest" }));
    },
  });

  const hall = hallQuery.data;
  const services = servicesQuery.data ?? [];
  const cost = useMemo(
    () => calculateCost(hall?.price_per_day ?? 0, guests, services, selected),
    [hall?.price_per_day, guests, services, selected],
  );

  const unavailable = unavailableQuery.data ?? new Set<string>();
  const dateTaken = !!date && unavailable.has(date);
  const overCapacity = !!hall && guests > hall.capacity;
  const avgRating = reviewsQuery.data?.length
    ? reviewsQuery.data.reduce((sum, r) => sum + (r.rating as number), 0) / reviewsQuery.data.length
    : null;

  async function requestBooking() {
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    if (!date) {
      toast.error("Pick a date first.");
      return;
    }
    if (dateTaken) {
      toast.error("That date is not available.");
      return;
    }
    if (overCapacity) {
      toast.error(`This hall seats up to ${hall?.capacity} guests.`);
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("bookings").insert({
      hall_id: id,
      customer_id: user.id,
      event_date: date,
      start_time: start,
      end_time: end,
      guests,
      event_type: eventType,
      selected_services: services
        .filter((s) => selected.includes(s.id))
        .map((s) => ({ id: s.id, name: s.name, price: Number(s.price), unit: s.unit })),
      base_amount: cost.base,
      services_amount: cost.services,
      service_fee: cost.fee,
      total_amount: cost.total,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["hall-unavailable", id] });
    toast.success("Booking requested — the owner will confirm shortly.");
    navigate({ to: "/bookings" });
  }

  if (hallQuery.isLoading) {
    return (
      <PageShell>
        <div className="relative z-20 mx-auto max-w-7xl px-6 py-20 text-sm text-ink/50">
          Loading hall…
        </div>
      </PageShell>
    );
  }

  if (!hall) {
    return (
      <PageShell>
        <div className="relative z-20 mx-auto max-w-7xl px-6 py-20">
          <h1 className="font-display text-3xl font-semibold">Hall not found</h1>
          <Link to="/halls" className="mt-3 inline-block text-sm font-semibold text-brand">
            Back to search
          </Link>
        </div>
      </PageShell>
    );
  }

  const boxed =
    "mt-1 w-full rounded-lg bg-cream/70 px-3 py-2.5 text-sm font-medium ring-1 ring-black/5 outline-none";
  const label = "text-[11px] font-semibold uppercase tracking-wider text-ink/45";

  return (
    <PageShell>
      <section className="relative z-20 mx-auto max-w-7xl px-6 pb-16 pt-10">
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8">
            <img
              src={hallImage(hall)}
              alt={hall.name}
              width={1024}
              height={768}
              className="aspect-[16/9] w-full rounded-[18px] object-cover ring-1 ring-black/5"
            />
            <div className="mt-6">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ember">
                  {hall.hall_type}
                </span>
                <span className="text-xs text-ink/40">·</span>
                <span className="text-xs font-medium text-ink/60">
                  {hall.area ? `${hall.area}, ` : ""}
                  {hall.city}
                </span>
              </div>
              <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">
                {hall.name}
              </h1>
              <p className="mt-2 text-sm text-ink/60">
                Seats {hall.capacity}
                {hall.size_sqft ? ` · ${hall.size_sqft} sq ft` : ""} ·{" "}
                {formatINR(hall.price_per_day)} per day
                {avgRating ? (
                  <>
                    {" "}
                    · {avgRating.toFixed(1)} <span className="text-ember">★</span> (
                    {reviewsQuery.data?.length})
                  </>
                ) : null}
              </p>
              {hall.description ? (
                <p className="mt-4 max-w-[62ch] text-pretty text-ink/70">{hall.description}</p>
              ) : null}
              {hall.amenities?.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {hall.amenities.map((a) => (
                    <span
                      key={a}
                      className="rounded-full bg-cream px-2.5 py-1 text-sm text-ink/70 ring-1 ring-black/5"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-8 rounded-[16px] bg-white/55 p-5 ring-1 ring-black/5 backdrop-blur-xl">
              <h2 className="font-display text-xl font-semibold">Reviews</h2>
              {reviewsQuery.data?.length ? (
                <div className="mt-4 divide-y divide-ink/10">
                  {reviewsQuery.data.map((r) => (
                    <div key={r.id as string} className="py-3">
                      <p className="text-sm font-medium">
                        {r.name} · <span className="text-ember">{"★".repeat(r.rating as number)}</span>
                      </p>
                      {r.comment ? <p className="mt-1 text-sm text-ink/60">{r.comment}</p> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-ink/55">No reviews yet for this hall.</p>
              )}
            </div>
          </div>

          <aside className="col-span-12 lg:col-span-4">
            <div className="rounded-[16px] bg-white/60 p-5 ring-1 ring-black/5 backdrop-blur-xl lg:sticky lg:top-6">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/45">
                Check availability
              </p>
              <h3 className="mt-1 font-display text-xl font-semibold">{hall.name}</h3>

              <div className="mt-4 space-y-3">
                <div>
                  <label className={label}>Date</label>
                  <input
                    type="date"
                    className={boxed}
                    value={date}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setDate(e.target.value)}
                  />
                  {date ? (
                    <p
                      className={`mt-1 text-xs font-medium ${dateTaken ? "text-destructive" : "text-brand"}`}
                    >
                      {dateTaken
                        ? `${formatDate(date)} is already taken`
                        : `${formatDate(date)} is available`}
                    </p>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={label}>From</label>
                    <input
                      type="time"
                      className={boxed}
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={label}>To</label>
                    <input
                      type="time"
                      className={boxed}
                      value={end}
                      onChange={(e) => setEnd(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={label}>Guests</label>
                    <input
                      type="number"
                      min={1}
                      className={boxed}
                      value={guests}
                      onChange={(e) => setGuests(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className={label}>Occasion</label>
                    <select
                      className={boxed}
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value)}
                    >
                      {EVENT_TYPES.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {overCapacity ? (
                  <p className="text-xs font-medium text-destructive">
                    This hall seats up to {hall.capacity} guests.
                  </p>
                ) : null}
              </div>

              {services.length ? (
                <div className="mt-5 space-y-2.5 text-sm">
                  <p className={label}>Add services</p>
                  {services.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center justify-between rounded-lg bg-cream/70 px-3 py-2.5 ring-1 ring-black/5"
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="size-4 accent-brand"
                          checked={selected.includes(s.id)}
                          onChange={() =>
                            setSelected(
                              selected.includes(s.id)
                                ? selected.filter((v) => v !== s.id)
                                : [...selected, s.id],
                            )
                          }
                        />
                        <span>
                          {s.name}
                          {s.unit === "per_guest" ? " (per guest)" : ""}
                        </span>
                      </span>
                      <span className="font-medium">+{formatINR(Number(s.price))}</span>
                    </label>
                  ))}
                </div>
              ) : null}

              <div className="mt-5 space-y-1.5 text-sm">
                {cost.lines.map((line) => (
                  <div key={line.label} className="flex justify-between text-ink/60">
                    <span>{line.label}</span>
                    <span>{formatINR(line.amount)}</span>
                  </div>
                ))}
                <div className="mt-2 flex justify-between border-t border-ink/10 pt-3 font-display text-lg font-semibold">
                  <span>Total</span>
                  <span>{formatINR(cost.total)}</span>
                </div>
              </div>

              <button
                onClick={requestBooking}
                disabled={busy || dateTaken || overCapacity}
                className="mt-4 w-full rounded-lg bg-ember py-2.5 text-sm font-semibold text-white ring-1 ring-black/10 transition-transform hover:-translate-y-0.5 disabled:opacity-60"
              >
                {user ? (busy ? "Sending…" : "Request booking") : "Sign in to book"}
              </button>
              <p className="mt-2 text-center text-xs text-ink/45">
                No payment until the owner confirms
              </p>
            </div>
          </aside>
        </div>
      </section>
    </PageShell>
  );
}
