// GolfCourseAPI.com (singular) server-side proxy. Never expose API keys to clients.
const BASE='https://api.golfcourseapi.com/v1';
const reply=(status,body)=>({statusCode:status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(body)});
exports.handler=async(event)=>{
 if(event.httpMethod!=='GET')return reply(405,{error:'GET only'});
 const key=process.env.GOLFCOURSE_API_KEY;
 if(!key)return reply(503,{error:'Course lookup is not configured. Use a saved course or manual entry.'});
 const q=(event.queryStringParameters?.q||'').trim();const id=event.queryStringParameters?.id;
 if(id&&!/^\d{1,12}$/.test(String(id)))return reply(400,{error:'Invalid course ID'});
 if(!id&&(q.length<2||q.length>90))return reply(400,{error:'Enter at least two characters of a course name.'});
 const url=id?`${BASE}/courses/${encodeURIComponent(id)}`:`${BASE}/search?search_query=${encodeURIComponent(q)}`;
 try{const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),11000);
  let r;try{r=await fetch(url,{headers:{Authorization:`Key ${key}`,Accept:'application/json'},signal:controller.signal})}finally{clearTimeout(timer)}
  if(!r.ok)return reply(r.status===429?429:502,{error:r.status===429?'Course search daily limit reached. Try a saved course.':'Course provider unavailable or key invalid.'});
  const raw=await r.json();
  if(!id){return reply(200,{courses:(raw.courses||[]).slice(0,20).map(c=>({id:c.id,name:c.course_name||c.name||c.club_name||'Course',club:c.club_name||'',location:[c.location?.city,c.location?.state].filter(Boolean).join(', ')}))})}
  const c=raw.course||raw;const rawTees=c.tees||[];const tees=Array.isArray(rawTees)?rawTees:[...(rawTees.male||[]),...(rawTees.female||[])];
  return reply(200,{id:c.id,name:c.course_name||c.name||c.club_name||'Course',tees:tees.map((t,i)=>({id:i,name:t.tee_name||t.name||t.tee||`Tees ${i+1}`,rating:t.course_rating??t.rating??null,slope:t.slope_rating??t.slope??null,holes:(t.holes||c.holes||[]).map((h,j)=>({hole:Number(h.hole||h.hole_number||j+1),par:Number(h.par)||null,yardage:Number(h.yardage??h.yards)||null,handicap:Number(h.handicap??h.hcp??h.stroke_index)||null})).sort((a,b)=>a.hole-b.hole)}))});
 }catch(e){return reply(502,{error:'Could not reach the course service. Try again or use offline courses.'})}
};
