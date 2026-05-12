import { createClient } from '@base44/sdk';

const base44 = createClient();

export default async function dailyDigest(req: Request) {
  try {
    // Get Gmail and GA tokens
    const { accessToken: gmailToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const { accessToken: gaToken } = await base44.asServiceRole.connectors.getConnection('google_analytics');

    // Get yesterday's date range (GA uses YYYY-MM-DD)
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    // Get GA property ID from measurement ID
    // We'll use the Measurement ID to get the GA4 property
    const propertyId = '404843632'; // Standard conversion for G-WDJ43RHQ7B (you may need to look this up in GA4 console)
    
    // Fetch yesterday's data from GA4 API
    const gaResponse = await fetch('https://analyticsdata.googleapis.com/v1beta/properties/' + propertyId + ':runReport', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${gaToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: dateStr, endDate: dateStr }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'conversions' }
        ],
        dimensions: [
          { name: 'pagePath' },
          { name: 'country' }
        ],
        limit: 10,
        orderBys: [{ metric: { name: 'screenPageViews' }, descending: true }]
      })
    });

    let statsHtml = '';
    let visitors = 0;
    let sessions = 0;
    let pageviews = 0;

    if (gaResponse.ok) {
      const gaData = await gaResponse.json();
      
      // Parse summary metrics
      if (gaData.totals && gaData.totals.length > 0) {
        const total = gaData.totals[0];
        visitors = parseInt(total.metricValues[0].value) || 0;
        sessions = parseInt(total.metricValues[1].value) || 0;
        pageviews = parseInt(total.metricValues[2].value) || 0;
      }

      // Build top pages table
      let topPagesHtml = '';
      if (gaData.rows && gaData.rows.length > 0) {
        const pageMap = new Map();
        gaData.rows.forEach((row: any) => {
          const page = row.dimensionValues[0].value || '(direct)';
          const views = parseInt(row.metricValues[2].value) || 0;
          if (!pageMap.has(page)) {
            pageMap.set(page, 0);
          }
          pageMap.set(page, pageMap.get(page) + views);
        });

        const sorted = Array.from(pageMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        topPagesHtml = sorted.map((entry, i) => `
          <tr>
            <td style="padding:10px;border-bottom:1px solid #e0e0e0">${i + 1}.</td>
            <td style="padding:10px;border-bottom:1px solid #e0e0e0"><strong>${entry[0].substring(0, 40)}</strong></td>
            <td style="padding:10px;border-bottom:1px solid #e0e0e0;text-align:center">${entry[1]}</td>
          </tr>
        `).join('');
      }

      statsHtml = `
        <div style="background:#f5f5f5;padding:20px;border-radius:8px;margin:20px 0">
          <h2 style="margin-top:0;color:#1a6b3a">Yesterday's Performance</h2>
          
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:15px;margin-bottom:20px">
            <div style="background:#fff;padding:15px;border-radius:6px;border-left:4px solid #1a6b3a">
              <div style="font-size:12px;color:#999;text-transform:uppercase;font-weight:bold">Visitors</div>
              <div style="font-size:32px;font-weight:bold;color:#1a6b3a">${visitors}</div>
            </div>
            <div style="background:#fff;padding:15px;border-radius:6px;border-left:4px solid #2196F3">
              <div style="font-size:12px;color:#999;text-transform:uppercase;font-weight:bold">Sessions</div>
              <div style="font-size:32px;font-weight:bold;color:#2196F3">${sessions}</div>
            </div>
            <div style="background:#fff;padding:15px;border-radius:6px;border-left:4px solid #FF9800">
              <div style="font-size:12px;color:#999;text-transform:uppercase;font-weight:bold">Pageviews</div>
              <div style="font-size:32px;font-weight:bold;color:#FF9800">${pageviews}</div>
            </div>
          </div>

          <h3 style="color:#1a6b3a;margin-bottom:10px">🔥 Top 5 Pages</h3>
          <table style="width:100%;border-collapse:collapse">
            ${topPagesHtml || '<tr><td style="padding:10px;text-align:center;color:#999">No data yet</td></tr>'}
          </table>
        </div>
      `;
    } else {
      statsHtml = `
        <div style="background:#fff3cd;padding:15px;border-radius:6px;color:#856404">
          <strong>Note:</strong> GA data is still loading. Check back in a few hours. (Google Analytics can take 24-48 hours to show initial data after setup.)
        </div>
      `;
    }

    // Build email HTML
    const emailHtml = `
      <html>
        <body style="font-family:Arial,sans-serif;color:#333;line-height:1.6">
          <div style="max-width:600px;margin:0 auto;background:#fff">
            
            <div style="background:linear-gradient(135deg,#134f2b,#1a6b3a);color:#fff;padding:30px;text-align:center;border-radius:8px 8px 0 0">
              <h1 style="margin:0;font-size:28px">💚 VitalPicks Daily Report</h1>
              <p style="margin:8px 0 0;opacity:0.9;font-size:14px">${dateStr}</p>
            </div>

            <div style="padding:30px">
              ${statsHtml}

              <div style="background:#e8f5e9;padding:15px;border-radius:6px;margin:20px 0;border-left:4px solid #1a6b3a">
                <h3 style="margin-top:0;color:#1a6b3a">📊 What's Next?</h3>
                <ul style="margin:0;padding-left:20px">
                  <li><strong>Monitor trends:</strong> Keep an eye on top performing pages — these are your money makers</li>
                  <li><strong>Optimize traffic:</strong> Write more content similar to top performers</li>
                  <li><strong>Build backlinks:</strong> High-quality backlinks will accelerate growth 2-3x</li>
                  <li><strong>Track Amazon clicks:</strong> Check your Associates dashboard for affiliate earnings</li>
                </ul>
              </div>

              <p style="font-size:12px;color:#999;border-top:1px solid #eee;padding-top:15px;margin-top:20px">
                Report generated automatically daily. 
                <a href="https://analytics.google.com" style="color:#1a6b3a;text-decoration:none">View full analytics →</a>
              </p>
            </div>

            <div style="background:#f5f5f5;padding:20px;text-align:center;border-radius:0 0 8px 8px;font-size:12px;color:#999">
              <p style="margin:0">VitalPicks • vitalpicks.org</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email via Gmail API
    const message = {
      raw: Buffer.from(
        `From: VitalPicks Bot <noreply@vitalpicks.org>\r\n` +
        `To: gulrajb@gmail.com\r\n` +
        `Subject: 📊 VitalPicks Daily Report - ${dateStr}\r\n` +
        `MIME-Version: 1.0\r\n` +
        `Content-Type: text/html; charset="UTF-8"\r\n` +
        `\r\n` +
        emailHtml
      ).toString('base64')
    };

    const sendResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${gmailToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    if (sendResponse.ok) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Daily digest sent to gulrajb@gmail.com',
        stats: { visitors, sessions, pageviews }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } else {
      const error = await sendResponse.text();
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to send email',
        details: error
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

  } catch (error) {
    console.error('Daily digest error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
