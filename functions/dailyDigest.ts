import { createClient } from "@base44/sdk";

export default async function dailyDigest(req: Request) {
  const base44 = createClient({
    appId: process.env.BASE44_APP_ID!,
    token: process.env.BASE44_SERVICE_TOKEN!,
    serverUrl: process.env.BASE44_API_URL!,
  });

  try {
    // Get GA access token
    const { accessToken: gaToken } = await base44.asServiceRole.connectors.getConnection("google_analytics");
    
    // Get yesterday's date range (IST timezone)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const istNow = new Date(now.getTime() + istOffset);
    const yesterday = new Date(istNow);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const dateStr = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Fetch GA4 data via the Data API
    const gaResponse = await fetch("https://analyticsdata.googleapis.com/v1beta/properties/414626949:runReport", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${gaToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: dateStr, endDate: dateStr }],
        metrics: [
          { name: "activeUsers" },
          { name: "sessions" },
          { name: "screenPageViews" },
        ],
        dimensions: [{ name: "pagePath" }, { name: "country" }],
        limit: "100",
      }),
    });

    let stats = {
      visitors: 0,
      sessions: 0,
      pageviews: 0,
      topPages: [] as Array<{ path: string; views: number }>,
      topCountries: [] as Array<{ country: string; users: number }>,
    };

    if (gaResponse.ok) {
      const gaData = await gaResponse.json() as any;
      
      if (gaData.totals && gaData.totals[0]) {
        const total = gaData.totals[0];
        stats.visitors = parseInt(total.metricValues?.[0]?.value || "0") || 0;
        stats.sessions = parseInt(total.metricValues?.[1]?.value || "0") || 0;
        stats.pageviews = parseInt(total.metricValues?.[2]?.value || "0") || 0;
      }

      // Extract top pages
      if (gaData.rows) {
        const pageMap = new Map<string, number>();
        const countryMap = new Map<string, number>();

        for (const row of gaData.rows) {
          const path = row.dimensionValues?.[0]?.value || "unknown";
          const country = row.dimensionValues?.[1]?.value || "unknown";
          const views = parseInt(row.metricValues?.[2]?.value || "0") || 0;
          const users = parseInt(row.metricValues?.[0]?.value || "0") || 0;

          pageMap.set(path, (pageMap.get(path) || 0) + views);
          countryMap.set(country, (countryMap.get(country) || 0) + users);
        }

        stats.topPages = Array.from(pageMap)
          .map(([path, views]) => ({ path, views }))
          .sort((a, b) => b.views - a.views)
          .slice(0, 5);

        stats.topCountries = Array.from(countryMap)
          .map(([country, users]) => ({ country, users }))
          .sort((a, b) => b.users - a.users)
          .slice(0, 5);
      }
    }

    // Build HTML email
    const date = yesterday.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    
    let topPagesHtml = stats.topPages
      .map((p, i) => `<tr><td>${i + 1}</td><td>${p.path}</td><td>${p.views}</td></tr>`)
      .join("");
    
    let topCountriesHtml = stats.topCountries
      .map((c) => `<tr><td>${c.country}</td><td>${c.users}</td></tr>`)
      .join("");

    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
body{font-family:sans-serif;color:#333;max-width:600px;margin:0 auto}
h1{color:#1a6b3a}
.stat{display:inline-block;margin:10px 15px 10px 0;padding:15px;background:#f0f9f4;border-radius:8px;min-width:120px}
.stat-num{font-size:24px;font-weight:bold;color:#1a6b3a}
.stat-label{font-size:12px;color:#666;margin-top:5px;text-transform:uppercase}
table{width:100%;border-collapse:collapse;margin:20px 0}
th{background:#1a6b3a;color:#fff;padding:10px;text-align:left}
td{padding:10px;border-bottom:1px solid #eee}
tr:hover{background:#f9f9f9}
.footer{font-size:12px;color:#999;margin-top:30px;border-top:1px solid #eee;padding-top:20px}
</style></head>
<body>
<h1>🥗 VitalPicks Daily Report</h1>
<p><strong>${date}</strong></p>

<div>
  <div class="stat">
    <div class="stat-num">${stats.visitors}</div>
    <div class="stat-label">Visitors</div>
  </div>
  <div class="stat">
    <div class="stat-num">${stats.sessions}</div>
    <div class="stat-label">Sessions</div>
  </div>
  <div class="stat">
    <div class="stat-num">${stats.pageviews}</div>
    <div class="stat-label">Pageviews</div>
  </div>
</div>

<h3>📊 Top 5 Pages</h3>
<table>
  <thead><tr><th>#</th><th>Page</th><th>Views</th></tr></thead>
  <tbody>${topPagesHtml || "<tr><td colspan=3>No data</td></tr>"}</tbody>
</table>

<h3>🌍 Top Countries</h3>
<table>
  <thead><tr><th>Country</th><th>Users</th></tr></thead>
  <tbody>${topCountriesHtml || "<tr><td colspan=2>No data</td></tr>"}</tbody>
</table>

<div class="footer">
  <p>This is an automated daily report from your VitalPicks analytics.</p>
  <p><a href="https://analytics.google.com">View full analytics →</a></p>
</div>
</body>
</html>
    `.trim();

    // Send via Gmail
    const { accessToken: gmailToken } = await base44.asServiceRole.connectors.getConnection("gmail");
    
    // Build RFC 2822 MIME message
    const message = [
      `From: vitalpicks-bot@example.com`,
      `To: gulrajb@gmail.com`,
      `Subject: VitalPicks Daily Report - ${date}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=utf-8`,
      ``,
      emailHtml,
    ].join("\r\n");

    const encodedMessage = Buffer.from(message).toString("base64");

    const sendResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${gmailToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encodedMessage }),
    });

    if (!sendResponse.ok) {
      const error = await sendResponse.json();
      throw new Error(`Gmail send failed: ${JSON.stringify(error)}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Daily digest sent to gulrajb@gmail.com - ${stats.visitors} visitors, ${stats.pageviews} pageviews`,
        stats,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
