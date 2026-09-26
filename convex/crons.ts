import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("auto checkout overdue stays", { hours: 1 }, internal.maintenance.autoCheckout, {});

crons.interval("run due routines", { minutes: 10 }, internal.routines.tick, {});

// 03:30 UTC = 07:30 Tbilisi.
crons.cron("data retention", "30 3 * * *", internal.maintenance.retention, {});

export default crons;
