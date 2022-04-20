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

async function createEnvironment(
  extensionPath: string,
  progress: vscode.Progress<{ /* increment: number, */ message: string }>,
  _token: vscode.CancellationToken
): Promise<void> {
  // XXX move out to prevent duplicate channels from being created
  const outputChannel = vscode.window.createOutputChannel("WWBD");

  // XXX break out sub-steps into separate functions. Return `undefined` as the error condition? What about UX?

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
  const pvsc = await pvscApi();

  if (pvsc === undefined) {
    vscode.window.showErrorMessage("Unable to activate the Python extension.");
    return;
  }

  progress.report({ message: "Getting the appropriate interpreter" });
  const selectedEnvPath = await pvsc.environment.getActiveEnvironmentPath();

  if (selectedEnvPath === undefined) {
    // XXX decide what to do; warn the user and offer to run the command on the user's behalf or quit?
    //     Custom picker of global interpreters and skip the notification?
    vscode.window.showErrorMessage(
      "No selected Python interpreter. Please run `Python: Select Interpreter` to select one."
    );
    return;
  } else if (selectedEnvPath.pathType !== "interpreterPath") {
    // TODO do better.
    vscode.window.showErrorMessage(
      "Selected interpreter does not specify an interpreter path."
    );
    return;
  } else {
    outputChannel.appendLine(`interpreter: ${selectedEnvPath.path}`);
  }

  // Check that `.venv` does not already exist.
  const pyPath = selectedEnvPath.path;
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
            pvsc.environment.setActiveEnvironment(venvInterpreter);
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

  await pvsc.environment.setActiveEnvironment(details.executable);

  outputChannel.appendLine("Success!");
}
