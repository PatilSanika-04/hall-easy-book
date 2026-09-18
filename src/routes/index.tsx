import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/venue/Shell";
import { HallCard } from "@/components/venue/HallCard";
import { CITIES, type Hall } from "@/lib/venue";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VenueEasy — Book banquet halls and event venues in India" },
      {
        name: "description",
        content:
          "Search hand-picked banquet halls, garden pavilions and lofts, check live availability, add services and book online. Owners can list and manage their halls.",
      },
      { property: "og:title", content: "VenueEasy — Hall booking made simple" },
      {
        property: "og:description",
        content:
          "Find the room your celebration deserves: real capacities, honest day rates and a calendar you can trust.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const [city, setCity] = useState("Mumbai");
  const [guests, setGuests] = useState(120);
  const [date, setDate] = useState("");

  const halls = useQuery({
    queryKey: ["featured-halls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("halls")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(3);
      if (error) throw error;
      return (data ?? []) as unknown as Hall[];
    },
  });

  const boxed =
    "mt-1 w-full rounded-lg bg-cream/70 px-3 py-2.5 text-sm font-medium ring-1 ring-black/5 outline-none";
  const label = "text-[11px] font-semibold uppercase tracking-wider text-ink/45";

  return (
    <PageShell>
      <section className="relative z-20 mx-auto max-w-7xl px-6 pb-8 pt-12">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ember">
          Now booking · 2026 season
        </p>
        <h1 className="mt-3 max-w-[20ch] text-balance font-display text-5xl font-semibold leading-none tracking-tight sm:text-6xl">
          Find the room your celebration deserves.
        </h1>
        <p className="mt-4 max-w-[52ch] text-pretty text-base text-ink/65">
          Hand-picked halls across India. Real capacities, honest day rates, and a calendar you can
          trust — keys, floor plan, and a circled date included.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ to: "/halls", search: { city, guests, date: date || undefined } });
          }}
          className="mt-8 grid grid-cols-2 gap-3 rounded-[18px] bg-white/60 p-3 shadow-[0_18px_50px_-24px_rgba(15,122,99,0.5)] ring-1 ring-black/5 backdrop-blur-xl lg:grid-cols-4"
        >
          <div className="col-span-2 lg:col-span-1">
            <label className={label}>City</label>
            <select className={boxed} value={city} onChange={(e) => setCity(e.target.value)}>
              {CITIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
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
            <label className={label}>Date</label>
            <input
              type="date"
              className={boxed}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <button className="self-end rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-paper ring-1 ring-brand-deep/30 transition-transform hover:-translate-y-0.5 hover:bg-brand-deep">
            Search halls
          </button>
        </form>
      </section>

      <section className="relative z-20 mx-auto max-w-7xl px-6 pb-16">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-3xl font-semibold tracking-tight">Featured halls</h2>
          <Link to="/halls" className="text-sm font-semibold text-brand hover:underline">
            See all halls
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {(halls.data ?? []).map((hall) => (
            <HallCard key={hall.id} hall={hall} />
          ))}
        </div>
      </section>

      <section className="relative z-20 mx-auto max-w-7xl px-6 pb-20">
        <div className="rounded-[20px] bg-white/55 p-6 ring-1 ring-black/5 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ember">
                Own a hall?
              </p>
              <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight">
                List it and manage bookings.
              </h2>
              <p className="mt-2 max-w-[54ch] text-sm text-ink/60">
                Publish your hall with photos, day rate and extras, block out dates you are busy,
                and accept or decline every request from one queue.
              </p>
            </div>
            <Link
              to="/auth"
              className="rounded-lg bg-ember px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-black/10 transition-transform hover:-translate-y-0.5"
            >
              List your hall
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
