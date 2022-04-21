import * as child_process from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import * as pvsc from "./pvsc";

const jsonTagRegex = /<JSON>\n(?<json>.+)\n<\/JSON>/;

interface JsonPayload {
  executable: string;
  requirementsFile: string | null;
}

export function activate(context: vscode.ExtensionContext): void {
  let disposable = vscode.commands.registerCommand(
    "wwbd.createEnvironment",
    () =>
      // XXX only use progress when executing Python code
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

async function pvscApi(): Promise<pvsc.IProposedExtensionAPI | undefined> {
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

function isGlobal(
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

function compareEnvDetailsDescending(
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

async function globalInterpreters(
  pythonExtension: pvsc.IProposedExtensionAPI
): Promise<readonly vscode.QuickPickItem[] | undefined> {
  const interpreterPaths = (
    await pythonExtension.environment.getEnvironmentPaths()
  )
    ?.filter(
      (pathType) =>
        pathType !== undefined && pathType.pathType === "interpreterPath"
    )
    .map((pathType) => pathType.path);

  if (interpreterPaths === undefined) {
    return undefined;
  }

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

async function createEnvironment(
  extensionPath: string,
  progress: vscode.Progress<{ /* increment: number, */ message: string }>,
  _token: vscode.CancellationToken
): Promise<void> {
  // XXX move out to prevent duplicate channels from being created
  const outputChannel = vscode.window.createOutputChannel("WWBD");

  // XXX break out sub-steps into separate functions? Return `undefined` as the error condition? What about UX?

  // Get the workspace.
  // TODO be smarter in the face of multi-root workspaces.
  const workspaceDir = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

  if (workspaceDir === undefined) {
    // TODO some way to offer to let the user select a workspace?
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

  progress.report({ message: "Getting the selected interpreter" });
  let selectedEnvPath =
    await pythonExtension.environment.getActiveEnvironmentPath();

  // XXX ask if want to select newest Python version, pick, or Cancel
  while (
    selectedEnvPath === undefined ||
    selectedEnvPath.pathType !== "interpreterPath"
  ) {
    const selectInterpreterButton = "Select Interpreter";

    const selected = await vscode.window.showWarningMessage(
      "No Python interpreter selected.",
      selectInterpreterButton,
      "Cancel"
    );

    if (selected === selectInterpreterButton) {
      await vscode.commands.executeCommand("python.setInterpreter");
      selectedEnvPath =
        await pythonExtension.environment.getActiveEnvironmentPath();
      continue;
    } else {
      return;
    }
  }

  let pyPath = selectedEnvPath.path;
  const interpreterDetails =
    await pythonExtension.environment.getEnvironmentDetails(
      selectedEnvPath.path
    );

  if (!isGlobal(interpreterDetails)) {
    // XXX ask if want to select newest Python version, pick, or Cancel
    const interpreterOptions = await globalInterpreters(pythonExtension);

    if (interpreterOptions === undefined) {
      vscode.window.showErrorMessage(
        "Unable to gather a list of Python interpreters."
      );
      return;
    } else {
      let pyPath = await vscode.window.showQuickPick(interpreterOptions, {
        canPickMany: false,
        title: "Select an Interpreter",
      });

      if (pyPath === undefined) {
        vscode.window.showErrorMessage("No interpeter selected.");
        return;
      }
    }
  }

  outputChannel.appendLine(`interpreter: ${selectedEnvPath.path}`);

  // Check that `.venv` does not already exist.
  const venvDirectory = path.join(workspaceDir, ".venv");

  if (fs.existsSync(venvDirectory)) {
    const venvInterpreter =
      os.platform() === "win32"
        ? path.join(venvDirectory, "Scripts", "python.exe")
        : path.join(venvDirectory, "bin", "python");

    if (fs.existsSync(venvInterpreter)) {
      const selectEnvironmentButton = "Select Interpreter";

      vscode.window
        .showWarningMessage(
          "A virtual environment already exists at `.venv`.",
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

  // Create environment by executing Python code.
  const pythonSrc = path.join(extensionPath, "python-src");

  const command = [pythonSrc, "--workspace", workspaceDir];
  progress.report({
    message: `> ${pyPath} ${command.join(" ")}`,
  });

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
  const jsonMatch = jsonTagRegex.exec(py.stdout);

  if (jsonMatch === null || jsonMatch.groups === undefined) {
    vscode.window.showErrorMessage(
      "Error during environment creation (JSON output missing)."
    );
    outputChannel.show();
    return;
  }

  const details: JsonPayload = JSON.parse(jsonMatch.groups.json);

  await pythonExtension.environment.setActiveEnvironment(details.executable);

  outputChannel.appendLine("Success!");
}
