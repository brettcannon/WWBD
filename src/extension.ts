import { ConsoleReporter } from "@vscode/test-electron";
import * as child_process from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import * as pvsc from "./pvsc";

const jsonTagRegex = /<JSON>\r?\n(?<json>.+)\r?\n<\/JSON>/;

const outputChannel = vscode.window.createOutputChannel("WWBD");

export interface PythonPayload {
  executable: string;
  requirementsFile: string | null;
}

export function activate(context: vscode.ExtensionContext): void {
  let disposable = vscode.commands.registerCommand(
    "wwbd.createEnvironment",
    () =>
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Python Environment Creation",
          // XXX make it killable
          cancellable: false,
        },
        (progress, token) =>
          createEnvironment(context.extensionPath, progress, token)
      )
  );

  context.subscriptions.push(disposable);
}

export function deactivate(): void {}

export async function pvscApi(): Promise<
  pvsc.IProposedExtensionAPI | undefined
> {
  const pvscExtension =
    vscode.extensions.getExtension<pvsc.IProposedExtensionAPI>(
      "ms-python.python"
    );

  if (pvscExtension === undefined) {
    return undefined;
  }

  // This technically shouldn't be necessary.
  if (!pvscExtension.isActive) {
    console.log("ms-python.python not activated");
    await pvscExtension.activate();
  }

  console.log("ms-python.python activated");

  return pvscExtension.exports;
}

export function isGlobal(
  details: pvsc.EnvironmentDetails | undefined
): details is pvsc.EnvironmentDetails {
  if (details === undefined) {
    return false;
  }

  const globalInterpTypes = [
    pvsc.PythonEnvKind.System,
    pvsc.PythonEnvKind.WindowsStore,
    pvsc.PythonEnvKind.Pyenv,
    pvsc.PythonEnvKind.Custom,
    pvsc.PythonEnvKind.OtherGlobal,
  ];

  return details.environmentType.some((type) =>
    globalInterpTypes.includes(type)
  );
}

function sortStringIntsDecending(a: string, b: string): -1 | 0 | 1 {
  const aInt = parseInt(a);
  const bInt = parseInt(b);

  if (aInt < bInt) {
    return 1;
  } else if (aInt > bInt) {
    return -1;
  } else {
    return 0;
  }
}

export function compareEnvDetailsDescending(
  a: pvsc.EnvironmentDetails,
  b: pvsc.EnvironmentDetails
): -1 | 0 | 1 {
  for (let i = 0; i < 4; i += 1) {
    const comparison = sortStringIntsDecending(a.version[i], b.version[i]);

    if (comparison !== 0) {
      return comparison;
    }
  }

  return 0;
}

export function filterByPathType(pathTypes: pvsc.EnvPathType[]): string[] {
  return pathTypes
    .filter((pathType) => pathType.pathType === "interpreterPath")
    .map((pathType) => pathType.path);
}

async function globalInterpreters(
  pythonExtension: pvsc.IProposedExtensionAPI
): Promise<
  | readonly /*vscode.QuickPickItem*/ { label: string; description: string }[]
  | undefined
> {
  const pathTypes = await pythonExtension.environment.getEnvironmentPaths();
  if (pathTypes === undefined) {
    return undefined;
  }

  const interpreterPaths = filterByPathType(pathTypes);

  const interpreterDetails = (
    await Promise.all(
      interpreterPaths.map((path) =>
        pythonExtension.environment.getEnvironmentDetails(path)
      )
    )
  ).filter(isGlobal);

  interpreterDetails.sort(compareEnvDetailsDescending);

  return interpreterDetails.map((details) => {
    return {
      label: details.version.slice(0, 3).join("."),
      description: details.interpreterPath,
    };
  });
}

async function selectGlobalInterpreter(
  pythonExtension: pvsc.IProposedExtensionAPI,
  reason: string
): Promise<string | undefined> {
  const useNewest = "Use newest version";
  const selectInterpreterButton = "Select Interpreter";
  const cancel = "Cancel";

  const selected = await vscode.window.showWarningMessage(
    reason,
    useNewest,
    selectInterpreterButton,
    cancel
  );

  if (selected === cancel) {
    noInterpreterSelected();
    return;
  } else {
    const interpreterOptions = await globalInterpreters(pythonExtension);

    if (interpreterOptions === undefined || interpreterOptions.length === 0) {
      vscode.window.showErrorMessage(
        "Unable to gather a list of Python interpreters."
      );
      return;
    }

    if (selected === useNewest) {
      return interpreterOptions[0].description;
    } else {
      let pickedInterpreter = await vscode.window.showQuickPick(
        interpreterOptions,
        {
          canPickMany: false,
          title: "Select an Interpreter",
        }
      );

      if (pickedInterpreter === undefined) {
        noInterpreterSelected();
        return;
      } else {
        return pickedInterpreter.description;
      }
    }
  }
}

function noInterpreterSelected(): void {
  vscode.window.showErrorMessage("No interpreter selected.");
}

export function venvExecutable(dir: string): string {
  return os.platform() === "win32"
    ? path.join(dir, "Scripts", "python.exe")
    : path.join(dir, "bin", "python");
}

