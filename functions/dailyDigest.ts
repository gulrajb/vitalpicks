import { createClient } from "@base44/sdk";

const base44 = createClient();

interface AnalyticsData {
  visitors: number;
  sessions: number;
  pageviews: number;
  avgSessionDuration: string;
  bounceRate: string;
  topPages: Array<{ page: string; views: number }>;
  topCountries: Array<{ country: string; users: number }>;
}

export default async function dailyDigest(req: Request) {
  try {
    const { accessToken: gaToken } = await base44.asServiceRole.connectors.getConnection(
      "google_analytics"
    );
    const { accessToken: gmailToken } = await base44.asServiceRole.connectors.getConnection(
      "gmail"
    );

    // Get yesterday's date
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0];

    console.log(`Fetching GA data for ${dateStr}...`);

    // GA4 Property ID for vitalpicks.org - found in GA4 Admin > Property details
    const propertyId = "467267425";

    const analyticsData = await fetchGAData(gaToken, propertyId, dateStr);

    // Build email
    const emailContent = buildEmailHTML(analyticsData, dateStr);

    // Send email via Gmail
    await sendEmail(gmailToken, emailContent);

    console.log("Email sent successfully");
    return new Response(
      JSON.stringify({ success: true, message: "Daily digest sent to gulrajb@gmail.com" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in dailyDigest:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function fetchGAData(
  accessToken: string,
  propertyId: string,
  dateStr: string
): Promise<AnalyticsData> {
  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
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
          { name: "averageSessionDuration" },
          { name: "bounceRate" },
        ],
        dimensions: [{ name: "pagePath" }, { name: "country" }],
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error("GA API error:", data);
    throw new Error(`GA API failed: ${data.error?.message || "Unknown error"}`);
  }

  let totalUsers = 0;
  let totalSessions = 0;
  let totalPageviews = 0;
  let avgDuration = "0s";
  let bounceRate = "0%";
  const pages: { [key: string]: number } = {};
  const countries: { [key: string]: number } = {};

  if (data.rows && data.rows.length > 0) {
    data.rows.forEach(
      (row: {
        dimensionValues: Array<{ value: string }>;
        metricValues: Array<{ value: string }>;
      }) => {
        const pagePath = row.dimensionValues[0]?.value || "/";
        const country = row.dimensionValues[1]?.value || "Unknown";
        const users = parseInt(row.metricValues[0]?.value || "0");
        const sessions = parseInt(row.metricValues[1]?.value || "0");
        const views = parseInt(row.metricValues[2]?.value || "0");
        const duration = parseFloat(row.metricValues[3]?.value || "0");
        const bounce = parseFloat(row.metricValues[4]?.value || "0");

        totalUsers += users;
        totalSessions += sessions;
        totalPageviews += views;
        avgDuration = `${Math.round(duration)}s`;
        bounceRate = `${bounce.toFixed(1)}%`;

        if (views > 0) {
          pages[pagePath] = (pages[pagePath] || 0) + views;
        }
        if (users > 0) {
          countries[country] = (countries[country] || 0) + users;
        }
      }
    );
  }

  const topPages = Object.entries(pages)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([page, views]) => ({ page: page || "/", views }));

  const topCountries = Object.entries(countries)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([country, users]) => ({ country, users }));

  return {
    visitors: totalUsers,
    sessions: totalSessions,
    pageviews: totalPageviews,
    avgSessionDuration: avgDuration,
    bounceRate: bounceRate,
    topPages: topPages.length > 0 ? topPages : [{ page: "/", views: 0 }],
    topCountries: topCountries.length > 0 ? topCountries : [{ country: "Not tracked yet", users: 0 }],
  };
}

