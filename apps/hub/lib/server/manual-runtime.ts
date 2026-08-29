import "server-only";

import { PROVIDERS, type Provider } from "@serendipity/contracts";

import { readHubProviderGatewayEnv } from "../provider-gateways/config";
import {
  readEvalFaultMode,
  wrapEvalFaultGateway,
} from "../provider-gateways/eval-fault";
import { HttpProviderGateway } from "../provider-gateways/http";
import type {
  ProviderGateway,
  ProviderTokenVault,
} from "../provider-gateways/types";
import { createHubSupabaseClient, readHubServerEnv } from "./supabase";
import {
  createSupabaseWorkflowStorage,
  createWorkflowRepository,
} from "./workflow-persistence";

export const createManualWorkflowRuntime = () => {
  const serverEnvironment = readHubServerEnv();
  const gatewayEnvironment = readHubProviderGatewayEnv();
  const client = createHubSupabaseClient(serverEnvironment);
  const evalFaultMode = readEvalFaultMode();
  const repository = createWorkflowRepository(
    createSupabaseWorkflowStorage(client),
    serverEnvironment.bundleEncryptionKey,
  );
  return {
    createGateways(tokenVault: ProviderTokenVault) {
      return Object.fromEntries(
        PROVIDERS.map((provider) => [
          provider,
          wrapEvalFaultGateway(
            new HttpProviderGateway({
              interserviceSecret: gatewayEnvironment.interserviceSecret,
              origin: gatewayEnvironment.providerOrigins[provider],
              provider,
              tokenVault,
            }),
            evalFaultMode,
          ),
        ]),
      ) as Record<Provider, ProviderGateway>;
    },
    hubOrigin: gatewayEnvironment.hubOrigin,
    repository,
  };
};

export type ManualWorkflowRuntime = ReturnType<
  typeof createManualWorkflowRuntime
>;
