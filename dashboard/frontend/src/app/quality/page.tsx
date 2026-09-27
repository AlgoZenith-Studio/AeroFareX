import { ComingNext } from '@/components/ui/ComingNext';

export default function Page() {
  return (
    <ComingNext
      title={'Data quality'}
      description={'Coverage, imputation and missing data, in the open'}
      includes={['30-day coverage trend with the 90% threshold', 'Imputation by rule', 'Missing reasons and flagged outliers']}
    />
  );
}
