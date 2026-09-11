const { createClient } = require("@supabase/supabase-js");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const missingEnv = ["REACT_APP_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY", "REMINDER_FROM_EMAIL"]
    .filter(k => !process.env[k]);
  if (missingEnv.length) {
    return res.status(500).json({ error: `Missing env vars: ${missingEnv.join(", ")}` });
  }

  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing bearer token" });

  const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) return res.status(401).json({ error: "Invalid session" });

  const { data: requester } = await supabase.from("profiles").select("is_manager").eq("id", userData.user.id).maybeSingle();
  if (!requester?.is_manager) {
    return res.status(403).json({ error: "Manager access required" });
  }

  const { weekEndKey, timesheetsBase64, dailyReportBase64 } = req.body || {};
  if (!weekEndKey || !timesheetsBase64 || !dailyReportBase64) {
    return res.status(400).json({ error: "weekEndKey, timesheetsBase64, and dailyReportBase64 are required" });
  }

  const { data: settingsRows } = await supabase.from("app_settings").select("key,value").in("key", ["payroll_email", "manager_email"]);
  const settings = {};
  (settingsRows || []).forEach(s => { settings[s.key] = s.value; });

  const parseRecipients = v => (v || "").split(";").map(s => s.trim()).filter(Boolean);

  const sendEmail = async ({ to, subject, text, filename, content }) => {
    if (!to.length) return { skipped: "no recipient configured in Settings" };
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.REMINDER_FROM_EMAIL,
          to,
          subject,
          text,
          attachments: [{ filename, content }],
        }),
      });
      if (r.ok) return { ok: true, status: r.status, to };
      let detail;
      try { detail = (await r.json())?.message; } catch { detail = r.statusText; }
      return { ok: false, status: r.status, to, error: detail };
    } catch (err) {
      return { ok: false, to, error: err.message };
    }
  };

  const [payroll, manager] = await Promise.all([
    sendEmail({
      to: parseRecipients(settings.payroll_email),
      subject: `BeardONE Timesheets — Week Ending ${weekEndKey}`,
      text: `Attached: submitted timesheets for the week ending ${weekEndKey}, one tab per employee.`,
      filename: `BIS_VDC_Timesheets_${weekEndKey}.xlsx`,
      content: timesheetsBase64,
    }),
    sendEmail({
      to: parseRecipients(settings.manager_email),
      subject: `BeardONE Daily Reports — Week Ending ${weekEndKey}`,
      text: `Attached: daily reports for all employees for the week ending ${weekEndKey}.`,
      filename: `BIS_VDC_DailyReports_${weekEndKey}.xlsx`,
      content: dailyReportBase64,
    }),
  ]);

  return res.status(200).json({ payroll, manager });
};
