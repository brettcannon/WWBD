import argparse
import os
import pathlib

from . import venv as wwbd_venv


def main(argv):
    parser = argparse.ArgumentParser("wwbd")
    parser.add_argument("--workspace", type=pathlib.Path, nargs=1, required=True)
    args = parser.parse_args(argv)

    python_path = wwbd_venv.create(args.workspace)
    requirements_file = wwbd_venv.install_requirements(python_path, args.workspace)

    details = {
        "executable": os.fspath(python_path),
        "requirements file": os.fspath(requirements_file),
    }

    # XXX print out details


if __name__ == "__main__":
    import sys

    main(sys.argv)
