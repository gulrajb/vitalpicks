import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

interface GAEvent {
  dimensionValues: Array<{ value: string }>;
  metricValues: Array<{ value: string }>;
}

interface AnalyticsResponse {
  rows?: GAEvent[];
}

Deno.serve(async (req: Request): Promise<Response> => {
  try {
    const base44 = createClientFromRequest(req);

    // Get tokens
    const gaConnection = await base44.asServiceRole.connectors.getConnection("google_analytics");
    const gmailConnection = await base44.asServiceRole.connectors.getConnection("gmail");

    const gaToken = gaConnection.accessToken;
    const gmailToken = gmailConnection.accessToken;

    // Get yesterday's date (IST timezone)
    const now = new Date();
    now.setHours(now.getHours() - 5, now.getMinutes() - 30); // IST offset
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0];

    // Fetch GA4 data for yesterday
    const propertyId = "443019869"; // vitalpicks.org GA4 property ID

    const gaPayload = {
      dateRanges: [{ startDate: dateStr, endDate: dateStr }],
      dimensions: [
        { name: "pagePath" },
        { name: "country" },
      ],
      metrics: [
        { name: "activeUsers" },
        { name: "sessions" },
        { name: "screenPageViews" },
        { name: "bounceRate" },
        { name: "averageSessionDuration" },
      ],
      orderBys: [{ metric: { metricName: "screenPageViews" }, descending: true }],
      limit: 10,
    };

    const gaResponse = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${gaToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(gaPayload),
      }
    );

    if (!gaResponse.ok) {
      throw new Error(`GA API error: ${gaResponse.status}`);
    }

    const gaData: AnalyticsResponse = await gaResponse.json();

    // Format email
    let topPages = "No data yet";
    let totalSessions = "0";
    let totalViews = "0";

    if (gaData.rows && gaData.rows.length > 0) {
      const summaryRow = gaData.rows[0];
      totalSessions = summaryRow.metricValues[1]?.value || "0";
      totalViews = summaryRow.metricValues[2]?.value || "0";

      topPages = gaData.rows
        .slice(0, 5)
        .map((row, i) => {
          const page = row.dimensionValues[0]?.value || "Unknown";
          const views = row.metricValues[2]?.value || "0";
          return `${i + 1}. ${page.replace(/\//g, "")} — ${views} views`;
        })
        .join("\n");
    }

    const emailSubject = `VitalPicks Daily Report — ${dateStr}`;
    const emailBody = `📊 VitalPicks Daily Analytics — ${dateStr}

Sessions Yesterday: ${totalSessions}
Page Views: ${totalViews}

📈 Top 5 Pages:
${topPages}

Check full stats: https://analytics.google.com

---
This is an automated report. Your site is growing! 🚀
`;

    // Send email via Gmail API
    const emailMessage = [
      `From: vitalpicks.org <noreply@vitalpicks.org>`,
      `To: gulrajb@gmail.com`,
      `Subject: ${emailSubject}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      ``,
      emailBody,
    ].join("\r\n");

    const encodedMessage = btoa(emailMessage);

    const emailPayload = {
      raw: encodedMessage,
    };

    const emailResponse = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${gmailToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailPayload),
      }
    );

    if (!emailResponse.ok) {
      throw new Error(`Gmail API error: ${emailResponse.status}`);
    }

    const result = await emailResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        message: "Daily digest sent",
        emailId: result.id,
        date: dateStr,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        note: "Connectors may need re-authorization",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
