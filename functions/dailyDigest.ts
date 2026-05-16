import { createClient } from "@base44/sdk";

interface AnalyticsResponse {
  rows?: Array<Array<string | number>>;
}

export default async function dailyDigest(req: Request) {
  const base44 = createClient({
    appId: process.env.BASE44_APP_ID!,
    token: process.env.BASE44_SERVICE_TOKEN!,
    serverUrl: process.env.BASE44_API_URL!,
  });

  try {
    // Get GA access token
    const { accessToken } = await base44.asServiceRole.connectors.getConnection(
      "google_analytics"
    );

    // Get Gmail access token
    const { accessToken: gmailToken } =
      await base44.asServiceRole.connectors.getConnection("gmail");

    // Calculate yesterday's date
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0];

    // Fetch GA4 data for yesterday
    const gaResponse = await fetch(
      "https://analyticsdata.googleapis.com/v1beta/properties/467087696:runReport",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          dateRanges: [
            {
              startDate: dateStr,
              endDate: dateStr,
            },
          ],
          metrics: [
            { name: "activeUsers" },
            { name: "sessions" },
            { name: "screenPageViews" },
            { name: "bounceRate" },
          ],
          dimensions: [{ name: "pagePath" }],
          orderBys: [
            {
              metric: { metricName: "screenPageViews" },
              desc: true,
            },
          ],
          limit: 5,
        }),
      }
    );

    if (!gaResponse.ok) {
      console.error("GA API error:", gaResponse.status, await gaResponse.text());
      throw new Error(`GA API failed: ${gaResponse.status}`);
    }

    const gaData: AnalyticsResponse = await gaResponse.json();

    // Extract metrics
    let totalUsers = 0,
      totalSessions = 0,
      totalPageviews = 0,
      avgBounceRate = 0;
    const topPages: Array<{ path: string; views: number }> = [];

    if (gaData.rows && gaData.rows.length > 0) {
      gaData.rows.forEach((row) => {
        const pagePath = String(row[0]);
        const users = Number(row[1]) || 0;
        const sessions = Number(row[2]) || 0;
        const pageviews = Number(row[3]) || 0;
        const bounceRate = Number(row[4]) || 0;

        totalUsers += users;
        totalSessions += sessions;
        totalPageviews += pageviews;
        avgBounceRate = bounceRate;

        if (pageviews > 0) {
          topPages.push({
            path: pagePath || "/",
            views: pageviews,
          });
        }
      });
    }

    // Build email content
    const emailBody = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;color:#333;line-height:1.6}h1{color:#1a6b3a}table{border-collapse:collapse;width:100%;margin:20px 0}.stat-row{background:#f5f5f5;padding:12px;margin:10px 0;border-radius:8px}.stat-label{color:#666;font-size:13px}.stat-value{font-size:24px;font-weight:bold;color:#1a6b3a}.top-page{padding:10px;border-bottom:1px solid #eee}.footer{color:#999;font-size:12px;margin-top:30px}</style></head>
<body>
<h1>📊 VitalPicks Daily Report</h1>
<p>Yesterday's performance (${dateStr}):</p>

<div class="stat-row">
  <div class="stat-label">👥 Visitors</div>
  <div class="stat-value">${totalUsers}</div>
</div>

<div class="stat-row">
  <div class="stat-label">🔄 Sessions</div>
  <div class="stat-value">${totalSessions}</div>
</div>

<div class="stat-row">
  <div class="stat-label">📄 Pageviews</div>
  <div class="stat-value">${totalPageviews}</div>
</div>

<div class="stat-row">
  <div class="stat-label">📉 Bounce Rate</div>
  <div class="stat-value">${avgBounceRate.toFixed(1)}%</div>
</div>

<h2>🔝 Top 5 Pages</h2>
${topPages
  .map(
    (p, i) =>
      `<div class="top-page"><strong>#${i + 1}</strong> ${p.path} — ${p.views} views</div>`
  )
  .join("")}

<div class="footer">
  <p>Report generated: ${new Date().toLocaleString()}</p>
  <p><a href="https://vitalpicks.org">Visit VitalPicks →</a></p>
</div>
</body>
</html>
    `.trim();

    // Send email
    const emailHeaders = [
      "From: VitalPicks Bot <no-reply@vitalpicks.org>",
      "To: gulrajb@gmail.com",
      `Subject: 📊 VitalPicks Daily Report - ${dateStr}`,
      "MIME-Version: 1.0",
      'Content-Type: text/html; charset="UTF-8"',
      "",
      emailBody,
    ].join("\r\n");

    const base64Email = Buffer.from(emailHeaders).toString("base64");

    const sendResponse = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gmailToken}`,
        },
        body: JSON.stringify({
          raw: base64Email,
        }),
      }
    );

    if (!sendResponse.ok) {
      console.error("Gmail error:", sendResponse.status, await sendResponse.text());
      throw new Error(`Gmail send failed: ${sendResponse.status}`);
    }

    console.log("✅ Daily digest sent successfully");
    return new Response(
      JSON.stringify({
        success: true,
        message: "Daily digest sent",
        stats: { totalUsers, totalSessions, totalPageviews, topPages },
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500 }
    );
  }
}
