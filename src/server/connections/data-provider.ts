import type { DataSelection } from "../../shared/connections.js";
import { AppError } from "../errors.js";
export function assertApiSelection(selection?: DataSelection) {
  if (selection?.source === "mcp")
    throw new AppError(
      "unsupported",
      "Esta tela consulta gastos e budgets pela API Cost Management. O modo Servidor MCP não atende estes cartões nesta versão. Em Fonte dos dados, escolha APIs Azure e consulte novamente. Isso não indica falha no login nem no MCP. pricing_get consulta preços de catálogo, não o gasto do seu RG.",
    );
}
