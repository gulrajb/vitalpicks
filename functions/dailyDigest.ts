import { createClient } from "@base44/sdk";

const base44 = createClient();

interface AnalyticsData {
  visitors: number;
  sessions: number;
  pageviews: number;
  topPages: Array<{ page: string; views: number }>;
  bounceRate: number;
  avgSessionDuration: number;
  countries: Array<{ country: string; users: number }>;
}

async function getGoogleAnalyticsData(): Promise<AnalyticsData> {
  try {
    const { accessToken } = await base44.asServiceRole.connectors.getConnection(
      "google_analytics"
    );

    // Get property ID from GA
    const propertyId = "465363370"; // You'll need to update this with your actual GA4 property ID

    // Yesterday's date range
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateStr = yesterday.toISOString().split("T")[0];

    // Fetch GA4 data
    const gaResponse = await fetch(
      `https://analyticsreporting.googleapis.com/v4/reports:batchGet`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reportRequests: [
            {
              viewId: propertyId,
              dateRanges: [
                {
                  startDate: dateStr,
                  endDate: dateStr,
                },
              ],
              metrics: [
                { expression: "ga:users" },
                { expression: "ga:sessions" },
                { expression: "ga:pageviews" },
                { expression: "ga:bounceRate" },
                { expression: "ga:avgSessionDuration" },
              ],
              dimensions: [{ name: "ga:pagePath" }, { name: "ga:country" }],
              orderBys: [
                {
                  fieldName: "ga:pageviews",
                  sortOrder: "DESCENDING",
                },
              ],
              pageSize: 25,
            },
          ],
        }),
      }
    );

    const gaData = await gaResponse.json();

    // Parse response
    const report = gaData.reports[0];
    const totals = report.data.totals[0];
    const rows = report.data.rows || [];

    const visitors = parseInt(totals.values[0]) || 0;
    const sessions = parseInt(totals.values[1]) || 0;
    const pageviews = parseInt(totals.values[2]) || 0;
    const bounceRate = parseFloat(totals.values[3]).toFixed(1) || "0";
    const avgSessionDuration = Math.round(
      parseFloat(totals.values[4]) * 100
    ) / 100;

    // Top pages
    const topPages = rows.slice(0, 5).map((row: any) => ({
      page: row.dimensions[0],
      views: parseInt(row.metrics[0].values[2]),
    }));

    // Countries
    const countryMap: Record<string, number> = {};
    rows.forEach((row: any) => {
      const country = row.dimensions[1];
      const views = parseInt(row.metrics[0].values[0]);
      countryMap[country] = (countryMap[country] || 0) + views;
    });

    const countries = Object.entries(countryMap)
      .map(([country, users]) => ({ country, users }))
      .sort((a, b) => b.users - a.users)
      .slice(0, 5);

    return {
      visitors,
      sessions,
      pageviews,
      topPages,
      bounceRate: parseFloat(bounceRate),
      avgSessionDuration,
      countries,
    };
  } catch (error) {
    console.error("GA fetch error:", error);
    return {
      visitors: 0,
      sessions: 0,
      pageviews: 0,
      topPages: [],
      bounceRate: 0,
      avgSessionDuration: 0,
      countries: [],
    };
  }
}

async function sendDigestEmail(data: AnalyticsData, email: string) {
  const { accessToken } = await base44.asServiceRole.connectors.getConnection(
    "gmail"
  );

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const topPagesHtml = data.topPages
    .map(
      (p, i) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #eee">${i + 1}. ${p.page}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right"><strong>${p.views}</strong></td></tr>`
    )
    .join("");

  const countriesHtml = data.countries
    .map(
      (c) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #eee">${c.country}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right"><strong>${c.users}</strong></td></tr>`
    )
    .join("");

  const htmlBody = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
  <div style="background: linear-gradient(135deg, #134f2b, #1a6b3a); color: white; padding: 28px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 28px;">VitalPicks Daily Report</h1>
    <p style="margin: 8px 0 0 0; opacity: 0.9;">${dateStr}</p>
  </div>
  
  <div style="background: white; padding: 28px; border: 1px solid #e2ece5; border-top: none;">
    
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 28px;">
      <div style="background: #e8f5ee; padding: 16px; border-radius: 8px; text-align: center;">
        <div style="font-size: 32px; font-weight: 900; color: #1a6b3a;">${data.visitors}</div>
        <div style="font-size: 12px; color: #5a6672; font-weight: 600; margin-top: 4px;">VISITORS</div>
      </div>
      <div style="background: #e3f2fd; padding: 16px; border-radius: 8px; text-align: center;">
        <div style="font-size: 32px; font-weight: 900; color: #1565c0;">${data.sessions}</div>
        <div style="font-size: 12px; color: #5a6672; font-weight: 600; margin-top: 4px;">SESSIONS</div>
      </div>
      <div style="background: #fff8e1; padding: 16px; border-radius: 8px; text-align: center;">
        <div style="font-size: 32px; font-weight: 900; color: #f57f17;">${data.pageviews}</div>
        <div style="font-size: 12px; color: #5a6672; font-weight: 600; margin-top: 4px;">PAGEVIEWS</div>
      </div>
    </div>

    <h2 style="font-size: 18px; font-weight: 800; margin: 24px 0 12px; color: #1a6b3a;">📊 Key Metrics</h2>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <tr>
        <td style="padding: 8px;">Bounce Rate:</td>
        <td style="padding: 8px; text-align: right; font-weight: 600;">${data.bounceRate}%</td>
      </tr>
      <tr style="background: #f7faf8;">
        <td style="padding: 8px;">Avg. Session Duration:</td>
        <td style="padding: 8px; text-align: right; font-weight: 600;">${data.avgSessionDuration}s</td>
      </tr>
    </table>

    <h2 style="font-size: 18px; font-weight: 800; margin: 24px 0 12px; color: #1a6b3a;">🏆 Top 5 Pages</h2>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
      ${topPagesHtml || '<tr><td style="padding: 8px; color: #999;">No data yet</td></tr>'}
    </table>

    <h2 style="font-size: 18px; font-weight: 800; margin: 24px 0 12px; color: #1a6b3a;">🌍 Top Countries</h2>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
      ${countriesHtml || '<tr><td style="padding: 8px; color: #999;">No data yet</td></tr>'}
    </table>

    <div style="background: #f0a500; color: white; padding: 16px; border-radius: 8px; margin-top: 24px;">
      <strong>💡 Tip:</strong> New content is published daily via automation. Check Google Search Console to track index status and submitting new URLs.
    </div>

    <p style="font-size: 12px; color: #999; margin-top: 24px; text-align: center;">
      This is an automated report from VitalPicks. View your full analytics at <a href="https://analytics.google.com" style="color: #1a6b3a;">analytics.google.com</a>
    </p>
  </div>
</div>
  `;

  const message = {
    raw: Buffer.from(
      `From: noreply@vitalpicks.org\r\nTo: ${email}\r\nSubject: VitalPicks Daily Report - ${dateStr}\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${htmlBody}`
    ).toString("base64"),
  };

  await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });
}

export default async function handler(req: Request) {
  try {
    const data = await getGoogleAnalyticsData();
    await sendDigestEmail(data, "gulrajb@gmail.com");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Daily digest sent",
        data: {
          visitors: data.visitors,
          sessions: data.sessions,
          pageviews: data.pageviews,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Daily digest error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
