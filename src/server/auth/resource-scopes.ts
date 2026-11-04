export const ARM_MCP_AUDIENCE = "api://22bfbae3-f4e7-485f-be43-8cee15065084";
export function resourceScopes(audience: string) {
  return [
    audience === ARM_MCP_AUDIENCE
      ? audience + "/MCP.Access"
      : audience + "/.default",
  ];
}
