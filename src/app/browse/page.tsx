import { BrowseExplorer } from '@/components/filters/BrowseExplorer';
import { Container } from '@/components/layout/Section';
import { getSnapshot } from '@/lib/data/load';

export const metadata = {
  title: 'Browse',
  description: 'Search and filter every story, event, menu and publication BruinWeb has loaded.',
};

export default async function BrowsePage() {
  const { items } = await getSnapshot();

  return (
    <Container className="py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="font-display text-3xl sm:text-4xl">Browse everything</h1>
        <p className="mt-2 max-w-2xl text-[var(--ink-muted)]">
          {items.length} items from every channel, searchable and filterable. Search runs entirely
          in your browser against the content loaded with this page — nothing is sent anywhere.
        </p>
      </header>

      <BrowseExplorer items={items} />
    </Container>
  );
}
