import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export const exportMatchdayReportPDF = async (data: any) => {
  const html = `
    <html>
    <head>
      <style>
        body { font-family: Arial; padding: 20px; color: #1a1a1a; }
        h1 { color: #003580; }
        h2 { color: #003580; border-bottom: 2px solid #003580; padding-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        th { background: #003580; color: white; padding: 10px; text-align: left; }
        td { padding: 8px 10px; border-bottom: 1px solid #eee; }
        tr:nth-child(even) { background: #f5f5f5; }
        .winner { background: #fff8e1 !important; font-weight: bold; }
        .stats { display: flex; gap: 16px; margin: 16px 0; }
        .stat-box { background: #f0f4ff; border-radius: 8px; padding: 12px 20px; flex: 1; text-align: center; }
        .stat-value { font-size: 24px; font-weight: bold; color: #003580; }
        .stat-label { font-size: 12px; color: #666; }
        .pending { color: #F59E0B; }
        .won { color: #10B981; }
      </style>
    </head>
    <body>
      <h1>⚽ Apuestas Mundial 2026</h1>
      <h2>${data?.matchday?.name ?? 'Jornada'} — ${data?.matchday?.date ? new Date(data.matchday.date).toLocaleDateString('es-MX') : ''}</h2>
      
      <div class="stats">
        <div class="stat-box">
          <div class="stat-value">${data?.stats?.total_active_users ?? 0}</div>
          <div class="stat-label">Total usuarios</div>
        </div>
        <div class="stat-box">
          <div class="stat-value won">${data?.stats?.users_bet ?? 0}</div>
          <div class="stat-label">Apostaron</div>
        </div>
        <div class="stat-box">
          <div class="stat-value pending">${data?.stats?.users_pending ?? 0}</div>
          <div class="stat-label">Sin apostar</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">$${Number(data?.stats?.expected_pool ?? 0).toFixed(2)}</div>
          <div class="stat-label">Pozo total</div>
        </div>
      </div>

      <h2>✅ Usuarios que apostaron</h2>
      <table>
        <tr><th>#</th><th>Usuario</th><th>Nombre</th><th>Apostado</th><th>Aciertos</th><th>Premio</th></tr>
        ${(data?.users_bet ?? []).map((u: any, i: number) => `
          <tr class="${u?.status === 'won' ? 'winner' : ''}">
            <td>${i + 1}</td>
            <td>@${u?.username ?? ''}</td>
            <td>${u?.full_name ?? ''}</td>
            <td>$${Number(u?.amount_bet ?? 0).toFixed(2)}</td>
            <td>${u?.total_correct ?? '-'}</td>
            <td>${(u?.prize_won ?? 0) > 0 ? '\uD83C\uDFC6 $' + Number(u.prize_won).toFixed(2) : '-'}</td>
          </tr>
        `).join('')}
      </table>

      <h2>⏳ Usuarios que NO apostaron</h2>
      <table>
        <tr><th>#</th><th>Usuario</th><th>Nombre</th><th>Saldo</th></tr>
        ${(data?.users_pending ?? []).map((u: any, i: number) => `
          <tr>
            <td>${i + 1}</td>
            <td>@${u?.username ?? ''}</td>
            <td>${u?.full_name ?? ''}</td>
            <td>$${Number(u?.balance ?? 0).toFixed(2)}</td>
          </tr>
        `).join('')}
      </table>
      
      <p style="color:#999; font-size:11px; margin-top:32px;">
        Generado el ${new Date().toLocaleString('es-MX')} · Apuestas Mundial 2026
      </p>
    </body>
    </html>
  `;

  if (Platform.OS === 'web') {
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); win.print(); }
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: `Reporte ${data?.matchday?.name ?? 'Jornada'}`,
  });
};

export const exportWinnersPDF = async (data: any) => {
  const html = `
    <html>
    <head>
      <style>
        body { font-family: Arial; padding: 20px; }
        h1 { color: #003580; }
        h2 { color: #003580; border-bottom: 2px solid #003580; padding-bottom: 8px; }
        .podio { text-align: center; padding: 20px; background: #fff8e1; border-radius: 12px; margin: 16px 0; }
        .oro { font-size: 32px; font-weight: bold; color: #B8860B; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        th { background: #003580; color: white; padding: 10px; text-align: center; }
        td { padding: 8px 10px; border-bottom: 1px solid #eee; text-align: center; }
        .winner-row { background: #fff8e1; font-weight: bold; }
        .ghost-row { color: #999; }
      </style>
    </head>
    <body>
      <h1>\uD83C\uDFC6 Resultados — ${data?.matchday?.name ?? ''}</h1>
      <div class="podio">
        <div class="oro">\uD83C\uDFC6 ${data?.winners_count ?? 0} Ganador(es)</div>
        <div>Premio por ganador: $${Number(data?.prize_per_winner ?? 0).toFixed(2)}</div>
        <div>Pozo total: $${Number(data?.matchday?.total_pool ?? 0).toFixed(2)} · Aciertos máximos: ${data?.max_correct ?? 0}</div>
      </div>
      <h2>Clasificación completa</h2>
      <table>
        <tr><th>Pos</th><th>Usuario</th><th>Aciertos</th><th>Apostado</th><th>Premio</th></tr>
        ${(data?.all_tickets ?? []).map((t: any) => `
          <tr class="${t?.status === 'won' ? 'winner-row' : (t?.amount_bet ?? 0) === 0 ? 'ghost-row' : ''}">
            <td>${(t?.amount_bet ?? 0) > 0 ? (t?.position ?? '-') : '-'}</td>
            <td>@${t?.username ?? ''}</td>
            <td>${t?.total_correct ?? 0}</td>
            <td>${(t?.amount_bet ?? 0) > 0 ? '$' + Number(t.amount_bet).toFixed(2) : 'No apostó'}</td>
            <td>${(t?.prize_won ?? 0) > 0 ? '\uD83C\uDFC6 $' + Number(t.prize_won).toFixed(2) : '-'}</td>
          </tr>
        `).join('')}
      </table>
      <p style="color:#999; font-size:11px; margin-top:32px;">Generado el ${new Date().toLocaleString('es-MX')}</p>
    </body>
    </html>
  `;

  if (Platform.OS === 'web') {
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); win.print(); }
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
};
