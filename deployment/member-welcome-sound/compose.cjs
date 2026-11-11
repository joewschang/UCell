'use strict';
// Three overlapping bell notes, rendered locally as mono PCM. No third-party sample.
const fs=require('node:fs');
const rate=44100,frames=Math.round(1.12*rate),bytes=2*frames;
const wav=Buffer.alloc(44+bytes);
wav.write('RIFF');wav.writeUInt32LE(36+bytes,4);wav.write('WAVEfmt ',8);
wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);
wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);
wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(bytes,40);
const melody=[[0,587.33,.17],[.19,739.99,.15],[.43,880,.17]];
for(let i=0;i<frames;i++){
 const time=i/rate;
 let sample=0;
 for(const [start,hz,level] of melody){
  const t=time-start;if(t<0)continue;
  const phase=2*Math.PI*hz*t;
  const attack=1-Math.exp(-t/.012);
  sample+=level*attack*(Math.exp(-t/.17)*Math.sin(phase)+.19*Math.exp(-t/.095)*Math.sin(2*phase)+.07*Math.exp(-t/.075)*Math.sin(3*phase));
 }
 const fade=Math.min(1,(frames-i-1)/(.05*rate));
 wav.writeInt16LE(Math.round(sample*fade*32767),44+i*2);
}
fs.writeFileSync(process.argv[2]||'ucell-welcome.wav',wav);
