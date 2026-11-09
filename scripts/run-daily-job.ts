// Run one scheduler tick and exit. Handy for system cron, e.g. every 10 minutes: npm run cron:once
import "dotenv/config";
import { runDailyTick } from "../src/lib/scheduler/daily";
import { getPool } from "../src/lib/db";

runDailyTick()
  .then((s) => console.log(JSON.stringify(s, null, 2)))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => getPool().end());
