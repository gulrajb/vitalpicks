import { createClient } from '@base44/sdk';

export default async function dailyDigest(req: Request) {
  const base44 = createClient({
    appId: process.env.BASE44_APP_ID || '',
    token: process.env.BASE44_SERVICE_TOKEN || '',
    serverUrl: process.env.BASE44_API_URL || 'https://api.base44.com',
  });

  try {
    // Get Gmail access token
    const { accessToken: gmailToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    // Get Google Analytics access token
    const { accessToken: gaToken } = await base44.asServiceRole.connectors.getConnection('google_analytics');

    // Property ID for vitalpicks.org (from GA4)
    const PROPERTY_ID = '456892315'; // You'll need to replace this with actual property ID

    // Calculate yesterday's date range
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const dateStr = yesterday.toISOString().split('T')[0];

    // Fetch GA4 data using RunReport API
    const gaResponse = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runReport`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${gaToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: dateStr, endDate: dateStr }],
          metrics: [
            { name: 'activeUsers' },
            { name: 'sessions' },
            { name: 'screenPageViews' },
            { name: 'bounceRate' },
          ],
          dimensions: [
            { name: 'pagePath' },
            { name: 'country' },
          ],
          orderBys: [
            { metric: { metricName: 'screenPageViews' }, desc: true },
          ],
          limit: 10,
        }),
      }
    );

    if (!gaResponse.ok) {
      const error = await gaResponse.text();
      console.error('GA API error:', error);
      throw new Error(`GA API failed: ${gaResponse.status}`);
    }

    const gaData = await gaResponse.json();

    // Extract metrics
    let users = 0, sessions = 0, pageviews = 0, bounceRate = 0;
    let topPages: Array<{ page: string; views: number }> = [];
    let topCountries: Array<{ country: string; views: number }> = [];

    if (gaData.rows) {
      gaData.rows.forEach((row: any) => {
        const views = parseInt(row.metricValues[2]?.value || 0);
        const page = row.dimensionValues[0]?.value || 'unknown';
        const country = row.dimensionValues[1]?.value || 'unknown';

        if (views > 0) {
          topPages.push({ page, views });
          topCountries.push({ country, views });
        }
      });
    }

    if (gaData.totals && gaData.totals[0]) {
      users = parseInt(gaData.totals[0].metricValues[0]?.value || 0);
      sessions = parseInt(gaData.totals[0].metricValues[1]?.value || 0);
      pageviews = parseInt(gaData.totals[0].metricValues[2]?.value || 0);
      bounceRate = parseFloat(gaData.totals[0].metricValues[3]?.value || 0).toFixed(1);
    }

    // Deduplicate and sort
    const uniquePages = Array.from(
      new Map(topPages.map(p => [p.page, p])).values()
    ).sort((a, b) => b.views - a.views).slice(0, 5);

    const uniqueCountries = Array.from(
      new Map(topCountries.map(c => [c.country, c])).values()
    ).sort((a, b) => b.views - a.views).slice(0, 3);

    // Build email HTML
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; }
    .header { background: linear-gradient(135deg, #1a6b3a 0%, #2d9b5a 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .header p { margin: 8px 0 0; opacity: 0.9; }
    .content { padding: 30px; }
    .stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
    .stat-box { background: #f9f9f9; padding: 20px; border-radius: 8px; border-left: 4px solid #1a6b3a; }
    .stat-label { font-size: 12px; text-transform: uppercase; color: #666; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 4px; }
    .stat-value { font-size: 28px; font-weight: 900; color: #1a6b3a; }
    .section { margin-bottom: 30px; }
    .section-title { font-size: 16px; font-weight: 800; color: #1a6b3a; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #e8f5ee; }
    .list-item { padding: 12px 0; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center; }
    .list-item:last-child { border-bottom: none; }
    .list-page { font-size: 14px; color: #333; font-weight: 600; flex: 1; }
    .list-value { font-size: 14px; color: #1a6b3a; font-weight: 700; }
    .footer { background: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #e0e0e0; }
    .footer a { color: #1a6b3a; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 VitalPicks Daily Report</h1>
      <p>${dateStr}</p>
    </div>
    
    <div class="content">
      <div class="stat-grid">
        <div class="stat-box">
          <div class="stat-label">👥 Visitors</div>
          <div class="stat-value">${users.toLocaleString()}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">📈 Sessions</div>
          <div class="stat-value">${sessions.toLocaleString()}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">📄 Pageviews</div>
          <div class="stat-value">${pageviews.toLocaleString()}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">⏱️ Bounce Rate</div>
          <div class="stat-value">${bounceRate}%</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">🔥 Top Pages</div>
        ${uniquePages.map(p => `
          <div class="list-item">
            <div class="list-page">${p.page || '/'}</div>
            <div class="list-value">${p.views} views</div>
          </div>
        `).join('')}
      </div>

      <div class="section">
        <div class="section-title">🌍 Top Countries</div>
        ${uniqueCountries.map(c => `
          <div class="list-item">
            <div class="list-page">${c.country}</div>
            <div class="list-value">${c.views} views</div>
          </div>
        `).join('')}
      </div>

      <p style="font-size: 13px; color: #666; line-height: 1.6; margin-top: 20px;">
        💡 <strong>Tip:</strong> Check <a href="https://analytics.google.com" style="color: #1a6b3a;">Google Analytics</a> for detailed insights, traffic sources, and conversion data. Your site is being indexed daily and content is growing! 🚀
      </p>
    </div>

    <div class="footer">
      <p>This is an automated daily report from VitalPicks. <a href="https://www.vitalpicks.org">Visit your site →</a></p>
    </div>
  </div>
</body>
</html>
    `;

    // Build MIME message for Gmail API
    const message = `From: VitalPicks <noreply@vitalpicks.org>
To: gulrajb@gmail.com
Subject: =?UTF-8?B?${Buffer.from('📊 VitalPicks Daily Report - ' + dateStr).toString('base64')}?=
Content-Type: text/html; charset=UTF-8
Content-Transfer-Encoding: base64

${Buffer.from(emailHtml).toString('base64')}`;

    // Send via Gmail API
    const sendResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${gmailToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: Buffer.from(message).toString('base64'),
      }),
    });

    if (!sendResponse.ok) {
      const error = await sendResponse.text();
      console.error('Gmail send error:', error);
      throw new Error(`Gmail API failed: ${sendResponse.status}`);
    }

    const sendData = await sendResponse.json();
    console.log('Email sent successfully:', sendData.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Daily digest sent',
        date: dateStr,
        stats: { users, sessions, pageviews, bounceRate },
        email: 'gulrajb@gmail.com',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Digest error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
