"""
`aerofarex` command line.

  aerofarex migrate                 apply pending SQL migrations
  aerofarex seed-demo               load the dashboard demo dataset and publish it (dev only)
  aerofarex publish [--date D]      publish the index for D (default: today, IST)
  aerofarex serve [--port 8000]     run the API (uvicorn)
"""
from __future__ import annotations

import argparse
import json
import logging
import sys


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    parser = argparse.ArgumentParser(prog="aerofarex")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("migrate")
    sub.add_parser("seed-demo")
    p_pub = sub.add_parser("publish")
    p_pub.add_argument("--date", help="YYYY-MM-DD (default: today in IST)")
    p_serve = sub.add_parser("serve")
    p_serve.add_argument("--host", default="127.0.0.1")
    p_serve.add_argument("--port", type=int, default=8000)
    p_serve.add_argument("--reload", action="store_true")
    args = parser.parse_args(argv)

    from .core.config import get_settings
    from .db.migrate import migrate
    from .db.session import get_engine

    settings = get_settings()
    if args.command == "serve":
        import uvicorn

        uvicorn.run("server.main:app", host=args.host, port=args.port, reload=args.reload)
        return 0

    engine = get_engine()
    applied = migrate(engine, settings.migrations_dir)
    if args.command == "migrate":
        print(f"applied: {', '.join(applied) or 'nothing (up to date)'}")
        return 0

    if args.command == "seed-demo":
        if settings.env == "production":
            print("refused: seed-demo loads generated data and is disabled in production", file=sys.stderr)
            return 2
        from .seed.load import SeedRefused, load_demo

        try:
            print(json.dumps(load_demo(engine), indent=2))
        except SeedRefused as exc:
            print(f"refused: {exc}", file=sys.stderr)
            return 2
        return 0

    if args.command == "publish":
        from .services.publish import PublicationError, publish_date
        from .services.schedule import ist_today

        day = args.date or ist_today().isoformat()
        try:
            result = publish_date(engine, day, actor="cli")
        except PublicationError as exc:
            print(f"not published: {exc}", file=sys.stderr)
            return 1
        print(json.dumps({"date": result.date, "vintage": result.vintage, "values": result.values,
                          "reconciled": result.reconciled}, indent=2))
        return 0 if result.reconciled else 1
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
