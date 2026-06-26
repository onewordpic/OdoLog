import { useQuery } from "@tanstack/react-query";
import { Cloud } from "lucide-react";

// Open-Meteo: free, no API key, CORS-enabled.
async function fetchWeather(city: string) {
  const geo = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      city,
    )}&count=1&language=en&format=json`,
  ).then((r) => r.json());
  const place = geo?.results?.[0];
  if (!place) throw new Error("city not found");
  const wx = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code&timezone=auto`,
  ).then((r) => r.json());
  return {
    name: place.name as string,
    temp: Math.round(wx?.current?.temperature_2m ?? 0),
    code: Number(wx?.current?.weather_code ?? 0),
  };
}

function emojiFor(code: number): string {
  if ([0].includes(code)) return "☀️";
  if ([1, 2].includes(code)) return "🌤️";
  if ([3].includes(code)) return "☁️";
  if ([45, 48].includes(code)) return "🌫️";
  if (code >= 51 && code <= 67) return "🌦️";
  if (code >= 71 && code <= 77) return "🌨️";
  if (code >= 80 && code <= 82) return "🌧️";
  if (code >= 95) return "⛈️";
  return "🌡️";
}

function adviceFor(code: number, temp: number): string | null {
  if (code >= 95) return "Thunderstorm — avoid open roads, pull over if heavy.";
  if (code >= 80 && code <= 82) return "Heavy showers — roads slick, double your braking distance.";
  if (code >= 71 && code <= 77) return "Snow/sleet — drive slow, no sudden turns.";
  if (code >= 51 && code <= 67) return "Rainy — roads are wet, drive safe and keep headlights on.";
  if ([45, 48].includes(code)) return "Foggy — use low beams and fog lamps, keep distance.";
  if (temp >= 38) return "Scorcher out — check tyre pressure and hydrate.";
  if (temp <= 5) return "Cold — let the engine warm up for a minute before riding.";
  if ([0, 1].includes(code)) return "Clear skies — perfect day for a ride.";
  return null;
}

export function WeatherChip({ city }: { city: string }) {
  const enabled = !!city && city.trim().length > 0;
  const q = useQuery({
    queryKey: ["weather", city.toLowerCase()],
    queryFn: () => fetchWeather(city),
    enabled,
    staleTime: 1000 * 60 * 15,
    retry: 1,
  });

  if (!enabled || q.isError) return null;
  return (
    <div className="hidden sm:flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/5 px-3 py-1.5 text-[11px] text-[var(--cockpit-text-soft)]">
      {q.isLoading || !q.data ? (
        <>
          <Cloud className="h-3 w-3 opacity-50" />
          <span className="opacity-60">{city}</span>
        </>
      ) : (
        <>
          <span aria-hidden>{emojiFor(q.data.code)}</span>
          <span className="font-semibold text-foreground">{q.data.temp}°C</span>
          <span className="opacity-60">· {q.data.name}</span>
        </>
      )}
    </div>
  );
}

export function WeatherAdvisory({ city }: { city: string }) {
  const enabled = !!city && city.trim().length > 0;
  const q = useQuery({
    queryKey: ["weather", city.toLowerCase()],
    queryFn: () => fetchWeather(city),
    enabled,
    staleTime: 1000 * 60 * 15,
    retry: 1,
  });
  if (!enabled || !q.data) return null;
  const tip = adviceFor(q.data.code, q.data.temp);
  if (!tip) return null;
  return (
    <div className="glass mt-3 flex items-start gap-3 rounded-2xl px-4 py-3 text-xs animate-fade-in">
      <span aria-hidden className="text-base leading-none">{emojiFor(q.data.code)}</span>
      <div className="min-w-0">
        <div className="font-medium text-foreground">
          {q.data.name} · {q.data.temp}°C
        </div>
        <p className="text-muted-foreground">{tip}</p>
      </div>
    </div>
  );
}
