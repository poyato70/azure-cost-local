import type { DataSelection } from "../../shared/connections.js";
import { AppError } from "../errors.js";
export function assertApiSelection(selection?: DataSelection) {
  if (selection?.source === "mcp")
    throw new AppError(
      "unsupported",
      "A conexão MCP selecionada não possui adapter equivalente comprovado para custos/budgets/benefícios. Selecione API para estes cartões; use a área MCP ou chat para ferramentas disponíveis.",
    );
}
