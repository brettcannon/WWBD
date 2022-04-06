# TODO Deal w/ the "Debian Problem"
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
            # TODO better exception?
            raise ValueError("no requirements file found in {contents!r}")


def install_requirements(python_path, workspace):
    try:
        filename = requirements_filename(workspace.iterdir())
    except ValueError:
        return None

    # XXX Execute pip
    # TODO deal with the "Debian Problem"
    pass
