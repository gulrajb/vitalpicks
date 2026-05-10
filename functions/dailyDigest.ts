import { createClient } from '@base44/sdk';

const base44 = createClient();

interface GAData {
  visitors: number;
  sessions: number;
  pageviews: number;
  bounceRate: string;
  avgSessionDuration: string;
  topPages: Array<{ page: string; views: number }>;
  topCountries: Array<{ country: string; users: number }>;
}

async function getGAData(): Promise<GAData> {
  const { accessToken } = await base44.asServiceRole.connectors.getConnection('google_analytics');
  
  // Get property ID from GA4 — vitalpicks.org should have one
  // For now, using a placeholder — you'd need to get this from your GA4 admin
  const propertyId = '378159726'; // This should match your GA4 property
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];
  
  try {
    // Fetch today's data from GA4 API
    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
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
          limit: '25',
        }),
      }
    );

    if (!response.ok) {
      console.error('GA API error:', await response.text());
      // Return placeholder if API fails
      return {
        visitors: 0,
        sessions: 0,
        pageviews: 0,
        bounceRate: 'N/A',
        avgSessionDuration: 'N/A',
        topPages: [],
        topCountries: [],
      };
    }

    const data = await response.json();
    
    // Parse GA4 response
    const rows = data.rows || [];
    const totals = data.totals?.[0] || {};
    
    const visitors = parseInt(totals.metricValues?.[0]?.value || '0');
    const sessions = parseInt(totals.metricValues?.[1]?.value || '0');
    const pageviews = parseInt(totals.metricValues?.[2]?.value || '0');
    const bounceRate = (parseFloat(totals.metricValues?.[3]?.value || '0') || 0).toFixed(1) + '%';
    const avgSessionDuration = (parseFloat(totals.metricValues?.[4]?.value || '0') || 0).toFixed(0) + 's';
    
    // Extract top pages (dimension 0 = pagePath)
    const pageMap = new Map<string, number>();
    const countryMap = new Map<string, number>();
    
    rows.forEach((row: any) => {
      const pagePath = row.dimensionValues?.[0]?.value || '/';
      const country = row.dimensionValues?.[1]?.value || 'Unknown';
      const views = parseInt(row.metricValues?.[2]?.value || '0');
      const users = parseInt(row.metricValues?.[0]?.value || '0');
      
      pageMap.set(pagePath, (pageMap.get(pagePath) || 0) + views);
      countryMap.set(country, (countryMap.get(country) || 0) + users);
    });
    
    const topPages = Array.from(pageMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([page, views]) => ({ page: page === '/' ? 'Homepage' : page, views }));
    
    const topCountries = Array.from(countryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([country, users]) => ({ country, users }));
    
    return { visitors, sessions, pageviews, bounceRate, avgSessionDuration, topPages, topCountries };
  } catch (e) {
    console.error('GA fetch error:', e);
    return {
      visitors: 0,
      sessions: 0,
      pageviews: 0,
      bounceRate: 'N/A',
      avgSessionDuration: 'N/A',
      topPages: [],
      topCountries: [],
    };
  }
}

