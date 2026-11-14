'use strict';
const BUILD = {"version": "4fa819d21440eeeb", "core": ["index.144x144.png", "index.180x180.png", "index.512x512.png", "index.apple-touch-icon.png", "index.audio.position.worklet.js", "index.audio.worklet.js", "index.html", "index.icon.png", "index.js", "index.manifest.json", "index.png"], "files": [{"name": "index.wasm", "mime": "application/wasm", "bytes": 39514754, "chunks": [{"name": "index.wasm.part0", "bytes": 8388608, "sha256": "8a56546b5f9b9137e80adde4400b797a5189062dee30d2505871ebd8e83987d3"}, {"name": "index.wasm.part1", "bytes": 8388608, "sha256": "62901720225c5663e708a233614396a6943357de7c98cead67f11669773dccae"}, {"name": "index.wasm.part2", "bytes": 8388608, "sha256": "c14dee0b88ada7bc7b4b48f3b8ae20e16922818417292b06082484fe183ae397"}, {"name": "index.wasm.part3", "bytes": 8388608, "sha256": "ca498a54fdb112b659cf23bc79a932e58d350a0f4cc8fabb639f230233ad6c72"}, {"name": "index.wasm.part4", "bytes": 5960322, "sha256": "219249da87c3cfda9a89fba24e253e60d6efd5191d0b108120ad93e51e54d707"}]}, {"name": "index.pck", "mime": "application/octet-stream", "bytes": 32085016, "chunks": [{"name": "index.pck.part0", "bytes": 8388608, "sha256": "e18e267ecf6a00781d2d21fedac34758703244dce55ed9ce05fd545c79b65399"}, {"name": "index.pck.part1", "bytes": 8388608, "sha256": "f57d7d6ea2b208562c97facc2780629ae338087be39af9d3a5bf9cc97a3f78f1"}, {"name": "index.pck.part2", "bytes": 8388608, "sha256": "7f9011489015656bbd2aabc212c5d576d01f52dfc57509abe88a1a4a3c48d994"}, {"name": "index.pck.part3", "bytes": 6919192, "sha256": "ee6b179f3cad363dd021ffcbb6a24706430a92c859a07e6d92cff8fb1d0769d6"}]}]};
const CACHE = 'clockwork-ipad-' + BUILD.version;
const urlFor = name => new URL(name, self.registration.scope).href;
const tell = (client, data) => { if(client) client.postMessage(data); };
let downloading = null;
self.addEventListener('install', event => event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await cache.addAll(BUILD.core.map(urlFor));
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil((async()=>{
  await self.clients.claim();
  // Never reload a running game from the worker. The installer handles version
  // changes before launching; existing gameplay can finish without interruption.
})()));
async function ready(cache){
  return (await Promise.all([...BUILD.core,...BUILD.files.map(f=>f.name)].map(n=>cache.match(urlFor(n))))).every(Boolean);
}
async function download(client){
  const cache=await caches.open(CACHE);
  const total=BUILD.files.reduce((sum,f)=>sum+f.bytes,0);
  let loaded=0;
  for(const file of BUILD.files){
    if(await cache.match(urlFor(file.name))){loaded+=file.bytes;tell(client,{type:'PROGRESS',loaded,total});continue;}
    const pieces=[];
    for(const chunk of file.chunks){
      const response=await fetch(urlFor(chunk.name),{cache:'no-store',credentials:'same-origin'});
      if(!response.ok)throw new Error('下载失败：'+response.status);
      const buffer=await response.arrayBuffer();
      if(buffer.byteLength!==chunk.bytes)throw new Error('文件大小不符，请检查网络后重试。');
      const digest=await crypto.subtle.digest('SHA-256',buffer);
      const hex=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
      if(hex!==chunk.sha256)throw new Error('文件校验失败，请重试。');
      pieces.push(buffer);loaded+=buffer.byteLength;tell(client,{type:'PROGRESS',loaded,total});
    }
    await cache.put(urlFor(file.name),new Response(new Blob(pieces,{type:file.mime}),{headers:{'Content-Type':file.mime,'Content-Length':String(file.bytes)}}));
  }
  if(!await ready(cache))throw new Error('离线文件尚不完整，请保持联网重试。');
  for(const name of await caches.keys())if(name.startsWith('clockwork-ipad-')&&name!==CACHE)await caches.delete(name);
  tell(client,{type:'READY',version:BUILD.version});
}
self.addEventListener('message',event=>{
  if(event.data?.type==='STATUS')event.waitUntil((async()=>tell(event.source,{type:'STATUS',ready:await ready(await caches.open(CACHE)),version:BUILD.version}))());
  if(event.data?.type==='INSTALL')event.waitUntil((async()=>{
    try{
      if(!downloading)downloading=download(event.source).finally(()=>{downloading=null;});
      await downloading;
      tell(event.source,{type:'READY',version:BUILD.version});
    }catch(error){tell(event.source,{type:'ERROR',message:String(error.message||error)});}
  })());
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    if(event.request.mode==='navigate'){
      const shell=await cache.match(urlFor('index.html'));
      if(shell)return shell;
    }
    const match=await cache.match(event.request,{ignoreSearch:true});
    return match||fetch(event.request);
  })());
});
