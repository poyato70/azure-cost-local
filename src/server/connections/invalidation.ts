import type {RevisionSet,ConfigSnapshot} from '../../shared/connections.js';import type {ConfigStore} from '../storage/config-store.js';import {AppError} from '../errors.js';
export class Invalidation{
 private listeners=new Set<{versions:RevisionSet;controller:AbortController}>();
 constructor(private store:ConfigStore){}
 versions(s:ConfigSnapshot){const all:RevisionSet={};for(const [prefix,list] of [['access',s.accessProfiles],['mcp',s.mcpProfiles],['agent',s.agentProfiles]] as const)for(const v of list)all[`${prefix}:${v.id}`]=v.configurationVersion;return all;}
 async capture(keys:string[]){const all=this.versions(await this.store.read()),out:RevisionSet={};for(const key of keys){if(!all[key])throw new AppError('invalid_request','Cadastro não encontrado.');out[key]=all[key];}return out;}
 async assertCurrent(v:RevisionSet){const all=this.versions(await this.store.read());if(Object.entries(v).some(([k,n])=>all[k]!==n))throw new AppError('configuration_changed','A configuração mudou. Inicie uma nova consulta.',409);}
 watch(versions:RevisionSet,controller:AbortController){const entry={versions,controller};this.listeners.add(entry);return()=>this.listeners.delete(entry);}
 changed(key:string){for(const entry of this.listeners)if(key in entry.versions)entry.controller.abort();}
}
