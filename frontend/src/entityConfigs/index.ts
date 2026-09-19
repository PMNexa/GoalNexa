import { EntityConfig } from "./types";
import { goalConfig } from "./goal";

export const entityConfigByKey: Record<string, EntityConfig> = {
  goal: goalConfig,
};

export * from "./types";
export { goalConfig };
