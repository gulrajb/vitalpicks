import { createClientFromRequest } from '@base44/sdk';

interface AnalyticsData {
  visitors: number;
  sessions: number;
  pageviews: number;
  avgSessionDuration: number;
  bounceRate: number;
  topPages: Array<{ page: string; views: number }>;
  topCountries: Array<{ country: string; users: number }>;
}

export default async function dailyDigest(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get Gmail token for sending email
    const { accessToken: gmailToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    
    // Get Google Analytics token for fetching data
    const { accessToken: gaToken } = await base44.asServiceRole.connectors.getConnection('google_analytics');
    
    // Calculate yesterday's date range (UTC)
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const dateStr = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    console.log(`Fetching GA data for ${dateStr}...`);
    
    // Fetch Google Analytics data via API
    let analyticsData: AnalyticsData = {
      visitors: 0,
      sessions: 0,
      pageviews: 0,
      avgSessionDuration: 0,
      bounceRate: 0,
      topPages: [],
      topCountries: [],
    };
    
    try {
      // Get property ID from environment or default
      const propertyId = '473638557'; // This is from vitalpicks.org GA4 setup
      
      // Call Google Analytics Data API (GA4)
      const gaResponse = await fetch(
        'https://analyticsdata.googleapis.com/v1beta/properties/' + propertyId + ':runReport',
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
              { name: 'averageSessionDuration' },
              { name: 'bounceRate' },
            ],
            dimensions: [{ name: 'pagePath' }, { name: 'country' }],
          }),
        }
      );
      
      if (gaResponse.ok) {
        const gaData = await gaResponse.json();
        
        // Parse aggregated metrics
        if (gaData.totals && gaData.totals.length > 0) {
          const row = gaData.totals[0];
          analyticsData.visitors = parseInt(row.values?.[0] || '0', 10);
          analyticsData.sessions = parseInt(row.values?.[1] || '0', 10);
          analyticsData.pageviews = parseInt(row.values?.[2] || '0', 10);
          analyticsData.avgSessionDuration = parseFloat(row.values?.[3] || '0');
          analyticsData.bounceRate = parseFloat(row.values?.[4] || '0');
        }
        
        // Extract top pages
        if (gaData.rows && gaData.rows.length > 0) {
          const pageMap: { [key: string]: number } = {};
          for (const row of gaData.rows) {
            const page = row.dimensionValues?.[0]?.value || 'unknown';
            const views = parseInt(row.metricValues?.[2]?.value || '0', 10);
            pageMap[page] = (pageMap[page] || 0) + views;
          }
          analyticsData.topPages = Object.entries(pageMap)
            .map(([page, views]) => ({ page, views }))
            .sort((a, b) => b.views - a.views)
            .slice(0, 5);
        }
        
        // Extract top countries
        if (gaData.rows && gaData.rows.length > 0) {
          const countryMap: { [key: string]: number } = {};
          for (const row of gaData.rows) {
            const country = row.dimensionValues?.[1]?.value || 'unknown';
            const users = parseInt(row.metricValues?.[0]?.value || '0', 10);
            countryMap[country] = (countryMap[country] || 0) + users;
          }
          analyticsData.topCountries = Object.entries(countryMap)
            .map(([country, users]) => ({ country, users }))
            .sort((a, b) => b.users - a.users)
            .slice(0, 5);
        }
      }
    } catch (gaError) {
      console.error('GA API error:', gaError);
      // Continue with zero data rather than failing
    }
    
    // Build email HTML
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #333; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #134f2b, #1a6b3a); color: white; padding: 24px; border-radius: 12px; margin-bottom: 24px; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 8px 0 0; opacity: 0.9; }
    .metric-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .metric { background: #f7faf8; border: 1px solid #e2ece5; border-radius: 8px; padding: 16px; }
    .metric-label { font-size: 12px; color: #5a6672; text-transform: uppercase; font-weight: 700; margin-bottom: 6px; }
    .metric-value { font-size: 32px; font-weight: 900; color: #1a6b3a; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 16px; font-weight: 800; color: #1a6b3a; margin-bottom: 12px; border-bottom: 2px solid #e2ece5; padding-bottom: 8px; }
    .list-item { padding: 12px 0; border-bottom: 1px solid #e2ece5; display: flex; justify-content: space-between; }
    .list-item:last-child { border-bottom: none; }
    .list-name { font-weight: 600; color: #1a1a1a; }
    .list-value { color: #5a6672; font-weight: 700; }
    .footer { font-size: 12px; color: #5a6672; text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2ece5; }
    .cta { display: inline-block; background: #1a6b3a; color: white; padding: 12px 24px; border-radius: 24px; text-decoration: none; font-weight: 700; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💚 VitalPicks Daily Report</h1>
      <p>${yesterday.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>
    
    <div class="metric-grid">
      <div class="metric">
        <div class="metric-label">👥 Visitors</div>
        <div class="metric-value">${analyticsData.visitors.toLocaleString()}</div>
      </div>
      <div class="metric">
        <div class="metric-label">📊 Sessions</div>
        <div class="metric-value">${analyticsData.sessions.toLocaleString()}</div>
      </div>
      <div class="metric">
        <div class="metric-label">📄 Pageviews</div>
        <div class="metric-value">${analyticsData.pageviews.toLocaleString()}</div>
      </div>
      <div class="metric">
        <div class="metric-label">⏱️ Avg Duration</div>
        <div class="metric-value">${analyticsData.avgSessionDuration.toFixed(1)}s</div>
      </div>
    </div>
    
    ${analyticsData.topPages.length > 0 ? `
    <div class="section">
      <div class="section-title">🏆 Top Pages</div>
      ${analyticsData.topPages.map((p, i) => `
        <div class="list-item">
          <span class="list-name">#${i + 1} ${p.page === '/' ? 'Home' : p.page.replace(/[/-]/g, ' ').slice(0, 40)}</span>
          <span class="list-value">${p.views} views</span>
        </div>
      `).join('')}
    </div>
    ` : ''}
    
    ${analyticsData.topCountries.length > 0 ? `
    <div class="section">
      <div class="section-title">🌍 Top Countries</div>
      ${analyticsData.topCountries.map((c, i) => `
        <div class="list-item">
          <span class="list-name">#${i + 1} ${c.country}</span>
          <span class="list-value">${c.users} users</span>
        </div>
      `).join('')}
    </div>
    ` : ''}
    
    <div style="text-align: center; margin-top: 24px;">
      <a href="https://analytics.google.com/analytics/web/" class="cta">📊 View Full Analytics</a>
    </div>
    
    <div class="footer">
      <p>This report was generated automatically. <a href="https://www.vitalpicks.org" style="color: #1a6b3a;">Visit VitalPicks →</a></p>
    </div>
  </div>
</body>
</html>
    `;
    
    // Send email via Gmail API
    const emailTo = 'gulrajb@gmail.com';
    const subject = `VitalPicks Daily Report — ${yesterday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    
    // Build RFC 2822 message
    const message = [
      `From: VitalPicks <vitalpicks@gmail.com>`,
      `To: ${emailTo}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=utf-8`,
      ``,
      emailHtml,
    ].join('\r\n');
    
    const encodedMessage = Buffer.from(message).toString('base64');
    
    const sendResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${gmailToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: encodedMessage,
      }),
    });
    
    if (!sendResponse.ok) {
      const error = await sendResponse.text();
      console.error('Gmail send error:', error);
      return new Response(JSON.stringify({ error: 'Failed to send email', details: error }), { status: 500 });
    }
    
    const result = await sendResponse.json();
    console.log('Email sent:', result.id);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Daily digest email sent',
      data: {
        sent_to: emailTo,
        visitors: analyticsData.visitors,
        sessions: analyticsData.sessions,
        pageviews: analyticsData.pageviews,
        date: dateStr,
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    
  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
}
