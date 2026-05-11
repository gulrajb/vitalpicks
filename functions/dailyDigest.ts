import { createClientFromRequest } from "@base44/sdk";

const GA_PROPERTY_ID = "477882753"; // vitalpicks.org GA4 property ID
const USER_EMAIL = "gulrajb@gmail.com";

async function dailyDigest(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Get Gmail and GA tokens
    const { accessToken: gmailToken } = await base44.asServiceRole.connectors.getConnection("gmail");
    const { accessToken: gaToken } = await base44.asServiceRole.connectors.getConnection("google_analytics");

    // Calculate yesterday's date range (IST timezone)
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86400000);
    const dateStr = yesterday.toISOString().split("T")[0];

    // Fetch GA4 data for yesterday
    const gaResponse = await fetch("https://analyticsdata.googleapis.com/v1beta/properties/" + GA_PROPERTY_ID + ":runReport", {
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
        ],
        dimensions: [
          { name: "pagePath" },
          { name: "country" },
        ],
        limit: 100,
      }),
    });

    if (!gaResponse.ok) {
      console.error("GA API error:", await gaResponse.text());
      return new Response("GA API error", { status: 500 });
    }

    const gaData = await gaResponse.json();

    // Parse GA response
    let totalUsers = 0,
      totalSessions = 0,
      totalPageviews = 0,
      avgBounceRate = 0;
    const topPages: Array<{ path: string; views: number }> = [];
    const topCountries: { [key: string]: number } = {};

    if (gaData.rows) {
      gaData.rows.forEach((row: any) => {
        const path = row.dimensionValues[0]?.value || "unknown";
        const country = row.dimensionValues[1]?.value || "unknown";
        const users = parseInt(row.metricValues[0]?.value || "0");
        const sessions = parseInt(row.metricValues[1]?.value || "0");
        const pageviews = parseInt(row.metricValues[2]?.value || "0");
        const bounceRate = parseFloat(row.metricValues[3]?.value || "0");

        totalUsers += users;
        totalSessions += sessions;
        totalPageviews += pageviews;
        avgBounceRate = bounceRate;

        if (path !== "/" && path !== "") {
          topPages.push({ path, views: pageviews });
        }
        if (country && country !== "unknown") {
          topCountries[country] = (topCountries[country] || 0) + users;
        }
      });
    }

    topPages.sort((a, b) => b.views - a.views);
    const topCountriesArray = Object.entries(topCountries)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    // Build HTML email
    const emailHTML = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f7faf8;">
        
        <div style="background: linear-gradient(135deg, #134f2b, #1a6b3a); color: white; padding: 30px 20px; border-radius: 12px; text-align: center; margin-bottom: 24px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 900;">💚 VitalPicks Daily Report</h1>
          <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">${dateStr}</p>
        </div>

        <div style="background: white; border-radius: 12px; padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <h2 style="margin: 0 0 20px; font-size: 18px; font-weight: 800; color: #1a1a1a;">📊 Yesterday's Stats</h2>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 24px;">
            <div style="background: #e8f5ee; padding: 16px; border-radius: 10px; text-align: center;">
              <div style="font-size: 24px; font-weight: 900; color: #1a6b3a;">${totalUsers}</div>
              <div style="font-size: 12px; font-weight: 600; color: #5a6672; margin-top: 4px;">Visitors</div>
            </div>
            <div style="background: #e3f2fd; padding: 16px; border-radius: 10px; text-align: center;">
              <div style="font-size: 24px; font-weight: 900; color: #0277bd;">${totalSessions}</div>
              <div style="font-size: 12px; font-weight: 600; color: #5a6672; margin-top: 4px;">Sessions</div>
            </div>
            <div style="background: #fff3e0; padding: 16px; border-radius: 10px; text-align: center;">
              <div style="font-size: 24px; font-weight: 900; color: #f57c00;">${totalPageviews}</div>
              <div style="font-size: 12px; font-weight: 600; color: #5a6672; margin-top: 4px;">Page Views</div>
            </div>
          </div>

          <div style="background: #f7faf8; padding: 12px 16px; border-left: 3px solid #1a6b3a; border-radius: 6px;">
            <div style="font-size: 14px; color: #5a6672;">
              <strong>Bounce Rate:</strong> ${avgBounceRate.toFixed(1)}%
            </div>
          </div>
        </div>

        <div style="background: white; border-radius: 12px; padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <h3 style="margin: 0 0 16px; font-size: 16px; font-weight: 800; color: #1a1a1a;">🔥 Top 5 Pages</h3>
          ${topPages
            .slice(0, 5)
            .map(
              (p, i) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e2ece5;">
              <div>
                <span style="display: inline-block; background: #1a6b3a; color: white; font-weight: 700; font-size: 12px; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; margin-right: 12px;">${i + 1}</span>
                <span style="font-size: 14px; color: #1a1a1a; font-weight: 600;">${p.path.replace("/best-", "").replace(".html", "").replace(/-/g, " ")}</span>
              </div>
              <span style="font-weight: 700; color: #1a6b3a;">${p.views}</span>
            </div>
          `
            )
            .join("")}
        </div>

        <div style="background: white; border-radius: 12px; padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <h3 style="margin: 0 0 16px; font-size: 16px; font-weight: 800; color: #1a1a1a;">🌍 Top Countries</h3>
          ${topCountriesArray
            .map(
              ([country, count]) => `
            <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e2ece5;">
              <span style="font-size: 14px; color: #1a1a1a;">${country}</span>
              <span style="font-weight: 700; color: #1a6b3a;">${count} visitors</span>
            </div>
          `
            )
            .join("")}
        </div>

        <div style="background: #f7faf8; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 20px;">
          <p style="margin: 0; font-size: 13px; color: #5a6672;">
            📈 This report is automatically sent daily at 9am IST<br>
            <a href="https://analytics.google.com" style="color: #1a6b3a; text-decoration: none; font-weight: 600;">View full analytics →</a>
          </p>
        </div>

        <div style="text-align: center; font-size: 12px; color: #999;">
          <p style="margin: 0;">VitalPicks © 2026 • vitalpicks.org</p>
        </div>

      </div>
    `;

    // Send email via Gmail API
    const message = {
      raw: btoa(
        `To: ${USER_EMAIL}\r\n` +
          `Subject: 📊 VitalPicks Daily Report - ${dateStr}\r\n` +
          `Content-Type: text/html; charset="UTF-8"\r\n` +
          `\r\n` +
          emailHTML
      ),
    };

    const sendResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${gmailToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!sendResponse.ok) {
      console.error("Gmail error:", await sendResponse.text());
      return new Response("Failed to send email", { status: 500 });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Daily digest sent to ${USER_EMAIL}`,
        stats: { visitors: totalUsers, sessions: totalSessions, pageviews: totalPageviews },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in dailyDigest:", error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
}

export default dailyDigest;
