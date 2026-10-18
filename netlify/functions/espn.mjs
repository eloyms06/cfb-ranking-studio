// API same-origin for CFB Ranking Studio. Does not bypass ESPN access restrictions.
const BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football';
const ALLOWED = [
  /^\/teams$/,
  /^\/rankings$/,
  /^\/teams\/\d+$/,
  /^\/teams\/\d+\/schedule$/
];
const VALID_PARAMS = new Set(['season','week','seasontype','groups','limit']);
const cache = new Map();

export default async (request) => {
  if(request.method !== 'GET') return json({message:'Método no permitido'},405);
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/espn/, '') || '/';
  if(!ALLOWED.some(rule=>rule.test(path))) return json({message:'Ruta no permitida'},404);
  const query = new URLSearchParams();
  for(const [key,value] of url.searchParams){
    if(!VALID_PARAMS.has(key) || !/^\d{1,4}$/.test(value)) return json({message:'Parámetro no permitido'},400);
    query.set(key,value);
  }
  const upstream = BASE+path+(query.size?'?'+query:'');
  const fresh = cache.get(upstream);
  const ttl = path==='/rankings'?300000: path==='/teams'?86400000:180000;
  if(fresh && Date.now()-fresh.stamp<ttl) return json(fresh.body,200,ttl);
  try {
    const response = await fetch(upstream, {
      headers: {
        accept:'application/json',
        'user-agent':'CFBRankingStudio/1.0 (+public data viewer)'
      },
      signal:AbortSignal.timeout(8500)
    });
    if(!response.ok){
      return json({message: response.status===403?'ESPN también ha rechazado la petición del servidor (403)':`ESPN ha devuelto HTTP ${response.status}`},502);
    }
    const body=await response.json();
    cache.set(upstream,{body,stamp:Date.now()});
    if(cache.size>400){cache.delete(cache.keys().next().value)}
    return json(body,200,ttl);
  } catch(e){
    return json({message:'No se pudo contactar con ESPN desde el servidor: '+(e?.name||'error')},502);
  }
};
function json(body,status,ttl=0){
  return new Response(JSON.stringify(body),{
    status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':ttl?`public, max-age=${Math.floor(ttl/1000)}`:'no-store'}
  });
}

export const config={path:'/api/espn/*'};
