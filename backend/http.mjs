import { createReadStream } from 'node:fs';
import { stat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { ApiError } from './core.mjs';
export const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.zip':'application/zip','.mp4':'video/mp4','.webm':'video/webm','.mkv':'video/x-matroska','.mp3':'audio/mpeg','.m4a':'audio/mp4'};
export function json(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
export async function readJson(req){
 if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))throw new ApiError(415,'Send JSON request data.','UNSUPPORTED_MEDIA_TYPE');
 const chunks=[];let bytes=0;
 for await(const chunk of req){const data=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);bytes+=data.length;if(bytes>8192)throw new ApiError(413,'Request too large.','PAYLOAD_TOO_LARGE');chunks.push(data);}
 // Decode once: HTTP chunks can split a multibyte UTF-8 password or other value.
 try{const value=JSON.parse(Buffer.concat(chunks,bytes).toString('utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value;}catch{throw new ApiError(400,'Send a valid JSON object.','INVALID_JSON');}
}
export async function serveStatic(req,res,url,directory){
 if(!['GET','HEAD'].includes(req.method))throw new ApiError(405,'Method not allowed.','METHOD_NOT_ALLOWED');
 const relative=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).slice(1),file=path.resolve(directory,relative);
 if(!file.startsWith(directory+path.sep))throw new ApiError(404,'Not found.','NOT_FOUND');
 const details=await stat(file).catch(()=>null);if(!details?.isFile())throw new ApiError(404,'Not found.','NOT_FOUND');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://i.ytimg.com; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'");
 res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':details.size,'Cache-Control':path.extname(file)==='.html'?'no-cache':'public,max-age=300'});
 if(req.method==='HEAD')return res.end();createReadStream(file).on('error',()=>res.destroy()).pipe(res);
}
export async function streamAsset(req,res,asset,dataDir){
 const filename=await realpath(asset.file_path).catch(()=>null),root=await realpath(dataDir);
 if(!filename||!filename.startsWith(root+path.sep))throw new ApiError(410,'The prepared file is no longer available.','FILE_UNAVAILABLE');
 const details=await stat(filename);if(details.size!==Number(asset.size_bytes))throw new ApiError(410,'The prepared file failed its integrity check.','FILE_UNAVAILABLE');
 let start=0,end=details.size-1,partial=false;
 if(req.headers.range){const m=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);if(!m||(!m[1]&&!m[2]))throw new ApiError(416,'Invalid byte range.','INVALID_RANGE');if(!m[1])start=Math.max(0,details.size-Number(m[2]));else{start=Number(m[1]);if(m[2])end=Math.min(end,Number(m[2]));}if(start>end||start>=details.size||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)){res.setHeader('Content-Range',`bytes */${details.size}`);throw new ApiError(416,'Byte range unavailable.','INVALID_RANGE');}partial=true;}
 const headers={'Content-Type':types['.'+asset.extension]||'application/octet-stream','Content-Length':end-start+1,'Accept-Ranges':'bytes','Cache-Control':'private,no-store','X-Content-SHA256':asset.sha256,'Content-Disposition':`attachment; filename="download.${asset.extension}"; filename*=UTF-8''${encodeURIComponent(asset.filename).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16))}`};
 if(partial)headers['Content-Range']=`bytes ${start}-${end}/${details.size}`;
 res.writeHead(partial?206:200,headers);if(req.method==='HEAD')return res.end();
 const stream=createReadStream(filename,{start,end,highWaterMark:256*1024});res.on('close',()=>stream.destroy());stream.on('error',()=>res.destroy());stream.pipe(res);
}
