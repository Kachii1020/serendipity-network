import { createStore, type StoreApi } from "zustand/vanilla";

import {
  hubReducer,
  initialHubState,
  type HubEvent,
  type HubState,
} from "./hub-machine";

export type HubStore = HubState & {
  dispatch: (event: HubEvent) => void;
};

export const createHubStore = (
  seed: HubState = initialHubState,
): StoreApi<HubStore> =>
  createStore<HubStore>((set) => ({
    ...seed,
    dispatch: (event) => {
      set((current) => ({
        ...hubReducer(current, event),
        dispatch: current.dispatch,
      }));
    },
  }));
