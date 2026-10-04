import type { Metadata } from 'next';
import DoorMode from '@/components/DoorMode';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Door mode — Emanuel Ungaro',
};

export default function DoorPage() {
  return <DoorMode />;
}
