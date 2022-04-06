// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
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

  if (!pvscExtension.isActive) {
    console.log("ms-python.python not activated");
    await pvscExtension.activate();
  }

  console.log("ms-python.python activated");

  return pvscExtension.exports;
}

async function setUpEnvironment(): Promise<void> {
  vscode.window.showInformationMessage("Hello World from WWBD!");

  const pvsc = await pvscApi();

  if (pvsc === undefined) {
    // XXX Error
    console.error("ms-python.python was not found!");
    return;
  }

  // XXX Get Python interpreter.
  // XXX Run `py -m wwbd --workspace <workspace>` from within the extension's directory (to avoid workspace shadowing any modules).
  // XXX Parse stdout for details.
  // XXX Set interpreter.
}
