import { createClientFromRequest } from '@base44/sdk';

interface GAResponse {
  rows?: Array<{
    dimensionValues?: Array<{ value: string }>;
    metricValues?: Array<{ value: string }>;
  }>;
}

export default async function dailyDigest(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get tokens
    const { accessToken: gmailToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const { accessToken: gaToken } = await base44.asServiceRole.connectors.getConnection('google_analytics');
    
    // Calculate yesterday's date
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    
    // Get property ID from Analytics (must be set up manually or via config)
    // For now, we'll fetch from GA4 Admin API to find the property
    const properties = await fetch(
      'https://analyticsadmin.googleapis.com/v1beta/accounts/~all/properties',
      { headers: { Authorization: `Bearer ${gaToken}` } }
    ).then(r => r.json() as Promise<{ properties?: Array<{ name: string; displayName: string }> }>);
    
    const propertyId = properties.properties?.[0]?.name?.split('/')[3] || '';
    if (!propertyId) {
      return new Response(JSON.stringify({ error: 'No GA4 property found' }), { status: 400 });
    }
    
    // Fetch GA4 data for yesterday
    const gaBody = {
      dateRanges: [{ startDate: dateStr, endDate: dateStr }],
      dimensions: [
        { name: 'pagePath' },
        { name: 'country' }
      ],
      metrics: [
        { name: 'activeUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' }
      ],
      orderBys: [
        { metric: { metricName: 'activeUsers' }, descending: true }
      ],
      limit: 100
    };
    
    const gaRes = await fetch(
      `https://analyticsreporting.googleapis.com/v4/reports:batchGet`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${gaToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reportRequests: [gaBody]
        })
      }
    );
    
    const gaData = await gaRes.json() as {
      reports?: Array<{
        data?: {
          rows?: Array<{
            dimensions?: string[];
            metrics?: Array<{ values?: string[] }>;
          }>;
          totals?: Array<{ values?: string[] }>;
          rowCount?: number;
        };
      }>;
    };
    
    const report = gaData.reports?.[0]?.data;
    const rows = report?.rows || [];
    const totals = report?.totals?.[0]?.values || [];
    
    // Parse data
    const totalUsers = parseInt(totals[0] || '0');
    const totalSessions = parseInt(totals[1] || '0');
    const totalPageviews = parseInt(totals[2] || '0');
    const avgBounceRate = parseFloat(totals[3] || '0').toFixed(1);
    const avgSessionDuration = parseFloat(totals[4] || '0').toFixed(0);
    
    // Top pages
    const topPages = rows.slice(0, 5).map((row, i) => ({
      rank: i + 1,
      page: row.dimensions?.[0] || '/',
      users: row.metrics?.[0]?.values?.[0] || '0',
      views: row.metrics?.[0]?.values?.[2] || '0'
    }));
    
    // Top countries
    const countryMap = new Map<string, { users: number; sessions: number }>();
    rows.forEach(row => {
      const country = row.dimensions?.[1] || 'Unknown';
      const users = parseInt(row.metrics?.[0]?.values?.[0] || '0');
      const sessions = parseInt(row.metrics?.[0]?.values?.[1] || '0');
      const curr = countryMap.get(country) || { users: 0, sessions: 0 };
      countryMap.set(country, {
        users: curr.users + users,
        sessions: curr.sessions + sessions
      });
    });
    
    const topCountries = Array.from(countryMap.entries())
      .sort((a, b) => b[1].users - a[1].users)
      .slice(0, 5)
      .map(([country, data], i) => ({
        rank: i + 1,
        country,
        users: data.users,
        sessions: data.sessions
      }));
    
    // Build email HTML
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f7faf8; }
    .card { background: #fff; border-radius: 12px; padding: 24px; margin-bottom: 16px; border: 1px solid #e2ece5; }
    .header { background: linear-gradient(135deg, #134f2b, #1a6b3a); color: #fff; padding: 32px 24px; border-radius: 12px 12px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 8px 0 0 0; opacity: 0.9; font-size: 14px; }
    .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .stat-box { background: #f7faf8; padding: 16px; border-radius: 8px; text-align: center; border-left: 4px solid #1a6b3a; }
    .stat-value { font-size: 28px; font-weight: 900; color: #1a6b3a; margin: 0; }
    .stat-label { font-size: 12px; color: #5a6672; text-transform: uppercase; font-weight: 600; margin-top: 6px; }
    .table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    .table th { background: #e8f5ee; padding: 12px; text-align: left; font-size: 12px; font-weight: 700; text-transform: uppercase; color: #1a6b3a; border-bottom: 2px solid #1a6b3a; }
    .table td { padding: 12px; border-bottom: 1px solid #e2ece5; }
    .table tr:hover { background: #f7faf8; }
    .rank { color: #1a6b3a; font-weight: 700; }
    .page-name { font-weight: 600; color: #1a1a1a; }
    .footer { text-align: center; font-size: 12px; color: #5a6672; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2ece5; }
    .timestamp { color: #5a6672; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h1>💚 VitalPicks Daily Report</h1>
        <p>Yesterday's Traffic & Performance</p>
      </div>
      
      <div style="padding: 24px;">
        <p class="timestamp">📅 Report for: <strong>${dateStr}</strong></p>
        
        <div class="stats-grid">
          <div class="stat-box">
            <div class="stat-value">${totalUsers}</div>
            <div class="stat-label">Visitors</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${totalSessions}</div>
            <div class="stat-label">Sessions</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${totalPageviews}</div>
            <div class="stat-label">Pageviews</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${avgSessionDuration}s</div>
            <div class="stat-label">Avg Duration</div>
          </div>
        </div>
        
        <h3 style="margin-top: 28px; margin-bottom: 12px; color: #1a6b3a;">🏆 Top 5 Pages</h3>
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Page</th>
              <th>Visitors</th>
              <th>Views</th>
            </tr>
          </thead>
          <tbody>
            ${topPages.map(p => `
              <tr>
                <td class="rank">${p.rank}</td>
                <td class="page-name">${p.page}</td>
                <td>${p.users}</td>
                <td>${p.views}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <h3 style="margin-top: 28px; margin-bottom: 12px; color: #1a6b3a;">🌍 Top Countries</h3>
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Country</th>
              <th>Visitors</th>
              <th>Sessions</th>
            </tr>
          </thead>
          <tbody>
            ${topCountries.map(c => `
              <tr>
                <td class="rank">${c.rank}</td>
                <td>${c.country}</td>
                <td>${c.users}</td>
                <td>${c.sessions}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div style="background: #e8f5ee; border-left: 4px solid #1a6b3a; padding: 16px; margin-top: 24px; border-radius: 4px;">
          <p style="margin: 0; font-size: 14px; color: #1a6b3a;"><strong>💡 Tip:</strong> Check your top pages for optimization opportunities. Consider promoting underperforming but high-value pages through internal linking.</p>
        </div>
      </div>
    </div>
    
    <div class="footer">
      <p>VitalPicks Daily Digest • Sent automatically each morning at 9:00 AM IST</p>
      <p><a href="https://analytics.google.com" style="color: #1a6b3a; text-decoration: none;">View Full Analytics →</a></p>
    </div>
  </div>
</body>
</html>
    `;
    
    // Build MIME message for Gmail
    const from = 'gulrajb@gmail.com';
    const to = 'gulrajb@gmail.com';
    const subject = `VitalPicks Daily Report — ${dateStr} (${totalUsers} visitors)`;
    
    const mimeMessage = [
      `From: <${from}>`,
      `To: <${to}>`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=utf-8`,
      ``,
      emailHtml
    ].join('\r\n');
    
    const encodedMessage = btoa(mimeMessage).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    
    // Send via Gmail
    const sendRes = await fetch(
      'https://www.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${gmailToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          raw: encodedMessage
        })
      }
    );
    
    if (!sendRes.ok) {
      const err = await sendRes.text();
      return new Response(JSON.stringify({ error: 'Failed to send email', details: err }), { status: 500 });
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: `Daily digest sent to ${to}`,
      stats: { users: totalUsers, sessions: totalSessions, pageviews: totalPageviews, topPages: topPages.length }
    }), { status: 200 });
    
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}
