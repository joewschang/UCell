import React from 'react';
import {act,create} from 'react-test-renderer';
import {expect,it} from 'vitest';
import {ContentMedia,safeMediaUrl,youtubeEmbed} from '../src/ContentMedia';
import {memberEntryDestination} from '../src/entryDestination';
it('retains exact content destinations for Google/password registration and rejects external redirect attempts',()=>{
 const path='/content/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 expect(memberEntryDestination({pathname:path,search:'?mode=register&next=https://evil.invalid'})).toBe(path);
 expect(memberEntryDestination({pathname:'/content/../../evil',search:''})).toBe('/');
 expect(memberEntryDestination({pathname:'/sharing',search:''})).toBe('/sharing');
});
it('allowlists YouTube hosts and IDs without embedding arbitrary URLs',()=>{
 for(const url of ['https://youtu.be/dQw4w9WgXcQ','https://www.youtube.com/watch?v=dQw4w9WgXcQ','https://youtube.com/shorts/dQw4w9WgXcQ'])expect(youtubeEmbed(url)).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
 for(const url of ['https://youtube.com.evil.invalid/watch?v=dQw4w9WgXcQ','javascript:alert(1)','https://user:password@youtube.com/watch?v=dQw4w9WgXcQ','https://youtu.be/invalid'])expect(youtubeEmbed(url)).toBeNull();
 expect(safeMediaUrl('data:image/svg+xml,test')).toBeNull();
});
it('loads the player only after a deliberate click and always offers an external fallback',async()=>{
 let tree:any;await act(async()=>{tree=create(<ContentMedia url="https://youtu.be/dQw4w9WgXcQ" title="Example" thumbnailUrl={null}/>);});
 expect(tree.root.findAllByType('iframe')).toHaveLength(0);
 expect(tree.root.findByType('a').props.href).toBe('https://youtu.be/dQw4w9WgXcQ');
 await act(async()=>tree.root.findByType('button').props.onClick());
 expect(tree.root.findByType('iframe').props.src).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
 await act(async()=>tree.unmount());
});
