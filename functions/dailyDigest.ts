import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const GA_PROPERTY_ID = "properties/530709003";
    const RECIPIENT_EMAIL = "gulrajb@gmail.com";

    // ── Get tokens ────────────────────────────────────────────────────────────
    const gaConn = await base44.asServiceRole.connectors.getConnection("google_analytics");
    const gaToken = gaConn.accessToken;
    const gmailConn = await base44.asServiceRole.connectors.getConnection("gmail");
    const gmailToken = gmailConn.accessToken;

    // ── Date info ─────────────────────────────────────────────────────────────
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateFormatted = yesterday.toLocaleDateString("en-IN", {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    });

    // ── Pull GA data ──────────────────────────────────────────────────────────
    let visitors = "—", sessions = "—", pageviews = "—", bounceRate = "—";
    let topPages: { page: string; views: string }[] = [];
    let countries: { country: string; users: string }[] = [];
    let gaNote = "";

    try {
      // Summary metrics
      const gaRes = await fetch(
        `https://analyticsdata.googleapis.com/v1beta/${GA_PROPERTY_ID}:runReport`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${gaToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            dateRanges: [{ startDate: "yesterday", endDate: "yesterday" }],
            metrics: [
              { name: "activeUsers" },
              { name: "sessions" },
              { name: "screenPageViews" },
              { name: "bounceRate" },
            ],
          }),
        }
      );
      const gaData = await gaRes.json();
      if (gaData.rows?.[0]?.metricValues) {
        const v = gaData.rows[0].metricValues;
        visitors   = parseInt(v[0].value).toLocaleString();
        sessions   = parseInt(v[1].value).toLocaleString();
        pageviews  = parseInt(v[2].value).toLocaleString();
        bounceRate = (parseFloat(v[3].value) * 100).toFixed(1) + "%";
      }

      // Top pages
      const pagesRes = await fetch(
        `https://analyticsdata.googleapis.com/v1beta/${GA_PROPERTY_ID}:runReport`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${gaToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            dateRanges: [{ startDate: "yesterday", endDate: "yesterday" }],
            dimensions: [{ name: "pagePath" }],
            metrics: [{ name: "screenPageViews" }],
            orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
            limit: 5,
          }),
        }
      );
      const pagesData = await pagesRes.json();
      if (pagesData.rows) {
        topPages = pagesData.rows.map((r: any) => ({
          page: r.dimensionValues[0].value,
          views: parseInt(r.metricValues[0].value).toLocaleString(),
        }));
      }

      // Countries
      const countryRes = await fetch(
        `https://analyticsdata.googleapis.com/v1beta/${GA_PROPERTY_ID}:runReport`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${gaToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            dateRanges: [{ startDate: "yesterday", endDate: "yesterday" }],
            dimensions: [{ name: "country" }],
            metrics: [{ name: "activeUsers" }],
            orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
            limit: 5,
          }),
        }
      );
      const countryData = await countryRes.json();
      if (countryData.rows) {
        countries = countryData.rows.map((r: any) => ({
          country: r.dimensionValues[0].value,
          users: parseInt(r.metricValues[0].value).toLocaleString(),
        }));
      }

    } catch (_e) {
      gaNote = `<p style="color:#e65100;font-size:13px;padding:12px;background:#fff8f0;border-radius:8px;margin-bottom:16px">⚠️ Traffic data still initializing — will appear within 24–48h of first visitors.</p>`;
      visitors = sessions = pageviews = "Initializing...";
    }

    // ── Build email ───────────────────────────────────────────────────────────
    const topPagesHtml = topPages.length
      ? topPages.map((p, i) => `<tr style="border-bottom:1px solid #f0f0f0">
          <td style="padding:10px 12px;font-size:13px;color:#888">${i + 1}</td>
          <td style="padding:10px 12px;font-size:13px;color:#1a6b3a;font-family:monospace;word-break:break-all">${p.page}</td>
          <td style="padding:10px 12px;font-size:14px;font-weight:800;text-align:right;color:#1a1a1a">${p.views}</td>
        </tr>`).join("")
      : `<tr><td colspan="3" style="padding:20px;color:#aaa;font-size:13px;text-align:center">No visitor data yet — check back tomorrow</td></tr>`;

    const countriesHtml = countries.length
      ? countries.map(c => `<span style="display:inline-block;background:#e8f5e9;color:#1a6b3a;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;margin:4px">${c.country} · ${c.users}</span>`).join("")
      : `<span style="color:#aaa;font-size:13px">Initializing...</span>`;

    const emailHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4f1">
