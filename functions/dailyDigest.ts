import { createClient } from '@base44/sdk';

const base44 = createClient({
  appId: process.env.BASE44_APP_ID,
  token: process.env.BASE44_SERVICE_TOKEN,
  serverUrl: process.env.BASE44_API_URL,
});

interface ReportRow {
  dimensionValues: Array<{ value: string }>;
  metricValues: Array<{ value: string }>;
}

async function getGAData() {
  try {
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('google_analytics');
    
    // Get property ID — vitalpicks.org GA4 property
    // For now, we'll use a hardcoded property ID. In production, you'd store this.
    const propertyId = '463057689'; // This is the GA4 property ID for vitalpicks.org
    
    // Yesterday's date range
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const dateStr = yesterday.toISOString().split('T')[0];
    
    // GA Data API v1 request
    const payload = {
      dateRanges: [{ startDate: dateStr, endDate: dateStr }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' }
      ],
      dimensions: [{ name: 'pagePath' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, descending: true }],
      limit: '10'
    };

    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('GA API error:', err);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (e) {
    console.error('Error fetching GA data:', e);
    return null;
  }
}

async function sendEmail(subject: string, html: string) {
  try {
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    // Build RFC 2822 message
    const message = [
      `From: noreply@vitalpicks.org`,
      `To: gulrajb@gmail.com`,
      `Subject: ${subject}`,
      `Content-Type: text/html; charset=utf-8`,
      ``,
      html
    ].join('\r\n');

    const encoded = Buffer.from(message).toString('base64');

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encoded }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Gmail API error:', err);
      return false;
    }

    return true;
  } catch (e) {
    console.error('Error sending email:', e);
    return false;
  }
}

export async function dailyDigest(req: Request) {
  try {
    const gaData = await getGAData();

    if (!gaData || !gaData.rows) {
      // Send error email
      const errorHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a6b3a;">VitalPicks Daily Digest</h2>
          <p>Unable to fetch analytics data today. Please check your Google Analytics connection.</p>
          <p style="color: #999; font-size: 12px;">Sent: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Calcutta' })}</p>
        </div>
      `;
      await sendEmail('VitalPicks Daily Digest — Error', errorHtml);
      return new Response(JSON.stringify({ success: false, message: 'No GA data' }), { status: 200 });
    }

    // Extract metrics
    const totals = gaData.totals?.[0] || {};
    const users = totals.metricValues?.[0]?.value || '0';
    const sessions = totals.metricValues?.[1]?.value || '0';
    const pageviews = totals.metricValues?.[2]?.value || '0';
    const bounceRate = (parseFloat(totals.metricValues?.[3]?.value || '0') * 100).toFixed(1);
    const avgDuration = (parseFloat(totals.metricValues?.[4]?.value || '0') / 60).toFixed(1);

    // Top 10 pages
    const topPages = (gaData.rows || [])
      .slice(0, 10)
      .map((row: ReportRow, idx: number) => {
        const path = row.dimensionValues[0]?.value || '/';
        const pv = row.metricValues[2]?.value || '0';
        return `<tr><td style="padding: 8px; border-bottom: 1px solid #eee;">${idx + 1}</td><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>${path}</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${pv}</td></tr>`;
      })
      .join('');

    const yesterday = new Date(new Date().getTime() - 24 * 60 * 60 * 1000).toLocaleDateString('en-IN');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f7faf8;">
        <div style="background: linear-gradient(135deg, #134f2b, #1a6b3a); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
          <h2 style="margin: 0; font-size: 24px;">📊 VitalPicks Daily Digest</h2>
          <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 14px;">Yesterday's Performance: ${yesterday}</p>
        </div>

        <div style="background: white; border-radius: 10px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <h3 style="margin-top: 0; color: #1a6b3a;">📈 Key Metrics</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 12px; background: #e8f5ee; border-radius: 5px; text-align: center; margin-right: 10px;">
                <div style="font-size: 28px; font-weight: bold; color: #1a6b3a;">${users}</div>
                <div style="font-size: 12px; color: #5a6672; margin-top: 4px;">Visitors</div>
              </td>
              <td style="padding: 12px; background: #e8f5ee; border-radius: 5px; text-align: center; margin-right: 10px;">
                <div style="font-size: 28px; font-weight: bold; color: #1a6b3a;">${sessions}</div>
                <div style="font-size: 12px; color: #5a6672; margin-top: 4px;">Sessions</div>
              </td>
              <td style="padding: 12px; background: #e8f5ee; border-radius: 5px; text-align: center;">
                <div style="font-size: 28px; font-weight: bold; color: #1a6b3a;">${pageviews}</div>
                <div style="font-size: 12px; color: #5a6672; margin-top: 4px;">Pageviews</div>
              </td>
            </tr>
          </table>
          <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2ece5;">
            <p style="margin: 8px 0; font-size: 13px;"><strong>Bounce Rate:</strong> ${bounceRate}%</p>
            <p style="margin: 8px 0; font-size: 13px;"><strong>Avg Session Duration:</strong> ${avgDuration} min</p>
          </div>
        </div>

        <div style="background: white; border-radius: 10px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <h3 style="margin-top: 0; color: #1a6b3a;">🏆 Top 10 Pages</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #e8f5ee;">
                <th style="padding: 10px; text-align: left; font-weight: 700; font-size: 12px; color: #1a6b3a; border-bottom: 2px solid #1a6b3a;">#</th>
                <th style="padding: 10px; text-align: left; font-weight: 700; font-size: 12px; color: #1a6b3a; border-bottom: 2px solid #1a6b3a;">Page</th>
                <th style="padding: 10px; text-align: right; font-weight: 700; font-size: 12px; color: #1a6b3a; border-bottom: 2px solid #1a6b3a;">Views</th>
              </tr>
            </thead>
            <tbody>
              ${topPages}
            </tbody>
          </table>
        </div>

        <div style="background: #fff9e6; border-left: 4px solid #f0a500; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
          <p style="margin: 0; font-size: 13px; color: #5a6672;">
            <strong>💡 Tip:</strong> Check your Amazon Associates dashboard for click-through and earnings data. Google Analytics shows traffic; Associates shows conversions.
          </p>
        </div>

        <div style="text-align: center; padding-top: 15px; border-top: 1px solid #e2ece5; font-size: 12px; color: #999;">
          <p style="margin: 0;">VitalPicks Daily Digest • ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Calcutta' })}</p>
          <p style="margin: 5px 0 0 0;"><a href="https://analytics.google.com/" style="color: #1a6b3a; text-decoration: none;">View full analytics →</a></p>
        </div>
      </div>
    `;

    const sent = await sendEmail('VitalPicks Daily Digest — Yesterday\'s Stats', html);

    return new Response(
      JSON.stringify({ success: sent, users, sessions, pageviews }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Daily digest error:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
