import { APP_METADATA } from "../config/appShell";
import { usePersistentBoolean } from "./usePersistentState";

const MOCK_DATA_SOURCE_KEY = `${APP_METADATA.storageKeyPrefix}.mockDataSourceEnabled`;

const mockDataSourceEnabled = usePersistentBoolean(MOCK_DATA_SOURCE_KEY, false);

export function useWorkbenchDebugSettings() {
  return { mockDataSourceEnabled };
}

