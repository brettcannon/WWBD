import * as child_process from "node:child_process";
import * as path from "node:path";
import { stdout } from "node:process";
import * as vscode from "vscode";
import * as pvsc from "./pvsc";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext): void {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('"wwbd" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand(
    "wwbd.setUpEnvironment",
    setUpEnvironment
  );

  context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
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

async function setUpEnvironment(): Promise<void> {
  const pvsc = await pvscApi();

  if (pvsc === undefined) {
    // XXX Error
    console.error("ms-python.python was not found!");
    return;
  }

  const selectedEnvPath = await pvsc.environment.getActiveEnvironmentPath();

  vscode.window.showInformationMessage(`Hello from ${selectedEnvPath?.path}!`);

  if (selectedEnvPath === undefined) {
    // XXX decide what to do.
    console.error("No selected environment!");
    return;
  }

  // TODO watch out for path type.
  const pyPath = selectedEnvPath.path;

  console.log(`__dirname: ${__dirname}`);

  const extensionDir = path.dirname(__dirname);
  const pythonSrc = path.join(extensionDir, "python-src");

  console.log(`python-src: ${pythonSrc}`);

  // TODO be smarter in the face of multi-root workspaces.
  const workspaceDir = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

  if (workspaceDir === undefined) {
    // XXX error
    console.error("No workspace directory found!");
    return;
  }

  // TODO make asynchronous: https://nodejs.org/dist/latest-v16.x/docs/api/child_process.html#child_processspawncommand-args-options
  const py = child_process.spawnSync(
    pyPath,
    [pythonSrc, "--workspace", workspaceDir],
    { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }
  );

  const outputChannel = vscode.window.createOutputChannel("WWBD");
  // TODO Build up stdout and stderr into a buffer dynamically to get proper interleaving.
  outputChannel.append(py.stdout);
  outputChannel.append(py.stderr);

  outputChannel.show();
  // XXX Parse stdout for details.
  // XXX Set interpreter.
}
