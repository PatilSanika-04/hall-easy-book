import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/venue/Shell";
import { useSession } from "@/hooks/useAuth";
import {
  AMENITIES,
  CITIES,
  HALL_TYPES,
  formatDate,
  formatINR,
  formatTime,
  hallImage,
  statusLabel,
  type Hall,
} from "@/lib/venue";

export const Route = createFileRoute("/_authenticated/owner")({
  head: () => ({
    meta: [
      { title: "Owner dashboard — VenueEasy" },
      {
        name: "description",
        content:
          "List your halls, set availability, accept or decline booking requests and read your reviews.",
      },
      { property: "og:title", content: "Owner dashboard — VenueEasy" },
      { property: "og:description", content: "Manage your halls and bookings on VenueEasy." },
    ],
  }),
  component: OwnerDashboard,
});

type OwnerBooking = {
  id: string;
  hall_id: string;
  customer_id: string;
  event_date: string;
  start_time: string;
  end_time: string;
  guests: number;
  event_type: string;
  total_amount: number;
  status: string;
  payment_status: string;
  halls: { name: string } | null;
  customer?: string;
};

function OwnerDashboard() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"requests" | "halls" | "reviews">("requests");

  const hallsQuery = useQuery({
    queryKey: ["owner-halls", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("halls")
        .select("*")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Hall[];
    },
  });

  const bookingsQuery = useQuery({
    queryKey: ["owner-bookings", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, halls!inner(name, owner_id)")
        .eq("halls.owner_id", user!.id)
        .order("event_date", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as unknown as OwnerBooking[];
      const ids = [...new Set(rows.map((r) => r.customer_id))];
      if (ids.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", ids);
        const names: Record<string, string> = {};
        for (const p of profiles ?? []) names[p.id as string] = (p.full_name as string) || "Guest";
        for (const row of rows) row.customer = names[row.customer_id] ?? "Guest";
      }
      return rows;
    },
  });

  const reviewsQuery = useQuery({
    queryKey: ["owner-reviews", user?.id],
    enabled: !!user?.id && (hallsQuery.data?.length ?? 0) > 0,
    queryFn: async () => {
      const hallIds = (hallsQuery.data ?? []).map((h) => h.id);
      const { data, error } = await supabase
        .from("reviews")
        .select("id, rating, comment, hall_id, created_at")
        .in("hall_id", hallIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function setStatus(booking: OwnerBooking, status: "confirmed" | "rejected") {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", booking.id);
    if (error) return toast.error(error.message);
    toast.success(status === "confirmed" ? "Booking accepted." : "Booking declined.");
    queryClient.invalidateQueries({ queryKey: ["owner-bookings", user?.id] });
  }

  const bookings = bookingsQuery.data ?? [];
  const pending = bookings.filter((b) => b.status === "pending");
  const monthTotal = bookings
    .filter((b) => b.status === "confirmed")
    .reduce((sum, b) => sum + Number(b.total_amount), 0);

  const tabBtn = (key: typeof tab, text: string) => (
    <button
      key={key}
      onClick={() => setTab(key)}
      className={`rounded-lg px-3.5 py-2 text-sm font-medium ring-1 ring-black/5 ${
        tab === key ? "bg-brand text-paper" : "bg-cream text-ink/70"
      }`}
    >
      {text}
    </button>
  );

  return (
    <PageShell>
      <section className="relative z-20 mx-auto max-w-7xl px-6 pb-20 pt-10">
        <div className="rounded-[20px] bg-white/55 p-6 ring-1 ring-black/5 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ember">
                Owner view
              </p>
              <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
                Booking requests
              </h1>
            </div>
            <div className="flex gap-6 text-sm">
              <div>
                <p className="font-display text-2xl font-semibold">{pending.length}</p>
                <p className="text-ink/50">Pending</p>
              </div>
              <div>
                <p className="font-display text-2xl font-semibold">{formatINR(monthTotal)}</p>
                <p className="text-ink/50">Confirmed value</p>
              </div>
              <div>
                <p className="font-display text-2xl font-semibold">
                  {hallsQuery.data?.length ?? 0}
                </p>
                <p className="text-ink/50">Halls listed</p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            {tabBtn("requests", "Requests")}
            {tabBtn("halls", "My halls")}
            {tabBtn("reviews", "Reviews")}
          </div>

          {tab === "requests" ? (
            bookings.length === 0 ? (
              <p className="mt-6 text-sm text-ink/55">No booking requests yet.</p>
            ) : (
              <div className="mt-5 divide-y divide-ink/10">
                {bookings.map((b) => (
                  <div key={b.id} className="flex flex-wrap items-center gap-4 py-4">
                    <div className="grid size-10 place-items-center rounded-lg bg-sand font-display font-semibold text-ink/70 outline-1 -outline-offset-1 outline-black/5">
                      {(b.customer ?? "G").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-[200px] flex-1">
                      <p className="font-medium">{b.customer ?? "Guest"}</p>
                      <p className="text-sm text-ink/55">
                        {b.halls?.name} · {b.event_type} · {b.guests} guests ·{" "}
                        {formatDate(b.event_date)}, {formatTime(b.start_time)}–
                        {formatTime(b.end_time)}
                      </p>
                    </div>
                    <div className="text-sm font-semibold">
                      {formatINR(Number(b.total_amount))}
                      <span className="ml-2 font-normal text-ink/50">{statusLabel(b.status)}</span>
                    </div>
                    {b.status === "pending" ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setStatus(b, "confirmed")}
                          className="rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-paper ring-1 ring-brand-deep/30 transition-transform hover:-translate-y-0.5"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => setStatus(b, "rejected")}
                          className="rounded-lg bg-cream px-3.5 py-2 text-sm font-medium text-ink/70 ring-1 ring-black/5 hover:bg-cream/70"
                        >
                          Decline
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )
          ) : null}

          {tab === "halls" ? <OwnerHalls halls={hallsQuery.data ?? []} /> : null}

          {tab === "reviews" ? (
            (reviewsQuery.data?.length ?? 0) === 0 ? (
              <p className="mt-6 text-sm text-ink/55">No reviews yet.</p>
            ) : (
              <div className="mt-5 divide-y divide-ink/10">
                {(reviewsQuery.data ?? []).map((r) => (
                  <div key={r.id as string} className="py-3">
                    <p className="text-sm font-medium">
                      {hallsQuery.data?.find((h) => h.id === r.hall_id)?.name} ·{" "}
                      <span className="text-ember">{"★".repeat(r.rating as number)}</span>
                    </p>
                    {r.comment ? <p className="mt-1 text-sm text-ink/60">{r.comment}</p> : null}
                  </div>
                ))}
              </div>
            )
          ) : null}
        </div>
      </section>
    </PageShell>
  );
}

function OwnerHalls({ halls }: { halls: Hall[] }) {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    city: CITIES[0] as string,
    area: "",
    hall_type: HALL_TYPES[0] as string,
    capacity: 150,
    size_sqft: 3000,
    price_per_day: 25000,
    description: "",
    amenities: [] as string[],
  });
  const [serviceDraft, setServiceDraft] = useState<Record<string, { name: string; price: string }>>(
    {},
  );
  const [blockDraft, setBlockDraft] = useState<Record<string, string>>({});

  const servicesQuery = useQuery({
    queryKey: ["owner-services", halls.map((h) => h.id).join(",")],
    enabled: halls.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hall_services")
        .select("*")
        .in(
          "hall_id",
          halls.map((h) => h.id),
        );
      if (error) throw error;
      return data ?? [];
    },
  });

  const blackoutsQuery = useQuery({
    queryKey: ["owner-blackouts", halls.map((h) => h.id).join(",")],
    enabled: halls.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hall_blackouts")
        .select("*")
        .in(
          "hall_id",
          halls.map((h) => h.id),
        );
      if (error) throw error;
      return data ?? [];
    },
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["owner-halls", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["owner-services"] });
    queryClient.invalidateQueries({ queryKey: ["owner-blackouts"] });
    queryClient.invalidateQueries({ queryKey: ["halls"] });
  }

  async function addHall(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("halls").insert({ ...form, owner_id: user!.id });
    if (error) return toast.error(error.message);
    toast.success("Hall listed.");
    setOpen(false);
    refresh();
  }

  async function toggleActive(hall: Hall) {
    const { error } = await supabase
      .from("halls")
      .update({ is_active: !hall.is_active })
      .eq("id", hall.id);
    if (error) return toast.error(error.message);
    refresh();
  }

  async function addService(hallId: string) {
    const draft = serviceDraft[hallId];
    if (!draft?.name) return toast.error("Give the service a name.");
    const { error } = await supabase
      .from("hall_services")
      .insert({ hall_id: hallId, name: draft.name, price: Number(draft.price) || 0, unit: "flat" });
    if (error) return toast.error(error.message);
    setServiceDraft({ ...serviceDraft, [hallId]: { name: "", price: "" } });
    refresh();
  }

  async function addBlackout(hallId: string) {
    const date = blockDraft[hallId];
    if (!date) return toast.error("Pick a date to block.");
    const { error } = await supabase
      .from("hall_blackouts")
      .insert({ hall_id: hallId, blocked_date: date });
    if (error) return toast.error(error.message);
    setBlockDraft({ ...blockDraft, [hallId]: "" });
    refresh();
  }

  const boxed =
    "mt-1 w-full rounded-lg bg-cream/70 px-3 py-2.5 text-sm font-medium ring-1 ring-black/5 outline-none";
  const label = "text-[11px] font-semibold uppercase tracking-wider text-ink/45";

  return (
    <div className="mt-5">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-lg bg-ember px-3.5 py-2 text-sm font-semibold text-white ring-1 ring-black/10"
      >
        {open ? "Close form" : "Add a hall"}
      </button>

      {open ? (
        <form onSubmit={addHall} className="mt-4 grid grid-cols-2 gap-3 rounded-[16px] bg-cream/60 p-4 ring-1 ring-black/5">
          <div className="col-span-2">
            <label className={label}>Hall name</label>
            <input
              className={boxed}
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className={label}>City</label>
            <select
              className={boxed}
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            >
              {CITIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Area</label>
            <input
              className={boxed}
              value={form.area}
              onChange={(e) => setForm({ ...form, area: e.target.value })}
            />
          </div>
          <div>
            <label className={label}>Hall type</label>
            <select
              className={boxed}
              value={form.hall_type}
              onChange={(e) => setForm({ ...form, hall_type: e.target.value })}
            >
              {HALL_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Capacity</label>
            <input
              type="number"
              className={boxed}
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className={label}>Size (sq ft)</label>
            <input
              type="number"
              className={boxed}
              value={form.size_sqft}
              onChange={(e) => setForm({ ...form, size_sqft: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className={label}>Price per day (₹)</label>
            <input
              type="number"
              className={boxed}
              value={form.price_per_day}
              onChange={(e) => setForm({ ...form, price_per_day: Number(e.target.value) })}
            />
          </div>
          <div className="col-span-2">
            <label className={label}>Description</label>
            <textarea
              className={boxed}
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="col-span-2">
            <label className={label}>Amenities</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {AMENITIES.map((a) => (
                <button
                  type="button"
                  key={a}
                  onClick={() =>
                    setForm({
                      ...form,
                      amenities: form.amenities.includes(a)
                        ? form.amenities.filter((v) => v !== a)
                        : [...form.amenities, a],
                    })
                  }
                  className={`rounded-full px-2.5 py-1 text-sm ring-1 ring-black/5 ${
                    form.amenities.includes(a) ? "bg-brand text-paper" : "bg-white/70 text-ink/70"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div className="col-span-2">
            <button className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-paper ring-1 ring-brand-deep/30">
              Publish hall
            </button>
          </div>
        </form>
      ) : null}

      {halls.length === 0 ? (
        <p className="mt-6 text-sm text-ink/55">You have not listed a hall yet.</p>
      ) : (
        <div className="mt-5 space-y-4">
          {halls.map((hall) => {
            const services = (servicesQuery.data ?? []).filter((s) => s.hall_id === hall.id);
            const blocked = (blackoutsQuery.data ?? []).filter((b) => b.hall_id === hall.id);
            return (
              <div key={hall.id} className="rounded-[16px] bg-cream/60 p-4 ring-1 ring-black/5">
                <div className="flex flex-wrap items-center gap-4">
                  <img
                    src={hallImage(hall)}
                    alt={hall.name}
                    loading="lazy"
                    width={1024}
                    height={768}
                    className="size-16 rounded-lg object-cover"
                  />
                  <div className="min-w-[180px] flex-1">
                    <p className="font-display text-xl font-semibold">{hall.name}</p>
                    <p className="text-sm text-ink/55">
                      {hall.city} · seats {hall.capacity} · {formatINR(hall.price_per_day)}/day
                    </p>
                  </div>
                  <button
                    onClick={() => toggleActive(hall)}
                    className="rounded-lg bg-white/70 px-3.5 py-2 text-sm font-medium text-ink/70 ring-1 ring-black/5"
                  >
                    {hall.is_active ? "Unlist" : "Publish"}
                  </button>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className={label}>Services</p>
                    <ul className="mt-2 space-y-1 text-sm text-ink/60">
                      {services.map((s) => (
                        <li key={s.id as string}>
                          {s.name as string} · {formatINR(Number(s.price))}
                        </li>
                      ))}
                      {services.length === 0 ? <li>No extras yet.</li> : null}
                    </ul>
                    <div className="mt-2 flex gap-2">
                      <input
                        placeholder="Service name"
                        className="w-full rounded-lg bg-white/70 px-3 py-2 text-sm ring-1 ring-black/5 outline-none"
                        value={serviceDraft[hall.id]?.name ?? ""}
                        onChange={(e) =>
                          setServiceDraft({
                            ...serviceDraft,
                            [hall.id]: {
                              name: e.target.value,
                              price: serviceDraft[hall.id]?.price ?? "",
                            },
                          })
                        }
                      />
                      <input
                        placeholder="₹"
                        className="w-28 rounded-lg bg-white/70 px-3 py-2 text-sm ring-1 ring-black/5 outline-none"
                        value={serviceDraft[hall.id]?.price ?? ""}
                        onChange={(e) =>
                          setServiceDraft({
                            ...serviceDraft,
                            [hall.id]: {
                              name: serviceDraft[hall.id]?.name ?? "",
                              price: e.target.value,
                            },
                          })
                        }
                      />
                      <button
                        onClick={() => addService(hall.id)}
                        className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-paper"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className={label}>Blocked dates</p>
                    <ul className="mt-2 space-y-1 text-sm text-ink/60">
                      {blocked.map((b) => (
                        <li key={b.id as string}>{formatDate(b.blocked_date as string)}</li>
                      ))}
                      {blocked.length === 0 ? <li>Open on every date.</li> : null}
                    </ul>
                    <div className="mt-2 flex gap-2">
                      <input
                        type="date"
                        className="w-full rounded-lg bg-white/70 px-3 py-2 text-sm ring-1 ring-black/5 outline-none"
                        value={blockDraft[hall.id] ?? ""}
                        onChange={(e) =>
                          setBlockDraft({ ...blockDraft, [hall.id]: e.target.value })
                        }
                      />
                      <button
                        onClick={() => addBlackout(hall.id)}
                        className="rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-paper"
                      >
                        Block
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
