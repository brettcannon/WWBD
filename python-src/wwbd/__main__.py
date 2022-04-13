import argparse
import json
import os
import pathlib

from . import venv as wwbd_venv


def main(argv):
    parser = argparse.ArgumentParser("wwbd")
    parser.add_argument("--workspace", action="store", type=pathlib.Path, required=True)
    args = parser.parse_args(argv)

    python_path = wwbd_venv.create(args.workspace)
    requirements_file = wwbd_venv.install_requirements(python_path, args.workspace)

    details = {
        "executable": os.fsdecode(python_path),
        "requirementsFile": os.fsdecode(requirements_file),
    }

    print("<JSON>")
    print(json.dumps(details))
    print("</JSON>")


if __name__ == "__main__":
    import sys

    main(sys.argv[1:])
