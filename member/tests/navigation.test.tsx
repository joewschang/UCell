import { describe, expect, it } from 'vitest';
import { create } from 'react-test-renderer';
import { MemoryRouter } from 'react-router-dom';
import { MemberNavigation, memberSections, sectionMatches } from '../src/MemberNavigation';

describe('Member navigation', () => {
  it.each([
    ['/', '首頁'], ['/organization', '組織'], ['/bonuses', '收益'],
    ['/performance', '收益'], ['/shop', '商城'], ['/orders', '商城'],
    ['/me', '我的'], ['/content/article-1', '我的'], ['/notifications', '我的'],
  ])('keeps %s under %s', (path, label) => {
    const renderer = create(<MemoryRouter initialEntries={[path]}><MemberNavigation/></MemoryRouter>);
    const links = renderer.root.findAllByType('a');
    expect(links.map(link => link.children.join(''))).toEqual(['首頁', '組織', '收益', '商城', '我的']);
    expect(links.filter(link => link.props['aria-current'] === 'page').map(link => link.children.join(''))).toEqual([label]);
    renderer.unmount();
  });
  it('does not select a parent from a partial path or unknown route', () => {
    for (const path of ['/shopper', '/unknown']) {
      expect(memberSections.filter(section => sectionMatches(path, section.paths))).toHaveLength(0);
    }
  });
});