async function sendEmail(to: string, gaData: GAData): Promise<void> {
  const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  
  const htmlBody = `
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f7faf8;">
  <div style="background: linear-gradient(135deg, #134f2b 0%, #1a6b3a 50%, #2d9b5a 100%); color: white; padding: 30px; border-radius: 14px; margin-bottom: 24px; text-align: center;">
    <h1 style="margin: 0; font-size: 28px; font-weight: 900;">📊 VitalPicks Daily Report</h1>
    <p style="margin: 8px 0 0; opacity: 0.9;">${dateStr}</p>
  </div>

  <div style="background: white; border-radius: 14px; padding: 24px; margin-bottom: 20px; border: 1px solid #e2ece5; box-shadow: 0 2px 8px rgba(0,0,0,.05);">
    <h2 style="margin: 0 0 20px; font-size: 18px; font-weight: 800; color: #1a6b3a;">Today's Metrics</h2>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
      <div style="background: #e8f5ee; padding: 16px; border-radius: 10px; border-left: 4px solid #1a6b3a;">
        <div style="font-size: 12px; font-weight: 800; color: #1a6b3a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Visitors</div>
        <div style="font-size: 32px; font-weight: 900; color: #1a6b3a;">${gaData.visitors.toLocaleString()}</div>
      </div>
      <div style="background: #e3f2fd; padding: 16px; border-radius: 10px; border-left: 4px solid #1e88e5;">
        <div style="font-size: 12px; font-weight: 800; color: #1e88e5; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Sessions</div>
        <div style="font-size: 32px; font-weight: 900; color: #1e88e5;">${gaData.sessions.toLocaleString()}</div>
      </div>
      <div style="background: #fff8e1; padding: 16px; border-radius: 10px; border-left: 4px solid #f0a500;">
        <div style="font-size: 12px; font-weight: 800; color: #f0a500; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Pageviews</div>
        <div style="font-size: 32px; font-weight: 900; color: #f0a500;">${gaData.pageviews.toLocaleString()}</div>
      </div>
      <div style="background: #fce4ec; padding: 16px; border-radius: 10px; border-left: 4px solid #e91e63;">
        <div style="font-size: 12px; font-weight: 800; color: #e91e63; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Bounce Rate</div>
        <div style="font-size: 32px; font-weight: 900; color: #e91e63;">${gaData.bounceRate}</div>
      </div>
    </div>
    
    <div style="border-top: 1px solid #e2ece5; padding-top: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
      <div>
        <div style="font-size: 12px; font-weight: 800; color: #1a6b3a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Avg Session Duration</div>
        <div style="font-size: 20px; font-weight: 900; color: #1a6b3a;">${gaData.avgSessionDuration}</div>
      </div>
      <div>
        <div style="font-size: 12px; font-weight: 800; color: #1a6b3a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Estimated Earnings</div>
        <div style="font-size: 20px; font-weight: 900; color: #1a6b3a;">$0.00*</div>
        <div style="font-size: 11px; color: #5a6672; margin-top: 4px;">*Add to Associates account</div>
      </div>
    </div>
  </div>

  ${gaData.topPages.length > 0 ? `
  <div style="background: white; border-radius: 14px; padding: 24px; margin-bottom: 20px; border: 1px solid #e2ece5;">
    <h2 style="margin: 0 0 16px; font-size: 18px; font-weight: 800; color: #1a6b3a;">🔝 Top Pages</h2>
    <div style="display: flex; flex-direction: column; gap: 10px;">
      ${gaData.topPages.map((p, i) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f7faf8; border-radius: 8px; border-left: 3px solid #1a6b3a;">
          <div style="flex: 1;">
            <div style="font-weight: 700; color: #1a6b3a; margin-bottom: 2px;">#${i + 1} ${p.page}</div>
            <div style="font-size: 12px; color: #5a6672;">${p.views} views</div>
          </div>
        </div>
      `).join('')}
    </div>
  </div>
  ` : ''}

  ${gaData.topCountries.length > 0 ? `
  <div style="background: white; border-radius: 14px; padding: 24px; margin-bottom: 20px; border: 1px solid #e2ece5;">
    <h2 style="margin: 0 0 16px; font-size: 18px; font-weight: 800; color: #1a6b3a;">🌍 Top Countries</h2>
    <div style="display: flex; flex-direction: column; gap: 10px;">
      ${gaData.topCountries.map((c, i) => `
        <div style="display: flex; justify-content: space-between; padding: 10px 12px; background: #f7faf8; border-radius: 8px;">
          <span style="font-weight: 700; color: #1a6b3a;">${c.country}</span>
          <span style="color: #5a6672; font-weight: 600;">${c.users} users</span>
        </div>
      `).join('')}
    </div>
  </div>
  ` : ''}

  <div style="background: #f0a50015; border: 1px solid #f0a500; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
    <p style="margin: 0; font-size: 13px; color: #5a6672; line-height: 1.6;">
      <strong>💡 Next steps:</strong> Check <a href="https://analytics.google.com" style="color: #1a6b3a; font-weight: 700;">Google Analytics</a> for detailed insights. Set up <a href="https://associates.amazon.com" style="color: #1a6b3a; font-weight: 700;">Amazon Associates</a> daily email reports for earnings data.
    </p>
  </div>

  <div style="text-align: center; font-size: 12px; color: #5a6672; padding-top: 16px; border-top: 1px solid #e2ece5;">
    <p style="margin: 0;">This is your automated daily VitalPicks report. <a href="https://vitalpicks.org" style="color: #1a6b3a; text-decoration: none; font-weight: 700;">Visit your site →</a></p>
  </div>
</body>
</html>
  `.trim();

  const subject = `📊 VitalPicks Daily Report — ${gaData.visitors} visitors on ${dateStr}`;
  
  // Build MIME message
  const boundary = '===============' + Math.random().toString(36).substring(2, 15) + '==';
  const mimeBody = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    htmlBody,
    `--${boundary}--`,
  ].join('\r\n');

  const encodedMessage = Buffer.from(mimeBody).toString('base64');

  await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodedMessage }),
  });
}

export default async function handler(req: any) {
  try {
    const gaData = await getGAData();
    await sendEmail('gulrajb@gmail.com', gaData);
    return new Response(JSON.stringify({ success: true, visitors: gaData.visitors }), { status: 200 });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), { status: 500 });
  }
}
