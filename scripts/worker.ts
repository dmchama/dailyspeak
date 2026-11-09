/**
 * Standalone scheduler worker. Use this instead of the in-process scheduler when you run
 * several web instances or deploy the web app to a serverless platform:
 *   ENABLE_INTERNAL_SCHEDULER=false  (web)    +    npm run worker  (one long-running process)
 */
import "dotenv/config";
import { runDailyTick } from "../src/lib/scheduler/daily";

const minutes = Math.max(1, Number(process.env.SCHEDULER_INTERVAL_MINUTES || 5));

async function tick() {
  try {
    const s = await runDailyTick();
    console.log(new Date().toISOString(), JSON.stringify(s));
  } catch (e) {
    console.error("tick failed", e);
  }
}

console.log(`DailySpeak worker: running the daily lesson job every ${minutes} minute(s)`);
tick();
setInterval(tick, minutes * 60_000);
