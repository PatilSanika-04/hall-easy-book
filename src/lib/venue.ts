export type ServiceUnit = "flat" | "per_guest";

export type HallService = {
  id: string;
  hall_id: string;
  name: string;
  price: number;
  unit: ServiceUnit;
};

export type Hall = {
  id: string;
  owner_id: string | null;
  name: string;
  city: string;
  area: string | null;
  hall_type: string;
  capacity: number;
  size_sqft: number | null;
  price_per_day: number;
  description: string | null;
  image_url: string | null;
  amenities: string[];
  is_active: boolean;
};

export const CITIES = ["Mumbai", "Bengaluru", "Pune", "Delhi", "Hyderabad", "Chennai"];
export const HALL_TYPES = ["Ballroom", "Banquet", "Garden pavilion", "Loft studio", "Rooftop"];
export const AMENITIES = [
  "AV system",
  "Catering",
  "Valet parking",
  "Parking",
  "Air conditioning",
  "Outdoor",
  "Sound system",
  "Stage",
  "Bar",
  "Wi-Fi",
];
export const CAPACITY_BANDS = [
  { label: "Up to 100", min: 0, max: 100 },
  { label: "100–250", min: 100, max: 250 },
  { label: "250+", min: 250, max: 100000 },
];
export const EVENT_TYPES = [
  "Wedding",
  "Reception",
  "Birthday",
  "Corporate event",
  "Conference",
  "Anniversary",
  "Other",
];

export const SERVICE_FEE_RATE = 0.1;

export function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function formatDate(value: string) {
  if (!value) return "";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatTime(value: string) {
  const [h, m] = value.split(":");
  const date = new Date();
  date.setHours(Number(h), Number(m ?? 0));
  return date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

export type CostBreakdown = {
  base: number;
  services: number;
  fee: number;
  total: number;
  lines: { label: string; amount: number }[];
};

export function calculateCost(
  pricePerDay: number,
  guests: number,
  services: HallService[],
  selectedIds: string[],
): CostBreakdown {
  const base = Number(pricePerDay) || 0;
  const lines: { label: string; amount: number }[] = [{ label: "Hall · full day", amount: base }];
  let servicesTotal = 0;

  for (const service of services) {
    if (!selectedIds.includes(service.id)) continue;
    const amount =
      service.unit === "per_guest" ? Number(service.price) * (guests || 0) : Number(service.price);
    servicesTotal += amount;
    lines.push({
      label: service.unit === "per_guest" ? `${service.name} · ${guests} guests` : service.name,
      amount,
    });
  }

  const fee = Math.round((base + servicesTotal) * SERVICE_FEE_RATE);
  lines.push({ label: "Service fee", amount: fee });

  return { base, services: servicesTotal, fee, total: base + servicesTotal + fee, lines };
}

export function statusLabel(status: string) {
  switch (status) {
    case "pending":
      return "Awaiting owner";
    case "confirmed":
      return "Confirmed";
    case "rejected":
      return "Declined";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export function hallImage(hall: { image_url: string | null }) {
  return hall.image_url || "/images/amber-ballroom.jpg";
}
