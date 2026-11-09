import { it, expect } from "vitest";
import { costQuerySchema } from "../../src/shared/contracts.js";
import { AzureCosts } from "../../src/server/costs/service.js";
it("sends billing tag filter and keeps it in query validation", async () => {
 const q = costQuerySchema.parse({scope:{tenantId:"11111111-1111-4111-8111-111111111111",subscriptionId:"22222222-2222-4222-8222-222222222222"},period:{from:"2026-09-01",toExclusive:"2026-11-01",timeZone:"America/Sao_Paulo"},basis:"ActualCost",groupBy:"ResourceId",granularity:"Daily",tagFilter:{name:"CostCenter",values:["FinOps"]}});
 let body:any;
 const costs = new AzureCosts({request:async (_c:any,_u:any,b:any)=>{body=b; return {properties:{columns:[],rows:[]}}}} as any);
 await costs.queryCosts({tenantId:q.scope.tenantId,sessionId:"test",userId:"test",signal:new AbortController().signal},q);
 expect(body.dataset.filter.tags).toEqual({name:"CostCenter",operator:"In",values:["FinOps"]});
});
