#!/usr/bin/env python3
"""Loopback-only BitSecure packet capture bridge."""
import argparse
import asyncio
import base64
import json
import secrets
from scapy.all import AsyncSniffer
try:
    from websockets.asyncio.server import serve
except ImportError:
    from websockets import serve

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--interface", default=None)
    args = parser.parse_args()
    token = secrets.token_urlsafe(24)
    loop = asyncio.get_running_loop()
    print("BitSecure Packet Capture Agent")
    print("WebSocket: ws://127.0.0.1:8765")
    print("One-time token: " + token)
    print("Keep this terminal open. Ctrl+C stops capture.")

    async def handler(ws):
        sniffer = None
        try:
            auth = json.loads(await asyncio.wait_for(ws.recv(), timeout=15))
            if auth.get("type") != "auth" or not secrets.compare_digest(str(auth.get("token", "")), token):
                await ws.close(code=4001, reason="Authentication failed")
                return
            await ws.send(json.dumps({"type":"status","state":"ready","message":"Connected to local capture agent."}))
            async for raw_message in ws:
                command = json.loads(raw_message)
                if command.get("type") == "start":
                    if sniffer and sniffer.running:
                        continue
                    bpf = str(command.get("filter", "")).strip()
                    def on_packet(packet):
                        try:
                            data = base64.b64encode(bytes(packet)).decode("ascii")
                            event = {"type":"packet","timestamp":float(packet.time),"data":data}
                            asyncio.run_coroutine_threadsafe(ws.send(json.dumps(event)), loop)
                        except Exception:
                            pass
                    try:
                        sniffer = AsyncSniffer(iface=args.interface, filter=bpf or None, prn=on_packet, store=False)
                        sniffer.start()
                        await ws.send(json.dumps({"type":"status","state":"capturing","message":"Live packet capture started."}))
                    except Exception as exc:
                        await ws.send(json.dumps({"type":"error","message":str(exc)}))
                elif command.get("type") == "stop":
                    if sniffer and sniffer.running:
                        sniffer.stop()
                    await ws.send(json.dumps({"type":"status","state":"ready","message":"Capture stopped."}))
        except (asyncio.TimeoutError, json.JSONDecodeError):
            await ws.close(code=4002, reason="Invalid authentication")
        finally:
            if sniffer and sniffer.running:
                sniffer.stop()

    async with serve(handler, args.host, args.port, max_size=2**20):
        await asyncio.Future()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
