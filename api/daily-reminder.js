const { createClient } = require("@supabase/supabase-js");

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const REMINDER_HOUR = 13;   // 1:30 PM America/Chicago — see vercel.json crons comment
const REMINDER_MINUTE = 30;

function chicagoNow() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
    weekday: "long",
  }).formatToParts(new Date());
  const get = t => parts.find(p => p.type === t)?.value;
  return {
    dateStr: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: get("weekday"),
    hour: parseInt(get("hour"), 10),
    minute: parseInt(get("minute"), 10),
  };
}

// Monday of the week containing the given local YYYY-MM-DD date string
function mondayOf(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

module.exports = async function handler(req, res) {
  if (!process.env.CRON_SECRET || req.headers["authorization"] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const missingEnv = ["REACT_APP_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY", "REMINDER_FROM_EMAIL"]
    .filter(k => !process.env[k]);
  if (missingEnv.length) {
    return res.status(500).json({ error: `Missing env vars: ${missingEnv.join(", ")}` });
  }

  const { dateStr, weekday, hour, minute } = chicagoNow();

  if (!WEEKDAYS.includes(weekday)) {
    return res.status(200).json({ skipped: "weekend", weekday });
  }
  if (hour < REMINDER_HOUR || (hour === REMINDER_HOUR && minute < REMINDER_MINUTE)) {
    return res.status(200).json({ skipped: "before 1:30 PM Central", localTime: `${hour}:${String(minute).padStart(2, "0")}` });
  }

  const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: lastSent } = await supabase.from("app_settings").select("value").eq("key", "reminder_last_sent_date").maybeSingle();
  if (lastSent?.value === dateStr) {
    return res.status(200).json({ skipped: "already sent today", dateStr });
  }

  const weekStart = mondayOf(dateStr);

  const [{ data: profiles }, { data: timesheets }, { data: ptos }] = await Promise.all([
    supabase.from("profiles").select("id,name,email"),
    supabase.from("timesheets").select("id,employee_id,status").eq("week_start", weekStart),
    supabase.from("pto_requests").select("employee_id,start_date,end_date").eq("status", "approved"),
  ]);

  const timesheetByEmp = new Map((timesheets || []).map(t => [t.employee_id, t]));
  const timesheetIds = (timesheets || []).map(t => t.id);

  let entriesToday = [];
  if (timesheetIds.length) {
    const { data } = await supabase.from("timesheet_entries")
      .select("timesheet_id,reg_hours,ot_hours,dt_hours")
      .eq("day_name", weekday)
      .in("timesheet_id", timesheetIds);
    entriesToday = data || [];
  }
  const loggedTimesheetIds = new Set(
    entriesToday
      .filter(e => (parseFloat(e.reg_hours) || 0) + (parseFloat(e.ot_hours) || 0) + (parseFloat(e.dt_hours) || 0) > 0)
      .map(e => e.timesheet_id)
  );

  const onPtoToday = new Set(
    (ptos || []).filter(p => p.start_date <= dateStr && dateStr <= p.end_date).map(p => p.employee_id)
  );

  const toRemind = (profiles || []).filter(p => {
    if (!p.email || onPtoToday.has(p.id)) return false;
    const ts = timesheetByEmp.get(p.id);
    if (ts && (ts.status === "submitted" || ts.status === "approved")) return false;
    if (ts && loggedTimesheetIds.has(ts.id)) return false;
    return true;
  });

  const results = [];
  for (const emp of toRemind) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.REMINDER_FROM_EMAIL,
          to: emp.email,
          subject: "Reminder: log today's hours — BeardONE Timesheet",
          text: `Hi ${emp.name || ""},\n\nLooks like you haven't logged your hours for today yet. Please take a minute to fill in your BeardONE timesheet.\n\n— BeardONE Timesheet Platform`,
        }),
      });
      results.push({ email: emp.email, ok: r.ok, status: r.status });
    } catch (err) {
      results.push({ email: emp.email, ok: false, error: err.message });
    }
  }

  await supabase.from("app_settings").upsert({ key: "reminder_last_sent_date", value: dateStr }, { onConflict: "key" });

  return res.status(200).json({ dateStr, remindedCount: toRemind.length, results });
};
