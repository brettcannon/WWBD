import os
import pathlib
import subprocess

import pytest

import wwbd.venv


class TestExecutablePath:

    def test_posix(self, monkeypatch):
        monkeypatch.setattr(os, "name", "posix")
        venv_path = pathlib.PurePosixPath(".venv")
        python_path = wwbd.venv.executable_path(venv_path)

        assert venv_path / "bin" / "python" == python_path

    def test_nt(self, monkeypatch):
        monkeypatch.setattr(os, "name", "nt")
        venv_path = pathlib.PureWindowsPath(".venv")
        python_path = wwbd.venv.executable_path(venv_path)

        assert venv_path / "Scripts" / "python.exe" == python_path


class TestCreate:

    def test_new(self, tmp_path):
        python_path = wwbd.venv.create(tmp_path)

        assert python_path == wwbd.venv.executable_path(tmp_path / ".venv")
        assert (tmp_path / ".venv" / "pyvenv.cfg").exists()

    def test_preexisting(self, tmp_path):
        wwbd.venv.create(tmp_path)
        # Idempotent
        python_path = wwbd.venv.create(tmp_path)

        assert python_path == wwbd.venv.executable_path(tmp_path / ".venv")


class TestRequirementsFilename:

    def test_requirements(self):
        names = {"requirements.txt", "package.json"}
        selected = wwbd.venv.requirements_filename(names)

        assert selected == "requirements.txt"

    @pytest.mark.parametrize("filename",
            ["dev-requirements.txt", "dev_requirements.txt",
             "requirements-dev.txt", "requirements_dev.txt"])
    def test_dev_requirements(self, filename):
        names = {"requirements.txt", "package.json", filename}
        selected = wwbd.venv.requirements_filename(names)

        assert selected == filename

    def test_no_requirements(self):
        names = {"requirements.json", "no-requirements.txt"}
        with pytest.raises(ValueError):
            wwbd.venv.requirements_filename(names)


class TestInstallRequirements:

    def test_no_requirements(self, tmp_path):
        python_path = wwbd.venv.create(tmp_path)
        assert not wwbd.venv.install_requirements(python_path, tmp_path)

    def test_requirements(self, tmp_path):
        requirements_path = tmp_path / "requirements.txt"
        with open(requirements_path, "w") as file:
            file.write("packaging-classifiers==1.0.0rc5\n")
        python_path = wwbd.venv.create(tmp_path)
        installed_requirements = wwbd.venv.install_requirements(python_path,
                                                                tmp_path)

        assert requirements_path == installed_requirements

        find_spec = "import importlib.util; import sys; sys.exit(importlib.util.find_spec('packaging_classifiers') is None)"
        proc = subprocess.run([os.fsdecode(python_path), "-c", find_spec], check=True)

        assert not proc.returncode
