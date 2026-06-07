export default async function dailyDigest(req: Request) {
  try {
    const gaToken = process.env.GOOGLE_ANALYTICS_ACCESS_TOKEN || '';
    const gmailToken = process.env.GMAIL_ACCESS_TOKEN || '';
    const propertyId = '416847524';
    const userEmail = 'gulrajb@gmail.com';

    // Fetch GA data
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    const gaRes = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${gaToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: yesterday, endDate: yesterday }],
          metrics: [
            { name: 'activeUsers' },
            { name: 'sessions' },
            { name: 'screenPageViews' },
            { name: 'bounceRate' },
          ],
          dimensions: [{ name: 'pagePath' }, { name: 'country' }],
          orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
          limit: 100,
        }),
      }
    );

    const gaData = await gaRes.json();
    const rows = gaData.rows || [];

    let totalUsers = 0, totalSessions = 0, totalViews = 0, totalBounce = 0;
    const pageMap: any = {};
    const countryMap: any = {};

    rows.forEach((row: any) => {
      const users = parseInt(row.metricValues?.[0]?.value || '0');
      const sessions = parseInt(row.metricValues?.[1]?.value || '0');
      const views = parseInt(row.metricValues?.[2]?.value || '0');
      const bounce = parseFloat(row.metricValues?.[3]?.value || '0');
      const pagePath = row.dimensionValues?.[0]?.value || '';
      const country = row.dimensionValues?.[1]?.value || 'Unknown';

      totalUsers += users;
      totalSessions += sessions;
      totalViews += views;
      totalBounce += bounce;

      if (pagePath && pagePath !== '(not set)') {
        if (!pageMap[pagePath]) pageMap[pagePath] = { page: pagePath, views: 0 };
        pageMap[pagePath].views += views;
      }

      if (country && country !== '(not set)') {
        if (!countryMap[country]) countryMap[country] = { country, users: 0 };
        countryMap[country].users += users;
      }
    });

    const topPages = Object.values(pageMap)
      .sort((a: any, b: any) => b.views - a.views)
      .slice(0, 5);
    
    const topCountries = Object.values(countryMap)
      .sort((a: any, b: any) => b.users - a.users)
      .slice(0, 5);

    const avgBounce = rows.length > 0 ? (totalBounce / rows.length).toFixed(1) : '0';

    // Format HTML
    const yesterdayStr = new Date(Date.now() - 86400000).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const topPagesHtml = topPages
      .map((p: any, i: number) => `<tr><td style="padding:12px">${i + 1}. ${p.page}</td><td style="padding:12px;text-align:right">${p.views}</td></tr>`)
      .join('');

    const topCountriesHtml = topCountries
      .map((c: any, i: number) => `<tr><td style="padding:12px">${i + 1}. ${c.country}</td><td style="padding:12px;text-align:right">${c.users}</td></tr>`)
      .join('');

    const html = `<!DOCTYPE html><html><body style="font-family:Arial;max-width:600px">
<h2>VitalPicks Daily Analytics</h2>
<p>${yesterdayStr}</p>
<table style="width:100%;border-collapse:collapse">
<tr><td style="padding:15px;background:#f0f7ff;border:1px solid #ddd"><strong>Users:</strong> ${totalUsers}</td>
<td style="padding:15px;background:#f0fff0;border:1px solid #ddd"><strong>Sessions:</strong> ${totalSessions}</td></tr>
<tr><td style="padding:15px;background:#fff8f0;border:1px solid #ddd"><strong>Pageviews:</strong> ${totalViews}</td>
<td style="padding:15px;background:#f5f0ff;border:1px solid #ddd"><strong>Bounce Rate:</strong> ${avgBounce}%</td></tr>
</table>
<h3>Top Pages</h3>
<table style="width:100%;border-collapse:collapse;border:1px solid #ddd">${topPagesHtml || '<tr><td>No data</td></tr>'}</table>
<h3>Top Countries</h3>
<table style="width:100%;border-collapse:collapse;border:1px solid #ddd">${topCountriesHtml || '<tr><td>No data</td></tr>'}</table>
</body></html>`;

    // Send email
    const boundary = 'boundary_' + Date.now();
    const mime = [
      `To: ${userEmail}`,
      `Subject: VitalPicks Daily Analytics - ${yesterdayStr}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      '',
      html,
      `--${boundary}--`,
    ].join('\r\n');

    const base64Msg = Buffer.from(mime).toString('base64');

    const emailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${gmailToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: base64Msg }),
    });

    if (emailRes.ok) {
      return new Response(JSON.stringify({ success: true, users: totalUsers, sessions: totalSessions, views: totalViews }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    } else {
      throw new Error('Email send failed');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
