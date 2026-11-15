import type { Metadata } from 'next';
import { JobsBrowseView } from '@/components/jobs/JobsBrowseView';

export const metadata: Metadata = { title: 'Jobs in Delta State' };

export default function JobsPage() {
  return <JobsBrowseView />;
}
