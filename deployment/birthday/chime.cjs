const f=require('node:fs'),path=require('node:path');
const rate=22050, notes=[523.25,659.25,783.99,880,783.99,1046.50],length=rate*4,buf=Buffer.alloc(44+length*2);
buf.write('RIFF');buf.writeUInt32LE(buf.length-8,4);buf.write('WAVEfmt ',8);buf.writeUInt32LE(16,16);buf.writeUInt16LE(1,20);buf.writeUInt16LE(1,22);buf.writeUInt32LE(rate,24);buf.writeUInt32LE(rate*2,28);buf.writeUInt16LE(2,32);buf.writeUInt16LE(16,34);buf.write('data',36);buf.writeUInt32LE(length*2,40);
for(let i=0;i<length;i++){let a=0;notes.forEach((hz,j)=>{const t=i/rate-j*.42;if(t>=0)a+=(Math.sin(2*Math.PI*hz*t)+.19*Math.sin(4*Math.PI*hz*t))*Math.min(1,t/.025)*Math.exp(-4*t)});buf.writeInt16LE(Math.round(4300*a*Math.min(1,(length-i)/2000)),44+i*2)}
f.writeFileSync(path.join(__dirname,'chime.wav'),buf);
