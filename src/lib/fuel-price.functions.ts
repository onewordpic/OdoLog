import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  city: z.string().min(1).max(60),
  fuelType: z.enum(["petrol", "diesel", "cng"]),
});

// goodreturns.in uses some legacy/short slugs for several Indian cities.
// Map common modern / official names → the slug the source actually serves.
const CITY_ALIASES: Record<string, string> = {
  thiruvananthapuram: "trivandrum",
  tvm: "trivandrum",
  trivandram: "trivandrum",
  kochi: "ernakulam",
  cochin: "ernakulam",
  kozhikode: "calicut",
  bengaluru: "bangalore",
  mumbai: "mumbai",
  bombay: "mumbai",
  chennai: "chennai",
  madras: "chennai",
  kolkata: "kolkata",
  calcutta: "kolkata",
  gurugram: "gurgaon",
  vadodara: "vadodara",
  baroda: "vadodara",
  prayagraj: "allahabad",
  varanasi: "varanasi",
  puducherry: "pondicherry",
  pondy: "pondicherry",
  vizag: "visakhapatnam",
  hubballi: "hubli",
  mysuru: "mysore",
  belagavi: "belgaum",
  tiruchirappalli: "trichy",
  tirunelveli: "tirunelveli",
};

function toSlug(city: string): string {
  const normalized = city
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return CITY_ALIASES[normalized] ?? normalized;
}

/**
 * Best-effort fuel-price scrape from goodreturns.in (free public source).
 * - Maps modern city names (e.g. Thiruvananthapuram → trivandrum) to the
 *   slugs the source actually serves.
 * - Detects a 30x redirect to the national page and reports the city as
 *   unsupported instead of returning a misleading nation-wide number.
 */
export const fetchFuelPrice = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const slug = toSlug(data.city);
    const url = `https://www.goodreturns.in/${data.fuelType}-price-in-${slug}.html`;

    try {
      // First check for a redirect (city not recognised → bumped to national page).
      const head = await fetch(url, {
        method: "GET",
        redirect: "manual",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
          Accept: "text/html",
        },
      });

      if (head.status >= 300 && head.status < 400) {
        return {
          ok: false as const,
          error: `City "${data.city}" not found on the rate source. Enter the rate manually or try a nearby city.`,
        };
      }
      if (!head.ok) {
        return { ok: false as const, error: `Source returned ${head.status}` };
      }

      const html = await head.text();

      // Headline rate appears in the <title>: "Rs. NN.NN/Ltr"
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      const title = titleMatch?.[1] ?? "";
      const titlePrice = title.match(/Rs\.?\s*([0-9]{2,3}\.[0-9]{1,2})\s*\/?\s*Ltr/i);

      let price: number | null = null;
      if (titlePrice) {
        price = parseFloat(titlePrice[1]);
      } else {
        // Fallback: first ₹/Rs price on the page within a sensible range.
        const matches = [...html.matchAll(/(?:₹|Rs\.?|INR)\s*([0-9]{2,3}\.[0-9]{1,2})/gi)];
        const prices = matches
          .map((m) => parseFloat(m[1]))
          .filter((n) => !isNaN(n) && n > 50 && n < 200);
        if (prices.length > 0) price = prices[0];
      }

      if (price == null) {
        return { ok: false as const, error: "Could not parse price from source" };
      }

      return {
        ok: true as const,
        price,
        city: data.city,
        fuelType: data.fuelType,
        source: "goodreturns.in",
      };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Network error",
      };
    }
  });
