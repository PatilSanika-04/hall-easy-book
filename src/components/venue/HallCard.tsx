import { Link } from "@tanstack/react-router";
import { formatINR, hallImage, type Hall } from "@/lib/venue";

export function HallCard({
  hall,
  rating,
  reviewCount,
}: {
  hall: Hall;
  rating?: number | null;
  reviewCount?: number;
}) {
  return (
    <Link
      to="/halls/$id"
      params={{ id: hall.id }}
      className="group grid grid-cols-5 gap-4 rounded-[16px] bg-white/60 p-3 ring-1 ring-black/5 backdrop-blur-xl transition-transform hover:-translate-y-1"
    >
      <div className="col-span-2">
        <img
          src={hallImage(hall)}
          alt={hall.name}
          loading="lazy"
          width={1024}
          height={768}
          className="aspect-[4/3] w-full rounded-[12px] object-cover outline-1 -outline-offset-1 outline-black/5"
        />
      </div>
      <div className="col-span-3 pr-1">
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
        <h3 className="mt-1 font-display text-2xl font-semibold leading-tight">{hall.name}</h3>
        <p className="mt-1 text-sm text-ink/60">
          Seats {hall.capacity}
          {hall.size_sqft ? ` · ${hall.size_sqft} sq ft` : ""}
          {hall.amenities?.length ? ` · ${hall.amenities.slice(0, 3).join(", ")}` : ""}
        </p>
        <div className="mt-3 flex items-center gap-4 text-sm">
          <span className="font-semibold">
            {formatINR(hall.price_per_day)}
            <span className="font-normal text-ink/40">/day</span>
          </span>
          <span className="font-medium text-ink/50">
            {rating ? (
              <>
                {rating.toFixed(1)} <span className="text-ember">★</span> ({reviewCount})
              </>
            ) : (
              "New listing"
            )}
          </span>
        </div>
      </div>
    </Link>
  );
}
