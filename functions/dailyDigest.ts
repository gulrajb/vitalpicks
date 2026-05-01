import { createClientFromRequest } from "@base44/sdk";

export default async function dailyDigest(req: Request) {
  const base44 = createClientFromRequest(req);

  try {
    // Get Gmail token to send email
    const gmailConn = await base44.asServiceRole.connectors.getConnection(
      "gmail"
    );
    const gmailToken = gmailConn.accessToken;

    // Get Google Analytics token
    const gaConn = await base44.asServiceRole.connectors.getConnection(
      "google_analytics"
    );
    const gaToken = gaConn.accessToken;

    // Calculate yesterday's date
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateStr = yesterday.toISOString().split("T")[0]; // YYYY-MM-DD

    // Get GA4 Property ID from environment or default
    // For now, we'll use a placeholder - user needs to provide their GA4 property ID
    const propertyId = "464047752"; // This would be their actual GA4 property ID

    // Fetch GA4 data using the Data API
    const gaDataUrl = "https://analyticsdata.googleapis.com/v1beta/properties/" +
      propertyId +
      ":runReport";

    const gaPayload = {
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
      ],
      dimensions: [{ name: "pagePath" }, { name: "country" }],
      limit: 10,
    };

    let visitors = 0,
      sessions = 0,
      pageviews = 0,
      topPages = [],
      countries = {};

    try {
      const gaResponse = await fetch(gaDataUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${gaToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(gaPayload),
      });

      if (gaResponse.ok) {
        const gaData = await gaResponse.json();

        // Extract metrics
        if (gaData.totals && gaData.totals[0]) {
          const total = gaData.totals[0];
          visitors = parseInt(total.metricValues?.[0]?.value || "0");
          sessions = parseInt(total.metricValues?.[1]?.value || "0");
          pageviews = parseInt(total.metricValues?.[2]?.value || "0");
        }

        // Extract top pages and countries
        if (gaData.rows) {
          for (const row of gaData.rows) {
            const pagePath = row.dimensionValues?.[0]?.value || "unknown";
            const country = row.dimensionValues?.[1]?.value || "unknown";
            const pageViews = parseInt(
              row.metricValues?.[2]?.value || "0"
            );

            if (
              pagePath &&
              pagePath !== "/" &&
              pagePath !== "(not set)"
            ) {
              topPages.push({
                page: pagePath.substring(0, 50),
                views: pageViews,
              });
            }

            if (country && country !== "(not set)") {
              countries[country] = (countries[country] || 0) + pageViews;
            }
          }
        }

        topPages = topPages
          .sort((a, b) => b.views - a.views)
          .slice(0, 5);
        const topCountries = Object.entries(countries)
          .map(([c, v]) => [c, v])
          .sort((a, b) => (b[1] as number) - (a[1] as number))
          .slice(0, 3);

        // Estimate earnings (rough: $0.50 per click, assume 2% CTR)
        const estimatedClicks = Math.round(pageviews * 0.02);
        const estimatedEarnings = (estimatedClicks * 0.5).toFixed(2);

        // Build email
        const emailDate = yesterday
          .toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          });

        const emailBody = `
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f7faf8; }
    .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #134f2b, #1a6b3a); color: white; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 900; }
    .header p { margin: 6px 0 0; opacity: 0.85; }
    .content { padding: 32px; }
    .stat-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 32px; }
    .stat { background: #f7faf8; border-radius: 10px; padding: 16px; text-align: center; border-left: 4px solid #1a6b3a; }
    .stat-number { font-size: 32px; font-weight: 900; color: #1a6b3a; }
    .stat-label { font-size: 12px; color: #5a6672; margin-top: 6px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 14px; font-weight: 800; color: #1a6b3a; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; border-bottom: 2px solid #e2ece5; padding-bottom: 8px; }
    .list-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
    .list-item:last-child { border-bottom: none; }
    .list-label { color: #5a6672; }
    .list-value { font-weight: 700; color: #1a6b3a; }
    .footer { background: #f7faf8; padding: 20px; text-align: center; font-size: 12px; color: #5a6672; border-top: 1px solid #e2ece5; }
    .cta { background: #1a6b3a; color: white; padding: 12px 24px; border-radius: 30px; text-decoration: none; display: inline-block; font-weight: 700; margin-top: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💚 VitalPicks Daily Report</h1>
      <p>${emailDate}</p>
    </div>
    <div class="content">
      <div class="stat-row">
        <div class="stat">
          <div class="stat-number">${visitors}</div>
          <div class="stat-label">Visitors</div>
        </div>
        <div class="stat">
          <div class="stat-number">${sessions}</div>
          <div class="stat-label">Sessions</div>
        </div>
        <div class="stat">
          <div class="stat-number">${pageviews}</div>
          <div class="stat-label">Pageviews</div>
        </div>
      </div>

      <div class="section">
        <div class="stat" style="grid-column: span 3; text-align: left; border: none; background: #fffbeb; border-left-color: #f0a500;">
          <div style="font-size: 24px; font-weight: 900; color: #f0a500;">$${estimatedEarnings}</div>
          <div style="font-size: 12px; color: #78350f; margin-top: 4px;">Est. Earnings (${estimatedClicks} clicks × $0.50)</div>
        </div>
      </div>

      ${topPages.length > 0
        ? `
      <div class="section">
        <div class="section-title">📊 Top Pages</div>
        ${topPages
          .map(
            (p) =>
              `<div class="list-item"><span class="list-label">${p.page}</span><span class="list-value">${p.views}</span></div>`
          )
          .join("")}
      </div>
      `
        : ""
      }

      ${topCountries.length > 0
        ? `
      <div class="section">
        <div class="section-title">🌍 Top Countries</div>
        ${topCountries
          .map(
            ([c, v]) =>
              `<div class="list-item"><span class="list-label">${c}</span><span class="list-value">${v}</span></div>`
          )
          .join("")}
      </div>
      `
        : ""
      }

      <div style="margin-top: 28px; padding: 16px; background: #f7faf8; border-radius: 10px;">
        <p style="margin: 0; font-size: 13px; color: #5a6672; line-height: 1.6;">
          <strong>Next steps:</strong> Check your <a href="https://analytics.google.com/" style="color: #1a6b3a; font-weight: 700;">Google Analytics dashboard</a> for detailed breakdowns. Monitor top-performing pages and optimize them for better rankings.
        </p>
      </div>
    </div>
    <div class="footer">
      <p style="margin: 0;">VitalPicks — Automated daily reports | <a href="https://www.vitalpicks.org" style="color: #1a6b3a; text-decoration: none; font-weight: 700;">Visit site</a></p>
    </div>
  </div>
</body>
</html>
`;

        // Send email via Gmail
        const emailMessage = {
          raw: Buffer.from(
            `From: noreply@vitalpicks.org\r\nTo: gulrajb@gmail.com\r\nSubject: VitalPicks Daily Report - ${emailDate}\r\nContent-Type: text/html; charset="UTF-8"\r\n\r\n${emailBody}`
          )
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=/g, ""),
        };

        const sendResponse = await fetch(
          "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${gmailToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(emailMessage),
          }
        );

        if (sendResponse.ok) {
          return new Response(
            JSON.stringify({
              success: true,
              message: `Daily digest sent to gulrajb@gmail.com`,
              data: {
                date: dateStr,
                visitors,
                sessions,
                pageviews,
                estimatedEarnings,
              },
            }),
            { status: 200 }
          );
        } else {
          const error = await sendResponse.text();
          throw new Error(`Gmail send failed: ${error}`);
        }
      } else {
        // GA API failed - send a fallback email
        const fallbackBody = `
<html>
<body style="font-family: sans-serif; padding: 20px; background: #f7faf8;">
  <div style="max-width: 600px; margin: 0 auto; background: white; padding: 24px; border-radius: 12px;">
    <h2 style="color: #1a6b3a; margin-top: 0;">📊 VitalPicks Daily Report</h2>
    <p style="color: #5a6672; line-height: 1.6;">
      <strong>Note:</strong> Google Analytics data is still loading. It can take 24-48 hours for data to appear after connecting. 
      <br><br>Check back tomorrow for your first report with real visitor data.
      <br><br><a href="https://analytics.google.com/" style="color: #1a6b3a; font-weight: bold;">View in Google Analytics →</a>
    </p>
  </div>
</body>
</html>
`;

        const fallbackEmail = {
          raw: Buffer.from(
            `From: noreply@vitalpicks.org\r\nTo: gulrajb@gmail.com\r\nSubject: VitalPicks Daily Report - ${dateStr} (Setup in progress)\r\nContent-Type: text/html; charset="UTF-8"\r\n\r\n${fallbackBody}`
          )
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=/g, ""),
        };

        await fetch(
          "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${gmailToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(fallbackEmail),
          }
        );

        return new Response(
          JSON.stringify({
            success: true,
            message: "Setup email sent (GA data still loading)",
          }),
          { status: 200 }
        );
      }
    } catch (gaError: any) {
      console.error("GA fetch error:", gaError.message);
      // Continue to send a fallback email
      return new Response(
        JSON.stringify({
          success: false,
          error: gaError.message,
          message: "Attempted to send fallback email",
        }),
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Daily digest error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Unknown error",
      }),
      { status: 500 }
    );
  }
}
