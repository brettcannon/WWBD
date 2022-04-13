import * as child_process from "node:child_process";
import * as path from "node:path";
import { stdout } from "node:process";
import * as vscode from "vscode";
import * as pvsc from "./pvsc";

const jsonTagRegex = /<JSON>\n(?<json>.+)\n<\/JSON>/;

interface JsonPayload {
  executable: string;
  requirementsFile: string;
}

// Store the location of the extension for accessing Python code.
let extensionPath: string = "<set via activate()>";

export function activate(context: vscode.ExtensionContext): void {
  extensionPath = context.extensionPath;

  let disposable = vscode.commands.registerCommand(
    "wwbd.setUpEnvironment",
    () =>
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Python Environment Setup",
          cancellable: false,
        },
        setUpEnvironment
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

async function setUpEnvironment(
  progress: vscode.Progress<{ /* increment: number, */ message: string }>
  //token: vscode.CancellationToken
): Promise<void> {
  const outputChannel = vscode.window.createOutputChannel("WWBD");

  progress.report({ message: "Activating the Python extension" });
  const pvsc = await pvscApi();

  if (pvsc === undefined) {
    // XXX Error
    console.error("ms-python.python was not found!");
    return;
  }

  progress.report({ message: "Getting the appropriate interpreter" });
  const selectedEnvPath = await pvsc.environment.getActiveEnvironmentPath();

  if (selectedEnvPath === undefined) {
    // XXX decide what to do.
    console.error("No selected environment!");
    return;
  }

  // TODO watch out for path type.
  const pyPath = selectedEnvPath.path;
  const pythonSrc = path.join(extensionPath, "python-src");

  // TODO be smarter in the face of multi-root workspaces.
  const workspaceDir = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

  if (workspaceDir === undefined) {
    // XXX error
    console.error("No workspace directory found!");
    return;
  }

  progress.report({ message: "Setting up the environment" });
  outputChannel.appendLine("Setting up the virtual environment ...");
  // TODO make asynchronous?: https://nodejs.org/dist/latest-v16.x/docs/api/child_process.html#child_processspawncommand-args-options
  const py = child_process.spawnSync(
    pyPath,
    [pythonSrc, "--workspace", workspaceDir],
    { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }
  );

  // TODO Build up stdout and stderr into a buffer dynamically to get proper interleaving.
  outputChannel.append(py.stdout);
  outputChannel.append(py.stderr);

  const jsonMatch = jsonTagRegex.exec(py.stdout);

  if (jsonMatch === null || jsonMatch.groups === undefined) {
    // XXX error
    console.error("No JSON output found!");
    return;
  }

  const details: JsonPayload = JSON.parse(jsonMatch.groups.json);

  await pvsc.environment.setActiveEnvironment(details.executable);
}
