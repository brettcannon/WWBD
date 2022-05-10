import * as assert from "node:assert";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import * as wwbd from "../../extension";
import * as pvsc from "../../pvsc";

function arrayEquals<T>(a: T[], b: T[]): void {
  assert.strictEqual(a.length, b.length);

  a.every((val, index) => assert.strictEqual(b[index], val));
}

suite("Unit Tests", function () {
  vscode.window.showInformationMessage("Start all tests.");

  suite("isGlobal()", function () {
    const knownKinds = [
      pvsc.PythonEnvKind.Unknown,
      pvsc.PythonEnvKind.System,
      pvsc.PythonEnvKind.MacDefault,
      pvsc.PythonEnvKind.WindowsStore,
      pvsc.PythonEnvKind.Pyenv,
      pvsc.PythonEnvKind.CondaBase,
      pvsc.PythonEnvKind.Poetry,
      pvsc.PythonEnvKind.Custom,
      pvsc.PythonEnvKind.OtherGlobal,
      pvsc.PythonEnvKind.Venv,
      pvsc.PythonEnvKind.VirtualEnv,
      pvsc.PythonEnvKind.VirtualEnvWrapper,
      pvsc.PythonEnvKind.Pipenv,
      pvsc.PythonEnvKind.Conda,
      pvsc.PythonEnvKind.OtherVirtual,
    ];

    const actualKinds = Object.values(pvsc.PythonEnvKind);

    // Sanity check we know about all environment kinds.
    arrayEquals(actualKinds, knownKinds);

    const globalKinds = [
      pvsc.PythonEnvKind.System,
      pvsc.PythonEnvKind.WindowsStore,
      pvsc.PythonEnvKind.Pyenv,
      pvsc.PythonEnvKind.Custom,
      pvsc.PythonEnvKind.OtherGlobal,
    ];

    knownKinds.forEach((kind) => {
      test(`${kind}`, function () {
        const details: pvsc.EnvironmentDetails = {
          interpreterPath: "python",
          envFolderPath: undefined,
          version: [],
          environmentType: [kind],
          metadata: {},
        };

        if (globalKinds.includes(kind)) {
          assert.ok(wwbd.isGlobal(details));
        } else {
          assert.ok(!wwbd.isGlobal(details));
        }
      });
    });

    test("considers `undefined` as not global", function () {
      assert.ok(!wwbd.isGlobal(undefined));
    });
  });

  suite("compareEnvDetailsDescending()", function () {
    const tests = [
      ["3.0.0", "2.7.12"],
      ["3.10.0", "3.6.10"],
      ["3.10.2", "3.10.1"],
    ];

    tests.forEach((pairs) => {
      test(`${pairs[0]} > ${pairs[1]}`, function () {
        let greater = pairs[0].split(".");
        let lesser = pairs[1].split(".");

        const greaterDetail: pvsc.EnvironmentDetails = {
          interpreterPath: "python",
          envFolderPath: undefined,
          version: greater,
          environmentType: [],
          metadata: {},
        };

        const lesserDetail: pvsc.EnvironmentDetails = {
          interpreterPath: "python",
          envFolderPath: undefined,
          version: lesser,
          environmentType: [],
          metadata: {},
        };

        test(`compares ${pairs[0]} > ${pairs[1]}`, function () {
          assert.strictEqual(
            wwbd.compareEnvDetailsDescending(greaterDetail, lesserDetail),
            -1
          );

          assert.strictEqual(
            wwbd.compareEnvDetailsDescending(lesserDetail, greaterDetail),
            1
          );

          assert.strictEqual(
            wwbd.compareEnvDetailsDescending(greaterDetail, greaterDetail),
            0
          );
        });
      });
    });
  });

  test("filterByPathType()", function () {
    const given: pvsc.EnvPathType[] = [
      { path: "python 1", pathType: "interpreterPath" },
      { path: "python 2", pathType: "envFolderPath" },
      { path: "python 3", pathType: "interpreterPath" },
    ];

    const expected = ["python 1", "python 3"];

    arrayEquals(wwbd.filterByPathType(given), expected);
  });

  test("venvExecutable()", function () {
    const dir = ".venv";

    const expect =
      os.platform() === "win32"
        ? path.join(dir, "Scripts", "python.exe")
        : path.join(dir, "bin", "python");

    assert.strictEqual(wwbd.venvExecutable(dir), expect);
  });

  suite("parseOutput()", function () {
    const badOutput =
      "People put the strangest stuff in their `sitecustomize.py` ...";

    assert.strictEqual(wwbd.parseOutput(badOutput), undefined);

    const payload: wwbd.PythonPayload = {
      executable: "python",
      requirementsFile: "requirements.txt",
    };

    const goodOutput = `${badOutput}
<JSON>
${JSON.stringify(payload)}
</JSON>
Other unexpected stuff at shutdown ...`;

    const actual = wwbd.parseOutput(goodOutput);

    test("parses the executable", function () {
      assert.strictEqual(actual?.executable, payload.executable);
    });

    test("parses the requirements file", function () {
      assert.strictEqual(actual?.requirementsFile, payload.requirementsFile);
    });

    test("Parse output with a Windows file path", function () {
      const output = `<JSON>
{"executable": "c:/Users/brcan/Testing/Some Python scratch space/.venv/Scripts/python.exe", "requirementsFile": null}
</JSON>`;

      const actual = wwbd.parseOutput(output);

      assert.strictEqual(
        actual?.executable,
        "c:/Users/brcan/Testing/Some Python scratch space/.venv/Scripts/python.exe"
      );

      assert.strictEqual(actual.requirementsFile, null);
    });
  });
});

suite("Integration Tests", function () {
  test("Load PVSC", function () {
    assert.doesNotReject(wwbd.pvscApi);
  });
});
