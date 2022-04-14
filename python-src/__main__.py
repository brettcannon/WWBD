import runpy
import sys


def main(args):
    sys.__stdout__.reconfigure(encoding="utf-8")
    runpy.run_module("wwbd", alter_sys=True, run_name="__main__")


if __name__ == "__main__":
    main(sys.argv)