export function parseOutput(output: string): PythonPayload | undefined {
  const jsonMatch = jsonTagRegex.exec(output);

  if (jsonMatch === null || jsonMatch.groups === undefined) {
    return undefined;
  } else {
    return JSON.parse(jsonMatch.groups.json);
  }
}

export function execPython(
  pyPath: string,
  command: string[]
): PythonPayload | undefined {
  // Create a custom environment variable collection to force Python to use UTF-8.
  const pyEnv: NodeJS.ProcessEnv = {};
  Object.assign(pyEnv, process.env);
  pyEnv.PYTHONUTF8 = "1";
  // TODO make asynchronous?: https://nodejs.org/dist/latest-v16.x/docs/api/child_process.html#child_processspawncommand-args-options
  const py = child_process.spawnSync(pyPath, command, {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
    env: pyEnv,
  });

  // TODO Build up stdout and stderr into a buffer dynamically to get proper interleaving.
  outputChannel.append(py.stdout);
  outputChannel.append(py.stderr);

  if (py.error !== undefined) {
    vscode.window.showErrorMessage(
      `Error during environment creation: ${py.error.message} (${py.error.name}).`
    );
    return;
  } else if (py.status !== 0) {
    vscode.window.showErrorMessage(
      `Error during environment creation (status code: ${py.status}).`
    );
    outputChannel.show();
    return;
  }

  // Process results.
  return parseOutput(py.stdout);
}

async function createEnvironment(
  extensionPath: string,
  progress: vscode.Progress<{ /* increment: number, */ message: string }>,
  _token: vscode.CancellationToken
): Promise<void> {
  // Get the workspace.
  // TODO be smarter in the face of multi-root workspaces.
  // TODO make into a function?
  progress.report({ message: "Finding the workspace" });
  const workspaceDir = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

  if (workspaceDir === undefined) {
    // TODO some way to let the user select a workspace?
    vscode.window.showErrorMessage("No workspace selected.");
    return;
  } else {
    outputChannel.appendLine(`workspace: ${workspaceDir}`);
  }

  // Activate the Python extension.
  progress.report({ message: "Activating the Python extension" });
  const pythonExtension = await pvscApi();

  if (pythonExtension === undefined) {
    vscode.window.showErrorMessage("Unable to activate the Python extension.");
    return;
  }

  // Check that `.venv` does not already exist.
  // TODO make into a function?
  progress.report({ message: "Checking for `.venv`" });
  const venvDirectory = path.join(workspaceDir, ".venv");

  if (fs.existsSync(venvDirectory)) {
    const venvInterpreter = venvExecutable(venvDirectory);

    if (fs.existsSync(venvInterpreter)) {
      const selectEnvironmentButton = "Select Environment";

      vscode.window
        .showWarningMessage(
          "A virtual environment already exists at `.venv`. Would you like to select it and halt environment creation?",
          selectEnvironmentButton,
          "Cancel"
        )
        .then((selected) => {
          if (selected === selectEnvironmentButton) {
            pythonExtension.environment.setActiveEnvironment(venvInterpreter);
          }
        });

      return;
    } else {
      vscode.window.showErrorMessage(
        "Cannot create virtual environment; `.venv` already exists."
      );
      return;
    }
  }

  // TODO make into a function?
  progress.report({ message: "Getting the selected interpreter" });
  let selectedEnvPath =
    await pythonExtension.environment.getActiveEnvironmentPath();

  let pyPath: string | undefined;

  if (selectedEnvPath === undefined) {
    pyPath = await selectGlobalInterpreter(
      pythonExtension,
      "No Python interpreter selected."
    );
  } else if (selectedEnvPath.pathType !== "interpreterPath") {
    pyPath = await selectGlobalInterpreter(
      pythonExtension,
      "Python environment with no interpreter selected."
    );
  } else {
    pyPath = selectedEnvPath.path;
  }

  // One of the branches of the above `if` block didn't lead to an interpreter being selected.
  if (pyPath === undefined) {
    return;
  }

  const interpreterDetails =
    await pythonExtension.environment.getEnvironmentDetails(pyPath);

  if (!isGlobal(interpreterDetails)) {
    const selectedPyPath = await selectGlobalInterpreter(
      pythonExtension,
      "The selected Python environment is not a globally-installed Python interpreter."
    );

    if (selectedPyPath === undefined) {
      return;
    } else {
      pyPath = selectedPyPath;
    }
  }

  outputChannel.appendLine(`interpreter: ${pyPath}`);

  // Create environment by executing Python code.
  // TODO make into a function?
  progress.report({ message: "Creating the environment" });
  const pythonSrc = path.join(extensionPath, "python-src");
  const command = [pythonSrc, "--workspace", workspaceDir];
  const details = execPython(pyPath, command);

  if (details === undefined) {
    // TODO Show button to display output instead of showing it automatically?
    vscode.window.showErrorMessage(
      "Error during environment creation (JSON output missing)."
    );
    outputChannel.show();
    return;
  }

  await pythonExtension.environment.setActiveEnvironment(details.executable);

  outputChannel.appendLine(
    `Success: ${
      (await pythonExtension.environment.getActiveEnvironmentPath())?.path
    }`
  );
}
