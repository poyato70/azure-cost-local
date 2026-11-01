# Matriz de capacidades — 01/11/2026

| Capacidade | Fonte | Escopo e limitação |
|---|---|---|
| Recomendações Reservations | Microsoft.Consumption/reservationRecommendations, 2026-06-01 | subscription/RG; Single e Last30Days; resultados e permissões variam por contrato. Prazo preservado da resposta, sem assumir equivalência. |
| Recomendações Savings Plans | Microsoft.CostManagement/benefitRecommendations, 2026-06-01 | subscription/RG; Single, Last30Days e P1Y/P3Y. Fonte oficial, sem compra. |
| Benefícios existentes atribuídos | Microsoft.CostManagement/query, 2026-06-01 | AmortizedCost, filtro PricingModel e agrupamento ReservationName/BenefitName no mês completo anterior. Não é inventário global. |
| Utilização/cobertura existentes | APIs de billing/benefit utilization | Não implementadas sem contexto de billing específico; os campos reais permanecem indisponíveis. Métricas de recomendações são projetadas. |
| Simulação horária independente | Consumo horário e preços contratuais | Indisponível nesta entrega quando os dados não foram fornecidos. Não extrapolar totais mensais. |

Não promover consulta RG para billing/subscription silenciosamente. Falhas de uma fonte geram resposta parcial, com avisos. Desconto público não é preço contratual, e economias de alternativas não se somam.

Referências oficiais:
- https://learn.microsoft.com/en-us/rest/api/consumption/reservation-recommendations/list
- https://learn.microsoft.com/en-us/rest/api/cost-management/benefit-recommendations/list
- https://learn.microsoft.com/en-us/azure/cost-management-billing/reservations/view-amortized-costs
- https://learn.microsoft.com/en-us/azure/cost-management-billing/savings-plan/utilization-cost-reports

Endpoints e formatos foram conferidos na documentação; funcionamento na conta do usuário ainda depende de login e permissões. Análise atual não equivale a conciliação de fatura.