function buildEmailHTML(data: AnalyticsData, dateStr: string): string {
  const yesterday = new Date(dateStr);
  const dateFormatted = yesterday.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const topPagesHTML = data.topPages
    .map(
      (p, i) =>
        `<tr style="border-bottom:1px solid #e0e0e0"><td style="padding:10px;text-align:center;font-weight:bold">${i + 1}</td><td style="padding:10px">${p.page}</td><td style="padding:10px;text-align:right;font-weight:bold">${p.views}</td></tr>`
    )
    .join("");

  const topCountriesHTML = data.topCountries
    .map(
      (c, i) =>
        `<tr style="border-bottom:1px solid #e0e0e0"><td style="padding:10px">${c.country}</td><td style="padding:10px;text-align:right;font-weight:bold">${c.users}</td></tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
    
    <div style="background:linear-gradient(135deg,#1a6b3a,#2d9b5a);color:#fff;padding:30px;text-align:center">
      <h1 style="margin:0;font-size:24px">📊 VitalPicks Daily Report</h1>
      <p style="margin:8px 0 0;opacity:0.9">${dateFormatted}</p>
    </div>

    <div style="padding:24px;display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div style="background:#f0f9f4;border-radius:8px;padding:16px;text-align:center;border-left:4px solid #1a6b3a">
        <div style="font-size:12px;color:#5a6672;text-transform:uppercase;font-weight:700;margin-bottom:8px">Visitors</div>
        <div style="font-size:32px;font-weight:900;color:#1a6b3a">${data.visitors}</div>
      </div>
      <div style="background:#f0f9f4;border-radius:8px;padding:16px;text-align:center;border-left:4px solid #1a6b3a">
        <div style="font-size:12px;color:#5a6672;text-transform:uppercase;font-weight:700;margin-bottom:8px">Sessions</div>
        <div style="font-size:32px;font-weight:900;color:#1a6b3a">${data.sessions}</div>
      </div>
      <div style="background:#f0f9f4;border-radius:8px;padding:16px;text-align:center;border-left:4px solid #1a6b3a">
        <div style="font-size:12px;color:#5a6672;text-transform:uppercase;font-weight:700;margin-bottom:8px">Pageviews</div>
        <div style="font-size:32px;font-weight:900;color:#1a6b3a">${data.pageviews}</div>
      </div>
      <div style="background:#f0f9f4;border-radius:8px;padding:16px;text-align:center;border-left:4px solid #1a6b3a">
        <div style="font-size:12px;color:#5a6672;text-transform:uppercase;font-weight:700;margin-bottom:8px">Bounce Rate</div>
        <div style="font-size:32px;font-weight:900;color:#1a6b3a">${data.bounceRate}</div>
      </div>
    </div>

    <div style="padding:24px;border-top:1px solid #e0e0e0">
      <h2 style="margin:0 0 16px;font-size:16px;color:#1a1a1a">🏆 Top Pages</h2>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#f0f9f4;border-bottom:2px solid #1a6b3a">
            <th style="padding:10px;text-align:center;font-weight:700;color:#1a6b3a;width:30px">#</th>
            <th style="padding:10px;text-align:left;font-weight:700;color:#1a6b3a">Page</th>
            <th style="padding:10px;text-align:right;font-weight:700;color:#1a6b3a">Views</th>
          </tr>
        </thead>
        <tbody>
          ${topPagesHTML}
        </tbody>
      </table>
    </div>

    <div style="padding:24px;border-top:1px solid #e0e0e0">
      <h2 style="margin:0 0 16px;font-size:16px;color:#1a1a1a">🌍 Top Countries</h2>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#f0f9f4;border-bottom:2px solid #1a6b3a">
            <th style="padding:10px;text-align:left;font-weight:700;color:#1a6b3a">Country</th>
            <th style="padding:10px;text-align:right;font-weight:700;color:#1a6b3a">Users</th>
          </tr>
        </thead>
        <tbody>
          ${topCountriesHTML}
        </tbody>
      </table>
    </div>

    <div style="padding:24px;text-align:center;background:#f9faf8;border-top:1px solid #e0e0e0">
      <p style="margin:0;font-size:13px;color:#5a6672">
        This report is generated automatically every day at 9:00 AM IST.
        <br><a href="https://analytics.google.com" style="color:#1a6b3a;text-decoration:none">View full analytics →</a>
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

async function sendEmail(accessToken: string, htmlContent: string): Promise<void> {
  const to = "gulrajb@gmail.com";
  const subject = `VitalPicks Daily Report - ${new Date().toLocaleDateString()}`;

  const message = `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/html; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n${Buffer.from(htmlContent).toString("base64")}`;

  const encodedMessage = Buffer.from(message).toString("base64");

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      raw: encodedMessage,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Gmail API failed: ${error.error?.message || "Unknown error"}`);
  }
}
