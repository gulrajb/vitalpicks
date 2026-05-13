import { createClient } from '@base44/sdk';

interface AnalyticsResponse {
  rows?: Array<{ values: string[] }>;
  rowCount: number;
}

interface EmailPayload {
  to: string;
  subject: string;
  body: string;
  mimeType?: string;
}

async function sendEmail(
  accessToken: string,
  to: string,
  subject: string,
  htmlBody: string
): Promise<void> {
  const boundary = 'boundary_' + Math.random().toString(36).slice(2);
  
  const mimeMessage = [
    `From: me`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    Buffer.from(htmlBody).toString('base64'),
    `--${boundary}--`
  ].join('\r\n');

  const encoded = Buffer.from(mimeMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encoded }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gmail send failed: ${response.status} ${error}`);
  }
}

async function getGAData(
  accessToken: string,
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<any> {
  const response = await fetch(
    'https://analyticsdata.googleapis.com/v1beta/properties/' + propertyId + ':runReport',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'bounceRate' },
        ],
        dimensions: [{ name: 'pagePath' }],
        limit: '5',
        orderBys: [{ metric: { name: 'screenPageViews' }, desc: true }],
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GA4 API error: ${response.status} ${error}`);
  }

  return response.json();
}

async function getCountryData(
  accessToken: string,
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<any> {
  const response = await fetch(
    'https://analyticsdata.googleapis.com/v1beta/properties/' + propertyId + ':runReport',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
        dimensions: [{ name: 'country' }],
        limit: '5',
        orderBys: [{ metric: { name: 'activeUsers' }, desc: true }],
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GA4 country API error: ${response.status} ${error}`);
  }

  return response.json();
}

export default async function dailyDigest(req: Request): Promise<Response> {
  try {
    const base44 = createClient({
      appId: process.env.BASE44_APP_ID!,
      token: process.env.BASE44_SERVICE_TOKEN!,
      serverUrl: process.env.BASE44_API_URL!,
    });

    // Get Gmail access token
    const gmailConn = await base44.asServiceRole.connectors.getConnection('gmail');
    const gmailToken = gmailConn.accessToken;

    // Get Google Analytics access token
    const gaConn = await base44.asServiceRole.connectors.getConnection('google_analytics');
    const gaToken = gaConn.accessToken;

    // Calculate dates (yesterday)
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const startDate = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD
    const endDate = yesterday.toISOString().split('T')[0];

    // Property ID from GA measurement ID — extract number
    // G-WDJ43RHQ7B -> property 456389734 (you'll need to map this)
    // For now, use a placeholder — user needs to provide their GA4 Property ID
    const propertyId = process.env.GA_PROPERTY_ID || '456389734';

    // Fetch GA data
    const pageData = await getGAData(gaToken, propertyId, startDate, endDate);
    const countryData = await getCountryData(gaToken, propertyId, startDate, endDate);

    // Parse results
    let visitors = '0';
    let sessions = '0';
    let pageviews = '0';
    let bounceRate = '0%';
    let topPages = '<tr><td colspan="2" style="text-align:center;padding:10px;color:#999;">No data yet</td></tr>';
    let topCountries = '<tr><td colspan="2" style="text-align:center;padding:10px;color:#999;">No data yet</td></tr>';

    if (pageData.rows && pageData.rows.length > 0) {
      // First row has aggregate metrics
      const firstRow = pageData.rows[0];
      if (firstRow.values) {
        pageviews = firstRow.values[2] || '0'; // screenPageViews is 3rd metric
        bounceRate = (parseFloat(firstRow.values[3] || '0')).toFixed(1) + '%';
        visitors = firstRow.values[0] || '0';
        sessions = firstRow.values[1] || '0';
      }

      // Build top pages table
      topPages = pageData.rows
        .slice(0, 5)
        .map((row: any, idx: number) => {
          const pagePath = row.dimensions?.[0] || '/';
          const pv = row.values?.[2] || '0';
          return `<tr style="border-bottom:1px solid #eee;"><td style="padding:8px;font-weight:600;">${pagePath}</td><td style="padding:8px;text-align:right;color:#1a6b3a;">${pv}</td></tr>`;
        })
        .join('');
    }

    if (countryData.rows && countryData.rows.length > 0) {
      topCountries = countryData.rows
        .slice(0, 5)
        .map((row: any) => {
          const country = row.dimensions?.[0] || 'Unknown';
          const users = row.values?.[0] || '0';
          return `<tr style="border-bottom:1px solid #eee;"><td style="padding:8px;">${country}</td><td style="padding:8px;text-align:right;color:#1a6b3a;font-weight:600;">${users}</td></tr>`;
        })
        .join('');
    }

    // Format HTML email
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #134f2b, #1a6b3a); color: white; padding: 24px; border-radius: 8px; margin-bottom: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 4px 0 0; opacity: 0.9; font-size: 14px; }
    .section { background: white; border: 1px solid #e2ece5; border-radius: 8px; padding: 20px; margin-bottom: 16px; }
    .section h2 { font-size: 16px; color: #1a6b3a; margin: 0 0 14px; border-bottom: 2px solid #e8f5ee; padding-bottom: 10px; }
    .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
    .stat { background: #f7faf8; padding: 12px; border-radius: 6px; }
    .stat-value { font-size: 24px; font-weight: 900; color: #1a6b3a; }
    .stat-label { font-size: 12px; color: #5a6672; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; }
    .footer { text-align: center; font-size: 12px; color: #999; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 VitalPicks Daily Report</h1>
      <p>${startDate} — Yesterday's Performance</p>
    </div>

    <div class="section">
      <h2>📈 Key Metrics</h2>
      <div class="stats">
        <div class="stat">
          <div class="stat-value">${visitors}</div>
          <div class="stat-label">Visitors</div>
        </div>
        <div class="stat">
          <div class="stat-value">${sessions}</div>
          <div class="stat-label">Sessions</div>
        </div>
        <div class="stat">
          <div class="stat-value">${pageviews}</div>
          <div class="stat-label">Pageviews</div>
        </div>
        <div class="stat">
          <div class="stat-value">${bounceRate}</div>
          <div class="stat-label">Bounce Rate</div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>🔥 Top Pages</h2>
      <table>
        <thead>
          <tr style="background: #f7faf8; border-bottom: 2px solid #e2ece5;">
            <th style="padding: 10px; text-align: left; font-weight: 700; font-size: 12px; color: #1a6b3a;">Page</th>
            <th style="padding: 10px; text-align: right; font-weight: 700; font-size: 12px; color: #1a6b3a;">Views</th>
          </tr>
        </thead>
        <tbody>
          ${topPages}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>🌍 Top Countries</h2>
      <table>
        <thead>
          <tr style="background: #f7faf8; border-bottom: 2px solid #e2ece5;">
            <th style="padding: 10px; text-align: left; font-weight: 700; font-size: 12px; color: #1a6b3a;">Country</th>
            <th style="padding: 10px; text-align: right; font-weight: 700; font-size: 12px; color: #1a6b3a;">Visitors</th>
          </tr>
        </thead>
        <tbody>
          ${topCountries}
        </tbody>
      </table>
    </div>

    <div class="footer">
      <p>VitalPicks Analytics • Automated daily report</p>
      <p style="margin: 8px 0 0; color: #ccc;">Data from Google Analytics 4</p>
    </div>
  </div>
</body>
</html>
    `;

    // Send email
    await sendEmail(gmailToken, 'gulrajb@gmail.com', `VitalPicks Daily Report — ${startDate}`, htmlBody);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Daily digest sent successfully',
        data: {
          date: startDate,
          visitors,
          sessions,
          pageviews,
          bounceRate,
          topPagesCount: pageData.rows?.length || 0,
          topCountriesCount: countryData.rows?.length || 0,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Daily digest error:', message);

    return new Response(
      JSON.stringify({
        success: false,
        error: message,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
