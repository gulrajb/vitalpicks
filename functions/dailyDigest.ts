import { createClient } from "/app/node_modules/@base44/sdk/dist/index.js";

export default async function handler(req: Request): Promise<Response> {
  try {
    const base44 = createClient({
      appId: process.env.BASE44_APP_ID,
      token: process.env.BASE44_SERVICE_TOKEN,
      serverUrl: process.env.BASE44_API_URL,
    });

    const { accessToken: gaToken } = await base44.asServiceRole.connectors.getConnection("google_analytics");
    const { accessToken: gmailToken } = await base44.asServiceRole.connectors.getConnection("gmail");

    if (!gaToken || !gmailToken) {
      return new Response(
        JSON.stringify({ error: "Missing GA or Gmail authorization" }),
        { status: 401 }
      );
    }

    // Get GA4 property ID
    const propsRes = await fetch(
      "https://www.googleapis.com/analytics/admin/v1beta/properties",
      { headers: { Authorization: `Bearer ${gaToken}` } }
    );

    if (!propsRes.ok) {
      throw new Error(`GA properties list failed: ${propsRes.statusText}`);
    }

    const propsData = await propsRes.json() as any;
    const vitalpicksProperty = propsData.properties?.find((p: any) =>
      p.displayName?.toLowerCase().includes("vitalpicks")
    );

    if (!vitalpicksProperty) {
      return new Response(
        JSON.stringify({ error: "VitalPicks property not found in GA4." }),
        { status: 404 }
      );
    }

    const propertyId = vitalpicksProperty.name.split("/")[1];

    // Query yesterday's data
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0];

    const reportRes = await fetch(
      `https://www.googleapis.com/analytics/data/v1beta/properties/${propertyId}:runReport`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${gaToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: dateStr, endDate: dateStr }],
          metrics: [
            { name: "activeUsers" },
            { name: "sessions" },
            { name: "screenPageViews" },
            { name: "bounceRate" },
            { name: "averageSessionDuration" },
          ],
          dimensions: [{ name: "pagePath" }, { name: "country" }],
          orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
          limit: 100,
        }),
      }
    );

    if (!reportRes.ok) {
      throw new Error(`GA report failed: ${reportRes.statusText}`);
    }

    const reportData = await reportRes.json() as any;

    let totalUsers = 0, totalSessions = 0, totalPageviews = 0;
    let avgBounceRate = 0, avgSessionDuration = 0;
    const pageStats: Array<{ page: string; views: number; users: number }> = [];
    const countryStats: Array<{ country: string; views: number }> = [];

    if (reportData.rows) {
      reportData.rows.forEach((row: any) => {
        const users = parseInt(row.metricValues[0].value || "0");
        const sessions = parseInt(row.metricValues[1].value || "0");
        const views = parseInt(row.metricValues[2].value || "0");
        const bounce = parseFloat(row.metricValues[3].value || "0");
        const duration = parseFloat(row.metricValues[4].value || "0");

        totalUsers += users;
        totalSessions += sessions;
        totalPageviews += views;
        avgBounceRate += bounce;
        avgSessionDuration += duration;

        const page = row.dimensionValues[0].value;
        const country = row.dimensionValues[1].value;

        const existing = pageStats.find((p) => p.page === page);
        if (existing) {
          existing.views += views;
          existing.users += users;
        } else {
          pageStats.push({ page, views, users });
        }

        const existingCountry = countryStats.find((c) => c.country === country);
        if (existingCountry) {
          existingCountry.views += views;
        } else {
          countryStats.push({ country, views });
        }
      });

      pageStats.sort((a, b) => b.views - a.views);
      countryStats.sort((a, b) => b.views - a.views);

      if (reportData.rows.length > 0) {
        avgBounceRate /= reportData.rows.length;
        avgSessionDuration /= reportData.rows.length;
      }
    }

    const top5Pages = pageStats.slice(0, 5);
    const top3Countries = countryStats.slice(0, 3);

    const emailHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #333; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; padding: 32px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #1a73e8; margin: 0 0 24px 0; font-size: 24px; }
    .stat-row { display: flex; gap: 16px; margin-bottom: 20px; }
    .stat-box { flex: 1; background: #f9f9f9; padding: 16px; border-radius: 6px; border-left: 4px solid #1a73e8; }
    .stat-label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-value { font-size: 28px; font-weight: bold; color: #1a73e8; margin-top: 6px; }
    .section { margin-top: 32px; }
    .section h2 { font-size: 16px; color: #333; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 1px; }
    .table { width: 100%; border-collapse: collapse; }
    .table th { background: #f0f0f0; padding: 10px 12px; text-align: left; font-size: 12px; color: #666; font-weight: 600; border-bottom: 2px solid #ddd; }
    .table td { padding: 10px 12px; border-bottom: 1px solid #eee; }
    .footer { margin-top: 24px; padding-top: 24px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center; }
    a { color: #1a73e8; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 VitalPicks Daily Analytics — ${dateStr}</h1>
    
    <div class="stat-row">
      <div class="stat-box">
        <div class="stat-label">Visitors</div>
        <div class="stat-value">${totalUsers}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Sessions</div>
        <div class="stat-value">${totalSessions}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Pageviews</div>
        <div class="stat-value">${totalPageviews}</div>
      </div>
    </div>

    ${totalUsers === 0 ? `<p style="background: #fff3cd; padding: 12px; border-radius: 4px; color: #856404;">
      No visitors yet — that's normal! Google is still crawling and indexing your 192+ pages. Real traffic typically begins 2-4 weeks after indexing. Keep publishing! 🚀
    </p>` : `
    <div class="stat-row">
      <div class="stat-box">
        <div class="stat-label">Bounce Rate</div>
        <div class="stat-value">${avgBounceRate.toFixed(1)}%</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Avg Duration</div>
        <div class="stat-value">${(avgSessionDuration / 60).toFixed(1)}m</div>
      </div>
    </div>`}

    <div class="section">
      <h2>Top 5 Pages</h2>
      <table class="table">
        <thead><tr><th>Page</th><th style="text-align: right;">Views</th></tr></thead>
        <tbody>
          ${top5Pages.map((p) => `<tr><td style="font-size: 12px;"><code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">${p.page}</code></td><td style="text-align: right; font-weight: 600;">${p.views}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Top Countries</h2>
      <table class="table">
        <thead><tr><th>Country</th><th style="text-align: right;">Pageviews</th></tr></thead>
        <tbody>
          ${top3Countries.map((c) => `<tr><td>${c.country || "Unknown"}</td><td style="text-align: right; font-weight: 600;">${c.views}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>

    <div class="footer">
      <p>📈 Full stats: <a href="https://analytics.google.com">analytics.google.com</a></p>
      <p>🌐 Site: <a href="https://vitalpicks.org">vitalpicks.org</a></p>
    </div>
  </div>
</body>
</html>`;

    const emailSubject = `📊 VitalPicks Daily Report — ${dateStr}`;
    const emailBody = `From: vitalpicks@gmail.com\nTo: gulrajb@gmail.com\nSubject: ${emailSubject}\nContent-Type: text/html; charset=utf-8\n\n${emailHtml}`;

    const base64Email = Buffer.from(emailBody)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    const sendRes = await fetch(
      "https://www.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${gmailToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: base64Email }),
      }
    );

    if (!sendRes.ok) {
      const errText = await sendRes.text();
      throw new Error(`Gmail failed: ${sendRes.statusText} - ${errText}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Digest sent: ${totalUsers} visitors, ${totalSessions} sessions, ${totalPageviews} views`,
      }),
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Unknown error" }),
      { status: 500 }
    );
  }
}
