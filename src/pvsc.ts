/* eslint-disable @typescript-eslint/naming-convention */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Event, Uri } from "vscode";

export type Resource = Uri | undefined;

export enum PythonEnvKind {
  Unknown = "unknown",
  // "global"
  System = "global-system",
  MacDefault = "global-mac-default",
  WindowsStore = "global-windows-store",
  Pyenv = "global-pyenv",
  CondaBase = "global-conda-base",
  Poetry = "global-poetry",
  Custom = "global-custom",
  OtherGlobal = "global-other",
  // "virtual"
  Venv = "virt-venv",
  VirtualEnv = "virt-virtualenv",
  VirtualEnvWrapper = "virt-virtualenvwrapper",
  Pipenv = "virt-pipenv",
  Conda = "virt-conda",
  OtherVirtual = "virt-other",
}

export interface EnvPathType {
  /**
   * Path to environment folder or path to interpreter that uniquely identifies an environment.
   * Virtual environments lacking an interpreter are identified by environment folder paths,
   * whereas other envs can be identified using interpreter path.
   */
  path: string;
  pathType: "envFolderPath" | "interpreterPath";
}

export interface EnvironmentDetailsOptions {
  useCache: boolean;
}

export interface EnvironmentDetails {
  interpreterPath: string;
  envFolderPath?: string;
  version: string[];
  environmentType: PythonEnvKind[];
  metadata: Record<string, unknown>;
}

export interface EnvironmentsChangedParams {
  /**
   * Path to environment folder or path to interpreter that uniquely identifies an environment.
   * Virtual environments lacking an interpreter are identified by environment folder paths,
   * whereas other envs can be identified using interpreter path.
   */
  path?: string;
  type: "add" | "remove" | "update" | "clear-all";
}

export interface ActiveEnvironmentChangedParams {
  /**
   * Path to environment folder or path to interpreter that uniquely identifies an environment.
   * Virtual environments lacking an interpreter are identified by environment folder paths,
   * whereas other envs can be identified using interpreter path.
   */
  path: string;
  resource?: Uri;
}

export interface RefreshEnvironmentsOptions {
  clearCache?: boolean;
}

export interface IProposedExtensionAPI {
  environment: {
    /**
     * Returns the path to the python binary selected by the user or as in the settings.
     * This is just the path to the python binary, this does not provide activation or any
     * other activation command. The `resource` if provided will be used to determine the
     * python binary in a multi-root scenario. If resource is `undefined` then the API
     * returns what ever is set for the workspace.
     * @param resource : Uri of a file or workspace
     */
    getActiveEnvironmentPath(
      resource?: Resource
    ): Promise<EnvPathType | undefined>;

    /**
     * Returns details for the given interpreter. Details such as absolute interpreter path,
     * version, type (conda, pyenv, etc). Metadata such as `sysPrefix` can be found under
     * metadata field.
     * @param path : Full path to environment folder or interpreter whose details you need.
     * @param options : [optional]
     *     * useCache : When true, cache is checked first for any data, returns even if there
     *                  is partial data.
     */
    getEnvironmentDetails(
      path: string,
      options?: EnvironmentDetailsOptions
    ): Promise<EnvironmentDetails | undefined>;

    /**
     * Returns paths to environments that uniquely identifies an environment found by the extension
     * at the time of calling. This API will *not* trigger a refresh. If a refresh is going on it
     * will *not* wait for the refresh to finish. This will return what is known so far. To get
     * complete list `await` on promise returned by `getRefreshPromise()`.
     *
     * Virtual environments lacking an interpreter are identified by environment folder paths,
     * whereas other envs can be identified using interpreter path.
     */
    getEnvironmentPaths(): Promise<EnvPathType[] | undefined>;

    /**
     * Sets the active environment path for the python extension for the resource. Configuration target
     * will always be the workspace folder.
     * @param path : Full path to environment folder or interpreter to set.
     * @param resource : [optional] Uri of a file in the workspace to scope to a particular workspace
     *                   folder.
     */
    setActiveEnvironment(path: string, resource?: Resource): Promise<void>;

    /**
     * This API will re-trigger environment discovery. Extensions can wait on the returned
     * promise to get the updated environment list. If there is a refresh already going on
     * then it returns the promise for that refresh.
     * @param options : [optional]
     *     * clearCache : When true, this will clear the cache before environment refresh
     *                    is triggered.
     */
    refreshEnvironment(
      options?: RefreshEnvironmentsOptions
    ): Promise<EnvPathType[] | undefined>;

    /**
     * Returns a promise for the ongoing refresh. Returns `undefined` if there are no active
     * refreshes going on.
     */
    getRefreshPromise(): Promise<void> | undefined;

    /**
     * This event is triggered when the known environment list changes, like when a environment
     * is found, existing environment is removed, or some details changed on an environment.
     */
    onDidEnvironmentsChanged: Event<EnvironmentsChangedParams[]>;

    /**
     * This event is triggered when the active environment changes.
     */
    onDidActiveEnvironmentChanged: Event<ActiveEnvironmentChangedParams>;
  };
}
