import { it, expect } from "vitest";
import { readCatalog } from "../../src/server/mcp/catalog.js";
it("distinguishes unsupported catalogs and paginates advertised prompts", async()=>{
 let calls=0;
 const client:any={getServerCapabilities:()=>({prompts:{}}),getServerVersion:()=>({name:"test",version:"1"}),listPrompts:async()=>({prompts:[{name:String(++calls)}],nextCursor:calls===1?"next":undefined})};
 const result=await readCatalog(client,new AbortController().signal);
 expect(result.prompts.items).toHaveLength(2); expect(result.resources.status).toBe("not_advertised");
});
