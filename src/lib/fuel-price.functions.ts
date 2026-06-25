import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  city: z.string().min(1).max(60),
  fuelType: z.enum(["petrol", "diesel"]),
});

/**
 * Best-effort fuel-price scrape from goodreturns.in (free public source).
 * Returns today's rate for the given city; historical rates are not available
 * from this source, so callers should allow manual override per refuel.
 */
export const fetchFuelPrice = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const slug = data.city
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const url = `https://www.goodreturns.in/${data.fuelType}-price-in-${slug}.html`;

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; FuelTracker/1.0; +https://lovable.dev)",
          Accept: "text/html",
        },
      });
      if (!res.ok) {
        return { ok: false as const, error: `Source returned ${res.status}` };
      }
      const html = await res.text();

      // Look for "₹ NN.NN" or "Rs NN.NN" patterns near the top of the page.
      const matches = [...html.matchAll(/(?:₹|Rs\.?|INR)\s*([0-9]{2,3}\.[0-9]{1,2})/gi)];
      const prices = matches
        .map((m) => parseFloat(m[1]))
        .filter((n) => !isNaN(n) && n > 50 && n < 200);
      if (prices.length === 0) {
        return { ok: false as const, error: "Could not parse price from source" };
      }
      // Use the first plausible price (usually today's headline rate).
      return {
        ok: true as const,
        price: prices[0],
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
