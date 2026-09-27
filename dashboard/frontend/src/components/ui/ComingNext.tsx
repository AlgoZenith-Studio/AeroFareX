import React from 'react';
import Link from 'next/link';
import { Hammer } from 'lucide-react';
import { PageHeader } from './PageHeader';

/** Placeholder for pages in the next build step (same component kit as Overview). */
export const ComingNext: React.FC<{ title: string; description: string; includes: string[] }> = ({ title, description, includes }) => (
  <>
    <PageHeader title={title} subtitle={description} />
    <div className="card flex flex-col items-start gap-3 p-6">
      <span className="inline-flex items-center gap-2 rounded-full bg-surface-tint px-3 py-1 text-xs font-medium text-sky-900">
        <Hammer size={14} aria-hidden /> Building next
      </span>
      <ul className="list-disc pl-5 text-sm text-text-2">
        {includes.map((i) => <li key={i}>{i}</li>)}
      </ul>
      <Link href="/" className="btn btn-outline mt-2">Back to overview</Link>
    </div>
  </>
);
