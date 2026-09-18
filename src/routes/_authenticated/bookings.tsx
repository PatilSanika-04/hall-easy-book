import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/venue/Shell";
import { useSession } from "@/hooks/useAuth";
import { formatDate, formatINR, formatTime, statusLabel } from "@/lib/venue";

export const Route = createFileRoute("/_authenticated/bookings")({
  head: () => ({
    meta: [
      { title: "My bookings — VenueEasy" },
      {
        name: "description",
        content: "Track your hall bookings, pay confirmed ones and leave a review after the event.",
      },
      { property: "og:title", content: "My bookings — VenueEasy" },
      { property: "og:description", content: "Your hall bookings in one place." },
    ],
  }),
  component: MyBookings,
});

type BookingRow = {
  id: string;
  hall_id: string;
  event_date: string;
  start_time: string;
  end_time: string;
  guests: number;
  event_type: string;
  total_amount: number;
  status: string;
  payment_status: string;
  halls: { name: string; city: string; image_url: string | null } | null;
};

function MyBookings() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [reviewFor, setReviewFor] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const bookings = useQuery({
    queryKey: ["my-bookings", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, halls(name, city, image_url)")
        .eq("customer_id", user!.id)
        .order("event_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as BookingRow[];
    },
  });

  const myReviews = useQuery({
    queryKey: ["my-reviews", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("booking_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.booking_id as string));
    },
  });

  async function pay(booking: BookingRow) {
    const { error } = await supabase
      .from("bookings")
      .update({ payment_status: "paid" })
      .eq("id", booking.id);
    if (error) return toast.error(error.message);
    toast.success("Payment recorded. Your booking is confirmed.");
    queryClient.invalidateQueries({ queryKey: ["my-bookings", user?.id] });
  }

  async function cancel(booking: BookingRow) {
    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", booking.id);
    if (error) return toast.error(error.message);
    toast.success("Booking cancelled.");
    queryClient.invalidateQueries({ queryKey: ["my-bookings", user?.id] });
  }

  async function submitReview(booking: BookingRow) {
    const { error } = await supabase.from("reviews").insert({
      hall_id: booking.hall_id,
      booking_id: booking.id,
      user_id: user!.id,
      rating,
      comment,
    });
    if (error) return toast.error(error.message);
    toast.success("Thanks for your review.");
    setReviewFor(null);
    setComment("");
    setRating(5);
    queryClient.invalidateQueries({ queryKey: ["my-reviews", user?.id] });
  }

  const rows = bookings.data ?? [];

  return (
    <PageShell>
      <section className="relative z-20 mx-auto max-w-5xl px-6 pb-20 pt-10">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ember">Your account</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">My bookings</h1>

        {bookings.isLoading ? (
          <p className="mt-6 text-sm text-ink/50">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="mt-8 rounded-[16px] bg-white/60 p-8 text-center ring-1 ring-black/5">
            <p className="font-display text-xl font-semibold">No bookings yet.</p>
            <Link to="/halls" className="mt-2 inline-block text-sm font-semibold text-brand">
              Browse halls
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {rows.map((b) => {
              const reviewed = myReviews.data?.has(b.id);
              const past = new Date(`${b.event_date}T00:00:00`) < new Date();
              return (
                <div
                  key={b.id}
                  className="rounded-[16px] bg-white/60 p-5 ring-1 ring-black/5 backdrop-blur-xl"
                >
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-[220px]">
                      <p className="font-display text-xl font-semibold">
                        {b.halls?.name ?? "Hall"}
                      </p>
                      <p className="text-sm text-ink/60">
                        {b.event_type} · {b.guests} guests · {formatDate(b.event_date)},{" "}
                        {formatTime(b.start_time)}–{formatTime(b.end_time)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-lg font-semibold">
                        {formatINR(Number(b.total_amount))}
                      </p>
                      <p className="text-xs font-medium text-ink/50">
                        {statusLabel(b.status)}
                        {b.payment_status === "paid" ? " · Paid" : ""}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {b.status === "confirmed" && b.payment_status !== "paid" ? (
                      <button
                        onClick={() => pay(b)}
                        className="rounded-lg bg-ember px-3.5 py-2 text-sm font-semibold text-white ring-1 ring-black/10"
                      >
                        Pay {formatINR(Number(b.total_amount))}
                      </button>
                    ) : null}
                    {["pending", "confirmed"].includes(b.status) ? (
                      <button
                        onClick={() => cancel(b)}
                        className="rounded-lg bg-cream px-3.5 py-2 text-sm font-medium text-ink/70 ring-1 ring-black/5"
                      >
                        Cancel booking
                      </button>
                    ) : null}
                    {b.status === "confirmed" && past && !reviewed ? (
                      <button
                        onClick={() => setReviewFor(reviewFor === b.id ? null : b.id)}
                        className="rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-paper ring-1 ring-brand-deep/30"
                      >
                        Leave a review
                      </button>
                    ) : null}
                    <Link
                      to="/halls/$id"
                      params={{ id: b.hall_id }}
                      className="rounded-lg bg-cream px-3.5 py-2 text-sm font-medium text-ink/70 ring-1 ring-black/5"
                    >
                      View hall
                    </Link>
                  </div>

                  {reviewFor === b.id ? (
                    <div className="mt-4 rounded-lg bg-cream/70 p-4 ring-1 ring-black/5">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            onClick={() => setRating(n)}
                            className={`text-xl ${n <= rating ? "text-ember" : "text-ink/25"}`}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                      <textarea
                        className="mt-3 w-full rounded-lg bg-white/70 px-3 py-2 text-sm ring-1 ring-black/5 outline-none"
                        rows={3}
                        placeholder="How was the hall and the service?"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                      />
                      <button
                        onClick={() => submitReview(b)}
                        className="mt-3 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-paper"
                      >
                        Submit review
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </PageShell>
  );
}
