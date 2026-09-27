import type { IndexHistory } from '@aerofarex/shared-types';
import { apiGet } from './api/client';

/**
 * Client-side CSV of the published index family (until the backend's
 * /export/csv exists). Values keep full precision; provenance per row.
 */
export async function downloadIndexCsv() {
  const { data, meta } = await apiGet<IndexHistory[]>('index/history', { series: 'AFI,TCT-AFI,ANC-AFI' });
  const dates = data[0]?.points.map((p) => p.date) ?? [];
  const rows = [
    ['date', ...data.map((s) => s.series), 'provenance'].join(','),
    ...dates.map((date, i) => [date, ...data.map((s) => s.points[i]?.value.toFixed(4)), data[0].points[i].provenance].join(',')),
  ];
  const note = `# AeroFareX index family, base ${data[0]?.base_period} = 100, generated ${meta.generated_at}`;
  const blob = new Blob([`${note}\n${rows.join('\n')}\n`], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: `aerofarex-index-${dates.at(-1)}.csv` });
  a.click();
  URL.revokeObjectURL(url);
}