<div style="max-width:580px;margin:24px auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#134f2b,#1a6b3a,#2d9b5a);padding:32px;text-align:center;border-radius:16px 16px 0 0">
    <div style="font-size:36px;margin-bottom:8px">💚</div>
    <h1 style="color:#fff;font-size:22px;font-weight:900;margin:0;letter-spacing:-0.5px">VitalPicks Daily Report</h1>
    <p style="color:rgba(255,255,255,.7);font-size:13px;margin:8px 0 0">${dateFormatted}</p>
  </div>

  <!-- Stats -->
  <div style="background:#fff;padding:28px 28px 20px">
    ${gaNote}
    <p style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#888;margin:0 0 14px">Yesterday's Traffic</p>
    <table style="width:100%;border-collapse:collapse">
    <tr>
      <td style="width:25%;padding-right:8px">
        <div style="background:#f7faf8;border-radius:12px;padding:16px 8px;text-align:center">
          <div style="font-size:26px;font-weight:900;color:#1a6b3a;line-height:1">${visitors}</div>
          <div style="font-size:10px;color:#999;margin-top:5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Visitors</div>
        </div>
      </td>
      <td style="width:25%;padding-right:8px">
        <div style="background:#f7faf8;border-radius:12px;padding:16px 8px;text-align:center">
          <div style="font-size:26px;font-weight:900;color:#1a6b3a;line-height:1">${sessions}</div>
          <div style="font-size:10px;color:#999;margin-top:5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Sessions</div>
        </div>
      </td>
      <td style="width:25%;padding-right:8px">
        <div style="background:#f7faf8;border-radius:12px;padding:16px 8px;text-align:center">
          <div style="font-size:26px;font-weight:900;color:#1a6b3a;line-height:1">${pageviews}</div>
          <div style="font-size:10px;color:#999;margin-top:5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Pageviews</div>
        </div>
      </td>
      <td style="width:25%">
        <div style="background:#f7faf8;border-radius:12px;padding:16px 8px;text-align:center">
          <div style="font-size:26px;font-weight:900;color:#1a6b3a;line-height:1">${bounceRate}</div>
          <div style="font-size:10px;color:#999;margin-top:5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Bounce</div>
        </div>
      </td>
    </tr>
    </table>
  </div>

  <!-- Top pages -->
  <div style="background:#fff;padding:0 28px 24px;border-top:1px solid #f0f0f0">
    <p style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#888;margin:0 0 12px;padding-top:24px">📄 Top Pages</p>
    <table style="width:100%;border-collapse:collapse;background:#fafafa;border-radius:10px;overflow:hidden">
      <thead><tr style="background:#e8f5e9">
        <th style="padding:10px 12px;font-size:11px;color:#1a6b3a;text-align:left;font-weight:800">#</th>
        <th style="padding:10px 12px;font-size:11px;color:#1a6b3a;text-align:left;font-weight:800">PAGE</th>
        <th style="padding:10px 12px;font-size:11px;color:#1a6b3a;text-align:right;font-weight:800">VIEWS</th>
      </tr></thead>
      <tbody>${topPagesHtml}</tbody>
    </table>
  </div>

  <!-- Countries -->
  <div style="background:#fff;padding:0 28px 24px;border-top:1px solid #f0f0f0">
    <p style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#888;margin:0 0 12px;padding-top:24px">🌍 Top Countries</p>
    <div>${countriesHtml}</div>
  </div>

  <!-- Amazon box -->
  <div style="background:#fff;padding:0 28px 28px;border-top:1px solid #f0f0f0">
    <div style="background:linear-gradient(135deg,#fff8e1,#fff3cd);border-radius:12px;padding:20px 22px;border-left:4px solid #f0a500">
      <p style="font-size:13px;font-weight:800;color:#7a4f00;margin:0 0 6px">💰 Amazon Earnings</p>
      <p style="font-size:13px;color:#a06000;margin:0 0 14px;line-height:1.6">Check your Associates dashboard for yesterday's clicks and commissions. Affiliate ID: <strong>health2099-20</strong></p>
      <a href="https://associates.amazon.com" style="display:inline-block;background:#f0a500;color:#fff;padding:10px 20px;border-radius:20px;font-weight:700;font-size:13px;text-decoration:none">Open Associates Dashboard →</a>
    </div>
  </div>

  <!-- Links -->
  <div style="background:#fff;padding:0 28px 28px">
    <table style="width:100%"><tr>
      <td><a href="https://analytics.google.com" style="display:inline-block;background:#e8f5e9;color:#1a6b3a;padding:10px 14px;border-radius:20px;font-size:12px;font-weight:700;text-decoration:none">📊 Analytics</a></td>
      <td><a href="https://search.google.com/search-console" style="display:inline-block;background:#e8f5e9;color:#1a6b3a;padding:10px 14px;border-radius:20px;font-size:12px;font-weight:700;text-decoration:none">🔍 Search Console</a></td>
      <td><a href="https://www.vitalpicks.org" style="display:inline-block;background:#1a6b3a;color:#fff;padding:10px 14px;border-radius:20px;font-size:12px;font-weight:700;text-decoration:none">🌐 View Site</a></td>
    </tr></table>
  </div>

  <!-- Footer -->
  <div style="background:#e8ede9;padding:16px 28px;text-align:center;border-radius:0 0 16px 16px">
    <p style="font-size:12px;color:#888;margin:0">Sent daily at 8am IST by Akira · <a href="https://www.vitalpicks.org" style="color:#1a6b3a;text-decoration:none">vitalpicks.org</a></p>
  </div>

</div>
</body></html>`;

    // ── Send email ────────────────────────────────────────────────────────────
    const subject = `💚 VitalPicks Daily — ${visitors} visitors yesterday`;
    const mime = [
      `From: VitalPicks Reports <gulrajb@gmail.com>`,
      `To: gulrajb@gmail.com`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      ``,
      emailHtml,
    ].join("\r\n");

    const encoded = btoa(unescape(encodeURIComponent(mime)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const sendRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${gmailToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ raw: encoded }),
      }
    );
    const sendData = await sendRes.json();

    if (sendData.id) {
      return Response.json({ success: true, messageId: sendData.id, visitors, sessions, pageviews });
    } else {
      return Response.json({ success: false, error: sendData }, { status: 500 });
    }

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
