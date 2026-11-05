import {bridgeListRows, bridgeMessageCreated, previewRows} from '../prive/wcCategoryDemo';
import {
  wcCategories,
  wcCategoryOf,
  wcListChoice,
  wcMenuEntries,
  wcPillLabel,
  wcRowInChoice,
  wcRowInMix
} from '../prive/wcCategories';

const rows = () => bridgeListRows();
const byId = (id: string) => rows().find((r) => r.id === id);
const titles = (choice: Parameters<typeof previewRows>[0]) => previewRows(choice).map((r) => r.title);

describe('website chat categories', () => {
  test('creator support is read from the nested conversation, icon null', () => {
    expect(wcCategoryOf(byId('bc_demo_creator_1'))).toEqual({
      id: 'creator-support',
      label: 'Creator Support',
      icon: null
    });
    expect(byId('bc_demo_creator_1').conversation.ref).toBe('mp-staffconv-1');
    expect(byId('bc_demo_creator_1').kind).toBe('staff');
  });

  test('fan support is read from the nested conversation', () => {
    expect(wcCategoryOf(byId('bc_demo_fan_1'))).toEqual({
      id: 'fan-support',
      label: 'Fan Support',
      icon: null
    });
    expect(byId('bc_demo_fan_1').conversation.ref).toBe('mp-fansuppconv-1');
    expect(byId('bc_demo_fan_1').conversation.fan.tg_id).toBe('100200300');
  });

  test('an https category icon is kept', () => {
    expect(wcCategoryOf(byId('bc_demo_creator_2')).icon).toBe('https://example.test/icons/creator.svg');
  });

  test('flat list fields are a category when conversation is absent', () => {
    expect(wcCategoryOf(byId('bc_demo_fan_flat'))).toEqual({
      id: 'fan-support',
      label: 'Fan Support',
      icon: null
    });
  });

  test('message.created nests the same fields on conversation', () => {
    const events = bridgeMessageCreated();
    expect(wcCategoryOf(events[0])).toEqual({id: 'creator-support', label: 'Creator Support', icon: null});
    expect(wcCategoryOf(events[1])).toEqual({id: 'fan-support', label: 'Fan Support', icon: null});
    expect(events[0].conversation.kind).toBe('staff');
  });

  test('staff without category fields stays in the ordinary mix', () => {
    const row = byId('bc_demo_staff_plain');
    expect(row.kind).toBe('staff');
    expect(row.conversation.kind).toBe('staff');
    expect(row.conversation.category_id).toBeUndefined();
    expect(wcCategoryOf(row)).toBeNull();
    expect(wcRowInMix(row)).toBe(true);
    expect(wcRowInChoice(row, 'web')).toBe(true);
    expect(wcRowInChoice(row, 'all')).toBe(true);
  });

  test('a member dm without category fields stays in Website Chats', () => {
    const row = byId('bc_demo_dm_1');
    expect(wcCategoryOf(row)).toBeNull();
    expect(wcRowInChoice(row, 'web')).toBe(true);
    expect(wcRowInChoice(row, 'cat:fan-support')).toBe(false);
  });

  test('kind staff and a url do not create a category', () => {
    expect(wcCategoryOf({
      kind: 'staff',
      site: {name: 'Example Site', domain: 'example.test'},
      source: {url: 'https://example.test/staff/creator-support'}
    })).toBeNull();
    expect(wcCategoryOf({
      category_id: 'https://example.test/fan-support',
      category_label: 'Fan Support',
      kind: 'staff'
    })).toBeNull();
  });

  test('id without a label, or a label without an id, is not a category', () => {
    expect(wcCategoryOf(byId('bc_demo_id_only'))).toBeNull();
    expect(wcCategoryOf(byId('bc_demo_label_only'))).toBeNull();
    expect(wcRowInMix(byId('bc_demo_id_only'))).toBe(true);
  });

  test('dropping category fields from a support row puts it back in the mix', () => {
    const stripped = JSON.parse(JSON.stringify(byId('bc_demo_creator_1')));
    delete stripped.conversation.category_id;
    delete stripped.conversation.category_label;
    delete stripped.conversation.category_icon;
    expect(stripped.kind).toBe('staff');
    expect(wcCategoryOf(stripped)).toBeNull();
    expect(wcRowInMix(stripped)).toBe(true);
    expect(wcRowInChoice(stripped, 'cat:creator-support')).toBe(false);
  });

  test('a complete conversation wins over different flat fields', () => {
    expect(wcCategoryOf({
      category_id: 'fan-support',
      category_label: 'Fan Support',
      kind: 'staff',
      conversation: {category_id: 'creator-support', category_label: 'Creator Support', category_icon: null, kind: 'staff'}
    }).id).toBe('creator-support');
  });

  test('an incomplete conversation falls through to flat fields', () => {
    expect(wcCategoryOf({
      category_id: 'fan-support',
      category_label: 'Fan Support',
      category_icon: '/icons/fan.svg',
      conversation: {kind: 'staff', category_id: 'creator-support'}
    })).toEqual({id: 'fan-support', label: 'Fan Support', icon: '/icons/fan.svg'});
  });

  test('unsafe icons are dropped and the category still counts', () => {
    expect(wcCategoryOf({category_id: 'fan-support', category_label: 'Fan Support', category_icon: 'javascript:alert(1)'}).icon).toBeNull();
    expect(wcCategoryOf({category_id: 'fan-support', category_label: 'Fan Support', category_icon: 'http://example.test/a.svg'}).icon).toBeNull();
    expect(wcCategoryOf({category_id: 'fan-support', category_label: 'Fan Support', category_icon: ''}).icon).toBeNull();
  });

  test('categories are one menu row each, after the fixed chats choices', () => {
    const entries = wcMenuEntries(rows());
    expect(entries.map((e) => e.label)).toEqual([
      'All Chats', 'Telegram Chats', 'Website Chats', 'Creator Support', 'Fan Support'
    ]);
    expect(entries.find((e) => e.id === 'cat:fan-support').unread).toBe(5);
    expect(entries.find((e) => e.id === 'cat:creator-support').unread).toBe(1);
    expect(entries.find((e) => e.id === 'cat:creator-support').icon).toBe('https://example.test/icons/creator.svg');
    expect(wcCategories(rows()).map((c) => c.id)).toEqual(['creator-support', 'fan-support']);
  });

  test('ordinary mixes exclude categorized chats; a category is only itself', () => {
    expect(titles('all')).toEqual([
      'Weekend plans', 'Book club', 'Jordan Blake', 'Riley Chen', 'Quinn Adler', 'Morgan Ellis'
    ]);
    expect(titles('web')).toEqual(['Jordan Blake', 'Riley Chen', 'Quinn Adler', 'Morgan Ellis']);
    expect(titles('tg')).toEqual(['Weekend plans', 'Book club']);
    expect(titles('cat:creator-support')).toEqual(['Alex Rivera', 'Nina Costa']);
    expect(titles('cat:fan-support')).toEqual(['Taylor Brooks', 'Sam Lee', 'Casey Ng']);
    expect(titles('web')).not.toContain('Alex Rivera');
    expect(titles('web')).not.toContain('Sam Lee');
    expect(titles('all')).not.toContain('Taylor Brooks');
  });

  test('stored choices round-trip, and anything else is All', () => {
    expect(wcListChoice('web')).toBe('web');
    expect(wcListChoice('tg')).toBe('tg');
    expect(wcListChoice('cat:fan-support')).toBe('cat:fan-support');
    expect(wcListChoice('cat:https://example.test')).toBe('all');
    expect(wcListChoice('staff')).toBe('all');
    expect(wcListChoice(null)).toBe('all');
    expect(wcPillLabel('cat:fan-support', wcMenuEntries(rows()))).toBe('Fan Support');
    expect(wcPillLabel('web', wcMenuEntries(rows()))).toBe('Website');
    expect(wcPillLabel('all', wcMenuEntries(rows()))).toBe('Chats');
  });
});
