import { listDirectory } from "./list";

export async function exists(path: string): Promise<boolean> {
  try {
    await listDirectory(path);
    return true;
  } catch {
    return false;
  }
}
