#!/usr/bin/env bash
# Sets up a fresh Ubuntu 24.04 droplet to run the game, once, as root:
#
#   ssh root@<droplet ip> 'bash -s' -- '<deploy public key>' [domain] < deploy/setup-droplet.sh
#
# The deploy key is the one GitHub Actions logs in with (.github/workflows/deploy.yml).
# Without a domain the droplet is <ip-with-dashes>.sslip.io, which points at its IP,
# so HTTPS (which the installable app needs) works either way.
#
# What it puts where:
#   /opt/island        the game (dist/, server/, shared/), copied in by each deploy
#   /var/lib/island    the lobbies and farms (GAME_DATA), never touched by a deploy
#   island.service     node server/index.js on 127.0.0.1:3001, as the user `island`
#   Caddy              HTTPS (Let's Encrypt) on 443, passing everything to the game
#   deploy             the user Actions logs in as; it may only copy files and restart the game
# Running it again is safe, and is how the domain is changed.
set -euo pipefail

DEPLOY_KEY=${1:?usage: setup-droplet.sh '<deploy public key>' [domain]}
DOMAIN=${2:-}
APP=/opt/island
DATA=/var/lib/island

if [ -z "$DOMAIN" ]; then
  IP=$(curl -fsS http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address)
  DOMAIN="${IP//./-}.sslip.io"
fi

export DEBIAN_FRONTEND=noninteractive
# A new droplet updates itself for its first few minutes: wait for that, don't fail
apt_get() { apt-get -o DPkg::Lock::Timeout=900 "$@"; }
apt_get update
apt_get -y upgrade
apt_get install -y curl ca-certificates gnupg rsync ufw

# Node.js 24 (LTS)
if ! node --version 2>/dev/null | grep -q '^v24\.'; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt_get install -y nodejs
fi

# Caddy, from its own repository (Ubuntu's is old)
if ! command -v caddy >/dev/null; then
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
    | gpg --batch --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt_get update
  apt_get install -y caddy
fi

# Users: `island` runs the game, `deploy` brings new versions of it
id island >/dev/null 2>&1 || useradd --system --home-dir "$DATA" --shell /usr/sbin/nologin island
id deploy >/dev/null 2>&1 || useradd --create-home --shell /bin/bash deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
echo "$DEPLOY_KEY" > /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
echo 'deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart island' > /etc/sudoers.d/deploy
chmod 440 /etc/sudoers.d/deploy

install -d -m 755 -o deploy -g deploy "$APP"
install -d -m 750 -o island -g island "$DATA"

cat > /etc/systemd/system/island.service <<EOF
[Unit]
Description=Island Platformer game server
After=network.target

[Service]
User=island
WorkingDirectory=$APP
Environment=NODE_ENV=production PORT=3001 HOST=127.0.0.1 TRUST_PROXY=1 GAME_DATA=$DATA/lobbies.json
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=2
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=$DATA

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable island # started by the first deploy, once there is a game to run

cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3001
}
EOF
# A domain of your own: www.<domain> goes to it too (its DNS needs an A record for www)
if [[ $DOMAIN != *.sslip.io ]]; then
  cat >> /etc/caddy/Caddyfile <<EOF

www.$DOMAIN {
	redir https://$DOMAIN{uri} permanent
}
EOF
fi
systemctl reload-or-restart caddy

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo
echo "Ready: https://$DOMAIN (the game appears there after the first deploy)"
