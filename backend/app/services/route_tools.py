"""Target validation, traceroute command + output parsing."""
import asyncio
import ipaddress
import re
import shutil
import subprocess
import sys


class TargetError(ValueError):
    pass


class ToolMissing(RuntimeError):
    def __init__(self, exe: str):
        super().__init__(exe)
        self.exe = exe


def parse_target(raw: str, allow_private: bool = False) -> str:
    """Accept only an IPv4 literal that is publicly routable. No hostnames, so nothing can be redirected."""
    try:
        ip = ipaddress.IPv4Address(raw.strip())
    except ValueError:
        raise TargetError("Enter a valid IPv4 address such as 8.8.8.8 (hostnames are not supported).")
    if ip.is_unspecified or ip.is_multicast:
        raise TargetError("That address cannot be traced.")
    if not allow_private and not ip.is_global:
        raise TargetError("That address is private or reserved, so it cannot be traced from the internet.")
    return str(ip)


def build_command(ip: str, max_hops: int, platform: str | None = None) -> list[str]:
    """Argument list only (never a shell string). `ip` must already be validated."""
    if (platform or sys.platform).startswith("win"):
        exe, args = "tracert", ["-d", "-h", str(max_hops), "-w", "2000", ip]
    else:
        exe, args = "traceroute", ["-n", "-q", "1", "-w", "2", "-m", str(max_hops), ip]
    path = shutil.which(exe)
    if not path:
        raise ToolMissing(exe)
    return [path, *args]


_HOP = re.compile(r"^\s*(\d+)\s+(.*)$")
_IP = re.compile(r"\b(\d{1,3}(?:\.\d{1,3}){3})\b")
_RTT = re.compile(r"(<?\d+(?:\.\d+)?)\s*ms")


def parse_line(line: str) -> dict | None:
    """One output line -> {hop, ip, rtt_ms, timeout}, or None for header/footer lines."""
    m = _HOP.match(line)
    if not m:
        return None
    rest = m.group(2)
    ips = _IP.findall(rest)
    rtts = [float(x.lstrip("<")) for x in _RTT.findall(rest)]
    ip = ips[0] if ips else None
    return {"hop": int(m.group(1)), "ip": ip, "rtt_ms": min(rtts) if rtts else None, "timeout": ip is None}


def is_private_hop(ip: str) -> bool:
    return not ipaddress.ip_address(ip).is_global


async def exec_lines(ip: str, max_hops: int, timeout_s: int):
    """Run the OS traceroute and yield its output lines as they appear. Killed on timeout or disconnect."""
    cmd = build_command(ip, max_hops)
    loop = asyncio.get_running_loop()
    proc = subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, errors="replace",
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    deadline = loop.time() + timeout_s
    try:
        while True:
            remaining = deadline - loop.time()
            if remaining <= 0:
                break
            try:
                line = await asyncio.wait_for(loop.run_in_executor(None, proc.stdout.readline), remaining)
            except asyncio.TimeoutError:
                break
            if not line:
                break
            yield line.rstrip()
    finally:
        if proc.poll() is None:
            proc.kill()
