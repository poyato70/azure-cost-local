import {
  scopeSchema,
  periodSchema,
  type Scope,
  type DateRange,
} from "../../shared/contracts.js";
import { AppError } from "../errors.js";
export type QueryOperation =
  | "costs"
  | "reservations"
  | "savingsPlans"
  | "utilizationReservations"
  | "utilizationSavingsPlans"
  | "reservationCosts"
  | "savingsPlanCosts";
export function buildHubQuery(
  operation: QueryOperation,
  raw: Scope,
  dates: DateRange,
) {
  const scope = scopeSchema.parse(raw),
    period = periodSchema.parse(dates);
  if (
    !scope.resourceGroup ||
    !/^[\p{L}\p{N}_.() -]{1,90}$/u.test(scope.resourceGroup)
  )
    throw new AppError("invalid_request", "Selecione um RG com nome válido.");
  const rg = JSON.stringify(scope.resourceGroup.toLowerCase());
  const filter = `| where SubAccountId =~ "${scope.subscriptionId}" and tolower(x_ResourceGroupName) == ${rg}\n| where ChargePeriodStart >= datetime(${period.from}) and ChargePeriodStart < datetime(${period.toExclusive})`;
  if (operation === "costs")
    return `Costs_v1_2()\n${filter}\n| summarize BilledCost=tostring(sum(BilledCost)), EffectiveCost=tostring(sum(EffectiveCost)), Records=count() by Month=startofmonth(ChargePeriodStart), BillingCurrency\n| order by Month asc`;
  // No billing purchases or unscoped recommendations are attributed to the RG.
  if (operation === "reservationCosts" || operation === "savingsPlanCosts")
    return `Costs_v1_2()\n${filter}\n| where CommitmentDiscountType =~ "${operation === "reservationCosts" ? "Reservation" : "Savings Plan"}"\n| summarize BilledCost=tostring(sum(BilledCost)), EffectiveCost=tostring(sum(EffectiveCost)), Records=count() by Month=startofmonth(ChargePeriodStart), BillingCurrency`;
  if (operation === "reservations")
    return `Recommendations_v1_2()\n${filter.replaceAll("ChargePeriodStart", "x_RecommendationDate")}\n| where x_SourceProvider == "Microsoft" and x_SourceType == "ReservationRecommendations"\n| project ResourceId, x_RecommendationDate, ProjectedSavings=tostring(x_EffectiveCostSavings)\n| take 100`;
  if (operation === "savingsPlans")
    throw new AppError(
      "unsupported",
      "Template de recomendações Savings Plans não certificado neste schema.",
    );
  return `CommitmentDiscountUsage_v1_2()\n${filter}\n| where CommitmentDiscountType =~ "${operation === "utilizationReservations" ? "Reservation" : "Savings Plan"}"\n| project ResourceId, CommitmentDiscountType, ConsumedQuantity, CommitmentDiscountQuantity, CommitmentDiscountUnit\n| take 100`;
}
