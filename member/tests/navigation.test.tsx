import { describe, expect, it } from 'vitest';
import { create, type ReactTestInstance } from 'react-test-renderer';
import { MemoryRouter } from 'react-router-dom';
import { MemberNavigation, memberSections, sectionMatches } from '../src/MemberNavigation';

// Read nested label text while ignoring decorative icons.
const labelText = (node: ReactTestInstance | string): string => typeof node === 'string'
  ? node : node.props['aria-hidden'] === true || node.props['aria-hidden'] === 'true'
    ? '' : node.children.map(labelText).join('');

describe('Member navigation', () => {
  it.each([
    ['/', '首頁'], ['/organization', '經營'], ['/bonuses', '經營'],
    ['/performance', '經營'], ['/shop', '商城'], ['/orders', '我的'],
    ['/me', '我的'], ['/content/article-1', '探索'], ['/events', '探索'], ['/learning','探索'], ['/sharing','經營'], ['/growth','經營'], ['/repurchase','經營'], ['/notifications', '我的'],
  ])('keeps %s under %s', (path, label) => {
    const renderer = create(<MemoryRouter initialEntries={[path]}><MemberNavigation/></MemoryRouter>);
    const links = renderer.root.findAllByType('a');
    expect(links.map(labelText)).toEqual(['首頁', '商城', '探索', '經營', '我的']);
    expect(links.filter(link => link.props['aria-current'] === 'page').map(labelText)).toEqual([label]);
    renderer.unmount();
  });
  it('does not select a parent from a partial path or unknown route', () => {
    for (const path of ['/shopper', '/unknown']) {
      expect(memberSections.filter(section => sectionMatches(path, section.paths))).toHaveLength(0);
    }
  });
});
