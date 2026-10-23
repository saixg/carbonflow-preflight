export const PROJECT_TYPES = [
  "Grid-connected solar",
  "Wind power",
  "Hydro power",
  "Biomass energy",
  "Waste heat recovery",
  "Other",
] as const;

export function greeting(date = new Date()) {
  const h = date.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
