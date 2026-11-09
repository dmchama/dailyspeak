export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.ENABLE_INTERNAL_SCHEDULER !== "false") {
    const { startInternalScheduler } = await import("./lib/scheduler/daily");
    startInternalScheduler();
  }
}
