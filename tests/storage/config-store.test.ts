import {it,expect} from 'vitest';import {mkdtemp,readFile,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {ConfigStore} from '../../src/server/storage/config-store.js';import {SecretStore} from '../../src/server/storage/secret-store.js';import {AccessService} from '../../src/server/connections/access-service.js';
const fields={name:'Teste',tenantId:'11111111-1111-4111-8111-111111111111',clientId:'22222222-2222-4222-8222-222222222222',preferredMode:'application'};
it('persists metadata and DPAPI ciphertext without exposing the secret',async()=>{
 const root=await mkdtemp(join(tmpdir(),'azure-cost-storage-'));const store=new ConfigStore(root),vault=new SecretStore(root);const service=new AccessService(store,vault);const value='synthetic-secret-storage-9283';const profile=await service.save({...fields,secretAction:{kind:'replace',value}});
 expect(JSON.stringify(profile)).not.toContain(value);expect(profile.secretConfigured).toBe(true);expect(profile).not.toHaveProperty('secretRef');
 const saved=await store.read();expect(await vault.read(saved.accessProfiles[0].secretRef!)).toBe(value);expect(await readFile(join(root,'settings.json'),'utf8')).not.toContain(value);
 expect((await new ConfigStore(root).read()).accessProfiles[0].name).toBe('Teste');await service.save({...fields,id:profile.id,expectedVersion:1,secretAction:{kind:'keep'}});expect((await service.list())[0].credentialVersion).toBe(1);
});
it('serializes concurrent metadata mutations and preserves corrupt data',async()=>{
 const root=await mkdtemp(join(tmpdir(),'azure-cost-config-'));const store=new ConfigStore(root);await Promise.all([store.mutate(s=>{s.schemaVersion=1;}),store.mutate(s=>{s.schemaVersion=1;})]);expect((await store.read()).schemaVersion).toBe(1);
 await writeFile(join(root,'settings.json'),'corrupt');await expect(store.mutate(()=>{})).rejects.toMatchObject({code:'storage_corrupt'});expect(await readFile(join(root,'settings.json'),'utf8')).toBe('corrupt');
});
