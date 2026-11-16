import { config } from "./config.js";
export async function webSearch(query) {
  if (!config.tavilyKey) throw new Error("Web search is not connected. Add TAVILY_API_KEY to .env.");
  if (typeof query!=="string" || query.trim().length<2 || query.length>500) throw new Error("Search query must be 2–500 characters.");
  const response=await fetch("https://api.tavily.com/search",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({api_key:config.tavilyKey,query:query.trim(),search_depth:"basic",max_results:5,include_answer:false})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.message||`Search provider error (${response.status}).`);
  return (data.results||[]).map(r=>({title:r.title||"Untitled",url:r.url,content:(r.content||"").slice(0,1800),score:r.score}));
}
