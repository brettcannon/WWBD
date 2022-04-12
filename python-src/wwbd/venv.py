import os
import subprocess
import venv


def executable_path(venv_path):
    if os.name == "nt":
        return venv_path / "Scripts" / "python.exe"
    else:
        return venv_path / "bin" / "python"


def create(workspace):
    """Create a virtual environment in `workspace / ".venv"`.

    The prompt is set to the stem of the workspace path.

    """
    # TODO deal w/ the "Debian problem"
    venv_path = workspace / ".venv"
    # TODO care if not a directory or not a virtual environment?
    if not venv_path.exists():
        prompt = venv_path.stem
        venv.create(venv_path, with_pip=True, prompt=prompt)

    return executable_path(venv_path)


def requirements_filename(contents):
    """Find the most appropriate requirements file from the collection of file names."""
    contents = frozenset(contents)
    for name in contents:
        if name.endswith(".txt") and "requirements" in name and "dev" in name:
            return name
    else:
        if "requirements.txt" in contents:
            return "requirements.txt"
        else:
            raise ValueError("no requirements file found in {contents!r}")


def install_requirements(python_path, workspace):
    """Find and install the most appropriate requirements file."""
    # TODO deal with the "Debian problem"
    workspace_contents = {path.name for path in workspace.iterdir()}
    try:
        filename = requirements_filename(workspace_contents)
    except ValueError:
        return None
    else:
        requirements_path = workspace / filename

    subprocess.run([os.fsdecode(python_path), "-m", "pip", "install",
                    "--disable-pip-version-check", "--no-color",
                    "--requirement", os.fsdecode(requirements_path)],
                    check=True)

    return requirements_path
