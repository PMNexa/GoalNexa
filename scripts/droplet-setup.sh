#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu Droplet for the Swarm in
# docker-stack.yml: Docker, 2 GB swap, a `deploy` user (docker group) that
# CI and scripts/deploy.sh log in as, and - on the first node only - Swarm
# init on the private (VPC) IP. Safe to re-run. Runs as root on the
# Droplet, fed over SSH from your machine:
#
#   ssh root@<public-ip> "bash -s -- '$(cat ~/.ssh/goalnexa_deploy.pub)' <private-ip>" < scripts/droplet-setup.sh
#
# Leave out <private-ip> on a node that will join an existing Swarm.
set -euo pipefail

PUBKEY="${1:?usage: droplet-setup.sh '<deploy public key>' [<private-ip>]}"
SWARM_ADDR="${2:-}"

if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

id deploy >/dev/null 2>&1 || adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
keys=/home/deploy/.ssh/authorized_keys
touch "$keys"
grep -qxF "$PUBKEY" "$keys" || echo "$PUBKEY" >> "$keys"
chown deploy:deploy "$keys"
chmod 600 "$keys"

if [ -n "$SWARM_ADDR" ] && [ "$(docker info --format '{{.Swarm.LocalNodeState}}')" != "active" ]; then
  docker swarm init --advertise-addr "$SWARM_ADDR"
fi

echo "== Done"
docker info --format 'Docker {{.ServerVersion}}, Swarm {{.Swarm.LocalNodeState}}'
swapon --show
