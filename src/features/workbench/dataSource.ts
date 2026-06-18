import { BIGV_WORKBENCH_SNAPSHOT } from "./mockSnapshot";
import type {
  AudienceViewModel,
  BigVWorkbenchDataSource,
  BigVWorkbenchSnapshot,
  DanmakuViewModel,
  QuotaViewModel,
  ReviewViewModel,
} from "./types";

function cloneSnapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

class MockBigVWorkbenchDataSource implements BigVWorkbenchDataSource {
  getSnapshot(): BigVWorkbenchSnapshot {
    return cloneSnapshot(BIGV_WORKBENCH_SNAPSHOT);
  }

  getDanmakuView(): DanmakuViewModel {
    return cloneSnapshot(BIGV_WORKBENCH_SNAPSHOT.danmaku);
  }

  getQuotaView(): QuotaViewModel {
    return cloneSnapshot(BIGV_WORKBENCH_SNAPSHOT.quota);
  }

  getAudienceView(): AudienceViewModel {
    return cloneSnapshot(BIGV_WORKBENCH_SNAPSHOT.audience);
  }

  getReviewView(): ReviewViewModel {
    return cloneSnapshot(BIGV_WORKBENCH_SNAPSHOT.review);
  }
}

export const bigVWorkbenchDataSource: BigVWorkbenchDataSource = new MockBigVWorkbenchDataSource();
