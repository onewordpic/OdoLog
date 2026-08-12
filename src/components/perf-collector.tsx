import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { recordPerfSamples } from "@/lib/perf.functions";
import {
  clearBuffer,
  markHydrationEnd,
  startPerfCollection,
  type PerfSample,
} from "@/lib/perf";

/**
 * Mounted only when the `perfProfiling` pref is on. Collects one sample per
 * page load and uploads buffered samples for signed-in users.
 */
export function PerfCollector() {
  const record = useServerFn(recordPerfSamples);

  useEffect(() => {
    markHydrationEnd();

    const flush = async (samples: PerfSample[]) => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return; // guests: keep buffering until sign-in
        await record({ data: { samples } });
        clearBuffer();
      } catch {
        /* keep buffer for next attempt */
      }
    };

    return startPerfCollection(flush);
  }, [record]);

  return null;
}

export default PerfCollector;
