import { setScenario } from "./dom";

export async function runStep<T>(
  id: string,
  action: () => Promise<T>,
  validate: (value: T) => void = () => undefined
) {
  setScenario(id, "running");
  try {
    const result = await action();
    validate(result);
    setScenario(id, "pass", result);
    return result;
  } catch (error) {
    setScenario(id, "fail", error);
    throw error;
  }
}
