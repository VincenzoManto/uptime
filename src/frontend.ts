export function renderDashboard({ incidents, uptimeRows, uptimePerDay, uptimePerDayPerEndpoint }: 
  { uptimePerDay: any[]; incidents: any[]; uptimeRows: any[]; uptimePerDayPerEndpoint: any[] }) {
  const avgUptime = uptimeRows.length ? uptimeRows.reduce((a, b) => a + b.up_seconds, 0) / (uptimePerDay.length * 86400) : 0;
  const rowsGroupedByEndpoint = uptimePerDayPerEndpoint.reduce((acc: any, row: any) => {
    if (!acc[row.endpoint_id]) {
      acc[row.endpoint_id] = [];
    }
    acc[row.endpoint_id].push(row);
    return acc;
  }, {});
  // general card saying how we are now (last 15min by #incidents)
  const nIncidents = incidents.filter((i) => {
    const incidentDate = new Date(i.timestamp);
    const now = new Date();
    return now.getTime() - incidentDate.getTime() <= 15 * 60 * 1000; // last 15 minutes
  }).length;
  let color = 'bg-green-500';
  let bgTransparent = 'bg-green-500/20';
  let whatWeAreNowDesc = 'We\'re not aware of any issues affecting our systems.';
  if (nIncidents > 10) {
    color = 'bg-red-500';
    bgTransparent = 'bg-red-500/20';
    whatWeAreNowDesc = 'We are experiencing significant issues.';
    var whatWeAreNow = "🚨 We're down";
  } else if (nIncidents > 5) {
    color = 'bg-yellow-500';
    bgTransparent = 'bg-yellow-500/20';
    whatWeAreNowDesc = 'We are experiencing some issues.';
    var whatWeAreNow = "⚠️ We're experiencing issues";
  } else if (nIncidents > 0) {
    color = 'bg-yellow-300';
    bgTransparent = 'bg-yellow-300/20';
    whatWeAreNowDesc = 'We have some incidents.';
    var whatWeAreNow = '⚠️ We have some incidents';
  } else {
    
    var whatWeAreNow = '✅ All systems operational';
  }
  return `
<!DOCTYPE html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Uptime Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        darkMode: 'class',
        theme: {
          extend: {
            colors: {
              primary: '#4ADE80',
              background: '#111',
              card: '#000',
              border: '#333',
              accent: '#fff',
            }
          }
        }
      }
    </script>
  </head>
  <body class="bg-background text-white min-h-screen font-sans">
    <div class="container mx-auto p-6">
      <div class="relative rounded-[7px] bg-global border border-border shadow-xl mb-6">
      <div class="rounded-t-[7px] text-base font-medium px-4 py-3.5 ${bgTransparent}">
      <li class="flex items-center text-slate-50 py-0.5">
      ${whatWeAreNow}
      </li></div><div class="text-slate-100"><div class="text-sm"><div class="text-slate-50 p-4">
      ${whatWeAreNowDesc}
        </div></div></div></div>

      <div class="flex flex-col gap-3">
        ${Object.keys(rowsGroupedByEndpoint)
          .map(
            (endpoint) => {
              const last = rowsGroupedByEndpoint[endpoint]?.reverse()?.[0];
              const uptimePerc = last?.up_seconds ? (last.up_seconds / 86400) * 100 : 0;
              return `
          <div class="card rounded-2xl p-4 shadow-xl border border-border my-3">
            <h6 class="text-lg font-semibold mb-2">${endpoint?.replace(/[\/_](\w)/g, (r,b) => {
              return ' ' + b.toUpperCase();
            })?.trim()}
            <span class="text-xs opacity-50 float-right">${last?.latency?.toFixed(2)} ms - ${uptimePerc.toFixed(2)}% uptime</span>
            </h6>
            <div class="grid gap-1 text-xs" style="grid-template-columns: repeat(200, 1fr);">
              ${rowsGroupedByEndpoint[endpoint]
                .map((row: any) => {
                    const up = row.latency >= 0 ? row.latency : 10000;
                  const color = up < 2000 ? 'bg-green-500' : up < 4000 ? 'bg-yellow-400' : 'bg-red-500';
                  return `<div class="h-3 w-1 rounded ${color}" title="${row.day}: ${up}ms uptime"></div>`;
                })
                .join('')}
            </div>
          </div>
        `}
          )
          .join('')}
      </div>

      <div class="flex flex-col md:flex-row justify-between mt-10 gap-3">
        <div class="w-full md:w-1/2 card rounded-2xl p-6 shadow-xl border border-border h-full">
          <h5 class="text-lg font-semibold mb-2">Uptime History</h5>
          <div class="grid gap-1 text-xs" style="grid-template-columns: repeat(100, 1fr);">
            ${uptimePerDay
              .map(
                (uptime, index) => `
              <div class="h-3 w-1 rounded ${
                uptime.total_up_seconds > 86400 ? 'bg-green-500' : uptime.total_up_seconds > 43200 ? 'bg-yellow-400' : 'bg-red-500'
              }" title="${uptime.day}: ${uptime.total_up_seconds.toFixed(2)}s"></div>
            `
              )
              .join('')}
          </div>
        </div>

        <div class="w-full md:w-1/2 mt-6 md:mt-0 card rounded-2xl p-6 shadow-xl border border-border">
          <h5 class="text-lg font-semibold mb-2">Recent Incidents</h5>
          <ul class="pl-5 opacity-50">
          ${incidents.slice(0, 5)
            .map(
              (incident) => `
              <li>
              
              <img width="16" height="16" src="https://img.icons8.com/fluency/48/high-priority--v1.png" class="inline mr-2"/>
              ${new Date(incident.timestamp).toLocaleString()}: ${incident.message}</li>
            `
              )
              .join('')}
          </ul>
        </div>
      </div>


      <div class="mt-10 text-center opacity-50 text-sm">
        <p>Daily average uptime: <span class="font-bold">${(avgUptime * 100).toFixed(2)}%</span></p>
        <p>Incidents: <span class="font-bold">${incidents.length}</span></p>
      </div>
    </div>
  </body>
</html>
    `;
}
