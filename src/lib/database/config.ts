import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";

let dbInstance: Database | null = null;

/**
 * Open the workspace SQLite database at `.niumaconfig/sqlite/niuma.db`.
 * The connection string comes from Rust so migrations use the same path.
 */
export async function getDatabase(): Promise<Database> {
  if (!dbInstance) {
    try {
      const dbUrl = await invoke<string>("get_niuma_sqlite_url");
      dbInstance = await Database.load(dbUrl);
    } catch (error) {
      throw new Error(
        `Failed to initialize database: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
  return dbInstance;
}
