import { createClient } from '@base44/sdk';

export default async function dailyDigest(req: Request) {
  const base44 = createClient({
    token: process.env.BASE44_SERVICE_TOKEN!,
    appId: process.env.BASE44_APP_ID!,
    serverUrl: process.env.BASE44_API_URL!,
  });

  try {
    // Get Gmail access token for sending emails
    const { accessToken: gmailToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    
    // Get Google Analytics access token
    const { accessToken: gaToken } = await base44.asServiceRole.connectors.getConnection('google_analytics');

    // Fetch GA4 property ID first (vitalpicks.org)
    const propertiesRes = await fetch('https://analyticsadmin.googleapis.com/v1beta/properties', {
      headers: { Authorization: `Bearer ${gaToken}` },
    });
    
    if (!propertiesRes.ok) {
      throw new Error(`Failed to fetch GA properties: ${propertiesRes.statusText}`);
    }

    const propertiesData = await propertiesRes.json();
    let propertyId = '';
    
    // Find property matching vitalpicks.org
    if (propertiesData.properties && Array.isArray(propertiesData.properties)) {
      const vitalpicks = propertiesData.properties.find((p: any) => 
        p.displayName?.includes('VitalPicks') || p.displayName?.includes('vitalpicks')
      );
      if (vitalpicks) {
        propertyId = vitalpicks.name.split('/').pop();
      }
    }

    if (!propertyId) {
      throw new Error('Could not find VitalPicks property in Google Analytics');
    }

    // Calculate yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    // Fetch GA4 data using the Google Analytics Data API v1
    const gaDataRes = await fetch('https://analyticsdata.googleapis.com/v1beta/properties/' + propertyId + ':runReport', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${gaToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: dateStr, endDate: dateStr }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'bounceRate' },
          { name: 'averageSessionDuration' },
        ],
        dimensions: [
          { name: 'pagePath' },
          { name: 'country' },
        ],
        orderBys: [
          { metric: { name: 'screenPageViews' }, desc: true },
        ],
        limit: '100',
      }),
    });

    if (!gaDataRes.ok) {
      throw new Error(`GA API error: ${gaDataRes.statusText}`);
    }

    const gaData = await gaDataRes.json();

    // Parse GA response
    let visitors = 0;
    let sessions = 0;
    let pageviews = 0;
    let bounceRate = 0;
    let avgDuration = 0;

    if (gaData.totals && gaData.totals.length > 0) {
      const totals = gaData.totals[0].metricValues;
      visitors = parseInt(totals[0]?.value || '0');
      sessions = parseInt(totals[1]?.value || '0');
      pageviews = parseInt(totals[2]?.value || '0');
      bounceRate = parseFloat((totals[3]?.value || '0'));
      avgDuration = parseFloat((totals[4]?.value || '0'));
    }

    // Get top pages
    const topPages: Array<{ page: string; views: number }> = [];
    if (gaData.rows && Array.isArray(gaData.rows)) {
      gaData.rows.slice(0, 5).forEach((row: any) => {
        const page = row.dimensionValues?.[0]?.value || 'unknown';
        const views = parseInt(row.metricValues?.[2]?.value || '0');
        if (views > 0) {
          topPages.push({ page, views });
        }
      });
    }

    // Get top countries
    const countryRes = await fetch('https://analyticsdata.googleapis.com/v1beta/properties/' + propertyId + ':runReport', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${gaToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: dateStr, endDate: dateStr }],
        metrics: [{ name: 'activeUsers' }],
        dimensions: [{ name: 'country' }],
        orderBys: [{ metric: { name: 'activeUsers' }, desc: true }],
        limit: '5',
      }),
    });

    const countryData = await countryRes.json();
    const topCountries: Array<{ country: string; users: number }> = [];
    
    if (countryData.rows && Array.isArray(countryData.rows)) {
      countryData.rows.forEach((row: any) => {
        const country = row.dimensionValues?.[0]?.value || 'Unknown';
        const users = parseInt(row.metricValues?.[0]?.value || '0');
        if (users > 0) {
          topCountries.push({ country, users });
        }
      });
    }

    // Build email content
    const emailBody = `
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f7faf8; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 28px; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
    h1 { color: #1a6b3a; font-size: 24px; margin: 0 0 24px; }
    .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 32px; }
    .stat { background: #f0f9f4; border-left: 4px solid #1a6b3a; padding: 14px; border-radius: 6px; }
    .stat-value { font-size: 28px; font-weight: 900; color: #1a6b3a; }
    .stat-label { font-size: 12px; color: #5a6672; text-transform: uppercase; letter-spacing: .5px; margin-top: 6px; }
    .section { margin-bottom: 28px; }
    .section h2 { font-size: 16px; font-weight: 800; color: #1a1a1a; margin: 0 0 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { background: #e8f5ee; color: #1a6b3a; padding: 10px; text-align: left; font-weight: 700; border-bottom: 2px solid #1a6b3a; }
    td { padding: 10px; border-bottom: 1px solid #e2ece5; }
    tr:last-child td { border-bottom: none; }
    .footer { font-size: 12px; color: #aaa; text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2ece5; }
    .emoji { margin-right: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 VitalPicks Daily Report</h1>
    <p style="color: #5a6672; margin: 0 0 20px;">Yesterday's performance — ${dateStr}</p>

    <div class="stats">
      <div class="stat">
        <div class="stat-value">👥 ${visitors}</div>
        <div class="stat-label">Unique Visitors</div>
      </div>
      <div class="stat">
        <div class="stat-value">🔄 ${sessions}</div>
        <div class="stat-label">Sessions</div>
      </div>
      <div class="stat">
        <div class="stat-value">📄 ${pageviews}</div>
        <div class="stat-label">Page Views</div>
      </div>
      <div class="stat">
        <div class="stat-value">${(avgDuration || 0).toFixed(1)}s</div>
        <div class="stat-label">Avg. Session Duration</div>
      </div>
    </div>

    <div class="section">
      <h2><span class="emoji">🏆</span>Top 5 Pages</h2>
      <table>
        <thead>
          <tr>
            <th>Page</th>
            <th style="text-align: right;">Views</th>
          </tr>
        </thead>
        <tbody>
          ${topPages.length > 0 ? topPages.map(p => `
            <tr>
              <td><strong>${p.page || '/'}</strong></td>
              <td style="text-align: right; font-weight: 700;">${p.views}</td>
            </tr>
          `).join('') : '<tr><td colspan="2" style="text-align: center; color: #aaa;">No data yet</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2><span class="emoji">🌍</span>Top Countries</h2>
      <table>
        <thead>
          <tr>
            <th>Country</th>
            <th style="text-align: right;">Users</th>
          </tr>
        </thead>
        <tbody>
          ${topCountries.length > 0 ? topCountries.map(c => `
            <tr>
              <td><strong>${c.country}</strong></td>
              <td style="text-align: right; font-weight: 700;">${c.users}</td>
            </tr>
          `).join('') : '<tr><td colspan="2" style="text-align: center; color: #aaa;">No data yet</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="footer">
      <p>💚 VitalPicks | Automated Daily Report<br>View detailed analytics at <a href="https://analytics.google.com" style="color: #1a6b3a; text-decoration: none;">Google Analytics</a></p>
    </div>
  </div>
</body>
</html>
    `;

    // Send email via Gmail API
    const emailSubject = `📊 VitalPicks Daily Report — ${visitors} visitors yesterday`;
    
    // Build RFC 2822 email
    const emailHeaders = [
      `From: vitalpicks@gmail.com`,
      `To: gulrajb@gmail.com`,
      `Subject: ${emailSubject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
    ];

    const fullEmail = emailHeaders.join('\r\n') + '\r\n\r\n' + Buffer.from(emailBody).toString('base64');
    const encodedEmail = Buffer.from(fullEmail).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

    const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${gmailToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: encodedEmail,
      }),
    });

    if (!sendRes.ok) {
      const error = await sendRes.text();
      console.error('Gmail send error:', error);
      throw new Error(`Failed to send email: ${sendRes.statusText}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Daily digest sent to gulrajb@gmail.com | ${visitors} visitors, ${pageviews} pageviews`,
        stats: { visitors, sessions, pageviews, avgDuration, topPages, topCountries },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in dailyDigest:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
