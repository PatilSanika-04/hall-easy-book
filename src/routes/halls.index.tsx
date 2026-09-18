import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/venue/Shell";
import { HallCard } from "@/components/venue/HallCard";
import {
  AMENITIES,
  CAPACITY_BANDS,
  CITIES,
  HALL_TYPES,
  formatINR,
  type Hall,
} from "@/lib/venue";

type Search = { city?: string; guests?: number; date?: string };

export const Route = createFileRoute("/halls/")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    city: typeof search['city'] === "string" ? (search['city'] as string) : undefined,
    guests: Number(search['guests']) > 0 ? Number(search['guests']) : undefined,
    date: typeof search['date'] === "string" ? (search['date'] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Search halls — VenueEasy" },
      {
        name: "description",
        content:
          "Filter banquet halls, garden pavilions and lofts by city, capacity, price and amenities, then check live availability.",
      },
      { property: "og:title", content: "Search halls — VenueEasy" },
      {
        property: "og:description",
        content: "Find and compare event halls with honest day rates and live availability.",
      },
    ],
  }),
  component: HallsSearch,
});

function HallsSearch() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [city, setCity] = useState(search.city ?? "");
  const [band, setBand] = useState<string | null>(null);
  const [maxPrice, setMaxPrice] = useState(60000);
  const [types, setTypes] = useState<string[]>([]);
  const [amenities, setAmenities] = useState<string[]>([]);

  const hallsQuery = useQuery({
    queryKey: ["halls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("halls")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Hall[];
    },
  });

  const ratingsQuery = useQuery({
    queryKey: ["ratings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reviews").select("hall_id, rating");
      if (error) throw error;
      const map: Record<string, { sum: number; count: number }> = {};
      for (const row of data ?? []) {
        const key = row.hall_id as string;
        map[key] = map[key] ?? { sum: 0, count: 0 };
        map[key].sum += row.rating as number;
        map[key].count += 1;
      }
      return map;
    },
  });

  const halls = hallsQuery.data ?? [];
  const filtered = useMemo(() => {
    const capacityBand = CAPACITY_BANDS.find((b) => b.label === band);
    return halls.filter((hall) => {
      if (city && hall.city !== city) return false;
      if (search.guests && hall.capacity < search.guests) return false;
      if (capacityBand && (hall.capacity < capacityBand.min || hall.capacity > capacityBand.max))
        return false;
      if (Number(hall.price_per_day) > maxPrice) return false;
      if (types.length && !types.includes(hall.hall_type)) return false;
      if (amenities.length && !amenities.every((a) => hall.amenities?.includes(a))) return false;
      return true;
    });
  }, [halls, city, band, maxPrice, types, amenities, search.guests]);

  function toggle(list: string[], value: string, setter: (v: string[]) => void) {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  const chip = "rounded-full px-2.5 py-1 text-sm ring-1 ring-black/5";

  return (
    <PageShell>
      <section className="relative z-20 mx-auto max-w-7xl px-6 pb-16 pt-10">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ember">
          Browse venues
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold leading-none tracking-tight">
          Halls ready for your date.
        </h1>

        <div className="mt-8 grid grid-cols-12 gap-6">
          <aside className="col-span-12 lg:col-span-3">
            <div className="rounded-[16px] bg-white/55 p-5 ring-1 ring-black/5 backdrop-blur-xl lg:sticky lg:top-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">Refine</h2>
                <button
                  className="text-xs font-medium text-brand hover:underline"
                  onClick={() => {
                    setCity("");
                    setBand(null);
                    setMaxPrice(60000);
                    setTypes([]);
                    setAmenities([]);
                    navigate({ to: "/halls", search: {} });
                  }}
                >
                  Reset
                </button>
              </div>
              <div className="mt-5 space-y-5 text-sm">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/45">
                    City
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {CITIES.map((c) => (
                      <button
                        key={c}
                        onClick={() => setCity(city === c ? "" : c)}
                        className={`${chip} ${city === c ? "bg-brand text-paper" : "bg-cream text-ink/70"}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/45">
                    Capacity
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {CAPACITY_BANDS.map((b) => (
                      <button
                        key={b.label}
                        onClick={() => setBand(band === b.label ? null : b.label)}
                        className={`${chip} ${band === b.label ? "bg-brand text-paper" : "bg-cream text-ink/70"}`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/45">
                    Price / day
                  </p>
                  <div className="mt-2 flex items-center justify-between text-ink/70">
                    <span className="font-medium">{formatINR(0)}</span>
                    <span className="font-medium text-brand">{formatINR(maxPrice)}</span>
                  </div>
                  <input
                    type="range"
                    min={5000}
                    max={100000}
                    step={2500}
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(Number(e.target.value))}
                    className="mt-2 w-full accent-brand"
                  />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/45">
                    Hall type
                  </p>
                  <div className="mt-2 space-y-2">
                    {HALL_TYPES.map((t) => (
                      <label key={t} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="size-4 accent-brand"
                          checked={types.includes(t)}
                          onChange={() => toggle(types, t, setTypes)}
                        />
                        <span className="text-ink/80">{t}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/45">
                    Amenities
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {AMENITIES.slice(0, 6).map((a) => (
                      <button
                        key={a}
                        onClick={() => toggle(amenities, a, setAmenities)}
                        className={`${chip} ${
                          amenities.includes(a) ? "bg-brand text-paper" : "bg-cream text-ink/70"
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <div className="col-span-12 lg:col-span-9">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-ink/60">
                <span className="font-semibold text-ink">{filtered.length} halls</span>
                {city ? ` in ${city}` : " across India"}
              </p>
              {search.date ? (
                <span className="text-xs font-medium text-ink/45">Looking at {search.date}</span>
              ) : null}
            </div>
            {hallsQuery.isLoading ? (
              <p className="text-sm text-ink/50">Loading halls…</p>
            ) : filtered.length === 0 ? (
              <div className="rounded-[16px] bg-white/60 p-8 text-center ring-1 ring-black/5">
                <p className="font-display text-xl font-semibold">No halls match those filters.</p>
                <p className="mt-1 text-sm text-ink/60">Try widening the price or capacity range.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {filtered.map((hall) => {
                  const r = ratingsQuery.data?.[hall.id];
                  return (
                    <HallCard
                      key={hall.id}
                      hall={hall}
                      rating={r ? r.sum / r.count : null}
                      reviewCount={r?.count ?? 0}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </PageShell>
  );
}
