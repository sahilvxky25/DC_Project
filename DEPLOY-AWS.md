# Deploy BitSecure on AWS (Ubuntu 24.04), step by step

You will create **one server** that runs the website, the API and the database, and optionally **a second small server** that acts as a receiver. Everything is done from your Windows laptop.

Steps marked **(you)** happen in your browser or Command Prompt. The setup script does the rest.

---

## 1. Create the main server (you)
1. Sign in to the AWS Console, pick a region near you (for example Asia Pacific (Mumbai)), and open **EC2 > Launch instance**.
2. **Name:** `bitsecure-server`. **Image:** *Ubuntu Server 24.04 LTS*. **Type:** `t3.micro` (or the free-tier one AWS shows).
3. **Key pair:** *Create new key pair*, name it `bitsecure-key`, type RSA, format `.pem`. It downloads once. **Keep this file safe and private.**
4. **Network settings > Edit.** Allow:
   - SSH (22) from **My IP** (not "Anywhere")
   - HTTP (80) from Anywhere
   - HTTPS (443) from Anywhere
5. **Storage:** 16 GiB gp3. Click **Launch instance**.

## 2. Give it a fixed address (you)
1. EC2 > **Elastic IPs > Allocate Elastic IP address > Allocate**.
2. Select it > **Actions > Associate Elastic IP address** > choose `bitsecure-server`.
3. Write down this IP. It is `YOUR_IP` below.

## 3. Get a web address (you) - recommended
HTTPS needs a domain name. A free one is fine:
1. Go to **duckdns.org**, sign in, and create a subdomain such as `mybitsecure`. That gives `mybitsecure.duckdns.org`.
2. Set its **current ip** to `YOUR_IP` and click update.

No domain? You can still test at `http://YOUR_IP`, but logins travel unencrypted, so only use that for a quick check.

## 4. Upload the project (you)
In Command Prompt (replace the paths):
```cmd
cd %USERPROFILE%\Downloads
icacls C:\path\to\bitsecure-key.pem /inheritance:r
icacls C:\path\to\bitsecure-key.pem /grant:r "%USERNAME%:R"
scp -i C:\path\to\bitsecure-key.pem bitsecure-deploy.zip ubuntu@YOUR_IP:~
ssh -i C:\path\to\bitsecure-key.pem ubuntu@YOUR_IP
```
Answer `yes` to the fingerprint question. You are now on the server (the prompt starts with `ubuntu@`).

## 5. Run the setup script (on the server)
```bash
sudo apt-get install -y unzip
unzip bitsecure-deploy.zip
cd bitsecure-deploy
sudo bash deploy/setup-server.sh mybitsecure.duckdns.org you@example.com
```
(With no domain: `sudo bash deploy/setup-server.sh`.)

It takes a few minutes. It installs everything, creates the database and secrets, starts the API, sets up Nginx and the firewall, and gets the HTTPS certificate. At the end it prints a **RECEIVER SECRET**. **Copy it** now. You need it for step 7. It is also saved in `/etc/bitsecure/api.env`.

Check the output lines near the end:
- `{"status":"ok"} <- API is running`
- a few traceroute lines (hops 1 to 3). If it prints `* * *` only, see Troubleshooting.

## 6. Test the website (you)
1. Open `https://mybitsecure.duckdns.org` and sign up.
2. Open **Network layer > Live route**, enter `8.8.8.8` and click Send. The route should appear hop by hop and say no data was delivered (there is no receiver there).

## 7. Add a receiver machine (you + script)
1. Launch a second instance like in step 1 (`bitsecure-receiver`, `t3.micro`, same key pair). Security group: SSH from **My IP**, plus a **Custom TCP rule: port 9009, source = YOUR_IP/32** (the main server's Elastic IP).
2. Upload and install:
```cmd
scp -i C:\path\to\bitsecure-key.pem bitsecure-deploy.zip ubuntu@RECEIVER_IP:~
ssh -i C:\path\to\bitsecure-key.pem ubuntu@RECEIVER_IP
```
```bash
sudo apt-get install -y unzip && unzip bitsecure-deploy.zip && cd bitsecure-deploy
sudo bash deploy/install-receiver.sh THE_RECEIVER_SECRET YOUR_IP my-receiver
```
3. On the website, Live route: enter `RECEIVER_IP`, type a message and click Send. You should see **Delivered**, the received text and a matching checksum.
4. On the receiver, watch it arrive: `sudo journalctl -u bitsecure-receiver -f` or `cat /var/lib/bitsecure-receiver/received.log`.

Tip: a stopped and restarted instance gets a new public IP. Give the receiver an Elastic IP too if you will stop it.

## 8. Updating later
Make a new zip, upload it like step 4, then on the server unzip it and run the same `setup-server.sh` line again. Your database, secrets and settings are kept.

## 9. Useful commands on the server
```bash
sudo systemctl status bitsecure-api          # is it running?
sudo journalctl -u bitsecure-api -f          # live backend log
sudo systemctl restart bitsecure-api
sudo nginx -t && sudo systemctl reload nginx
traceroute -n -q 1 -w 2 -m 20 8.8.8.8        # the same route command the website uses
mtr -n -r -c 5 8.8.8.8                       # needs: sudo apt install mtr-tiny
sudo -u postgres psql bitsecure -c "select email, created_at from users;"
```

## Troubleshooting
| Problem | Fix |
|---|---|
| `ssh` says "UNPROTECTED PRIVATE KEY FILE" | Run the two `icacls` lines from step 4 again. |
| Site does not open | Check the security group allows 80 and 443, and the domain points to `YOUR_IP`. |
| 502 Bad Gateway | The API is down: `sudo journalctl -u bitsecure-api -n 50`. |
| Certificate step failed | The domain must already point to `YOUR_IP`. Then run `sudo certbot --nginx -d YOUR_DOMAIN`. |
| Live route says "traceroute is not installed" | `sudo apt-get install -y traceroute` |
| traceroute prints "permission" errors for the service user | `sudo setcap cap_net_raw+ep $(readlink -f $(which traceroute))`, then `sudo systemctl restart bitsecure-api`. |
| Route shows only "no reply" hops | Normal for some networks and hosts. Try another target such as `1.1.1.1`. |
| Receiver never found | Same secret on both machines? Port 9009 open from `YOUR_IP/32` in the receiver's security group? `sudo systemctl status bitsecure-receiver` |
| Hourly limit reached | Each user gets 10 runs per hour. |

## Safety checklist
- SSH only from your own IP. Never open port 5432 (the database) or 8001 (the API).
- Keep `bitsecure-key.pem` private. Never share `/etc/bitsecure/api.env`.
- Do **not** set `ALLOW_PRIVATE_TARGETS=true` on this server.
- Stop or terminate the instances (and release unused Elastic IPs) when you are done, so they stop costing money.
